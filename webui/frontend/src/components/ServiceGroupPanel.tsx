import React from 'react';
import { ServiceGroup, ServiceGroupName } from '../types';
import { Play, Square, RotateCcw, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import ServiceCard from './ServiceCard';

interface ServiceGroupPanelProps {
  groupName: ServiceGroupName;
  group: ServiceGroup;
  onExecuteCommand: (command: string) => void;
  onViewLogs?: (serviceName: string) => void;
  onServiceAction?: (serviceName: string, action: 'start' | 'stop' | 'restart') => void;
  isExecutingCommand?: boolean;
}

const ServiceGroupPanel: React.FC<ServiceGroupPanelProps> = ({
  groupName,
  group,
  onExecuteCommand,
  onViewLogs,
  onServiceAction,
  isExecutingCommand = false
}) => {
  const groupDisplayNames: Record<ServiceGroupName, string> = {
    core: 'Core Services',
    kafka: 'Kafka Cluster',
    airflow: 'Airflow Orchestration'
  };

  const groupDescriptions: Record<ServiceGroupName, string> = {
    core: 'Polaris, Trino, MinIO, Spark, and Nimtable',
    kafka: 'Kafka brokers, Zookeeper, and Kafka UI',
    airflow: 'Airflow scheduler, webserver, worker, and database'
  };

  const groupIcons: Record<ServiceGroupName, React.ReactNode> = {
    core: <Activity className="w-5 h-5" />,
    kafka: <RotateCcw className="w-5 h-5" />,
    airflow: <Play className="w-5 h-5" />
  };

  const allRunning = group.running === group.total;
  const someRunning = group.running > 0;
  const noneRunning = group.running === 0;
  
  // Count services that exist (created containers, even if stopped)
  const existingServices = group.services.filter(s => s.exists !== false).length;
  const hasExistingServices = existingServices > 0;

  const getStatusColor = () => {
    if (allRunning) return 'green';
    if (someRunning) return 'yellow';
    return 'red';
  };

  const getStatusText = () => {
    if (allRunning) return 'All Running';
    if (someRunning) return 'Partially Running';
    return 'Stopped';
  };

  const statusColor = getStatusColor();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-gray-600">
              {groupIcons[groupName]}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {groupDisplayNames[groupName]}
              </h2>
              <p className="text-sm text-gray-600">
                {groupDescriptions[groupName]}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Status indicator */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={clsx(
                  'w-3 h-3 rounded-full',
                  statusColor === 'green' && 'bg-green-500',
                  statusColor === 'yellow' && 'bg-yellow-500',
                  statusColor === 'red' && 'bg-red-500'
                )} />
                <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
              </div>
              
              {/* Detailed metrics */}
              <div className="flex items-center space-x-3 text-xs text-gray-600">
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>{group.running} Running</span>
                </span>
                {group.stopped > 0 && (
                  <span className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span>{group.stopped} Stopped</span>
                  </span>
                )}
                {group.paused > 0 && (
                  <span className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span>{group.paused} Paused</span>
                  </span>
                )}
                {group.notCreated > 0 && (
                  <span className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <span>{group.notCreated} Not Created</span>
                  </span>
                )}
                <span className="text-gray-500 border-l border-gray-300 pl-3">
                  Total: {group.total}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onExecuteCommand(`${groupName}-up`)}
                disabled={isExecutingCommand || allRunning}
                className={clsx(
                  'btn-success text-xs px-3 py-1.5 flex items-center space-x-1',
                  (allRunning || isExecutingCommand) && 'opacity-50 cursor-not-allowed'
                )}
                title={allRunning ? 'All services already running' : `Start ${groupName} services`}
              >
                <Play className="w-3 h-3" />
                <span>Start</span>
              </button>
              
              <button
                onClick={() => onExecuteCommand(`${groupName}-restart`)}
                disabled={isExecutingCommand || !hasExistingServices}
                className={clsx(
                  'btn-secondary text-xs px-3 py-1.5 flex items-center space-x-1',
                  (!hasExistingServices || isExecutingCommand) && 'opacity-50 cursor-not-allowed'
                )}
                title={!hasExistingServices ? 'No services created to restart' : `Restart ${groupName} services`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restart</span>
              </button>
              
              <button
                onClick={() => onExecuteCommand(`${groupName}-down`)}
                disabled={isExecutingCommand || !hasExistingServices}
                className={clsx(
                  'btn-danger text-xs px-3 py-1.5 flex items-center space-x-1',
                  (!hasExistingServices || isExecutingCommand) && 'opacity-50 cursor-not-allowed'
                )}
                title={!hasExistingServices ? 'No services created to stop' : `Stop ${groupName} services`}
              >
                <Square className="w-3 h-3" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="p-6">
        {group.services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onViewLogs={onViewLogs}
                onServiceAction={onServiceAction}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <Activity className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-gray-500">No services found</p>
            <p className="text-sm text-gray-400">
              Start the {groupName} services to see them here
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceGroupPanel;