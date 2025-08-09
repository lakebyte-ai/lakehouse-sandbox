# Snowflake Sandbox Service (Experimental)

⚠️ **EXPERIMENTAL**: This is an experimental Snowflake SQL compatibility layer powered by Trino and Ibis. For production use cases, consider [LocalStack for Snowflake](https://www.localstack.cloud/localstack-for-snowflake) or real Snowflake instances.

An open-source Snowflake-like experience for development, testing, and learning scenarios.

## Features

- **SQL Translation**: Automatic translation of Snowflake SQL to Trino SQL
- **API Compatibility**: RESTful API mimicking Snowflake's interface
- **Function Mapping**: Support for common Snowflake functions and data types
- **Warehouse Operations**: Virtual warehouse management
- **Metadata Access**: Database, schema, and table listing
- **Health Monitoring**: Comprehensive health checks and metrics
- **Integration**: Seamless integration with existing Trino infrastructure

## Architecture

```
┌─────────────────── Client Applications ─────────────────────┐
│  Jupyter Notebooks  │  BI Tools (Looker)  │  Custom Apps   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────── Snowflake Sandbox API ──────────────────┐
│  • SQL Translation Layer                                   │
│  • Snowflake Function Mappings                            │
│  • Virtual Warehouse Management                           │
│  • Error Handling & Monitoring                            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────── Ibis + Trino Backend ───────────────────┐
│  • Query Execution Engine                                 │
│  • Data Federation                                        │
│  • Storage Abstraction                                    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────── Storage & Catalogs ─────────────────────┐
│  MinIO S3  │  Polaris Catalog  │  Iceberg Tables         │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Build and Start

```bash
# Build the service
make build

# Start all services including Snowflake Sandbox
make up

# Check status
make status
```

### 2. Verify Installation

```bash
# Health check
curl http://localhost:5432/health

# Service status
curl http://localhost:5432/api/v1/status

# API documentation
open http://localhost:5432/docs
```

### 3. Basic Usage

#### REST API

```bash
# Execute a Snowflake SQL query
curl -X POST http://localhost:5432/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT CURRENT_WAREHOUSE(), CURRENT_DATABASE()",
    "request_id": "test-123"
  }'

# List databases
curl http://localhost:5432/api/v1/databases

# Use warehouse
curl -X POST http://localhost:5432/api/v1/warehouse/use \
  -H "Content-Type: application/json" \
  -d '{"warehouse": "analytics_wh"}'
```

#### Python Integration

```python
import requests

# Query execution
response = requests.post("http://localhost:5432/api/v1/query", json={
    "sql": """
    SELECT 
        DATE_PART('month', order_date) as month,
        SUM(amount) as total
    FROM orders 
    WHERE DATE_PART('year', order_date) = 2024
    GROUP BY month
    """,
    "request_id": "analytics-001"
})

result = response.json()
print(f"Rows returned: {result['row_count']}")
print(f"Transformations: {result['transformations']}")
```

## Supported Features

### SQL Functions

| Snowflake Function | Trino Equivalent | Status |
|-------------------|------------------|--------|
| `CURRENT_WAREHOUSE()` | `'compute_wh'` | ✅ |
| `CURRENT_DATABASE()` | `CURRENT_CATALOG` | ✅ |
| `CURRENT_SCHEMA()` | `CURRENT_SCHEMA` | ✅ |
| `DATE_PART(part, date)` | `EXTRACT(part FROM date)` | ✅ |
| `IFF(cond, true, false)` | `IF(cond, true, false)` | ✅ |
| `OBJECT_CONSTRUCT()` | `MAP()` | ✅ |
| `ARRAY_CONSTRUCT()` | `ARRAY[]` | ✅ |

### Data Types

| Snowflake Type | Trino Type | Status |
|---------------|------------|--------|
| `NUMBER` | `DECIMAL` | ✅ |
| `STRING` | `VARCHAR` | ✅ |
| `VARIANT` | `JSON` | ✅ |
| `TIMESTAMP_NTZ` | `TIMESTAMP` | ✅ |
| `TIMESTAMP_TZ` | `TIMESTAMP WITH TIME ZONE` | ✅ |

### Operations

- ✅ Basic SELECT queries
- ✅ Aggregations and GROUP BY
- ✅ Window functions
- ✅ JOINs
- ✅ Subqueries
- ✅ CTEs (Common Table Expressions)
- ⚠️ Time Travel (syntax recognized, not executed)
- ❌ Stored procedures
- ❌ MERGE statements

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SNOWFLAKE_SANDBOX_HOST` | `0.0.0.0` | Service bind host |
| `SNOWFLAKE_SANDBOX_PORT` | `5432` | Service port |
| `SNOWFLAKE_SANDBOX_TRINO_HOST` | `trino` | Trino host |
| `SNOWFLAKE_SANDBOX_TRINO_PORT` | `8080` | Trino port |
| `SNOWFLAKE_SANDBOX_LOG_LEVEL` | `INFO` | Logging level |

