import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  BarChart3, 
  Users, 
  GraduationCap,
  DollarSign,
  Calendar,
  Download,
  Settings,
  TrendingUp,
  Clock,
  Target
} from 'lucide-react';
import { AcademicReports } from './AcademicReports';
import { AcademicAnalytics } from './AcademicAnalytics';
import { StudentReports } from './StudentReports';
import { FinancialReports } from './FinancialReports';
import { AttendanceReports } from './AttendanceReports';
import { AttendanceAnalytics } from './AttendanceAnalytics';
import { ReportTemplates } from './ReportTemplates';
import { ReportSchedules } from './ReportSchedules';

interface ReportsStatsData {
  total_reports_generated: number;
  reports_this_month: number;
  most_requested_report: string;
  average_generation_time: string;
  report_distribution: Record<string, number>;
  format_preferences: Record<string, number>;
  scheduled_reports_active: number;
  templates_created: number;
}

export const ReportsManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const { selectedBranch } = useBranch();

  const { data: stats, isLoading: statsLoading } = useQuery<ReportsStatsData>({
    queryKey: ['reports-analytics-overview', selectedBranch?.id],
    queryFn: async () => {
      const { data } = await apiClient.getAnalyticsOverview({
        branch_id: selectedBranch?.id
      });
      return data;
    },
  });

  if (statsLoading) {
    return <div className="text-center py-8">Loading reports dashboard...</div>;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">Generate, schedule, and manage comprehensive school reports</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="att-analytics">Att. Analytics</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Reports"
              value={stats?.total_reports_generated || 0}
              icon={FileText}
              description="Reports generated all time"
              color="blue"
            />
            <StatCard
              title="This Month"
              value={stats?.reports_this_month || 0}
              icon={TrendingUp}
              description="Reports generated this month"
              color="green"
            />
            <StatCard
              title="Active Schedules"
              value={stats?.scheduled_reports_active || 0}
              icon={Clock}
              description="Scheduled reports running"
              color="purple"
            />
            <StatCard
              title="Templates"
              value={stats?.templates_created || 0}
              icon={Target}
              description="Custom templates created"
              color="orange"
            />
          </div>

          {/* Report Distribution and Performance */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Report Types Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.report_distribution ? (
                  <div className="space-y-3">
                    {Object.entries(stats.report_distribution).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${(count / Math.max(...Object.values(stats.report_distribution))) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No report data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Download className="h-5 w-5 mr-2" />
                  Format Preferences
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.format_preferences ? (
                  <div className="space-y-3">
                    {Object.entries(stats.format_preferences).map(([format, percentage]) => (
                      <div key={format} className="flex justify-between items-center">
                        <span className="text-sm">{format}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold">{percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No format data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Insights */}
          <Card>
            <CardHeader>
              <CardTitle>System Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-800">Generation Speed</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Average: {stats?.average_generation_time || 'N/A'}
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="font-medium text-blue-800">Most Popular</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    {stats?.most_requested_report || 'No data available'}
                  </p>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="font-medium text-purple-800">Automation</span>
                  </div>
                  <p className="text-sm text-purple-700">
                    {stats?.scheduled_reports_active || 0} scheduled reports active
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
                  onClick={() => setActiveTab('students')}
                >
                  <Users className="h-6 w-6 mb-2" />
                  Generate Student Report
                </Button>

                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('analytics')}
                >
                  <GraduationCap className="h-6 w-6 mb-2" />
                  Academic Analytics
                </Button>

                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('financial')}
                >
                  <DollarSign className="h-6 w-6 mb-2" />
                  Financial Summary
                </Button>

                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col items-center justify-center"
                  onClick={() => setActiveTab('att-analytics')}
                >
                  <Calendar className="h-6 w-6 mb-2" />
                  Attendance Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic">
          <AcademicReports />
        </TabsContent>

        <TabsContent value="analytics">
          <AcademicAnalytics />
        </TabsContent>

        <TabsContent value="students">
          <StudentReports />
        </TabsContent>

        <TabsContent value="financial">
          <FinancialReports />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceReports />
        </TabsContent>

        <TabsContent value="att-analytics">
          <AttendanceAnalytics />
        </TabsContent>

        <TabsContent value="templates">
          <ReportTemplates />
        </TabsContent>

        <TabsContent value="schedules">
          <ReportSchedules />
        </TabsContent>
      </Tabs>
    </div>
  );
};