const pty = require('node-pty');
const Docker = require('dockerode');
const { v4: uuidv4 } = require('uuid');

class TerminalService {
  constructor() {
    this.terminals = new Map();
    this.docker = new Docker();
  }

  /**
   * Create a new terminal session
   * @param {string} type - Terminal type: 'host', 'container'
   * @param {object} options - Terminal options
   * @returns {string} Terminal session ID
   */
  createTerminal(type, options = {}) {
    const sessionId = uuidv4();
    
    try {
      let terminal;
      
      if (type === 'host') {
        terminal = this.createHostTerminal(options);
      } else if (type === 'container') {
        terminal = this.createContainerTerminal(options);
      } else {
        throw new Error(`Unsupported terminal type: ${type}`);
      }

      this.terminals.set(sessionId, {
        type,
        terminal,
        options,
        created: new Date(),
        lastActivity: new Date()
      });

      console.log(`Created ${type} terminal session: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error(`Failed to create ${type} terminal:`, error);
      throw error;
    }
  }

  /**
   * Create a host terminal session
   * @param {object} options - Terminal options
   * @returns {object} PTY instance
   */
  createHostTerminal(options = {}) {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const cwd = options.workingDirectory || process.cwd();
    
    return pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });
  }

  /**
   * Create a container terminal session
   * @param {object} options - Terminal options including containerName
   * @returns {object} PTY instance for docker exec
   */
  createContainerTerminal(options = {}) {
    if (!options.containerName) {
      throw new Error('Container name is required for container terminal');
    }

    const shell = options.shell || '/bin/bash';
    const containerName = options.containerName;
    
    // Use docker exec to connect to container
    return pty.spawn('docker', [
      'exec', '-it', containerName, shell
    ], {
      name: 'xterm-color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });
  }

  /**
   * Write data to a terminal session
   * @param {string} sessionId - Terminal session ID
   * @param {string} data - Data to write
   */
  writeToTerminal(sessionId, data) {
    const session = this.terminals.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }

    session.terminal.write(data);
    session.lastActivity = new Date();
  }

  /**
   * Resize a terminal session
   * @param {string} sessionId - Terminal session ID
   * @param {number} cols - Number of columns
   * @param {number} rows - Number of rows
   */
  resizeTerminal(sessionId, cols, rows) {
    const session = this.terminals.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }

    session.terminal.resize(cols, rows);
    session.lastActivity = new Date();
  }

  /**
   * Set up event handlers for a terminal session
   * @param {string} sessionId - Terminal session ID
   * @param {object} eventHandlers - Event handler functions
   */
  setupTerminalEvents(sessionId, eventHandlers = {}) {
    const session = this.terminals.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }

    const { terminal } = session;

    // Handle terminal data output
    terminal.on('data', (data) => {
      session.lastActivity = new Date();
      if (eventHandlers.onData) {
        eventHandlers.onData(data);
      }
    });

    // Handle terminal exit
    terminal.on('exit', (code, signal) => {
      console.log(`Terminal ${sessionId} exited with code ${code}, signal ${signal}`);
      this.destroyTerminal(sessionId);
      if (eventHandlers.onExit) {
        eventHandlers.onExit(code, signal);
      }
    });

    // Handle terminal errors
    terminal.on('error', (error) => {
      console.error(`Terminal ${sessionId} error:`, error);
      if (eventHandlers.onError) {
        eventHandlers.onError(error);
      }
    });
  }

  /**
   * Get terminal session information
   * @param {string} sessionId - Terminal session ID
   * @returns {object|null} Terminal session info
   */
  getTerminalInfo(sessionId) {
    const session = this.terminals.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      id: sessionId,
      type: session.type,
      options: session.options,
      created: session.created,
      lastActivity: session.lastActivity,
      pid: session.terminal.pid
    };
  }

  /**
   * List all terminal sessions
   * @returns {Array<object>} Array of terminal session info
   */
  listTerminals() {
    const terminals = [];
    for (const [sessionId] of this.terminals) {
      terminals.push(this.getTerminalInfo(sessionId));
    }
    return terminals;
  }

  /**
   * Destroy a terminal session
   * @param {string} sessionId - Terminal session ID
   */
  destroyTerminal(sessionId) {
    const session = this.terminals.get(sessionId);
    if (session) {
      try {
        session.terminal.kill();
      } catch (error) {
        console.error(`Error killing terminal ${sessionId}:`, error);
      }
      
      this.terminals.delete(sessionId);
      console.log(`Destroyed terminal session: ${sessionId}`);
    }
  }

  /**
   * Get available containers for terminal access
   * @returns {Promise<Array<{id: string, name: string, status: string, image: string}>>}
   */
  async getAvailableContainers() {
    try {
      const containers = await this.docker.listContainers({ all: false }); // Only running containers
      
      return containers
        .filter(container => {
          // Filter for lakehouse-related containers
          const names = container.Names || [];
          return names.some(name => 
            name.includes('lakehouse-sandbox') || 
            ['polaris', 'trino', 'minio', 'spark-iceberg', 'nimtable', 'kafka1', 'kafka2', 'kafka3', 'kafka-ui', 'zookeeper'].some(service => 
              name.includes(service)
            )
          );
        })
        .map(container => ({
          id: container.Id.substring(0, 12),
          name: container.Names[0].replace(/^\//, ''),
          status: container.State,
          image: container.Image,
          ports: container.Ports || []
        }));
    } catch (error) {
      console.error('Error getting available containers:', error);
      throw new Error(`Failed to get containers: ${error.message}`);
    }
  }

  /**
   * Test container shell availability
   * @param {string} containerName - Container name
   * @param {string} shell - Shell to test (default: /bin/bash)
   * @returns {Promise<{available: boolean, shells: Array<string>}>}
   */
  async testContainerShell(containerName, shell = '/bin/bash') {
    try {
      const container = this.docker.getContainer(containerName);
      
      // Test different shells
      const shellsToTest = ['/bin/bash', '/bin/sh', '/bin/ash', '/bin/zsh'];
      const availableShells = [];

      for (const testShell of shellsToTest) {
        try {
          const exec = await container.exec({
            Cmd: [testShell, '-c', 'echo "test"'],
            AttachStdout: true,
            AttachStderr: true
          });
          
          const stream = await exec.start({ Detach: false });
          await new Promise((resolve) => {
            stream.on('end', resolve);
          });
          
          availableShells.push(testShell);
        } catch (error) {
          // Shell not available
        }
      }

      return {
        available: availableShells.length > 0,
        shells: availableShells
      };
    } catch (error) {
      return {
        available: false,
        shells: [],
        error: error.message
      };
    }
  }

  /**
   * Cleanup all terminal sessions
   */
  cleanup() {
    console.log('Cleaning up all terminal sessions...');
    for (const [sessionId] of this.terminals) {
      this.destroyTerminal(sessionId);
    }
  }

  /**
   * Cleanup inactive terminal sessions
   * @param {number} maxInactiveMinutes - Maximum inactive minutes before cleanup
   */
  cleanupInactiveSessions(maxInactiveMinutes = 30) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - (maxInactiveMinutes * 60 * 1000));
    
    for (const [sessionId, session] of this.terminals) {
      if (session.lastActivity < cutoff) {
        console.log(`Cleaning up inactive terminal session: ${sessionId}`);
        this.destroyTerminal(sessionId);
      }
    }
  }
}

module.exports = new TerminalService();