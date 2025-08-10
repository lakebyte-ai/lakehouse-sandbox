const express = require('express');
const router = express.Router();
const resourceMonitorService = require('../services/resourceMonitorService');

// === RESOURCE MONITORING ENDPOINTS ===

/**
 * GET /monitoring/status
 * Get monitoring service status
 */
router.get('/status', (req, res) => {
  try {
    const status = resourceMonitorService.getStatus();
    res.json({
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get monitoring status',
      message: error.message
    });
  }
});

/**
 * POST /monitoring/start
 * Start resource monitoring
 */
router.post('/start', (req, res) => {
  try {
    const { interval = 5000 } = req.body;
    
    if (interval < 1000 || interval > 60000) {
      return res.status(400).json({
        error: 'Invalid interval',
        message: 'Interval must be between 1000ms and 60000ms'
      });
    }

    resourceMonitorService.startMonitoring(interval);
    
    res.json({
      message: 'Resource monitoring started',
      interval,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to start monitoring',
      message: error.message
    });
  }
});

/**
 * POST /monitoring/stop
 * Stop resource monitoring
 */
router.post('/stop', (req, res) => {
  try {
    resourceMonitorService.stopMonitoring();
    
    res.json({
      message: 'Resource monitoring stopped',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to stop monitoring',
      message: error.message
    });
  }
});

/**
 * GET /monitoring/snapshot
 * Get current resource snapshot
 */
router.get('/snapshot', (req, res) => {
  try {
    const snapshot = resourceMonitorService.getCurrentSnapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get resource snapshot',
      message: error.message
    });
  }
});

/**
 * GET /monitoring/container/:containerId
 * Get resource history for specific container
 */
router.get('/container/:containerId', (req, res) => {
  try {
    const { containerId } = req.params;
    const { points = 30 } = req.query;
    
    const history = resourceMonitorService.getContainerHistory(
      containerId, 
      parseInt(points)
    );
    
    if (!history) {
      return res.status(404).json({
        error: 'Container not found',
        containerId
      });
    }

    res.json({
      containerId,
      ...history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get container history',
      message: error.message
    });
  }
});

/**
 * DELETE /monitoring/history
 * Clear monitoring history
 */
router.delete('/history', (req, res) => {
  try {
    resourceMonitorService.clearHistory();
    
    res.json({
      message: 'Monitoring history cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear history',
      message: error.message
    });
  }
});

/**
 * GET /monitoring/services
 * Get health status of all lakehouse services
 */
router.get('/services', async (req, res) => {
  try {
    const services = await resourceMonitorService.getServicesHealth();
    res.json({
      services,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get services health',
      message: error.message
    });
  }
});

/**
 * GET /monitoring/services/:serviceName/metrics
 * Get metrics from a specific service
 */
router.get('/services/:serviceName/metrics', async (req, res) => {
  try {
    const { serviceName } = req.params;
    const metrics = await resourceMonitorService.getServiceMetrics(serviceName);
    
    if (!metrics) {
      return res.status(404).json({
        error: 'Service not found',
        serviceName
      });
    }

    res.json({
      serviceName,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get service metrics',
      message: error.message
    });
  }
});

module.exports = router;