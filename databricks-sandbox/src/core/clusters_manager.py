"""Databricks Clusters API implementation."""
import structlog
from typing import Optional, Dict, Any, List
import uuid
import time
import json
from enum import Enum

logger = structlog.get_logger()


class ClusterState(str, Enum):
    """Cluster states."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    RESTARTING = "RESTARTING" 
    RESIZING = "RESIZING"
    TERMINATING = "TERMINATING"
    TERMINATED = "TERMINATED"
    ERROR = "ERROR"
    UNKNOWN = "UNKNOWN"


class ClustersManager:
    """Manages Databricks Clusters API emulation."""
    
    def __init__(self):
        self._clusters: Dict[str, Dict] = {}
        self._cluster_events: Dict[str, List[Dict]] = {}
        
        # Create a default cluster
        self._create_default_cluster()
    
    def _create_default_cluster(self):
        """Create the default local cluster."""
        cluster_id = "local-cluster"
        
        cluster_info = {
            "cluster_id": cluster_id,
            "cluster_name": "Databricks Sandbox Local Cluster",
            "spark_version": "3.4.0-scala2.12",
            "node_type_id": "local-node",
            "driver_node_type_id": "local-node",
            "num_workers": 1,
            "autoscale": {
                "min_workers": 1,
                "max_workers": 1
            },
            "cluster_source": "API",
            "state": ClusterState.RUNNING,
            "state_message": "",
            "start_time": int(time.time() * 1000),
            "terminated_time": None,
            "last_state_loss_time": None,
            "last_activity_time": int(time.time() * 1000),
            "cluster_memory_mb": 4096,
            "cluster_cores": 2.0,
            "creator_user_name": "databricks-sandbox",
            "driver": {
                "host_private_ip": "127.0.0.1",
                "node_id": "local-driver",
                "instance_id": "local-driver-instance",
                "start_timestamp": int(time.time() * 1000)
            },
            "executors": [
                {
                    "host_private_ip": "127.0.0.1", 
                    "node_id": "local-executor-1",
                    "instance_id": "local-executor-instance-1",
                    "start_timestamp": int(time.time() * 1000)
                }
            ],
            "jdbc_port": 10000,
            "cluster_log_conf": {
                "dbfs": {
                    "destination": "dbfs:/cluster-logs"
                }
            },
            "init_scripts": [],
            "spark_conf": {
                "spark.sql.adaptive.enabled": "true",
                "spark.sql.adaptive.coalescePartitions.enabled": "true",
                "spark.serializer": "org.apache.spark.serializer.KryoSerializer"
            },
            "aws_attributes": {
                "availability": "ON_DEMAND",
                "zone_id": "us-west-2a"
            },
            "ssh_public_keys": [],
            "custom_tags": {
                "Environment": "sandbox",
                "Purpose": "development"
            },
            "cluster_log_status": {
                "last_attempted": int(time.time() * 1000),
                "last_exception": None
            },
            "enable_elastic_disk": False,
            "disk_spec": {},
            "enable_local_disk_encryption": False,
            "runtime_engine": "STANDARD"
        }
        
        self._clusters[cluster_id] = cluster_info
        self._cluster_events[cluster_id] = [
            {
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000),
                "type": "CREATING",
                "details": {
                    "reason": {
                        "code": "USER_REQUEST",
                        "parameters": {}
                    },
                    "user": "databricks-sandbox"
                }
            },
            {
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000) + 1000,
                "type": "RUNNING",
                "details": {
                    "reason": {
                        "code": "CLUSTER_STARTED",
                        "parameters": {}
                    }
                }
            }
        ]
        
        logger.info("Default cluster created", cluster_id=cluster_id)
    
    def create_cluster(self, cluster_spec: Dict) -> Dict:
        """Create a new cluster."""
        cluster_id = str(uuid.uuid4())
        
        cluster_info = {
            "cluster_id": cluster_id,
            "cluster_name": cluster_spec.get("cluster_name", f"cluster-{cluster_id[:8]}"),
            "spark_version": cluster_spec.get("spark_version", "3.4.0-scala2.12"),
            "node_type_id": cluster_spec.get("node_type_id", "i3.xlarge"),
            "driver_node_type_id": cluster_spec.get("driver_node_type_id"),
            "num_workers": cluster_spec.get("num_workers", 0),
            "autoscale": cluster_spec.get("autoscale"),
            "cluster_source": "API",
            "state": ClusterState.PENDING,
            "state_message": "Acquiring instances",
            "start_time": None,
            "terminated_time": None,
            "last_state_loss_time": None,
            "last_activity_time": int(time.time() * 1000),
            "cluster_memory_mb": None,
            "cluster_cores": None,
            "creator_user_name": "databricks-sandbox",
            "driver": None,
            "executors": [],
            "jdbc_port": 10000,
            "cluster_log_conf": cluster_spec.get("cluster_log_conf", {}),
            "init_scripts": cluster_spec.get("init_scripts", []),
            "spark_conf": cluster_spec.get("spark_conf", {}),
            "aws_attributes": cluster_spec.get("aws_attributes", {}),
            "ssh_public_keys": cluster_spec.get("ssh_public_keys", []),
            "custom_tags": cluster_spec.get("custom_tags", {}),
            "cluster_log_status": {
                "last_attempted": None,
                "last_exception": None
            },
            "enable_elastic_disk": cluster_spec.get("enable_elastic_disk", False),
            "disk_spec": cluster_spec.get("disk_spec", {}),
            "enable_local_disk_encryption": cluster_spec.get("enable_local_disk_encryption", False),
            "runtime_engine": cluster_spec.get("runtime_engine", "STANDARD")
        }
        
        self._clusters[cluster_id] = cluster_info
        self._cluster_events[cluster_id] = [
            {
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000),
                "type": "CREATING",
                "details": {
                    "reason": {
                        "code": "USER_REQUEST",
                        "parameters": {}
                    },
                    "user": "databricks-sandbox"
                }
            }
        ]
        
        # Simulate cluster startup
        import asyncio
        asyncio.create_task(self._simulate_cluster_startup(cluster_id))
        
        logger.info("Cluster creation initiated", cluster_id=cluster_id)
        
        return {
            "cluster_id": cluster_id
        }
    
    async def _simulate_cluster_startup(self, cluster_id: str):
        """Simulate cluster startup process."""
        cluster = self._clusters[cluster_id]
        
        try:
            # Simulate startup time
            await asyncio.sleep(5)
            
            # Update to running state
            cluster["state"] = ClusterState.RUNNING
            cluster["state_message"] = ""
            cluster["start_time"] = int(time.time() * 1000)
            cluster["cluster_memory_mb"] = 8192
            cluster["cluster_cores"] = 4.0
            
            # Add driver and executors
            cluster["driver"] = {
                "host_private_ip": "127.0.0.1",
                "node_id": f"{cluster_id}-driver",
                "instance_id": f"{cluster_id}-driver-instance",
                "start_timestamp": int(time.time() * 1000)
            }
            
            num_workers = cluster.get("num_workers", 1)
            if cluster.get("autoscale"):
                num_workers = cluster["autoscale"]["min_workers"]
            
            cluster["executors"] = []
            for i in range(num_workers):
                cluster["executors"].append({
                    "host_private_ip": "127.0.0.1",
                    "node_id": f"{cluster_id}-executor-{i+1}",
                    "instance_id": f"{cluster_id}-executor-instance-{i+1}",
                    "start_timestamp": int(time.time() * 1000)
                })
            
            # Add running event
            self._cluster_events[cluster_id].append({
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000),
                "type": "RUNNING",
                "details": {
                    "reason": {
                        "code": "CLUSTER_STARTED",
                        "parameters": {}
                    }
                }
            })
            
            logger.info("Cluster started successfully", cluster_id=cluster_id)
            
        except Exception as e:
            # Set to error state
            cluster["state"] = ClusterState.ERROR
            cluster["state_message"] = str(e)
            
            self._cluster_events[cluster_id].append({
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000),
                "type": "ERROR",
                "details": {
                    "reason": {
                        "code": "LAUNCH_FAILURE",
                        "parameters": {"error": str(e)}
                    }
                }
            })
            
            logger.error("Cluster startup failed", cluster_id=cluster_id, error=str(e))
    
    def get_cluster(self, cluster_id: str) -> Optional[Dict]:
        """Get cluster information."""
        return self._clusters.get(cluster_id)
    
    def list_clusters(self) -> Dict:
        """List all clusters."""
        clusters = list(self._clusters.values())
        return {"clusters": clusters}
    
    def edit_cluster(self, cluster_id: str, cluster_spec: Dict) -> bool:
        """Edit cluster configuration."""
        if cluster_id not in self._clusters:
            return False
        
        cluster = self._clusters[cluster_id]
        
        # Update editable fields
        editable_fields = [
            "cluster_name", "spark_version", "node_type_id", "driver_node_type_id",
            "num_workers", "autoscale", "cluster_log_conf", "init_scripts",
            "spark_conf", "aws_attributes", "ssh_public_keys", "custom_tags",
            "enable_elastic_disk", "disk_spec", "enable_local_disk_encryption"
        ]
        
        for field in editable_fields:
            if field in cluster_spec:
                cluster[field] = cluster_spec[field]
        
        cluster["last_activity_time"] = int(time.time() * 1000)
        
        self._cluster_events[cluster_id].append({
            "cluster_id": cluster_id,
            "timestamp": int(time.time() * 1000),
            "type": "EDITED",
            "details": {
                "reason": {
                    "code": "USER_REQUEST",
                    "parameters": {}
                },
                "user": "databricks-sandbox"
            }
        })
        
        logger.info("Cluster configuration updated", cluster_id=cluster_id)
        return True
    
    def start_cluster(self, cluster_id: str) -> bool:
        """Start a terminated cluster."""
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False
        
        if cluster["state"] == ClusterState.TERMINATED:
            cluster["state"] = ClusterState.PENDING
            cluster["state_message"] = "Starting cluster"
            cluster["last_activity_time"] = int(time.time() * 1000)
            
            self._cluster_events[cluster_id].append({
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000),
                "type": "RESTARTING",
                "details": {
                    "reason": {
                        "code": "USER_REQUEST",
                        "parameters": {}
                    },
                    "user": "databricks-sandbox"
                }
            })
            
            # Simulate startup
            import asyncio
            asyncio.create_task(self._simulate_cluster_startup(cluster_id))
            
            logger.info("Cluster start initiated", cluster_id=cluster_id)
            return True
        
        return False
    
    def restart_cluster(self, cluster_id: str) -> bool:
        """Restart a running cluster."""
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False
        
        if cluster["state"] == ClusterState.RUNNING:
            cluster["state"] = ClusterState.RESTARTING
            cluster["state_message"] = "Restarting cluster"
            cluster["last_activity_time"] = int(time.time() * 1000)
            
            self._cluster_events[cluster_id].append({
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000),
                "type": "RESTARTING",
                "details": {
                    "reason": {
                        "code": "USER_REQUEST",
                        "parameters": {}
                    },
                    "user": "databricks-sandbox"
                }
            })
            
            # Simulate restart
            import asyncio
            asyncio.create_task(self._simulate_cluster_restart(cluster_id))
            
            logger.info("Cluster restart initiated", cluster_id=cluster_id)
            return True
        
        return False
    
    async def _simulate_cluster_restart(self, cluster_id: str):
        """Simulate cluster restart process."""
        cluster = self._clusters[cluster_id]
        
        try:
            # Simulate restart time
            await asyncio.sleep(3)
            
            # Update to running state
            cluster["state"] = ClusterState.RUNNING
            cluster["state_message"] = ""
            cluster["start_time"] = int(time.time() * 1000)
            cluster["last_activity_time"] = int(time.time() * 1000)
            
            # Update driver and executor timestamps
            if cluster["driver"]:
                cluster["driver"]["start_timestamp"] = int(time.time() * 1000)
            
            for executor in cluster.get("executors", []):
                executor["start_timestamp"] = int(time.time() * 1000)
            
            self._cluster_events[cluster_id].append({
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000),
                "type": "RUNNING",
                "details": {
                    "reason": {
                        "code": "CLUSTER_RESTARTED",
                        "parameters": {}
                    }
                }
            })
            
            logger.info("Cluster restarted successfully", cluster_id=cluster_id)
            
        except Exception as e:
            cluster["state"] = ClusterState.ERROR
            cluster["state_message"] = str(e)
            logger.error("Cluster restart failed", cluster_id=cluster_id, error=str(e))
    
    def terminate_cluster(self, cluster_id: str) -> bool:
        """Terminate a cluster."""
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False
        
        if cluster_id == "local-cluster":
            logger.warning("Cannot terminate default local cluster", cluster_id=cluster_id)
            return False
        
        if cluster["state"] in [ClusterState.RUNNING, ClusterState.PENDING, ClusterState.RESTARTING]:
            cluster["state"] = ClusterState.TERMINATING
            cluster["state_message"] = "Terminating cluster"
            cluster["last_activity_time"] = int(time.time() * 1000)
            
            self._cluster_events[cluster_id].append({
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000),
                "type": "TERMINATING",
                "details": {
                    "reason": {
                        "code": "USER_REQUEST",
                        "parameters": {}
                    },
                    "user": "databricks-sandbox"
                }
            })
            
            # Simulate termination
            import asyncio
            asyncio.create_task(self._simulate_cluster_termination(cluster_id))
            
            logger.info("Cluster termination initiated", cluster_id=cluster_id)
            return True
        
        return False
    
    async def _simulate_cluster_termination(self, cluster_id: str):
        """Simulate cluster termination process."""
        cluster = self._clusters[cluster_id]
        
        try:
            # Simulate termination time
            await asyncio.sleep(2)
            
            # Update to terminated state
            cluster["state"] = ClusterState.TERMINATED
            cluster["state_message"] = ""
            cluster["terminated_time"] = int(time.time() * 1000)
            cluster["last_activity_time"] = int(time.time() * 1000)
            
            # Clear runtime info
            cluster["driver"] = None
            cluster["executors"] = []
            cluster["cluster_memory_mb"] = None
            cluster["cluster_cores"] = None
            
            self._cluster_events[cluster_id].append({
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000),
                "type": "TERMINATED",
                "details": {
                    "reason": {
                        "code": "USER_REQUEST",
                        "parameters": {}
                    }
                }
            })
            
            logger.info("Cluster terminated successfully", cluster_id=cluster_id)
            
        except Exception as e:
            cluster["state"] = ClusterState.ERROR
            cluster["state_message"] = str(e)
            logger.error("Cluster termination failed", cluster_id=cluster_id, error=str(e))
    
    def delete_cluster(self, cluster_id: str) -> bool:
        """Permanently delete a cluster."""
        if cluster_id not in self._clusters:
            return False
        
        if cluster_id == "local-cluster":
            logger.warning("Cannot delete default local cluster", cluster_id=cluster_id)
            return False
        
        cluster = self._clusters[cluster_id]
        
        # Terminate first if running
        if cluster["state"] not in [ClusterState.TERMINATED, ClusterState.ERROR]:
            self.terminate_cluster(cluster_id)
            # In real implementation, would wait for termination
        
        # Delete cluster and events
        del self._clusters[cluster_id]
        del self._cluster_events[cluster_id]
        
        logger.info("Cluster deleted", cluster_id=cluster_id)
        return True
    
    def resize_cluster(self, cluster_id: str, num_workers: int) -> bool:
        """Resize cluster by changing number of workers."""
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False
        
        if cluster["state"] != ClusterState.RUNNING:
            return False
        
        old_workers = cluster.get("num_workers", 0)
        cluster["num_workers"] = num_workers
        cluster["state"] = ClusterState.RESIZING
        cluster["state_message"] = f"Resizing from {old_workers} to {num_workers} workers"
        cluster["last_activity_time"] = int(time.time() * 1000)
        
        self._cluster_events[cluster_id].append({
            "cluster_id": cluster_id,
            "timestamp": int(time.time() * 1000),
            "type": "RESIZING",
            "details": {
                "reason": {
                    "code": "USER_REQUEST",
                    "parameters": {"old_workers": old_workers, "new_workers": num_workers}
                },
                "user": "databricks-sandbox"
            }
        })
        
        # Simulate resize
        import asyncio
        asyncio.create_task(self._simulate_cluster_resize(cluster_id, num_workers))
        
        logger.info("Cluster resize initiated", cluster_id=cluster_id, 
                   old_workers=old_workers, new_workers=num_workers)
        return True
    
    async def _simulate_cluster_resize(self, cluster_id: str, num_workers: int):
        """Simulate cluster resize process."""
        cluster = self._clusters[cluster_id]
        
        try:
            # Simulate resize time
            await asyncio.sleep(2)
            
            # Update executors list
            current_executors = len(cluster.get("executors", []))
            
            if num_workers > current_executors:
                # Add executors
                for i in range(current_executors, num_workers):
                    cluster["executors"].append({
                        "host_private_ip": "127.0.0.1",
                        "node_id": f"{cluster_id}-executor-{i+1}",
                        "instance_id": f"{cluster_id}-executor-instance-{i+1}",
                        "start_timestamp": int(time.time() * 1000)
                    })
            else:
                # Remove executors
                cluster["executors"] = cluster["executors"][:num_workers]
            
            # Update cluster resources
            cluster["cluster_cores"] = (num_workers + 1) * 2.0  # 2 cores per node
            cluster["cluster_memory_mb"] = (num_workers + 1) * 4096  # 4GB per node
            
            # Back to running state
            cluster["state"] = ClusterState.RUNNING
            cluster["state_message"] = ""
            cluster["last_activity_time"] = int(time.time() * 1000)
            
            self._cluster_events[cluster_id].append({
                "cluster_id": cluster_id,
                "timestamp": int(time.time() * 1000),
                "type": "RUNNING",
                "details": {
                    "reason": {
                        "code": "CLUSTER_RESIZED",
                        "parameters": {"workers": num_workers}
                    }
                }
            })
            
            logger.info("Cluster resized successfully", cluster_id=cluster_id, workers=num_workers)
            
        except Exception as e:
            cluster["state"] = ClusterState.ERROR
            cluster["state_message"] = str(e)
            logger.error("Cluster resize failed", cluster_id=cluster_id, error=str(e))
    
    def get_cluster_events(self, cluster_id: str, start_time: int = None, end_time: int = None, 
                          order: str = "DESC", limit: int = 50, offset: int = 0) -> Dict:
        """Get cluster events with filtering and pagination."""
        if cluster_id not in self._cluster_events:
            return {"events": [], "total_count": 0}
        
        events = self._cluster_events[cluster_id]
        
        # Filter by time range
        if start_time:
            events = [e for e in events if e["timestamp"] >= start_time]
        if end_time:
            events = [e for e in events if e["timestamp"] <= end_time]
        
        # Sort by timestamp
        reverse = order.upper() == "DESC"
        events = sorted(events, key=lambda x: x["timestamp"], reverse=reverse)
        
        total_count = len(events)
        
        # Apply pagination
        start_idx = offset
        end_idx = min(offset + limit, total_count)
        paginated_events = events[start_idx:end_idx]
        
        return {
            "events": paginated_events,
            "total_count": total_count
        }