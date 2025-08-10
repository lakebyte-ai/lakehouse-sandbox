# ❄️ Snowflake SQL Sandbox

> A powerful Snowflake SQL translation and execution service that converts Snowflake-specific SQL to Trino/Spark SQL for seamless cloud data warehouse migration and development.

## 🎯 Overview

The Snowflake Sandbox provides comprehensive Snowflake SQL compatibility for:

- **SQL Translation** from Snowflake syntax to Trino/Spark SQL
- **Function Mapping** for Snowflake-specific functions
- **Data Type Conversion** between Snowflake and lakehouse formats
- **Query Execution** against Iceberg tables via Trino
- **Migration Testing** for Snowflake-to-lakehouse workflows
- **Performance Benchmarking** between Snowflake and open lakehouse

## 🚀 Quick Start

```bash
# Start the complete lakehouse environment  
make up

# Test Snowflake sandbox health
curl http://localhost:5435/health

# Execute a Snowflake-style query
curl -X POST http://localhost:5435/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_SCHEMA()",
    "request_id": "test-123"
  }'
```

## 📊 Key Features

### ✅ **Snowflake SQL Compatibility**
- **Functions**: `CURRENT_WAREHOUSE()`, `CURRENT_DATABASE()`, `CURRENT_SCHEMA()`
- **Data Types**: `VARCHAR`, `NUMBER`, `TIMESTAMP_NTZ`, `VARIANT`
- **Syntax**: Snowflake-specific SQL patterns and constructs
- **System Tables**: Information schema compatibility

### ✅ **SQL Translation Engine**
- **Real-time Translation** from Snowflake to Trino SQL
- **Function Mapping** with parameter compatibility
- **Dialect Conversion** for syntax differences
- **Error Handling** with descriptive translation messages

### ✅ **Execution Backend**
- **Trino Integration** for query execution
- **Iceberg Tables** as data source
- **Connection Pooling** for performance
- **Result Formatting** in Snowflake-compatible JSON

### ✅ **Migration Support**
- **Query Compatibility Testing** 
- **Performance Comparison** metrics
- **Translation Validation** reports
- **Schema Migration** assistance

## 🔧 API Endpoints

### Health & Status
```bash
# Health check
GET /health

# Service status with version info
GET /api/v1/status

# API documentation
GET /docs  # Interactive Swagger UI
```

### Query Execution
```bash
# Execute Snowflake SQL query
POST /api/v1/query
{
  "sql": "SELECT CURRENT_WAREHOUSE(), COUNT(*) FROM my_table",
  "request_id": "optional-id",
  "warehouse": "optional-warehouse-name"
}

# Response format:
{
  "success": true,
  "translated_sql": "SELECT 'COMPUTE_WH' AS current_warehouse, COUNT(*) FROM iceberg.default.my_table", 
  "execution_time_ms": 245,
  "row_count": 1,
  "columns": [...],
  "data": [["COMPUTE_WH", 42]],
  "request_id": "optional-id"
}
```

## 💡 SQL Translation Examples

### Snowflake Functions → Trino SQL

```sql
-- Snowflake Input:
SELECT 
  CURRENT_WAREHOUSE() as warehouse,
  CURRENT_DATABASE() as database, 
  CURRENT_SCHEMA() as schema,
  CURRENT_TIMESTAMP() as now;

-- Translated Trino SQL:
SELECT 
  'COMPUTE_WH' as warehouse,
  'ICEBERG' as database,
  'DEFAULT' as schema, 
  CURRENT_TIMESTAMP as now;
```

### Data Type Mappings

| Snowflake Type | Trino Type | Notes |
|---------------|------------|--------|
| `VARCHAR(n)` | `VARCHAR(n)` | Direct mapping |
| `NUMBER(p,s)` | `DECIMAL(p,s)` | Precision preserved |
| `TIMESTAMP_NTZ` | `TIMESTAMP` | Timezone normalization |
| `VARIANT` | `JSON` | JSON data type |
| `BOOLEAN` | `BOOLEAN` | Direct mapping |

### Complex Queries

```sql
-- Snowflake: Window functions with qualifiers
SELECT 
  customer_id,
  order_date,
  ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) as rn
FROM orders
WHERE order_date >= CURRENT_DATE() - INTERVAL '30 days';

-- Translated: Standard SQL with Trino functions  
SELECT 
  customer_id,
  order_date,
  ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) as rn
FROM iceberg.default.orders  
WHERE order_date >= CURRENT_DATE - INTERVAL '30' DAY;
```

## 🎮 Usage Patterns

### Development Workflow
```bash
# 1. Test original Snowflake query
curl -X POST http://localhost:5435/api/v1/query \
  -d '{"sql": "SELECT CURRENT_WAREHOUSE(), CURRENT_USER()"}'

# 2. Review translation in response
# 3. Validate results against expected output
# 4. Iterate on complex queries
```

### Migration Testing
```python
# Python example for batch testing
import requests

snowflake_queries = [
    "SELECT CURRENT_WAREHOUSE()",
    "SELECT * FROM INFORMATION_SCHEMA.TABLES", 
    "SELECT DATEDIFF('day', '2023-01-01', CURRENT_DATE())"
]

for sql in snowflake_queries:
    response = requests.post('http://localhost:5435/api/v1/query', 
                           json={'sql': sql})
    result = response.json()
    print(f"Original: {sql}")
    print(f"Translated: {result['translated_sql']}")
    print(f"Success: {result['success']}")
    print("---")
```

## 📈 Monitoring & Metrics

