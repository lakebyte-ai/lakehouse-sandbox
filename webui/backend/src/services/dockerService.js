const Docker = require('dockerode');
const path = require('path');

class DockerService {
  constructor() {
    this.docker = new Docker();
    
    // Define service groups based on the lakehouse-sandbox structure
    this.serviceGroups = {
      core: [
        'polaris', 'trino', 'minio', 'spark-iceberg', 'nimtable'
      ],
      kafka: [
        'kafka1', 'kafka2', 'kafka3', 'kafka-ui'
      ],
      airflow: [
        'airflow-webserver',
        'airflow-scheduler', 
        'airflow-worker',
        'airflow-postgres',
        'airflow-redis'
      ],
      sandbox: [
        'snowflake-sandbox', 'databricks-sandbox'
      ]
    };

    // Service metadata
    this.serviceMetadata = {
      // Core services
      'polaris': { port: 8181, name: 'Polaris Catalog', group: 'core', url: 'http://localhost:8181' },
      'trino': { port: 8080, name: 'Trino Query Engine', group: 'core', url: 'http://localhost:8080' },
      'minio': { port: 9001, name: 'MinIO Console', group: 'core', url: 'http://localhost:9001', credentials: 'admin/password' },
      'spark-iceberg': { port: 8888, name: 'Spark Jupyter', group: 'core', url: 'http://localhost:8888' },
      'nimtable': { port: 13000, name: 'Nimtable UI', group: 'core', url: 'http://localhost:13000', credentials: 'admin/admin' },
      
      // Kafka services (KRaft mode - no Zookeeper needed)
      'kafka1': { port: 9092, name: 'Kafka Broker 1', group: 'kafka' },
      'kafka2': { port: 9093, name: 'Kafka Broker 2', group: 'kafka' },
      'kafka3': { port: 9094, name: 'Kafka Broker 3', group: 'kafka' },
      'kafka-ui': { port: 8091, name: 'Kafka UI', group: 'kafka', url: 'http://localhost:8091' },
      
      // Airflow services  
      'airflow-webserver': { port: 8090, name: 'Airflow Web', group: 'airflow', url: 'http://localhost:8090', credentials: 'admin/admin' },
      'airflow-scheduler': { name: 'Airflow Scheduler', group: 'airflow' },
      'airflow-worker': { name: 'Airflow Worker', group: 'airflow' },
      'airflow-postgres': { port: 5433, name: 'Airflow PostgreSQL', group: 'airflow' },
      'airflow-redis': { name: 'Airflow Redis', group: 'airflow' },
      
      // Sandbox services (Experimental)
      'snowflake-sandbox': { port: 5435, name: 'Snowflake Sandbox (Experimental)', group: 'sandbox', url: 'http://localhost:5435', apiUrl: 'http://localhost:5435/api/v1', docsUrl: 'http://localhost:5435/docs' },
      'databricks-sandbox': { port: 5434, name: 'Databricks Sandbox (Experimental)', group: 'sandbox', url: 'http://localhost:5434', apiUrl: 'http://localhost:5434/api/2.0', docsUrl: 'http://localhost:5434/docs' }
    };
  }

