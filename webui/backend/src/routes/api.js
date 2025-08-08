const express = require('express');
const router = express.Router();
const dockerService = require('../services/dockerService');
const makeService = require('../services/makeService');
const path = require('path');

// Import sub-routers
const filesRouter = require('./files');
const terminalsRouter = require('./terminals');
const monitoringRouter = require('./monitoring');

// Get the lakehouse root directory from environment or default
const LAKEHOUSE_ROOT = process.env.LAKEHOUSE_ROOT || path.resolve(__dirname, '../../../../');

// Mount sub-routers
router.use('/files', filesRouter);
router.use('/terminals', terminalsRouter);
router.use('/monitoring', monitoringRouter);

// Middleware to validate lakehouse directory
router.use(async (req, res, next) => {
  try {
    const isValid = await makeService.validateLakehouseDirectory(LAKEHOUSE_ROOT);
    if (!isValid) {
      return res.status(500).json({
        error: 'Invalid lakehouse directory',
        message: 'Could not find required lakehouse-sandbox files',
        lakehouseRoot: LAKEHOUSE_ROOT
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      error: 'Directory validation failed',
      message: error.message
    });
  }
});

// === SERVICE STATUS ENDPOINTS ===

/**
 * GET /api/status
 * Get current status of all services
 */
router.get('/status', async (req, res) => {
  try {
    const status = await dockerService.getServiceStatus(LAKEHOUSE_ROOT);
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get service status',
      message: error.message
    });
  }
});

/**
 * GET /api/status/:group
 * Get status of specific service group (core, kafka, airflow)
 */
router.get('/status/:group', async (req, res) => {
  try {
    const { group } = req.params;
    const validGroups = ['core', 'kafka', 'airflow'];
    
    if (!validGroups.includes(group)) {
      return res.status(400).json({
        error: 'Invalid service group',
        message: `Group must be one of: ${validGroups.join(', ')}`
      });
    }

    const fullStatus = await dockerService.getServiceStatus(LAKEHOUSE_ROOT);
    const groupStatus = fullStatus.groups[group];
    
    if (!groupStatus) {
      return res.status(404).json({
        error: 'Service group not found',
        message: `No services found for group: ${group}`
      });
    }

    res.json({
      group,
      timestamp: fullStatus.timestamp,
      ...groupStatus
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get service group status',
      message: error.message
    });
  }
});

// === COMMAND EXECUTION ENDPOINTS ===

/**
 * POST /api/commands/execute
 * Execute a make command
 */
