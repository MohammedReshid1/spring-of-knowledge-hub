import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  BookOpen, 
  Target,
  Award,
  AlertTriangle,
  BarChart3,
  PieChart,
  Calendar
} from 'lucide-react';

interface PerformanceAnalytics {
  overall_school_average: number;
  grade_level_averages: Record<string, number>;
  subject_performance: Record<string, number>;
  improvement_trends: {
    improving_students: number;
    stable_students: number;
    declining_students: number;
  };
  attendance_correlation: {
    high_attendance_high_performance: number;
    high_attendance_low_performance: number;
    low_attendance_high_performance: number;
    low_attendance_low_performance: number;
  };
  total_exam_results: number;
  total_students_analyzed: number;
  academic_year: string;
}

export const AcademicAnalytics: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const { selectedBranch } = useBranch();

  const { data: analytics, isLoading } = useQuery<PerformanceAnalytics>({
    queryKey: ['academic-performance', selectedYear, selectedBranch?.id],
    queryFn: async () => {
      const { data } = await apiClient.getPerformanceAnalytics({
        academic_year: selectedYear,
        branch_id: selectedBranch?.id
      });
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading academic analytics...</div>;
  }

  const getTrendIcon = (improving: number, declining: number) => {
    if (improving > declining) return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (declining > improving) return <TrendingDown className="h-5 w-5 text-red-600" />;
    return <Target className="h-5 w-5 text-blue-600" />;
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 80) return 'text-blue-600 bg-blue-50';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Academic Performance Analytics</h2>
          <p className="text-muted-foreground">Comprehensive analysis of student and school performance</p>
        </div>
        
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select academic year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2023">2023</SelectItem>
            <SelectItem value="2022">2022</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">School Average</CardTitle>
            <Award className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.overall_school_average.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Overall performance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students Analyzed</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.total_students_analyzed || 0}</div>
            <p className="text-xs text-muted-foreground">With performance data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exam Results</CardTitle>
            <BookOpen className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.total_exam_results || 0}</div>
            <p className="text-xs text-muted-foreground">Total assessments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Academic Year</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.academic_year}</div>
            <p className="text-xs text-muted-foreground">Current analysis period</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Grade Level Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Grade Level Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.grade_level_averages && Object.keys(analytics.grade_level_averages).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(analytics.grade_level_averages).map(([grade, average]) => (
                  <div key={grade} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{grade}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${average >= 80 ? 'bg-green-500' : average >= 70 ? 'bg-blue-500' : average >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(average, 100)}%` }}
                        ></div>
                      </div>
                      <Badge variant="outline" className={getPerformanceColor(average)}>
                        {average.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No grade level data available for the selected year
              </p>
            )}
          </CardContent>
        </Card>

        {/* Subject Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              Subject Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.subject_performance && Object.keys(analytics.subject_performance).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(analytics.subject_performance).map(([subject, average]) => (
                  <div key={subject} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{subject}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${average >= 80 ? 'bg-green-500' : average >= 70 ? 'bg-blue-500' : average >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(average, 100)}%` }}
                        ></div>
                      </div>
                      <Badge variant="outline" className={getPerformanceColor(average)}>
                        {average.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No subject performance data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Improvement Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            {getTrendIcon(
              analytics?.improvement_trends.improving_students || 0,
              analytics?.improvement_trends.declining_students || 0
            )}
            <span className="ml-2">Student Performance Trends</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-green-800">Improving</span>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-700">
                {analytics?.improvement_trends.improving_students || 0}
              </div>
              <p className="text-xs text-green-600 mt-1">Students showing improvement</p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-blue-800">Stable</span>
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {analytics?.improvement_trends.stable_students || 0}
              </div>
              <p className="text-xs text-blue-600 mt-1">Students with stable performance</p>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-red-800">Declining</span>
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-700">
                {analytics?.improvement_trends.declining_students || 0}
              </div>
              <p className="text-xs text-red-600 mt-1">Students needing support</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance vs Performance Correlation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Attendance vs Academic Performance Correlation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <div className="text-lg font-bold text-green-700">
                {analytics?.attendance_correlation.high_attendance_high_performance || 0}
              </div>
              <p className="text-xs text-green-600">High Attendance + High Performance</p>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <div className="text-lg font-bold text-yellow-700">
                {analytics?.attendance_correlation.high_attendance_low_performance || 0}
              </div>
              <p className="text-xs text-yellow-600">High Attendance + Low Performance</p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <div className="text-lg font-bold text-blue-700">
                {analytics?.attendance_correlation.low_attendance_high_performance || 0}
              </div>
              <p className="text-xs text-blue-600">Low Attendance + High Performance</p>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <div className="text-lg font-bold text-red-700">
                {analytics?.attendance_correlation.low_attendance_low_performance || 0}
              </div>
              <p className="text-xs text-red-600">Low Attendance + Low Performance</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Insights:</strong> This correlation analysis helps identify students who may benefit from 
              different types of interventions. High attendance with low performance may indicate learning 
              difficulties, while low attendance with high performance might suggest engagement issues.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};