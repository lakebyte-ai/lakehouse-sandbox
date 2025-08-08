#!/usr/bin/env python3
"""
Lakehouse Sandbox Integration Test Runner
Comprehensive testing tool for all services and integrations
"""

import json
import sys
import time
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import subprocess
import requests
import urllib3
import concurrent.futures
from threading import Lock

# Suppress SSL warnings for testing
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class TestStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL" 
    SKIP = "SKIP"
    WARN = "WARN"

@dataclass
class TestResult:
    name: str
    status: TestStatus
    message: str
    duration: float
    details: Optional[Dict[str, Any]] = None
    timestamp: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()

@dataclass
class ServiceGroup:
    name: str
    tests: List[TestResult]
    total: int = 0
    passed: int = 0
    failed: int = 0
    warnings: int = 0
    skipped: int = 0
    duration: float = 0.0
    
    def __post_init__(self):
        self.total = len(self.tests)
        self.passed = sum(1 for t in self.tests if t.status == TestStatus.PASS)
        self.failed = sum(1 for t in self.tests if t.status == TestStatus.FAIL)
        self.warnings = sum(1 for t in self.tests if t.status == TestStatus.WARN)
        self.skipped = sum(1 for t in self.tests if t.status == TestStatus.SKIP)
        self.duration = sum(t.duration for t in self.tests)

class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

