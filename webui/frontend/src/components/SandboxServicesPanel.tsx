import React, { useState, useEffect } from 'react';
import { Database, Activity, ExternalLink, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { apiService } from '../services/api';

interface SandboxService {
  name: string;
  status: 'healthy' | 'unhealthy';
  port: number;
  responseTime?: number;
  lastCheck: string;
  error?: string;
  details?: any;
}

interface SandboxServicesPanelProps {
  onViewMetrics?: (serviceName: string) => void;
}

const SandboxServicesPanel: React.FC<SandboxServicesPanelProps> = ({
  onViewMetrics
}) => {
  const [services, setServices] = useState<Record<string, SandboxService>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchServicesHealth = async () => {
    try {
      const response = await apiService.getServicesHealth();
      
      // Filter only sandbox services
      const sandboxServices = Object.entries(response.services).filter(
        ([key]) => key.includes('sandbox')
      );
      
      const sandboxData = Object.fromEntries(sandboxServices);
      setServices(sandboxData);
      setLastUpdated(new Date(response.timestamp));
    } catch (error) {
      console.error('Failed to fetch services health:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicesHealth();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchServicesHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'unhealthy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const openService = (port: number) => {
    window.open(`http://localhost:${port}`, '_blank');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Database className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Sandbox Services</h2>
          </div>
        </div>
        <div className="p-6 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const sandboxServiceEntries = Object.entries(services);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Database className="w-5 h-5 text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Sandbox Services (Experimental)
              </h2>
              <p className="text-sm text-gray-600">
                SQL-compatible sandboxes for Snowflake and Databricks
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-xs text-gray-500">
              {lastUpdated && (
                <span>Last checked: {lastUpdated.toLocaleTimeString()}</span>
              )}
            </div>
            <button
              onClick={fetchServicesHealth}
              className="text-gray-500 hover:text-gray-700 p-1 rounded"
              title="Refresh health status"
            >
              <Activity className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="p-6">
        {sandboxServiceEntries.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sandboxServiceEntries.map(([key, service]) => (
              <div 
                key={key}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <h3 className="font-medium text-gray-900">{service.name}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={clsx(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          getStatusColor(service.status)
                        )}>
                          {service.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          Port {service.port}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {service.status === 'healthy' && (
                      <button
                        onClick={() => openService(service.port)}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        title={`Open ${service.name} in browser`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                    
                    {onViewMetrics && key.includes('sandbox') && (
                      <button
                        onClick={() => onViewMetrics(key)}
                        className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View metrics"
                      >
                        Metrics
                      </button>
                    )}
                  </div>
                </div>

                {/* Health Details */}
                <div className="space-y-2 text-sm">
                  {service.responseTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Response Time:</span>
                      <span className={clsx(
                        'font-medium',
                        service.responseTime < 1000 ? 'text-green-600' : 
                        service.responseTime < 5000 ? 'text-yellow-600' : 'text-red-600'
                      )}>
                        {service.responseTime}ms
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Last Check:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(service.lastCheck).toLocaleTimeString()}
                    </span>
                  </div>

                  {service.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                      {service.error}
                    </div>
                  )}

                  {service.status === 'healthy' && service.details && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-xs">
                      Service is running and responding normally
                    </div>
                  )}
                </div>

                {/* Quick Links for healthy services */}
                {service.status === 'healthy' && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        onClick={() => openService(service.port)}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                      >
                        Open API
                      </button>
                      <button
                        onClick={() => openService(service.port + 1000)} // Docs URL pattern
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                      >
                        Docs
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <Database className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-gray-500">No sandbox services detected</p>
            <p className="text-sm text-gray-400">
              Start the sandbox services to see them here
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SandboxServicesPanel;