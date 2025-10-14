import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart3,
  TrendingUp,
  Eye,
  Send,
  Users,
  Clock,
  Target,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface AnalyticsData {
  total_notifications: number;
  delivery_stats: {
    [key: string]: number;
  };
  type_distribution: {
    [key: string]: number;
  };
  engagement_metrics: {
    total_sent: number;
    total_read: number;
    total_clicked: number;
    read_rate: number;
    click_rate: number;
  };
}

export const NotificationAnalytics: React.FC = () => {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['notification-analytics-detailed'],
    queryFn: async () => {
      const response = await apiClient.get('/api/notifications/analytics/overview?days=30');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
        <CardContent className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-100 to-amber-100 border border-yellow-200/50">
              <AlertTriangle className="h-12 w-12 text-yellow-600" />
            </div>
          </div>
          <p className="text-slate-700 font-semibold">No analytics data available</p>
          <p className="text-sm text-slate-600 font-medium mt-2">
            Start sending notifications to see analytics
          </p>
        </CardContent>
      </Card>
    );
  }

  const { total_notifications, delivery_stats, type_distribution, engagement_metrics } = analytics;

  // Calculate percentages
  const deliveredCount = delivery_stats?.delivered || delivery_stats?.sent || 0;
  const failedCount = delivery_stats?.failed || 0;
  const readCount = engagement_metrics?.total_read || 0;
  const readRate = engagement_metrics?.read_rate || 0;

  const metrics = [
    {
      title: 'Total Sent',
      value: total_notifications || 0,
      icon: Send,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      description: 'Recipients notified'
    },
    {
      title: 'Delivery Rate',
      value: total_notifications > 0
        ? `${((deliveredCount / total_notifications) * 100).toFixed(1)}%`
        : '0%',
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      description: `${deliveredCount} delivered`
    },
    {
      title: 'Read Rate',
      value: `${readRate.toFixed(1)}%`,
      icon: Eye,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      description: `${readCount} read`
    }
  ];

  const typeColors: { [key: string]: string } = {
    'announcement': 'bg-blue-100 text-blue-800',
    'emergency': 'bg-red-100 text-red-800',
    'event': 'bg-purple-100 text-purple-800',
    'academic': 'bg-green-100 text-green-800',
    'payment': 'bg-yellow-100 text-yellow-800',
    'system': 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200/50">
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">
                Notification Analytics
              </h2>
              <p className="text-slate-600 font-medium">Detailed insights into notification performance and engagement</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title} className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-600">
                      {metric.title}
                    </p>
                    <p className="text-2xl font-bold mt-2 bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">{metric.value}</p>
                    <p className="text-xs text-slate-600 font-medium mt-1">
                      {metric.description}
                    </p>
                  </div>
                  <div className={`${metric.bgColor} p-3 rounded-xl border border-${metric.color.replace('text-', '')}/20 shadow-md`}>
                    <Icon className={`h-6 w-6 ${metric.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Engagement Metrics */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50/30 to-violet-50/30 border-b border-purple-100/50">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200/50">
              <Target className="h-5 w-5 text-purple-600" />
            </div>
            <span className="bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">
              Engagement Metrics
            </span>
          </CardTitle>
          <CardDescription className="text-slate-600 font-medium">
            How users interact with your notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Read Rate</span>
                <span className="text-sm text-purple-700 font-bold">{readRate.toFixed(1)}%</span>
              </div>
              <Progress value={readRate} className="h-3 bg-purple-100" />
              <p className="text-xs text-slate-600 font-medium mt-1">
                {readCount} out of {engagement_metrics?.total_sent || 0} notifications read
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Status */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50/30 to-violet-50/30 border-b border-purple-100/50">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200/50">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <span className="bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">
              Delivery Status
            </span>
          </CardTitle>
          <CardDescription className="text-slate-600 font-medium">
            Breakdown of notification delivery
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-4 border border-green-200/50 rounded-xl bg-gradient-to-br from-green-50/50 to-emerald-50/50 hover:shadow-md transition-all duration-300">
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{deliveredCount}</p>
                <p className="text-sm text-slate-600 font-medium">Delivered</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border border-yellow-200/50 rounded-xl bg-gradient-to-br from-yellow-50/50 to-amber-50/50 hover:shadow-md transition-all duration-300">
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-100 to-amber-100 border border-yellow-200/50">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700">{delivery_stats?.pending || 0}</p>
                <p className="text-sm text-slate-600 font-medium">Pending</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 border border-red-200/50 rounded-xl bg-gradient-to-br from-red-50/50 to-rose-50/50 hover:shadow-md transition-all duration-300">
              <div className="p-2 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 border border-red-200/50">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700">{failedCount}</p>
                <p className="text-sm text-slate-600 font-medium">Failed</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50/30 to-violet-50/30 border-b border-purple-100/50">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200/50">
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <span className="bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">
              Notification Types
            </span>
          </CardTitle>
          <CardDescription className="text-slate-600 font-medium">
            Distribution by notification type
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {Object.keys(type_distribution || {}).length === 0 ? (
            <p className="text-center text-slate-600 font-medium py-8">
              No notification types data available
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(type_distribution).map(([type, count]) => {
                const percentage = total_notifications > 0
                  ? ((count / total_notifications) * 100).toFixed(1)
                  : '0';

                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={`${typeColors[type] || 'bg-gray-100 text-gray-800'} border shadow-sm`}>
                          {type}
                        </Badge>
                        <span className="text-sm text-slate-600 font-medium">
                          {count} notifications
                        </span>
                      </div>
                      <span className="text-sm font-bold text-purple-700">{percentage}%</span>
                    </div>
                    <Progress value={parseFloat(percentage)} className="h-3 bg-purple-100" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50/30 to-violet-50/30 border-b border-purple-100/50">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200/50">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <span className="bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">
              Performance Insights
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border border-green-200/50 rounded-xl bg-gradient-to-br from-green-50/50 to-emerald-50/50 space-y-2 hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 shadow-sm"></div>
                <p className="text-sm font-semibold text-slate-700">Best Performing Type</p>
              </div>
              <p className="text-lg font-bold text-green-700">
                {Object.entries(type_distribution || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
              </p>
              <p className="text-xs text-slate-600 font-medium">
                Most notifications sent
              </p>
            </div>

            <div className="p-4 border border-purple-200/50 rounded-xl bg-gradient-to-br from-purple-50/50 to-violet-50/50 space-y-2 hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gradient-to-r from-purple-500 to-violet-500 shadow-sm"></div>
                <p className="text-sm font-semibold text-slate-700">Engagement Rate</p>
              </div>
              <p className="text-lg font-bold text-purple-700">
                {readRate.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-600 font-medium">
                Notifications read by users
              </p>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-r from-purple-50/70 to-violet-50/70 border border-purple-200/50 rounded-xl shadow-md">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200/50 flex items-center justify-center shadow-sm">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent mb-1">
                  Recommendation
                </h4>
                <p className="text-sm text-purple-900 font-medium">
                  {readRate < 50
                    ? 'Your read rate is below average. Consider improving notification titles and timing.'
                    : readRate < 70
                    ? 'Good read rate! Try A/B testing different message formats to improve further.'
                    : 'Excellent read rate! Your notifications are highly engaging.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
