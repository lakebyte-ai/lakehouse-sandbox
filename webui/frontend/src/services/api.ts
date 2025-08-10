import axios from 'axios';
import { ServiceStatus, CommandResult, SystemInfo, AvailableCommand } from '../types';

// In development, use relative URLs for Vite proxy
// In production, use environment variable or default
const isDevelopment = import.meta.env.DEV;
const API_BASE_URL = isDevelopment ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:5001');

const api = axios.create({
  baseURL: isDevelopment ? '/api' : `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const apiService = {
  // Health check
  async healthCheck() {
    const healthUrl = isDevelopment ? '/health' : `${API_BASE_URL}/health`;
    const response = await axios.get(healthUrl);
    return response.data;
  },

  // Service status
  async getServiceStatus(): Promise<ServiceStatus> {
    const response = await api.get('/status');
    return response.data;
  },

  async getServiceGroupStatus(group: 'core' | 'kafka' | 'airflow') {
    const response = await api.get(`/status/${group}`);
    return response.data;
  },

  // Commands
  async executeCommand(command: string): Promise<CommandResult> {
    const response = await api.post('/commands/execute', { command });
    return response.data;
  },

  async getAvailableCommands(): Promise<{ commands: AvailableCommand[] }> {
    const response = await api.get('/commands');
    return response.data;
  },

  async getHelp() {
    const response = await api.get('/help');
    return response.data;
  },

  // Logs
  async getContainerLogs(containerName: string, tail: number = 100) {
    const response = await api.get(`/logs/${containerName}`, {
      params: { tail },
    });
    return response.data;
  },

  // Statistics
  async getContainerStats(containerName: string) {
    const response = await api.get(`/stats/${containerName}`);
    return response.data;
  },

  // System info
  async getSystemInfo(): Promise<SystemInfo> {
    const response = await api.get('/system');
    return response.data;
  },

  // Individual container controls
  async startContainer(containerName: string) {
    const response = await api.post(`/containers/${containerName}/start`);
    return response.data;
  },

  async stopContainer(containerName: string) {
    const response = await api.post(`/containers/${containerName}/stop`);
    return response.data;
  },

  async restartContainer(containerName: string) {
    const response = await api.post(`/containers/${containerName}/restart`);
    return response.data;
  },

  // Monitoring
  async getServicesHealth() {
    const response = await api.get('/monitoring/services');
    return response.data;
  },

  async getServiceMetrics(serviceName: string) {
    const response = await api.get(`/monitoring/services/${serviceName}/metrics`);
    return response.data;
  },

  async getResourceSnapshot() {
    const response = await api.get('/monitoring/snapshot');
    return response.data;
  },
};

export default apiService;