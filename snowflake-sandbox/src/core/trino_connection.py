"""Trino connection management."""
import structlog
import ibis
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

from config.settings import settings


logger = structlog.get_logger()


class TrinoConnectionManager:
    """Manages Trino connections through Ibis."""
    
    def __init__(self):
        self._connection: Optional[ibis.backends.trino.Backend] = None
        self._current_catalog = settings.trino_catalog
        self._current_schema = settings.trino_schema
        
    async def initialize(self):
        """Initialize the Trino connection."""
        try:
            self._connection = ibis.trino.connect(
                host=settings.trino_host,
                port=settings.trino_port,
                user=settings.trino_user,
                catalog=self._current_catalog,
                schema=self._current_schema
            )
            
            # Test connection
            await self._test_connection()
            
            logger.info(
                "Trino connection established",
                host=settings.trino_host,
                port=settings.trino_port,
                catalog=self._current_catalog,
                schema=self._current_schema
            )
            
        except Exception as e:
            logger.error("Failed to connect to Trino", error=str(e))
            raise
    
    async def _test_connection(self):
        """Test the Trino connection."""
        try:
            # Simple query to test connection
            result = self._connection.sql("SELECT 1 as test").execute()
            if result.iloc[0, 0] != 1:
                raise Exception("Connection test failed")
        except Exception as e:
            logger.error("Trino connection test failed", error=str(e))
            raise
    
    @property
    def connection(self):
        """Get the current Trino connection."""
        if not self._connection:
            raise RuntimeError("Trino connection not initialized")
        return self._connection
    
    def get_current_context(self) -> Dict[str, str]:
        """Get current warehouse/database/schema context."""
        return {
            "warehouse": "compute_wh",  # Virtual warehouse concept
            "database": self._current_catalog,
            "schema": self._current_schema
        }
    
    def use_warehouse(self, warehouse_name: str) -> Dict[str, str]:
        """Switch to a warehouse (no-op in Trino, but return context)."""
        logger.info("Warehouse switched", warehouse=warehouse_name)
        return self.get_current_context()
    
    def use_database(self, database_name: str) -> Dict[str, str]:
        """Switch to a database (catalog in Trino terms)."""
        try:
            # Update connection catalog
            self._connection = ibis.trino.connect(
                host=settings.trino_host,
                port=settings.trino_port,
                user=settings.trino_user,
                catalog=database_name,
                schema=self._current_schema
            )
            self._current_catalog = database_name
            
            logger.info("Database switched", database=database_name)
            return self.get_current_context()
            
        except Exception as e:
            logger.error("Failed to switch database", database=database_name, error=str(e))
            raise
    
    def use_schema(self, schema_name: str) -> Dict[str, str]:
        """Switch to a schema."""
        try:
            # Update connection schema
            self._connection = ibis.trino.connect(
                host=settings.trino_host,
                port=settings.trino_port,
                user=settings.trino_user,
                catalog=self._current_catalog,
                schema=schema_name
            )
            self._current_schema = schema_name
            
            logger.info("Schema switched", schema=schema_name)
            return self.get_current_context()
            
        except Exception as e:
            logger.error("Failed to switch schema", schema=schema_name, error=str(e))
            raise
    
    async def execute_query(self, sql: str) -> Any:
        """Execute a SQL query through Ibis."""
        try:
            logger.info("Executing query", sql=sql[:100] + "..." if len(sql) > 100 else sql)
            
            # Execute through Ibis
            result = self._connection.sql(sql).execute()
            
            logger.info("Query executed successfully", rows=len(result))
            return result
            
        except Exception as e:
            logger.error("Query execution failed", sql=sql, error=str(e))
            raise
    
    def list_databases(self) -> list:
        """List available databases (catalogs)."""
        try:
            result = self._connection.sql("SHOW CATALOGS").execute()
            return result['Catalog'].tolist()
        except Exception as e:
            logger.error("Failed to list databases", error=str(e))
            return []
    
    def list_schemas(self, database: Optional[str] = None) -> list:
        """List available schemas in a database."""
        try:
            if database:
                sql = f"SHOW SCHEMAS FROM {database}"
            else:
                sql = "SHOW SCHEMAS"
            result = self._connection.sql(sql).execute()
            return result['Schema'].tolist()
        except Exception as e:
            logger.error("Failed to list schemas", database=database, error=str(e))
            return []
    
    def list_tables(self, database: Optional[str] = None, schema: Optional[str] = None) -> list:
        """List available tables in a schema."""
        try:
            if database and schema:
                sql = f"SHOW TABLES FROM {database}.{schema}"
            elif schema:
                sql = f"SHOW TABLES FROM {schema}"
            else:
                sql = "SHOW TABLES"
            result = self._connection.sql(sql).execute()
            return result['Table'].tolist()
        except Exception as e:
            logger.error("Failed to list tables", database=database, schema=schema, error=str(e))
            return []
    
    async def close(self):
        """Close the connection."""
        if self._connection:
            # Ibis connections are typically closed automatically
            self._connection = None
            logger.info("Trino connection closed")