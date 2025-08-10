"""Configuration settings for Databricks Sandbox."""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""
    
    # Service configuration
    host: str = "0.0.0.0"
    port: int = 5434
    service_name: str = "databricks-sandbox"
    version: str = "1.0.0"
    
    # Spark connection settings
    spark_master: str = "spark://spark-iceberg:7077"  # Connect to existing Spark
    spark_app_name: str = "DatabricksSQL"
    spark_driver_memory: str = "1g"
    spark_executor_memory: str = "1g"
    
    # Alternative: Connect to existing Spark via Thrift
    spark_thrift_server: str = "spark-iceberg"
    spark_thrift_port: int = 10000
    
    # Catalog settings (connect to Polaris)
    catalog_uri: str = "http://polaris:8181/api/catalog/"
    catalog_credential: str = "root:secret"
    
    # Storage settings (MinIO)
    s3_endpoint: str = "http://minio:9000"
    s3_access_key: str = "admin"
    s3_secret_key: str = "password"
    s3_region: str = "us-east-1"
    
    # Databricks emulation settings
    default_warehouse_id: str = "lakehouse_sql_warehouse"
    default_catalog: str = "iceberg"
    default_schema: str = "default"
    
    # Logging
    log_level: str = "INFO"
    
    # Monitoring
    enable_metrics: bool = True
    metrics_port: int = 8000
    
    class Config:
        env_prefix = "DATABRICKS_SANDBOX_"
        case_sensitive = False


settings = Settings()