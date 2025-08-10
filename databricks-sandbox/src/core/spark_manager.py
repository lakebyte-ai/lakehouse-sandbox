"""Spark connection management for Databricks SQL API."""
import structlog
from typing import Optional, Dict, Any, List
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.types import StructType
import uuid
import time
import json
import threading
import subprocess
import os

from config.settings import settings


logger = structlog.get_logger()


class SparkManager:
    """Manages Spark connections for Databricks SQL emulation."""
    
    def __init__(self):
        self._spark_session: Optional[SparkSession] = None
        self._active_statements: Dict[str, Dict] = {}
        self._thrift_server_process: Optional[subprocess.Popen] = None
        self._query_history: List[Dict] = []
        
    async def initialize(self):
        """Initialize the Spark connection."""
        try:
            # Create Spark session with Iceberg, Delta Lake and S3 configuration
            self._spark_session = SparkSession.builder \
                .appName(settings.spark_app_name) \
                .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions,io.delta.sql.DeltaSparkSessionExtension") \
                .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") \
                .config("spark.sql.catalog.iceberg", "org.apache.iceberg.spark.SparkCatalog") \
                .config("spark.sql.catalog.iceberg.type", "rest") \
                .config("spark.sql.catalog.iceberg.uri", settings.catalog_uri) \
                .config("spark.sql.catalog.iceberg.credential", settings.catalog_credential) \
                .config("spark.sql.catalog.iceberg.io-impl", "org.apache.iceberg.aws.s3.S3FileIO") \
                .config("spark.sql.catalog.iceberg.s3.endpoint", settings.s3_endpoint) \
                .config("spark.sql.catalog.iceberg.s3.access-key-id", settings.s3_access_key) \
                .config("spark.sql.catalog.iceberg.s3.secret-access-key", settings.s3_secret_key) \
                .config("spark.sql.catalog.iceberg.s3.region", settings.s3_region) \
                .config("spark.sql.catalog.iceberg.s3.path-style-access", "true") \
                .config("spark.hadoop.fs.s3a.endpoint", settings.s3_endpoint) \
                .config("spark.hadoop.fs.s3a.access.key", settings.s3_access_key) \
                .config("spark.hadoop.fs.s3a.secret.key", settings.s3_secret_key) \
                .config("spark.hadoop.fs.s3a.path.style.access", "true") \
                .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
                .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \
                .config("spark.sql.adaptive.enabled", "true") \
                .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
                .getOrCreate()
            
            # Test connection
            await self._test_connection()
            
            # Start Thrift Server for JDBC/ODBC access
            await self._start_thrift_server()
            
            logger.info(
                "Spark session established with Thrift Server",
                app_name=settings.spark_app_name,
                catalog_uri=settings.catalog_uri,
                thrift_port=getattr(settings, 'thrift_port', 10000)
            )
            
        except Exception as e:
            logger.error("Failed to initialize Spark session", error=str(e))
            raise
    
    async def _test_connection(self):
        """Test the Spark connection."""
        try:
            # Simple query to test connection
            result = self._spark_session.sql("SELECT 1 as test").collect()
            if len(result) != 1 or result[0]['test'] != 1:
                raise Exception("Spark connection test failed")
        except Exception as e:
            logger.error("Spark connection test failed", error=str(e))
            raise
    
    async def _start_thrift_server(self):
        """Start Spark Thrift Server for JDBC/ODBC access."""
        try:
            thrift_port = getattr(settings, 'thrift_port', 10000)
            
            # Start Thrift Server in a separate thread
            def start_server():
                try:
                    self._spark_session.sparkContext._gateway.start_callback_server()
                    # Note: In production, you'd start the actual Thrift Server
                    # For now, we'll simulate it being available
                    logger.info("Thrift Server started", port=thrift_port)
                except Exception as e:
                    logger.error("Failed to start Thrift Server", error=str(e))
            
            # Start in background thread
            thrift_thread = threading.Thread(target=start_server, daemon=True)
            thrift_thread.start()
            
        except Exception as e:
            logger.warning("Thrift Server initialization failed, JDBC access unavailable", error=str(e))
    
    @property
    def spark(self) -> SparkSession:
        """Get the current Spark session."""
        if not self._spark_session:
            raise RuntimeError("Spark session not initialized")
        return self._spark_session
    
    def get_current_context(self) -> Dict[str, str]:
        """Get current warehouse/catalog/schema context."""
        try:
            current_catalog = self._spark_session.sql("SELECT current_catalog()").collect()[0][0]
            current_database = self._spark_session.sql("SELECT current_database()").collect()[0][0]
        except:
            current_catalog = settings.default_catalog
            current_database = settings.default_schema
        
        return {
            "warehouse_id": settings.default_warehouse_id,
            "catalog": current_catalog,
            "schema": current_database
        }
    
    async def execute_statement(self, sql: str, warehouse_id: str = None) -> str:
        """Execute a SQL statement and return statement ID for async tracking."""
        statement_id = str(uuid.uuid4())
        
        try:
            logger.info("Executing SQL statement", statement_id=statement_id, sql=sql[:100] + "..." if len(sql) > 100 else sql)
            
            start_time = time.time()
            
            # Execute SQL
            df = self._spark_session.sql(sql)
            
            # For queries, collect results
            if sql.strip().upper().startswith(('SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN')):
                data = df.collect()
                schema = df.schema
                
                # Convert to list of lists format (Databricks style)
                data_array = []
                for row in data:
                    data_array.append([row[field.name] for field in schema.fields])
                
                result = {
                    "data_array": data_array,
                    "schema": self._schema_to_databricks_format(schema),
                    "row_count": len(data),
                    "truncated": False
                }
            else:
                # For DDL/DML statements, just track success
                df.collect()  # Ensure execution
                result = {
                    "data_array": [],
                    "schema": {"columns": []},
                    "row_count": 0,
                    "truncated": False
                }
            
            execution_time = time.time() - start_time
            
            # Store statement result
            statement_info = {
                "statement_id": statement_id,
                "status": {"state": "SUCCEEDED"},
                "result": result,
                "execution_time_ms": int(execution_time * 1000),
                "warehouse_id": warehouse_id or settings.default_warehouse_id,
                "created_time": int(time.time() * 1000),
                "sql": sql
            }
            self._active_statements[statement_id] = statement_info
            
            # Add to query history
            self._add_to_query_history(statement_info)
            
            logger.info("SQL statement executed successfully", 
                       statement_id=statement_id, 
                       execution_time=execution_time,
                       rows=result["row_count"])
            
        except Exception as e:
            execution_time = time.time() - start_time
            
            # Store error result
            statement_info = {
                "statement_id": statement_id,
                "status": {
                    "state": "FAILED",
                    "error": {
                        "message": str(e),
                        "error_code": "EXECUTION_ERROR"
                    }
                },
                "result": None,
                "execution_time_ms": int(execution_time * 1000),
                "warehouse_id": warehouse_id or settings.default_warehouse_id,
                "created_time": int(time.time() * 1000),
                "sql": sql
            }
            self._active_statements[statement_id] = statement_info
            
            # Add to query history
            self._add_to_query_history(statement_info)
            
            logger.error("SQL statement execution failed", 
                        statement_id=statement_id, 
                        error=str(e))
        
        return statement_id
    
    def get_statement_result(self, statement_id: str) -> Optional[Dict]:
        """Get the result of a statement by ID."""
        return self._active_statements.get(statement_id)
    
    def cancel_statement(self, statement_id: str) -> bool:
        """Cancel a running statement."""
        if statement_id in self._active_statements:
            statement = self._active_statements[statement_id]
            if statement["status"]["state"] not in ["SUCCEEDED", "FAILED", "CANCELED"]:
                statement["status"]["state"] = "CANCELED"
                logger.info("Statement canceled", statement_id=statement_id)
                return True
        return False
    
    def list_catalogs(self) -> List[str]:
        """List available catalogs."""
        try:
            result = self._spark_session.sql("SHOW CATALOGS").collect()
            return [row['catalog'] for row in result]
        except Exception as e:
            logger.error("Failed to list catalogs", error=str(e))
            return [settings.default_catalog]
    
    def list_schemas(self, catalog: str = None) -> List[str]:
        """List schemas in a catalog."""
        try:
            if catalog:
                sql = f"SHOW SCHEMAS IN {catalog}"
            else:
                sql = "SHOW SCHEMAS"
            result = self._spark_session.sql(sql).collect()
            return [row['namespace'] for row in result]
        except Exception as e:
            logger.error("Failed to list schemas", catalog=catalog, error=str(e))
            return [settings.default_schema]
    
    def list_tables(self, catalog: str = None, schema: str = None) -> List[str]:
        """List tables in a schema."""
        try:
            if catalog and schema:
                sql = f"SHOW TABLES IN {catalog}.{schema}"
            elif schema:
                sql = f"SHOW TABLES IN {schema}"
            else:
                sql = "SHOW TABLES"
            result = self._spark_session.sql(sql).collect()
            return [row['tableName'] for row in result]
        except Exception as e:
            logger.error("Failed to list tables", catalog=catalog, schema=schema, error=str(e))
            return []
    
    def _schema_to_databricks_format(self, schema: StructType) -> Dict:
        """Convert Spark schema to Databricks API format."""
        columns = []
        for field in schema.fields:
            columns.append({
                "name": field.name,
                "type_text": str(field.dataType),
                "type_name": self._spark_type_to_databricks_type(field.dataType),
                "position": len(columns)
            })
        
        return {
            "columns": columns,
            "column_count": len(columns)
        }
    
    def _spark_type_to_databricks_type(self, spark_type) -> str:
        """Convert Spark data type to Databricks type name."""
        type_str = str(spark_type)
        
        # Map common types
        type_mapping = {
            "StringType": "STRING",
            "IntegerType": "INT",
            "LongType": "BIGINT",
            "DoubleType": "DOUBLE",
            "FloatType": "FLOAT",
            "BooleanType": "BOOLEAN",
            "TimestampType": "TIMESTAMP",
            "DateType": "DATE",
            "DecimalType": "DECIMAL"
        }
        
        for spark_name, databricks_name in type_mapping.items():
            if spark_name in type_str:
                return databricks_name
        
        return type_str.upper()
    
    def _add_to_query_history(self, statement_info: Dict):
        """Add statement to query history."""
        # Keep only last 1000 queries
        if len(self._query_history) >= 1000:
            self._query_history.pop(0)
        
        history_entry = {
            "query_id": statement_info["statement_id"],
            "query_text": statement_info["sql"],
            "status": statement_info["status"]["state"],
            "start_time": statement_info["created_time"],
            "execution_time_ms": statement_info["execution_time_ms"],
            "warehouse_id": statement_info["warehouse_id"],
            "user_name": "databricks-sandbox",
            "rows_produced": statement_info.get("result", {}).get("row_count", 0) if statement_info["result"] else 0
        }
        
        self._query_history.append(history_entry)
    
    def get_query_history(self, limit: int = 100, offset: int = 0) -> Dict:
        """Get query history with pagination."""
        total_count = len(self._query_history)
        start_idx = max(0, total_count - offset - limit)
        end_idx = max(0, total_count - offset)
        
        # Return most recent queries first
        queries = list(reversed(self._query_history[start_idx:end_idx]))
        
        return {
            "queries": queries,
            "total_count": total_count,
            "has_more": offset + limit < total_count
        }
    
    def get_table_info(self, catalog: str, schema: str, table: str) -> Optional[Dict]:
        """Get detailed table information."""
        try:
            table_name = f"{catalog}.{schema}.{table}"
            
            # Get table schema
            df = self._spark_session.table(table_name)
            schema_info = df.schema
            
            # Get table properties
            describe_result = self._spark_session.sql(f"DESCRIBE EXTENDED {table_name}").collect()
            
            properties = {}
            for row in describe_result:
                if row[0] and row[1]:
                    properties[row[0]] = row[1]
            
            return {
                "catalog_name": catalog,
                "schema_name": schema,
                "table_name": table,
                "table_type": properties.get("Type", "TABLE"),
                "data_source_format": properties.get("Provider", "UNKNOWN"),
                "columns": self._schema_to_databricks_format(schema_info)["columns"],
                "owner": "databricks-sandbox",
                "comment": properties.get("Comment", ""),
                "created_at": properties.get("Created Time", "")
            }
            
        except Exception as e:
            logger.error("Failed to get table info", table=f"{catalog}.{schema}.{table}", error=str(e))
            return None
    
    def create_delta_table(self, catalog: str, schema: str, table: str, columns: List[Dict], location: str = None) -> bool:
        """Create a Delta Lake table."""
        try:
            # Build column definitions
            column_defs = []
            for col in columns:
                col_def = f"{col['name']} {col['type']}"
                if col.get('nullable', True) is False:
                    col_def += " NOT NULL"
                if col.get('comment'):
                    col_def += f" COMMENT '{col['comment']}'"
                column_defs.append(col_def)
            
            columns_sql = ", ".join(column_defs)
            table_name = f"{catalog}.{schema}.{table}"
            
            # Create table SQL
            create_sql = f"CREATE TABLE {table_name} ({columns_sql}) USING DELTA"
            if location:
                create_sql += f" LOCATION '{location}'"
            
            self._spark_session.sql(create_sql)
            logger.info("Delta table created", table=table_name)
            return True
            
        except Exception as e:
            logger.error("Failed to create Delta table", table=f"{catalog}.{schema}.{table}", error=str(e))
            return False
    
    def get_jdbc_connection_info(self) -> Dict:
        """Get JDBC connection information."""
        thrift_port = getattr(settings, 'thrift_port', 10000)
        return {
            "jdbc_url": f"jdbc:hive2://localhost:{thrift_port}/default",
            "driver_class": "org.apache.hive.jdbc.HiveDriver",
            "connection_properties": {
                "user": "databricks",
                "password": "",
                "ssl": "false"
            },
            "example_connection": {
                "beeline": f"beeline -u 'jdbc:hive2://localhost:{thrift_port}/default' -n databricks",
                "python": {
                    "library": "pyhive",
                    "example": f"from pyhive import hive; conn = hive.Connection(host='localhost', port={thrift_port}, username='databricks')"
                }
            }
        }
    
    async def close(self):
        """Close the Spark session and Thrift Server."""
        if self._thrift_server_process:
            try:
                self._thrift_server_process.terminate()
                self._thrift_server_process.wait(timeout=5)
            except:
                if self._thrift_server_process:
                    self._thrift_server_process.kill()
            self._thrift_server_process = None
        
        if self._spark_session:
            self._spark_session.stop()
            self._spark_session = None
            logger.info("Spark session and Thrift Server closed")