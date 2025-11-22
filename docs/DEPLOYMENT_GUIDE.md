# Deployment Guide

## Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [Docker Compose Deployment](#docker-compose-deployment)
3. [OpenShift Production Deployment](#openshift-production-deployment)
4. [Configuration Management](#configuration-management)
5. [Monitoring and Logging](#monitoring-and-logging)

## Local Development Setup

### Prerequisites
```bash
# Check versions
docker --version          # Docker 24.x+
docker-compose --version  # 2.x+
node --version           # 20.x
python --version         # 3.11+
java --version          # 17+
```

### Step 1: Clone and Configure
```bash
git clone https://github.com/enbd/sentiment-analysis.git
cd sentiment-analysis
cp .env.example .env
```

### Step 2: Update Environment Variables
Edit `.env`:
```bash
# Add your API keys
TWITTER_BEARER_TOKEN=your_token_here
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_secret
```

### Step 3: Start Infrastructure
```bash
# Start Kafka, Redis, Elasticsearch
docker-compose up -d zookeeper kafka redis elasticsearch
```

### Step 4: Build and Start Services
```bash
# Build all images
docker-compose build

# Start all services
docker-compose up -d
```

### Step 5: Verify Services
```bash
# Check service health
curl http://localhost:8000/health    # ML Service
curl http://localhost:3001/health    # API Gateway
curl http://localhost:3000           # Frontend
```

## Docker Compose Deployment

### Full Stack Deployment
```bash
# Start everything
make start

# View logs
make logs

# Stop everything
make stop
```

### Individual Service Management
```bash
# Start specific service
docker-compose up -d ml-service

# View service logs
docker-compose logs -f ml-service

# Restart service
docker-compose restart ml-service

# Scale service
docker-compose up -d --scale aggregator=3
```

### Troubleshooting

#### Issue: Kafka not connecting
```bash
# Check Kafka
docker-compose logs kafka

# Recreate Kafka
docker-compose stop kafka
docker-compose rm -f kafka
docker-compose up -d kafka
```

#### Issue: ML Service out of memory
```bash
# Increase Docker memory limit to 8GB+
# Docker Desktop → Settings → Resources → Memory

# Or reduce model batch size
docker-compose exec ml-service python -c "import torch; print(torch.cuda.is_available())"
```

## OpenShift Production Deployment

### Prerequisites
- OpenShift CLI (`oc`) installed
- Access to OpenShift cluster
- ENBD infrastructure credentials

### Step 1: Login to OpenShift
```bash
oc login https://openshift.enbd.ae:6443
```

### Step 2: Create Project
```bash
oc new-project enbd-sentiment
```

### Step 3: Configure Secrets
```bash
# Edit secret values
vi openshift/secret.yaml

# Apply secrets
oc apply -f openshift/secret.yaml
```

### Step 4: Configure ConfigMap
```bash
# Update with ENBD infrastructure endpoints
vi openshift/configmap.yaml

# Apply configmap
oc apply -f openshift/configmap.yaml
```

### Step 5: Setup Image Builds
```bash
# Create ImageStreams and BuildConfigs
oc apply -f openshift/buildconfig.yaml

# Trigger builds (one by one or all)
oc start-build ml-service
oc start-build flink-job
oc start-build aggregator
oc start-build api-gateway
oc start-build frontend
oc start-build twitter-connector
oc start-build reddit-connector
oc start-build data-generator

# Monitor build progress
oc logs -f bc/ml-service
```

### Step 6: Deploy Services
```bash
# Deploy all services
oc apply -f openshift/ml-service-deployment.yaml
oc apply -f openshift/flink-deployment.yaml
oc apply -f openshift/aggregator-deployment.yaml
oc apply -f openshift/api-gateway-deployment.yaml
oc apply -f openshift/frontend-deployment.yaml
oc apply -f openshift/connectors-deployment.yaml
```

### Step 7: Verify Deployment
```bash
# Check all pods
oc get pods -n enbd-sentiment

# Check services
oc get svc -n enbd-sentiment

# Check routes
oc get routes -n enbd-sentiment
```

### Step 8: Access Application
```bash
# Get frontend URL
oc get route frontend -n enbd-sentiment -o jsonpath='{.spec.host}'

# Access dashboard
open https://$(oc get route frontend -n enbd-sentiment -o jsonpath='{.spec.host}')
```

## Configuration Management

### ENBD Infrastructure Integration

#### Kafka Configuration
```yaml
# openshift/configmap.yaml
KAFKA_BOOTSTRAP_SERVERS: "kafka.enbd.ae:9092"

# Test connectivity
oc run kafka-test --rm -it --restart=Never \
  --image=confluentinc/cp-kafka:7.5.0 \
  -- kafka-topics --list --bootstrap-server kafka.enbd.ae:9092
```

#### Redis Configuration
```yaml
# openshift/secret.yaml
REDIS_HOST: "redis.enbd.ae"
REDIS_PORT: "6379"
REDIS_PASSWORD: "<from-vault>"

# Test connectivity
oc run redis-test --rm -it --restart=Never \
  --image=redis:7-alpine \
  -- redis-cli -h redis.enbd.ae -p 6379 -a PASSWORD ping
```

#### Elasticsearch Configuration
```yaml
# openshift/configmap.yaml
ELASTICSEARCH_URL: "https://elasticsearch.enbd.ae:9200"

# Test connectivity
curl -u username:password https://elasticsearch.enbd.ae:9200/_cluster/health
```

## Monitoring and Logging

### OpenShift Monitoring
```bash
# View pod logs
oc logs -f deployment/ml-service

# View metrics
oc adm top pods -n enbd-sentiment
oc adm top nodes

# Describe resources
oc describe pod ml-service-xxx
```

### Health Checks
```bash
# ML Service
oc exec deployment/ml-service -- curl localhost:8000/health

# API Gateway
oc exec deployment/api-gateway -- curl localhost:3001/health
```

### Flink Dashboard
```bash
# Port forward Flink UI
oc port-forward svc/flink-jobmanager 8081:8081

# Access at http://localhost:8081
```

### Scaling Services
```bash
# Scale up
oc scale deployment/aggregator --replicas=5

# Auto-scaling
oc autoscale deployment/ml-service --min=2 --max=10 --cpu-percent=70
```

## Performance Tuning

### ML Service
```yaml
# Increase resources
resources:
  requests:
    memory: "4Gi"
    cpu: "2000m"
  limits:
    memory: "8Gi"
    cpu: "4000m"
```

### Flink
```yaml
# Increase parallelism
env:
  - name: FLINK_PARALLELISM
    value: "4"
```

### API Gateway
```yaml
# Increase replicas for WebSocket connections
replicas: 5
```

## Disaster Recovery

### Backup
```bash
# Backup Redis data
oc exec deployment/aggregator -- redis-cli BGSAVE

# Export Elasticsearch data
curl -X POST "elasticsearch.enbd.ae:9200/_snapshot/backup/snapshot_1?wait_for_completion=true"
```

### Restore
```bash
# Restore from snapshot
curl -X POST "elasticsearch.enbd.ae:9200/_snapshot/backup/snapshot_1/_restore"
```

## Security Best Practices

1. **Never commit secrets to Git**
   - Use OpenShift Secrets
   - Use HashiCorp Vault for sensitive data

2. **Enable TLS for all external endpoints**
   ```yaml
   spec:
     tls:
       termination: edge
   ```

3. **Use Network Policies**
   ```bash
   oc apply -f openshift/network-policy.yaml
   ```

4. **Regular security updates**
   ```bash
   # Update base images
   oc start-build ml-service
   ```

## Troubleshooting Guide

### Pod Fails to Start
```bash
# Check events
oc get events --sort-by='.lastTimestamp'

# Check pod details
oc describe pod <pod-name>

# Check logs
oc logs <pod-name> --previous
```

### Service Not Connecting
```bash
# Test DNS resolution
oc run test --rm -it --image=busybox -- nslookup ml-service

# Test port connectivity
oc run test --rm -it --image=nicolaka/netshoot -- nc -zv ml-service 8000
```

### Performance Issues
```bash
# Check resource usage
oc adm top pods

# Check for throttling
oc describe pod <pod-name> | grep -i throttl
```