router.post('/commands/execute', async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({
        error: 'Missing command',
        message: 'Command is required in request body'
      });
    }

    const result = await makeService.executeCommand(command, LAKEHOUSE_ROOT);
    res.json({
      success: true,
      command,
      output: result.output,
      exitCode: result.exitCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      command: req.body.command,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/commands
 * Get list of available commands
 */
router.get('/commands', (req, res) => {
  try {
    const commands = makeService.getAvailableCommands();
    res.json({
      commands: commands.map(cmd => ({
        name: cmd,
        description: getCommandDescription(cmd)
      }))
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get available commands',
      message: error.message
    });
  }
});

/**
 * GET /api/help
 * Get make help output
 */
router.get('/help', async (req, res) => {
  try {
    const help = await makeService.getHelp(LAKEHOUSE_ROOT);
    res.json({
      help,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get help',
      message: error.message
    });
  }
});

// === CONTAINER LOGS ENDPOINTS ===

/**
 * GET /api/logs/:containerName
 * Get logs for a specific container
 */
router.get('/logs/:containerName', async (req, res) => {
  try {
    const { containerName } = req.params;
    const tail = parseInt(req.query.tail) || 100;
    
    const logs = await dockerService.getLogs(containerName, tail);
    res.json({
      containerName,
      logs,
      tail,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get container logs',
      message: error.message,
      containerName: req.params.containerName
    });
  }
});

// === INDIVIDUAL CONTAINER CONTROL ENDPOINTS ===

/**
 * POST /api/containers/:containerName/start
 * Start a specific container
 */
router.post('/containers/:containerName/start', async (req, res) => {
  try {
    const { containerName } = req.params;
    const result = await dockerService.startContainer(containerName);
    
    res.json({
      success: true,
      containerName,
      action: 'start',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      containerName: req.params.containerName,
      action: 'start',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/containers/:containerName/stop
 * Stop a specific container
 */
router.post('/containers/:containerName/stop', async (req, res) => {
  try {
    const { containerName } = req.params;
    const result = await dockerService.stopContainer(containerName);
    
    res.json({
      success: true,
      containerName,
      action: 'stop',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      containerName: req.params.containerName,
      action: 'stop',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/containers/:containerName/restart
 * Restart a specific container
 */
router.post('/containers/:containerName/restart', async (req, res) => {
  try {
    const { containerName } = req.params;
    const result = await dockerService.restartContainer(containerName);
    
    res.json({
      success: true,
      containerName,
      action: 'restart',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      containerName: req.params.containerName,
      action: 'restart',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// === CONTAINER STATS ENDPOINTS ===

/**
 * GET /api/stats/:containerName
 * Get statistics for a specific container
 */
router.get('/stats/:containerName', async (req, res) => {
  try {
    const { containerName } = req.params;
    const stats = await dockerService.getContainerStats(containerName);
    
    res.json({
      containerName,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get container stats',
      message: error.message,
      containerName: req.params.containerName
    });
  }
});

// === TESTING ENDPOINTS ===

/**
 * POST /api/test/run
 * Run integration tests
 */
router.post('/test/run', async (req, res) => {
  try {
    const { groups, verbose = false } = req.body;
    
    const testCommand = ['./tests/integration/run_tests.sh'];
    
    if (verbose) {
      testCommand.push('--verbose');
    }
    
    if (groups && Array.isArray(groups)) {
      testCommand.push('--groups');
      testCommand.push(...groups);
    }
    
    // Add JSON output to temp file
    const reportFile = `reports/test-${Date.now()}.json`;
    testCommand.push('--output', reportFile);
    
    const result = await new Promise((resolve) => {
      const { spawn } = require('child_process');
      const proc = spawn(testCommand[0], testCommand.slice(1), {
        cwd: LAKEHOUSE_ROOT,
        stdio: 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code,
          stdout,
          stderr,
          reportFile
        });
      });
    });
    
    // Try to read the JSON report if it exists
    let testReport = null;
    try {
      if (result.success) {
        const fs = require('fs');
        const reportPath = path.join(LAKEHOUSE_ROOT, result.reportFile);
        if (fs.existsSync(reportPath)) {
          testReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        }
      }
    } catch (error) {
      console.warn('Could not read test report:', error.message);
    }
    
    res.json({
      success: result.success,
      exitCode: result.exitCode,
      output: result.stdout,
      error: result.stderr,
      report: testReport,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to run integration tests',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/test/reports
 * Get list of available test reports
 */
router.get('/test/reports', (req, res) => {
  try {
    const fs = require('fs');
    const reportsDir = path.join(LAKEHOUSE_ROOT, 'reports');
    
    if (!fs.existsSync(reportsDir)) {
      return res.json({ reports: [] });
    }
    
    const files = fs.readdirSync(reportsDir)
      .filter(file => file.endsWith('.json') && file.includes('test'))
      .map(file => {
        const filePath = path.join(reportsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: `reports/${file}`,
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
    
    res.json({ reports: files });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list test reports',
      message: error.message
    });
  }
});

// === SYSTEM INFO ENDPOINTS ===

/**
 * GET /api/system
 * Get Docker system information
 */
router.get('/system', async (req, res) => {
  try {
    const systemInfo = await dockerService.getSystemInfo();
    const makeAvailable = await makeService.checkMakeAvailable(LAKEHOUSE_ROOT);
    
    res.json({
      docker: systemInfo,
      make: {
        available: makeAvailable,
        lakehouseRoot: LAKEHOUSE_ROOT
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system information',
      message: error.message
    });
  }
});

// === UTILITY FUNCTIONS ===

/**
 * Get human-readable description for make commands
 * @param {string} command - The make command
 * @returns {string} Command description
 */
function getCommandDescription(command) {
  const descriptions = {
    // Core operations
    'all': 'Start all services',
    'up': 'Start all services (alias for all)',
    'down': 'Stop all services',
    'stop': 'Stop all services (alias for down)',
    'restart': 'Restart all services',
    'status': 'Show status of all services',
    'ps': 'Show status of all services (alias for status)',
    'logs': 'Show logs for all services',
    'clean': 'Stop all services and remove containers/volumes',
    'clean-all': 'Complete cleanup including network',
    'info': 'Show service information and URLs',
    'healthcheck': 'Show health status of all services',
    
    // Individual service groups
    'core-up': 'Start core lakehouse services',
    'core-down': 'Stop core lakehouse services',
    'core-status': 'Show status of core services',
    'core-logs': 'Show logs for core services',
    'core-restart': 'Restart core services',
    
    'kafka-up': 'Start Kafka cluster and UI',
    'kafka-down': 'Stop Kafka services',
    'kafka-status': 'Show status of Kafka services',
    'kafka-logs': 'Show logs for Kafka services',
    'kafka-restart': 'Restart Kafka services',
    
    'airflow-up': 'Start Airflow services',
    'airflow-down': 'Stop Airflow services',
    'airflow-status': 'Show status of Airflow services',
    'airflow-logs': 'Show logs for Airflow services',
    'airflow-restart': 'Restart Airflow services',
    
    // Development helpers
    'pull': 'Pull latest images for all services',
    'build': 'Build custom images',
    'watch': 'Watch status of all services',
    
    // Network management
    'network': 'Create the shared Docker network',
    'network-clean': 'Remove the shared Docker network',
    
    // Shell access
    'shell-spark': 'Open bash shell in Spark container',
    'shell-airflow': 'Open bash shell in Airflow webserver container',
    'shell-trino': 'Open Trino CLI'
  };
  
  return descriptions[command] || `Execute make ${command}`;
}

module.exports = router;