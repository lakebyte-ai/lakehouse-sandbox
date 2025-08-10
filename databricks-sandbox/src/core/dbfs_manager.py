"""DBFS (Databricks File System) API implementation using MinIO."""
import structlog
from typing import Optional, Dict, Any, List, BinaryIO
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import os
import time
import base64
from urllib.parse import urlparse

from config.settings import settings

logger = structlog.get_logger()


class DBFSManager:
    """Manages DBFS API emulation using MinIO S3 backend."""
    
    def __init__(self):
        self._s3_client = None
        self._bucket_name = "databricks-dbfs"
        self._root_prefix = "dbfs"
        
    async def initialize(self):
        """Initialize S3 client and bucket."""
        try:
            # Parse S3 endpoint
            endpoint_url = settings.s3_endpoint
            if not endpoint_url.startswith(('http://', 'https://')):
                endpoint_url = f"http://{endpoint_url}"
            
            # Create S3 client
            self._s3_client = boto3.client(
                's3',
                endpoint_url=endpoint_url,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
                region_name=settings.s3_region
            )
            
            # Ensure bucket exists
            await self._ensure_bucket_exists()
            
            logger.info("DBFS manager initialized", 
                       bucket=self._bucket_name, 
                       endpoint=endpoint_url)
                       
        except Exception as e:
            logger.error("Failed to initialize DBFS manager", error=str(e))
            raise
    
    async def _ensure_bucket_exists(self):
        """Ensure the DBFS bucket exists."""
        try:
            self._s3_client.head_bucket(Bucket=self._bucket_name)
        except ClientError as e:
            error_code = int(e.response['Error']['Code'])
            if error_code == 404:
                # Bucket doesn't exist, create it
                try:
                    self._s3_client.create_bucket(Bucket=self._bucket_name)
                    logger.info("Created DBFS bucket", bucket=self._bucket_name)
                except ClientError as create_error:
                    logger.warning("Failed to create DBFS bucket", 
                                 bucket=self._bucket_name, 
                                 error=str(create_error))
            else:
                logger.error("Error checking DBFS bucket", error=str(e))
    
    def _dbfs_to_s3_path(self, dbfs_path: str) -> str:
        """Convert DBFS path to S3 object key."""
        # Remove leading /dbfs if present
        if dbfs_path.startswith('/dbfs'):
            dbfs_path = dbfs_path[5:]
        
        # Remove leading slash
        if dbfs_path.startswith('/'):
            dbfs_path = dbfs_path[1:]
        
        # Add root prefix
        return f"{self._root_prefix}/{dbfs_path}"
    
    def _s3_to_dbfs_path(self, s3_key: str) -> str:
        """Convert S3 object key to DBFS path."""
        # Remove root prefix
        if s3_key.startswith(f"{self._root_prefix}/"):
            dbfs_path = s3_key[len(f"{self._root_prefix}/"):]
        else:
            dbfs_path = s3_key
        
        # Ensure leading slash
        if not dbfs_path.startswith('/'):
            dbfs_path = f"/{dbfs_path}"
            
        return f"/dbfs{dbfs_path}"
    
    def list_files(self, path: str, recursive: bool = False) -> List[Dict[str, Any]]:
        """List files in DBFS path."""
        try:
            s3_prefix = self._dbfs_to_s3_path(path)
            
            # Add trailing slash for directory listing
            if not s3_prefix.endswith('/'):
                s3_prefix += '/'
            
            paginator = self._s3_client.get_paginator('list_objects_v2')
            
            delimiter = None if recursive else '/'
            
            files = []
            
            for page in paginator.paginate(
                Bucket=self._bucket_name, 
                Prefix=s3_prefix,
                Delimiter=delimiter
            ):
                # Process files
                for obj in page.get('Contents', []):
                    if obj['Key'] != s3_prefix:  # Skip the directory itself
                        files.append({
                            "path": self._s3_to_dbfs_path(obj['Key']),
                            "is_dir": False,
                            "file_size": obj['Size'],
                            "modification_time": int(obj['LastModified'].timestamp() * 1000)
                        })
                
                # Process subdirectories (only if not recursive)
                if not recursive:
                    for prefix in page.get('CommonPrefixes', []):
                        dir_path = prefix['Prefix'].rstrip('/')
                        files.append({
                            "path": self._s3_to_dbfs_path(dir_path),
                            "is_dir": True,
                            "file_size": 0,
                            "modification_time": int(time.time() * 1000)
                        })
            
            return files
            
        except ClientError as e:
            logger.error("Failed to list DBFS files", path=path, error=str(e))
            raise Exception(f"Failed to list files: {str(e)}")
    
    def get_file_info(self, path: str) -> Optional[Dict[str, Any]]:
        """Get information about a file or directory."""
        try:
            s3_key = self._dbfs_to_s3_path(path)
            
            try:
                # Try to get object metadata
                response = self._s3_client.head_object(Bucket=self._bucket_name, Key=s3_key)
                
                return {
                    "path": path,
                    "is_dir": False,
                    "file_size": response['ContentLength'],
                    "modification_time": int(response['LastModified'].timestamp() * 1000)
                }
                
            except ClientError as e:
                if e.response['Error']['Code'] == '404':
                    # Might be a directory, check for objects with this prefix
                    s3_prefix = s3_key + '/' if not s3_key.endswith('/') else s3_key
                    
                    response = self._s3_client.list_objects_v2(\n                        Bucket=self._bucket_name, \n                        Prefix=s3_prefix,\n                        MaxKeys=1\n                    )\n                    \n                    if response.get('Contents') or response.get('CommonPrefixes'):\n                        return {\n                            \"path\": path,\n                            \"is_dir\": True,\n                            \"file_size\": 0,\n                            \"modification_time\": int(time.time() * 1000)\n                        }\n                    else:\n                        return None\n                else:\n                    raise\n                    \n        except ClientError as e:\n            logger.error(\"Failed to get DBFS file info\", path=path, error=str(e))\n            return None\n    \n    def read_file(self, path: str, offset: int = 0, length: int = None) -> bytes:\n        \"\"\"Read file content from DBFS.\"\"\"\n        try:\n            s3_key = self._dbfs_to_s3_path(path)\n            \n            # Prepare range header if needed\n            kwargs = {'Bucket': self._bucket_name, 'Key': s3_key}\n            \n            if offset > 0 or length is not None:\n                if length is not None:\n                    range_header = f\"bytes={offset}-{offset + length - 1}\"\n                else:\n                    range_header = f\"bytes={offset}-\"\n                kwargs['Range'] = range_header\n            \n            response = self._s3_client.get_object(**kwargs)\n            return response['Body'].read()\n            \n        except ClientError as e:\n            if e.response['Error']['Code'] == 'NoSuchKey':\n                raise FileNotFoundError(f\"File not found: {path}\")\n            else:\n                logger.error(\"Failed to read DBFS file\", path=path, error=str(e))\n                raise Exception(f\"Failed to read file: {str(e)}\")\n    \n    def write_file(self, path: str, data: bytes, overwrite: bool = False) -> bool:\n        \"\"\"Write file content to DBFS.\"\"\"\n        try:\n            s3_key = self._dbfs_to_s3_path(path)\n            \n            # Check if file exists\n            if not overwrite:\n                try:\n                    self._s3_client.head_object(Bucket=self._bucket_name, Key=s3_key)\n                    raise Exception(f\"File already exists: {path}\")\n                except ClientError as e:\n                    if e.response['Error']['Code'] != '404':\n                        raise\n            \n            # Write file\n            self._s3_client.put_object(\n                Bucket=self._bucket_name,\n                Key=s3_key,\n                Body=data\n            )\n            \n            logger.info(\"File written to DBFS\", path=path, size=len(data))\n            return True\n            \n        except ClientError as e:\n            logger.error(\"Failed to write DBFS file\", path=path, error=str(e))\n            raise Exception(f\"Failed to write file: {str(e)}\")\n    \n    def delete_file(self, path: str, recursive: bool = False) -> bool:\n        \"\"\"Delete file or directory from DBFS.\"\"\"\n        try:\n            s3_key = self._dbfs_to_s3_path(path)\n            \n            # Check if it's a single file\n            try:\n                self._s3_client.head_object(Bucket=self._bucket_name, Key=s3_key)\n                # It's a file, delete it\n                self._s3_client.delete_object(Bucket=self._bucket_name, Key=s3_key)\n                logger.info(\"File deleted from DBFS\", path=path)\n                return True\n                \n            except ClientError as e:\n                if e.response['Error']['Code'] == '404':\n                    # Might be a directory\n                    s3_prefix = s3_key + '/' if not s3_key.endswith('/') else s3_key\n                    \n                    # List objects with this prefix\n                    paginator = self._s3_client.get_paginator('list_objects_v2')\n                    objects_to_delete = []\n                    \n                    for page in paginator.paginate(Bucket=self._bucket_name, Prefix=s3_prefix):\n                        for obj in page.get('Contents', []):\n                            objects_to_delete.append({'Key': obj['Key']})\n                    \n                    if not objects_to_delete:\n                        raise FileNotFoundError(f\"Path not found: {path}\")\n                    \n                    if not recursive and len(objects_to_delete) > 1:\n                        raise Exception(f\"Directory not empty: {path}\")\n                    \n                    # Delete objects in batches\n                    while objects_to_delete:\n                        batch = objects_to_delete[:1000]  # S3 batch delete limit\n                        objects_to_delete = objects_to_delete[1000:]\n                        \n                        self._s3_client.delete_objects(\n                            Bucket=self._bucket_name,\n                            Delete={'Objects': batch}\n                        )\n                    \n                    logger.info(\"Directory deleted from DBFS\", path=path, \n                               file_count=len(objects_to_delete))\n                    return True\n                else:\n                    raise\n                    \n        except ClientError as e:\n            logger.error(\"Failed to delete DBFS path\", path=path, error=str(e))\n            raise Exception(f\"Failed to delete: {str(e)}\")\n    \n    def move_file(self, source_path: str, destination_path: str) -> bool:\n        \"\"\"Move/rename file or directory in DBFS.\"\"\"\n        try:\n            source_key = self._dbfs_to_s3_path(source_path)\n            dest_key = self._dbfs_to_s3_path(destination_path)\n            \n            # Check if source is a single file\n            try:\n                self._s3_client.head_object(Bucket=self._bucket_name, Key=source_key)\n                \n                # Copy file\n                copy_source = {'Bucket': self._bucket_name, 'Key': source_key}\n                self._s3_client.copy_object(\n                    CopySource=copy_source,\n                    Bucket=self._bucket_name,\n                    Key=dest_key\n                )\n                \n                # Delete original\n                self._s3_client.delete_object(Bucket=self._bucket_name, Key=source_key)\n                \n                logger.info(\"File moved in DBFS\", source=source_path, dest=destination_path)\n                return True\n                \n            except ClientError as e:\n                if e.response['Error']['Code'] == '404':\n                    # Might be a directory\n                    source_prefix = source_key + '/' if not source_key.endswith('/') else source_key\n                    dest_prefix = dest_key + '/' if not dest_key.endswith('/') else dest_key\n                    \n                    # List and move all objects\n                    paginator = self._s3_client.get_paginator('list_objects_v2')\n                    moved_count = 0\n                    \n                    for page in paginator.paginate(Bucket=self._bucket_name, Prefix=source_prefix):\n                        for obj in page.get('Contents', []):\n                            old_key = obj['Key']\n                            # Replace source prefix with dest prefix\n                            new_key = dest_prefix + old_key[len(source_prefix):]\n                            \n                            # Copy object\n                            copy_source = {'Bucket': self._bucket_name, 'Key': old_key}\n                            self._s3_client.copy_object(\n                                CopySource=copy_source,\n                                Bucket=self._bucket_name,\n                                Key=new_key\n                            )\n                            \n                            # Delete original\n                            self._s3_client.delete_object(Bucket=self._bucket_name, Key=old_key)\n                            moved_count += 1\n                    \n                    if moved_count == 0:\n                        raise FileNotFoundError(f\"Source path not found: {source_path}\")\n                    \n                    logger.info(\"Directory moved in DBFS\", source=source_path, \n                               dest=destination_path, file_count=moved_count)\n                    return True\n                else:\n                    raise\n                    \n        except ClientError as e:\n            logger.error(\"Failed to move DBFS path\", source=source_path, \n                        dest=destination_path, error=str(e))\n            raise Exception(f\"Failed to move: {str(e)}\")\n    \n    def create_directory(self, path: str) -> bool:\n        \"\"\"Create directory in DBFS.\"\"\"\n        try:\n            s3_key = self._dbfs_to_s3_path(path)\n            \n            # Ensure it ends with slash for directory marker\n            if not s3_key.endswith('/'):\n                s3_key += '/'\n            \n            # Create empty object as directory marker\n            self._s3_client.put_object(\n                Bucket=self._bucket_name,\n                Key=s3_key,\n                Body=b''\n            )\n            \n            logger.info(\"Directory created in DBFS\", path=path)\n            return True\n            \n        except ClientError as e:\n            logger.error(\"Failed to create DBFS directory\", path=path, error=str(e))\n            raise Exception(f\"Failed to create directory: {str(e)}\")\n    \n    def get_upload_url(self, path: str, expires_in: int = 3600) -> str:\n        \"\"\"Generate presigned URL for file upload.\"\"\"\n        try:\n            s3_key = self._dbfs_to_s3_path(path)\n            \n            url = self._s3_client.generate_presigned_url(\n                'put_object',\n                Params={'Bucket': self._bucket_name, 'Key': s3_key},\n                ExpiresIn=expires_in\n            )\n            \n            return url\n            \n        except ClientError as e:\n            logger.error(\"Failed to generate DBFS upload URL\", path=path, error=str(e))\n            raise Exception(f\"Failed to generate upload URL: {str(e)}\")\n    \n    def get_download_url(self, path: str, expires_in: int = 3600) -> str:\n        \"\"\"Generate presigned URL for file download.\"\"\"\n        try:\n            s3_key = self._dbfs_to_s3_path(path)\n            \n            url = self._s3_client.generate_presigned_url(\n                'get_object',\n                Params={'Bucket': self._bucket_name, 'Key': s3_key},\n                ExpiresIn=expires_in\n            )\n            \n            return url\n            \n        except ClientError as e:\n            logger.error(\"Failed to generate DBFS download URL\", path=path, error=str(e))\n            raise Exception(f\"Failed to generate download URL: {str(e)}\")