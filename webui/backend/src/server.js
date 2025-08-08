const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const dockerService = require('./services/dockerService');
const makeService = require('./services/makeService');
const terminalService = require('./services/terminalService');
const resourceMonitorService = require('./services/resourceMonitorService');
const fileService = require('./services/fileService');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;
const LAKEHOUSE_ROOT = process.env.LAKEHOUSE_ROOT || path.resolve(__dirname, '../../../');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api', apiRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send initial status
  dockerService.getServiceStatus(LAKEHOUSE_ROOT)
    .then(status => {
      socket.emit('serviceStatus', status);
    })
    .catch(err => {
      console.error('Error getting initial status:', err);
      socket.emit('error', { message: 'Failed to get service status' });
    });

  // Handle service commands
  socket.on('executeCommand', async (data) => {
    try {
      console.log(`Executing command: ${data.command}`);
      const result = await makeService.executeCommand(data.command, LAKEHOUSE_ROOT);
      socket.emit('commandResult', {
        command: data.command,
        success: true,
        output: result.output,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Command execution failed:', error);
      socket.emit('commandResult', {
        command: data.command,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle log streaming requests
  socket.on('streamLogs', (data) => {
    const { service } = data;
    console.log(`Starting log stream for service: ${service}`);
    
    try {
      const logStream = dockerService.streamLogs(service);
      
      logStream.on('data', (chunk) => {
        socket.emit('logData', {
          service,
          data: chunk.toString(),
          timestamp: new Date().toISOString()
        });
      });

      logStream.on('error', (error) => {
        console.error(`Log stream error for ${service}:`, error);
        socket.emit('logError', {
          service,
          error: error.message
        });
      });

      // Store reference to cleanup on disconnect
      socket.logStreams = socket.logStreams || {};
      socket.logStreams[service] = logStream;

    } catch (error) {
      console.error('Failed to start log stream:', error);
      socket.emit('logError', {
        service,
        error: error.message
      });
    }
  });

  socket.on('stopLogStream', (data) => {
    const { service } = data;
    if (socket.logStreams && socket.logStreams[service]) {
      socket.logStreams[service].destroy();
      delete socket.logStreams[service];
      console.log(`Stopped log stream for service: ${service}`);
    }
  });

  // === TERMINAL HANDLERS ===
  
  socket.on('createTerminal', (data) => {
    try {
      const { type, options = {} } = data;
      console.log(`Creating ${type} terminal for client ${socket.id}`);
      
      const sessionId = terminalService.createTerminal(type, options);
      
      // Set up terminal event handlers
      terminalService.setupTerminalEvents(sessionId, {
        onData: (data) => {
          socket.emit('terminalData', { sessionId, data });
        },
        onExit: (code, signal) => {
          socket.emit('terminalExit', { sessionId, code, signal });
        },
        onError: (error) => {
          socket.emit('terminalError', { sessionId, error: error.message });
        }
      });
      
      socket.emit('terminalCreated', { sessionId, type, options });
      
      // Store terminal session for cleanup
      if (!socket.terminals) {
        socket.terminals = new Set();
      }
      socket.terminals.add(sessionId);
      
    } catch (error) {
      console.error('Failed to create terminal:', error);
      socket.emit('terminalError', { error: error.message });
    }
  });

  socket.on('terminalInput', (data) => {
    try {
      const { sessionId, input } = data;
      terminalService.writeToTerminal(sessionId, input);
    } catch (error) {
      console.error('Terminal input error:', error);
      socket.emit('terminalError', { sessionId: data.sessionId, error: error.message });
    }
  });

  socket.on('resizeTerminal', (data) => {
    try {
      const { sessionId, cols, rows } = data;
      terminalService.resizeTerminal(sessionId, cols, rows);
    } catch (error) {
      console.error('Terminal resize error:', error);
      socket.emit('terminalError', { sessionId: data.sessionId, error: error.message });
    }
  });

  socket.on('destroyTerminal', (data) => {
    try {
      const { sessionId } = data;
      terminalService.destroyTerminal(sessionId);
      if (socket.terminals) {
        socket.terminals.delete(sessionId);
      }
      socket.emit('terminalDestroyed', { sessionId });
    } catch (error) {
      console.error('Terminal destroy error:', error);
      socket.emit('terminalError', { sessionId: data.sessionId, error: error.message });
    }
  });

  // === FILE WATCHER HANDLERS ===
  
  socket.on('watchFile', (data) => {
    try {
      const { filePath } = data;
      console.log(`Starting file watch for: ${filePath}`);
      
      fileService.watchFile(filePath, LAKEHOUSE_ROOT, (event) => {
        socket.emit('fileChanged', { filePath, ...event });
      });
      
      socket.emit('fileWatchStarted', { filePath });
      
      if (!socket.watchedFiles) {
        socket.watchedFiles = new Set();
      }
      socket.watchedFiles.add(filePath);
      
    } catch (error) {
      console.error('File watch error:', error);
      socket.emit('fileWatchError', { filePath: data.filePath, error: error.message });
    }
  });

  socket.on('unwatchFile', (data) => {
    try {
      const { filePath } = data;
      fileService.unwatchFile(filePath, LAKEHOUSE_ROOT);
      if (socket.watchedFiles) {
        socket.watchedFiles.delete(filePath);
      }
      socket.emit('fileWatchStopped', { filePath });
    } catch (error) {
      console.error('File unwatch error:', error);
      socket.emit('fileWatchError', { filePath: data.filePath, error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Cleanup log streams
    if (socket.logStreams) {
      Object.values(socket.logStreams).forEach(stream => {
        try {
          stream.destroy();
        } catch (err) {
          console.error('Error destroying log stream:', err);
        }
      });
    }
    
    // Cleanup terminal sessions
    if (socket.terminals) {
      socket.terminals.forEach(sessionId => {
        try {
          terminalService.destroyTerminal(sessionId);
        } catch (err) {
          console.error('Error destroying terminal:', err);
        }
      });
    }
    
    // Cleanup file watchers
    if (socket.watchedFiles) {
      socket.watchedFiles.forEach(filePath => {
        try {
          fileService.unwatchFile(filePath, LAKEHOUSE_ROOT);
        } catch (err) {
          console.error('Error unwatching file:', err);
        }
      });
    }
  });
});

// Periodic status updates
setInterval(async () => {
  try {
    const status = await dockerService.getServiceStatus(LAKEHOUSE_ROOT);
    io.emit('serviceStatus', status);
  } catch (error) {
    console.error('Error broadcasting status update:', error);
  }
}, 5000); // Update every 5 seconds

// Broadcast resource monitoring updates
setInterval(() => {
  try {
    const monitoringStatus = resourceMonitorService.getStatus();
    if (monitoringStatus.isMonitoring) {
      const snapshot = resourceMonitorService.getCurrentSnapshot();
      io.emit('resourceUpdate', snapshot);
    }
  } catch (error) {
    console.error('Error broadcasting resource update:', error);
  }
}, 10000); // Update every 10 seconds

// Cleanup inactive terminal sessions every 5 minutes
setInterval(() => {
  try {
    terminalService.cleanupInactiveSessions(30); // 30 minutes inactive
  } catch (error) {
    console.error('Error cleaning up terminal sessions:', error);
  }
}, 5 * 60 * 1000);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    lakehouseRoot: LAKEHOUSE_ROOT
  });
});

server.listen(PORT, () => {
  console.log(`Lakehouse Sandbox WebUI Backend running on port ${PORT}`);
  console.log(`Lakehouse root directory: ${LAKEHOUSE_ROOT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Start resource monitoring
  resourceMonitorService.startMonitoring(5000);
  console.log('Resource monitoring started');
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  console.log('Received shutdown signal, cleaning up...');
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Cleanup services
    terminalService.cleanup();
    resourceMonitorService.stopMonitoring();
    fileService.cleanup();
    
    console.log('Cleanup completed, exiting...');
    process.exit(0);
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
}

module.exports = { app, server, io };