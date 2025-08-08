import React, { useState, useEffect } from 'react';
import { FileText, Save, X, Download, RotateCcw, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { FileInfo, FileContent } from '../types';
import { clsx } from 'clsx';
import apiService from '../services/api';

interface ConfigurationEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConfigurationEditor: React.FC<ConfigurationEditorProps> = ({ isOpen, onClose }) => {
  const [availableFiles, setAvailableFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load available files on mount
  useEffect(() => {
    if (isOpen) {
      loadAvailableFiles();
    }
  }, [isOpen]);

  // Check for changes
  useEffect(() => {
    if (fileContent) {
      setHasChanges(editedContent !== fileContent.content);
    }
  }, [editedContent, fileContent]);

  const loadAvailableFiles = async () => {
    try {
      setError(null);
      const response = await apiService.get('/files');
      setAvailableFiles(response.data.files);
    } catch (error) {
      setError('Failed to load available files');
      console.error('Error loading files:', error);
    }
  };

  const loadFileContent = async (filePath: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await apiService.get(`/files/content/${filePath}`);
      const content: FileContent = response.data;
      
      setFileContent(content);
      setEditedContent(content.content);
      setSelectedFile(filePath);
    } catch (error) {
      setError(`Failed to load file: ${filePath}`);
      console.error('Error loading file content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveFileContent = async () => {
    if (!selectedFile) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      await apiService.post(`/files/content/${selectedFile}`, {
        content: editedContent
      });

      setSuccess('File saved successfully!');
      setFileContent(prev => prev ? { ...prev, content: editedContent } : null);
      setHasChanges(false);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError('Failed to save file');
      console.error('Error saving file:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const reloadFile = () => {
    if (selectedFile) {
      loadFileContent(selectedFile);
    }
  };

  const discardChanges = () => {
    if (fileContent) {
      setEditedContent(fileContent.content);
    }
  };

  const downloadFile = () => {
    if (!selectedFile || !fileContent) return;

    const blob = new Blob([editedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.split('/').pop() || 'config.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'env':
        return '🔧';
      case 'docker-compose':
        return '🐳';
      case 'makefile':
        return '⚙️';
      case 'properties':
        return '📋';
      default:
        return '📄';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Configuration Editor
              </h3>
              <p className="text-sm text-gray-600">
                Edit lakehouse configuration files
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

        <div className="flex-1 flex min-h-0">
          {/* File List Sidebar */}
          <div className="w-80 border-r border-gray-200 bg-gray-50">
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Available Configuration Files
              </h4>
              <div className="space-y-1">
                {availableFiles.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => loadFileContent(file.path)}
                    className={clsx(
                      'w-full text-left p-3 rounded-md transition-colors',
                      selectedFile === file.path
                        ? 'bg-blue-100 border-blue-200 text-blue-900'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700',
                      'border'
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">
                        {getFileTypeIcon(file.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {file.path.split('/').pop()}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {file.description}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 flex flex-col">
            {selectedFile ? (
              <>
                {/* File Info and Controls */}
                <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center space-x-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {selectedFile}
                      </div>
                      {fileContent && (
                        <div className="text-xs text-gray-500">
                          {formatFileSize(fileContent.stats.size)} • 
                          Modified: {new Date(fileContent.stats.modified).toLocaleString()}
                          {hasChanges && (
                            <span className="text-orange-600 ml-2">• Unsaved changes</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {error && (
                      <div className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {error}
                      </div>
                    )}
                    
                    {success && (
                      <div className="text-sm text-green-600">
                        {success}
                      </div>
                    )}

                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-gray-500 hover:text-gray-700 p-1"
                      title={showPreview ? 'Hide preview' : 'Show preview'}
                    >
                      {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={reloadFile}
                      disabled={isLoading}
                      className="text-gray-500 hover:text-gray-700 p-1"
                      title="Reload file"
                    >
                      <RotateCcw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
                    </button>

                    <button
                      onClick={downloadFile}
                      className="text-gray-500 hover:text-gray-700 p-1"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {hasChanges && (
                      <button
                        onClick={discardChanges}
                        className="text-orange-600 hover:text-orange-700 text-sm px-2 py-1"
                      >
                        Discard
                      </button>
                    )}

                    <button
                      onClick={saveFileContent}
                      disabled={!hasChanges || isSaving}
                      className={clsx(
                        'flex items-center space-x-1 px-3 py-1 text-sm font-medium rounded transition-colors',
                        hasChanges && !isSaving
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      )}
                    >
                      <Save className="w-3 h-3" />
                      <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                  </div>
                </div>

                {/* Editor */}
                <div className="flex-1 min-h-0">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : showPreview ? (
                    <div className="h-full p-4 bg-gray-50">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                        {editedContent}
                      </pre>
                    </div>
                  ) : (
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full h-full p-4 font-mono text-sm border-0 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="File content will appear here..."
                      spellCheck={false}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Select a Configuration File
                  </h4>
                  <p className="text-gray-600">
                    Choose a file from the sidebar to start editing
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationEditor;