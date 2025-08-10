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
from ..core.jobs_manager import JobsManager
from ..core.clusters_manager import ClustersManager
from ..core.dbfs_manager import DBFSManager

logger = structlog.get_logger()
router = APIRouter()


def get_spark_manager(request: Request) -> SparkManager:
    """Get Spark manager from app state."""
    return request.app.state.spark_manager


def get_jobs_manager(request: Request) -> JobsManager:
    """Get Jobs manager from app state."""
    return request.app.state.jobs_manager


def get_clusters_manager(request: Request) -> ClustersManager:
    """Get Clusters manager from app state."""
    return request.app.state.clusters_manager


def get_dbfs_manager(request: Request) -> DBFSManager:
    """Get DBFS manager from app state."""
    return request.app.state.dbfs_manager


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
    include_metrics: Optional[bool] = False,
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """Get query execution history."""
    try:
        history = spark_manager.get_query_history(limit=max_results)
        return {
            "res": history["queries"],
            "has_more": history["has_more"],
            "next_page_token": None,
            "total_count": history["total_count"]
        }
    except Exception as e:
        logger.error("Failed to get query history", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


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


# ==================== JOBS API ====================

@router.post("/jobs/create")
async def create_job(
    job_spec: Dict[str, Any],
    jobs_manager: JobsManager = Depends(get_jobs_manager)
):
    """Create a new job."""
    try:
        return jobs_manager.create_job(job_spec)
    except Exception as e:
        logger.error("Failed to create job", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/jobs/get")
async def get_job(
    job_id: str,
    jobs_manager: JobsManager = Depends(get_jobs_manager)
):
    """Get job information."""
    try:
        job = jobs_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        return job
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get job", job_id=job_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/run-now")
async def run_job(
    job_id: str,
    job_parameters: Optional[Dict[str, Any]] = None,
    jobs_manager: JobsManager = Depends(get_jobs_manager)
):
    """Trigger a job run."""
    try:
        result = await jobs_manager.run_now(job_id, job_parameters or {})
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to run job", job_id=job_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/runs/get")
async def get_job_run(
    run_id: str,
    jobs_manager: JobsManager = Depends(get_jobs_manager)
):
    """Get job run details."""
    try:
        run = jobs_manager.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
        return run
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get job run", run_id=run_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CLUSTERS API ====================

