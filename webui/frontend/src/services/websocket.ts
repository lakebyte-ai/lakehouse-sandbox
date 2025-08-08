import { io, Socket } from 'socket.io-client';
import { WebSocketEvents } from '../types';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url?: string): Socket {
    // In development, let Vite handle WebSocket proxying
    // In production, use environment variable or default
    const isDevelopment = import.meta.env.DEV;
    const wsUrl = url || (isDevelopment ? undefined : (import.meta.env.VITE_WS_URL || 'ws://localhost:5001'));
    
    console.log('Connecting to WebSocket:', wsUrl);
    
    this.socket = io(wsUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed after', this.maxReconnectAttempts, 'attempts');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      console.log('Disconnecting WebSocket');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Event listeners
  onServiceStatus(callback: (data: WebSocketEvents['serviceStatus']) => void) {
    this.socket?.on('serviceStatus', callback);
  }

  onCommandResult(callback: (data: WebSocketEvents['commandResult']) => void) {
    this.socket?.on('commandResult', callback);
  }

  onLogData(callback: (data: WebSocketEvents['logData']) => void) {
    this.socket?.on('logData', callback);
  }

  onLogError(callback: (data: WebSocketEvents['logError']) => void) {
    this.socket?.on('logError', callback);
  }

  onError(callback: (data: WebSocketEvents['error']) => void) {
    this.socket?.on('error', callback);
  }

  // Event emitters
  executeCommand(command: string) {
    console.log('Sending command via WebSocket:', command);
    this.socket?.emit('executeCommand', { command });
  }

  streamLogs(service: string) {
    console.log('Starting log stream for:', service);
    this.socket?.emit('streamLogs', { service });
  }

  stopLogStream(service: string) {
    console.log('Stopping log stream for:', service);
    this.socket?.emit('stopLogStream', { service });
  }

  // Utility methods
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Remove all listeners for cleanup
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }
}

// Create singleton instance
export const websocketService = new WebSocketService();
export default websocketService;