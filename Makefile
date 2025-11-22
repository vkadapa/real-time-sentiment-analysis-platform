.PHONY: help build start stop logs clean test

help:
	@echo "Available commands:"
	@echo "  make build       - Build all Docker images"
	@echo "  make start       - Start all services"
	@echo "  make stop        - Stop all services"
	@echo "  make logs        - View logs from all services"
	@echo "  make clean       - Remove all containers and volumes"
	@echo "  make test        - Run tests"
	@echo "  make generate    - Generate synthetic data"
	@echo "  make benchmark   - Run ML service benchmarks"

build:
	docker-compose build

start:
	docker-compose up -d
	@echo "Services started. Dashboard available at http://localhost:3000"

stop:
	docker-compose stop

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	docker system prune -f

test:
	@echo "Running tests..."
	docker-compose run --rm ml-service python -m pytest
	@echo "Tests completed"

generate:
	@echo "Generating 20K synthetic messages..."
	docker-compose up data-generator

benchmark:
	@echo "Running ML service benchmarks..."
	docker-compose run --rm ml-service python benchmark.py

# OpenShift deployment
oc-deploy:
	oc apply -f openshift/configmap.yaml
	oc apply -f openshift/secret.yaml
	oc apply -f openshift/buildconfig.yaml
	oc apply -f openshift/ml-service-deployment.yaml
	oc apply -f openshift/flink-deployment.yaml
	oc apply -f openshift/aggregator-deployment.yaml
	oc apply -f openshift/api-gateway-deployment.yaml
	oc apply -f openshift/frontend-deployment.yaml
	oc apply -f openshift/connectors-deployment.yaml
	@echo "OpenShift deployment complete"

oc-clean:
	oc delete all,configmap,secret --selector app -n enbd-sentiment
