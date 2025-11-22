# Real-Time Sentiment Analysis Platform - Solution Overview

## Architecture Overview

This production-grade sentiment analysis platform processes social media data in real-time using enterprise-grade streaming architecture.

### High-Level Data Flow

```
Social Media APIs → Kafka (sentiment.raw) → Flink Processing → ML Service → Kafka (sentiment.processed)
                                                                                    ↓
                                                                              Aggregator Service
                                                                                    ↓
                                                                    Redis (metrics) + Elasticsearch (history)
                                                                                    ↓
                                                                            WebSocket Gateway
                                                                                    ↓
                                                                            React Dashboard
```

## System Components

### 1. Social Media Connectors
- **Twitter Connector**: Uses Twitter API v2 with OAuth 2.0, rate limiting, and backoff strategies
- **Reddit Connector**: Uses Reddit API with OAuth, pagination, and keyword filtering
- **Synthetic Generator**: Produces 20K+ realistic messages with metadata when APIs unavailable

### 2. ML Service
- **Model**: CardiffNLP Twitter RoBERTa Sentiment + Emotion Classification
- **Framework**: HuggingFace Transformers with PyTorch
- **Features**: GPU/CPU fallback, batch inference, toxicity scoring
- **Output**: Sentiment score (-1 to 1), emotion classification, toxicity, churn risk

### 3. Flink Stream Processing
- **Language**: Java 11+ with Flink 1.18
- **Functions**:
  - Data cleansing and validation
  - ML service integration
  - Data enrichment with geo/product mapping
  - Stateful windowing for trend detection

### 4. Aggregator Service
- **Language**: Node.js with TypeScript
- **Functions**:
  - Real-time metric aggregation
  - Geo-sentiment computation
  - Product sentiment tracking
  - Channel performance metrics
  - Trend velocity calculation
  - Redis caching
  - Elasticsearch historical storage

### 5. WebSocket API Gateway
- **Framework**: Node.js with Socket.io
- **Features**:
  - Real-time event streaming
  - Client connection management
  - Authentication middleware
  - Load balancing support

### 6. React Dashboard
- **Framework**: React 18 with TypeScript
- **Visualization**: D3.js for real-time charts
- **Panels**:
  1. Overall Sentiment Gauge
  2. Geographic Heat Map
  3. Product Sentiment Comparison
  4. Channel Performance
  5. Emotion Distribution
  6. Trend Timeline

## Infrastructure Integration

### ENBD External Services (ConfigMap/Secret)
- **Kafka**: `kafka.enbd.ae:9092` (ConfigMap)
- **Redis**: Host/Port/Password via Secret
- **Elasticsearch**: `https://elasticsearch.enbd.ae:9200` (ConfigMap)

### Topics
- `sentiment.raw`: Raw social media messages
- `sentiment.processed`: ML-analyzed messages with scores
- `sentiment.alerts`: High-priority alerts (churn risk > 0.7)

### Redis Keys
- `sentiment:geo:{city}` - Geographic sentiment aggregates
- `sentiment:product:{product}` - Product sentiment scores
- `sentiment:channel:{channel}` - Channel performance
- `sentiment:trend:{timestamp}` - Time-series trends

### Elasticsearch Indices
- `sentiment-messages-*`: Daily indices for message history
- `sentiment-aggregates-*`: Daily indices for computed metrics

## Deployment Strategies

### Local Development
```bash
docker-compose up -d
```

### OpenShift Production
```bash
oc apply -f openshift/
```

## Security Features
- OAuth 2.0 for external APIs
- JWT tokens for WebSocket authentication
- Redis password encryption
- Secret management via OpenShift Secrets
- Network policies for inter-service communication

## Monitoring & Observability
- Prometheus metrics endpoints on all services
- Structured JSON logging
- Flink job metrics
- WebSocket connection tracking
- ML inference latency tracking

## Performance Characteristics
- **Throughput**: 10K+ messages/second
- **Latency**: < 500ms end-to-end (ingestion to dashboard)
- **ML Inference**: ~50ms per message (GPU), ~200ms (CPU)
- **Dashboard Update**: Real-time (< 100ms via WebSocket)

## Scalability
- Horizontal scaling via Kafka consumer groups
- Flink parallelism configuration
- Redis cluster support
- Elasticsearch sharding
- Load-balanced WebSocket connections

## Technology Stack
- **Streaming**: Apache Kafka 3.6+, Apache Flink 1.18
- **ML**: Python 3.11, PyTorch 2.1, HuggingFace Transformers
- **Backend**: Node.js 20, Java 17
- **Frontend**: React 18, TypeScript 5, D3.js v7
- **Storage**: Redis 7, Elasticsearch 8
- **Orchestration**: Docker Compose, OpenShift 4.x
