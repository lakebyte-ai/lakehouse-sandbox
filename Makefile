# Lakehouse Sandbox Makefile
# Simplifies management of all Docker Compose services

.PHONY: help all up down status logs clean network
.DEFAULT_GOAL := help

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
CYAN := \033[0;36m
NC := \033[0m # No Color

# Docker Compose files
COMPOSE_CORE := docker-compose.yml
COMPOSE_KAFKA := docker-compose.kafka.yml
COMPOSE_AIRFLOW := docker-compose.airflow.yml
COMPOSE_WEBUI := docker-compose.webui.yml

# Environment files
ENV_AIRFLOW := .env.airflow

help: ## Show this help message
	@echo "$(CYAN)Lakehouse Sandbox Management$(NC)"
	@echo "$(YELLOW)Available commands:$(NC)"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# === NETWORK MANAGEMENT ===
network: ## Create the shared Docker network
	@echo "$(BLUE)Creating shared network...$(NC)"
	@docker network create local-iceberg-lakehouse 2>/dev/null || echo "Network already exists"

network-clean: ## Remove the shared Docker network
	@echo "$(RED)Removing shared network...$(NC)"
	@docker network rm local-iceberg-lakehouse 2>/dev/null || echo "Network doesn't exist"

# === INDIVIDUAL SERVICE MANAGEMENT ===

## Core Services (Lakehouse components)
core-up: network ## Start core lakehouse services (Polaris, Trino, MinIO, Spark, Nimtable)
	@echo "$(GREEN)Starting core lakehouse services...$(NC)"
	@docker-compose -f $(COMPOSE_CORE) up -d

core-down: ## Stop core lakehouse services
	@echo "$(RED)Stopping core lakehouse services...$(NC)"
	@docker-compose -f $(COMPOSE_CORE) down

core-status: ## Show status of core services
	@echo "$(CYAN)Core Services Status:$(NC)"
	@docker-compose -f $(COMPOSE_CORE) ps

core-logs: ## Show logs for core services
	@docker-compose -f $(COMPOSE_CORE) logs -f

## Kafka Services
kafka-up: network ## Start Kafka cluster and UI
	@echo "$(GREEN)Starting Kafka services...$(NC)"
	@docker-compose -f $(COMPOSE_KAFKA) up -d

kafka-down: ## Stop Kafka services
	@echo "$(RED)Stopping Kafka services...$(NC)"
	@docker-compose -f $(COMPOSE_KAFKA) down

kafka-status: ## Show status of Kafka services
	@echo "$(CYAN)Kafka Services Status:$(NC)"
	@docker-compose -f $(COMPOSE_KAFKA) ps

kafka-logs: ## Show logs for Kafka services
	@docker-compose -f $(COMPOSE_KAFKA) logs -f

## Airflow Services
airflow-up: network ## Start Airflow services
	@echo "$(GREEN)Starting Airflow services...$(NC)"
	@docker-compose -f $(COMPOSE_AIRFLOW) --env-file $(ENV_AIRFLOW) up -d

airflow-down: ## Stop Airflow services
	@echo "$(RED)Stopping Airflow services...$(NC)"
	@docker-compose -f $(COMPOSE_AIRFLOW) --env-file $(ENV_AIRFLOW) down

airflow-status: ## Show status of Airflow services
	@echo "$(CYAN)Airflow Services Status:$(NC)"
	@docker-compose -f $(COMPOSE_AIRFLOW) --env-file $(ENV_AIRFLOW) ps

airflow-logs: ## Show logs for Airflow services
	@docker-compose -f $(COMPOSE_AIRFLOW) --env-file $(ENV_AIRFLOW) logs -f

airflow-init: network ## Initialize Airflow (run once)
	@echo "$(YELLOW)Initializing Airflow...$(NC)"
	@docker-compose -f $(COMPOSE_AIRFLOW) --env-file $(ENV_AIRFLOW) up airflow-init

## WebUI Services
webui-up: network ## Start Web UI services (development mode)
	@echo "$(GREEN)Starting WebUI services in development mode...$(NC)"
	@cd webui/backend && npm install --silent
	@cd webui/frontend && npm install --silent
	@echo "$(YELLOW)Starting backend server...$(NC)"
	@cd webui/backend && npm start > webui-backend.log 2>&1 &
	@sleep 3
	@echo "$(YELLOW)Starting frontend dev server...$(NC)"
	@cd webui/frontend && npm run dev > webui-frontend.log 2>&1 &
	@sleep 2
	@echo "$(GREEN)WebUI services started!$(NC)"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:5001"

webui-down: ## Stop Web UI services
	@echo "$(RED)Stopping WebUI services...$(NC)"
	@pkill -f "node.*server.js" 2>/dev/null || echo "WebUI backend not running"
	@pkill -f "vite.*dev" 2>/dev/null || echo "WebUI frontend not running"
	@rm -f webui-backend.log webui-frontend.log 2>/dev/null || true

webui-status: ## Show status of Web UI services
	@echo "$(CYAN)WebUI Services Status:$(NC)"
	@pgrep -f "node.*server.js" > /dev/null && echo "  ✅ Backend: Running on http://localhost:5001" || echo "  ❌ Backend: Not running"
	@pgrep -f "vite.*dev" > /dev/null && echo "  ✅ Frontend: Running on http://localhost:3000" || echo "  ❌ Frontend: Not running"

webui-logs: ## Show logs for Web UI services
	@echo "$(CYAN)WebUI Backend Logs:$(NC)"
	@tail -f webui-backend.log 2>/dev/null || echo "No backend logs found"

webui-build: ## Build WebUI for production
	@echo "$(BLUE)Building WebUI for production...$(NC)"
	@cd webui/backend && npm install --silent
	@cd webui/frontend && npm install --silent && npm run build
	@echo "$(GREEN)WebUI built successfully!$(NC)"

# === COMBINED OPERATIONS ===

all: network core-up kafka-up airflow-up webui-up ## Start all services including WebUI
	@echo "$(GREEN)All services started!$(NC)"
	@echo "$(YELLOW)Access URLs:$(NC)"
	@echo "  $(BOLD)WebUI:       http://localhost:3000 (Management Interface)$(NC)"
	@echo "  WebUI API:   http://localhost:5001"
	@echo "  Airflow:     http://localhost:8090 (admin/admin)"
	@echo "  Kafka UI:    http://localhost:8091"
	@echo "  Trino:       http://localhost:8080"
	@echo "  Polaris:     http://localhost:8181"
	@echo "  Spark:       http://localhost:8888"
	@echo "  MinIO:       http://localhost:9001 (admin/password)"
	@echo "  Nimtable:    http://localhost:13000 (admin/admin)"
	@echo "  Snowflake:   http://localhost:5432 (API), http://localhost:5432/docs"

up: all ## Alias for 'all'

down: webui-down ## Stop all services including WebUI
	@echo "$(RED)Stopping all services...$(NC)"
	@docker-compose -f $(COMPOSE_AIRFLOW) --env-file $(ENV_AIRFLOW) down
	@docker-compose -f $(COMPOSE_KAFKA) down
	@docker-compose -f $(COMPOSE_CORE) down

stop: down ## Alias for 'down'

status: ## Show status of all services
	@echo "$(CYAN)=== ALL SERVICES STATUS ===$(NC)"
	@make core-status
	@echo ""
	@make kafka-status
	@echo ""
	@make airflow-status

ps: status ## Alias for 'status'

logs: ## Show logs for all services (last 100 lines each)
	@echo "$(CYAN)=== CORE SERVICES LOGS ===$(NC)"
	@docker-compose -f $(COMPOSE_CORE) logs --tail=100
	@echo "$(CYAN)=== KAFKA SERVICES LOGS ===$(NC)"
	@docker-compose -f $(COMPOSE_KAFKA) logs --tail=100
	@echo "$(CYAN)=== AIRFLOW SERVICES LOGS ===$(NC)"
	@docker-compose -f $(COMPOSE_AIRFLOW) --env-file $(ENV_AIRFLOW) logs --tail=100

restart: down up ## Restart all services

# === CLEANUP ===

clean: ## Stop all services and remove containers/volumes
	@echo "$(RED)Cleaning up all services...$(NC)"
	@docker-compose -f $(COMPOSE_AIRFLOW) --env-file $(ENV_AIRFLOW) down -v
	@docker-compose -f $(COMPOSE_KAFKA) down -v
	@docker-compose -f $(COMPOSE_CORE) down -v

clean-all: clean network-clean ## Complete cleanup including network

# === DEVELOPMENT HELPERS ===

pull: ## Pull latest images for all services
	@echo "$(BLUE)Pulling latest images...$(NC)"
	@docker-compose -f $(COMPOSE_CORE) pull
	@docker-compose -f $(COMPOSE_KAFKA) pull
	@docker-compose -f $(COMPOSE_AIRFLOW) pull

build: ## Build custom images (if any)
	@echo "$(BLUE)Building custom images...$(NC)"
	@docker-compose -f $(COMPOSE_CORE) build
	@docker-compose -f $(COMPOSE_KAFKA) build
	@docker-compose -f $(COMPOSE_AIRFLOW) build

# === INDIVIDUAL SERVICE RESTARTS ===

core-restart: core-down core-up ## Restart core services

kafka-restart: kafka-down kafka-up ## Restart Kafka services

airflow-restart: airflow-down airflow-up ## Restart Airflow services

# === QUICK ACCESS COMMANDS ===

shell-spark: ## Open bash shell in Spark container
	@docker exec -it spark-iceberg bash

shell-airflow: ## Open bash shell in Airflow webserver container
	@docker exec -it lakehouse-sandbox-airflow-webserver-1 bash

shell-trino: ## Open Trino CLI
	@docker exec -it $$(docker-compose -f $(COMPOSE_CORE) ps -q trino) trino

# === MONITORING ===

watch: ## Watch status of all services (refreshes every 2 seconds)
	@watch -n 2 make status

healthcheck: ## Show health status of all services
	@echo "$(CYAN)=== HEALTH CHECK ===$(NC)"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(lakehouse-sandbox|kafka|spark-iceberg)"

# === TESTING ===

test: ## Run comprehensive integration tests
	@echo "$(CYAN)=== INTEGRATION TESTS ===$(NC)"
	@./tests/integration/run_tests.sh

test-verbose: ## Run integration tests with verbose output
	@echo "$(CYAN)=== INTEGRATION TESTS (VERBOSE) ===$(NC)"
	@./tests/integration/run_tests.sh --verbose

test-core: ## Test only core services (Polaris, Trino, MinIO, Spark, Nimtable)
	@echo "$(CYAN)=== CORE SERVICES TESTS ===$(NC)"
	@./tests/integration/run_tests.sh --groups core

test-kafka: ## Test only Kafka cluster services
	@echo "$(CYAN)=== KAFKA CLUSTER TESTS ===$(NC)"
	@./tests/integration/run_tests.sh --groups kafka

test-airflow: ## Test only Airflow services
	@echo "$(CYAN)=== AIRFLOW SERVICES TESTS ===$(NC)"
	@./tests/integration/run_tests.sh --groups airflow

test-integrations: ## Test service integrations and networking
	@echo "$(CYAN)=== SERVICE INTEGRATION TESTS ===$(NC)"
	@./tests/integration/run_tests.sh --groups integrations

test-report: ## Run tests and generate JSON report
	@echo "$(CYAN)=== INTEGRATION TESTS WITH REPORT ===$(NC)"
	@mkdir -p reports
	@./tests/integration/run_tests.sh --output reports/integration-test-report.json
	@echo "$(GREEN)Report saved to: reports/integration-test-report.json$(NC)"

# === INFO ===

info: ## Show service information and URLs
	@echo "$(CYAN)=== LAKEHOUSE SANDBOX INFO ===$(NC)"
	@echo "$(YELLOW)Service Access URLs:$(NC)"
	@echo "  WebUI Backend:     http://localhost:5001 (Management API)"
	@echo "  WebUI Frontend:    http://localhost:3000 (Coming in Phase 2)"
	@echo "  Airflow Web UI:    http://localhost:8090 (admin/admin)"
	@echo "  Kafka UI:          http://localhost:8091"
	@echo "  Trino Web UI:      http://localhost:8080"
	@echo "  Polaris Catalog:   http://localhost:8181"
	@echo "  Spark Jupyter:     http://localhost:8888"
	@echo "  MinIO Console:     http://localhost:9001 (admin/password)"
	@echo "  Nimtable Web:      http://localhost:13000 (admin/admin)"
	@echo "  Snowflake Sandbox: http://localhost:5432/docs"
	@echo ""
	@echo "$(YELLOW)API Endpoints:$(NC)"
	@echo "  MinIO API:         http://localhost:9000"
	@echo "  Nimtable API:      http://localhost:18182"
	@echo "  Snowflake API:     http://localhost:5432/api/v1"
	@echo "  Airflow Postgres:  localhost:5433"
	@echo "  Kafka Broker:      localhost:9092"