import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Play, Square, History, Download, Database, Table } from 'lucide-react';

interface QueryResult {
  statement_id: string;
  status: {
    state: string;
    error?: {
      message: string;
      error_code: string;
    };
  };
  result?: {
    data_array: any[][];
    schema: {
      columns: Array<{
        name: string;
        type_name: string;
        position: number;
      }>;
    };
    row_count: number;
    truncated: boolean;
  };
  execution_time_ms: number;
  warehouse_id: string;
  created_time: number;
  sql: string;
}

interface Catalog {
  name: string;
  type: string;
}

interface Schema {
  name: string;
  catalog_name: string;
}

interface Table {
  name: string;
  catalog_name: string;
  schema_name: string;
  table_type: string;
}

const DatabricksSQLEditor: React.FC = () => {
  const [sql, setSql] = useState<string>('SELECT 1 as test_column');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [results, setResults] = useState<QueryResult | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryResult[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<string>('iceberg');
  const [selectedSchema, setSelectedSchema] = useState<string>('default');
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showSchema, setShowSchema] = useState<boolean>(true);

  // Load catalogs on component mount
  useEffect(() => {
    loadCatalogs();
    loadQueryHistory();
  }, []);

  // Load schemas when catalog changes
  useEffect(() => {
    if (selectedCatalog) {
      loadSchemas(selectedCatalog);
    }
  }, [selectedCatalog]);

  // Load tables when schema changes
  useEffect(() => {
    if (selectedCatalog && selectedSchema) {
      loadTables(selectedCatalog, selectedSchema);
    }
  }, [selectedCatalog, selectedSchema]);

  const loadCatalogs = async () => {
    try {
      const response = await fetch('http://localhost:5434/api/2.0/unity-catalog/catalogs');
      if (response.ok) {
        const data = await response.json();
        setCatalogs(data.catalogs || []);
      }
    } catch (error) {
      console.error('Failed to load catalogs:', error);
    }
  };

  const loadSchemas = async (catalog: string) => {
    try {
      const response = await fetch(`http://localhost:5434/api/2.0/unity-catalog/catalogs/${catalog}/schemas`);
      if (response.ok) {
        const data = await response.json();
        setSchemas(data.schemas || []);
      }
    } catch (error) {
      console.error('Failed to load schemas:', error);
    }
  };

  const loadTables = async (catalog: string, schema: string) => {
    try {
      const response = await fetch(`http://localhost:5434/api/2.0/unity-catalog/catalogs/${catalog}/schemas/${schema}/tables`);
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
    }
  };

  const loadQueryHistory = async () => {
    try {
      const response = await fetch('http://localhost:5434/api/2.0/sql/history/queries?max_results=50');
      if (response.ok) {
        const data = await response.json();
        setQueryHistory(data.res || []);
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
  };

  const executeQuery = async () => {
    if (!sql.trim()) return;

    setIsExecuting(true);
    setResults(null);

    try {
      const response = await fetch('http://localhost:5434/api/2.0/sql/statements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statement: sql,
          warehouse_id: 'lakehouse_sql_warehouse',
          catalog: selectedCatalog,
          schema: selectedSchema,
          wait_timeout: '30s'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setResults(result);
        // Refresh query history
        await loadQueryHistory();
      } else {
        const error = await response.json();
        setResults({
          statement_id: 'error',
          status: {
            state: 'FAILED',
            error: {
              message: error.detail || 'Query execution failed',
              error_code: 'EXECUTION_ERROR'
            }
          },
          execution_time_ms: 0,
          warehouse_id: 'lakehouse_sql_warehouse',
          created_time: Date.now(),
          sql: sql
        });
      }
    } catch (error) {
      console.error('Query execution error:', error);
      setResults({
        statement_id: 'error',
        status: {
          state: 'FAILED',
          error: {
            message: `Network error: ${error}`,
            error_code: 'CONNECTION_ERROR'
          }
        },
        execution_time_ms: 0,
        warehouse_id: 'lakehouse_sql_warehouse',
        created_time: Date.now(),
        sql: sql
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const cancelQuery = async () => {
    if (results?.statement_id && results.statement_id !== 'error') {
      try {
        await fetch(`http://localhost:5434/api/2.0/sql/statements/${results.statement_id}/cancel`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Failed to cancel query:', error);
      }
    }
    setIsExecuting(false);
  };

  const insertTableName = (catalog: string, schema: string, table: string) => {
    const tableName = `${catalog}.${schema}.${table}`;
    setSql(prev => prev + (prev.trim() === '' ? '' : ' ') + tableName);
  };

  const loadHistoryQuery = (query: QueryResult) => {
    setSql(query.sql);
    setShowHistory(false);
  };

  const exportResults = () => {
    if (!results?.result?.data_array) return;

    const headers = results.result.schema.columns.map(col => col.name);
    const csvContent = [
      headers.join(','),
      ...results.result.data_array.map(row => 
        row.map(cell => `"${cell}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const renderResults = () => {
    if (!results) return null;

    if (results.status.state === 'FAILED') {
      return (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Square className="h-4 w-4" />
              Query Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-red-800 font-medium">{results.status.error?.error_code}</p>
              <p className="text-red-700">{results.status.error?.message}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (results.status.state === 'SUCCEEDED' && results.result) {
      return (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <Play className="h-4 w-4" />
                Query Results
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{results.result.row_count} rows</span>
                <span>{results.execution_time_ms}ms</span>
                <Button size="sm" variant="outline" onClick={exportResults}>
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96 border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {results.result.schema.columns.map((col, idx) => (
                      <th key={idx} className="text-left p-2 border-b font-medium">
                        {col.name}
                        <span className="text-gray-500 font-normal ml-1">({col.type_name})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.result.data_array.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-gray-50">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="p-2 border-b">
                          {cell === null ? (
                            <span className="text-gray-400 italic">NULL</span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {results.result.truncated && (
              <p className="text-sm text-orange-600 mt-2">Results have been truncated.</p>
            )}
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Databricks SQL Editor
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Schema Browser */}
        {showSchema && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Table className="h-4 w-4" />
                Schema Browser
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Catalog Selection */}
              <div>
                <label className="text-sm font-medium">Catalog</label>
                <Select value={selectedCatalog} onValueChange={setSelectedCatalog}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogs.map((catalog) => (
                      <SelectItem key={catalog.name} value={catalog.name}>
                        {catalog.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Schema Selection */}
              <div>
                <label className="text-sm font-medium">Schema</label>
                <Select value={selectedSchema} onValueChange={setSelectedSchema}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {schemas.map((schema) => (
                      <SelectItem key={schema.name} value={schema.name}>
                        {schema.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tables List */}
              <div>
                <label className="text-sm font-medium mb-2 block">Tables</label>
                <div className="max-h-48 overflow-y-auto border rounded p-2">
                  {tables.map((table) => (
                    <div
                      key={`${table.catalog_name}.${table.schema_name}.${table.name}`}
                      className="cursor-pointer hover:bg-gray-100 p-1 rounded text-sm flex items-center justify-between"
                      onClick={() => insertTableName(table.catalog_name, table.schema_name, table.name)}
                    >
                      <span>{table.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {table.table_type}
                      </Badge>
                    </div>
                  ))}
                  {tables.length === 0 && (
                    <div className="text-gray-500 text-sm text-center py-2">
                      No tables found
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SQL Editor and Results */}
        <Card className={showSchema ? "lg:col-span-3" : "lg:col-span-4"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                SQL Query
                <Badge variant="outline">{selectedCatalog}.{selectedSchema}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="h-4 w-4 mr-1" />
                  History
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSchema(!showSchema)}
                >
                  <Table className="h-4 w-4 mr-1" />
                  Schema
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Query History */}
            {showHistory && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Query History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {queryHistory.map((query, idx) => (
                      <div
                        key={idx}
                        className="cursor-pointer hover:bg-gray-100 p-2 rounded text-sm border"
                        onClick={() => loadHistoryQuery(query)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate flex-1">{query.sql}</span>
                          <div className="flex items-center gap-2 ml-2">
                            <Badge
                              variant={query.status === 'SUCCESS' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {query.status}
                            </Badge>
                            <span className="text-gray-500 text-xs">
                              {query.execution_time_ms}ms
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {queryHistory.length === 0 && (
                      <div className="text-gray-500 text-center py-2">
                        No query history
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* SQL Input */}
            <div>
              <Textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="Enter your SQL query here..."
                className="min-h-32 font-mono"
                disabled={isExecuting}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                onClick={executeQuery}
                disabled={isExecuting || !sql.trim()}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                {isExecuting ? 'Executing...' : 'Run Query'}
              </Button>
              {isExecuting && (
                <Button
                  variant="outline"
                  onClick={cancelQuery}
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  Cancel
                </Button>
              )}
            </div>

            {/* Query Results */}
            {renderResults()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DatabricksSQLEditor;