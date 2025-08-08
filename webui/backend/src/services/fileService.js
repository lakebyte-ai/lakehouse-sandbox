const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');

class FileService {
  constructor() {
    this.watchers = new Map();
    this.allowedFiles = [
      '.env.airflow',
      'docker-compose.yml',
      'docker-compose.kafka.yml',
      'docker-compose.airflow.yml',
      'docker-compose.webui.yml',
      'Makefile',
      'trino/catalog/iceberg.properties',
    ];
    
    this.allowedDirectories = [
      'airflow/dags',
      'notebooks',
      'trino/catalog',
    ];
  }

  /**
   * Validate if file access is allowed
   * @param {string} filePath - The file path to validate
   * @param {string} lakehouseRoot - The lakehouse root directory
   * @returns {boolean} Whether the file is allowed
   */
  isFileAllowed(filePath, lakehouseRoot) {
    const absolutePath = path.resolve(lakehouseRoot, filePath);
    const relativePath = path.relative(lakehouseRoot, absolutePath);
    
    // Prevent path traversal attacks
    if (relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      return false;
    }

    // Check allowed files
    if (this.allowedFiles.includes(relativePath)) {
      return true;
    }

    // Check allowed directories
    return this.allowedDirectories.some(dir => relativePath.startsWith(dir));
  }

  /**
   * Read a configuration file
   * @param {string} filePath - Relative path to the file
   * @param {string} lakehouseRoot - The lakehouse root directory
   * @returns {Promise<{content: string, stats: object}>}
   */
  async readFile(filePath, lakehouseRoot) {
    if (!this.isFileAllowed(filePath, lakehouseRoot)) {
      throw new Error(`Access to file '${filePath}' is not allowed`);
    }

    const absolutePath = path.resolve(lakehouseRoot, filePath);
    
    try {
      const [content, stats] = await Promise.all([
        fs.readFile(absolutePath, 'utf8'),
        fs.stat(absolutePath)
      ]);

      return {
        content,
        stats: {
          size: stats.size,
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString(),
          isDirectory: stats.isDirectory(),
          permissions: stats.mode.toString(8)
        }
      };
    } catch (error) {
      throw new Error(`Failed to read file '${filePath}': ${error.message}`);
    }
  }

