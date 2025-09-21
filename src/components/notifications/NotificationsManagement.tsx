import React, { useState } from 'react';
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
  Eye,
  MousePointer
} from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { CreateNotification } from './CreateNotification';
import { NotificationTemplates } from './NotificationTemplates';
import { NotificationAnalytics } from './NotificationAnalytics';
import { NotificationSettings } from './NotificationSettings';

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

  const { data: overview, isLoading: overviewLoading } = useQuery<NotificationOverview>({
    queryKey: ['notification-analytics-overview'],
    queryFn: async () => {
      const response = await apiClient.get('/notifications/analytics/overview');
      return response.data;
    },
  });

  const { data: performance, isLoading: performanceLoading } = useQuery<SystemPerformance>({
    queryKey: ['notification-performance'],
    queryFn: async () => {
      const response = await apiClient.get('/notifications/analytics/performance');
      return response.data;
    },
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-${color}-600`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notifications & Messaging</h1>
        <p className="text-muted-foreground">Manage communications, announcements, and system notifications</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="center">Inbox</TabsTrigger>
          <TabsTrigger value="create">Send</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              title="Click Rate"
              value={`${overview?.engagement_metrics.click_rate.toFixed(1) || 0}%`}
              icon={MousePointer}
              description="Links clicked"
              color="purple"
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
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="h-5 w-5 mr-2" />
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
          <Card>
            <CardHeader>
              <CardTitle>Performance Insights</CardTitle>
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
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('create')}
                >
                  <Send className="h-6 w-6 mb-2" />
                  Send Announcement
                </Button>

                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('create')}
                >
                  <AlertTriangle className="h-6 w-6 mb-2" />
                  Emergency Alert
                </Button>

                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('center')}
                >
                  <Bell className="h-6 w-6 mb-2" />
                  View Inbox
                </Button>

                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('analytics')}
                >
                  <BarChart3 className="h-6 w-6 mb-2" />
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="center">
          <NotificationCenter />
        </TabsContent>

        <TabsContent value="create">
          <CreateNotification />
        </TabsContent>

        <TabsContent value="templates">
          <NotificationTemplates />
        </TabsContent>

        <TabsContent value="analytics">
          <NotificationAnalytics />
        </TabsContent>

        <TabsContent value="settings">
          <NotificationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};