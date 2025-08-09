"""Main entry point for Snowflake Sandbox service."""
import asyncio
import uvicorn
import structlog
from fastapi import FastAPI
from contextlib import asynccontextmanager

from .api.routes import router
from .core.monitoring import setup_metrics
from .core.trino_connection import TrinoConnectionManager
from config.settings import settings


# Setup structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Snowflake Sandbox service", version=settings.version)
    
    # Initialize connections
    trino_manager = TrinoConnectionManager()
    await trino_manager.initialize()
    app.state.trino_manager = trino_manager
    
    # Metrics already setup before app startup
    if settings.enable_metrics:
        logger.info("Metrics enabled", port=settings.metrics_port)
    
    yield
    
    # Cleanup
    await trino_manager.close()
    logger.info("Snowflake Sandbox service stopped")


# Create FastAPI app
app = FastAPI(
    title="Snowflake Sandbox (Experimental)",
    description="⚠️ Experimental Snowflake-compatible API powered by Trino and Ibis for learning and development",
    version=settings.version,
    lifespan=lifespan
)

# Setup metrics if enabled (before routes)
if settings.enable_metrics:
    setup_metrics(app)

# Include API routes
app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.service_name,
        "version": settings.version
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Snowflake Sandbox API",
        "version": settings.version,
        "docs_url": "/docs"
    }


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        reload=False
    )