### Docker Compose

```yaml
snowflake-sandbox:
  build: ./snowflake-sandbox
  ports:
    - "5432:5432"
  environment:
    - SNOWFLAKE_SANDBOX_TRINO_HOST=trino
    - SNOWFLAKE_SANDBOX_LOG_LEVEL=DEBUG
  depends_on:
    - trino
```

## Monitoring & Health

### Health Endpoints

- `GET /health` - Basic health check
- `GET /api/v1/status` - Detailed service status
- `GET /metrics` - Prometheus metrics

### Metrics

The service exposes Prometheus metrics on `/metrics`:

- `snowflake_sandbox_queries_total` - Total queries processed
- `snowflake_sandbox_query_duration_seconds` - Query execution time
- `snowflake_sandbox_translations_total` - SQL translations performed
- `snowflake_sandbox_errors_total` - Error counts by type

### Logs

Structured JSON logging with the following fields:

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "INFO",
  "logger_name": "snowflake_sandbox",
  "message": "Query executed successfully",
  "query_id": "test-123",
  "duration": 0.245,
  "rows": 1542
}
```

## Testing

### Integration Tests

```bash
# Run all tests
make test

# Run core services tests only
make test-core

# Run Snowflake sandbox specific tests
python tests/integration/test_snowflake_sandbox.py

# Verbose testing
./tests/integration/run_tests.sh --verbose
```

### Test Coverage

- ✅ Service health and availability
- ✅ SQL translation accuracy
- ✅ API endpoint functionality
- ✅ Error handling
- ✅ Warehouse operations
- ✅ Metadata operations
- ✅ Integration with Trino

## Limitations

### Known Limitations

1. **Single Node**: Current implementation is single-node only
2. **Function Coverage**: ~70% of common Snowflake functions supported
3. **Time Travel**: Syntax parsing only, not functional
4. **Stored Procedures**: Not supported
5. **Complex Data Types**: Limited VARIANT operation support

### Performance Considerations

- Query performance depends on underlying Trino cluster
- Memory usage scales with concurrent query volume
- Recommended: 512MB-1GB RAM allocation
- CPU: 1-2 cores sufficient for most workloads

## Development

### Local Development

```bash
# Install dependencies
cd snowflake-sandbox
pip install -r requirements.txt

# Run in development mode
export SNOWFLAKE_SANDBOX_TRINO_HOST=localhost
export SNOWFLAKE_SANDBOX_LOG_LEVEL=DEBUG
python -m src.main
```

### Adding New Functions

1. Update `src/core/snowflake_translator.py`:

```python
def _build_function_mappings(self) -> Dict[str, str]:
    return {
        # Add your mapping here
        'NEW_SNOWFLAKE_FUNC': 'TRINO_EQUIVALENT',
    }
```

2. Add tests in `tests/integration/test_snowflake_sandbox.py`

3. Update documentation

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit a pull request

## API Reference

### Base URL
```
http://localhost:5432/api/v1
```

### Endpoints

#### POST /query
Execute SQL query with translation

**Request:**
```json
{
  "sql": "SELECT CURRENT_WAREHOUSE()",
  "request_id": "optional-uuid",
  "timeout_seconds": 300
}
```

**Response:**
```json
{
  "request_id": "uuid",
  "success": true,
  "data": [{"warehouse": "compute_wh"}],
  "columns": ["warehouse"],
  "row_count": 1,
  "execution_time_ms": 245,
  "original_sql": "SELECT CURRENT_WAREHOUSE()",
  "translated_sql": "SELECT 'compute_wh'",
  "transformations": ["Translated CURRENT_WAREHOUSE -> 'compute_wh'"],
  "warnings": []
}
```

#### GET /databases
List available databases

**Response:**
```json
[
  {"name": "iceberg", "type": "catalog"},
  {"name": "memory", "type": "catalog"}
]
```

#### POST /warehouse/use
Switch warehouse context

**Request:**
```json
{
  "warehouse": "analytics_wh"
}
```

**Response:**
```json
{
  "success": true,
  "warehouse": "analytics_wh",
  "context": {
    "warehouse": "analytics_wh",
    "database": "iceberg",
    "schema": "default"
  }
}
```

## Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check Docker logs
docker logs lakehouse-sandbox-snowflake-sandbox-1

# Check Trino connectivity
curl http://localhost:8080/v1/info
```

#### SQL Translation Errors
- Check function mapping in translator
- Review transformation warnings in response
- Verify Trino compatibility

#### Performance Issues
- Monitor Prometheus metrics
- Check Trino cluster resources
- Review query complexity

### Getting Help

1. Check the logs: `docker logs lakehouse-sandbox-snowflake-sandbox-1`
2. Verify health: `curl http://localhost:5432/health`
3. Run tests: `make test-core`
4. Check documentation: `http://localhost:5432/docs`

## ⚠️ Experimental Status

This is an **experimental implementation** for learning, development, and research purposes.

## License

This project is part of the Lakehouse Sandbox suite and follows the same licensing terms.