"""API routes for Databricks SQL API emulation."""
import structlog
from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional, List, Dict, Any

from .models import (
    ExecuteStatementRequest, 
    StatementResponse, 
    CancelStatementResponse,
    WarehouseInfo,
    ClusterInfo,
    StatementState,
    StatementStatus,
    ErrorDetail
)
from ..core.spark_manager import SparkManager

logger = structlog.get_logger()
router = APIRouter()


def get_spark_manager(request: Request) -> SparkManager:
    """Get Spark manager from app state."""
    return request.app.state.spark_manager


@router.post("/sql/statements", response_model=StatementResponse)
async def execute_statement(
    request: ExecuteStatementRequest,
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """Execute a SQL statement."""
    try:
        logger.info("Received SQL statement", 
                   statement=request.statement[:100] + "..." if len(request.statement) > 100 else request.statement,
                   warehouse_id=request.warehouse_id)
        
        # Set catalog/schema if specified
        if request.catalog:
            await spark_manager.execute_statement(f"USE CATALOG {request.catalog}")
        if request.schema:
            await spark_manager.execute_statement(f"USE SCHEMA {request.schema}")
        
        # Execute the main statement
        statement_id = await spark_manager.execute_statement(
            request.statement, 
            request.warehouse_id
        )
        
        # Get the result
        result = spark_manager.get_statement_result(statement_id)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to retrieve statement result")
        
        return StatementResponse(**result)
        
    except Exception as e:
        logger.error("Failed to execute statement", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sql/statements/{statement_id}", response_model=StatementResponse)
async def get_statement_result(
    statement_id: str,
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """Get the result of a statement by ID."""
    try:
        result = spark_manager.get_statement_result(statement_id)
        if not result:
            raise HTTPException(status_code=404, detail=f"Statement {statement_id} not found")
        
        return StatementResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get statement result", statement_id=statement_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sql/statements/{statement_id}/cancel", response_model=CancelStatementResponse)
async def cancel_statement(
    statement_id: str,
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """Cancel a running statement."""
    try:
        success = spark_manager.cancel_statement(statement_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Statement {statement_id} not found or cannot be canceled")
        
        result = spark_manager.get_statement_result(statement_id)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to retrieve canceled statement")
        
        return CancelStatementResponse(
            statement_id=statement_id,
            status=StatementStatus(**result["status"])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to cancel statement", statement_id=statement_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sql/warehouses", response_model=List[WarehouseInfo])
async def list_warehouses():
    """List available SQL warehouses."""
    return [
        WarehouseInfo(
            id="lakehouse_sql_warehouse",
            name="Lakehouse SQL Warehouse",
            cluster_size="2X-Small",
            state="RUNNING"
        )
    ]


@router.get("/sql/warehouses/{warehouse_id}", response_model=WarehouseInfo)
async def get_warehouse_info(warehouse_id: str):
    """Get information about a specific warehouse."""
    if warehouse_id != "lakehouse_sql_warehouse":
        raise HTTPException(status_code=404, detail=f"Warehouse {warehouse_id} not found")
    
    return WarehouseInfo(
        id="lakehouse_sql_warehouse",
        name="Lakehouse SQL Warehouse",
        cluster_size="2X-Small",
        state="RUNNING"
    )


@router.get("/clusters/list", response_model=Dict[str, List[ClusterInfo]])
async def list_clusters():
    """List clusters for compatibility."""
    return {
        "clusters": [
            ClusterInfo(
                cluster_id="lakehouse-spark-cluster",
                cluster_name="Lakehouse Spark Cluster",
                spark_version="3.5.0",
                node_type_id="i3.xlarge",
                driver_node_type_id="i3.xlarge",
                num_workers=1,
                state="RUNNING"
            )
        ]
    }


@router.get("/sql/history/queries")
async def get_query_history(
    max_results: Optional[int] = 100,
    include_metrics: Optional[bool] = False
):
    """Get query execution history."""
    # This would typically return historical query data
    # For now, return empty list as this is a sandbox environment
    return {
        "res": [],
        "has_more": False,
        "next_page_token": None
    }


@router.get("/unity-catalog/catalogs")
async def list_catalogs(
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """List available catalogs."""
    try:
        catalogs = spark_manager.list_catalogs()
        return {
            "catalogs": [{"name": cat, "type": "MANAGED_CATALOG"} for cat in catalogs]
        }
    except Exception as e:
        logger.error("Failed to list catalogs", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unity-catalog/catalogs/{catalog_name}/schemas")
async def list_schemas(
    catalog_name: str,
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """List schemas in a catalog."""
    try:
        schemas = spark_manager.list_schemas(catalog_name)
        return {
            "schemas": [{"name": schema, "catalog_name": catalog_name} for schema in schemas]
        }
    except Exception as e:
        logger.error("Failed to list schemas", catalog=catalog_name, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unity-catalog/catalogs/{catalog_name}/schemas/{schema_name}/tables")
async def list_tables(
    catalog_name: str,
    schema_name: str,
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """List tables in a schema."""
    try:
        tables = spark_manager.list_tables(catalog_name, schema_name)
        return {
            "tables": [
                {
                    "name": table, 
                    "catalog_name": catalog_name,
                    "schema_name": schema_name,
                    "table_type": "MANAGED"
                } 
                for table in tables
            ]
        }
    except Exception as e:
        logger.error("Failed to list tables", catalog=catalog_name, schema=schema_name, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sql/contexts")
async def get_execution_context(
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """Get current execution context."""
    try:
        context = spark_manager.get_current_context()
        return context
    except Exception as e:
        logger.error("Failed to get execution context", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))