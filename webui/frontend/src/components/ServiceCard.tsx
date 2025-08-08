import React from 'react';
import { ServiceInfo } from '../types';
import { ExternalLink, Clock, Activity, Database, Play, Square, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';

interface ServiceCardProps {
  service: ServiceInfo;
  onViewLogs?: (serviceName: string) => void;
  onServiceAction?: (serviceName: string, action: 'start' | 'stop' | 'restart') => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onViewLogs, onServiceAction }) => {
  const isRunning = service.status === 'running';
  const isStarting = service.status === 'restarting' || service.status === 'created';
  const isNotCreated = service.status === 'not-created' || !service.exists;
  
  const statusColor = isRunning ? 'green' : isStarting ? 'yellow' : isNotCreated ? 'gray' : 'red';
  const statusText = isRunning ? 'Running' : 
                     isStarting ? 'Starting' : 
                     isNotCreated ? 'Not Created' : 'Stopped';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getMainPort = () => {
    const publicPort = service.ports.find(p => p.public);
    return publicPort?.public;
  };

  return (
    <div className={clsx(
      'service-card',
      isRunning && 'service-running',
      isStarting && 'service-starting',
      isNotCreated && 'service-not-created',
      !isRunning && !isStarting && !isNotCreated && 'service-stopped'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={clsx(
            'status-indicator',
            isRunning && 'status-running',
            isStarting && 'status-starting',
            isNotCreated && 'status-not-created',
            !isRunning && !isStarting && !isNotCreated && 'status-stopped'
          )} />
          <h3 className="font-semibold text-gray-900">{service.displayName}</h3>
        </div>
        
        <div className="flex items-center space-x-2">
          {service.url && (
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lakehouse-600 hover:text-lakehouse-700 transition-colors"
              title="Open service UI"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {onViewLogs && service.exists !== false && (
            <button
              onClick={() => onViewLogs(service.name)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="View logs"
            >
              <Activity className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Status and Info */}
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <span className="font-medium">Status:</span>
          <span className={clsx(
            'px-2 py-1 rounded-full text-xs font-medium',
            statusColor === 'green' && 'bg-green-100 text-green-800',
            statusColor === 'yellow' && 'bg-yellow-100 text-yellow-800',
            statusColor === 'red' && 'bg-red-100 text-red-800',
            statusColor === 'gray' && 'bg-gray-100 text-gray-800'
          )}>
            {statusText}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="font-medium">Container:</span>
          <span className="text-xs text-gray-500 truncate max-w-32" title={service.name}>
            {service.name}
          </span>
        </div>

        {service.image && (
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center">
              <Database className="w-3 h-3 mr-1" />
              Image:
            </span>
            <span className="text-xs text-gray-500 truncate max-w-32" title={service.image}>
              {service.image.split(':')[0].split('/').pop() || service.image}
            </span>
          </div>
        )}

        {getMainPort() && (
          <div className="flex items-center justify-between">
            <span className="font-medium">Port:</span>
            <span className="text-xs">:{getMainPort()}</span>
          </div>
        )}

        {service.credentials && (
          <div className="flex items-center justify-between">
            <span className="font-medium">Credentials:</span>
            <span className="text-xs text-gray-500">{service.credentials}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="font-medium flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            Created:
          </span>
          <span className="text-xs text-gray-500" title={formatDate(service.created)}>
            {new Date(service.created).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Service Controls */}
      {onServiceAction && service.exists && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {!isRunning && (
                <button
                  onClick={() => onServiceAction(service.name, 'start')}
                  className="btn-success text-xs px-2 py-1 flex items-center space-x-1"
                  title="Start service"
                >
                  <Play className="w-3 h-3" />
                  <span>Start</span>
                </button>
              )}
              
              {isRunning && (
                <>
                  <button
                    onClick={() => onServiceAction(service.name, 'restart')}
                    className="btn-secondary text-xs px-2 py-1 flex items-center space-x-1"
                    title="Restart service"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restart</span>
                  </button>
                  
                  <button
                    onClick={() => onServiceAction(service.name, 'stop')}
                    className="btn-danger text-xs px-2 py-1 flex items-center space-x-1"
                    title="Stop service"
                  >
                    <Square className="w-3 h-3" />
                    <span>Stop</span>
                  </button>
                </>
              )}
            </div>
            
            {service.url && (
              <a
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs text-lakehouse-600 hover:text-lakehouse-700 transition-colors"
                title="Open service UI"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                <span>Open</span>
              </a>
            )}
          </div>
          
          {service.credentials && service.url && (
            <div className="mt-2 text-xs text-gray-500">
              Credentials: {service.credentials}
            </div>
          )}
        </div>
      )}
      
      {/* Fallback for services without controls but with URLs */}
      {(!onServiceAction || !service.exists) && service.url && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <a
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-lakehouse-600 hover:text-lakehouse-700 transition-colors"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Open Service
            {service.credentials && (
              <span className="ml-2 text-xs text-gray-500">
                ({service.credentials})
              </span>
            )}
          </a>
        </div>
      )}
    </div>
  );
};

export default ServiceCard;