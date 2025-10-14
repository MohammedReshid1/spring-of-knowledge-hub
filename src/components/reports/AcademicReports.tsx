import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Download, BarChart3, TrendingUp, Users, Target } from 'lucide-react';

interface PerformanceData {
  overall_school_average: number;
  grade_level_averages: Record<string, number>;
  subject_performance: Record<string, number>;
  improvement_trends: {
    improving_students: number;
    stable_students: number;
    declining_students: number;
  };
  attendance_correlation: Record<string, number>;
}

export const AcademicReports: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const { selectedBranch } = useBranch();

  const { data: performance, isLoading } = useQuery<PerformanceData>({
    queryKey: ['academic-performance-analytics', selectedBranch?.id],
    queryFn: async () => {
      const { data } = await apiClient.getPerformanceAnalytics({
        branch_id: selectedBranch?.id
      });
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading academic reports...</div>;
  }

  const getPerformanceColor = (average: number) => {
    if (average >= 85) return 'text-green-600';
    if (average >= 75) return 'text-blue-600';
    if (average >= 65) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSubjectGrade = (average: number) => {
    if (average >= 90) return 'A+';
    if (average >= 85) return 'A';
    if (average >= 80) return 'B+';
    if (average >= 75) return 'B';
    if (average >= 70) return 'C+';
    if (average >= 65) return 'C';
    if (average >= 60) return 'D';
    return 'F';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Academic Performance Reports</h2>
          <p className="text-muted-foreground">Comprehensive analysis of academic performance across all levels</p>
        </div>
        
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </div>

      {/* Overall Performance Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">School Average</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {performance?.overall_school_average.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall academic performance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Improving Students</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {performance?.improvement_trends.improving_students || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Students showing improvement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stable Performance</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {performance?.improvement_trends.stable_students || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Students maintaining level
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Need Support</CardTitle>
            <Target className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {performance?.improvement_trends.declining_students || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Students needing intervention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grade Level Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Performance by Grade Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          {performance?.grade_level_averages ? (
            <div className="space-y-4">
              {Object.entries(performance.grade_level_averages).map(([grade, average]) => (
                <div key={grade} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium">{grade}</span>
                    <Badge variant="outline">{getSubjectGrade(average)}</Badge>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(average / 100) * 100}%` }}
                      ></div>
                    </div>
                    <span className={`font-bold ${getPerformanceColor(average)}`}>
                      {average.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No grade level data available</p>
          )}
        </CardContent>
      </Card>

      {/* Subject Performance Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Subject Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {performance?.subject_performance ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(performance.subject_performance).map(([subject, average]) => (
                <div key={subject} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium capitalize">{subject.replace('_', ' ')}</h4>
                    <Badge className={`${average >= 80 ? 'bg-green-100 text-green-800' : average >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {getSubjectGrade(average)}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${average >= 80 ? 'bg-green-600' : average >= 70 ? 'bg-yellow-600' : 'bg-red-600'}`}
                        style={{ width: `${(average / 100) * 100}%` }}
                      ></div>
                    </div>
                    <span className={`font-bold ${getPerformanceColor(average)}`}>
                      {average.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No subject performance data available</p>
          )}
        </CardContent>
      </Card>

      {/* Attendance vs Performance Correlation */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance & Performance Correlation</CardTitle>
        </CardHeader>
        <CardContent>
          {performance?.attendance_correlation ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(performance.attendance_correlation).map(([category, count]) => (
                <div key={category} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium capitalize">
                      {category.replace(/_/g, ' ')}
                    </span>
                    <span className="text-lg font-bold">{count}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {category.includes('high_attendance_high_performance') && 'Students with good attendance and performance'}
                    {category.includes('high_attendance_low_performance') && 'Students attending well but struggling academically'}
                    {category.includes('low_attendance_high_performance') && 'High achievers with attendance issues'}
                    {category.includes('low_attendance_low_performance') && 'Students needing comprehensive support'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No correlation data available</p>
          )}
        </CardContent>
      </Card>

      {/* Improvement Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Academic Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium text-green-800">Improving Students</span>
              </div>
              <div className="text-2xl font-bold text-green-600 mb-1">
                {performance?.improvement_trends.improving_students || 0}
              </div>
              <p className="text-sm text-green-700">
                Students showing consistent academic improvement
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="font-medium text-blue-800">Stable Performance</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {performance?.improvement_trends.stable_students || 0}
              </div>
              <p className="text-sm text-blue-700">
                Students maintaining consistent performance levels
              </p>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="font-medium text-orange-800">Needs Support</span>
              </div>
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {performance?.improvement_trends.declining_students || 0}
              </div>
              <p className="text-sm text-orange-700">
                Students requiring additional academic support
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Report Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Download className="h-6 w-6 mb-2" />
              Export Performance Data
            </Button>

            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <BarChart3 className="h-6 w-6 mb-2" />
              Generate Analysis Report
            </Button>

            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <TrendingUp className="h-6 w-6 mb-2" />
              Schedule Regular Reports
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};