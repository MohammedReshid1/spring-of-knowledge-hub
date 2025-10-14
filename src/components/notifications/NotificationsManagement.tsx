import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Send,
  Users,
  MessageCircle,
  AlertTriangle,
  Settings,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { CreateNotification } from './CreateNotification';
import { NotificationAnalytics } from './NotificationAnalytics';
import { NotificationSettings } from './NotificationSettings';
import { usePermissionCheck } from '@/contexts/RoleAccessContext';

interface NotificationOverview {
  total_notifications: number;
  delivery_stats: Record<string, number>;
  type_distribution: Record<string, number>;
  engagement_metrics: {
    total_sent: number;
    total_read: number;
    total_clicked: number;
    read_rate: number;
    click_rate: number;
  };
}

interface SystemPerformance {
  total_processed_24h: number;
  successful_deliveries: number;
  success_rate: number;
  average_delivery_time: string;
  system_status: string;
  queue_length: number;
  error_rate: number;
}

export const NotificationsManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  // Permission checks - using granular announcement permissions
  const { hasPermission } = usePermissionCheck();

  // View permissions
  const canView = hasPermission('announcement.view') || hasPermission('announcement.read');
  const canViewAll = hasPermission('announcement.view_all');
  const canViewOwn = hasPermission('announcement.view_own');
  const canViewBranch = hasPermission('announcement.view_branch');

  // CRUD permissions
  const canCreate = hasPermission('announcement.create');
  const canUpdate = hasPermission('announcement.update');
  const canDelete = hasPermission('announcement.delete');

  // Sending permissions
  const canSend = hasPermission('announcement.send');
  const canApprove = hasPermission('announcement.approve');
  const canReject = hasPermission('announcement.reject');

  // Schedule permissions
  const canViewSchedule = hasPermission('announcement.schedule.view');
  const canCreateSchedule = hasPermission('announcement.schedule.create');
  const canUpdateSchedule = hasPermission('announcement.schedule.update');
  const canDeleteSchedule = hasPermission('announcement.schedule.delete');

  // Analytics permissions
  const canViewAnalytics = hasPermission('announcement.analytics.view');
  const canCreateAnalytics = hasPermission('announcement.analytics.create');
  const canManageAnalytics = hasPermission('announcement.analytics.manage');

  // Data permissions
  const canExport = hasPermission('announcement.export');
  const canImport = hasPermission('announcement.import');
  const canGenerate = hasPermission('announcement.generate');

  // Full control
  const canManage = hasPermission('announcement.manage');

  // Define available tabs based on permissions
  const availableTabs = useMemo(() => {
    const tabs = [];

    // Overview - requires view or read permission
    if (canView || canViewAll || canViewOwn || canViewBranch || canManage) {
      tabs.push({ value: 'overview', label: 'Overview' });
    }

    // Inbox - requires view permission
    if (canView || canViewAll || canViewOwn || canViewBranch || canManage) {
      tabs.push({ value: 'center', label: 'Inbox' });
    }

    // Send - requires send or create permission
    if (canSend || canCreate || canManage) {
      tabs.push({ value: 'create', label: 'Send' });
    }

    // Analytics - requires analytics view permission
    if (canViewAnalytics || canManageAnalytics || canManage) {
      tabs.push({ value: 'analytics', label: 'Analytics' });
    }

    // Settings - requires manage permission
    if (canManage) {
      tabs.push({ value: 'settings', label: 'Settings' });
    }

    return tabs;
  }, [canView, canViewAll, canViewOwn, canViewBranch, canSend, canCreate, canViewAnalytics, canManageAnalytics, canManage]);

  // Set default active tab to first available tab
  React.useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(tab => tab.value === activeTab)) {
      setActiveTab(availableTabs[0].value);
    }
  }, [availableTabs, activeTab]);

  const { data: overview, isLoading: overviewLoading } = useQuery<NotificationOverview>({
    queryKey: ['notification-analytics-overview'],
    queryFn: async () => {
      const response = await apiClient.get('/api/notifications/analytics/overview');
      return response.data;
    },
    enabled: canViewAnalytics || canManageAnalytics || canManage, // Only fetch if user has analytics permission
  });

  const { data: performance, isLoading: performanceLoading } = useQuery<SystemPerformance>({
    queryKey: ['notification-performance'],
    queryFn: async () => {
      const response = await apiClient.get('/api/notifications/analytics/performance');
      return response.data;
    },
    enabled: canViewAnalytics || canManageAnalytics || canManage, // Only fetch if user has analytics permission
  });

  if (overviewLoading || performanceLoading) {
    return <div className="text-center py-8">Loading notifications dashboard...</div>;
  }

  const StatCard = ({ title, value, icon: Icon, description, color = "blue" }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description: string;
    color?: string;
  }) => (
    <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-700">{title}</CardTitle>
        <div className={`p-2 rounded-xl bg-gradient-to-br from-${color}-100 to-${color}-200 border border-${color}-200/50`}>
          <Icon className={`h-4 w-4 text-${color}-600`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
        <p className="text-xs text-slate-500 font-medium">{description}</p>
      </CardContent>
    </Card>
  );

  const getSystemStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

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

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }

        .animate-pulseGlow {
          animation: pulseGlow 2s infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          {/* Floating Shapes */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <Bell className="mr-2 h-4 w-4" />
                Communication Hub
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Notifications
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Comprehensive communication platform with advanced notification systems, messaging templates, and analytics.
                Keep your community connected with professional-grade messaging tools.
              </p>
            </div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
          <div className="mx-auto max-w-7xl space-y-6">

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={`grid w-full grid-cols-${availableTabs.length}`}>
          {availableTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {(canView || canViewAll || canViewOwn || canViewBranch || canManage) && (
          <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 animate-fadeInUp">
            <StatCard
              title="Total Sent"
              value={overview?.engagement_metrics.total_sent || 0}
              icon={Send}
              description="Notifications sent (30 days)"
              color="blue"
            />
            <StatCard
              title="Read Rate"
              value={`${overview?.engagement_metrics.read_rate.toFixed(1) || 0}%`}
              icon={Eye}
              description="Messages opened"
              color="green"
            />
            <StatCard
              title="Success Rate"
              value={`${performance?.success_rate.toFixed(1) || 0}%`}
              icon={CheckCircle}
              description="Delivery success (24h)"
              color="emerald"
            />
          </div>

          {/* System Status and Performance */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 animate-slideInRight" style={{ animationDelay: '0.1s' }}>
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-slate-100/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200/50">
                    <Settings className="h-5 w-5 text-indigo-600" />
                  </div>
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge className={`${performance?.system_status === 'operational' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {performance?.system_status || 'Unknown'}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Average Delivery Time:</span>
                    <span className="font-bold">{performance?.average_delivery_time || 'N/A'}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Queue Length:</span>
                    <span className="font-bold">{performance?.queue_length || 0}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Error Rate:</span>
                    <span className={`font-bold ${(performance?.error_rate || 0) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                      {performance?.error_rate.toFixed(1) || 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-slate-100/50 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold bg-gradient-to-r from-blue-700 to-cyan-700 bg-clip-text text-transparent">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 border border-blue-200/50">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  Delivery Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview?.delivery_stats ? (
                  <div className="space-y-3">
                    {Object.entries(overview.delivery_stats).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-sm capitalize">{status.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${(count / Math.max(...Object.values(overview.delivery_stats))) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No delivery data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notification Types Distribution */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="border-b border-slate-100/50 pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200/50">
                  <MessageCircle className="h-5 w-5 text-purple-600" />
                </div>
                Notification Types (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overview?.type_distribution ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(overview.type_distribution).map(([type, count]) => (
                    <div key={type} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium capitalize">{type.replace('_', ' ')}</span>
                        <span className="text-lg font-bold text-blue-600">{count}</span>
                      </div>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                        <div 
                          className="bg-blue-600 h-1 rounded-full" 
                          style={{ width: `${(count / Math.max(...Object.values(overview.type_distribution))) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No type distribution data available</p>
              )}
            </CardContent>
          </Card>

          {/* Performance Insights */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 animate-slideInRight" style={{ animationDelay: '0.3s' }}>
            <CardHeader className="border-b border-slate-100/50 pb-3">
              <CardTitle className="text-lg font-semibold bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">Performance Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-800">Engagement Health</span>
                  </div>
                  <p className="text-sm text-green-700">
                    {(overview?.engagement_metrics.read_rate || 0) > 70 
                      ? 'Excellent engagement rates across all notification types'
                      : (overview?.engagement_metrics.read_rate || 0) > 50
                      ? 'Good engagement with room for improvement'
                      : 'Low engagement rates - consider reviewing content strategy'
                    }
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="font-medium text-blue-800">Delivery Performance</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    {(performance?.success_rate || 0) > 95 
                      ? 'Excellent delivery rates - system performing optimally'
                      : (performance?.success_rate || 0) > 90
                      ? 'Good delivery performance'
                      : 'Delivery issues detected - system needs attention'
                    }
                  </p>
                </div>

                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="font-medium text-orange-800">Recent Activity</span>
                  </div>
                  <p className="text-sm text-orange-700">
                    {performance?.total_processed_24h || 0} notifications processed in the last 24 hours
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
            <CardHeader className="border-b border-slate-100/50 pb-3">
              <CardTitle className="text-lg font-semibold bg-gradient-to-r from-orange-700 to-amber-700 bg-clip-text text-transparent">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {(canSend || canCreate || canManage) && (
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-blue-200 shadow-md hover:shadow-lg transition-all duration-300"
                    onClick={() => setActiveTab('create')}
                  >
                    <Send className="h-6 w-6 mb-2 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Send Announcement</span>
                  </Button>
                )}

                {(canSend || canCreate || canManage) && (
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border-red-200 shadow-md hover:shadow-lg transition-all duration-300"
                    onClick={() => setActiveTab('create')}
                  >
                    <AlertTriangle className="h-6 w-6 mb-2 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Emergency Alert</span>
                  </Button>
                )}

                {(canView || canViewAll || canViewOwn || canViewBranch || canManage) && (
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border-purple-200 shadow-md hover:shadow-lg transition-all duration-300"
                    onClick={() => setActiveTab('center')}
                  >
                    <Bell className="h-6 w-6 mb-2 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">View Inbox</span>
                  </Button>
                )}

                {(canViewAnalytics || canManageAnalytics || canManage) && (
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border-emerald-200 shadow-md hover:shadow-lg transition-all duration-300"
                    onClick={() => setActiveTab('analytics')}
                  >
                    <BarChart3 className="h-6 w-6 mb-2 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">View Analytics</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          </TabsContent>
        )}

        {(canView || canViewAll || canViewOwn || canViewBranch || canManage) && (
          <TabsContent value="center">
            <NotificationCenter />
          </TabsContent>
        )}

        {(canSend || canCreate || canManage) && (
          <TabsContent value="create">
            <CreateNotification />
          </TabsContent>
        )}

        {(canViewAnalytics || canManageAnalytics || canManage) && (
          <TabsContent value="analytics">
            <NotificationAnalytics />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="settings">
            <NotificationSettings />
          </TabsContent>
        )}
      </Tabs>
          </div>
        </div>
      </div>
    </>
  );
};