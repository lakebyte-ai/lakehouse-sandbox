import React, { useState, useEffect } from 'react';
import { Activity, X, Cpu, HardDrive, Wifi, Database, TrendingUp } from 'lucide-react';
import { ResourceSnapshot, ContainerResource, SystemResource } from '../types';
import { clsx } from 'clsx';
import websocketService from '../services/websocket';
import apiService from '../services/api';

interface ResourceMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

const ResourceMonitor: React.FC<ResourceMonitorProps> = ({ isOpen, onClose }) => {
  const [resourceData, setResourceData] = useState<ResourceSnapshot | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data and set up monitoring
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [isOpen]);

  // Set up WebSocket listener for resource updates
  useEffect(() => {
    if (!isOpen) return;

    const handleResourceUpdate = (data: ResourceSnapshot) => {
      setResourceData(data);
      setError(null);
    };

    websocketService.onResourceUpdate?.(handleResourceUpdate);

    return () => {
      // Cleanup is handled by websocket service
    };
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      setError(null);
      const response = await apiService.get('/monitoring/snapshot');
      setResourceData(response.data);
    } catch (error) {
      setError('Failed to load resource data');
      console.error('Error loading resource data:', error);
    }
  };

  const startMonitoring = async () => {
    try {
      await apiService.post('/monitoring/start', { interval: 5000 });
      setIsMonitoring(true);
    } catch (error) {
      console.error('Error starting monitoring:', error);
    }
  };

  const stopMonitoring = async () => {
    try {
      await apiService.post('/monitoring/stop');
      setIsMonitoring(false);
    } catch (error) {
      console.error('Error stopping monitoring:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNetworkSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const getUsageColor = (percent: number): string => {
    if (percent >= 90) return 'red';
    if (percent >= 70) return 'yellow';
    return 'green';
  };

  const ProgressBar: React.FC<{ value: number; max: number; color?: string }> = ({ 
    value, max, color = 'blue' 
  }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    
    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={clsx(
            'h-2 rounded-full transition-all duration-500',
            color === 'green' && 'bg-green-500',
            color === 'yellow' && 'bg-yellow-500',
            color === 'red' && 'bg-red-500',
            color === 'blue' && 'bg-blue-500'
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    );
  };

  const SystemOverview: React.FC<{ system: SystemResource }> = ({ system }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* CPU */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2 mb-2">
          <Cpu className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900">CPU</span>
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-1">
          {system.cpu.usage.toFixed(1)}%
        </div>
        <ProgressBar 
          value={system.cpu.usage} 
          max={100} 
          color={getUsageColor(system.cpu.usage)} 
        />
        <div className="text-xs text-gray-500 mt-1">
          {system.cpu.cores} cores • {system.cpu.model.split(' ').slice(0, 2).join(' ')}
        </div>
      </div>

      {/* Memory */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2 mb-2">
          <Database className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-gray-900">Memory</span>
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-1">
          {system.memory.percent.toFixed(1)}%
        </div>
        <ProgressBar 
          value={system.memory.percent} 
          max={100} 
          color={getUsageColor(system.memory.percent)} 
        />
        <div className="text-xs text-gray-500 mt-1">
          {formatBytes(system.memory.used)} / {formatBytes(system.memory.total)}
        </div>
      </div>

      {/* Disk */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2 mb-2">
          <HardDrive className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-gray-900">Disk</span>
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-1">
          {system.disk.percent.toFixed(1)}%
        </div>
        <ProgressBar 
          value={system.disk.percent} 
          max={100} 
          color={getUsageColor(system.disk.percent)} 
        />
        <div className="text-xs text-gray-500 mt-1">
          {system.disk.used} / {system.disk.total}
        </div>
      </div>

      {/* Docker */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2 mb-2">
          <Activity className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-medium text-gray-900">Docker</span>
        </div>
        <div className="text-2xl font-bold text-gray-900 mb-1">
          {system.docker.containersRunning}
        </div>
        <div className="text-xs text-gray-500">
          {system.docker.containersRunning} running / {system.docker.containers} total
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {system.docker.images} images • v{system.docker.version}
        </div>
      </div>
    </div>
  );

  const ContainerCard: React.FC<{ 
    containerId: string; 
    container: ContainerResource;
    onClick: () => void;
    isSelected: boolean;
  }> = ({ containerId, container, onClick, isSelected }) => (
    <div
      onClick={onClick}
      className={clsx(
        'p-4 rounded-lg border cursor-pointer transition-all duration-200',
        isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="font-medium text-gray-900 truncate">
            {container.name}
          </span>
        </div>
        <TrendingUp className="w-4 h-4 text-gray-400" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">CPU</span>
          <span className="font-medium">
            {container.current.cpu.percent.toFixed(1)}%
          </span>
        </div>
        <ProgressBar 
          value={container.current.cpu.percent} 
          max={100} 
          color={getUsageColor(container.current.cpu.percent)} 
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Memory</span>
          <span className="font-medium">
            {container.current.memory.percent.toFixed(1)}%
          </span>
        </div>
        <ProgressBar 
          value={container.current.memory.percent} 
          max={100} 
          color={getUsageColor(container.current.memory.percent)} 
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Network</span>
          <span className="font-medium text-xs">
            ↓ {formatNetworkSpeed(container.current.network.rxBytes)} 
            ↑ {formatNetworkSpeed(container.current.network.txBytes)}
          </span>
        </div>
      </div>

      <div className="text-xs text-gray-500 mt-2 truncate">
        {container.image}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-lg shadow-xl w-full max-w-7xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 rounded-t-lg">
          <div className="flex items-center space-x-3">
            <Activity className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Resource Monitor
              </h3>
              <p className="text-sm text-gray-600">
                Real-time system and container resource usage
                {isMonitoring && (
                  <span className="ml-2 text-green-600">• Live updates</span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-red-500 mb-2">
                  <Activity className="w-8 h-8 mx-auto" />
                </div>
                <h4 className="text-lg font-medium text-red-900 mb-2">Error loading data</h4>
                <p className="text-red-700">{error}</p>
                <button
                  onClick={loadInitialData}
                  className="mt-4 btn-primary"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : !resourceData ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Loading Resource Data</h4>
                <p className="text-gray-600">Collecting system metrics...</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* System Overview */}
              {resourceData.system && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h4>
                  <SystemOverview system={resourceData.system} />
                </div>
              )}

              {/* Container Resources */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900">
                    Container Resources ({Object.keys(resourceData.containers).length})
                  </h4>
                  <div className="text-sm text-gray-600">
                    Updated: {new Date(resourceData.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                {Object.keys(resourceData.containers).length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">No container resources available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(resourceData.containers).map(([containerId, container]) => (
                      <ContainerCard
                        key={containerId}
                        containerId={containerId}
                        container={container}
                        isSelected={selectedContainer === containerId}
                        onClick={() => setSelectedContainer(
                          selectedContainer === containerId ? null : containerId
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Container Details */}
              {selectedContainer && resourceData.containers[selectedContainer] && (
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    {resourceData.containers[selectedContainer].name} - Detailed Metrics
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Resource Usage</h5>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>CPU Usage</span>
                            <span>{resourceData.containers[selectedContainer].current.cpu.percent.toFixed(2)}%</span>
                          </div>
                          <ProgressBar 
                            value={resourceData.containers[selectedContainer].current.cpu.percent} 
                            max={100} 
                            color={getUsageColor(resourceData.containers[selectedContainer].current.cpu.percent)} 
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Memory Usage</span>
                            <span>
                              {formatBytes(resourceData.containers[selectedContainer].current.memory.usage)} / 
                              {formatBytes(resourceData.containers[selectedContainer].current.memory.limit)}
                            </span>
                          </div>
                          <ProgressBar 
                            value={resourceData.containers[selectedContainer].current.memory.percent} 
                            max={100} 
                            color={getUsageColor(resourceData.containers[selectedContainer].current.memory.percent)} 
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Network & Disk I/O</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Network RX:</span>
                          <span>{formatBytes(resourceData.containers[selectedContainer].current.network.rxBytes)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Network TX:</span>
                          <span>{formatBytes(resourceData.containers[selectedContainer].current.network.txBytes)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Disk Read:</span>
                          <span>{formatBytes(resourceData.containers[selectedContainer].current.disk.readBytes)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Disk Write:</span>
                          <span>{formatBytes(resourceData.containers[selectedContainer].current.disk.writeBytes)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourceMonitor;