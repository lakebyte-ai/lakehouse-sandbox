import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ServiceStatus } from '../types';
import apiService from '../services/api';
import websocketService from '../services/websocket';

export function useServiceStatus() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  // Fetch initial data and set up polling fallback
  const query = useQuery({
    queryKey: ['serviceStatus'],
    queryFn: apiService.getServiceStatus,
    refetchInterval: 10000, // Fallback polling every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  // Set up WebSocket for real-time updates
  useEffect(() => {
    const socket = websocketService.connect();
    
    const handleConnect = () => {
      console.log('WebSocket connected - real-time updates active');
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('WebSocket disconnected - falling back to polling');
      setIsConnected(false);
    };

    const handleServiceStatus = (data: ServiceStatus) => {
      console.log('Received real-time service status update');
      queryClient.setQueryData(['serviceStatus'], data);
    };

    const handleError = (error: { message: string }) => {
      console.error('WebSocket error:', error.message);
    };

    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    websocketService.onServiceStatus(handleServiceStatus);
    websocketService.onError(handleError);

    // Cleanup on unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      websocketService.removeAllListeners();
      websocketService.disconnect();
    };
  }, [queryClient]);

  return {
    ...query,
    isConnected,
    isRealTime: isConnected,
  };
}

export function useServiceGroupStatus(group: 'core' | 'kafka' | 'airflow') {
  return useQuery({
    queryKey: ['serviceGroupStatus', group],
    queryFn: () => apiService.getServiceGroupStatus(group),
    refetchInterval: 15000,
  });
}