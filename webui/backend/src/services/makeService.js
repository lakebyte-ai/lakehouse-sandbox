const { spawn, exec } = require('child_process');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

class MakeService {
  constructor() {
    this.availableCommands = [
      // Core operations
      'all', 'up', 'down', 'stop', 'restart', 'status', 'ps',
      'logs', 'clean', 'clean-all', 'info', 'healthcheck', 'help',
      
      // Individual service groups
      'core-up', 'core-down', 'core-status', 'core-logs', 'core-restart',
      'kafka-up', 'kafka-down', 'kafka-status', 'kafka-logs', 'kafka-restart',
      'airflow-up', 'airflow-down', 'airflow-status', 'airflow-logs', 'airflow-restart',
      
      // Development helpers
      'pull', 'build', 'watch',
      
      // Network management
      'network', 'network-clean',
      
      // Shell access
      'shell-spark', 'shell-airflow', 'shell-trino'
    ];
  }

  /**
   * Execute a make command
   * @param {string} command - The make command to execute
   * @param {string} workingDir - The working directory (lakehouse root)
   * @returns {Promise<{output: string, exitCode: number}>}
   */
  async executeCommand(command, workingDir) {
    return new Promise((resolve, reject) => {
      if (!this.availableCommands.includes(command)) {
        reject(new Error(`Command '${command}' is not allowed`));
        return;
      }

      const makeProcess = spawn('make', [command], {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let output = '';
      let errorOutput = '';

      makeProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      makeProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      makeProcess.on('close', (code) => {
        const result = {
          output: output + (errorOutput ? '\n--- STDERR ---\n' + errorOutput : ''),
          exitCode: code
        };

        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${result.output}`));
        }
      });

      makeProcess.on('error', (error) => {
        reject(new Error(`Failed to execute command: ${error.message}`));
      });

      // Set timeout for long-running commands
      const timeout = setTimeout(() => {
        makeProcess.kill();
        reject(new Error(`Command '${command}' timed out after 5 minutes`));
      }, 300000); // 5 minutes

      makeProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Execute a make command and stream output
   * @param {string} command - The make command to execute
   * @param {string} workingDir - The working directory
   * @param {Function} onData - Callback for streaming data
   * @returns {ChildProcess} The spawned process
   */
  executeCommandStream(command, workingDir, onData) {
    if (!this.availableCommands.includes(command)) {
      throw new Error(`Command '${command}' is not allowed`);
    }

    const makeProcess = spawn('make', [command], {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    makeProcess.stdout.on('data', (data) => {
      onData({ type: 'stdout', data: data.toString() });
    });

    makeProcess.stderr.on('data', (data) => {
      onData({ type: 'stderr', data: data.toString() });
    });

    makeProcess.on('close', (code) => {
      onData({ type: 'exit', code });
    });

    makeProcess.on('error', (error) => {
      onData({ type: 'error', message: error.message });
    });

    return makeProcess;
  }

  /**
   * Get available commands
   * @returns {Array<string>} List of available make commands
   */
  getAvailableCommands() {
    return [...this.availableCommands];
  }

  /**
   * Check if make is available
   * @param {string} workingDir - The working directory
   * @returns {Promise<boolean>}
   */
  async checkMakeAvailable(workingDir) {
    try {
      await execAsync('which make', { cwd: workingDir });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get make help output
   * @param {string} workingDir - The working directory
   * @returns {Promise<string>}
   */
  async getHelp(workingDir) {
    try {
      const result = await this.executeCommand('help', workingDir);
      return result.output;
    } catch (error) {
      throw new Error(`Failed to get help: ${error.message}`);
    }
  }

  /**
   * Validate that we're in a lakehouse-sandbox directory
   * @param {string} workingDir - The working directory to check
   * @returns {Promise<boolean>}
   */
  async validateLakehouseDirectory(workingDir) {
    try {
      const fs = require('fs').promises;
      
      // Check for key files that indicate this is a lakehouse-sandbox project
      const requiredFiles = [
        'Makefile',
        'docker-compose.yml',
        'docker-compose.kafka.yml',
        'docker-compose.airflow.yml'
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(workingDir, file);
        try {
          await fs.access(filePath);
        } catch {
          return false;
        }
      }

      // Check if Makefile contains lakehouse-specific targets
      const makefilePath = path.join(workingDir, 'Makefile');
      const makefileContent = await fs.readFile(makefilePath, 'utf8');
      
      return makefileContent.includes('Lakehouse Sandbox') && 
             makefileContent.includes('core-up') &&
             makefileContent.includes('kafka-up') &&
             makefileContent.includes('airflow-up');
    } catch {
      return false;
    }
  }
}

module.exports = new MakeService();