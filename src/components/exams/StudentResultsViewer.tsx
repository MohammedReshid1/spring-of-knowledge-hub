import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Award,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertCircle,
  Target
} from 'lucide-react';

interface StudentResultsViewerProps {
  studentId: string;
  studentName: string;
}

interface ExamResult {
  id: string;
  exam_id: string;
  exam_name: string;
  subject_name: string;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  status: 'pass' | 'fail';
  exam_date: string;
  term: string;
  academic_year: string;
  exam_type: string;
  feedback?: string;
  rank?: number;
  class_average?: number;
}

export const StudentResultsViewer: React.FC<StudentResultsViewerProps> = ({
  studentId,
  studentName
}) => {
  const [selectedTerm, setSelectedTerm] = useState<string>('all');

  // Fetch student's exam results
  const { data: results = [], isLoading, error } = useQuery<ExamResult[]>({
    queryKey: ['student-exam-results', studentId, selectedTerm],
    queryFn: async () => {
      const { data, error } = await apiClient.getStudentExamSummary(
        studentId,
        undefined, // academic_year - not filtering by academic year for now
        selectedTerm !== 'all' ? selectedTerm : undefined
      );
      if (error) throw new Error(error);
      return data || [];
    },
    staleTime: 30000
  });

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!results.length) return null;

    const totalExams = results.length;
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const avgPercentage = results.reduce((sum, r) => sum + r.percentage, 0) / totalExams;
    const totalMarks = results.reduce((sum, r) => sum + r.marks_obtained, 0);
    const maxPossibleMarks = results.reduce((sum, r) => sum + r.total_marks, 0);

    return {
      totalExams,
      passed,
      failed,
      avgPercentage: avgPercentage.toFixed(2),
      totalMarks,
      maxPossibleMarks,
      passRate: ((passed / totalExams) * 100).toFixed(1)
    };
  }, [results]);

  // Group results by subject
  const resultsBySubject = React.useMemo(() => {
    const grouped: Record<string, ExamResult[]> = {};
    results.forEach(result => {
      if (!grouped[result.subject_name]) {
        grouped[result.subject_name] = [];
      }
      grouped[result.subject_name].push(result);
    });
    return grouped;
  }, [results]);

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      'A+': 'bg-green-100 text-green-800 border-green-200',
      'A': 'bg-green-100 text-green-700 border-green-200',
      'B+': 'bg-blue-100 text-blue-800 border-blue-200',
      'B': 'bg-blue-100 text-blue-700 border-blue-200',
      'C+': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'C': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'D': 'bg-orange-100 text-orange-800 border-orange-200',
      'F': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[grade] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (status: string) => {
    return status === 'pass' ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load exam results. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!results.length) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="text-center py-12">
          <BookOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Exam Results Available</h3>
          <p className="text-muted-foreground">
            {studentName} doesn't have any exam results yet. Results will appear here once exams are graded.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Exams</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">{stats.totalExams}</p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium">Passed</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{stats.passed}</p>
                  <p className="text-xs text-green-600 mt-1">{stats.passRate}% Pass Rate</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Average Score</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">{stats.avgPercentage}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-orange-600 font-medium">Total Marks</p>
                  <p className="text-2xl font-bold text-orange-700 mt-1">
                    {stats.totalMarks}/{stats.maxPossibleMarks}
                  </p>
                </div>
                <Target className="h-8 w-8 text-orange-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="all">All Results</TabsTrigger>
          <TabsTrigger value="by-subject">By Subject</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Award className="h-5 w-5 mr-2" />
                All Exam Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Marks</TableHead>
                    <TableHead className="text-center">Percentage</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="font-medium">{result.exam_name}</TableCell>
                      <TableCell>{result.subject_name}</TableCell>
                      <TableCell>{new Date(result.exam_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-center">
                        {result.marks_obtained}/{result.total_marks}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {result.percentage.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getGradeColor(result.grade)}>
                          {result.grade}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusIcon(result.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-subject" className="space-y-4">
          {Object.entries(resultsBySubject).map(([subject, subjectResults]) => {
            const avgScore = subjectResults.reduce((sum, r) => sum + r.percentage, 0) / subjectResults.length;
            return (
              <Card key={subject}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{subject}</span>
                    <Badge variant="outline">
                      Average: {avgScore.toFixed(1)}%
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {subjectResults.map((result) => (
                      <div key={result.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{result.exam_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(result.exam_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-semibold">{result.marks_obtained}/{result.total_marks}</p>
                            <p className="text-sm text-muted-foreground">{result.percentage.toFixed(1)}%</p>
                          </div>
                          <Badge className={getGradeColor(result.grade)}>
                            {result.grade}
                          </Badge>
                          {getStatusIcon(result.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Recent Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.slice(0, 5).map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <p className="font-semibold">{result.exam_name}</p>
                      <p className="text-sm text-muted-foreground">{result.subject_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(result.exam_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-lg font-bold">{result.percentage.toFixed(1)}%</p>
                        <Badge className={`${getGradeColor(result.grade)} text-xs`}>
                          {result.grade}
                        </Badge>
                      </div>
                      {getStatusIcon(result.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Performance by exam type */}
                <div>
                  <h3 className="font-semibold mb-3">Performance by Exam Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(
                      results.reduce((acc, r) => {
                        if (!acc[r.exam_type]) acc[r.exam_type] = [];
                        acc[r.exam_type].push(r);
                        return acc;
                      }, {} as Record<string, ExamResult[]>)
                    ).map(([type, typeResults]) => {
                      const avgScore = typeResults.reduce((sum, r) => sum + r.percentage, 0) / typeResults.length;
                      const passed = typeResults.filter(r => r.status === 'pass').length;
                      return (
                        <Card key={type}>
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-muted-foreground">{type}</p>
                            <p className="text-2xl font-bold mt-1">{avgScore.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {passed}/{typeResults.length} Passed
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Subject-wise average */}
                <div>
                  <h3 className="font-semibold mb-3">Subject-wise Average</h3>
                  <div className="space-y-2">
                    {Object.entries(resultsBySubject).map(([subject, subjectResults]) => {
                      const avgScore = subjectResults.reduce((sum, r) => sum + r.percentage, 0) / subjectResults.length;
                      return (
                        <div key={subject} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium">{subject}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-green-500"
                                style={{ width: `${avgScore}%` }}
                              />
                            </div>
                            <span className="font-semibold w-16 text-right">{avgScore.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
