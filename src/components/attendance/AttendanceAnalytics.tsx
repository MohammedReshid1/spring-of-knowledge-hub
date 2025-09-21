import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar as CalendarIcon,
  Download,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  Award,
  UserMinus,
  UserPlus
} from 'lucide-react';

interface AttendanceAnalyticsProps {
  userRole: string;
  branchId?: string;
}

interface AttendanceStats {
  period_start: string;
  period_end: string;
  total_students: number;
  total_school_days: number;
  overall_attendance_rate: number;
  punctuality_rate: number;
  absence_rate: number;
  late_rate: number;
  excused_rate: number;
  trends: {
    attendance_trend: 'improving' | 'declining' | 'stable';
    punctuality_trend: 'improving' | 'declining' | 'stable';
    weekly_comparison: number;
    monthly_comparison: number;
  };
  top_performers: Array<{
    student_id: string;
    student_name: string;
    attendance_rate: number;
    perfect_days: number;
  }>;
  attendance_concerns: Array<{
    student_id: string;
    student_name: string;
    attendance_rate: number;
    consecutive_absences: number;
    concern_level: 'low' | 'medium' | 'high' | 'critical';
  }>;
  daily_breakdown: Array<{
    date: string;
    total_present: number;
    total_absent: number;
    total_late: number;
    attendance_rate: number;
  }>;
  class_breakdown: Array<{
    class_id: string;
    class_name: string;
    total_students: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    attendance_rate: number;
  }>;
  pattern_analysis: {
    frequent_absence_days: string[];
    peak_late_arrival_times: string[];
    seasonal_patterns: Array<{
      period: string;
      trend: string;
      rate: number;
    }>;
  };
}

interface MonthlyReport {
  month: string;
  year: number;
  attendance_rate: number;
  punctuality_rate: number;
  total_students: number;
  school_days: number;
  absent_days: number;
  late_arrivals: number;
  perfect_attendance_count: number;
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];

