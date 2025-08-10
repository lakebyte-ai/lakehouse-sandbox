import React, { useState } from 'react';
import { useServiceStatus } from './hooks/useServiceStatus';
import { useCommandExecution, useSystemInfo } from './hooks/useCommands';
import { apiService } from './services/api';
import ServiceGroupPanel from './components/ServiceGroupPanel';
import SandboxServicesPanel from './components/SandboxServicesPanel';
import ControlPanel from './components/ControlPanel';
import LogViewer from './components/LogViewer';
import ConfigurationEditor from './components/ConfigurationEditor';
import Terminal from './components/Terminal';
import ResourceMonitor from './components/ResourceMonitor';
import DatabricksSQLEditor from './components/DatabricksSQLEditor';
import { Database, Wifi, WifiOff, AlertCircle, Settings, Terminal as TerminalIcon, Activity, X, Code } from 'lucide-react';
import { clsx } from 'clsx';

function App() {
  const { data: serviceStatus, isLoading, error, isConnected, isRealTime } = useServiceStatus();
  const { executeCommand, isExecuting } = useCommandExecution();
  const { data: systemInfo } = useSystemInfo();
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showResourceMonitor, setShowResourceMonitor] = useState(false);
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [selectedMetricsService, setSelectedMetricsService] = useState<string | null>(null);
  const [showSQLEditor, setShowSQLEditor] = useState(false);

  const handleViewLogs = (serviceName: string) => {
    setSelectedService(serviceName);
    setShowLogViewer(true);
  };

  const handleCloseLogViewer = () => {
    setShowLogViewer(false);
    setSelectedService(null);
  };

  const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    try {
      console.log(`Executing ${action} on ${serviceName}`);
      
      switch (action) {
        case 'start':
          await apiService.startContainer(serviceName);
          break;
        case 'stop':
          await apiService.stopContainer(serviceName);
          break;
        case 'restart':
          await apiService.restartContainer(serviceName);
          break;
      }
      
      console.log(`Successfully ${action}ed ${serviceName}`);
    } catch (error) {
      console.error(`Failed to ${action} ${serviceName}:`, error);
    }
  };

  const handleViewMetrics = (serviceName: string) => {
    setSelectedMetricsService(serviceName);
    setShowMetrics(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lakehouse-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Lakehouse Sandbox</h2>
          <p className="text-gray-600">Connecting to services...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <AlertCircle className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-red-900 mb-2">Connection Error</h2>
          <p className="text-red-700 mb-4">
            Failed to connect to the lakehouse backend. Please ensure the backend server is running.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!serviceStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <Database className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Service Data</h2>
          <p className="text-gray-600">Unable to load service information</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and title */}
            <div className="flex items-center space-x-3">
              <div className="text-lakehouse-600">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Lakehouse Sandbox</h1>
                <p className="text-sm text-gray-600">WebUI Management Console</p>
              </div>
            </div>

            {/* Advanced Features & Connection Status */}
            <div className="flex items-center space-x-4">
              {/* Advanced Feature Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowResourceMonitor(true)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100 transition-colors"
                  title="Resource Monitor"
                >
                  <Activity className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => setShowTerminal(true)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100 transition-colors"
                  title="Terminal Access"
                >
                  <TerminalIcon className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => setShowConfigEditor(true)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100 transition-colors"
                  title="Configuration Editor"
                >
                  <Settings className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => setShowSQLEditor(true)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100 transition-colors"
                  title="Databricks SQL Editor"
                >
                  <Code className="w-5 h-5" />
                </button>
              </div>

              <div className="h-4 w-px bg-gray-300" />

              {/* Connection Status */}
              <div className="flex items-center space-x-2 text-sm">
                <div className={clsx(
                  'flex items-center space-x-1',
                  isConnected ? 'text-green-600' : 'text-yellow-600'
                )}>
                  {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  <span>
                    {isConnected ? 'Real-time' : 'Polling'} 
                    {isRealTime && isConnected && ' (Live)'}
                  </span>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                Last updated: {new Date(serviceStatus.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Global controls */}
          <ControlPanel
            totalServices={serviceStatus.totalServices}
            totalRunning={serviceStatus.totalRunning}
            totalStopped={serviceStatus.totalStopped}
            totalPaused={serviceStatus.totalPaused}
            totalNotCreated={serviceStatus.totalNotCreated}
            onShowSystemInfo={() => setShowSystemInfo(true)}
          />

          {/* Service groups */}
          <div className="space-y-8">
            {/* Core Services */}
            <ServiceGroupPanel
              groupName="core"
              group={serviceStatus.groups.core}
              onExecuteCommand={executeCommand}
              onViewLogs={handleViewLogs}
              onServiceAction={handleServiceAction}
              isExecutingCommand={isExecuting}
            />

            {/* Kafka Services */}
            <ServiceGroupPanel
              groupName="kafka"
              group={serviceStatus.groups.kafka}
              onExecuteCommand={executeCommand}
              onViewLogs={handleViewLogs}
              onServiceAction={handleServiceAction}
              isExecutingCommand={isExecuting}
            />

            {/* Airflow Services */}
            <ServiceGroupPanel
              groupName="airflow"
              group={serviceStatus.groups.airflow}
              onExecuteCommand={executeCommand}
              onViewLogs={handleViewLogs}
              onServiceAction={handleServiceAction}
              isExecutingCommand={isExecuting}
            />

            {/* Sandbox Services */}
            <SandboxServicesPanel
              onViewMetrics={handleViewMetrics}
            />
          </div>
        </div>
      </main>

      {/* Log viewer modal */}
      <LogViewer
        isOpen={showLogViewer}
        serviceName={selectedService}
        onClose={handleCloseLogViewer}
      />

      {/* Configuration editor modal */}
      <ConfigurationEditor
        isOpen={showConfigEditor}
        onClose={() => setShowConfigEditor(false)}
      />

      {/* Terminal modal */}
      <Terminal
        isOpen={showTerminal}
        onClose={() => setShowTerminal(false)}
      />

      {/* Resource monitor modal */}
      <ResourceMonitor
        isOpen={showResourceMonitor}
        onClose={() => setShowResourceMonitor(false)}
      />

      {/* SQL Editor modal */}
      {showSQLEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Databricks SQL Editor</h3>
              <button
                onClick={() => setShowSQLEditor(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <DatabricksSQLEditor />
            </div>
          </div>
        </div>
      )}

      {/* System information modal */}
      {showSystemInfo && systemInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-5/6 overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">System Information</h3>
              <button
                onClick={() => setShowSystemInfo(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">Docker Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Version:</span>
                    <span className="ml-2 font-medium">{systemInfo.docker.serverVersion}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Memory:</span>
                    <span className="ml-2 font-medium">
                      {(systemInfo.docker.memTotal / (1024 * 1024 * 1024)).toFixed(1)}GB
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Containers:</span>
                    <span className="ml-2 font-medium">{systemInfo.docker.containers}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Running:</span>
                    <span className="ml-2 font-medium">{systemInfo.docker.containersRunning}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Stopped:</span>
                    <span className="ml-2 font-medium">{systemInfo.docker.containersStopped}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Images:</span>
                    <span className="ml-2 font-medium">{systemInfo.docker.images}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">Lakehouse Configuration</h4>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="text-gray-600">Make Available:</span>
                    <span className="ml-2 font-medium">
                      {systemInfo.make.available ? '✅ Yes' : '❌ No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Root Directory:</span>
                    <span className="ml-2 font-medium text-xs">{systemInfo.make.lakehouseRoot}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">WebUI Features</h4>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Real-time Updates</span>
                    <span className={clsx(
                      'px-2 py-1 rounded text-xs',
                      isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    )}>
                      {isConnected ? 'Active' : 'Fallback Mode'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Configuration Editor</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Available</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Terminal Access</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Available</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Resource Monitoring</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Available</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics viewer modal */}
      {showMetrics && selectedMetricsService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-5/6 overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Metrics: {selectedMetricsService}
              </h3>
              <button
                onClick={() => {
                  setShowMetrics(false);
                  setSelectedMetricsService(null);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-sm text-gray-600 mb-4">
                Prometheus metrics endpoint for {selectedMetricsService}
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <iframe 
                  src={`http://localhost:${selectedMetricsService === 'databricks-sandbox' ? '18000' : '5435'}/metrics`}
                  className="w-full h-96 border border-gray-200"
                  title={`${selectedMetricsService} metrics`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <span>Lakehouse Sandbox WebUI v1.0.0</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Backend: {isConnected ? 'Connected' : 'Disconnected'}</span>
              <span>Services: {serviceStatus.totalRunning}/{serviceStatus.totalServices}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;