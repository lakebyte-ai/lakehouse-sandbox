# 🌐 WebUI Management Console

> A modern, responsive web interface for monitoring, managing, and interacting with your lakehouse sandbox environment. Built with React, TypeScript, and Tailwind CSS.

## 🎯 Overview

The WebUI provides comprehensive management capabilities for your lakehouse environment:

- **Real-time Service Monitoring** with health status and metrics
- **Interactive SQL Editor** for Databricks-compatible queries
- **Container Management** with start/stop/restart capabilities
- **Log Viewing** with real-time streaming
- **Configuration Editing** for service settings
- **Terminal Access** for debugging and administration
- **Resource Monitoring** with performance metrics
- **Integration Testing** dashboard

## 🚀 Quick Access

```bash
# Start WebUI with the lakehouse environment
make webui-up

# Or start just the WebUI
cd webui && make up

# Access the interface
open http://localhost:3000
```

## 📊 Main Dashboard

### Service Group Panels

#### 🏗️ Core Services
Monitor the foundational lakehouse services:
- **Polaris Catalog** (8181) - Metadata management
- **Trino Query Engine** (8080) - SQL federation  
- **MinIO Console** (9001) - Object storage
- **Spark Jupyter** (8888) - Interactive computing
- **Nimtable UI** (13000) - Table management

#### 🌊 Kafka Services  
Stream processing infrastructure:
- **Kafka Broker** (9092) - Message streaming
- **Kafka UI** (8091) - Management interface

#### 🔄 Airflow Services
Workflow orchestration stack:
- **Airflow Web** (8090) - Workflow UI
- **Airflow Scheduler** - Task scheduling
- **Airflow Worker** - Task execution
- **PostgreSQL** (5433) - Metadata storage
- **Redis** - Message broker

#### 🧪 Sandbox Services
SQL compatibility layers:
- **Snowflake Sandbox** (5435) - SQL translation
- **Databricks Sandbox** (5434) - SQL API emulation

### Service Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| 🟢 **Running** | Green | Service is healthy and responsive |
| 🔴 **Stopped** | Red | Service is not running |
| 🟡 **Paused** | Yellow | Service is paused/suspended |
| ⚫ **Not Created** | Gray | Container not yet created |

## 🔧 Core Features

### 1. Service Management

#### Container Actions
- **▶️ Start** - Start stopped containers
- **⏹️ Stop** - Gracefully stop running containers  
- **🔄 Restart** - Restart containers (stop + start)

```typescript
// Example: Service action flow
const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
  try {
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
  } catch (error) {
    console.error(`Failed to ${action} ${serviceName}:`, error);
  }
};
```

#### Health Monitoring
- **Real-time Status Updates** via WebSocket or polling
- **Response Time Tracking** for service endpoints
- **Resource Usage** monitoring
- **Error Detection** and alerting

### 2. Interactive SQL Editor 🔥

Access via the **Code** button (SQL icon) in the header toolbar.

#### Features:
- **Databricks SQL Compatibility** - Full API emulation
- **Syntax Highlighting** - SQL code highlighting  
- **Schema Browser** - Navigate catalogs, schemas, tables
- **Query History** - Track previous executions
- **Result Export** - Download as CSV, JSON
- **Performance Metrics** - Execution time, row counts

#### Usage Example:
```sql
-- Select catalog and schema from sidebar
USE iceberg.default;

-- Execute analytical queries
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as records,
    AVG(amount) as avg_amount
FROM sales_data 
WHERE created_at >= DATE('2024-01-01')
GROUP BY 1
ORDER BY 1 DESC;

-- Results displayed in interactive table
-- Export available via "Export CSV" button
```

#### Schema Browser:
- **Catalog Selection** - Choose data catalog (iceberg, etc.)
- **Schema Navigation** - Browse available schemas
- **Table Discovery** - View tables with metadata
- **Click to Insert** - Add table names to query editor

### 3. Log Viewer

Access via **📋 View Logs** button on any service card.

#### Capabilities:
- **Real-time Streaming** - Live log updates
- **Search and Filter** - Find specific log entries
- **Log Levels** - Filter by DEBUG, INFO, WARN, ERROR
- **Export Logs** - Download for offline analysis
- **Multi-service** - Switch between service logs

#### Usage:
```bash
# Example log viewer interface
[2024-01-15 10:30:15] INFO  - Trino query execution started
[2024-01-15 10:30:16] DEBUG - Query plan: SELECT * FROM iceberg.sales
[2024-01-15 10:30:17] INFO  - Query completed in 245ms
[2024-01-15 10:30:17] WARN  - High memory usage detected
```