  /**
   * Write to a configuration file
   * @param {string} filePath - Relative path to the file
   * @param {string} content - File content
   * @param {string} lakehouseRoot - The lakehouse root directory
   * @returns {Promise<{success: boolean, backup?: string}>}
   */
  async writeFile(filePath, content, lakehouseRoot) {
    if (!this.isFileAllowed(filePath, lakehouseRoot)) {
      throw new Error(`Access to file '${filePath}' is not allowed`);
    }

    const absolutePath = path.resolve(lakehouseRoot, filePath);
    
    try {
      // Create backup of existing file
      let backupPath = null;
      try {
        await fs.access(absolutePath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = `${absolutePath}.backup.${timestamp}`;
        await fs.copyFile(absolutePath, backupPath);
      } catch (error) {
        // File doesn't exist, no backup needed
      }

      // Write new content
      await fs.writeFile(absolutePath, content, 'utf8');

      return {
        success: true,
        backup: backupPath
      };
    } catch (error) {
      throw new Error(`Failed to write file '${filePath}': ${error.message}`);
    }
  }

  /**
   * List files in a directory
   * @param {string} dirPath - Relative directory path
   * @param {string} lakehouseRoot - The lakehouse root directory
   * @returns {Promise<Array<{name: string, isDirectory: boolean, size: number, modified: string}>>}
   */
  async listDirectory(dirPath, lakehouseRoot) {
    const relativePath = dirPath === '.' ? '' : dirPath;
    
    if (!this.isDirectoryAllowed(relativePath, lakehouseRoot)) {
      throw new Error(`Access to directory '${dirPath}' is not allowed`);
    }

    const absolutePath = path.resolve(lakehouseRoot, relativePath);
    
    try {
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        const entryPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          if (this.allowedDirectories.some(dir => dir.startsWith(entryPath) || entryPath.startsWith(dir))) {
            const stats = await fs.stat(path.join(absolutePath, entry.name));
            files.push({
              name: entry.name,
              path: entryPath,
              isDirectory: true,
              size: 0,
              modified: stats.mtime.toISOString()
            });
          }
        } else {
          if (this.isFileAllowed(entryPath, lakehouseRoot)) {
            const stats = await fs.stat(path.join(absolutePath, entry.name));
            files.push({
              name: entry.name,
              path: entryPath,
              isDirectory: false,
              size: stats.size,
              modified: stats.mtime.toISOString()
            });
          }
        }
      }

      return files.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      throw new Error(`Failed to list directory '${dirPath}': ${error.message}`);
    }
  }

  /**
   * Check if directory access is allowed
   * @param {string} dirPath - The directory path to validate
   * @param {string} lakehouseRoot - The lakehouse root directory
   * @returns {boolean} Whether the directory is allowed
   */
  isDirectoryAllowed(dirPath, lakehouseRoot) {
    if (!dirPath || dirPath === '.') {
      return true; // Root directory is allowed
    }

    const absolutePath = path.resolve(lakehouseRoot, dirPath);
    const relativePath = path.relative(lakehouseRoot, absolutePath);
    
    // Prevent path traversal attacks
    if (relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      return false;
    }

    return this.allowedDirectories.some(dir => 
      dir === relativePath || dir.startsWith(relativePath) || relativePath.startsWith(dir)
    );
  }

  /**
   * Watch a file for changes
   * @param {string} filePath - Relative path to the file
   * @param {string} lakehouseRoot - The lakehouse root directory
   * @param {Function} callback - Callback function for changes
   */
  watchFile(filePath, lakehouseRoot, callback) {
    if (!this.isFileAllowed(filePath, lakehouseRoot)) {
      throw new Error(`Cannot watch file '${filePath}': access not allowed`);
    }

    const absolutePath = path.resolve(lakehouseRoot, filePath);
    const watchKey = absolutePath;

    if (this.watchers.has(watchKey)) {
      return; // Already watching this file
    }

    const watcher = chokidar.watch(absolutePath, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('change', () => {
      console.log(`File changed: ${filePath}`);
      callback({ type: 'change', filePath });
    });

    watcher.on('error', (error) => {
      console.error(`File watcher error for ${filePath}:`, error);
      callback({ type: 'error', filePath, error: error.message });
    });

    this.watchers.set(watchKey, watcher);
  }

  /**
   * Stop watching a file
   * @param {string} filePath - Relative path to the file
   * @param {string} lakehouseRoot - The lakehouse root directory
   */
  unwatchFile(filePath, lakehouseRoot) {
    const absolutePath = path.resolve(lakehouseRoot, filePath);
    const watchKey = absolutePath;

    if (this.watchers.has(watchKey)) {
      this.watchers.get(watchKey).close();
      this.watchers.delete(watchKey);
      console.log(`Stopped watching file: ${filePath}`);
    }
  }

  /**
   * Get list of allowed files for configuration editing
   * @returns {Array<{path: string, description: string, type: string}>}
   */
  getAllowedFiles() {
    return [
      {
        path: '.env.airflow',
        description: 'Airflow environment variables',
        type: 'env'
      },
      {
        path: 'docker-compose.yml',
        description: 'Core services configuration',
        type: 'docker-compose'
      },
      {
        path: 'docker-compose.kafka.yml',
        description: 'Kafka services configuration',
        type: 'docker-compose'
      },
      {
        path: 'docker-compose.airflow.yml',
        description: 'Airflow services configuration',
        type: 'docker-compose'
      },
      {
        path: 'docker-compose.webui.yml',
        description: 'WebUI services configuration',
        type: 'docker-compose'
      },
      {
        path: 'Makefile',
        description: 'Build and deployment commands',
        type: 'makefile'
      },
      {
        path: 'trino/catalog/iceberg.properties',
        description: 'Trino Iceberg catalog configuration',
        type: 'properties'
      }
    ];
  }

  /**
   * Cleanup all watchers
   */
  cleanup() {
    for (const [, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

module.exports = new FileService();