class IntegrationTestRunner:
    def __init__(self, verbose: bool = False, timeout: int = 30):
        self.verbose = verbose
        self.timeout = timeout
        self.results: List[ServiceGroup] = []
        self.print_lock = Lock()
        
        # Service configurations
        self.services = {
            'core': {
                'polaris': {'port': 8181, 'path': '/api/catalog/v1/config', 'auth_required': True},
                'trino': {'port': 8080, 'path': '/v1/info', 'auth_required': False},
                'minio_console': {'port': 9001, 'path': '/api/v1/login', 'auth_required': False},
                'minio_api': {'port': 9000, 'path': '/minio/health/live', 'auth_required': False},
                'spark': {'port': 8888, 'path': '/api', 'auth_required': False},
                'nimtable': {'port': 13000, 'path': '/health', 'auth_required': False, 'allow_redirect': True}
            },
            'kafka': {
                'kafka_ui': {'port': 8091, 'path': '/api/clusters', 'auth_required': False}
            },
            'airflow': {
                'webserver': {'port': 8090, 'path': '/health', 'auth_required': False},
                'api': {'port': 8090, 'path': '/api/v1/dags', 'auth': ('admin', 'admin')}
            }
        }
        
        # Docker containers mapping
        self.containers = {
            'polaris': 'lakehouse-sandbox-polaris-1',
            'trino': 'lakehouse-sandbox-trino-1', 
            'minio': 'lakehouse-sandbox-minio-1',
            'spark': 'spark-iceberg',
            'nimtable': 'lakehouse-sandbox-nimtable-database-1',
            'kafka1': 'kafka1',
            'kafka2': 'kafka2',
            'kafka3': 'kafka3',
            'kafka_ui': 'kafka-ui',
            'airflow_web': 'lakehouse-sandbox-airflow-webserver-1',
            'airflow_scheduler': 'lakehouse-sandbox-airflow-scheduler-1',
            'airflow_worker': 'lakehouse-sandbox-airflow-worker-1',
            'airflow_postgres': 'lakehouse-sandbox-airflow-postgres-1',
            'airflow_redis': 'lakehouse-sandbox-airflow-redis-1'
        }

    def log(self, message: str, color: str = Colors.WHITE):
        """Thread-safe logging with colors"""
        with self.print_lock:
            print(f"{color}{message}{Colors.END}")

    def run_command(self, cmd: List[str], capture_output: bool = True) -> tuple:
        """Run shell command and return (success, output, error)"""
        try:
            result = subprocess.run(
                cmd, 
                capture_output=capture_output, 
                text=True, 
                timeout=self.timeout
            )
            return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
        except subprocess.TimeoutExpired:
            return False, "", f"Command timed out after {self.timeout}s"
        except Exception as e:
            return False, "", str(e)

    def http_test(self, name: str, url: str, auth: tuple = None, expected_codes: List[int] = None) -> TestResult:
        """Perform HTTP test"""
        if expected_codes is None:
            expected_codes = [200]
            
        start_time = time.time()
        
        try:
            kwargs = {
                'timeout': self.timeout,
                'verify': False,
                'allow_redirects': False
            }
            
            if auth:
                kwargs['auth'] = auth
                
            response = requests.get(url, **kwargs)
            duration = time.time() - start_time
            
            if response.status_code in expected_codes:
                return TestResult(
                    name=name,
                    status=TestStatus.PASS,
                    message=f"HTTP {response.status_code}",
                    duration=duration,
                    details={'url': url, 'status_code': response.status_code}
                )
            elif response.status_code in [301, 302, 307, 308]:
                return TestResult(
                    name=name,
                    status=TestStatus.WARN,
                    message=f"HTTP {response.status_code} (redirect)",
                    duration=duration,
                    details={'url': url, 'status_code': response.status_code}
                )
            elif response.status_code == 401:
                return TestResult(
                    name=name,
                    status=TestStatus.PASS,
                    message="HTTP 401 (auth required - expected)",
                    duration=duration,
                    details={'url': url, 'status_code': response.status_code}
                )
            else:
                return TestResult(
                    name=name,
                    status=TestStatus.FAIL,
                    message=f"HTTP {response.status_code}",
                    duration=duration,
                    details={'url': url, 'status_code': response.status_code}
                )
                
        except requests.exceptions.RequestException as e:
            duration = time.time() - start_time
            return TestResult(
                name=name,
                status=TestStatus.FAIL,
                message=f"Request failed: {str(e)}",
                duration=duration,
                details={'url': url, 'error': str(e)}
            )

    def docker_test(self, name: str, container: str, command: List[str]) -> TestResult:
        """Run command in Docker container"""
        start_time = time.time()
        
        full_cmd = ['docker', 'exec', container] + command
        success, output, error = self.run_command(full_cmd)
        duration = time.time() - start_time
        
        if success:
            return TestResult(
                name=name,
                status=TestStatus.PASS,
                message="Command executed successfully",
                duration=duration,
                details={'container': container, 'output': output[:200]}
            )
        else:
            return TestResult(
                name=name,
                status=TestStatus.FAIL,
                message=f"Command failed: {error}",
                duration=duration,
                details={'container': container, 'error': error}
            )

    def test_core_services(self) -> ServiceGroup:
        """Test all core services"""
        tests = []
        
        # HTTP endpoint tests
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            futures = []
            
            # Polaris Catalog
            futures.append(executor.submit(
                self.http_test,
                "Polaris Catalog API",
                "http://localhost:8181/api/catalog/v1/config"
            ))
            
            # Trino Query Engine
            futures.append(executor.submit(
                self.http_test,
                "Trino Query Engine",
                "http://localhost:8080/v1/info"
            ))
            
            # MinIO Console
            futures.append(executor.submit(
                self.http_test,
                "MinIO Console",
                "http://localhost:9001/api/v1/login"
            ))
            
            # MinIO API
            futures.append(executor.submit(
                self.http_test,
                "MinIO API Health",
                "http://localhost:9000/minio/health/live"
            ))
            
            # Spark Jupyter
            futures.append(executor.submit(
                self.http_test,
                "Spark Jupyter API",
                "http://localhost:8888/api"
            ))
            
            # Nimtable
            futures.append(executor.submit(
                self.http_test,
                "Nimtable UI",
                "http://localhost:13000/health",
                expected_codes=[200, 307]  # Allow redirects
            ))
            
            for future in concurrent.futures.as_completed(futures):
                tests.append(future.result())
        
        # Trino catalog test
        trino_test = self.docker_test(
            "Trino Catalogs",
            self.containers['trino'],
            ['trino', '--server', 'localhost:8080', '--execute', 'SHOW CATALOGS']
        )
        tests.append(trino_test)
        
        return ServiceGroup(name="Core Services", tests=tests)

    def test_kafka_cluster(self) -> ServiceGroup:
        """Test Kafka cluster"""
        tests = []
        
        # Kafka UI test
        ui_test = self.http_test(
            "Kafka UI API",
            "http://localhost:8091/api/clusters"
        )
        tests.append(ui_test)
        
        # Test each Kafka broker
        for i in range(1, 4):
            broker_test = self.docker_test(
                f"Kafka Broker {i} API",
                f"kafka{i}",
                ['/opt/kafka/bin/kafka-broker-api-versions.sh', '--bootstrap-server', 'localhost:29092']
            )
            tests.append(broker_test)
        
        # Test topic operations
        topic_create_test = self.docker_test(
            "Kafka Topic Creation",
            "kafka1",
            ['/opt/kafka/bin/kafka-topics.sh', '--bootstrap-server', 'localhost:29092', 
             '--create', '--topic', 'integration-test-topic', '--partitions', '3', 
             '--replication-factor', '2', '--if-not-exists']
        )
        tests.append(topic_create_test)
        
        # Test topic listing
        topic_list_test = self.docker_test(
            "Kafka Topic Listing",
            "kafka1",
            ['/opt/kafka/bin/kafka-topics.sh', '--bootstrap-server', 'localhost:29092', '--list']
        )
        tests.append(topic_list_test)
        
        return ServiceGroup(name="Kafka Cluster", tests=tests)

    def test_airflow_services(self) -> ServiceGroup:
        """Test Airflow services"""
        tests = []
        
        # Airflow web UI health
        web_test = self.http_test(
            "Airflow Web UI Health",
            "http://localhost:8090/health"
        )
        tests.append(web_test)
        
        # Airflow API with auth
        api_test = self.http_test(
            "Airflow API",
            "http://localhost:8090/api/v1/dags",
            auth=('admin', 'admin')
        )
        tests.append(api_test)
        
        # PostgreSQL health
        pg_test = self.docker_test(
            "Airflow PostgreSQL",
            self.containers['airflow_postgres'],
            ['pg_isready', '-U', 'airflow']
        )
        tests.append(pg_test)
        
        # Redis health
        redis_test = self.docker_test(
            "Airflow Redis",
            self.containers['airflow_redis'],
            ['redis-cli', 'ping']
        )
        tests.append(redis_test)
        
        # Test Airflow worker
        worker_test = self.docker_test(
            "Airflow Worker Status",
            self.containers['airflow_worker'],
            ['airflow', 'celery', 'inspect', 'stats']
        )
        tests.append(worker_test)
        
        return ServiceGroup(name="Airflow Services", tests=tests)

    def test_service_integrations(self) -> ServiceGroup:
        """Test service integrations and networking"""
        tests = []
        
        # Docker network test
        start_time = time.time()
        success, output, error = self.run_command([
            'docker', 'network', 'inspect', 'local-iceberg-lakehouse'
        ])
        duration = time.time() - start_time
        
        if success:
            try:
                network_info = json.loads(output)
                container_count = len(network_info[0].get('Containers', {}))
                tests.append(TestResult(
                    name="Docker Network",
                    status=TestStatus.PASS,
                    message=f"Network healthy with {container_count} containers",
                    duration=duration,
                    details={'container_count': container_count}
                ))
            except:
                tests.append(TestResult(
                    name="Docker Network",
                    status=TestStatus.WARN,
                    message="Network exists but info parsing failed",
                    duration=duration
                ))
        else:
            tests.append(TestResult(
                name="Docker Network",
                status=TestStatus.FAIL,
                message=f"Network inspection failed: {error}",
                duration=duration
            ))
        
        # WebUI API test
        webui_test = self.http_test(
            "WebUI Backend API",
            "http://localhost:5001/api/status"
        )
        tests.append(webui_test)
        
        # Container count verification
        start_time = time.time()
        success, output, error = self.run_command([
            'docker', 'ps', '--filter', 'network=local-iceberg-lakehouse', '--format', 'json'
        ])
        duration = time.time() - start_time
        
        if success:
            try:
                running_containers = len([line for line in output.split('\n') if line.strip()])
                if running_containers >= 14:  # Expected minimum
                    tests.append(TestResult(
                        name="Container Count",
                        status=TestStatus.PASS,
                        message=f"{running_containers} containers running",
                        duration=duration,
                        details={'running_containers': running_containers}
                    ))
                else:
                    tests.append(TestResult(
                        name="Container Count",
                        status=TestStatus.WARN,
                        message=f"Only {running_containers} containers running (expected >=14)",
                        duration=duration,
                        details={'running_containers': running_containers}
                    ))
            except:
                tests.append(TestResult(
                    name="Container Count",
                    status=TestStatus.FAIL,
                    message="Failed to count containers",
                    duration=duration
                ))
        
        return ServiceGroup(name="Service Integrations", tests=tests)

    def run_all_tests(self, selected_groups: List[str] = None) -> Dict[str, Any]:
        """Run integration tests for selected groups or all if none specified"""
        start_time = time.time()
        
        self.log("🧪 Starting Lakehouse Sandbox Integration Tests", Colors.BOLD + Colors.CYAN)
        self.log("=" * 60, Colors.CYAN)
        
        # Define all available test suites
        all_suites = {
            'core': self.test_core_services,
            'kafka': self.test_kafka_cluster,
            'airflow': self.test_airflow_services,
            'integrations': self.test_service_integrations
        }
        
        # Filter to selected groups or run all
        if selected_groups:
            suites_to_run = {name: func for name, func in all_suites.items() if name in selected_groups}
            if not suites_to_run:
                self.log(f"❌ No valid groups found in: {selected_groups}", Colors.RED)
                self.log(f"Available groups: {list(all_suites.keys())}", Colors.YELLOW)
                return self.generate_report(0)
        else:
            suites_to_run = all_suites
        
        self.log(f"🎯 Running tests for groups: {list(suites_to_run.keys())}", Colors.CYAN)
        self.log("=" * 60, Colors.CYAN)
        
        # Run selected test suites
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(suites_to_run))) as executor:
            futures = {name: executor.submit(func) for name, func in suites_to_run.items()}
            
            for name, future in futures.items():
                self.log(f"📋 Running {name} tests...", Colors.BLUE)
                result = future.result()
                self.results.append(result)
                
                # Print immediate results
                if result.failed > 0:
                    self.log(f"❌ {name}: {result.passed}/{result.total} passed, {result.failed} failed", Colors.RED)
                else:
                    self.log(f"✅ {name}: {result.passed}/{result.total} passed", Colors.GREEN)
        
        total_duration = time.time() - start_time
        
        # Generate final report
        return self.generate_report(total_duration)

    def generate_report(self, total_duration: float) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        total_tests = sum(group.total for group in self.results)
        total_passed = sum(group.passed for group in self.results)
        total_failed = sum(group.failed for group in self.results)
        total_warnings = sum(group.warnings for group in self.results)
        total_skipped = sum(group.skipped for group in self.results)
        
        # Print summary
        self.log("\n" + "=" * 60, Colors.CYAN)
        self.log("📊 INTEGRATION TEST SUMMARY", Colors.BOLD + Colors.CYAN)
        self.log("=" * 60, Colors.CYAN)
        
        # Overall status
        if total_failed == 0:
            status_color = Colors.GREEN
            status_icon = "✅"
            overall_status = "PASS"
        else:
            status_color = Colors.RED
            status_icon = "❌"
            overall_status = "FAIL"
            
        self.log(f"{status_icon} Overall Status: {overall_status}", Colors.BOLD + status_color)
        self.log(f"📈 Tests: {total_passed}/{total_tests} passed", Colors.GREEN if total_failed == 0 else Colors.YELLOW)
        
        if total_failed > 0:
            self.log(f"❌ Failed: {total_failed}", Colors.RED)
        if total_warnings > 0:
            self.log(f"⚠️  Warnings: {total_warnings}", Colors.YELLOW)
        if total_skipped > 0:
            self.log(f"⏭️  Skipped: {total_skipped}", Colors.BLUE)
            
        self.log(f"⏱️  Duration: {total_duration:.2f}s", Colors.WHITE)
        
        # Detailed results
        self.log("\n📋 DETAILED RESULTS:", Colors.BOLD + Colors.WHITE)
        
        for group in self.results:
            group_color = Colors.GREEN if group.failed == 0 else Colors.RED
            self.log(f"\n🔸 {group.name} ({group.passed}/{group.total} passed)", Colors.BOLD + group_color)
            
            if self.verbose:
                for test in group.tests:
                    if test.status == TestStatus.PASS:
                        icon, color = "✅", Colors.GREEN
                    elif test.status == TestStatus.FAIL:
                        icon, color = "❌", Colors.RED
                    elif test.status == TestStatus.WARN:
                        icon, color = "⚠️", Colors.YELLOW
                    else:
                        icon, color = "⏭️", Colors.BLUE
                    
                    self.log(f"  {icon} {test.name}: {test.message} ({test.duration:.2f}s)", color)
        
        # Generate JSON report with enum conversion
        def convert_enums(obj):
            """Convert enums to their values for JSON serialization"""
            if isinstance(obj, dict):
                return {k: convert_enums(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_enums(item) for item in obj]
            elif isinstance(obj, TestStatus):
                return obj.value
            else:
                return obj
        
        report_data = {
            'timestamp': datetime.now().isoformat(),
            'overall_status': overall_status,
            'summary': {
                'total_tests': total_tests,
                'passed': total_passed,
                'failed': total_failed,
                'warnings': total_warnings,
                'skipped': total_skipped,
                'duration': total_duration
            },
            'groups': convert_enums([asdict(group) for group in self.results])
        }
        
        return report_data

def main():
    parser = argparse.ArgumentParser(description='Lakehouse Sandbox Integration Test Runner')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    parser.add_argument('-t', '--timeout', type=int, default=30, help='Timeout for tests (seconds)')
    parser.add_argument('-o', '--output', help='Output JSON report to file')
    parser.add_argument('--groups', nargs='+', choices=['core', 'kafka', 'airflow', 'integrations'], 
                       help='Run specific test groups only')
    
    args = parser.parse_args()
    
    runner = IntegrationTestRunner(verbose=args.verbose, timeout=args.timeout)
    
    try:
        report = runner.run_all_tests(args.groups)
        
        # Save report if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(report, f, indent=2)
            runner.log(f"\n📄 Report saved to: {args.output}", Colors.CYAN)
        
        # Exit with error code if tests failed
        if report['summary']['failed'] > 0:
            sys.exit(1)
        else:
            runner.log(f"\n🎉 All tests passed! Lakehouse Sandbox is fully operational.", Colors.BOLD + Colors.GREEN)
            sys.exit(0)
            
    except KeyboardInterrupt:
        runner.log("\n⚠️ Tests interrupted by user", Colors.YELLOW)
        sys.exit(130)
    except Exception as e:
        runner.log(f"\n❌ Test runner failed: {str(e)}", Colors.RED)
        sys.exit(1)

if __name__ == "__main__":
    main()