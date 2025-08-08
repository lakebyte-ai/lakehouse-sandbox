import React, { useState, useEffect } from 'react';
import { Activity, X, Download, Trash2, Play, Square, RotateCcw } from 'lucide-react';
import { useLogViewer } from '../hooks/useLogViewer';
import { clsx } from 'clsx';

interface LogViewerProps {
  isOpen: boolean;
  serviceName: string | null;
  onClose: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ isOpen, serviceName, onClose }) => {
  const {
    logs,
    isStreaming,
    error,
    logsEndRef,
    loadInitialLogs,
    startStreaming,
    stopStreaming,
    clearLogs,
  } = useLogViewer(serviceName || undefined);

  const [autoScroll, setAutoScroll] = useState(true);

  // Load initial logs when service changes
  useEffect(() => {
    if (serviceName && isOpen) {
      loadInitialLogs(serviceName);
    }
  }, [serviceName, isOpen, loadInitialLogs]);

  // Handle streaming toggle
  const handleStreamToggle = () => {
    if (!serviceName) return;
    
    if (isStreaming) {
      stopStreaming(serviceName);
    } else {
      startStreaming(serviceName);
    }
  };

  // Download logs as text file
  const downloadLogs = () => {
    if (logs.length === 0) return;
    
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serviceName || 'service'}-logs-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  if (!isOpen || !serviceName) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Activity className="w-5 h-5 text-lakehouse-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Logs: {serviceName}
              </h3>
              <p className="text-sm text-gray-600">
                {isStreaming ? (
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Live streaming</span>
                  </span>
                ) : (
                  'Static view'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Controls */}
            <button
              onClick={handleStreamToggle}
              className={clsx(
                'flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-medium transition-colors',
                isStreaming
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              )}
              title={isStreaming ? 'Stop live streaming' : 'Start live streaming'}
            >
              {isStreaming ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isStreaming ? 'Stop' : 'Stream'}</span>
            </button>

            <button
              onClick={() => loadInitialLogs(serviceName, 500)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              title="Refresh logs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Refresh</span>
            </button>

            <button
              onClick={downloadLogs}
              disabled={logs.length === 0}
              className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download logs"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </button>

            <button
              onClick={clearLogs}
              disabled={logs.length === 0}
              className="flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear logs"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>

            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Close log viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Log Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {error ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="text-red-500 mb-2">
                  <Activity className="w-8 h-8 mx-auto" />
                </div>
                <h4 className="text-lg font-medium text-red-900 mb-2">Error loading logs</h4>
                <p className="text-red-700">{error}</p>
                <button
                  onClick={() => loadInitialLogs(serviceName)}
                  className="mt-4 btn-primary"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="text-gray-400 mb-2">
                  <Activity className="w-8 h-8 mx-auto" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No logs available</h4>
                <p className="text-gray-600">No log entries found for this service</p>
                <button
                  onClick={handleStreamToggle}
                  className="mt-4 btn-primary"
                >
                  Start Streaming
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Auto-scroll toggle */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="text-sm text-gray-600">
                  {logs.length} log entries
                </div>
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>Auto-scroll</span>
                </label>
              </div>

              {/* Log lines */}
              <div className="flex-1 overflow-auto bg-gray-900 text-green-400 font-mono text-sm">
                <div className="p-4 space-y-1">
                  {logs.map((line, index) => (
                    <div
                      key={index}
                      className="whitespace-pre-wrap break-words hover:bg-gray-800 px-2 py-0.5 rounded"
                    >
                      {line}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogViewer;