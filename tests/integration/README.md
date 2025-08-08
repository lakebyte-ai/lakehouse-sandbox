# Lakehouse Sandbox Integration Testing

Comprehensive integration testing tool for verifying all services and their interactions in the Lakehouse Sandbox environment.

## 🧪 Features

- **Comprehensive Service Testing**: Tests all core services, Kafka cluster, Airflow orchestration, and service integrations
- **Parallel Execution**: Tests run concurrently for faster completion
- **Detailed Reporting**: JSON reports with test results, timing, and diagnostic information
- **Flexible Execution**: Run all tests or specific service groups
- **Multiple Interfaces**: Command line, Make targets, and WebUI API integration
- **Real-time Feedback**: Colored output with progress indicators

## 🚀 Quick Start

### Prerequisites

- Python 3.7+ with `requests` library
- All Lakehouse Sandbox services running
- Docker and Docker Compose available

### Basic Usage

```bash
# Run all integration tests
make test

# Run with verbose output
make test-verbose

# Run specific service groups
make test-core        # Core services only
make test-kafka       # Kafka cluster only
make test-airflow     # Airflow services only
make test-integrations # Service integrations only

# Generate detailed JSON report
make test-report
```

## 🔧 Advanced Usage

### Direct Script Execution

```bash
# Run all tests
./tests/integration/run_tests.sh

# Run with custom options
./tests/integration/run_tests.sh --verbose --groups core kafka --timeout 60

# Python test runner directly
python3 tests/integration/test_runner.py --help
```

### Command Line Options

- `--verbose, -v`: Detailed output for each test
- `--timeout, -t`: Timeout in seconds (default: 30)
- `--output, -o`: Save JSON report to file
- `--groups`: Test specific groups (core, kafka, airflow, integrations)

## 📊 Test Categories

### Core Services
- **Polaris Catalog**: API connectivity and authentication
- **Trino Query Engine**: REST API and catalog integration
- **MinIO**: Console and S3 API endpoints
- **Spark Jupyter**: Notebook API availability
- **Nimtable**: Web UI accessibility

### Kafka Cluster
- **Kafka UI**: Management interface functionality  
- **Kafka Brokers**: All 3 brokers in KRaft mode
- **Topic Operations**: Creation, listing, and management
- **Inter-broker Communication**: Cluster health verification

### Airflow Services
- **Web UI**: Health checks and API access
- **Scheduler**: Service health verification
- **Worker**: Celery worker status
- **PostgreSQL**: Database connectivity
- **Redis**: Message broker functionality

### Service Integrations
- **Docker Network**: Container connectivity verification
- **WebUI Backend**: Management API functionality
- **Container Count**: Expected service count validation

## 📈 Understanding Test Results

### Status Types
- **✅ PASS**: Test completed successfully
- **❌ FAIL**: Test failed - requires attention
- **⚠️ WARN**: Test has warnings but not critical
- **⏭️ SKIP**: Test was skipped

### Interpreting Output

```bash
🔸 Core Services (5/7 passed)
  ✅ Polaris Catalog API: HTTP 401 (auth required - expected) (0.12s)
  ✅ Trino Query Engine: HTTP 200 (0.08s)
  ❌ MinIO Console: Request failed: Connection refused (0.01s)
```

- **Service Group**: Shows passed/total count
- **Individual Tests**: Status, message, and duration
- **Overall Summary**: Total counts and final status

## 🔗 Integration Points

### Makefile Integration
The testing tool is fully integrated with the project Makefile:

```makefile
test: ## Run comprehensive integration tests
test-verbose: ## Run integration tests with verbose output
test-core: ## Test only core services
test-kafka: ## Test only Kafka cluster services  
test-airflow: ## Test only Airflow services
test-integrations: ## Test service integrations and networking
test-report: ## Run tests and generate JSON report
```

### WebUI API Integration
Tests can be triggered via the WebUI backend API:

```bash
# Run tests via API
curl -X POST http://localhost:5001/api/test/run \
  -H "Content-Type: application/json" \
  -d '{"groups": ["core", "kafka"], "verbose": true}'

# Get test reports
curl http://localhost:5001/api/test/reports
```

## 📁 File Structure

```
tests/integration/
├── test_runner.py      # Main Python test runner
├── run_tests.sh        # Shell wrapper script
├── requirements.txt    # Python dependencies
└── README.md          # This documentation
```

## 🛠️ Extending Tests

### Adding New Test Groups

1. Add service configuration to `services` dictionary in `test_runner.py`
2. Create new test method (e.g., `test_new_service_group()`)
3. Add to main test execution in `run_all_tests()`

### Adding Individual Tests

```python
def test_new_service(self) -> ServiceGroup:
    tests = []
    
    # HTTP endpoint test
    test = self.http_test(
        "Service Name",
        "http://localhost:PORT/path"
    )
    tests.append(test)
    
    # Docker command test
    docker_test = self.docker_test(
        "Service Command",
        "container-name",
        ["command", "args"]
    )
    tests.append(docker_test)
    
    return ServiceGroup(name="New Service", tests=tests)
```

## 🐛 Troubleshooting

### Common Issues

1. **Connection Refused**: Service not running or wrong port
2. **Timeout Errors**: Increase timeout with `--timeout` option
3. **Python Dependencies**: Install with `pip install -r requirements.txt`
4. **Permission Denied**: Make scripts executable with `chmod +x`

### Debugging Tips

```bash
# Check service status first
make status

# Run with verbose output to see detailed errors
make test-verbose

# Test specific failing group
make test-core  # or test-kafka, test-airflow

# Check Docker containers
docker ps
docker logs <container-name>
```

## 📋 Test Report Format

JSON reports contain:

```json
{
  "timestamp": "2025-08-08T19:20:40.910Z",
  "overall_status": "PASS|FAIL",
  "summary": {
    "total_tests": 21,
    "passed": 18,
    "failed": 3,
    "warnings": 0,
    "skipped": 0,
    "duration": 5.44
  },
  "groups": [
    {
      "name": "Core Services",
      "tests": [...],
      "passed": 5,
      "failed": 2,
      "total": 7,
      "duration": 2.1
    }
  ]
}
```

## 🎯 Best Practices

1. **Run Before Deployments**: Ensure all services are healthy
2. **Regular Health Checks**: Use in CI/CD pipelines  
3. **Monitor Trends**: Track test duration and failure patterns
4. **Investigate Warnings**: Address warnings before they become failures
5. **Keep Tests Fast**: Most tests should complete under 30 seconds

## 🤝 Contributing

To add new tests or improve existing ones:

1. Follow the existing pattern for test methods
2. Add appropriate error handling and timeouts
3. Include descriptive test names and messages
4. Update this README with new test categories
5. Test your changes across all service groups

---

**🎉 Happy Testing!** The integration testing tool helps ensure your Lakehouse Sandbox is always ready for production workloads.