@router.post("/clusters/create")
async def create_cluster(
    cluster_spec: Dict[str, Any],
    clusters_manager: ClustersManager = Depends(get_clusters_manager)
):
    """Create a new cluster."""
    try:
        return clusters_manager.create_cluster(cluster_spec)
    except Exception as e:
        logger.error("Failed to create cluster", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/clusters/get")
async def get_cluster(
    cluster_id: str,
    clusters_manager: ClustersManager = Depends(get_clusters_manager)
):
    """Get cluster information."""
    try:
        cluster = clusters_manager.get_cluster(cluster_id)
        if not cluster:
            raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found")
        return cluster
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get cluster", cluster_id=cluster_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clusters/list-new") 
async def list_clusters_new(
    clusters_manager: ClustersManager = Depends(get_clusters_manager)
):
    """List all clusters (new endpoint to avoid conflict)."""
    try:
        return clusters_manager.list_clusters()
    except Exception as e:
        logger.error("Failed to list clusters", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ENHANCED UNITY CATALOG ====================

@router.get("/unity-catalog/catalogs/{catalog_name}/schemas/{schema_name}/tables/{table_name}")
async def get_table_info(
    catalog_name: str,
    schema_name: str,
    table_name: str,
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """Get detailed table information."""
    try:
        table_info = spark_manager.get_table_info(catalog_name, schema_name, table_name)
        if not table_info:
            raise HTTPException(status_code=404, detail=f"Table {catalog_name}.{schema_name}.{table_name} not found")
        return table_info
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get table info", 
                   table=f"{catalog_name}.{schema_name}.{table_name}", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/unity-catalog/catalogs/{catalog_name}/schemas/{schema_name}/tables")
async def create_delta_table(
    catalog_name: str,
    schema_name: str,
    table_spec: Dict[str, Any],
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """Create a new Delta Lake table."""
    try:
        table_name = table_spec["name"]
        columns = table_spec["columns"]
        location = table_spec.get("location")
        
        success = spark_manager.create_delta_table(
            catalog_name, schema_name, table_name, columns, location
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to create table")
        
        return {"status": "created", "table_name": f"{catalog_name}.{schema_name}.{table_name}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create table", 
                   table=f"{catalog_name}.{schema_name}.{table_spec.get('name', 'unknown')}", 
                   error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


# ==================== JDBC/THRIFT SERVER INFO ====================

@router.get("/connection/jdbc")
async def get_jdbc_info(
    spark_manager: SparkManager = Depends(get_spark_manager)
):
    """Get JDBC connection information."""
    try:
        return spark_manager.get_jdbc_connection_info()
    except Exception as e:
        logger.error("Failed to get JDBC info", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DBFS API ====================

@router.get("/dbfs/list")
async def list_dbfs_files(
    path: str,
    recursive: Optional[bool] = False,
    dbfs_manager: DBFSManager = Depends(get_dbfs_manager)
):
    """List files in DBFS path."""
    try:
        files = dbfs_manager.list_files(path, recursive)
        return {"files": files}
    except Exception as e:
        logger.error("Failed to list DBFS files", path=path, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dbfs/get-status")
async def get_dbfs_file_info(
    path: str,
    dbfs_manager: DBFSManager = Depends(get_dbfs_manager)
):
    """Get DBFS file or directory information."""
    try:
        file_info = dbfs_manager.get_file_info(path)
        if not file_info:
            raise HTTPException(status_code=404, detail=f"Path not found: {path}")
        return file_info
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get DBFS file info", path=path, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dbfs/read")
async def read_dbfs_file(
    path: str,
    offset: Optional[int] = 0,
    length: Optional[int] = None,
    format: Optional[str] = "BASE64",
    dbfs_manager: DBFSManager = Depends(get_dbfs_manager)
):
    """Read file content from DBFS."""
    try:
        data = dbfs_manager.read_file(path, offset, length)
        
        if format.upper() == "BASE64":
            import base64
            encoded_data = base64.b64encode(data).decode('utf-8')
            return {
                "bytes_read": len(data),
                "data": encoded_data
            }
        else:
            # Return as text (assuming UTF-8)
            return {
                "bytes_read": len(data),
                "data": data.decode('utf-8', errors='replace')
            }
            
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to read DBFS file", path=path, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dbfs/put")
async def write_dbfs_file(
    path: str,
    contents: str,
    overwrite: Optional[bool] = False,
    format: Optional[str] = "BASE64",
    dbfs_manager: DBFSManager = Depends(get_dbfs_manager)
):
    """Write file content to DBFS."""
    try:
        if format.upper() == "BASE64":
            import base64
            data = base64.b64decode(contents)
        else:
            data = contents.encode('utf-8')
        
        dbfs_manager.write_file(path, data, overwrite)
        return {"status": "success"}
        
    except Exception as e:
        logger.error("Failed to write DBFS file", path=path, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dbfs/delete")
async def delete_dbfs_path(
    path: str,
    recursive: Optional[bool] = False,
    dbfs_manager: DBFSManager = Depends(get_dbfs_manager)
):
    """Delete file or directory from DBFS."""
    try:
        dbfs_manager.delete_file(path, recursive)
        return {"status": "success"}
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to delete DBFS path", path=path, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dbfs/move")
async def move_dbfs_path(
    source_path: str,
    destination_path: str,
    dbfs_manager: DBFSManager = Depends(get_dbfs_manager)
):
    """Move/rename file or directory in DBFS."""
    try:
        dbfs_manager.move_file(source_path, destination_path)
        return {"status": "success"}
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to move DBFS path", source=source_path, dest=destination_path, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dbfs/mkdirs")
async def create_dbfs_directory(
    path: str,
    dbfs_manager: DBFSManager = Depends(get_dbfs_manager)
):
    """Create directory in DBFS."""
    try:
        dbfs_manager.create_directory(path)
        return {"status": "success"}
        
    except Exception as e:
        logger.error("Failed to create DBFS directory", path=path, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dbfs/get-upload-url")
async def get_dbfs_upload_url(
    path: str,
    expires_in: Optional[int] = 3600,
    dbfs_manager: DBFSManager = Depends(get_dbfs_manager)
):
    """Generate presigned URL for DBFS file upload."""
    try:
        url = dbfs_manager.get_upload_url(path, expires_in)
        return {"upload_url": url, "expires_in": expires_in}
        
    except Exception as e:
        logger.error("Failed to generate DBFS upload URL", path=path, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dbfs/get-download-url")
async def get_dbfs_download_url(
    path: str,
    expires_in: Optional[int] = 3600,
    dbfs_manager: DBFSManager = Depends(get_dbfs_manager)
):
    """Generate presigned URL for DBFS file download."""
    try:
        url = dbfs_manager.get_download_url(path, expires_in)
        return {"download_url": url, "expires_in": expires_in}
        
    except Exception as e:
        logger.error("Failed to generate DBFS download URL", path=path, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))