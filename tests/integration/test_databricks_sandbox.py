#!/usr/bin/env python3
"""
Databricks Sandbox Specific Integration Tests
Tests the Databricks SQL API service with Spark integration
"""

import json
import requests
import time
import sys
from datetime import datetime
from typing import List, Dict, Any

class DatabricksSandboxTester:
    """Comprehensive tester for the Databricks Sandbox service."""
    
    def __init__(self, base_url: str = "http://localhost:5434"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/2.0"
        self.timeout = 60  # Longer timeout for Spark operations
        
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
    
    def test_root_endpoint(self) -> Dict[str, Any]:
        """Test root API endpoint."""
        try:
            response = requests.get(f"{self.base_url}/", timeout=self.timeout)
            return {
                "test": "Root Endpoint",
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "response": response.json() if response.status_code == 200 else response.text
            }
        except Exception as e:
            return {
                "test": "Root Endpoint",
                "success": False,
                "error": str(e)
            }
    
    def test_basic_sql_statement(self) -> Dict[str, Any]:
        """Test basic SQL statement execution."""
        statement_data = {
            "statement": "SELECT 1 as test_column",
            "warehouse_id": "lakehouse_sql_warehouse"
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/sql/statements",
                json=statement_data,
                timeout=self.timeout
            )
            
            result = {
                "test": "Basic SQL Statement",
                "success": response.status_code == 200,
                "status_code": response.status_code
            }
            
            if response.status_code == 200:
                data = response.json()
                result["response"] = data
                result["statement_id"] = data.get("statement_id")
                result["status"] = data.get("status", {})
                result["sql_success"] = data.get("status", {}).get("state") == "SUCCEEDED"
                
                # Check result data if available
                if "result" in data and data["result"]:
                    result["row_count"] = data["result"].get("row_count", 0)
                    result["has_data"] = bool(data["result"].get("data_array", []))
            else:
                result["response"] = response.text
            
            return result
            
        except Exception as e:
            return {
                "test": "Basic SQL Statement",
                "success": False,
                "error": str(e)
            }
    
    def test_sql_statement_lifecycle(self) -> Dict[str, Any]:
        """Test complete SQL statement lifecycle (create, get, cancel)."""
        statement_data = {
            "statement": "SELECT current_catalog(), current_database(), 42 as magic_number",
            "warehouse_id": "lakehouse_sql_warehouse"
        }
        
        try:
            # Step 1: Execute statement
            response1 = requests.post(
                f"{self.api_url}/sql/statements",
                json=statement_data,
                timeout=self.timeout
            )
            
            result = {
                "test": "SQL Statement Lifecycle",
                "success": False,
                "execute_status": response1.status_code
            }
            
            if response1.status_code != 200:
                result["execute_error"] = response1.text
                return result
            
            data1 = response1.json()
            statement_id = data1.get("statement_id")
            
            if not statement_id:
                result["error"] = "No statement_id returned"
                return result
            
            result["statement_id"] = statement_id
            result["initial_response"] = data1
            
            # Step 2: Get statement result
            response2 = requests.get(
                f"{self.api_url}/sql/statements/{statement_id}",
                timeout=self.timeout
            )
            
            result["get_status"] = response2.status_code
            
            if response2.status_code == 200:
                data2 = response2.json()
                result["get_response"] = data2
                result["final_state"] = data2.get("status", {}).get("state")
                result["success"] = data2.get("status", {}).get("state") == "SUCCEEDED"
                
                # Check result data
                if "result" in data2 and data2["result"]:
                    result["columns"] = data2["result"].get("schema", {}).get("columns", [])
                    result["data"] = data2["result"].get("data_array", [])
            else:
                result["get_error"] = response2.text
            
            return result
            
        except Exception as e:
            return {
                "test": "SQL Statement Lifecycle",
                "success": False,
                "error": str(e)
            }
    
    def test_spark_catalog_operations(self) -> Dict[str, Any]:
        """Test Spark catalog operations (SHOW commands)."""
        test_statements = [
            "SHOW CATALOGS",
            "SHOW SCHEMAS",
            "SHOW TABLES"
        ]
        
        results = {}
        overall_success = True
        
        for sql in test_statements:
            try:
                statement_data = {
                    "statement": sql,
                    "warehouse_id": "lakehouse_sql_warehouse"
                }
                
                response = requests.post(
                    f"{self.api_url}/sql/statements",
                    json=statement_data,
                    timeout=self.timeout
                )
                
                if response.status_code == 200:
                    data = response.json()
                    state = data.get("status", {}).get("state")
                    success = state == "SUCCEEDED"
                    
                    results[sql] = {
                        "success": success,
                        "state": state,
                        "statement_id": data.get("statement_id")
                    }
                    
                    if success and "result" in data and data["result"]:
                        results[sql]["row_count"] = data["result"].get("row_count", 0)
                        results[sql]["columns"] = len(data["result"].get("schema", {}).get("columns", []))
                else:
                    results[sql] = {
                        "success": False,
                        "error": response.text
                    }
                    overall_success = False
                    
            except Exception as e:
                results[sql] = {
                    "success": False,
                    "error": str(e)
                }
                overall_success = False
        
        return {
            "test": "Spark Catalog Operations",
            "success": overall_success,
            "results": results
        }
    
    def test_warehouse_operations(self) -> Dict[str, Any]:
        """Test warehouse-related API endpoints."""
        try:
            # Test listing warehouses
            response1 = requests.get(f"{self.api_url}/sql/warehouses", timeout=self.timeout)
            
            result = {
                "test": "Warehouse Operations",
                "success": response1.status_code == 200,
                "list_status": response1.status_code
            }
            
            if response1.status_code == 200:
                warehouses = response1.json()
                result["warehouses"] = warehouses
                result["warehouse_count"] = len(warehouses)
                
                # Test getting specific warehouse info
                if warehouses:
                    warehouse_id = warehouses[0].get("id", "lakehouse_sql_warehouse")
                    response2 = requests.get(
                        f"{self.api_url}/sql/warehouses/{warehouse_id}",
                        timeout=self.timeout
                    )
                    
                    result["get_warehouse_status"] = response2.status_code
                    if response2.status_code == 200:
                        result["warehouse_info"] = response2.json()
                    else:
                        result["get_warehouse_error"] = response2.text
            else:
                result["list_error"] = response1.text
            
            return result
            
        except Exception as e:
            return {
                "test": "Warehouse Operations",
                "success": False,
                "error": str(e)
            }
    
    def test_unity_catalog_endpoints(self) -> Dict[str, Any]:
        """Test Unity Catalog API endpoints."""
        try:
            # Test listing catalogs
            response1 = requests.get(f"{self.api_url}/unity-catalog/catalogs", timeout=self.timeout)
            
            result = {
                "test": "Unity Catalog Endpoints",
                "success": response1.status_code == 200,
                "catalogs_status": response1.status_code
            }
            
            if response1.status_code == 200:
                data = response1.json()
                result["catalogs"] = data
                
                catalogs = data.get("catalogs", [])
                if catalogs:
                    catalog_name = catalogs[0].get("name", "iceberg")
                    
                    # Test listing schemas
                    response2 = requests.get(
                        f"{self.api_url}/unity-catalog/catalogs/{catalog_name}/schemas",
                        timeout=self.timeout
                    )
                    
                    result["schemas_status"] = response2.status_code
                    if response2.status_code == 200:
                        schemas_data = response2.json()
                        result["schemas"] = schemas_data
                        
                        schemas = schemas_data.get("schemas", [])
                        if schemas:
                            schema_name = schemas[0].get("name", "default")
                            
                            # Test listing tables
                            response3 = requests.get(
                                f"{self.api_url}/unity-catalog/catalogs/{catalog_name}/schemas/{schema_name}/tables",
                                timeout=self.timeout
                            )
                            
                            result["tables_status"] = response3.status_code
                            if response3.status_code == 200:
                                result["tables"] = response3.json()
                            else:
                                result["tables_error"] = response3.text
                        else:
                            result["tables_status"] = "No schemas found"
                    else:
                        result["schemas_error"] = response2.text
                else:
                    result["schemas_status"] = "No catalogs found"
            else:
                result["catalogs_error"] = response1.text
            
            return result
            
        except Exception as e:
            return {
                "test": "Unity Catalog Endpoints",
                "success": False,
                "error": str(e)
            }
    
    def test_clusters_endpoint(self) -> Dict[str, Any]:
        """Test clusters compatibility endpoint."""
        try:
            response = requests.get(f"{self.api_url}/clusters/list", timeout=self.timeout)
            
            result = {
                "test": "Clusters Endpoint",
                "success": response.status_code == 200,
                "status_code": response.status_code
            }
            
            if response.status_code == 200:
                data = response.json()
                result["response"] = data
                result["cluster_count"] = len(data.get("clusters", []))
            else:
                result["error"] = response.text
            
            return result
            
        except Exception as e:
            return {
                "test": "Clusters Endpoint",
                "success": False,
                "error": str(e)
            }
    
    def test_execution_context(self) -> Dict[str, Any]:
        """Test execution context endpoint."""
        try:
            response = requests.get(f"{self.api_url}/sql/contexts", timeout=self.timeout)
            
            result = {
                "test": "Execution Context",
                "success": response.status_code == 200,
                "status_code": response.status_code
            }
            
            if response.status_code == 200:
                data = response.json()
                result["response"] = data
                result["has_warehouse"] = "warehouse_id" in data
                result["has_catalog"] = "catalog" in data
                result["has_schema"] = "schema" in data
            else:
                result["error"] = response.text
            
            return result
            
        except Exception as e:
            return {
                "test": "Execution Context",
                "success": False,
                "error": str(e)
            }
    
    def test_error_handling(self) -> Dict[str, Any]:
        """Test error handling with invalid SQL."""
        statement_data = {
            "statement": "SELECT * FROM non_existent_table_databricks_test",
            "warehouse_id": "lakehouse_sql_warehouse"
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/sql/statements",
                json=statement_data,
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
                
                # Check if error was properly handled
                status = data.get("status", {})
                state = status.get("state")
                has_error = state == "FAILED" and "error" in status
                
                result["handled_error"] = has_error
                result["error_state"] = state
                
                if has_error:
                    result["error_details"] = status["error"]
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
        """Run all Databricks Sandbox tests."""
        print("🧪 Running Databricks Sandbox Integration Tests")
        print("=" * 55)
        
        tests = [
            self.test_health_check,
            self.test_root_endpoint,
            self.test_basic_sql_statement,
            self.test_sql_statement_lifecycle,
            self.test_spark_catalog_operations,
            self.test_warehouse_operations,
            self.test_unity_catalog_endpoints,
            self.test_clusters_endpoint,
            self.test_execution_context,
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
        print("\n" + "=" * 55)
        print(f"📊 Test Results: {passed}/{len(tests)} passed")
        
        if failed == 0:
            print("🎉 All Databricks Sandbox tests passed!")
        else:
            print(f"❌ {failed} test(s) failed")
        
        return {
            "timestamp": datetime.now().isoformat(),
            "service": "databricks-sandbox",
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
        base_url = "http://localhost:5434"
    
    tester = DatabricksSandboxTester(base_url)
    
    try:
        report = tester.run_all_tests()
        
        # Save detailed report
        report_file = f"databricks_sandbox_test_report_{int(time.time())}.json"
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