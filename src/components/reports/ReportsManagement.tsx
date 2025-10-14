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
        {/* Premium Header Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
          <div className="absolute inset-0 opacity-20"
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
               }} />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
              <BarChart3 className="mr-2 h-4 w-4" />
              Reports & Analytics System
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Reports & <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Analytics</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              Generate, schedule, and manage comprehensive school reports with advanced analytics.
              Streamline your reporting processes with premium insights and tools.
            </p>
          </div>
        </div>
                </div>
              </div>
            </div>
          </div>

          {/* Wave Bottom */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
          {/* Action Bar */}
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
                <p className="text-sm text-gray-600">Generate and manage reports efficiently with powerful analytics</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* Action buttons will be added here if needed */}
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
              <div className="p-8">

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
          </div>
          </div>
        </div>
      </div>
    </>
  );
};