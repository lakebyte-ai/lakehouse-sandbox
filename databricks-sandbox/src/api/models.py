"""Pydantic models for Databricks SQL API."""
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field
from enum import Enum


class StatementState(str, Enum):
    """Statement execution states."""
    PENDING = "PENDING"
    RUNNING = "RUNNING" 
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"


class StatementType(str, Enum):
    """Statement types."""
    SELECT = "SELECT"
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    CREATE = "CREATE"
    DROP = "DROP"
    ALTER = "ALTER"
    SHOW = "SHOW"
    DESCRIBE = "DESCRIBE"


class ExecuteStatementRequest(BaseModel):
    """Request model for executing SQL statements."""
    statement: str = Field(..., description="SQL statement to execute")
    warehouse_id: Optional[str] = Field(None, description="Warehouse ID to use")
    catalog: Optional[str] = Field(None, description="Catalog to use")
    schema: Optional[str] = Field(None, description="Schema to use")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Statement parameters")
    disposition: Optional[str] = Field("EXTERNAL_LINKS", description="Result disposition")
    format: Optional[str] = Field("JSON_ARRAY", description="Result format")
    on_wait_timeout: Optional[str] = Field("CONTINUE", description="Timeout behavior")
    wait_timeout: Optional[str] = Field("10s", description="Wait timeout")


class ErrorDetail(BaseModel):
    """Error detail model."""
    message: str
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class StatementStatus(BaseModel):
    """Statement status model."""
    state: StatementState
    error: Optional[ErrorDetail] = None


class ColumnInfo(BaseModel):
    """Column information model."""
    name: str
    type_text: str
    type_name: str
    position: int
    nullable: Optional[bool] = True
    precision: Optional[int] = None
    scale: Optional[int] = None


class ResultSchema(BaseModel):
    """Result schema model."""
    columns: List[ColumnInfo]
    column_count: int


class StatementResult(BaseModel):
    """Statement result model."""
    data_array: Optional[List[List[Any]]] = None
    schema: Optional[ResultSchema] = None
    row_count: Optional[int] = None
    row_offset: Optional[int] = 0
    truncated: Optional[bool] = False
    next_chunk_index: Optional[int] = None
    next_chunk_internal_link: Optional[str] = None


class StatementResponse(BaseModel):
    """Complete statement response model."""
    statement_id: str
    status: StatementStatus
    result: Optional[StatementResult] = None
    warehouse_id: str
    created_time: Optional[int] = None
    started_time: Optional[int] = None
    completed_time: Optional[int] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None


class CancelStatementResponse(BaseModel):
    """Response for statement cancellation."""
    statement_id: str
    status: StatementStatus


class WarehouseInfo(BaseModel):
    """Warehouse information model."""
    id: str
    name: str
    cluster_size: str = "2X-Small"
    state: str = "RUNNING"


class ClusterInfo(BaseModel):
    """Cluster information for compatibility."""
    cluster_id: str
    cluster_name: str
    spark_version: str = "3.5.0"
    node_type_id: str = "i3.xlarge"
    driver_node_type_id: str = "i3.xlarge"
    num_workers: int = 1
    state: str = "RUNNING"