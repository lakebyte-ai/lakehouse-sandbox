import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { CommandResult } from '../types';
import apiService from '../services/api';
import websocketService from '../services/websocket';

export function useCommandExecution() {
  const queryClient = useQueryClient();
  const [commandHistory, setCommandHistory] = useState<CommandResult[]>([]);

  // Set up WebSocket listener for command results
  useEffect(() => {
    const handleCommandResult = (result: CommandResult) => {
      console.log('Received command result:', result.command, result.success ? '✅' : '❌');
      
      // Add to command history
      setCommandHistory(prev => [result, ...prev.slice(0, 19)]); // Keep last 20 commands
      
      // Invalidate service status to refresh after command execution
      queryClient.invalidateQueries({ queryKey: ['serviceStatus'] });
    };

    websocketService.onCommandResult(handleCommandResult);

    return () => {
      // Cleanup is handled by the websocket service
    };
  }, [queryClient]);

  // Mutation for executing commands via REST API (fallback)
  const executeCommandMutation = useMutation({
    mutationFn: (command: string) => apiService.executeCommand(command),
    onSuccess: (result) => {
      setCommandHistory(prev => [result, ...prev.slice(0, 19)]);
      queryClient.invalidateQueries({ queryKey: ['serviceStatus'] });
    },
    onError: (error) => {
      console.error('Command execution failed:', error);
    }
  });

  // Function to execute command (prefers WebSocket, falls back to REST)
  const executeCommand = (command: string) => {
    if (websocketService.isConnected()) {
      console.log('Executing command via WebSocket:', command);
      websocketService.executeCommand(command);
    } else {
      console.log('Executing command via REST API:', command);
      executeCommandMutation.mutate(command);
    }
  };

  return {
    executeCommand,
    commandHistory,
    isExecuting: executeCommandMutation.isPending,
    clearHistory: () => setCommandHistory([]),
  };
}

export function useAvailableCommands() {
  return useQuery({
    queryKey: ['availableCommands'],
    queryFn: apiService.getAvailableCommands,
    staleTime: 1000 * 60 * 10, // Commands don't change often, cache for 10 minutes
  });
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ['systemInfo'],
    queryFn: apiService.getSystemInfo,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}