  /**
   * Get status of all services
   * @param {string} workingDir - The lakehouse root directory
   * @returns {Promise<Object>} Service status information
   */
  async getServiceStatus(workingDir) {
    try {
      // Get all containers (running and stopped)
      const containers = await this.docker.listContainers({ all: true });
      
      // Create a map of existing containers with smart deduplication
      const existingContainers = new Map();
      containers.forEach(container => {
        const containerName = this.extractContainerName(container.Names[0]);
        const service = this.identifyService(containerName);
        if (service) {
          const containerInfo = {
            name: containerName,
            status: container.State,
            ports: this.extractPorts(container.Ports),
            image: container.Image,
            created: new Date(container.Created * 1000).toISOString(),
            createdTimestamp: container.Created,
            id: container.Id,
            exists: true
          };

          // Smart deduplication: prefer running containers over stopped ones,
          // and newer containers over older ones
          const existing = existingContainers.get(service);
          if (!existing || this.shouldReplaceContainer(existing, containerInfo)) {
            existingContainers.set(service, containerInfo);
          }
        }
      });

      const serviceStatus = {
        timestamp: new Date().toISOString(),
        groups: {
          core: { services: [], running: 0, stopped: 0, paused: 0, notCreated: 0, total: 0 },
          kafka: { services: [], running: 0, stopped: 0, paused: 0, notCreated: 0, total: 0 },
          airflow: { services: [], running: 0, stopped: 0, paused: 0, notCreated: 0, total: 0 },
          sandbox: { services: [], running: 0, stopped: 0, paused: 0, notCreated: 0, total: 0 }
        },
        totalRunning: 0,
        totalStopped: 0,
        totalPaused: 0,
        totalNotCreated: 0,
        totalServices: 0
      };

      // Process all expected services from serviceMetadata
      // This ensures services appear even when containers don't exist
      for (const [serviceKey, metadata] of Object.entries(this.serviceMetadata)) {
        const existingContainer = existingContainers.get(serviceKey);
        
        const serviceInfo = {
          name: existingContainer ? existingContainer.name : this.getExpectedContainerName(serviceKey),
          displayName: metadata.name,
          status: existingContainer ? existingContainer.status : 'not-created',
          ports: existingContainer ? existingContainer.ports : (metadata.port ? [{ private: metadata.port, type: 'tcp' }] : []),
          image: existingContainer ? existingContainer.image : 'Unknown',
          created: existingContainer ? existingContainer.created : new Date().toISOString(),
          id: existingContainer ? existingContainer.id : 'not-created',
          url: metadata.url,
          credentials: metadata.credentials,
          exists: !!existingContainer
        };

        const group = metadata.group || 'core';
        serviceStatus.groups[group].services.push(serviceInfo);
        serviceStatus.groups[group].total++;
        
        // Update detailed status counts
        if (existingContainer) {
          switch (existingContainer.status) {
            case 'running':
              serviceStatus.groups[group].running++;
              serviceStatus.totalRunning++;
              break;
            case 'paused':
              serviceStatus.groups[group].paused++;
              serviceStatus.totalPaused++;
              break;
            case 'exited':
            case 'dead':
              serviceStatus.groups[group].stopped++;
              serviceStatus.totalStopped++;
              break;
            default:
              // Handle other statuses like 'created', 'restarting' as stopped
              serviceStatus.groups[group].stopped++;
              serviceStatus.totalStopped++;
              break;
          }
        } else {
          serviceStatus.groups[group].notCreated++;
          serviceStatus.totalNotCreated++;
        }
        
        serviceStatus.totalServices++;
      }

      return serviceStatus;
    } catch (error) {
      console.error('Error getting service status:', error);
      throw new Error(`Failed to get service status: ${error.message}`);
    }
  }

  /**
   * Determine if a new container should replace an existing one
   * Priority: running > stopped, newer > older
   * @param {Object} existing - Existing container info
   * @param {Object} newContainer - New container info to compare
   * @returns {boolean} True if new container should replace existing
   */
  shouldReplaceContainer(existing, newContainer) {
    // Prefer running containers over stopped ones
    const existingRunning = existing.status === 'running';
    const newRunning = newContainer.status === 'running';
    
    if (existingRunning && !newRunning) {
      return false; // Keep running container
    }
    
    if (!existingRunning && newRunning) {
      return true; // Replace stopped container with running one
    }
    
    // If both have same running status, prefer newer container
    return newContainer.createdTimestamp > existing.createdTimestamp;
  }

  /**
   * Get expected container name for a service
   * @param {string} serviceKey - Service key from metadata
   * @returns {string} Expected container name
   */
  getExpectedContainerName(serviceKey) {
    // Map service keys to their expected container names
    const nameMap = {
      'polaris': 'polaris',
      'trino': 'trino', 
      'minio': 'minio',
      'spark-iceberg': 'spark-iceberg',
      'nimtable': 'nimtable',
      'snowflake-sandbox': 'lakehouse-sandbox-snowflake-sandbox-1',
      'kafka1': 'kafka1',
      'kafka2': 'kafka2', 
      'kafka3': 'kafka3',
      'kafka-ui': 'kafka-ui',
      'airflow-webserver': 'lakehouse-sandbox-airflow-webserver-1',
      'airflow-scheduler': 'lakehouse-sandbox-airflow-scheduler-1', 
      'airflow-worker': 'lakehouse-sandbox-airflow-worker-1',
      'airflow-postgres': 'lakehouse-sandbox-airflow-postgres-1',
      'airflow-redis': 'lakehouse-sandbox-airflow-redis-1'
    };
    
    return nameMap[serviceKey] || serviceKey;
  }

