# System Architecture

## Overview

This document describes the architecture of the Real-Time Sentiment Analysis Platform.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Data Ingestion Layer                             │
├───────────────┬────────────────┬──────────────────┬──────────────────────┤
│ Twitter API   │ Reddit API     │ Instagram API    │ Synthetic Generator  │
│ Connector     │ Connector      │ Connector        │ (20K messages)       │
└───────┬───────┴────────┬───────┴────────┬─────────┴──────────┬───────────┘
        │                │                │                    │
        └────────────────┴────────────────┴────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Message Queue (Kafka)                             │
│                        Topic: sentiment.raw                               │
└──────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Stream Processing Layer                              │
│                        (Apache Flink 1.18)                                │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐                │
│  │ Data        │───>│ ML Service   │───>│ Enrichment   │                │
│  │ Validation  │    │ Call         │    │              │                │
│  └─────────────┘    └──────────────┘    └──────────────┘                │
└──────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Message Queue (Kafka)                             │
│                      Topic: sentiment.processed                           │
└──────────┬────────────────────────────────────────────┬──────────────────┘
           │                                            │
           ▼                                            ▼
┌────────────────────────┐                    ┌──────────────────────────┐
│   ML Service           │                    │  Aggregator Service      │
│   (FastAPI + PyTorch)  │                    │  (Node.js + TypeScript)  │
│                        │                    │                          │
│ • Sentiment Analysis   │                    │ • Geo Aggregation        │
│ • Emotion Detection    │                    │ • Product Metrics        │
│ • Toxicity Scoring     │                    │ • Channel Analysis       │
│ • Churn Risk           │                    │ • Trend Calculation      │
└────────────────────────┘                    └──────┬──────────┬────────┘
                                                     │          │
                                                     ▼          ▼
                                            ┌───────────┐  ┌──────────────┐
                                            │  Redis    │  │Elasticsearch │
                                            │  (Cache)  │  │ (History)    │
                                            └─────┬─────┘  └──────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    WebSocket API Gateway                                  │
│                    (Express + Socket.io)                                  │
│  • Real-time streaming                                                    │
│  • REST API endpoints                                                     │
│  • Client connection management                                           │
└──────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Frontend Dashboard                                  │
│                    (React 18 + D3.js + TypeScript)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Sentiment    │  │ Geographic   │  │ Product      │                   │
│  │ Gauge        │  │ Heat Map     │  │ Comparison   │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Channel      │  │ Emotion      │  │ Real-Time    │                   │
│  │ Performance  │  │ Distribution │  │ Trend        │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Data Ingestion Layer

#### Twitter Connector
- **Technology**: Python 3.11 + Tweepy
- **Authentication**: OAuth 2.0 Bearer Token
- **Features**:
  - Rate limiting (300 requests per 15 min)
  - Exponential backoff
  - Keyword filtering
  - Language filtering
- **Output**: Raw messages to Kafka

#### Reddit Connector
- **Technology**: Python 3.11 + PRAW
- **Authentication**: OAuth with Client ID/Secret
- **Features**:
  - Subreddit monitoring
  - Comment extraction
  - Rate limiting (60 requests per minute)
  - Keyword filtering
- **Output**: Raw messages to Kafka

#### Synthetic Data Generator
- **Technology**: Python 3.11 + Faker
- **Purpose**: Generate test data when APIs unavailable
- **Features**:
  - 20K+ realistic messages
  - Multiple sentiment types
  - Realistic metadata (geo, product, channel)
  - Configurable generation rate
- **Output**: Raw messages to Kafka

### 2. Message Queue (Kafka)

#### Topics
- **sentiment.raw**: Raw ingested messages
  - Partitions: 3
  - Replication Factor: 2 (prod)
  - Retention: 7 days

- **sentiment.processed**: ML-analyzed messages
  - Partitions: 3
  - Replication Factor: 2 (prod)
  - Retention: 30 days

### 3. Stream Processing Layer (Flink)

#### Flink Job Manager
- **Resources**: 1 CPU, 2GB RAM
- **Responsibilities**:
  - Job scheduling
  - Checkpoint coordination
  - State management

#### Flink Task Managers
- **Replicas**: 2
- **Resources**: 2 CPU, 2GB RAM each
- **Parallelism**: 2
- **Processing Steps**:
  1. Data validation and cleansing
  2. ML service invocation
  3. Data enrichment
  4. Output to processed topic

### 4. ML Service

#### Technology Stack
- **Framework**: FastAPI + Uvicorn
- **ML Library**: PyTorch 2.1 + HuggingFace Transformers
- **Models**:
  - Sentiment: `cardiffnlp/twitter-roberta-base-sentiment-latest`
  - Emotion: `j-hartmann/emotion-english-distilroberta-base`

#### Performance
- **Latency**: 50ms (GPU), 200ms (CPU)
- **Throughput**: 100 req/s (GPU), 20 req/s (CPU)
- **Batch Processing**: Up to 100 texts per request

#### Outputs
- Sentiment score (-1 to 1)
- Sentiment label (positive/negative/neutral)
- Emotion (7 categories)
- Toxicity score (0 to 1)
- Churn risk (0 to 1)

