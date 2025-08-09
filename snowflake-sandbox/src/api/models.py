"""Pydantic models for API requests and responses."""
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime
import uuid


class QueryRequest(BaseModel):
    """Request model for SQL query execution."""
    
    sql: str = Field(..., description="SQL query to execute")
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique request identifier")
    timeout_seconds: int = Field(default=300, description="Query timeout in seconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "sql": "SELECT COUNT(*) FROM my_table WHERE date > '2024-01-01'",
                "request_id": "550e8400-e29b-41d4-a716-446655440000",
                "timeout_seconds": 300
            }
        }


class QueryResponse(BaseModel):
    """Response model for SQL query execution."""
    
    request_id: str = Field(..., description="Request identifier")
    success: bool = Field(..., description="Whether query succeeded")
    data: List[Dict[str, Any]] = Field(default=[], description="Query result data")
    columns: List[str] = Field(default=[], description="Column names")
    row_count: int = Field(default=0, description="Number of rows returned")
    execution_time_ms: int = Field(default=0, description="Execution time in milliseconds")
    
    # Translation details
    original_sql: str = Field(default="", description="Original Snowflake SQL")
    translated_sql: str = Field(default="", description="Translated Trino SQL")
    transformations: List[str] = Field(default=[], description="Applied transformations")
    warnings: List[str] = Field(default=[], description="Translation warnings")
    
    # Error handling
    error: Optional[str] = Field(default=None, description="Error message if failed")
    
    class Config:
        json_schema_extra = {
            "example": {
                "request_id": "550e8400-e29b-41d4-a716-446655440000",
                "success": True,
                "data": [{"count": 1542}],
                "columns": ["count"],
                "row_count": 1,
                "execution_time_ms": 245,
                "original_sql": "SELECT COUNT(*) FROM my_table",
                "translated_sql": "SELECT COUNT(*) FROM my_table",
                "transformations": [],
                "warnings": []
            }
        }


class WarehouseRequest(BaseModel):
    """Request model for warehouse operations."""
    
    warehouse: str = Field(..., description="Warehouse name")
    
    class Config:
        json_schema_extra = {
            "example": {
                "warehouse": "compute_wh"
            }
        }


class WarehouseResponse(BaseModel):
    """Response model for warehouse operations."""
    
    success: bool = Field(..., description="Whether operation succeeded")
    warehouse: str = Field(..., description="Current warehouse")
    context: Dict[str, str] = Field(default={}, description="Current context")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "warehouse": "compute_wh",
                "context": {
                    "warehouse": "compute_wh",
                    "database": "iceberg",
                    "schema": "default"
                }
            }
        }


class DatabaseResponse(BaseModel):
    """Response model for database information."""
    
    name: str = Field(..., description="Database name")
    type: str = Field(default="catalog", description="Database type")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "iceberg",
                "type": "catalog"
            }
        }


class SchemaResponse(BaseModel):
    """Response model for schema information."""
    
    name: str = Field(..., description="Schema name")
    database: str = Field(..., description="Parent database")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "default",
                "database": "iceberg"
            }
        }


class TableResponse(BaseModel):
    """Response model for table information."""
    
    name: str = Field(..., description="Table name")
    schema: str = Field(..., description="Parent schema")
    database: str = Field(..., description="Parent database")
    type: str = Field(default="table", description="Object type")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "orders",
                "schema": "default",
                "database": "iceberg",
                "type": "table"
            }
        }


class TranslationResponse(BaseModel):
    """Response model for SQL translation only."""
    
    original_sql: str = Field(..., description="Original Snowflake SQL")
    translated_sql: str = Field(..., description="Translated Trino SQL")
    transformations: List[str] = Field(..., description="Applied transformations")
    warnings: List[str] = Field(default=[], description="Translation warnings")
    
    class Config:
        json_schema_extra = {
            "example": {
                "original_sql": "SELECT CURRENT_WAREHOUSE(), CURRENT_DATABASE()",
                "translated_sql": "SELECT 'compute_wh', CURRENT_CATALOG",
                "transformations": [
                    "Translated CURRENT_WAREHOUSE -> 'compute_wh'",
                    "Translated CURRENT_DATABASE -> CURRENT_CATALOG"
                ],
                "warnings": []
            }
        }