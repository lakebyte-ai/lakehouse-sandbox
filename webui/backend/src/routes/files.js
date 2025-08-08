const express = require('express');
const router = express.Router();
const fileService = require('../services/fileService');
const path = require('path');

// Get the lakehouse root directory from environment or default
const LAKEHOUSE_ROOT = process.env.LAKEHOUSE_ROOT || path.resolve(__dirname, '../../../../');

// === FILE MANAGEMENT ENDPOINTS ===

/**
 * GET /files
 * Get list of allowed configuration files
 */
router.get('/', (req, res) => {
  try {
    const files = fileService.getAllowedFiles();
    res.json({
      files,
      lakehouseRoot: LAKEHOUSE_ROOT
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get file list',
      message: error.message
    });
  }
});

/**
 * GET /files/list/:dirPath?
 * List files in a directory
 */
router.get('/list/*?', async (req, res) => {
  try {
    const dirPath = req.params[0] || '.';
    const files = await fileService.listDirectory(dirPath, LAKEHOUSE_ROOT);
    
    res.json({
      path: dirPath,
      files,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list directory',
      message: error.message
    });
  }
});

/**
 * GET /files/content/*
 * Read a configuration file
 */
router.get('/content/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    if (!filePath) {
      return res.status(400).json({
        error: 'File path is required'
      });
    }

    const fileData = await fileService.readFile(filePath, LAKEHOUSE_ROOT);
    res.json({
      filePath,
      ...fileData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read file',
      message: error.message,
      filePath: req.params[0]
    });
  }
});

/**
 * POST /files/content/*
 * Write to a configuration file
 */
router.post('/content/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const { content } = req.body;

    if (!filePath) {
      return res.status(400).json({
        error: 'File path is required'
      });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({
        error: 'Content must be a string'
      });
    }

    const result = await fileService.writeFile(filePath, content, LAKEHOUSE_ROOT);
    res.json({
      filePath,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to write file',
      message: error.message,
      filePath: req.params[0]
    });
  }
});

/**
 * POST /files/watch/*
 * Start watching a file for changes
 */
router.post('/watch/*', (req, res) => {
  try {
    const filePath = req.params[0];
    
    if (!filePath) {
      return res.status(400).json({
        error: 'File path is required'
      });
    }

    // This would typically be handled via WebSocket
    // For now, just acknowledge the request
    res.json({
      message: 'File watching should be handled via WebSocket',
      filePath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to start watching file',
      message: error.message
    });
  }
});

/**
 * DELETE /files/watch/*
 * Stop watching a file
 */
router.delete('/watch/*', (req, res) => {
  try {
    const filePath = req.params[0];
    
    if (!filePath) {
      return res.status(400).json({
        error: 'File path is required'
      });
    }

    fileService.unwatchFile(filePath, LAKEHOUSE_ROOT);
    res.json({
      message: 'Stopped watching file',
      filePath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to stop watching file',
      message: error.message
    });
  }
});

module.exports = router;