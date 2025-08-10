# 🧱 Databricks SQL Sandbox

> A comprehensive Databricks SQL API emulation service with full Spark integration, Unity Catalog support, and WebUI integration for seamless lakehouse development.

## 🎯 Overview

The Databricks Sandbox provides a complete emulation of Databricks SQL APIs, allowing you to:

- **Develop and test** SQL queries with Databricks-compatible APIs
- **Explore Unity Catalog** hierarchies (catalogs, schemas, tables)
- **Execute Spark SQL** with full Iceberg and Delta Lake support  
- **Manage SQL warehouses** and compute resources
- **Export query results** in various formats
- **Monitor performance** with built-in metrics

## 🚀 Quick Start

```bash
# Start the complete lakehouse environment
make up

# Access the Databricks Sandbox
curl http://localhost:5434/health

# Open the integrated SQL Editor
# Navigate to http://localhost:3000 and click the SQL Editor button
```

## 📊 Key Features

### ✅ **Full Databricks SQL API Compatibility**
- `/api/2.0/sql/statements` - Execute SQL statements asynchronously
- `/api/2.0/sql/warehouses` - Manage compute warehouses
- `/api/2.0/unity-catalog/*` - Browse catalogs, schemas, and tables
- `/api/2.0/clusters/list` - Compute cluster management
- `/api/2.0/sql/contexts` - Execution context configuration

### ✅ **Advanced SQL Features**
- **Spark SQL Engine** with PySpark 3.5.0
- **Iceberg Tables** via Polaris catalog integration
- **Delta Lake Support** for ACID transactions
- **MinIO Storage** backend with S3 compatibility
- **Schema Evolution** and time travel queries

### ✅ **WebUI Integration**
- **Interactive SQL Editor** with syntax highlighting
- **Schema Browser** with catalog navigation
- **Query History** and result caching
- **Export Functionality** (CSV, JSON formats)
- **Performance Monitoring** and metrics

## 🔧 API Usage Examples

### Execute a SQL Statement

```bash
# Submit a SQL query
curl -X POST http://localhost:5434/api/2.0/sql/statements \
  -H "Content-Type: application/json" \
  -d '{
    "statement": "SELECT current_catalog(), current_database(), COUNT(*) FROM information_schema.tables",
    "warehouse_id": "lakehouse_sql_warehouse"
  }'

# Response includes statement_id for tracking
{
  "statement_id": "uuid-here",
  "status": {
    "state": "SUCCEEDED"
  },
  "result": {
    "data_array": [["iceberg", "default", 42]],
    "schema": {...},
    "row_count": 1
  }
}
```

### Browse Unity Catalog

```bash
# List available catalogs
curl http://localhost:5434/api/2.0/unity-catalog/catalogs

# List schemas in a catalog
curl http://localhost:5434/api/2.0/unity-catalog/catalogs/iceberg/schemas

# List tables in a schema
curl http://localhost:5434/api/2.0/unity-catalog/catalogs/iceberg/schemas/default/tables
```

### Manage SQL Warehouses

```bash
# List available warehouses
curl http://localhost:5434/api/2.0/sql/warehouses

# Get warehouse details
curl http://localhost:5434/api/2.0/sql/warehouses/lakehouse_sql_warehouse
```

## 🎮 Interactive SQL Editor

Access the built-in SQL Editor through the WebUI at `http://localhost:3000`:

### Features:
- **Syntax Highlighting** for SQL queries
- **Schema Browser** with expandable catalog tree
- **Auto-completion** for table and column names
- **Query History** with execution status
- **Result Export** in multiple formats
- **Performance Metrics** display

### Usage:
1. **Open WebUI** → Click "SQL Editor" button (code icon)
2. **Select Catalog/Schema** from the sidebar
3. **Write SQL** in the editor with syntax highlighting
4. **Execute Query** → View results in tabular format
5. **Export Results** → Download as CSV or JSON

## 📈 Performance & Monitoring

### Built-in Metrics (Port 18000)
```bash
# Prometheus metrics endpoint
curl http://localhost:18000/metrics

# Key metrics:
# - databricks_sql_statements_total
# - databricks_sql_execution_duration_seconds
# - databricks_warehouse_active_connections
# - databricks_unity_catalog_operations_total
```

### Query Performance
- **Statement Lifecycle Tracking** with execution times
- **Result Caching** for improved performance
- **Connection Pooling** for Spark sessions
- **Resource Usage** monitoring

## 🔧 Configuration