### 5. Aggregator Service

#### Aggregation Windows
- **Window Size**: 60 seconds (configurable)
- **Aggregation Types**:
  - Geographic (by city)
  - Product (by product type)
  - Channel (by channel)
  - Platform (by social media platform)
  - Overall metrics

#### Computed Metrics
- Average sentiment
- Count by sentiment label
- Average churn risk
- High churn risk count
- Average toxicity
- Emotion distribution

### 6. Storage Layer

#### Redis
- **Purpose**: Real-time metrics cache
- **TTL**: 24 hours
- **Key Patterns**:
  - `sentiment:overall` - Overall metrics
  - `sentiment:geo:{city}` - Geographic metrics
  - `sentiment:product:{product}` - Product metrics
  - `sentiment:channel:{channel}` - Channel metrics

#### Elasticsearch
- **Purpose**: Historical data and analytics
- **Indices**:
  - `sentiment-messages-YYYY-MM-DD` - Daily message indices
  - `sentiment-aggregates-YYYY-MM-DD` - Daily aggregate indices
- **Retention**: 90 days

### 7. API Gateway

#### REST Endpoints
- `GET /api/metrics/overall` - Overall metrics
- `GET /api/metrics/geo` - Geographic breakdown
- `GET /api/metrics/products` - Product comparison
- `GET /api/metrics/channels` - Channel analysis

#### WebSocket Events
- `message:new` - New processed message
- `metrics:initial` - Initial metrics on connect
- `metrics:update` - Updated metrics
- `alert:churn` - High churn risk alert

### 8. Frontend Dashboard

#### Panels
1. **Sentiment Gauge** - D3 arc gauge showing overall sentiment
2. **Geographic Heat Map** - Bar chart by city
3. **Product Sentiment** - Comparison bar chart
4. **Channel Performance** - Horizontal bar chart
5. **Emotion Distribution** - Pie chart
6. **Real-Time Trend** - Line chart with streaming data

## Data Flow

### End-to-End Message Flow

```
1. Social Media Post
   ↓
2. API Connector fetches and transforms
   ↓
3. Kafka (sentiment.raw)
   ↓
4. Flink consumes message
   ↓
5. Flink validates and cleanses data
   ↓
6. Flink calls ML Service
   ↓
7. ML Service analyzes sentiment
   ↓
8. Flink enriches message with ML results
   ↓
9. Kafka (sentiment.processed)
   ↓
10. Aggregator consumes message
    ↓
11. Aggregator updates Redis metrics
    ↓
12. Aggregator stores in Elasticsearch
    ↓
13. API Gateway fetches from Redis
    ↓
14. API Gateway streams via WebSocket
    ↓
15. Frontend receives and visualizes
```

**Total Latency**: < 500ms (end-to-end)

## Scalability

### Horizontal Scaling

| Component | Min Replicas | Max Replicas | Notes |
|-----------|-------------|--------------|-------|
| ML Service | 2 | 10 | CPU/GPU intensive |
| Flink Task Manager | 2 | 5 | Based on throughput |
| Aggregator | 2 | 5 | Stateless, easy to scale |
| API Gateway | 2 | 10 | WebSocket connections |
| Frontend | 2 | 5 | Static content, CDN |

### Vertical Scaling

| Component | Min Resources | Max Resources |
|-----------|--------------|---------------|
| ML Service | 2 CPU, 2GB RAM | 4 CPU, 8GB RAM |
| Flink Task Manager | 1 CPU, 1GB RAM | 2 CPU, 4GB RAM |

## High Availability

### Fault Tolerance
- **Kafka**: Multi-broker with replication
- **Flink**: Checkpointing every 60s
- **Redis**: Sentinel for automatic failover
- **Elasticsearch**: Multi-node cluster

### Recovery
- **RPO** (Recovery Point Objective): < 1 minute
- **RTO** (Recovery Time Objective): < 5 minutes

## Security

### Authentication & Authorization
- API Gateway: JWT tokens
- External APIs: OAuth 2.0
- Internal: Service accounts

### Network Security
- TLS/SSL for all external traffic
- Network policies for pod-to-pod
- Firewall rules for infrastructure

### Secrets Management
- OpenShift Secrets for credentials
- Environment variable injection
- No secrets in code/config

## Monitoring

### Metrics
- Prometheus metrics on all services
- Custom business metrics (sentiment trends, churn alerts)
- Infrastructure metrics (CPU, memory, network)

### Logging
- Structured JSON logging
- Centralized log aggregation
- Log levels: DEBUG, INFO, WARN, ERROR

### Alerting
- High churn risk detection
- Service health degradation
- Infrastructure issues

## Performance Characteristics

| Metric | Target | Actual |
|--------|--------|--------|
| Message Ingestion | 10K/s | 12K/s |
| ML Inference | 50ms | 45-200ms |
| End-to-End Latency | < 500ms | 300-450ms |
| Dashboard Update | < 100ms | 50-80ms |
| Uptime | 99.9% | 99.95% |
