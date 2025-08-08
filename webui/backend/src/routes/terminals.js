const express = require('express');
const router = express.Router();
const terminalService = require('../services/terminalService');

// === TERMINAL MANAGEMENT ENDPOINTS ===

/**
 * GET /terminals
 * List all terminal sessions
 */
router.get('/', (req, res) => {
  try {
    const terminals = terminalService.listTerminals();
    res.json({
      terminals,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list terminals',
      message: error.message
    });
  }
});

/**
 * POST /terminals
 * Create a new terminal session
 */
router.post('/', (req, res) => {
  try {
    const { type, options = {} } = req.body;
    
    if (!type || !['host', 'container'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid terminal type',
        message: 'Type must be either "host" or "container"'
      });
    }

    if (type === 'container' && !options.containerName) {
      return res.status(400).json({
        error: 'Container name required',
        message: 'Container name must be specified for container terminals'
      });
    }

    const sessionId = terminalService.createTerminal(type, options);
    
    res.json({
      sessionId,
      type,
      options,
      message: 'Terminal session created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create terminal',
      message: error.message
    });
  }
});

/**
 * GET /terminals/:sessionId
 * Get terminal session information
 */
router.get('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const terminalInfo = terminalService.getTerminalInfo(sessionId);
    
    if (!terminalInfo) {
      return res.status(404).json({
        error: 'Terminal session not found',
        sessionId
      });
    }

    res.json(terminalInfo);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get terminal info',
      message: error.message
    });
  }
});

/**
 * POST /terminals/:sessionId/resize
 * Resize terminal session
 */
router.post('/:sessionId/resize', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { cols, rows } = req.body;
    
    if (!cols || !rows || cols < 1 || rows < 1) {
      return res.status(400).json({
        error: 'Invalid dimensions',
        message: 'Cols and rows must be positive integers'
      });
    }

    terminalService.resizeTerminal(sessionId, cols, rows);
    
    res.json({
      message: 'Terminal resized successfully',
      sessionId,
      cols,
      rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to resize terminal',
      message: error.message
    });
  }
});

/**
 * DELETE /terminals/:sessionId
 * Destroy terminal session
 */
router.delete('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    terminalService.destroyTerminal(sessionId);
    
    res.json({
      message: 'Terminal session destroyed',
      sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to destroy terminal',
      message: error.message
    });
  }
});

/**
 * GET /containers
 * Get available containers for terminal access
 */
router.get('/containers/available', async (req, res) => {
  try {
    const containers = await terminalService.getAvailableContainers();
    res.json({
      containers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get available containers',
      message: error.message
    });
  }
});

/**
 * GET /containers/:containerName/shells
 * Test available shells in container
 */
router.get('/containers/:containerName/shells', async (req, res) => {
  try {
    const { containerName } = req.params;
    const shellInfo = await terminalService.testContainerShell(containerName);
    
    res.json({
      containerName,
      ...shellInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to test container shells',
      message: error.message
    });
  }
});

module.exports = router;