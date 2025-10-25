import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { apiClient } from '@/lib/api';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Award,
  AlertCircle,
  FileText,
  Calendar,
  Download,
  Target
} from 'lucide-react';
import { useLiveData } from '@/hooks/useLiveData';
import { TeacherReportFilters } from '@/components/reports/TeacherReportFilters';
import { subDays } from 'date-fns';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  subject?: string;
  subject_id?: string;
  academic_year?: string;
  current_enrollment?: number;
}

interface Subject {
  id: string;
  name: string;
}

export const TeacherReportsPage = () => {
  const { user } = useAuth();
  const { isTeacher } = useRoleAccess();

  // Filter states
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  // Enable real-time updates
  useLiveData(['classes', 'students', 'attendance', 'grades', 'exam-results'], {
    additionalQueryKeys: ['teacher-reports']
  });

  // Fetch teacher's classes
  const { data: teacherClasses = [], isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: ['teacher-classes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await apiClient.getTeacherDashboardData(user.id);
      if (error) throw new Error(error);
      return data?.assigned_classes || [];
    },
    enabled: isTeacher && !!user?.id,
  });

  // Fetch subjects
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await apiClient.getSubjects({});
      if (error) throw new Error(error);
      return data?.items || [];
    },
  });

  // Fetch attendance analytics
  const { data: attendanceData } = useQuery({
    queryKey: ['attendance-analytics', selectedClass, selectedSubject, user?.id, dateRange],
    queryFn: async () => {
      if (!selectedClass) return null;
      const params: any = { period_days: 30, teacher_id: user?.id, class_id: selectedClass };
      if (selectedSubject !== 'all') params.subject_id = selectedSubject;
      const response = await apiClient.getAttendanceAnalytics(params);
      return response.data;
    },
    enabled: !!selectedClass && !!user?.id,
  });

  // Fetch students for selected class
  const { data: studentsResponse } = useQuery({
    queryKey: ['students', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return { items: [] };
      const params = new URLSearchParams();
      params.append('class_id', selectedClass);
      params.append('limit', '1000');
      const { data, error } = await apiClient.request(`/students/?${params.toString()}`);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!selectedClass,
  });

  const students = studentsResponse?.items || [];

  // Fetch exam results for selected class
  const { data: examResults = [] } = useQuery({
    queryKey: ['exam-results', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data, error } = await apiClient.request(`/exam-results/?class_id=${selectedClass}`);
      if (error) throw new Error(error);
      return data?.items || [];
    },
    enabled: !!selectedClass,
  });

  // Calculate grade distribution
  const gradeDistribution = useMemo(() => {
    if (!examResults.length) return [];

    const ranges = [
      { label: 'A (90-100)', min: 90, max: 100, count: 0, color: 'bg-green-500' },
      { label: 'B (80-89)', min: 80, max: 90, count: 0, color: 'bg-blue-500' },
      { label: 'C (70-79)', min: 70, max: 80, count: 0, color: 'bg-yellow-500' },
      { label: 'D (60-69)', min: 60, max: 70, count: 0, color: 'bg-orange-500' },
      { label: 'F (0-59)', min: 0, max: 60, count: 0, color: 'bg-red-500' },
    ];

    examResults.forEach((result: any) => {
      const score = result.score || 0;
      const range = ranges.find(r => score >= r.min && score < r.max);
      if (range) range.count++;
    });

    return ranges;
  }, [examResults]);

  // Calculate average grade
  const averageGrade = useMemo(() => {
    if (!examResults.length) return 0;
    const total = examResults.reduce((sum: number, result: any) => sum + (result.score || 0), 0);
    return total / examResults.length;
  }, [examResults]);

  // Top performers
  const topPerformers = useMemo(() => {
    if (!students.length || !examResults.length) return [];

    const studentScores: Record<string, { student: any; totalScore: number; count: number }> = {};

    examResults.forEach((result: any) => {
      if (!studentScores[result.student_id]) {
        const student = students.find((s: any) => s.id === result.student_id);
        if (student) {
          studentScores[result.student_id] = {
            student,
            totalScore: 0,
            count: 0
          };
        }
      }
      if (studentScores[result.student_id]) {
        studentScores[result.student_id].totalScore += result.score || 0;
        studentScores[result.student_id].count++;
      }
    });

    return Object.values(studentScores)
      .map(({ student, totalScore, count }) => ({
        student,
        avgScore: totalScore / count
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);
  }, [students, examResults]);

  // Students at risk
  const studentsAtRisk = useMemo(() => {
    if (!students.length || !examResults.length) return [];

    const studentScores: Record<string, { student: any; totalScore: number; count: number }> = {};

    examResults.forEach((result: any) => {
      if (!studentScores[result.student_id]) {
        const student = students.find((s: any) => s.id === result.student_id);
        if (student) {
          studentScores[result.student_id] = {
            student,
            totalScore: 0,
            count: 0
          };
        }
      }
      if (studentScores[result.student_id]) {
        studentScores[result.student_id].totalScore += result.score || 0;
        studentScores[result.student_id].count++;
      }
    });

    return Object.values(studentScores)
      .map(({ student, totalScore, count }) => ({
        student,
        avgScore: totalScore / count
      }))
      .filter(item => item.avgScore < 60)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 10);
  }, [students, examResults]);

  const handleClearFilters = () => {
    setSelectedClass('');
    setSelectedSubject('all');
    setDateRange({
      from: subDays(new Date(), 30),
      to: new Date()
    });
  };

  if (!isTeacher) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center border-red-200">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only accessible to teachers.</p>
        </Card>
      </div>
    );
  }

  return (
    <BranchLoadingWrapper loadingMessage="Loading reports and analytics...">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 pb-20 pt-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>

          {/* Floating Shapes */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <BarChart3 className="mr-2 h-4 w-4" />
                Reports & Analytics Dashboard
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Performance <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Insights</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Comprehensive analytics and reports for your classes. Track student performance,
                attendance trends, and identify areas for improvement.
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
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16 max-w-7xl mx-auto">
          {/* Filters */}
          <div className="animate-fadeInUp">
            <TeacherReportFilters
              classes={teacherClasses}
              subjects={subjects}
              selectedClass={selectedClass}
              selectedSubject={selectedSubject}
              dateRange={dateRange}
              onClassChange={setSelectedClass}
              onSubjectChange={setSelectedSubject}
              onDateRangeChange={setDateRange}
              onClearFilters={handleClearFilters}
            />
          </div>

          {selectedClass ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-1 rounded-lg">
                <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                  <Target className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="grades" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                  <Award className="h-4 w-4 mr-2" />
                  Grades
                </TabsTrigger>
                <TabsTrigger value="attendance" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                  <Users className="h-4 w-4 mr-2" />
                  Attendance
                </TabsTrigger>
                <TabsTrigger value="students" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                  <FileText className="h-4 w-4 mr-2" />
                  Students
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6 mt-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-blue-600">Total Students</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-900">{students.length}</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-600">Avg. Grade</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-900">{averageGrade.toFixed(1)}%</div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-purple-600">Attendance Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-purple-900">
                        {attendanceData?.overall_rate?.toFixed(0) || 0}%
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-orange-600">At Risk</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-900">{studentsAtRisk.length}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Grade Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        Grade Distribution
                      </CardTitle>
                      <CardDescription>Distribution of student grades across ranges</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {gradeDistribution.map((range) => (
                          <div key={range.label} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{range.label}</span>
                              <span className="text-gray-600">{range.count} students</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={(range.count / students.length) * 100}
                                className="flex-1"
                              />
                              <span className="text-xs text-gray-500 w-12 text-right">
                                {students.length > 0 ? ((range.count / students.length) * 100).toFixed(0) : 0}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Attendance Trends */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-purple-600" />
                        Attendance Summary
                      </CardTitle>
                      <CardDescription>30-day attendance overview</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                          <div>
                            <p className="text-sm text-gray-600">Present</p>
                            <p className="text-2xl font-bold text-green-700">
                              {attendanceData?.overall_rate?.toFixed(0) || 0}%
                            </p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-green-500" />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                          <div>
                            <p className="text-sm text-gray-600">Absent</p>
                            <p className="text-2xl font-bold text-red-700">
                              {attendanceData?.absence_rate?.toFixed(0) || 0}%
                            </p>
                          </div>
                          <TrendingDown className="h-8 w-8 text-red-500" />
                        </div>

                        {attendanceData?.trend && (
                          <div className="pt-4 border-t">
                            <div className="flex items-center gap-2">
                              <Badge variant={attendanceData.trend === 'improving' ? 'default' : 'secondary'}>
                                {attendanceData.trend}
                              </Badge>
                              <span className="text-sm text-gray-600">compared to last period</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Grades Tab */}
              <TabsContent value="grades" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Performers */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-yellow-600" />
                        Top Performers
                      </CardTitle>
                      <CardDescription>Students with highest average grades</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {topPerformers.length > 0 ? (
                          topPerformers.map((item, index) => (
                            <div key={item.student.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{item.student.full_name}</p>
                                <p className="text-sm text-gray-600">{item.student.student_id}</p>
                              </div>
                              <Badge className="bg-green-100 text-green-700">
                                {item.avgScore.toFixed(1)}%
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-gray-500 py-4">No grade data available</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Students at Risk */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        Students at Risk
                      </CardTitle>
                      <CardDescription>Students scoring below 60%</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {studentsAtRisk.length > 0 ? (
                          studentsAtRisk.map((item) => (
                            <div key={item.student.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium">{item.student.full_name}</p>
                                <p className="text-sm text-gray-600">{item.student.student_id}</p>
                              </div>
                              <Badge variant="destructive">
                                {item.avgScore.toFixed(1)}%
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-green-600 font-medium">No students at risk</p>
                            <p className="text-sm text-gray-500 mt-1">All students performing well!</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Attendance Tab */}
              <TabsContent value="attendance" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Attendance Analytics</CardTitle>
                    <CardDescription>Detailed attendance statistics and trends</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Overall Rate</p>
                        <p className="text-3xl font-bold text-green-700">
                          {attendanceData?.overall_rate?.toFixed(1) || 0}%
                        </p>
                      </div>

                      <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">On-Time Rate</p>
                        <p className="text-3xl font-bold text-blue-700">
                          {attendanceData?.punctuality_rate?.toFixed(1) || 0}%
                        </p>
                      </div>

                      <div className="p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
                        <p className="text-sm text-gray-600 mb-2">Absence Rate</p>
                        <p className="text-3xl font-bold text-red-700">
                          {attendanceData?.absence_rate?.toFixed(1) || 0}%
                        </p>
                      </div>
                    </div>

                    {attendanceData?.class_breakdown && attendanceData.class_breakdown.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-medium mb-4">Class Breakdown</h4>
                        <div className="space-y-3">
                          {attendanceData.class_breakdown.map((cls: any) => (
                            <div key={cls.class_id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{cls.class_name}</span>
                                <Badge>{cls.attendance_rate?.toFixed(0)}%</Badge>
                              </div>
                              <Progress value={cls.attendance_rate || 0} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Students Tab */}
              <TabsContent value="students" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Student Performance</CardTitle>
                        <CardDescription>Detailed view of individual student performance</CardDescription>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Avg. Grade</TableHead>
                          <TableHead>Attendance</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.slice(0, 20).map((student: any) => {
                          const studentResults = examResults.filter((r: any) => r.student_id === student.id);
                          const avgGrade = studentResults.length > 0
                            ? studentResults.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / studentResults.length
                            : 0;

                          return (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{student.full_name}</TableCell>
                              <TableCell>{student.student_id}</TableCell>
                              <TableCell>
                                <Badge variant={avgGrade >= 70 ? 'default' : avgGrade >= 60 ? 'secondary' : 'destructive'}>
                                  {avgGrade.toFixed(1)}%
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Progress value={85} className="w-20" />
                              </TableCell>
                              <TableCell>
                                <Badge variant={avgGrade >= 60 ? 'default' : 'destructive'}>
                                  {avgGrade >= 60 ? 'Good' : 'At Risk'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {students.length > 20 && (
                      <div className="mt-4 text-center text-sm text-gray-500">
                        Showing 20 of {students.length} students
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="border-blue-200/50 shadow-lg">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-6">
                  <Calendar className="h-16 w-16 text-blue-600" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-900 mb-2">Select a Class</h3>
                <p className="text-slate-600 text-center max-w-md mb-6">
                  Choose a class from the filters above to view comprehensive reports and analytics
                </p>
                {classesLoading ? (
                  <p className="text-gray-500">Loading your classes...</p>
                ) : teacherClasses.length === 0 ? (
                  <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertCircle className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                    <p className="text-amber-800">No classes assigned. Please contact your administrator.</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </BranchLoadingWrapper>
  );
};

export default TeacherReportsPage;
