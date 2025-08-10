"""Main entry point for Databricks Sandbox service."""
import uvicorn
import structlog
from fastapi import FastAPI
from contextlib import asynccontextmanager

from .api.routes import router
from .core.monitoring import setup_metrics
from .core.spark_manager import SparkManager
from .core.jobs_manager import JobsManager
from .core.clusters_manager import ClustersManager
from .core.dbfs_manager import DBFSManager
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
    logger.info("Starting Databricks Sandbox service", version=settings.version)
    
    # Initialize Spark connection
    spark_manager = SparkManager()
    await spark_manager.initialize()
    app.state.spark_manager = spark_manager
    
    # Initialize Jobs manager
    jobs_manager = JobsManager(spark_manager)
    app.state.jobs_manager = jobs_manager
    
    # Initialize Clusters manager
    clusters_manager = ClustersManager()
    app.state.clusters_manager = clusters_manager
    
    # Initialize DBFS manager
    dbfs_manager = DBFSManager()
    await dbfs_manager.initialize()
    app.state.dbfs_manager = dbfs_manager
    
    # Metrics already setup before app startup
    if settings.enable_metrics:
        logger.info("Metrics enabled", port=settings.metrics_port)
    
    yield
    
    # Cleanup
    await spark_manager.close()
    logger.info("Databricks Sandbox service stopped")


# Create FastAPI app
app = FastAPI(
    title="Databricks SQL Sandbox (Experimental)",
    description="⚠️ Experimental Databricks SQL-compatible API powered by Spark and Iceberg for learning and development",
    version=settings.version,
    lifespan=lifespan
)

# Setup metrics if enabled (before routes)
if settings.enable_metrics:
    setup_metrics(app)

# Include API routes
app.include_router(router, prefix="/api/2.0")


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
        "message": "Databricks SQL Sandbox API",
        "version": settings.version,
        "docs_url": "/docs",
        "sql_warehouse": settings.default_warehouse_id
    }


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        reload=False
    )