### 4. Configuration Editor

Access via **⚙️ Settings** button in the header toolbar.

#### Editable Configurations:
- **Service Environment Variables** 
- **Docker Compose Overrides**
- **Application Settings**
- **Network Configuration**
- **Storage Policies**

#### Example Configuration:
```yaml
# docker-compose.override.yml
version: '3.8'
services:
  trino:
    environment:
      - TRINO_MEMORY_GB=8
      - TRINO_WORKERS=4
    ports:
      - "8081:8080"  # Custom port mapping
```

### 5. Terminal Access

Access via **💻 Terminal** button in the header toolbar.

#### Features:
- **Container Shell Access** - Execute commands in containers
- **Multiple Sessions** - Concurrent terminal windows
- **File Transfer** - Upload/download capabilities
- **Command History** - Previous command recall

#### Usage Examples:
```bash
# Access Trino CLI
docker exec -it lakehouse-sandbox-trino-1 trino

# Check Spark status  
docker exec -it spark-iceberg pyspark --version

# MinIO admin commands
docker exec -it lakehouse-sandbox-minio-1 mc admin info local
```

### 6. Resource Monitor

Access via **📊 Activity** button in the header toolbar.

#### Metrics Displayed:
- **CPU Usage** per service
- **Memory Consumption** and limits
- **Network I/O** statistics
- **Disk Usage** for volumes
- **Container Health** status

#### Performance Charts:
```typescript
// Real-time resource monitoring
interface ResourceMetrics {
  cpuPercentage: number;
  memoryUsage: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
  diskUsage: number;
}

// Updated via polling or WebSocket
const [metrics, setMetrics] = useState<ResourceMetrics[]>([]);
```

## 🎮 Advanced Features

### System Information Modal

Access detailed system information:
- **Docker Version** and configuration
- **Available Resources** (CPU, memory, disk)
- **Container Statistics** 
- **Network Configuration**
- **Lakehouse Root** directory

### Metrics Integration

**Sandbox Service Metrics**:
- **Databricks Sandbox** - http://localhost:18000/metrics
- **Snowflake Sandbox** - http://localhost:5435/metrics

**Prometheus Format**:
```prometheus
# HELP databricks_sql_statements_total Total SQL statements executed
# TYPE databricks_sql_statements_total counter
databricks_sql_statements_total{status="success"} 42
databricks_sql_statements_total{status="error"} 3

# HELP snowflake_translation_duration_seconds SQL translation time
# TYPE snowflake_translation_duration_seconds histogram
snowflake_translation_duration_seconds_bucket{le="0.1"} 10
snowflake_translation_duration_seconds_bucket{le="0.5"} 25
```

### Real-time Updates

**Connection Status Indicators**:
- 🟢 **Real-time** - WebSocket connected, live updates
- 🟡 **Polling** - HTTP polling fallback mode
- 🔴 **Disconnected** - No backend connectivity

**Update Frequencies**:
- **Service Status** - Every 5 seconds
- **Resource Metrics** - Every 10 seconds  
- **Log Streaming** - Real-time via WebSocket
- **Query Results** - On-demand

## 🔧 Development & Customization

### Frontend Architecture

```
webui/frontend/
├── src/
│   ├── components/           # React components
│   │   ├── ServiceGroupPanel.tsx
│   │   ├── DatabricksSQLEditor.tsx
│   │   ├── LogViewer.tsx
│   │   └── Terminal.tsx
│   ├── hooks/               # Custom React hooks
│   │   ├── useServiceStatus.ts
│   │   └── useCommands.ts
│   ├── services/            # API client services
│   │   └── api.ts
│   └── types/               # TypeScript definitions
│       └── index.ts
```

### Backend API

```
webui/backend/
├── src/
│   ├── routes/              # Express.js routes
│   │   ├── services.js      # Service status endpoints
│   │   ├── commands.js      # Container management
│   │   └── logs.js          # Log streaming
│   ├── services/            # Business logic
│   │   ├── dockerService.js # Docker API integration
│   │   └── logService.js    # Log processing
│   └── app.js               # Main application
```

### Custom Components

#### Adding New Service Panels
```typescript
// src/components/CustomServicePanel.tsx
interface CustomServicePanelProps {
  services: Service[];
  onServiceAction: (service: string, action: string) => void;
}

export const CustomServicePanel: React.FC<CustomServicePanelProps> = ({
  services,
  onServiceAction
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Custom Services</h3>
      {services.map(service => (
        <ServiceCard 
          key={service.name}
          service={service}
          onAction={onServiceAction}
        />
      ))}
    </div>
  );
};
```

