# Real-Time Sentiment Analysis Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/)
[![Node.js](https://img.shields.io/badge/node-20.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.x-blue.svg)](https://reactjs.org/)

A production-grade, enterprise-level real-time sentiment analysis platform built for Emirates NBD's hackathon. This system ingests social media data, analyzes sentiment using state-of-the-art machine learning models, processes streams in real-time, and provides live insights through an interactive dashboard.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

This platform provides real-time sentiment intelligence by:

- **Ingesting** social media data from Twitter, Reddit, and other platforms
- **Analyzing** sentiment, emotion, toxicity, and churn risk using HuggingFace Transformers
- **Processing** streams with Apache Flink for low-latency transformations
- **Aggregating** metrics in Redis for instant access
- **Storing** historical data in Elasticsearch for analytics
- **Streaming** updates via WebSockets for real-time visualization
- **Visualizing** insights through an interactive React dashboard with D3.js

## Architecture

```
┌─────────────────┐
│ Social Media    │
│ APIs (Twitter,  │
│ Reddit, etc.)   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Kafka Topic     │
│ sentiment.raw   │
└────────┬────────┘
         │
         v
┌─────────────────┐      ┌─────────────────┐
│ Flink Stream    │─────>│ ML Service      │
│ Processing      │      │ (HuggingFace)   │
└────────┬────────┘      └─────────────────┘
         │
         v
┌─────────────────┐
│ Kafka Topic     │
│sentiment.proces │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Aggregator      │
│ Service         │
└────┬────────┬───┘
     │        │
     v        v
┌────────┐ ┌──────────────┐
│ Redis  │ │Elasticsearch │
└───┬────┘ └──────────────┘
    │
    v
┌─────────────────┐
│ WebSocket API   │
│ Gateway         │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ React Dashboard │
│ with D3.js      │
└─────────────────┘
```

## Features

### Social Media Integration
- ✅ **Twitter API v2** integration with OAuth 2.0
- ✅ **Reddit API** integration with PRAW
- ✅ Rate limiting and backoff strategies
- ✅ Retry logic for resilience
- ✅ **Synthetic data generator** (20K+ messages) for testing

### Machine Learning
- ✅ **CardiffNLP Twitter RoBERTa** for sentiment analysis
- ✅ **Emotion classification** with 7 emotion categories
- ✅ **Toxicity scoring** for content moderation
- ✅ **Churn risk prediction** for customer retention
- ✅ GPU/CPU fallback support
- ✅ Batch inference optimization

### Stream Processing
- ✅ Apache Flink 1.18 for stateful stream processing
- ✅ Data cleansing and validation
- ✅ ML enrichment integration
- ✅ Checkpointing and fault tolerance

### Data Storage
- ✅ Redis for real-time metrics aggregation
- ✅ Elasticsearch for historical data and search
- ✅ Time-series data with automatic indexing

### Real-Time Dashboard
- ✅ **6 interactive panels** with D3.js visualizations
  1. Overall Sentiment Gauge
  2. Geographic Heat Map
  3. Product Sentiment Comparison
  4. Channel Performance
  5. Emotion Distribution (Pie Chart)
  6. Real-Time Trend Timeline
- ✅ WebSocket-based live updates
- ✅ Responsive design
- ✅ Dark theme optimized for operations centers

## Technology Stack

| Category | Technologies |
|----------|-------------|
| **Streaming** | Apache Kafka 3.6+, Apache Flink 1.18 |
| **ML/AI** | Python 3.11, PyTorch 2.1, HuggingFace Transformers |
| **Backend** | Node.js 20, TypeScript 5, Java 17 |
| **Frontend** | React 18, TypeScript 5, D3.js v7 |
| **Storage** | Redis 7, Elasticsearch 8 |
| **Infrastructure** | Docker Compose, OpenShift 4.x |
| **APIs** | FastAPI, Express.js, Socket.io |

## Prerequisites

### Local Development
- Docker Desktop 24.x+
- Docker Compose 2.x+
- 16GB RAM minimum
- 50GB disk space

### OpenShift Production
- OpenShift 4.12+
- Access to ENBD Kafka cluster
- Access to ENBD Redis cluster
- Access to ENBD Elasticsearch cluster

### API Keys (Optional)
- Twitter API Bearer Token
- Reddit API Client ID and Secret

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/enbd/sentiment-analysis.git
cd sentiment-analysis
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start All Services
```bash
docker-compose up -d
```

### 4. Generate Synthetic Data
```bash
# Start the data generator to produce 20K messages
docker-compose up data-generator
```

### 5. Access the Dashboard
```bash
open http://localhost:3000
```

## Configuration

### Environment Variables

#### ML Service
```bash
MODEL_NAME=cardiffnlp/twitter-roberta-base-sentiment-latest
EMOTION_MODEL=j-hartmann/emotion-english-distilroberta-base
DEVICE=cpu  # or 'cuda' for GPU
WORKERS=4
```

#### Kafka Configuration
```bash
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_RAW_TOPIC=sentiment.raw
KAFKA_PROCESSED_TOPIC=sentiment.processed
```

#### Redis Configuration
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=enbd_redis_pass
```

#### Elasticsearch Configuration
```bash
ELASTICSEARCH_URL=http://localhost:9200
```

### ENBD Production Infrastructure

For OpenShift deployment, update the ConfigMap and Secret:

```bash
# Edit openshift/configmap.yaml
KAFKA_BOOTSTRAP_SERVERS: "kafka.enbd.ae:9092"
ELASTICSEARCH_URL: "https://elasticsearch.enbd.ae:9200"

# Edit openshift/secret.yaml
REDIS_HOST: "redis.enbd.ae"
REDIS_PASSWORD: "<from-vault>"
```

## Deployment

### Local Development (Docker Compose)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### OpenShift Production

#### 1. Create Namespace
```bash
oc new-project enbd-sentiment
```

#### 2. Create ConfigMap and Secrets
```bash
# Update values in openshift/configmap.yaml and openshift/secret.yaml first
oc apply -f openshift/configmap.yaml
oc apply -f openshift/secret.yaml
```

#### 3. Build Images
```bash
oc apply -f openshift/buildconfig.yaml

# Trigger builds
oc start-build ml-service
oc start-build flink-job
oc start-build aggregator
oc start-build api-gateway
oc start-build frontend
oc start-build twitter-connector
oc start-build reddit-connector
oc start-build data-generator
```

#### 4. Deploy Services
```bash
oc apply -f openshift/ml-service-deployment.yaml
oc apply -f openshift/flink-deployment.yaml
oc apply -f openshift/aggregator-deployment.yaml
oc apply -f openshift/api-gateway-deployment.yaml
oc apply -f openshift/frontend-deployment.yaml
oc apply -f openshift/connectors-deployment.yaml
```

#### 5. Access the Application
```bash
# Get the frontend route
oc get route frontend -n enbd-sentiment

# Output: https://sentiment.enbd.ae
```

## API Documentation

### ML Service API

#### Analyze Single Text
```bash
POST /analyze
Content-Type: application/json

{
  "text": "Love the new mobile banking app!",
  "include_emotion": true,
  "include_toxicity": true
}
```

**Response:**
```json
{
  "sentiment_score": 0.85,
  "sentiment_label": "positive",
  "confidence": 0.92,
  "emotion": "joy",
  "emotion_scores": {
    "joy": 0.78,
    "neutral": 0.15,
    "surprise": 0.07
  },
  "toxicity": 0.02,
  "churn_risk": 0.05,
  "inference_time_ms": 45.2
}
```

#### Batch Analysis
```bash
POST /analyze/batch
Content-Type: application/json

{
  "texts": ["Text 1", "Text 2", "Text 3"],
  "include_emotion": true,
  "include_toxicity": true
}
```

### API Gateway

#### Get Overall Metrics
```bash
GET /api/metrics/overall
```

#### Get Geographic Metrics
```bash
GET /api/metrics/geo
```

#### Get Product Metrics
```bash
GET /api/metrics/products
```

#### Get Channel Metrics
```bash
GET /api/metrics/channels
```

### WebSocket Events

#### Connect to WebSocket
```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001');

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('message:new', (message) => {
  console.log('New message:', message);
});

socket.on('metrics:initial', (metrics) => {
  console.log('Initial metrics:', metrics);
});

socket.on('alert:churn', (alert) => {
  console.log('High churn risk alert:', alert);
});
```

## Monitoring

### Service Health Checks

```bash
# ML Service
curl http://localhost:8000/health

# API Gateway
curl http://localhost:3001/health

# Frontend
curl http://localhost:3000/health
```

### Flink Dashboard
```bash
open http://localhost:8081
```

### Prometheus Metrics

All services expose Prometheus metrics:
```bash
curl http://localhost:8000/metrics  # ML Service
```

### Logs

```bash
# Docker Compose
docker-compose logs -f [service-name]

# OpenShift
oc logs -f deployment/ml-service -n enbd-sentiment
```

## Performance Benchmarks

### ML Service
```bash
cd ml-service
python benchmark.py
```

**Expected Results:**
- Single Inference: ~50ms (GPU), ~200ms (CPU)
- Batch Inference (10 texts): ~150ms (GPU), ~500ms (CPU)
- Throughput: 20 requests/second (CPU), 100 requests/second (GPU)

### System Throughput
- **Message Ingestion**: 10K+ messages/second
- **End-to-End Latency**: < 500ms (ingestion to dashboard)
- **Dashboard Update**: Real-time (< 100ms via WebSocket)

## Troubleshooting

### Kafka Connection Issues
```bash
# Test Kafka connectivity
docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092
```

### ML Service Not Loading Models
```bash
# Check disk space
df -h

# Manually download models
docker-compose exec ml-service python -c "from transformers import AutoModel; AutoModel.from_pretrained('cardiffnlp/twitter-roberta-base-sentiment-latest')"
```

### Frontend Not Connecting to WebSocket
```bash
# Check CORS configuration
# Edit api-gateway/websocket-server.js
CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
```

### Elasticsearch Index Issues
```bash
# Delete and recreate indices
curl -X DELETE http://localhost:9200/sentiment-messages-*
```

## Project Structure

```
.
├── connectors/
│   ├── x-twitter/           # Twitter API connector
│   ├── reddit/              # Reddit API connector
│   └── generator/           # Synthetic data generator
├── ml-service/              # ML inference service
├── flink-job/               # Flink stream processing
├── aggregator/              # Metrics aggregation service
├── api-gateway/             # WebSocket API gateway
├── frontend/                # React dashboard
├── openshift/               # OpenShift manifests
├── docker-compose.yml       # Local development
├── .env.example             # Environment variables template
└── README.md               # This file
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **HuggingFace** for providing excellent pre-trained models
- **Apache Flink** for powerful stream processing
- **D3.js** for beautiful visualizations
- **Emirates NBD** for the hackathon opportunity

## Contact

For questions or support, please contact:
- Email: sentiment-support@enbd.ae
- Slack: #sentiment-analysis

---

**Built with ❤️ for Emirates NBD Hackathon**
