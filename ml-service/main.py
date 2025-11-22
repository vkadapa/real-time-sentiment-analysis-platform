"""
ML Service for Real-Time Sentiment Analysis
Uses HuggingFace Transformers with CardiffNLP RoBERTa models
"""

import os
import time
import logging
from typing import List, Dict, Any
from contextlib import asynccontextmanager

import torch
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    pipeline
)
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
INFERENCE_COUNTER = Counter('ml_inference_total', 'Total number of inferences')
INFERENCE_LATENCY = Histogram('ml_inference_latency_seconds', 'Inference latency')
BATCH_SIZE = Histogram('ml_batch_size', 'Batch inference size')

# Global model holders
models = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup"""
    logger.info("Loading ML models...")

    # Determine device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if os.getenv("DEVICE"):
        device = os.getenv("DEVICE")

    logger.info(f"Using device: {device}")

    try:
        # Load sentiment model (CardiffNLP Twitter RoBERTa)
        sentiment_model_name = os.getenv(
            "MODEL_NAME",
            "cardiffnlp/twitter-roberta-base-sentiment-latest"
        )
        logger.info(f"Loading sentiment model: {sentiment_model_name}")

        models['sentiment_tokenizer'] = AutoTokenizer.from_pretrained(sentiment_model_name)
        models['sentiment_model'] = AutoModelForSequenceClassification.from_pretrained(
            sentiment_model_name
        ).to(device)
        models['sentiment_model'].eval()

        # Load emotion model
        emotion_model_name = os.getenv(
            "EMOTION_MODEL",
            "j-hartmann/emotion-english-distilroberta-base"
        )
        logger.info(f"Loading emotion model: {emotion_model_name}")

        models['emotion_tokenizer'] = AutoTokenizer.from_pretrained(emotion_model_name)
        models['emotion_model'] = AutoModelForSequenceClassification.from_pretrained(
            emotion_model_name
        ).to(device)
        models['emotion_model'].eval()

        # Store device
        models['device'] = device

        # Emotion labels
        models['emotion_labels'] = ['anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise']

        logger.info("All models loaded successfully!")

    except Exception as e:
        logger.error(f"Error loading models: {e}")
        raise

    yield

    # Cleanup
    logger.info("Shutting down ML service...")
    models.clear()


app = FastAPI(
    title="ENBD Sentiment Analysis ML Service",
    description="Production-grade sentiment and emotion analysis using HuggingFace Transformers",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class AnalysisRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Text to analyze")
    include_emotion: bool = Field(True, description="Include emotion classification")
    include_toxicity: bool = Field(True, description="Include toxicity score")


class BatchAnalysisRequest(BaseModel):
    texts: List[str] = Field(..., min_items=1, max_items=100, description="Batch of texts")
    include_emotion: bool = Field(True, description="Include emotion classification")
    include_toxicity: bool = Field(True, description="Include toxicity score")


class AnalysisResponse(BaseModel):
    sentiment_score: float = Field(..., ge=-1, le=1, description="Sentiment score from -1 (negative) to 1 (positive)")
    sentiment_label: str = Field(..., description="Sentiment label: positive, negative, or neutral")
    confidence: float = Field(..., ge=0, le=1, description="Confidence of sentiment prediction")
    emotion: str = Field(None, description="Dominant emotion")
    emotion_scores: Dict[str, float] = Field(None, description="All emotion scores")
    toxicity: float = Field(None, ge=0, le=1, description="Toxicity score")
    churn_risk: float = Field(None, ge=0, le=1, description="Estimated churn risk")
    inference_time_ms: float = Field(..., description="Inference time in milliseconds")


class BatchAnalysisResponse(BaseModel):
    results: List[AnalysisResponse]
    total_inference_time_ms: float


def analyze_sentiment(text: str) -> Dict[str, Any]:
    """
    Analyze sentiment using CardiffNLP RoBERTa model
    Returns sentiment score, label, and confidence
    """
    tokenizer = models['sentiment_tokenizer']
    model = models['sentiment_model']
    device = models['device']

    # Tokenize
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True
    ).to(device)

    # Inference
    with torch.no_grad():
        outputs = model(**inputs)
        scores = torch.nn.functional.softmax(outputs.logits, dim=-1)

    # Get predictions
    scores_np = scores.cpu().numpy()[0]

    # Labels: [negative, neutral, positive]
    sentiment_labels = ['negative', 'neutral', 'positive']

    # Get dominant label and confidence
    predicted_idx = np.argmax(scores_np)
    sentiment_label = sentiment_labels[predicted_idx]
    confidence = float(scores_np[predicted_idx])

    # Calculate sentiment score (-1 to 1)
    # Weighted average: negative=-1, neutral=0, positive=1
    sentiment_score = float(
        scores_np[0] * -1.0 +  # negative
        scores_np[1] * 0.0 +    # neutral
        scores_np[2] * 1.0       # positive
    )

    return {
        'sentiment_score': sentiment_score,
        'sentiment_label': sentiment_label,
        'confidence': confidence,
        'raw_scores': {
            'negative': float(scores_np[0]),
            'neutral': float(scores_np[1]),
            'positive': float(scores_np[2])
        }
    }


def analyze_emotion(text: str) -> Dict[str, Any]:
    """
    Analyze emotion using emotion classification model
    Returns dominant emotion and all emotion scores
    """
    tokenizer = models['emotion_tokenizer']
    model = models['emotion_model']
    device = models['device']
    emotion_labels = models['emotion_labels']

    # Tokenize
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True
    ).to(device)

    # Inference
    with torch.no_grad():
        outputs = model(**inputs)
        scores = torch.nn.functional.softmax(outputs.logits, dim=-1)

    # Get predictions
    scores_np = scores.cpu().numpy()[0]

    # Create emotion scores dict
    emotion_scores = {
        label: float(score)
        for label, score in zip(emotion_labels, scores_np)
    }

    # Get dominant emotion
    dominant_idx = np.argmax(scores_np)
    dominant_emotion = emotion_labels[dominant_idx]

    return {
        'emotion': dominant_emotion,
        'emotion_scores': emotion_scores
    }


def calculate_toxicity(text: str, sentiment_result: Dict, emotion_result: Dict = None) -> float:
    """
    Calculate toxicity score based on sentiment and emotion
    This is a heuristic approach - in production, use a dedicated toxicity model
    """
    toxicity = 0.0

    # Strong negative sentiment increases toxicity
    if sentiment_result['sentiment_score'] < -0.5:
        toxicity += 0.3

    # Emotion-based toxicity
    if emotion_result:
        emotion_scores = emotion_result['emotion_scores']
        toxicity += emotion_scores.get('anger', 0) * 0.4
        toxicity += emotion_scores.get('disgust', 0) * 0.3
        toxicity += emotion_scores.get('fear', 0) * 0.1

    # Check for offensive keywords (simple approach)
    toxic_keywords = ['hate', 'worst', 'terrible', 'awful', 'horrible', 'scam', 'fraud']
    text_lower = text.lower()
    keyword_count = sum(1 for keyword in toxic_keywords if keyword in text_lower)
    toxicity += min(keyword_count * 0.1, 0.3)

    return min(toxicity, 1.0)


def calculate_churn_risk(sentiment_result: Dict, emotion_result: Dict = None, toxicity: float = 0) -> float:
    """
    Calculate churn risk based on sentiment, emotion, and toxicity
    High churn risk indicates customer dissatisfaction
    """
    churn_risk = 0.0

    # Negative sentiment increases churn risk
    if sentiment_result['sentiment_score'] < 0:
        churn_risk += abs(sentiment_result['sentiment_score']) * 0.5

    # High toxicity indicates dissatisfaction
    churn_risk += toxicity * 0.3

    # Negative emotions increase churn risk
    if emotion_result:
        emotion_scores = emotion_result['emotion_scores']
        churn_risk += emotion_scores.get('anger', 0) * 0.4
        churn_risk += emotion_scores.get('sadness', 0) * 0.2
        churn_risk += emotion_scores.get('fear', 0) * 0.1

    return min(churn_risk, 1.0)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "models_loaded": len(models) > 0,
        "device": models.get('device', 'unknown')
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_text(request: AnalysisRequest):
    """
    Analyze a single text for sentiment, emotion, toxicity, and churn risk
    """
    start_time = time.time()

    try:
        INFERENCE_COUNTER.inc()

        # Analyze sentiment
        sentiment_result = analyze_sentiment(request.text)

        # Analyze emotion
        emotion_result = None
        if request.include_emotion:
            emotion_result = analyze_emotion(request.text)

        # Calculate toxicity
        toxicity = None
        if request.include_toxicity:
            toxicity = calculate_toxicity(request.text, sentiment_result, emotion_result)

        # Calculate churn risk
        churn_risk = calculate_churn_risk(sentiment_result, emotion_result, toxicity or 0)

        # Calculate inference time
        inference_time_ms = (time.time() - start_time) * 1000
        INFERENCE_LATENCY.observe(time.time() - start_time)

        return AnalysisResponse(
            sentiment_score=sentiment_result['sentiment_score'],
            sentiment_label=sentiment_result['sentiment_label'],
            confidence=sentiment_result['confidence'],
            emotion=emotion_result['emotion'] if emotion_result else None,
            emotion_scores=emotion_result['emotion_scores'] if emotion_result else None,
            toxicity=toxicity,
            churn_risk=churn_risk,
            inference_time_ms=inference_time_ms
        )

    except Exception as e:
        logger.error(f"Error during analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze/batch", response_model=BatchAnalysisResponse)
async def analyze_batch(request: BatchAnalysisRequest):
    """
    Analyze multiple texts in batch for better performance
    """
    start_time = time.time()

    try:
        BATCH_SIZE.observe(len(request.texts))

        results = []

        for text in request.texts:
            # Create individual request
            individual_request = AnalysisRequest(
                text=text,
                include_emotion=request.include_emotion,
                include_toxicity=request.include_toxicity
            )

            # Analyze (reuse single analysis logic)
            result = await analyze_text(individual_request)
            results.append(result)

        total_time_ms = (time.time() - start_time) * 1000

        return BatchAnalysisResponse(
            results=results,
            total_inference_time_ms=total_time_ms
        )

    except Exception as e:
        logger.error(f"Error during batch analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "ENBD Sentiment Analysis ML Service",
        "version": "1.0.0",
        "models": {
            "sentiment": "cardiffnlp/twitter-roberta-base-sentiment-latest",
            "emotion": "j-hartmann/emotion-english-distilroberta-base"
        },
        "endpoints": {
            "analyze": "/analyze",
            "batch": "/analyze/batch",
            "health": "/health",
            "metrics": "/metrics"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