#### Custom API Integration
```typescript  
// src/services/customApi.ts
import { apiClient } from './api';

export const customApiService = {
  async getCustomMetrics(): Promise<CustomMetrics> {
    const response = await apiClient.get('/api/custom/metrics');
    return response.data;
  },
  
  async executeCustomCommand(command: string): Promise<CommandResult> {
    const response = await apiClient.post('/api/custom/execute', { command });
    return response.data;
  }
};
```

## 🐛 Troubleshooting

### Common Issues

**WebUI Not Loading**
```bash
# Check if frontend is running
curl http://localhost:3000

# Check if backend is running  
curl http://localhost:5001/api/status

# Restart WebUI services
cd webui && make restart
```

**Service Status Not Updating**
```bash
# Check WebSocket connection in browser dev tools
# Verify backend API connectivity
curl http://localhost:5001/api/services

# Check for CORS issues in network tab
```

**SQL Editor Issues**
```bash
# Verify Databricks sandbox is running
curl http://localhost:5434/health

# Check for JavaScript errors in browser console
# Clear browser cache and reload
```

**Log Viewer Not Streaming**
```bash
# Check container logging driver
docker inspect lakehouse-sandbox-trino-1 | grep LogConfig

# Verify log file permissions
docker exec lakehouse-sandbox-trino-1 ls -la /var/log/
```

### Performance Optimization

**Reduce Polling Frequency**:
```typescript
// Adjust update intervals in useServiceStatus hook
const POLLING_INTERVAL = 10000; // 10 seconds instead of 5
const METRICS_INTERVAL = 30000; // 30 seconds instead of 10
```

**Optimize Bundle Size**:
```bash
# Analyze bundle size
cd webui/frontend && npm run build:analyze

# Enable code splitting for large components
const DatabricksSQLEditor = lazy(() => import('./DatabricksSQLEditor'));
```

**Enable Compression**:
```javascript
// In backend app.js
const compression = require('compression');
app.use(compression());
```

## 📱 Mobile Responsiveness

The WebUI is fully responsive and works across devices:

- **Desktop** (1920x1080+) - Full feature set with multiple columns
- **Tablet** (768-1024px) - Responsive layout with collapsible panels  
- **Mobile** (320-767px) - Single column layout with touch-optimized controls

### Mobile-specific Features:
- **Collapsible Sidebars** - Schema browser and navigation
- **Touch Gestures** - Swipe to navigate, tap to expand
- **Optimized Tables** - Horizontal scroll for result sets
- **Bottom Sheet Modals** - Native mobile UI patterns

## 🔒 Security Considerations

### Authentication (Future Enhancement)
```typescript
// JWT token-based authentication
interface AuthConfig {
  enableAuth: boolean;
  jwtSecret: string;
  tokenExpiry: string;
}

// Role-based access control
interface UserRole {
  name: string;
  permissions: Permission[];
}
```

### Network Security
- **CORS Configuration** - Restrict origins in production
- **API Rate Limiting** - Prevent abuse of endpoints
- **Input Validation** - Sanitize all user inputs
- **HTTPS Enforcement** - TLS encryption for production

## 📚 API Reference

### Service Management Endpoints

```bash
# Get all services status
GET /api/services

# Start/stop/restart container
POST /api/containers/{name}/start
POST /api/containers/{name}/stop  
POST /api/containers/{name}/restart

# Get container logs
GET /api/containers/{name}/logs?tail=100&follow=true

# Execute command in container
POST /api/containers/{name}/exec
{
  "command": "ls -la",
  "workdir": "/opt/"
}
```

### SQL Editor Endpoints

```bash
# Execute Databricks SQL
POST /api/databricks/statements
{
  "statement": "SELECT * FROM iceberg.default.sales",
  "warehouse_id": "lakehouse_sql_warehouse"
}

# Get statement result
GET /api/databricks/statements/{statement_id}

# List Unity Catalog objects
GET /api/databricks/unity-catalog/catalogs
GET /api/databricks/unity-catalog/catalogs/{catalog}/schemas
```

---

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.com/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Docker API Documentation](https://docs.docker.com/engine/api/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

**Ready to manage your lakehouse with a modern interface? Access the WebUI at `http://localhost:3000` and explore all features!** 🌐🚀