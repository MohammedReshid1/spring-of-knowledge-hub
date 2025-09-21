import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Monitor,
  Activity,
  Database,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Server,
  HardDrive,
  Wifi,
  Cpu
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useRoleAccess } from '@/hooks/useRoleAccess';

interface SystemMetrics {
  uptime: string;
  active_users: number;
  total_requests: number;
  average_response_time: number;
  error_rate: number;
  memory_usage: number;
  storage_usage: number;
  database_connections: number;
  last_backup_time: string | null;
  system_health: 'healthy' | 'warning' | 'critical';
  database_status: string;
  api_status: string;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'login' | 'logout' | 'error' | 'backup' | 'system';
  user?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export const SystemMonitoring = () => {
  const { isSuperAdmin, isAdmin } = useRoleAccess();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // System metrics query
  const { data: metricsResponse, isLoading: metricsLoading, refetch: refetchMetrics, error: metricsError } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => apiClient.getSystemMetrics(),
    refetchInterval: autoRefresh ? 30000 : false, // Refetch every 30 seconds if auto-refresh is enabled
    retry: 2,
    retryDelay: 1000
  });

  const metrics = metricsResponse?.data?.data;

  // Activity logs query
  const { data: activityResponse, isLoading: logsLoading, error: logsError } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => apiClient.getActivityLogs(10),
    refetchInterval: autoRefresh ? 60000 : false, // Refetch every minute
    retry: 2,
    retryDelay: 1000
  });

  const activityLogs = Array.isArray(activityResponse?.data?.data) ? activityResponse.data.data : [];

  const getHealthColor = (health?: SystemMetrics['system_health']) => {
    if (!health) return 'text-gray-600';
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (health?: SystemMetrics['system_health']) => {
    if (!health) return <AlertCircle className="h-4 w-4 text-gray-600" />;
    switch (health) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityBadge = (severity: ActivityLog['severity']) => {
    switch (severity) {
      case 'info':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">INFO</Badge>;
      case 'warning':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">WARNING</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">ERROR</Badge>;
      default:
        return <Badge variant="outline">UNKNOWN</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)} hours ago`;
    } else {
      return `${Math.floor(diffMinutes / 1440)} days ago`;
    }
  };

  if (!isAdmin && !isSuperAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600">
              You don't have permission to view system monitoring information.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6" />
            System Monitoring
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Real-time system performance and activity monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Auto-refresh:</span>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'On' : 'Off'}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchMetrics()}
            disabled={metricsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metricsError ? (
            <div className="flex items-center gap-4 mb-4">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-600">
                UNAVAILABLE - Failed to load system metrics
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-4 mb-4">
              {getHealthIcon(metrics?.system_health)}
              <span className={`font-medium ${getHealthColor(metrics?.system_health)}`}>
                {metrics?.system_health?.toUpperCase() || 'LOADING...'}
              </span>
              {metrics?.uptime && (
                <span className="text-sm text-gray-600">
                  System uptime: {metrics.uptime}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold">{metrics?.active_users || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold">{metrics?.total_requests?.toLocaleString() || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Response Time</p>
                <p className="text-2xl font-bold">{metrics?.average_response_time || 0}ms</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Error Rate</p>
                <p className="text-2xl font-bold">{metrics?.error_rate?.toFixed(2) || 0}%</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Resource Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Memory Usage</span>
                <span className="text-sm text-gray-600">{metrics?.memory_usage || 0}%</span>
              </div>
              <Progress value={metrics?.memory_usage || 0} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Storage Usage</span>
                <span className="text-sm text-gray-600">{metrics?.storage_usage || 0}%</span>
              </div>
              <Progress value={metrics?.storage_usage || 0} className="h-2" />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-medium">Database Connections</span>
              <span className="text-sm text-gray-600">{metrics?.database_connections || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span className="text-sm">Database</span>
              </div>
              <Badge variant="outline" className={metrics?.database_status === 'connected' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                <CheckCircle className="h-3 w-3 mr-1" />
                {metrics?.database_status === 'connected' ? 'Online' : 'Offline'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                <span className="text-sm">API Services</span>
              </div>
              <Badge variant="outline" className={metrics?.api_status === 'operational' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                <CheckCircle className="h-3 w-3 mr-1" />
                {metrics?.api_status === 'operational' ? 'Operational' : 'Error'}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                <span className="text-sm">Last Backup</span>
              </div>
              <span className="text-sm text-gray-600">
                {metrics?.last_backup_time
                  ? formatTimestamp(metrics.last_backup_time)
                  : 'No recent backup'
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            System events and user activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading activity logs...
            </div>
          ) : logsError ? (
            <div className="flex items-center justify-center py-8">
              <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
              <span className="text-red-600">Failed to load activity logs</span>
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Activity className="h-6 w-6 text-gray-400 mr-2" />
              <span className="text-gray-500">No recent activity</span>
            </div>
          ) : (
            <div className="space-y-3">
              {activityLogs.map((log: ActivityLog) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getSeverityBadge(log.severity)}
                    <div>
                      <p className="text-sm font-medium">{log.message}</p>
                      {log.user && (
                        <p className="text-xs text-gray-600">User: {log.user}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(log.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};