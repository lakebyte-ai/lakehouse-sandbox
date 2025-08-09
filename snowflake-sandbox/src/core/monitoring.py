"""Monitoring and metrics for Snowflake Sandbox."""
import time
from typing import Dict, Any
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi import FastAPI, Request, Response
import structlog

logger = structlog.get_logger()

# Prometheus metrics
query_counter = Counter(
    'snowflake_sandbox_queries_total',
    'Total number of SQL queries processed',
    ['status', 'query_type']
)

query_duration = Histogram(
    'snowflake_sandbox_query_duration_seconds',
    'Time spent processing SQL queries',
    ['query_type']
)

active_connections = Gauge(
    'snowflake_sandbox_active_connections',
    'Number of active connections'
)

translation_counter = Counter(
    'snowflake_sandbox_translations_total',
    'Total number of SQL translations',
    ['status']
)

error_counter = Counter(
    'snowflake_sandbox_errors_total',
    'Total number of errors',
    ['error_type']
)


def setup_metrics(app: FastAPI):
    """Setup metrics collection for the FastAPI app."""
    
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        """Collect request metrics."""
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # Record successful request
            duration = time.time() - start_time
            
            # Classify request type
            request_type = _classify_request(request)
            
            query_counter.labels(status='success', query_type=request_type).inc()
            query_duration.labels(query_type=request_type).observe(duration)
            
            return response
            
        except Exception as e:
            # Record error
            duration = time.time() - start_time
            request_type = _classify_request(request)
            
            query_counter.labels(status='error', query_type=request_type).inc()
            query_duration.labels(query_type=request_type).observe(duration)
            error_counter.labels(error_type=type(e).__name__).inc()
            
            raise
    
    @app.get("/metrics")
    async def metrics_endpoint():
        """Prometheus metrics endpoint."""
        return Response(
            content=generate_latest(),
            media_type="text/plain"
        )


def _classify_request(request: Request) -> str:
    """Classify the request type for metrics."""
    path = request.url.path
    
    if path.startswith("/api/v1/query"):
        return "query"
    elif path.startswith("/api/v1/warehouse"):
        return "warehouse"
    elif path.startswith("/api/v1/database"):
        return "database"
    elif path.startswith("/health"):
        return "health"
    elif path.startswith("/metrics"):
        return "metrics"
    else:
        return "other"


class QueryMetrics:
    """Helper class for tracking query-specific metrics."""
    
    def __init__(self, query_type: str = "unknown"):
        self.query_type = query_type
        self.start_time = time.time()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        
        if exc_type is None:
            # Success
            query_counter.labels(status='success', query_type=self.query_type).inc()
            translation_counter.labels(status='success').inc()
        else:
            # Error
            query_counter.labels(status='error', query_type=self.query_type).inc()
            translation_counter.labels(status='error').inc()
            error_counter.labels(error_type=exc_type.__name__).inc()
        
        query_duration.labels(query_type=self.query_type).observe(duration)