### Environment Variables
```bash
# Spark Configuration
SPARK_MASTER_URL=local[*]
SPARK_SQL_WAREHOUSE_DIR=/opt/spark-warehouse
SPARK_CATALOG_TYPE=iceberg

# Storage Configuration  
AWS_S3_ENDPOINT=http://minio:9000
AWS_ACCESS_KEY_ID=admin
AWS_SECRET_ACCESS_KEY=password

# Iceberg Catalog
ICEBERG_CATALOG_URI=http://polaris:8181/api/catalog/v1/

# Service Configuration
DATABRICKS_API_PORT=5434
DATABRICKS_METRICS_PORT=8000
```

### Advanced Spark Settings
```python
# In databricks-sandbox/src/core/spark_manager.py
spark_config = {
    "spark.sql.extensions": "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions,io.delta.sql.DeltaSparkSessionExtension",
    "spark.sql.catalog.iceberg": "org.apache.iceberg.spark.SparkCatalog",
    "spark.sql.catalog.iceberg.type": "rest",
    "spark.serializer": "org.apache.spark.serializer.KryoSerializer",
    "spark.sql.adaptive.enabled": "true",
    "spark.sql.adaptive.coalescePartitions.enabled": "true"
}
```

## 🧪 Testing & Validation

### Integration Tests
```bash
# Run comprehensive Databricks sandbox tests
python3 tests/integration/test_databricks_sandbox.py

# Test Results:
# ✅ Health Check
# ✅ Basic SQL Statement  
# ✅ SQL Statement Lifecycle
# ✅ Spark Catalog Operations
# ✅ Warehouse Operations
# ✅ Unity Catalog Endpoints
# ✅ Clusters Endpoint
# ✅ Execution Context
# ✅ Error Handling
```

### Manual Testing
```sql
-- Test catalog operations
SHOW CATALOGS;
SHOW SCHEMAS IN iceberg;
SHOW TABLES IN iceberg.default;

-- Test data operations
CREATE TABLE iceberg.default.test_table (
    id BIGINT,
    name STRING,
    created_at TIMESTAMP
) USING ICEBERG;

INSERT INTO iceberg.default.test_table 
VALUES (1, 'Alice', current_timestamp());

SELECT * FROM iceberg.default.test_table;

-- Test advanced features
SELECT * FROM iceberg.default.test_table 
VERSION AS OF 1;  -- Time travel

DESCRIBE EXTENDED iceberg.default.test_table;  -- Schema details
```

## 🔗 Integration Points

### With Core Services:
- **Polaris Catalog** → Unity Catalog metadata
- **MinIO Storage** → Data lake storage layer
- **Trino** → Cross-engine query federation  
- **Spark Jupyter** → Notebook-based development

### With WebUI:
- **Service Monitoring** → Health and status tracking
- **SQL Editor** → Interactive query development
- **Metrics Dashboard** → Performance monitoring
- **Log Viewer** → Debugging and troubleshooting

## 🐛 Troubleshooting

### Common Issues

**Connection Refused**
```bash
# Check if container is running
docker ps | grep databricks-sandbox

# Check logs
docker logs lakehouse-sandbox-databricks-sandbox-1

# Restart service
docker restart lakehouse-sandbox-databricks-sandbox-1
```

**Spark Session Issues**
```bash
# Check Spark configuration
curl http://localhost:5434/api/2.0/sql/contexts

# Verify catalog connectivity
curl http://localhost:8181/api/catalog/v1/config
```

**Query Execution Failures**
- Verify catalog/schema exists in Unity Catalog
- Check table permissions and access rights
- Review Spark SQL syntax compatibility
- Monitor resource usage and memory limits

### Debug Mode
```bash
# Enable debug logging
export PYTHONPATH=/app
export LOG_LEVEL=DEBUG

# Check detailed logs
docker logs -f lakehouse-sandbox-databricks-sandbox-1
```

## 📚 Additional Resources

- [Databricks SQL API Documentation](https://docs.databricks.com/api/workspace/sql)
- [Unity Catalog REST API](https://docs.databricks.com/api/workspace/unitycatalog)
- [Apache Iceberg Documentation](https://iceberg.apache.org/)
- [PySpark SQL Guide](https://spark.apache.org/docs/latest/sql-programming-guide.html)
- [WebUI User Guide](./WEBUI.md)

---

**Ready to explore your data lakehouse? Start with `make up` and dive into SQL development with full Databricks compatibility!** 🚀