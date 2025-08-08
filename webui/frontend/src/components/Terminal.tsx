import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { ContainerInfo } from '../types';
import { clsx } from 'clsx';
import websocketService from '../services/websocket';
import apiService from '../services/api';

interface TerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Terminal: React.FC<TerminalProps> = ({ isOpen, onClose }) => {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [terminalSessions, setTerminalSessions] = useState<Map<string, {
    sessionId: string;
    type: 'host' | 'container';
    containerName?: string;
    output: string[];
    isConnected: boolean;
  }>>(new Map());
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terminalOutputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load containers on mount
  useEffect(() => {
    if (isOpen) {
      loadContainers();
    }
  }, [isOpen]);

  // Set up WebSocket listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleTerminalCreated = (data: { sessionId: string; type: string; options: any }) => {
      const terminalKey = data.options.containerName ? 
        `container-${data.options.containerName}` : 'host';
      
      setTerminalSessions(prev => new Map(prev).set(terminalKey, {
        sessionId: data.sessionId,
        type: data.type as 'host' | 'container',
        containerName: data.options.containerName,
        output: [`Connected to ${data.type} terminal\n`],
        isConnected: true
      }));
      
      setActiveTab(terminalKey);
      setError(null);
    };

    const handleTerminalData = (data: { sessionId: string; data: string }) => {
      setTerminalSessions(prev => {
        const newMap = new Map(prev);
        for (const [key, session] of newMap) {
          if (session.sessionId === data.sessionId) {
            session.output.push(data.data);
            // Keep only last 1000 lines
            if (session.output.length > 1000) {
              session.output = session.output.slice(-1000);
            }
            break;
          }
        }
        return newMap;
      });
    };

    const handleTerminalError = (data: { sessionId: string; error: string }) => {
      setError(data.error);
      console.error('Terminal error:', data.error);
    };

    const handleTerminalExit = (data: { sessionId: string; code: number; signal: string }) => {
      setTerminalSessions(prev => {
        const newMap = new Map(prev);
        for (const [key, session] of newMap) {
          if (session.sessionId === data.sessionId) {
            session.isConnected = false;
            session.output.push(`\nProcess exited with code ${data.code}\n`);
            break;
          }
        }
        return newMap;
      });
    };

    websocketService.onTerminalCreated?.(handleTerminalCreated);
    websocketService.onTerminalData?.(handleTerminalData);
    websocketService.onTerminalError?.(handleTerminalError);
    websocketService.onTerminalExit?.(handleTerminalExit);

    return () => {
      // Cleanup is handled by websocket service
    };
  }, [isOpen]);

  // Auto-scroll to bottom of terminal output
  useEffect(() => {
    if (terminalOutputRef.current) {
      terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
    }
  }, [terminalSessions, activeTab]);

  // Focus input when tab changes
  useEffect(() => {
    if (activeTab && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeTab]);

  const loadContainers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.get('/terminals/containers/available');
      setContainers(response.data.containers);
    } catch (error) {
      setError('Failed to load available containers');
      console.error('Error loading containers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createTerminal = (type: 'host' | 'container', containerName?: string) => {
    const socket = websocketService.getSocket();
    if (!socket) {
      setError('WebSocket not connected');
      return;
    }

    const options: any = { cols: 80, rows: 24 };
    if (type === 'container' && containerName) {
      options.containerName = containerName;
      options.shell = '/bin/bash';
    }

    socket.emit('createTerminal', { type, options });
  };

  const sendInput = (input: string) => {
    const activeSession = activeTab ? terminalSessions.get(activeTab) : null;
    if (!activeSession || !activeSession.isConnected) return;

    const socket = websocketService.getSocket();
    if (socket) {
      socket.emit('terminalInput', {
        sessionId: activeSession.sessionId,
        input: input
      });
    }
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendInput(inputValue + '\n');
      setInputValue('');
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // TODO: Implement command history
      e.preventDefault();
    } else if (e.ctrlKey && e.key === 'c') {
      sendInput('\x03'); // Send Ctrl+C
      e.preventDefault();
    } else if (e.ctrlKey && e.key === 'd') {
      sendInput('\x04'); // Send Ctrl+D
      e.preventDefault();
    }
  };

  const closeTerminal = (terminalKey: string) => {
    const session = terminalSessions.get(terminalKey);
    if (session) {
      const socket = websocketService.getSocket();
      if (socket) {
        socket.emit('destroyTerminal', { sessionId: session.sessionId });
      }
      
      const newSessions = new Map(terminalSessions);
      newSessions.delete(terminalKey);
      setTerminalSessions(newSessions);
      
      if (activeTab === terminalKey) {
        const remainingTabs = Array.from(newSessions.keys());
        setActiveTab(remainingTabs.length > 0 ? remainingTabs[0] : null);
      }
    }
  };

  const clearTerminal = () => {
    if (activeTab) {
      setTerminalSessions(prev => {
        const newMap = new Map(prev);
        const session = newMap.get(activeTab);
        if (session) {
          session.output = [];
        }
        return newMap;
      });
    }
  };

  if (!isOpen) return null;

  const activeSession = activeTab ? terminalSessions.get(activeTab) : null;

  return (
    <div className={clsx(
      'fixed bg-black bg-opacity-50 flex items-center justify-center z-50',
      isMaximized ? 'inset-0' : 'inset-4'
    )}>
      <div className={clsx(
        'bg-gray-900 rounded-lg shadow-xl flex flex-col text-white',
        isMaximized ? 'w-full h-full' : 'w-full max-w-6xl h-5/6'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <TerminalIcon className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold">Terminal Access</h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="text-gray-400 hover:text-white p-1"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
              title="Close terminal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Sidebar - New Terminal Options */}
          <div className="w-64 bg-gray-800 border-r border-gray-700">
            <div className="p-4">
              <div className="mb-4">
                <button
                  onClick={() => createTerminal('host')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                >
                  New Host Terminal
                </button>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Container Terminals</h4>
                {isLoading ? (
                  <div className="text-sm text-gray-400">Loading containers...</div>
                ) : containers.length > 0 ? (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {containers.map((container) => (
                      <button
                        key={container.id}
                        onClick={() => createTerminal('container', container.name)}
                        className="w-full text-left p-2 rounded text-sm bg-gray-700 hover:bg-gray-600 transition-colors"
                      >
                        <div className="font-medium text-white truncate">
                          {container.name}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {container.image}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">No containers available</div>
                )}
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-900 bg-opacity-50 p-2 rounded">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Terminal Area */}
          <div className="flex-1 flex flex-col">
            {/* Tabs */}
            {terminalSessions.size > 0 && (
              <div className="flex items-center bg-gray-800 border-b border-gray-700 px-2">
                {Array.from(terminalSessions.entries()).map(([key, session]) => (
                  <div
                    key={key}
                    className={clsx(
                      'flex items-center space-x-2 px-3 py-2 cursor-pointer border-r border-gray-700',
                      activeTab === key ? 'bg-gray-900' : 'hover:bg-gray-700'
                    )}
                    onClick={() => setActiveTab(key)}
                  >
                    <span className="text-sm">
                      {session.type === 'host' ? '🖥️ Host' : `🐳 ${session.containerName}`}
                    </span>
                    <div className={clsx(
                      'w-2 h-2 rounded-full',
                      session.isConnected ? 'bg-green-500' : 'bg-red-500'
                    )} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTerminal(key);
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Terminal Output */}
            {activeSession ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className={clsx(
                      'w-2 h-2 rounded-full',
                      activeSession.isConnected ? 'bg-green-500' : 'bg-red-500'
                    )} />
                    <span>
                      {activeSession.type === 'host' ? 'Host Terminal' : `Container: ${activeSession.containerName}`}
                    </span>
                  </div>
                  
                  <button
                    onClick={clearTerminal}
                    className="text-gray-400 hover:text-white p-1"
                    title="Clear terminal"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>

                <div
                  ref={terminalOutputRef}
                  className="flex-1 p-4 font-mono text-sm bg-black text-green-400 overflow-auto whitespace-pre-wrap"
                  style={{ lineHeight: '1.2' }}
                >
                  {activeSession.output.join('')}
                </div>

                {/* Input */}
                <form onSubmit={handleInputSubmit} className="border-t border-gray-700">
                  <div className="flex items-center p-4">
                    <span className="text-green-400 mr-2">$</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      className="flex-1 bg-transparent text-green-400 outline-none font-mono"
                      placeholder={activeSession.isConnected ? "Type command..." : "Terminal disconnected"}
                      disabled={!activeSession.isConnected}
                      autoComplete="off"
                    />
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <TerminalIcon className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <h4 className="text-lg font-medium mb-2">No Terminal Session</h4>
                  <p>Create a new terminal session to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terminal;