export const AttendanceAnalytics: React.FC<AttendanceAnalyticsProps> = ({ 
  userRole, 
  branchId 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Fetch attendance statistics
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<AttendanceStats>({
    queryKey: ['attendance-analytics', selectedPeriod, selectedClass, branchId],
    queryFn: async () => {
      const response = await apiClient.getAttendanceAnalytics({
        period_days: parseInt(selectedPeriod),
        ...(selectedClass !== 'all' && { class_id: selectedClass }),
        ...(branchId && { branch_id: branchId })
      });
      
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch monthly reports
  const { data: monthlyReports = [], isLoading: monthlyLoading, error: monthlyError } = useQuery<MonthlyReport[]>({
    queryKey: ['attendance-monthly-reports', branchId],
    queryFn: async () => {
      const response = await apiClient.getMonthlyAttendanceReports({
        months: 12,
        ...(branchId && { branch_id: branchId })
      });
      
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch classes for filtering
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', branchId],
    queryFn: async () => {
      const response = await apiClient.getClasses();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    retry: 1,
  });

  const getTrendIcon = (trend: string, value?: number) => {
    if (trend === 'improving' || (value && value > 0)) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    }
    if (trend === 'declining' || (value && value < 0)) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
  };

  const getConcernColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const downloadReport = async (reportType: string) => {
    try {
      const response = await apiClient.exportAttendanceReport({
        type: reportType,
        period_days: parseInt(selectedPeriod),
        ...(selectedClass !== 'all' && { class_id: selectedClass }),
        ...(branchId && { branch_id: branchId }),
        format: 'pdf'
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      console.log('Report export initiated:', response.data);
      // Note: In a real implementation, this would handle the actual file download
      // For now, we just log the response since the backend returns a placeholder
      
    } catch (error) {
      console.error('Failed to download report:', error);
      // You might want to show a toast notification here
    }
  };

  if (statsLoading || monthlyLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mr-3"></div>
          <div>Loading attendance analytics...</div>
        </div>
      </div>
    );
  }

  if (statsError || monthlyError) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="font-medium text-red-800 mb-2">Error Loading Analytics</h3>
            <p className="text-red-600 text-sm mb-4">
              {(statsError as Error)?.message || (monthlyError as Error)?.message || 'Failed to load attendance analytics'}
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="text-red-700 border-red-300 hover:bg-red-100"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="relative">
        {/* Background card with glass morphism */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>

        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-6 lg:space-y-0">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                  Attendance Analytics
                </h2>
                <p className="text-slate-600 leading-relaxed mt-1">
                  Comprehensive insights into attendance patterns and trends with advanced analytics
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-full sm:w-40 bg-white/80 border-blue-200/50 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 3 months</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-full sm:w-44 bg-white/80 border-blue-200/50 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => downloadReport('comprehensive')}
                className="w-full sm:w-auto group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Download className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                Export Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Premium Tab Navigation */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-2xl shadow-premium"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-2xl pointer-events-none"></div>

          <TabsList className="relative bg-transparent border-0 grid w-full grid-cols-5 p-2">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="trends"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Trends
            </TabsTrigger>
            <TabsTrigger
              value="patterns"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Patterns
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Performance
            </TabsTrigger>
            <TabsTrigger
              value="concerns"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Concerns
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {/* Premium Key Metrics */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Overall Attendance */}
            <div className="relative group">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 to-emerald-500/8 rounded-2xl pointer-events-none"></div>
              <Card className="relative bg-transparent border-0 shadow-none">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Overall Attendance</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <p className="text-3xl font-bold bg-gradient-to-br from-green-600 to-emerald-600 bg-clip-text text-transparent">
                          {formatPercentage(stats?.overall_attendance_rate || 0)}
                        </p>
                        {getTrendIcon(stats?.trends.attendance_trend || 'stable')}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {stats?.total_students || 0} students tracked
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Punctuality Rate */}
            <div className="relative group">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 to-indigo-500/8 rounded-2xl pointer-events-none"></div>
              <Card className="relative bg-transparent border-0 shadow-none">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Punctuality Rate</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <p className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                          {formatPercentage(stats?.punctuality_rate || 0)}
                        </p>
                        {getTrendIcon(stats?.trends.punctuality_trend || 'stable')}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        On-time arrivals
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Absence Rate */}
            <div className="relative group">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/8 to-rose-500/8 rounded-2xl pointer-events-none"></div>
              <Card className="relative bg-transparent border-0 shadow-none">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Absence Rate</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <p className="text-3xl font-bold bg-gradient-to-br from-red-600 to-rose-600 bg-clip-text text-transparent">
                          {formatPercentage(stats?.absence_rate || 0)}
                        </p>
                        {getTrendIcon('declining', -(stats?.trends.weekly_comparison || 0))}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Total absences
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 border border-red-200/50">
                      <UserMinus className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Late Arrivals */}
            <div className="relative group">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/8 to-orange-500/8 rounded-2xl pointer-events-none"></div>
              <Card className="relative bg-transparent border-0 shadow-none">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Late Arrivals</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <p className="text-3xl font-bold bg-gradient-to-br from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                          {formatPercentage(stats?.late_rate || 0)}
                        </p>
                        {getTrendIcon('stable')}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Late arrivals
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-100 to-orange-100 border border-yellow-200/50">
                      <AlertTriangle className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Daily Attendance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Daily Attendance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.daily_breakdown || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value, name) => [value, name.replace('_', ' ')]}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_present"
                      stackId="1"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_late"
                      stackId="1"
                      stroke="#F59E0B"
                      fill="#F59E0B"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_absent"
                      stackId="1"
                      stroke="#EF4444"
                      fill="#EF4444"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Class Performance Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Class Performance Breakdown</CardTitle>
              <p className="text-sm text-muted-foreground">
                Attendance statistics by class for the selected period
              </p>
            </CardHeader>
            <CardContent>
              {stats?.class_breakdown && stats.class_breakdown.length > 0 ? (
                <div className="space-y-4">
                  {stats.class_breakdown.map((classData, index) => (
                    <div key={classData.class_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg border">
                      <div className="flex-1 mb-4 sm:mb-0">
                        <h4 className="font-medium text-lg">{classData.class_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {classData.total_students} student{classData.total_students !== 1 ? 's' : ''} enrolled
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end space-x-4 sm:space-x-6">
                        <div className="text-center">
                          <p className="text-sm sm:text-base text-green-600 font-medium">
                            {classData.present_count}
                          </p>
                          <p className="text-xs text-muted-foreground">Present</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm sm:text-base text-yellow-600 font-medium">
                            {classData.late_count}
                          </p>
                          <p className="text-xs text-muted-foreground">Late</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-sm sm:text-base text-red-600 font-medium">
                            {classData.absent_count}
                          </p>
                          <p className="text-xs text-muted-foreground">Absent</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-lg sm:text-xl font-bold text-blue-600">
                            {formatPercentage(classData.attendance_rate)}
                          </p>
                          <p className="text-xs text-muted-foreground">Rate</p>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mt-3 sm:mt-0 sm:ml-6 sm:w-24">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, classData.attendance_rate))}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 text-slate-400 opacity-50" />
                  <p className="text-slate-600">No class data available for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Monthly Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Attendance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyReports}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month"
                      tickFormatter={(month) => month.substring(0, 3)}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value, name) => [`${value}%`, name.replace('_', ' ')]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="attendance_rate"
                      stroke="#10B981"
                      strokeWidth={3}
                      name="Attendance Rate"
                    />
                    <Line
                      type="monotone"
                      dataKey="punctuality_rate"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      name="Punctuality Rate"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Trend Indicators */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  {getTrendIcon(stats?.trends.attendance_trend || 'stable')}
                  <span className="font-medium">Attendance Trend</span>
                </div>
                <p className="text-2xl font-bold capitalize mb-1">
                  {stats?.trends.attendance_trend || 'stable'}
                </p>
                <p className="text-sm text-muted-foreground">
                  vs. last week: {stats?.trends.weekly_comparison || 0}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  {getTrendIcon(stats?.trends.punctuality_trend || 'stable')}
                  <span className="font-medium">Punctuality Trend</span>
                </div>
                <p className="text-2xl font-bold capitalize mb-1">
                  {stats?.trends.punctuality_trend || 'stable'}
                </p>
                <p className="text-sm text-muted-foreground">
                  vs. last month: {stats?.trends.monthly_comparison || 0}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Perfect Attendance</span>
                </div>
                <p className="text-2xl font-bold text-blue-600 mb-1">
                  {monthlyReports[0]?.perfect_attendance_count || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  students this month
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          {/* Pattern Analysis */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Frequent Absence Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats?.pattern_analysis.frequent_absence_days?.length > 0 ? (
                    stats.pattern_analysis.frequent_absence_days.map((day, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                        <span className="font-medium">{day}</span>
                        <Badge variant="outline" className="bg-red-100 text-red-800">
                          High Absence Rate
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No significant patterns detected</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Late Arrival Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats?.pattern_analysis.peak_late_arrival_times?.length > 0 ? (
                    stats.pattern_analysis.peak_late_arrival_times.map((time, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                        <span className="font-medium">{time}</span>
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                          Peak Time
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No significant patterns detected</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seasonal Patterns */}
          <Card>
            <CardHeader>
              <CardTitle>Seasonal Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {stats?.pattern_analysis.seasonal_patterns?.map((pattern, index) => (
                  <div key={index} className="p-4 border rounded">
                    <h4 className="font-medium">{pattern.period}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{pattern.trend}</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatPercentage(pattern.rate)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Top Performers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Award className="h-5 w-5 mr-2 text-yellow-600" />
                Top Performing Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.top_performers?.map((student, index) => (
                  <div key={student.student_id} className="flex items-center justify-between p-3 bg-green-50 rounded">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{student.student_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {student.perfect_days} perfect attendance days
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      {formatPercentage(student.attendance_rate)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Attendance Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Rate Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Excellent (95-100%)', value: 45, color: '#10B981' },
                        { name: 'Good (90-94%)', value: 30, color: '#3B82F6' },
                        { name: 'Fair (85-89%)', value: 15, color: '#F59E0B' },
                        { name: 'Poor (<85%)', value: 10, color: '#EF4444' }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: 'Excellent (95-100%)', value: 45, color: '#10B981' },
                        { name: 'Good (90-94%)', value: 30, color: '#3B82F6' },
                        { name: 'Fair (85-89%)', value: 15, color: '#F59E0B' },
                        { name: 'Poor (<85%)', value: 10, color: '#EF4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="concerns" className="space-y-6">
          {/* Attendance Concerns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
                Students Requiring Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.attendance_concerns?.map((concern) => (
                  <div key={concern.student_id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className={`h-5 w-5 ${
                        concern.concern_level === 'critical' ? 'text-red-600' :
                        concern.concern_level === 'high' ? 'text-orange-600' :
                        concern.concern_level === 'medium' ? 'text-yellow-600' :
                        'text-blue-600'
                      }`} />
                      <div>
                        <p className="font-medium">{concern.student_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {concern.consecutive_absences} consecutive absences
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-bold text-red-600">
                        {formatPercentage(concern.attendance_rate)}
                      </span>
                      <Badge className={getConcernColor(concern.concern_level)}>
                        {concern.concern_level}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttendanceAnalytics;