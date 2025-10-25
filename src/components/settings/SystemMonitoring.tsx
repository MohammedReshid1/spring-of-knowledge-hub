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
  Loader2,
  TrendingUp,
  Server,
  HardDrive,
  Wifi,
  Cpu,
  Lock
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { useLiveData } from '@/hooks/useLiveData';

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

  // Enable real-time updates via WebSocket
  useLiveData(['system-metrics', 'activity-logs'], {
    enabled: true,
    refetchInterval: 30000 // Auto-refresh every 30 seconds
  });

  // System metrics query
  const { data: metricsResponse, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => apiClient.getSystemMetrics(),
    retry: 2,
    retryDelay: 1000
  });

  const metrics = metricsResponse?.data?.data;

  // Activity logs query
  const { data: activityResponse, isLoading: logsLoading, error: logsError } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => apiClient.getActivityLogs(10),
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
        return <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300/50 text-blue-800 font-semibold shadow-sm">INFO</Badge>;
      case 'warning':
        return <Badge className="bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300/50 text-yellow-800 font-semibold shadow-sm">WARNING</Badge>;
      case 'error':
        return <Badge className="bg-gradient-to-r from-red-100 to-pink-100 border-red-300/50 text-red-800 font-semibold shadow-sm">ERROR</Badge>;
      default:
        return <Badge variant="outline" className="bg-white/80 border-slate-300 text-slate-700 font-medium">UNKNOWN</Badge>;
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
      <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-red-50/50 border border-white/30 shadow-premium">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.02] via-pink-500/[0.02] to-red-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardHeader className="relative">
          <CardTitle className="text-xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-100 to-pink-100 border border-red-200/50">
              <Lock className="h-5 w-5 text-red-600" />
            </div>
            <span className="bg-gradient-to-r from-slate-900 via-red-800 to-pink-900 bg-clip-text text-transparent">
              Access Denied
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/50 rounded-xl p-6">
            <p className="text-red-900 font-medium">
              You don't have permission to view system monitoring information.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>

      <div className="space-y-6 animate-fadeInUp">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600 font-medium">
              Real-time system performance and activity monitoring (auto-updates every 30s)
            </p>
          </div>
        </div>

        {/* System Health Overview */}
        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-blue-50/50 border border-white/30 shadow-premium hover:shadow-lg transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-indigo-500/[0.02] to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="relative">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
              <span className="bg-gradient-to-r from-slate-900 via-green-800 to-emerald-900 bg-clip-text text-transparent">
                System Health
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            {metricsError ? (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/50 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-red-100 to-pink-100 border border-red-200/50">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <span className="font-bold text-red-900">
                    UNAVAILABLE - Failed to load system metrics
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border border-green-200/50 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 rounded-full blur-lg animate-pulse-glow" />
                    <div className="relative p-2 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50">
                      {getHealthIcon(metrics?.system_health)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className={`text-xl font-bold ${getHealthColor(metrics?.system_health)}`}>
                      {metrics?.system_health?.toUpperCase() || 'LOADING...'}
                    </span>
                    {metrics?.uptime && (
                      <p className="text-sm text-slate-600 mt-1">
                        System uptime: <span className="font-semibold text-slate-900">{metrics.uptime}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-blue-50/50 border border-white/30 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-indigo-500/[0.02] to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">Active Users</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                    {metrics?.active_users || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-green-50/50 border border-white/30 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.02] via-emerald-500/[0.02] to-green-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">Total Requests</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">
                    {metrics?.total_requests?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-purple-50/50 border border-white/30 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.02] via-violet-500/[0.02] to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">Response Time</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">
                    {metrics?.average_response_time || 0}<span className="text-xl">ms</span>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200/50">
                  <Clock className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-red-50/50 border border-white/30 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.02] via-pink-500/[0.02] to-red-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">Error Rate</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-red-700 to-pink-700 bg-clip-text text-transparent">
                    {metrics?.error_rate?.toFixed(2) || 0}<span className="text-xl">%</span>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-red-100 to-pink-100 border border-red-200/50">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resource Usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-cyan-50/50 border border-white/30 shadow-premium hover:shadow-lg transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.02] via-teal-500/[0.02] to-cyan-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative">
              <CardTitle className="text-xl font-bold flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-100 to-teal-100 border border-cyan-200/50">
                  <Cpu className="h-5 w-5 text-cyan-600" />
                </div>
                <span className="bg-gradient-to-r from-slate-900 via-cyan-800 to-teal-900 bg-clip-text text-transparent">
                  Resource Usage
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-slate-700">Memory Usage</span>
                  <Badge className="bg-gradient-to-r from-cyan-100 to-teal-100 border-cyan-300/50 text-cyan-800 font-semibold shadow-sm">
                    {metrics?.memory_usage || 0}%
                  </Badge>
                </div>
                <Progress value={metrics?.memory_usage || 0} className="h-3 bg-gradient-to-r from-slate-100 to-gray-100" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-slate-700">Storage Usage</span>
                  <Badge className="bg-gradient-to-r from-cyan-100 to-teal-100 border-cyan-300/50 text-cyan-800 font-semibold shadow-sm">
                    {metrics?.storage_usage || 0}%
                  </Badge>
                </div>
                <Progress value={metrics?.storage_usage || 0} className="h-3 bg-gradient-to-r from-slate-100 to-gray-100" />
              </div>

              <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200/50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Database Connections</span>
                  <span className="text-lg font-bold text-slate-900">{metrics?.database_connections || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-indigo-50/50 border border-white/30 shadow-premium hover:shadow-lg transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] via-purple-500/[0.02] to-indigo-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative">
              <CardTitle className="text-xl font-bold flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200/50">
                  <Database className="h-5 w-5 text-indigo-600" />
                </div>
                <span className="bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-900 bg-clip-text text-transparent">
                  System Status
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50">
                      <Server className="h-4 w-4 text-slate-600" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">Database</span>
                  </div>
                  <Badge className={metrics?.database_status === 'connected'
                    ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-300/50 text-green-800 font-semibold shadow-sm'
                    : 'bg-gradient-to-r from-red-100 to-pink-100 border-red-300/50 text-red-800 font-semibold shadow-sm'}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {metrics?.database_status === 'connected' ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </div>

              <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50">
                      <Wifi className="h-4 w-4 text-slate-600" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">API Services</span>
                  </div>
                  <Badge className={metrics?.api_status === 'operational'
                    ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-300/50 text-green-800 font-semibold shadow-sm'
                    : 'bg-gradient-to-r from-red-100 to-pink-100 border-red-300/50 text-red-800 font-semibold shadow-sm'}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {metrics?.api_status === 'operational' ? 'Operational' : 'Error'}
                  </Badge>
                </div>
              </div>

              <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50">
                      <HardDrive className="h-4 w-4 text-slate-600" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">Last Backup</span>
                  </div>
                  <span className="text-sm font-medium text-slate-600">
                    {metrics?.last_backup_time
                      ? formatTimestamp(metrics.last_backup_time)
                      : 'No recent backup'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Logs */}
        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-violet-50/50 border border-white/30 shadow-premium hover:shadow-lg transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.02] via-purple-500/[0.02] to-fuchsia-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="relative">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200/50">
                <Activity className="h-5 w-5 text-violet-600" />
              </div>
              <span className="bg-gradient-to-r from-slate-900 via-violet-800 to-purple-900 bg-clip-text text-transparent">
                Recent Activity
              </span>
            </CardTitle>
            <CardDescription className="text-slate-600 font-medium ml-14">
              System events and user activities
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                  <span className="text-slate-600 font-medium">Loading activity logs...</span>
                </div>
              </div>
            ) : logsError ? (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/50 rounded-xl p-8">
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-red-100 to-pink-100 border border-red-200/50">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <span className="text-red-900 font-bold">Failed to load activity logs</span>
                </div>
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200/50 rounded-xl p-8">
                <div className="flex items-center justify-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50">
                    <Activity className="h-6 w-6 text-slate-400" />
                  </div>
                  <span className="text-slate-500 font-medium">No recent activity</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {activityLogs.map((log: ActivityLog, index) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-white/60 to-white/40 border border-white/40 rounded-xl hover:bg-gradient-to-r hover:from-violet-50/30 hover:via-purple-50/20 hover:to-fuchsia-50/30 transition-all duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        {getSeverityBadge(log.severity)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{log.message}</p>
                        {log.user && (
                          <p className="text-xs text-slate-600 mt-1">
                            User: <span className="font-medium text-slate-900">{log.user}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs bg-white/80 border-slate-300 text-slate-700 font-medium shrink-0 ml-4">
                      {formatTimestamp(log.timestamp)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};