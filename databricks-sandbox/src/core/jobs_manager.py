"""Databricks Jobs API implementation."""
import structlog
from typing import Optional, Dict, Any, List
import uuid
import time
import json
import asyncio
from enum import Enum

logger = structlog.get_logger()


class JobState(str, Enum):
    """Job execution states."""
    PENDING = "PENDING"
    RUNNING = "RUNNING" 
    TERMINATED = "TERMINATED"
    SKIPPED = "SKIPPED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ResultState(str, Enum):
    """Job result states."""
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEDOUT = "TIMEDOUT"
    CANCELED = "CANCELED"


class JobsManager:
    """Manages Databricks Jobs API emulation."""
    
    def __init__(self, spark_manager):
        self.spark_manager = spark_manager
        self._jobs: Dict[str, Dict] = {}
        self._job_runs: Dict[str, Dict] = {}
        self._job_run_counter = 1
    
    def create_job(self, job_spec: Dict) -> Dict:
        """Create a new job."""
        job_id = str(uuid.uuid4())
        
        job_definition = {
            "job_id": job_id,
            "creator_user_name": "databricks-sandbox",
            "created_time": int(time.time() * 1000),
            "settings": job_spec,
            "run_as_user_name": job_spec.get("run_as", {}).get("user_name", "databricks-sandbox")
        }
        
        self._jobs[job_id] = job_definition
        
        logger.info("Job created", job_id=job_id, name=job_spec.get("name", "Unnamed"))
        
        return {
            "job_id": job_id
        }
    
    def get_job(self, job_id: str) -> Optional[Dict]:
        """Get job definition."""
        job = self._jobs.get(job_id)
        if not job:
            return None
        
        # Add job statistics
        runs = [run for run in self._job_runs.values() if run["job_id"] == job_id]
        
        return {
            **job,
            "created_time": job["created_time"],
            "job_id": job_id,
            "settings": job["settings"]
        }
    
    def list_jobs(self, limit: int = 20, offset: int = 0, name: str = None) -> Dict:
        """List jobs with pagination."""
        jobs = list(self._jobs.values())
        
        # Filter by name if specified
        if name:
            jobs = [job for job in jobs if name.lower() in job["settings"].get("name", "").lower()]
        
        # Apply pagination
        total_count = len(jobs)
        start_idx = offset
        end_idx = min(offset + limit, total_count)
        
        paginated_jobs = jobs[start_idx:end_idx]
        
        return {
            "jobs": paginated_jobs,
            "has_more": end_idx < total_count,
            "total_count": total_count
        }
    
    def update_job(self, job_id: str, job_spec: Dict) -> bool:
        """Update job definition."""
        if job_id not in self._jobs:
            return False
        
        self._jobs[job_id]["settings"] = job_spec
        logger.info("Job updated", job_id=job_id)
        return True
    
    def delete_job(self, job_id: str) -> bool:
        """Delete a job."""
        if job_id not in self._jobs:
            return False
        
        # Cancel any running jobs
        running_runs = [run_id for run_id, run in self._job_runs.items() 
                       if run["job_id"] == job_id and run["state"]["life_cycle_state"] == JobState.RUNNING]
        
        for run_id in running_runs:
            self.cancel_run(run_id)
        
        del self._jobs[job_id]
        logger.info("Job deleted", job_id=job_id)
        return True
    
    async def run_now(self, job_id: str, job_parameters: Dict = None) -> Dict:
        """Trigger a job run."""
        if job_id not in self._jobs:
            raise ValueError(f"Job {job_id} not found")
        
        run_id = self._job_run_counter
        self._job_run_counter += 1
        
        job_def = self._jobs[job_id]
        
        run_info = {
            "run_id": run_id,
            "job_id": job_id,
            "number_in_job": len([r for r in self._job_runs.values() if r["job_id"] == job_id]) + 1,
            "creator_user_name": "databricks-sandbox",
            "run_as_user_name": job_def["run_as_user_name"],
            "original_attempt_run_id": run_id,
            "state": {
                "life_cycle_state": JobState.PENDING,
                "result_state": None,
                "state_message": "Waiting to start"
            },
            "schedule": None,
            "task": job_def["settings"],
            "cluster_spec": job_def["settings"].get("new_cluster", {}),
            "cluster_instance": {},
            "overriding_parameters": job_parameters or {},
            "start_time": int(time.time() * 1000),
            "setup_duration": 0,
            "execution_duration": 0,
            "cleanup_duration": 0,
            "end_time": None,
            "trigger": "ONE_TIME",
            "run_name": job_def["settings"].get("name", f"Job {job_id} run"),
            "run_page_url": f"http://localhost:5434/jobs/{job_id}/runs/{run_id}",
            "run_type": "JOB_RUN"
        }
        
        self._job_runs[str(run_id)] = run_info
        
        # Execute job asynchronously
        asyncio.create_task(self._execute_job_run(str(run_id)))
        
        logger.info("Job run started", job_id=job_id, run_id=run_id)
        
        return {
            "run_id": run_id
        }
    
    async def _execute_job_run(self, run_id: str):
        """Execute a job run."""
        run_info = self._job_runs[run_id]
        
        try:
            # Update state to running
            run_info["state"] = {
                "life_cycle_state": JobState.RUNNING,
                "result_state": None,
                "state_message": "In run"
            }
            
            job_def = self._jobs[run_info["job_id"]]
            task_spec = job_def["settings"]
            
            # Simulate setup time
            await asyncio.sleep(1)
            run_info["setup_duration"] = 1000
            
            execution_start = time.time()
            
            # Execute based on task type
            if "notebook_task" in task_spec:
                await self._execute_notebook_task(run_id, task_spec["notebook_task"])
            elif "spark_python_task" in task_spec:
                await self._execute_spark_python_task(run_id, task_spec["spark_python_task"])
            elif "spark_sql_task" in task_spec:
                await self._execute_spark_sql_task(run_id, task_spec["spark_sql_task"])
            elif "python_wheel_task" in task_spec:
                await self._execute_python_wheel_task(run_id, task_spec["python_wheel_task"])
            else:
                raise ValueError("Unsupported task type")
            
            execution_time = time.time() - execution_start
            run_info["execution_duration"] = int(execution_time * 1000)
            
            # Simulate cleanup
            await asyncio.sleep(0.5)
            run_info["cleanup_duration"] = 500
            
            # Mark as successful
            run_info["state"] = {
                "life_cycle_state": JobState.TERMINATED,
                "result_state": ResultState.SUCCESS,
                "state_message": "Succeeded"
            }
            run_info["end_time"] = int(time.time() * 1000)
            
        except Exception as e:
            # Mark as failed
            run_info["state"] = {
                "life_cycle_state": JobState.TERMINATED,
                "result_state": ResultState.FAILED,
                "state_message": str(e)
            }
            run_info["end_time"] = int(time.time() * 1000)
            
            logger.error("Job run failed", run_id=run_id, error=str(e))
    
    async def _execute_notebook_task(self, run_id: str, task_spec: Dict):
        """Execute a notebook task."""
        notebook_path = task_spec["notebook_path"]
        logger.info("Executing notebook task", run_id=run_id, notebook_path=notebook_path)
        
        # Simulate notebook execution
        await asyncio.sleep(2)
        
        # In a real implementation, this would execute the notebook
        logger.info("Notebook task completed", run_id=run_id)
    
    async def _execute_spark_python_task(self, run_id: str, task_spec: Dict):
        """Execute a Spark Python task."""
        python_file = task_spec["python_file"]
        parameters = task_spec.get("parameters", [])
        
        logger.info("Executing Spark Python task", run_id=run_id, python_file=python_file)
        
        # Simulate Python script execution
        await asyncio.sleep(3)
        
        logger.info("Spark Python task completed", run_id=run_id)
    
    async def _execute_spark_sql_task(self, run_id: str, task_spec: Dict):
        """Execute a Spark SQL task."""
        queries = task_spec.get("query", {})
        
        logger.info("Executing Spark SQL task", run_id=run_id)
        
        # Execute SQL queries using the spark manager
        for query_name, query_sql in queries.items():
            if isinstance(query_sql, dict):
                query_sql = query_sql.get("query", "")
            
            statement_id = await self.spark_manager.execute_statement(query_sql)
            result = self.spark_manager.get_statement_result(statement_id)
            
            if result and result["status"]["state"] == "FAILED":
                raise Exception(f"SQL query failed: {result['status']['error']['message']}")
        
        logger.info("Spark SQL task completed", run_id=run_id)
    
    async def _execute_python_wheel_task(self, run_id: str, task_spec: Dict):
        """Execute a Python wheel task."""
        package_name = task_spec["package_name"]
        entry_point = task_spec["entry_point"]
        
        logger.info("Executing Python wheel task", run_id=run_id, package=package_name)
        
        # Simulate wheel task execution
        await asyncio.sleep(2)
        
        logger.info("Python wheel task completed", run_id=run_id)
    
    def get_run(self, run_id: str) -> Optional[Dict]:
        """Get job run details."""
        return self._job_runs.get(str(run_id))
    
    def list_runs(self, job_id: str = None, limit: int = 20, offset: int = 0) -> Dict:
        """List job runs with pagination."""
        runs = list(self._job_runs.values())
        
        # Filter by job_id if specified
        if job_id:
            runs = [run for run in runs if run["job_id"] == job_id]
        
        # Sort by start time (most recent first)
        runs.sort(key=lambda x: x["start_time"], reverse=True)
        
        # Apply pagination
        total_count = len(runs)
        start_idx = offset
        end_idx = min(offset + limit, total_count)
        
        paginated_runs = runs[start_idx:end_idx]
        
        return {
            "runs": paginated_runs,
            "has_more": end_idx < total_count,
            "total_count": total_count
        }
    
    def cancel_run(self, run_id: str) -> bool:
        """Cancel a running job."""
        run_info = self._job_runs.get(str(run_id))
        if not run_info:
            return False
        
        if run_info["state"]["life_cycle_state"] == JobState.RUNNING:
            run_info["state"] = {
                "life_cycle_state": JobState.TERMINATED,
                "result_state": ResultState.CANCELED,
                "state_message": "Canceled by user"
            }
            run_info["end_time"] = int(time.time() * 1000)
            
            logger.info("Job run canceled", run_id=run_id)
            return True
        
        return False
    
    def export_run(self, run_id: str, views_to_export: str = "CODE") -> Optional[str]:
        """Export job run output."""
        run_info = self._job_runs.get(str(run_id))
        if not run_info:
            return None
        
        # Return base64 encoded job run information
        import base64
        export_data = {
            "run_info": run_info,
            "exported_at": int(time.time() * 1000),
            "views": views_to_export
        }
        
        json_data = json.dumps(export_data, indent=2)
        return base64.b64encode(json_data.encode()).decode()