  /**
   * Get logs for a specific container
   * @param {string} containerName - Name of the container
   * @param {number} tail - Number of lines to tail (default: 100)
   * @returns {Promise<string>} Container logs
   */
  async getLogs(containerName, tail = 100) {
    try {
      const container = this.docker.getContainer(containerName);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: tail,
        timestamps: true
      });
      return logs.toString();
    } catch (error) {
      throw new Error(`Failed to get logs for ${containerName}: ${error.message}`);
    }
  }

  /**
   * Stream logs for a specific container
   * @param {string} containerName - Name of the container
   * @returns {NodeJS.ReadableStream} Log stream
   */
  streamLogs(containerName) {
    try {
      const container = this.docker.getContainer(containerName);
      return container.logs({
        stdout: true,
        stderr: true,
        follow: true,
        timestamps: true
      });
    } catch (error) {
      throw new Error(`Failed to stream logs for ${containerName}: ${error.message}`);
    }
  }

  /**
   * Start a specific container
   * @param {string} containerName - Name of the container
   * @returns {Promise<Object>} Start result
   */
  async startContainer(containerName) {
    try {
      const container = this.docker.getContainer(containerName);
      const result = await container.start();
      return {
        containerName,
        action: 'start',
        status: 'success',
        result
      };
    } catch (error) {
      throw new Error(`Failed to start container ${containerName}: ${error.message}`);
    }
  }

  /**
   * Stop a specific container
   * @param {string} containerName - Name of the container
   * @returns {Promise<Object>} Stop result
   */
  async stopContainer(containerName) {
    try {
      const container = this.docker.getContainer(containerName);
      const result = await container.stop();
      return {
        containerName,
        action: 'stop',
        status: 'success',
        result
      };
    } catch (error) {
      throw new Error(`Failed to stop container ${containerName}: ${error.message}`);
    }
  }

  /**
   * Restart a specific container
   * @param {string} containerName - Name of the container
   * @returns {Promise<Object>} Restart result
   */
  async restartContainer(containerName) {
    try {
      const container = this.docker.getContainer(containerName);
      const result = await container.restart();
      return {
        containerName,
        action: 'restart',
        status: 'success',
        result
      };
    } catch (error) {
      throw new Error(`Failed to restart container ${containerName}: ${error.message}`);
    }
  }

  /**
   * Get container statistics
   * @param {string} containerName - Name of the container
   * @returns {Promise<Object>} Container stats
   */
  async getContainerStats(containerName) {
    try {
      const container = this.docker.getContainer(containerName);
      const stats = await container.stats({ stream: false });
      return this.parseContainerStats(stats);
    } catch (error) {
      throw new Error(`Failed to get stats for ${containerName}: ${error.message}`);
    }
  }

  /**
   * Get Docker system information
   * @returns {Promise<Object>} Docker system info
   */
  async getSystemInfo() {
    try {
      const info = await this.docker.info();
      return {
        containers: info.Containers,
        containersRunning: info.ContainersRunning,
        containersPaused: info.ContainersPaused,
        containersStopped: info.ContainersStopped,
        images: info.Images,
        memTotal: info.MemTotal,
        serverVersion: info.ServerVersion
      };
    } catch (error) {
      throw new Error(`Failed to get Docker system info: ${error.message}`);
    }
  }

  /**
   * Helper method to extract container name from Docker names array
   * @param {string} fullName - Full container name (e.g., "/container-name")
   * @returns {string} Clean container name
   */
  extractContainerName(fullName) {
    return fullName.replace(/^\//, '');
  }

  /**
   * Helper method to identify service from container name
   * @param {string} containerName - Container name
   * @returns {string|null} Service identifier
   */
  identifyService(containerName) {
    // Direct matches
    if (this.serviceMetadata[containerName]) {
      return containerName;
    }

    // Pattern matching for generated container names
    for (const service of Object.keys(this.serviceMetadata)) {
      if (containerName.includes(service) || containerName === service) {
        return service;
      }
    }

    return null;
  }

  /**
   * Helper method to extract port information
   * @param {Array} ports - Docker ports array
   * @returns {Array} Formatted port information
   */
  extractPorts(ports) {
    if (!ports || !Array.isArray(ports)) return [];
    
    return ports.map(port => ({
      private: port.PrivatePort,
      public: port.PublicPort,
      type: port.Type
    }));
  }

  /**
   * Helper method to parse container statistics
   * @param {Object} stats - Raw Docker stats
   * @returns {Object} Parsed stats
   */
  parseContainerStats(stats) {
    if (!stats) return {};

    const cpuPercent = this.calculateCPUPercent(stats);
    const memoryUsage = this.calculateMemoryUsage(stats);

    return {
      cpuPercent: cpuPercent.toFixed(2),
      memoryUsage: memoryUsage.usage,
      memoryLimit: memoryUsage.limit,
      memoryPercent: memoryUsage.percent.toFixed(2),
      networkRx: stats.networks?.eth0?.rx_bytes || 0,
      networkTx: stats.networks?.eth0?.tx_bytes || 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate CPU usage percentage
   */
  calculateCPUPercent(stats) {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                     (stats.precpu_stats.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats.system_cpu_usage - 
                        (stats.precpu_stats.system_cpu_usage || 0);
    
    if (systemDelta > 0.0 && cpuDelta > 0.0) {
      const cpuCount = stats.cpu_stats.online_cpus || 1;
      return (cpuDelta / systemDelta) * cpuCount * 100.0;
    }
    
    return 0.0;
  }

  /**
   * Calculate memory usage
   */
  calculateMemoryUsage(stats) {
    const usage = stats.memory_stats.usage || 0;
    const limit = stats.memory_stats.limit || 0;
    
    return {
      usage: usage,
      limit: limit,
      percent: limit > 0 ? (usage / limit) * 100 : 0
    };
  }
}

module.exports = new DockerService();