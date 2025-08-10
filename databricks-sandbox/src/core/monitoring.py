"""Monitoring and metrics for Databricks sandbox."""
import time
import structlog
from prometheus_client import Counter, Histogram, Gauge, start_http_server
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter(
    'databricks_sandbox_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'databricks_sandbox_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

SQL_STATEMENTS = Counter(
    'databricks_sandbox_sql_statements_total',
    'Total SQL statements executed',
    ['status']
)

SQL_DURATION = Histogram(
    'databricks_sandbox_sql_duration_seconds',
    'SQL statement execution duration'
)

ACTIVE_CONNECTIONS = Gauge(
    'databricks_sandbox_active_connections',
    'Number of active Spark connections'
)


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect HTTP metrics."""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        
        # Record metrics
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()
        
        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(time.time() - start_time)
        
        return response


def setup_metrics(app: FastAPI):
    """Setup Prometheus metrics for the application."""
    app.add_middleware(MetricsMiddleware)
    
    # Start metrics server
    try:
        start_http_server(8000)
        logger.info("Metrics server started on port 8000")
    except Exception as e:
        logger.warning("Failed to start metrics server", error=str(e))


def record_sql_execution(duration: float, status: str):
    """Record SQL execution metrics."""
    SQL_STATEMENTS.labels(status=status).inc()
    SQL_DURATION.observe(duration)


def set_active_connections(count: int):
    """Set the number of active connections."""
    ACTIVE_CONNECTIONS.set(count)