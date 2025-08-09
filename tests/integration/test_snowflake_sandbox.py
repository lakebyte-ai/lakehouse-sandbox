#!/usr/bin/env python3
"""
Snowflake Sandbox Specific Integration Tests
Tests the Snowflake to Trino translation service
"""

import json
import requests
import time
import sys
from datetime import datetime
from typing import List, Dict, Any

class SnowflakeSandboxTester:
    """Comprehensive tester for the Snowflake Sandbox service."""
    
    def __init__(self, base_url: str = "http://localhost:5432"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/v1"
        self.timeout = 30
        
    def test_health_check(self) -> Dict[str, Any]:
        """Test service health endpoint."""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=self.timeout)
            return {
                "test": "Health Check",
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "response": response.json() if response.status_code == 200 else response.text
            }
        except Exception as e:
            return {
                "test": "Health Check",
                "success": False,
                "error": str(e)
            }
    
    def test_service_status(self) -> Dict[str, Any]:
        """Test service status endpoint."""
        try:
            response = requests.get(f"{self.api_url}/status", timeout=self.timeout)
            return {
                "test": "Service Status",
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "response": response.json() if response.status_code == 200 else response.text
            }
        except Exception as e:
            return {
                "test": "Service Status",
                "success": False,
                "error": str(e)
            }
    
    def test_basic_sql_query(self) -> Dict[str, Any]:
        """Test basic SQL query execution."""
        query_data = {
            "sql": "SELECT 1 as test_column",
            "request_id": f"test-basic-{int(time.time())}"
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/query",
                json=query_data,
                timeout=self.timeout
            )
            
            result = {
                "test": "Basic SQL Query",
                "success": response.status_code == 200,
                "status_code": response.status_code
            }
            
            if response.status_code == 200:
                data = response.json()
                result["response"] = data
                result["sql_success"] = data.get("success", False)
                result["row_count"] = data.get("row_count", 0)
            else:
                result["response"] = response.text
            
            return result
            
        except Exception as e:
            return {
                "test": "Basic SQL Query",
                "success": False,
                "error": str(e)
            }
    
    def test_snowflake_functions(self) -> Dict[str, Any]:
        """Test Snowflake-specific function translations."""
        snowflake_sql = """
        SELECT 
            CURRENT_WAREHOUSE() as warehouse,
            CURRENT_DATABASE() as database,
            CURRENT_SCHEMA() as schema_name,
            CURRENT_USER as user_name
        """
        
        query_data = {
            "sql": snowflake_sql,
            "request_id": f"test-functions-{int(time.time())}"
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/query",
                json=query_data,
                timeout=self.timeout
            )
            
            result = {
                "test": "Snowflake Functions Translation",
                "success": response.status_code == 200,
                "status_code": response.status_code
            }
            
            if response.status_code == 200:
                data = response.json()
                result["response"] = data
                result["sql_success"] = data.get("success", False)
                result["original_sql"] = data.get("original_sql", "")
                result["translated_sql"] = data.get("translated_sql", "")
                result["transformations"] = data.get("transformations", [])
                result["warnings"] = data.get("warnings", [])
            else:
                result["response"] = response.text
            
            return result
            
        except Exception as e:
            return {
                "test": "Snowflake Functions Translation",
                "success": False,
                "error": str(e)
            }
    
    def test_date_functions(self) -> Dict[str, Any]:
        """Test date function translations."""
        snowflake_sql = """
        SELECT 
            CURRENT_DATE() as current_date,
            CURRENT_TIMESTAMP() as current_timestamp,
            DATE_PART('year', CURRENT_DATE()) as current_year
        """
        
        query_data = {
            "sql": snowflake_sql,
            "request_id": f"test-dates-{int(time.time())}"
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/query",
                json=query_data,
                timeout=self.timeout
            )
            
            result = {
                "test": "Date Functions Translation",
                "success": response.status_code == 200,
                "status_code": response.status_code
            }
            
            if response.status_code == 200:
                data = response.json()
                result["response"] = data
                result["sql_success"] = data.get("success", False)
                result["transformations"] = data.get("transformations", [])
            else:
                result["response"] = response.text
            
            return result
            
        except Exception as e:
            return {
                "test": "Date Functions Translation",
                "success": False,
                "error": str(e)
            }
    
    def test_warehouse_operations(self) -> Dict[str, Any]:
        """Test warehouse-related operations."""
        try:
            # Test getting current warehouse
            response1 = requests.get(f"{self.api_url}/warehouse/current", timeout=self.timeout)
            
            # Test switching warehouse
            response2 = requests.post(
                f"{self.api_url}/warehouse/use",
                json={"warehouse": "analytics_wh"},
                timeout=self.timeout
            )
            
            result = {
                "test": "Warehouse Operations",
                "success": response1.status_code == 200 and response2.status_code == 200,
                "current_warehouse_status": response1.status_code,
                "use_warehouse_status": response2.status_code
            }
            
            if response1.status_code == 200:
                result["current_warehouse"] = response1.json()
            
            if response2.status_code == 200:
                result["use_warehouse"] = response2.json()
            
            return result
            
        except Exception as e:
            return {
                "test": "Warehouse Operations",
                "success": False,
                "error": str(e)
            }
    
    def test_metadata_operations(self) -> Dict[str, Any]:
        """Test metadata listing operations."""
        try:
            # Test listing databases
            response1 = requests.get(f"{self.api_url}/databases", timeout=self.timeout)
            
            result = {
                "test": "Metadata Operations",
                "success": response1.status_code == 200,
                "databases_status": response1.status_code
            }
            
            if response1.status_code == 200:
                databases = response1.json()
                result["databases"] = databases
                result["database_count"] = len(databases)
                
                # Test listing schemas for the first database
                if databases:
                    db_name = databases[0]["name"]
                    response2 = requests.get(
                        f"{self.api_url}/databases/{db_name}/schemas",
                        timeout=self.timeout
                    )
                    result["schemas_status"] = response2.status_code
                    
                    if response2.status_code == 200:
                        schemas = response2.json()
                        result["schemas"] = schemas
                        result["schema_count"] = len(schemas)
            
            return result
            
        except Exception as e:
            return {
                "test": "Metadata Operations",
                "success": False,
                "error": str(e)
            }
    
    def test_error_handling(self) -> Dict[str, Any]:
        """Test error handling with invalid SQL."""
        query_data = {
            "sql": "SELECT * FROM non_existent_table_12345",
            "request_id": f"test-error-{int(time.time())}"
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/query",
                json=query_data,
                timeout=self.timeout
            )
            
            result = {
                "test": "Error Handling",
                "success": response.status_code == 200,  # Should return 200 with error in response
                "status_code": response.status_code
            }
            
            if response.status_code == 200:
                data = response.json()
                result["response"] = data
                result["handled_error"] = not data.get("success", True)  # Should be false for error
            else:
                result["response"] = response.text
            
            return result
            
        except Exception as e:
            return {
                "test": "Error Handling",
                "success": False,
                "error": str(e)
            }
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all Snowflake Sandbox tests."""
        print("🧪 Running Snowflake Sandbox Integration Tests")
        print("=" * 50)
        
        tests = [
            self.test_health_check,
            self.test_service_status,
            self.test_basic_sql_query,
            self.test_snowflake_functions,
            self.test_date_functions,
            self.test_warehouse_operations,
            self.test_metadata_operations,
            self.test_error_handling
        ]
        
        results = []
        passed = 0
        failed = 0
        
        for test_func in tests:
            print(f"Running {test_func.__name__}...", end=" ")
            result = test_func()
            results.append(result)
            
            if result["success"]:
                print("✅ PASS")
                passed += 1
            else:
                print("❌ FAIL")
                failed += 1
                if "error" in result:
                    print(f"   Error: {result['error']}")
        
        # Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {passed}/{len(tests)} passed")
        
        if failed == 0:
            print("🎉 All Snowflake Sandbox tests passed!")
        else:
            print(f"❌ {failed} test(s) failed")
        
        return {
            "timestamp": datetime.now().isoformat(),
            "service": "snowflake-sandbox",
            "summary": {
                "total": len(tests),
                "passed": passed,
                "failed": failed
            },
            "tests": results
        }


def main():
    """Main test runner."""
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        base_url = "http://localhost:5432"
    
    tester = SnowflakeSandboxTester(base_url)
    
    try:
        report = tester.run_all_tests()
        
        # Save detailed report
        report_file = f"snowflake_sandbox_test_report_{int(time.time())}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n📄 Detailed report saved to: {report_file}")
        
        # Exit with error code if tests failed
        if report["summary"]["failed"] > 0:
            sys.exit(1)
        else:
            sys.exit(0)
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Test runner failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()