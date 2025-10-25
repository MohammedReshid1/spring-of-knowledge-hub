import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Award,
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle2,
  XCircle,
  BarChart3,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GradeStatisticsProps {
  examId: string;
}

interface ExamStatistics {
  exam_id: string;
  exam_name: string;
  total_students: number;
  graded_count: number;
  pending_count?: number;
  statistics?: {
    average_marks: number;
    average_percentage: number;
    highest_marks: number;
    lowest_marks: number;
    pass_count: number;
    fail_count: number;
    pass_percentage: number;
    grade_distribution: Record<string, number>;
  };
}

export const GradeStatistics = ({ examId }: GradeStatisticsProps) => {
  const { data: stats, isLoading } = useQuery<ExamStatistics>({
    queryKey: ['exam-statistics', examId],
    queryFn: async () => {
      const { data, error } = await apiClient.getExamStatistics(examId);
      if (error) throw new Error(error);
      return data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading statistics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || !stats.statistics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exam Statistics</CardTitle>
          <CardDescription>No grades entered yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Start entering grades to see statistics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { statistics } = stats;
  const gradedPercentage = (stats.graded_count / stats.total_students) * 100;

  // Sort grades for display
  const sortedGrades = Object.entries(statistics.grade_distribution)
    .sort(([a], [b]) => {
      const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
      return gradeOrder.indexOf(a) - gradeOrder.indexOf(b);
    });

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-2xl font-bold">{stats.total_students}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Graded</p>
                <p className="text-2xl font-bold">{stats.graded_count}</p>
                <p className="text-xs text-gray-500">{gradedPercentage.toFixed(1)}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600 opacity-70" />
            </div>
            <Progress value={gradedPercentage} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pass Rate</p>
                <p className="text-2xl font-bold">{statistics.pass_percentage.toFixed(1)}%</p>
                <p className="text-xs text-gray-500">
                  {statistics.pass_count}/{stats.graded_count}
                </p>
              </div>
              <TrendingUp className={cn(
                'h-8 w-8 opacity-70',
                statistics.pass_percentage >= 75 ? 'text-green-600' : 'text-yellow-600'
              )} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average</p>
                <p className="text-2xl font-bold">{statistics.average_percentage.toFixed(1)}%</p>
                <p className="text-xs text-gray-500">{statistics.average_marks.toFixed(1)} marks</p>
              </div>
              <Award className="h-8 w-8 text-purple-600 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pass/Fail Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pass/Fail Breakdown</CardTitle>
            <CardDescription>Performance distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Passed</p>
                  <p className="text-sm text-green-700">
                    Students who met the passing criteria
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-900">{statistics.pass_count}</p>
                <p className="text-sm text-green-700">{statistics.pass_percentage.toFixed(1)}%</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">Failed</p>
                  <p className="text-sm text-red-700">
                    Students below the passing criteria
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-900">{statistics.fail_count}</p>
                <p className="text-sm text-red-700">
                  {((statistics.fail_count / stats.graded_count) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Range */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Score Range</CardTitle>
            <CardDescription>Highest and lowest marks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100">
                  <TrendingUp className="h-6 w-6 text-yellow-700" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Highest Score</p>
                  <p className="text-sm text-gray-600">Best performance</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yellow-900">{statistics.highest_marks}</p>
                <p className="text-sm text-gray-600">marks</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100">
                  <TrendingDown className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Lowest Score</p>
                  <p className="text-sm text-gray-600">Needs attention</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">{statistics.lowest_marks}</p>
                <p className="text-sm text-gray-600">marks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grade Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Grade Distribution</CardTitle>
          <CardDescription>Number of students per grade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {sortedGrades.map(([grade, count]) => {
              const percentage = (count / stats.graded_count) * 100;
              const colorClass = grade.startsWith('A')
                ? 'from-green-500 to-emerald-500'
                : grade.startsWith('B')
                ? 'from-blue-500 to-cyan-500'
                : grade.startsWith('C')
                ? 'from-yellow-500 to-amber-500'
                : grade.startsWith('D')
                ? 'from-orange-500 to-red-500'
                : 'from-red-600 to-rose-600';

              return (
                <div
                  key={grade}
                  className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 text-center"
                >
                  <div
                    className={cn(
                      'absolute bottom-0 left-0 right-0 opacity-10 bg-gradient-to-t',
                      colorClass
                    )}
                    style={{ height: `${Math.min(percentage, 100)}%` }}
                  />
                  <div className="relative z-10">
                    <p className="text-2xl font-bold text-gray-900">{grade}</p>
                    <p className="text-3xl font-bold text-gray-800 my-2">{count}</p>
                    <Badge variant="secondary" className="text-xs">
                      {percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
