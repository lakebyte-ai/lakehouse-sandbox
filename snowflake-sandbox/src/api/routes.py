"""API routes for Snowflake Sandbox."""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Any, Dict, List, Optional
import structlog

from .models import (
    QueryRequest, QueryResponse, 
    WarehouseRequest, WarehouseResponse,
    DatabaseResponse, SchemaResponse, TableResponse
)
from ..core.trino_connection import TrinoConnectionManager
from ..core.snowflake_translator import SnowflakeToTrinoTranslator
from ..core.monitoring import QueryMetrics

logger = structlog.get_logger()

router = APIRouter()


def get_trino_manager(request: Request) -> TrinoConnectionManager:
    """Dependency to get Trino connection manager."""
    return request.app.state.trino_manager


def get_translator() -> SnowflakeToTrinoTranslator:
    """Dependency to get SQL translator."""
    return SnowflakeToTrinoTranslator()


@router.post("/query", response_model=QueryResponse)
async def execute_query(
    query_request: QueryRequest,
    trino_manager: TrinoConnectionManager = Depends(get_trino_manager),
    translator: SnowflakeToTrinoTranslator = Depends(get_translator)
):
    """Execute a Snowflake SQL query through Trino."""
    
    with QueryMetrics("sql_query"):
        try:
            logger.info("Received query request", query_id=query_request.request_id)
            
            # Translate Snowflake SQL to Trino SQL
            translation_result = translator.translate(query_request.sql)
            
            logger.info(
                "SQL translation completed",
                query_id=query_request.request_id,
                transformations=len(translation_result.transformations_applied),
                warnings=len(translation_result.warnings)
            )
            
            # Execute the translated query
            result = await trino_manager.execute_query(translation_result.translated_sql)
            
            # Convert result to response format
            if hasattr(result, 'to_dict'):
                # Pandas DataFrame
                data = result.to_dict('records')
                columns = list(result.columns)
            else:
                # Handle other result types
                data = []
                columns = []
            
            return QueryResponse(
                request_id=query_request.request_id,
                success=True,
                data=data,
                columns=columns,
                row_count=len(data),
                execution_time_ms=0,  # TODO: Add timing
                original_sql=translation_result.original_sql,
                translated_sql=translation_result.translated_sql,
                transformations=translation_result.transformations_applied,
                warnings=translation_result.warnings
            )
            
        except Exception as e:
            logger.error(
                "Query execution failed",
                query_id=query_request.request_id,
                error=str(e)
            )
            
            return QueryResponse(
                request_id=query_request.request_id,
                success=False,
                error=str(e),
                data=[],
                columns=[],
                row_count=0,
                original_sql=query_request.sql
            )


@router.post("/warehouse/use", response_model=WarehouseResponse)
async def use_warehouse(
    warehouse_request: WarehouseRequest,
    trino_manager: TrinoConnectionManager = Depends(get_trino_manager)
):
    """Switch to a warehouse (virtual concept in sandbox)."""
    
    try:
        context = trino_manager.use_warehouse(warehouse_request.warehouse)
        
        return WarehouseResponse(
            success=True,
            warehouse=warehouse_request.warehouse,
            context=context
        )
        
    except Exception as e:
        logger.error("Failed to switch warehouse", warehouse=warehouse_request.warehouse, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/warehouse/current", response_model=WarehouseResponse)
async def get_current_warehouse(
    trino_manager: TrinoConnectionManager = Depends(get_trino_manager)
):
    """Get current warehouse context."""
    
    try:
        context = trino_manager.get_current_context()
        
        return WarehouseResponse(
            success=True,
            warehouse=context.get("warehouse", "compute_wh"),
            context=context
        )
        
    except Exception as e:
        logger.error("Failed to get current warehouse", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/databases", response_model=List[DatabaseResponse])
async def list_databases(
    trino_manager: TrinoConnectionManager = Depends(get_trino_manager)
):
    """List available databases (catalogs)."""
    
    try:
        databases = trino_manager.list_databases()
        
        return [
            DatabaseResponse(name=db, type="catalog")
            for db in databases
        ]
        
    except Exception as e:
        logger.error("Failed to list databases", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/databases/{database}/schemas", response_model=List[SchemaResponse])
async def list_schemas(
    database: str,
    trino_manager: TrinoConnectionManager = Depends(get_trino_manager)
):
    """List schemas in a database."""
    
    try:
        schemas = trino_manager.list_schemas(database)
        
        return [
            SchemaResponse(name=schema, database=database)
            for schema in schemas
        ]
        
    except Exception as e:
        logger.error("Failed to list schemas", database=database, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/databases/{database}/schemas/{schema}/tables", response_model=List[TableResponse])
async def list_tables(
    database: str,
    schema: str,
    trino_manager: TrinoConnectionManager = Depends(get_trino_manager)
):
    """List tables in a schema."""
    
    try:
        tables = trino_manager.list_tables(database, schema)
        
        return [
            TableResponse(name=table, schema=schema, database=database, type="table")
            for table in tables
        ]
        
    except Exception as e:
        logger.error("Failed to list tables", database=database, schema=schema, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def service_status(
    trino_manager: TrinoConnectionManager = Depends(get_trino_manager)
):
    """Get service status and health."""
    
    try:
        context = trino_manager.get_current_context()
        
        return {
            "status": "healthy",
            "service": "snowflake-sandbox",
            "trino_connection": "active",
            "current_context": context
        }
        
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return {
            "status": "unhealthy",
            "service": "snowflake-sandbox",
            "trino_connection": "failed",
            "error": str(e)
        }