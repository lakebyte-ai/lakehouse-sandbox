import React, { useState } from 'react';
import { Play, Square, RotateCcw, Trash2, Info, Terminal } from 'lucide-react';
import { useCommandExecution, useSystemInfo } from '../hooks/useCommands';
import { clsx } from 'clsx';

interface ControlPanelProps {
  totalServices: number;
  totalRunning: number;
  totalStopped?: number;
  totalPaused?: number;
  totalNotCreated?: number;
  onShowSystemInfo?: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  totalServices,
  totalRunning,
  totalStopped = 0,
  totalPaused = 0,
  totalNotCreated = 0,
  onShowSystemInfo
}) => {
  const { executeCommand, commandHistory, isExecuting, clearHistory } = useCommandExecution();
  const { data: systemInfo } = useSystemInfo();
  const [showHistory, setShowHistory] = useState(false);

  const allRunning = totalRunning === totalServices;
  const someRunning = totalRunning > 0;
  const noneRunning = totalRunning === 0;

  const quickCommands = [
    {
      command: 'all',
      label: 'Start All',
      icon: <Play className="w-4 h-4" />,
      variant: 'success' as const,
      disabled: allRunning || isExecuting,
      tooltip: allRunning ? 'All services already running' : 'Start all lakehouse services'
    },
    {
      command: 'restart',
      label: 'Restart All',
      icon: <RotateCcw className="w-4 h-4" />,
      variant: 'secondary' as const,
      disabled: noneRunning || isExecuting,
      tooltip: noneRunning ? 'No services running to restart' : 'Restart all services'
    },
    {
      command: 'down',
      label: 'Stop All',
      icon: <Square className="w-4 h-4" />,
      variant: 'danger' as const,
      disabled: noneRunning || isExecuting,
      tooltip: noneRunning ? 'No services running to stop' : 'Stop all services'
    },
    {
      command: 'clean',
      label: 'Clean',
      icon: <Trash2 className="w-4 h-4" />,
      variant: 'danger' as const,
      disabled: isExecuting,
      tooltip: 'Stop all services and remove containers/volumes'
    }
  ];

  const getButtonClass = (variant: string, disabled: boolean) => {
    const baseClass = clsx(
      'flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors duration-200',
      disabled && 'opacity-50 cursor-not-allowed'
    );
    
    switch (variant) {
      case 'success':
        return clsx(baseClass, 'btn-success');
      case 'danger':
        return clsx(baseClass, 'btn-danger');
      case 'secondary':
      default:
        return clsx(baseClass, 'btn-secondary');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Global Controls</h2>
          <p className="text-sm text-gray-600">
            Manage all lakehouse services at once
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* System status with detailed metrics */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className={clsx(
                'w-3 h-3 rounded-full',
                allRunning ? 'bg-green-500' : someRunning ? 'bg-yellow-500' : 'bg-red-500'
              )} />
              <span className="font-medium">
                {totalServices} Services Total
              </span>
            </div>
            
            {/* Detailed breakdown */}
            <div className="flex items-center space-x-3 text-xs text-gray-600">
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>{totalRunning} Running</span>
              </span>
              {totalStopped > 0 && (
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span>{totalStopped} Stopped</span>
                </span>
              )}
              {totalPaused > 0 && (
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span>{totalPaused} Paused</span>
                </span>
              )}
              {totalNotCreated > 0 && (
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span>{totalNotCreated} Not Created</span>
                </span>
              )}
            </div>
          </div>

          {/* System info button */}
          {onShowSystemInfo && (
            <button
              onClick={onShowSystemInfo}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="System Information"
            >
              <Info className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {quickCommands.map((cmd) => (
          <button
            key={cmd.command}
            onClick={() => executeCommand(cmd.command)}
            disabled={cmd.disabled}
            className={getButtonClass(cmd.variant, cmd.disabled)}
            title={cmd.tooltip}
          >
            {cmd.icon}
            <span>{cmd.label}</span>
          </button>
        ))}
      </div>

      {/* Command History Toggle */}
      {commandHistory.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Terminal className="w-4 h-4" />
              <span>Command History ({commandHistory.length})</span>
            </button>
            
            {showHistory && (
              <button
                onClick={clearHistory}
                className="text-xs text-red-600 hover:text-red-700 transition-colors"
              >
                Clear History
              </button>
            )}
          </div>

          {/* Command History List */}
          {showHistory && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {commandHistory.slice(0, 10).map((result, index) => (
                <div
                  key={`${result.command}-${result.timestamp}`}
                  className={clsx(
                    'flex items-center justify-between p-2 rounded text-xs',
                    result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  )}
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-mono">{result.command}</span>
                    {result.success ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-red-600">✗</span>
                    )}
                  </div>
                  <span className="text-gray-500">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Docker System Info */}
      {systemInfo && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {systemInfo.docker.containersRunning}
              </div>
              <div className="text-gray-600">Running</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {systemInfo.docker.containersStopped}
              </div>
              <div className="text-gray-600">Stopped</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {systemInfo.docker.images}
              </div>
              <div className="text-gray-600">Images</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {(systemInfo.docker.memTotal / (1024 * 1024 * 1024)).toFixed(1)}GB
              </div>
              <div className="text-gray-600">Memory</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;