### Built-in Metrics
```bash
# Prometheus metrics (same port as API)
curl http://localhost:5435/metrics

# Key metrics:
# - snowflake_queries_total{status="success|error"} 
# - snowflake_translation_duration_seconds
# - snowflake_execution_duration_seconds
# - snowflake_query_complexity_score
```

### Performance Tracking
- **Translation Time** - SQL parsing and conversion
- **Execution Time** - Query runtime on Trino
- **Success Rate** - Translation and execution success ratio
- **Query Complexity** - Estimated difficulty score

## 🔧 Configuration

### Environment Variables
```bash
# Service Configuration
SNOWFLAKE_API_PORT=5435
SNOWFLAKE_API_HOST=0.0.0.0

# Trino Connection
TRINO_HOST=trino
TRINO_PORT=8080
TRINO_CATALOG=iceberg
TRINO_SCHEMA=default

# Default Warehouse Settings
DEFAULT_WAREHOUSE=COMPUTE_WH
DEFAULT_DATABASE=ICEBERG  
DEFAULT_SCHEMA=DEFAULT

# Translation Settings
ENABLE_QUERY_LOGGING=true
MAX_QUERY_LENGTH=100000
TRANSLATION_TIMEOUT_SECONDS=30
```

### Advanced Configuration
```python
# In snowflake-sandbox/src/config/settings.py
class Settings(BaseSettings):
    # Function mapping customization
    function_mappings: Dict[str, str] = {
        "CURRENT_WAREHOUSE": "'COMPUTE_WH'",
        "CURRENT_DATABASE": "'ICEBERG'", 
        "CURRENT_SCHEMA": "'DEFAULT'",
        "CURRENT_USER": "'sandbox_user'",
        "DATEDIFF": "DATE_DIFF"  # Custom function mappings
    }
    
    # Data type mappings
    type_mappings: Dict[str, str] = {
        "NUMBER": "DECIMAL",
        "VARCHAR": "VARCHAR", 
        "TIMESTAMP_NTZ": "TIMESTAMP",
        "VARIANT": "JSON"
    }
```

## 🧪 Testing & Validation

### Integration Tests
```bash
# Run Snowflake sandbox tests 
python3 tests/integration/test_snowflake_sandbox.py

# Or via main test runner
python3 tests/integration/test_runner.py --groups core integrations
```

### Manual Testing
```bash
# Test basic functionality
curl -X POST http://localhost:5435/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT 1 as test_value", "request_id": "test-1"}'

# Test function translation  
curl -X POST http://localhost:5435/api/v1/query \
  -H "Content-Type: application/json" \  
  -d '{"sql": "SELECT CURRENT_WAREHOUSE(), CURRENT_DATABASE()"}'

# Test complex queries
curl -X POST http://localhost:5435/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '"'"'DEFAULT'"'"'"}'
```

## 🔗 Integration Points

### With Core Services:
- **Trino** → SQL execution backend
- **Iceberg Catalog** → Metadata and table access
- **Polaris** → Catalog service integration
- **MinIO** → Data storage layer

### With Development Tools:
- **WebUI** → Service monitoring and health
- **Swagger UI** → API documentation at `/docs`
- **Prometheus** → Metrics collection
- **Integration Tests** → Automated validation

## 🐛 Troubleshooting

### Common Issues

**Translation Failures**
```bash
# Check specific function support
grep -r "CURRENT_WAREHOUSE" snowflake-sandbox/src/

# Review translation logs  
docker logs lakehouse-sandbox-snowflake-sandbox-1

# Test individual functions
curl -X POST http://localhost:5435/api/v1/query \
  -d '{"sql": "SELECT CURRENT_TIMESTAMP()"}'
```

**Execution Errors**
```bash
# Verify Trino connectivity
curl http://localhost:8080/v1/info

# Check Iceberg catalog
curl http://localhost:8181/api/catalog/v1/config

# Test simple Trino query
curl -X POST http://localhost:5435/api/v1/query \
  -d '{"sql": "SELECT 1"}'
```

**Performance Issues**
- Monitor query complexity and size limits
- Check Trino cluster resources
- Review connection pooling configuration
- Analyze translation overhead vs execution time

### Debug Mode
```bash
# Enable detailed logging
export LOG_LEVEL=DEBUG
export ENABLE_QUERY_LOGGING=true

# Restart with debug configuration
docker restart lakehouse-sandbox-snowflake-sandbox-1
```

## 🎯 Migration Best Practices

### Query Assessment
1. **Catalog Snowflake Functions** used in your queries
2. **Test Translation** for each unique pattern
3. **Validate Results** against Snowflake output
4. **Performance Test** on representative data sets

### Gradual Migration
1. **Start with SELECT** queries (read-only)
2. **Test DDL statements** (CREATE, ALTER)
3. **Validate DML operations** (INSERT, UPDATE, DELETE) 
4. **Benchmark performance** vs original Snowflake

### Data Type Considerations
- Review `NUMBER` vs `DECIMAL` precision requirements
- Test `TIMESTAMP` timezone handling differences
- Validate `VARIANT` JSON compatibility
- Check `VARCHAR` length constraints

## 📚 Additional Resources

- [Snowflake SQL Reference](https://docs.snowflake.com/en/sql-reference)
- [Trino SQL Functions](https://trino.io/docs/current/functions.html)
- [Migration Planning Guide](./MIGRATION.md)
- [WebUI User Guide](./WEBUI.md)

---

**Ready to test your Snowflake migration? Start with `make up` and explore SQL compatibility testing!** ❄️🚀