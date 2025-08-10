const Docker = require('dockerode');
const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');

const execAsync = util.promisify(exec);

class ResourceMonitorService {
  constructor() {
    this.docker = new Docker();
    this.monitoringInterval = null;
    this.resourceHistory = new Map(); // Store resource history for containers
    this.systemHistory = [];
    this.maxHistoryPoints = 60; // Keep 60 data points (5 minutes at 5s intervals)
  }

  /**
   * Start resource monitoring
   * @param {number} intervalMs - Monitoring interval in milliseconds
   */
  startMonitoring(intervalMs = 5000) {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log(`Starting resource monitoring with ${intervalMs}ms interval`);
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectResourceData();
      } catch (error) {
        console.error('Error collecting resource data:', error);
      }
    }, intervalMs);

    // Collect initial data
    this.collectResourceData();
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Stopped resource monitoring');
    }
  }

  /**
   * Collect resource data for all containers and system
   */
  async collectResourceData() {
    const timestamp = new Date().toISOString();
    
    // Collect container stats
    await this.collectContainerStats(timestamp);
    
    // Collect system stats
    await this.collectSystemStats(timestamp);
  }

  /**
   * Collect container resource statistics
   * @param {string} timestamp - Current timestamp
   */
  async collectContainerStats(timestamp) {
    try {
      const containers = await this.docker.listContainers();
      
      for (const containerInfo of containers) {
        const container = this.docker.getContainer(containerInfo.Id);
        
        try {
          const stats = await container.stats({ stream: false });
          const parsedStats = this.parseContainerStats(stats, timestamp);
          
          if (!this.resourceHistory.has(containerInfo.Id)) {
            this.resourceHistory.set(containerInfo.Id, {
              name: containerInfo.Names[0].replace(/^\//, ''),
              image: containerInfo.Image,
              data: []
            });
          }
          
          const history = this.resourceHistory.get(containerInfo.Id);
          history.data.push(parsedStats);
          
          // Keep only recent data points
          if (history.data.length > this.maxHistoryPoints) {
            history.data.shift();
          }
        } catch (error) {
          console.error(`Error getting stats for container ${containerInfo.Names[0]}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error collecting container stats:', error);
    }
  }

  /**
   * Collect system resource statistics
   * @param {string} timestamp - Current timestamp
   */
  async collectSystemStats(timestamp) {
    try {
      const systemStats = await this.getSystemStats();
      
      this.systemHistory.push({
        timestamp,
        ...systemStats
      });
      
      // Keep only recent data points
      if (this.systemHistory.length > this.maxHistoryPoints) {
        this.systemHistory.shift();
      }
    } catch (error) {
      console.error('Error collecting system stats:', error);
    }
  }

  /**
   * Parse Docker container statistics
   * @param {object} stats - Raw Docker stats
   * @param {string} timestamp - Current timestamp
   * @returns {object} Parsed statistics
   */
  parseContainerStats(stats, timestamp) {
    const cpuPercent = this.calculateCPUPercent(stats);
    const memoryStats = this.calculateMemoryStats(stats);
    const networkStats = this.calculateNetworkStats(stats);
    const diskStats = this.calculateDiskStats(stats);

    return {
      timestamp,
      cpu: {
        percent: parseFloat(cpuPercent.toFixed(2)),
        usage: stats.cpu_stats?.cpu_usage?.total_usage || 0,
        system: stats.cpu_stats?.system_cpu_usage || 0
      },
      memory: {
        usage: memoryStats.usage,
        limit: memoryStats.limit,
        percent: parseFloat(memoryStats.percent.toFixed(2)),
        cache: stats.memory_stats?.cache || 0
      },
      network: {
        rxBytes: networkStats.rxBytes,
        txBytes: networkStats.txBytes,
        rxPackets: networkStats.rxPackets,
        txPackets: networkStats.txPackets
      },
      disk: {
        readBytes: diskStats.readBytes,
        writeBytes: diskStats.writeBytes,
        readOps: diskStats.readOps,
        writeOps: diskStats.writeOps
      }
    };
  }

  /**
   * Calculate CPU usage percentage
   * @param {object} stats - Docker stats
   * @returns {number} CPU percentage
   */
  calculateCPUPercent(stats) {
    const cpuDelta = stats.cpu_stats?.cpu_usage?.total_usage - 
                     (stats.precpu_stats?.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats?.system_cpu_usage - 
                        (stats.precpu_stats?.system_cpu_usage || 0);
    
    if (systemDelta > 0 && cpuDelta > 0) {
      const cpuCount = stats.cpu_stats?.online_cpus || 1;
      return (cpuDelta / systemDelta) * cpuCount * 100.0;
    }
    
    return 0.0;
  }

  /**
   * Calculate memory statistics
   * @param {object} stats - Docker stats
   * @returns {object} Memory statistics
   */
  calculateMemoryStats(stats) {
    const usage = stats.memory_stats?.usage || 0;
    const limit = stats.memory_stats?.limit || 0;
    
    return {
      usage,
      limit,
      percent: limit > 0 ? (usage / limit) * 100 : 0
    };
  }

  /**
   * Calculate network statistics
   * @param {object} stats - Docker stats
   * @returns {object} Network statistics
   */
  calculateNetworkStats(stats) {
    const networks = stats.networks || {};
    let rxBytes = 0, txBytes = 0, rxPackets = 0, txPackets = 0;
    
    Object.values(networks).forEach(network => {
      rxBytes += network.rx_bytes || 0;
      txBytes += network.tx_bytes || 0;
      rxPackets += network.rx_packets || 0;
      txPackets += network.tx_packets || 0;
    });
    
    return { rxBytes, txBytes, rxPackets, txPackets };
  }

  /**
   * Calculate disk I/O statistics
   * @param {object} stats - Docker stats
   * @returns {object} Disk I/O statistics
   */
  calculateDiskStats(stats) {
    const blkio = stats.blkio_stats?.io_service_bytes_recursive || [];
    let readBytes = 0, writeBytes = 0;
    
    blkio.forEach(stat => {
      if (stat.op === 'Read') readBytes += stat.value;
      if (stat.op === 'Write') writeBytes += stat.value;
    });
    
    const ioOps = stats.blkio_stats?.io_serviced_recursive || [];
    let readOps = 0, writeOps = 0;
    
    ioOps.forEach(stat => {
      if (stat.op === 'Read') readOps += stat.value;
      if (stat.op === 'Write') writeOps += stat.value;
    });
    
    return { readBytes, writeBytes, readOps, writeOps };
  }

  /**
   * Get system resource statistics
   * @returns {Promise<object>} System statistics
   */
  async getSystemStats() {
    try {
      // Get CPU info
      const cpuInfo = await this.getCPUInfo();
      
      // Get memory info
      const memoryInfo = await this.getMemoryInfo();
      
      // Get disk info
      const diskInfo = await this.getDiskInfo();
      
      // Get Docker system info
      const dockerInfo = await this.docker.info();
      
      return {
        cpu: cpuInfo,
        memory: memoryInfo,
        disk: diskInfo,
        docker: {
          containers: dockerInfo.Containers,
          containersRunning: dockerInfo.ContainersRunning,
          containersStopped: dockerInfo.ContainersStopped,
          images: dockerInfo.Images,
          version: dockerInfo.ServerVersion
        }
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return {};
    }
  }

  /**
   * Get CPU information
   * @returns {Promise<object>} CPU information
   */
  async getCPUInfo() {
    try {
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync('top -l 1 -s 0 | grep "CPU usage"');
        const match = stdout.match(/(\d+\.?\d*)% user/);
        const usage = match ? parseFloat(match[1]) : 0;
        
        return {
          usage: usage,
          cores: require('os').cpus().length,
          model: require('os').cpus()[0]?.model || 'Unknown'
        };
      } else {
        // Linux
        const { stdout } = await execAsync('cat /proc/loadavg');
        const loadAvg = stdout.trim().split(' ')[0];
        
        return {
          usage: parseFloat(loadAvg) * 100,
          cores: require('os').cpus().length,
          model: require('os').cpus()[0]?.model || 'Unknown'
        };
      }
    } catch (error) {
      return {
        usage: 0,
        cores: require('os').cpus().length,
        model: 'Unknown'
      };
    }
  }

  /**
   * Get memory information
   * @returns {Promise<object>} Memory information
   */
  async getMemoryInfo() {
    try {
      const totalMem = require('os').totalmem();
      const freeMem = require('os').freemem();
      const usedMem = totalMem - freeMem;
      
      return {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percent: (usedMem / totalMem) * 100
      };
    } catch (error) {
      return {
        total: 0,
        used: 0,
        free: 0,
        percent: 0
      };
    }
  }

  /**
   * Get disk information
   * @returns {Promise<object>} Disk information
   */
  async getDiskInfo() {
    try {
      const { stdout } = await execAsync('df -h .');
      const lines = stdout.trim().split('\n');
      const diskLine = lines[1].split(/\s+/);
      
      return {
        total: diskLine[1],
        used: diskLine[2],
        free: diskLine[3],
        percent: parseFloat(diskLine[4]) || 0
      };
    } catch (error) {
      return {
        total: '0B',
        used: '0B',
        free: '0B',
        percent: 0
      };
    }
  }

  /**
   * Get current resource snapshot
   * @returns {object} Current resource data
   */
  getCurrentSnapshot() {
    const containers = {};
    
    for (const [containerId, history] of this.resourceHistory) {
      if (history.data.length > 0) {
        containers[containerId] = {
          name: history.name,
          image: history.image,
          current: history.data[history.data.length - 1],
          history: history.data.slice(-10) // Last 10 points
        };
      }
    }
    
    return {
      timestamp: new Date().toISOString(),
      containers,
      system: this.systemHistory.length > 0 ? 
        this.systemHistory[this.systemHistory.length - 1] : null,
      systemHistory: this.systemHistory.slice(-10)
    };
  }

  /**
   * Get resource history for a specific container
   * @param {string} containerId - Container ID
   * @param {number} points - Number of data points to return
   * @returns {object|null} Container resource history
   */
  getContainerHistory(containerId, points = 30) {
    const history = this.resourceHistory.get(containerId);
    if (!history) {
      return null;
    }
    
    return {
      name: history.name,
      image: history.image,
      data: history.data.slice(-points)
    };
  }

  /**
   * Clear all resource history
   */
  clearHistory() {
    this.resourceHistory.clear();
    this.systemHistory = [];
    console.log('Cleared all resource monitoring history');
  }

  /**
   * Get monitoring status
   * @returns {object} Monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.monitoringInterval !== null,
      containerCount: this.resourceHistory.size,
      systemHistoryPoints: this.systemHistory.length,
      maxHistoryPoints: this.maxHistoryPoints
    };
  }

  /**
   * Get health status of all lakehouse services
   * @returns {Promise<object>} Services health status
   */
  async getServicesHealth() {
    const services = {
      polaris: { name: 'Polaris Catalog', url: 'http://localhost:8181/api/catalog/', port: 8181 },
      trino: { name: 'Trino Query Engine', url: 'http://localhost:8080/v1/info', port: 8080 },
      minio: { name: 'MinIO Storage', url: 'http://localhost:9000/minio/health/live', port: 9000 },
      'spark-iceberg': { name: 'Spark Iceberg', url: 'http://localhost:8888/api', port: 8888 },
      nimtable: { name: 'NimTable', url: 'http://localhost:18182/api/health', port: 18182 },
      'snowflake-sandbox': { name: 'Snowflake Sandbox (Experimental)', url: 'http://localhost:5435/health', port: 5435 },
      'databricks-sandbox': { name: 'Databricks Sandbox (Experimental)', url: 'http://localhost:5434/health', port: 5434 }
    };

    const results = {};
    
    for (const [key, service] of Object.entries(services)) {
      try {
        const startTime = Date.now();
        const response = await axios.get(service.url, { timeout: 5000 });
        const responseTime = Date.now() - startTime;
        
        results[key] = {
          name: service.name,
          status: 'healthy',
          responseTime,
          port: service.port,
          lastCheck: new Date().toISOString(),
          details: response.data || 'OK'
        };
      } catch (error) {
        results[key] = {
          name: service.name,
          status: 'unhealthy',
          port: service.port,
          lastCheck: new Date().toISOString(),
          error: error.message,
          details: error.response?.data || null
        };
      }
    }

    return results;
  }

  /**
   * Get metrics from a specific service
   * @param {string} serviceName - Name of the service
   * @returns {Promise<object|null>} Service metrics
   */
  async getServiceMetrics(serviceName) {
    const metricsEndpoints = {
      'snowflake-sandbox': 'http://localhost:5432/metrics',
      'databricks-sandbox': 'http://localhost:18000/metrics'
    };

    const endpoint = metricsEndpoints[serviceName];
    if (!endpoint) {
      return null;
    }

    try {
      const response = await axios.get(endpoint, { 
        timeout: 5000,
        headers: { 'Accept': 'text/plain' }
      });
      
      return {
        raw: response.data,
        contentType: response.headers['content-type'],
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: error.message,
        lastAttempt: new Date().toISOString()
      };
    }
  }
}

module.exports = new ResourceMonitorService();