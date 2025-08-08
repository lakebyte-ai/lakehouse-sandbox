export interface ServiceInfo {
  name: string;
  displayName: string;
  status: 'running' | 'exited' | 'created' | 'restarting' | 'paused' | 'dead' | 'not-created';
  ports: Array<{
    private: number;
    public?: number;
    type: string;
  }>;
  image: string;
  created: string;
  id: string;
  url?: string;
  credentials?: string;
  exists?: boolean;
}

export interface ServiceGroup {
  services: ServiceInfo[];
  running: number;
  stopped: number;
  paused: number;
  notCreated: number;
  total: number;
}

export interface ServiceStatus {
  timestamp: string;
  groups: {
    core: ServiceGroup;
    kafka: ServiceGroup;
    airflow: ServiceGroup;
  };
  totalRunning: number;
  totalStopped: number;
  totalPaused: number;
  totalNotCreated: number;
  totalServices: number;
}

export interface CommandResult {
  success: boolean;
  command: string;
  output?: string;
  error?: string;
  exitCode?: number;
  timestamp: string;
}

export interface LogData {
  service: string;
  data: string;
  timestamp: string;
}

export interface SystemInfo {
  docker: {
    containers: number;
    containersRunning: number;
    containersPaused: number;
    containersStopped: number;
    images: number;
    memTotal: number;
    serverVersion: string;
  };
  make: {
    available: boolean;
    lakehouseRoot: string;
  };
  timestamp: string;
}

export interface AvailableCommand {
  name: string;
  description: string;
}

export type ServiceGroupName = 'core' | 'kafka' | 'airflow';

// File management types
export interface FileInfo {
  path: string;
  description: string;
  type: 'env' | 'docker-compose' | 'makefile' | 'properties';
}

export interface FileContent {
  filePath: string;
  content: string;
  stats: {
    size: number;
    modified: string;
    created: string;
    isDirectory: boolean;
    permissions: string;
  };
}

export interface DirectoryListing {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

// Terminal types
export interface Terminal {
  id: string;
  type: 'host' | 'container';
  options: {
    containerName?: string;
    shell?: string;
    cols?: number;
    rows?: number;
  };
  created: string;
  lastActivity: string;
  pid: number;
}

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: Array<{
    private: number;
    public?: number;
    type: string;
  }>;
}

// Resource monitoring types
export interface ResourceSnapshot {
  timestamp: string;
  containers: Record<string, ContainerResource>;
  system: SystemResource | null;
  systemHistory: SystemResource[];
}

export interface ContainerResource {
  name: string;
  image: string;
  current: ResourceMetrics;
  history: ResourceMetrics[];
}

export interface ResourceMetrics {
  timestamp: string;
  cpu: {
    percent: number;
    usage: number;
    system: number;
  };
  memory: {
    usage: number;
    limit: number;
    percent: number;
    cache: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
  };
  disk: {
    readBytes: number;
    writeBytes: number;
    readOps: number;
    writeOps: number;
  };
}

export interface SystemResource {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  disk: {
    total: string;
    used: string;
    free: string;
    percent: number;
  };
  docker: {
    containers: number;
    containersRunning: number;
    containersStopped: number;
    images: number;
    version: string;
  };
}

export interface WebSocketEvents {
  serviceStatus: ServiceStatus;
  commandResult: CommandResult;
  logData: LogData;
  logError: { service: string; error: string };
  error: { message: string };
  
  // Terminal events
  terminalCreated: { sessionId: string; type: string; options: any };
  terminalData: { sessionId: string; data: string };
  terminalExit: { sessionId: string; code: number; signal: string };
  terminalError: { sessionId: string; error: string };
  terminalDestroyed: { sessionId: string };
  
  // File events
  fileChanged: { filePath: string; type: string };
  fileWatchStarted: { filePath: string };
  fileWatchStopped: { filePath: string };
  fileWatchError: { filePath: string; error: string };
  
  // Resource monitoring events
  resourceUpdate: ResourceSnapshot;
}