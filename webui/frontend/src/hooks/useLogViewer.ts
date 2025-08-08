import { useState, useEffect, useRef } from 'react';
import { LogData } from '../types';
import apiService from '../services/api';
import websocketService from '../services/websocket';

export function useLogViewer(serviceName?: string) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Load initial logs for a service
  const loadInitialLogs = async (containerName: string, tail: number = 100) => {
    try {
      setError(null);
      const response = await apiService.getContainerLogs(containerName, tail);
      const logLines = response.logs.split('\n').filter((line: string) => line.trim());
      setLogs(logLines);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load logs';
      setError(errorMessage);
      console.error('Error loading initial logs:', errorMessage);
    }
  };

  // Start streaming logs via WebSocket
  const startStreaming = (serviceId: string) => {
    if (isStreaming) {
      console.warn('Already streaming logs for', serviceId);
      return;
    }

    console.log('Starting log stream for:', serviceId);
    setIsStreaming(true);
    setError(null);
    
    websocketService.streamLogs(serviceId);
  };

  // Stop streaming logs
  const stopStreaming = (serviceId: string) => {
    if (!isStreaming) {
      console.warn('Not currently streaming logs for', serviceId);
      return;
    }

    console.log('Stopping log stream for:', serviceId);
    setIsStreaming(false);
    
    websocketService.stopLogStream(serviceId);
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    setError(null);
  };

  // Set up WebSocket listeners
  useEffect(() => {
    const handleLogData = (data: LogData) => {
      if (!serviceName || data.service === serviceName) {
        const logLines = data.data.split('\n').filter(line => line.trim());
        setLogs(prev => [...prev, ...logLines]);
      }
    };

    const handleLogError = (data: { service: string; error: string }) => {
      if (!serviceName || data.service === serviceName) {
        setError(data.error);
        setIsStreaming(false);
        console.error('Log streaming error:', data.error);
      }
    };

    websocketService.onLogData(handleLogData);
    websocketService.onLogError(handleLogError);

    // Cleanup on unmount
    return () => {
      if (isStreaming && serviceName) {
        stopStreaming(serviceName);
      }
    };
  }, [serviceName, isStreaming]);

  return {
    logs,
    isStreaming,
    error,
    logsEndRef,
    loadInitialLogs,
    startStreaming,
    stopStreaming,
    clearLogs,
    scrollToBottom,
  };
}