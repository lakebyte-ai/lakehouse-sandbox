"""Configuration settings for Snowflake Sandbox."""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""
    
    # Service configuration
    host: str = "0.0.0.0"
    port: int = 5432
    service_name: str = "snowflake-sandbox"
    version: str = "1.0.0"
    
    # Trino connection settings
    trino_host: str = "trino"
    trino_port: int = 8080
    trino_user: str = "admin"
    trino_catalog: str = "iceberg"
    trino_schema: str = "default"
    
    # Snowflake emulation settings
    default_warehouse: str = "compute_wh"
    default_database: str = "demo_db" 
    default_schema: str = "public"
    
    # Logging
    log_level: str = "INFO"
    
    # Monitoring
    enable_metrics: bool = True
    metrics_port: int = 8000
    
    class Config:
        env_prefix = "SNOWFLAKE_SANDBOX_"
        case_sensitive = False


settings = Settings()