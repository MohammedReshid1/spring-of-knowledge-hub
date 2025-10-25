import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { GradeEntryGrid } from '@/components/exams/GradeEntryGrid';
import { GradeStatistics } from '@/components/exams/GradeStatistics';
import {
  BookOpen,
  BarChart3,
  ClipboardCheck,
  Calendar,
  Users,
  TrendingUp,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface Exam {
  id: string;
  name: string;
  exam_date: string;
  total_marks: number;
  passing_marks: number;
  class_id: string;
  class_name?: string;
  subject_id: string;
  subject_name?: string;
}

export const TeacherGradingPage = () => {
  const { user } = useAuth();
  const { isTeacher, isAdmin, isSuperAdmin } = useRoleAccess();
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'entry' | 'statistics'>('entry');

  // Fetch teacher's exams
  const { data: examsData, isLoading: examsLoading } = useQuery({
    queryKey: ['teacher-exams', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch exams based on user role
      const { data, error } = await apiClient.getExams({});
      if (error) throw new Error(error);

      // Filter to only show exams from the last 6 months or upcoming
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      return (data?.items || []).filter((exam: Exam) => {
        const examDate = new Date(exam.exam_date);
        return examDate >= sixMonthsAgo;
      });
    },
    enabled: (isTeacher || isAdmin || isSuperAdmin) && !!user?.id
  });

  const exams = examsData || [];
  const selectedExamData = exams.find((e: Exam) => e.id === selectedExam);

  if (!isTeacher && !isAdmin && !isSuperAdmin) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only accessible to teachers and administrators.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Link to="/teacher-dashboard">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                  <ClipboardCheck className="h-8 w-8 text-blue-600" />
                </div>
                Grade Management
              </h1>
              <p className="text-slate-600 font-medium text-lg">
                Bulk grade entry and exam statistics
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="p-2 rounded-lg bg-blue-100">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Available Exams</div>
                  <div className="font-semibold text-blue-700">{exams.length}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="p-2 rounded-lg bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Quick Entry</div>
                  <div className="font-semibold text-green-700">Enabled</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Exam Selection */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Select Exam
            </CardTitle>
            <CardDescription>Choose an exam to enter or view grades</CardDescription>
          </CardHeader>
          <CardContent>
            {examsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading exams...</span>
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No exams found</p>
                <p className="text-sm">Contact your administrator to create exams</p>
              </div>
            ) : (
              <Select value={selectedExam} onValueChange={setSelectedExam}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an exam to grade" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((exam: Exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-medium">{exam.name}</span>
                        <div className="flex items-center gap-2 text-xs">
                          {exam.subject_name && (
                            <Badge variant="outline">{exam.subject_name}</Badge>
                          )}
                          {exam.class_name && (
                            <Badge variant="outline">{exam.class_name}</Badge>
                          )}
                          <span className="text-gray-500">
                            {format(new Date(exam.exam_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Grading Interface */}
        {selectedExam && selectedExamData && (
          <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
            <CardHeader className="border-b border-slate-100/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{selectedExamData.name}</CardTitle>
                  <CardDescription className="flex items-center gap-4 mt-2">
                    {selectedExamData.subject_name && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {selectedExamData.subject_name}
                      </span>
                    )}
                    {selectedExamData.class_name && (
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {selectedExamData.class_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(selectedExamData.exam_date), 'MMMM dd, yyyy')}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="px-3 py-1">
                    Total: {selectedExamData.total_marks}
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1">
                    Passing: {selectedExamData.passing_marks}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'entry' | 'statistics')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="entry" className="gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Grade Entry
                  </TabsTrigger>
                  <TabsTrigger value="statistics" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Statistics
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="entry" className="mt-0">
                  <GradeEntryGrid
                    examId={selectedExam}
                    onSaveComplete={() => {
                      // Optionally switch to statistics tab after saving
                      // setActiveTab('statistics');
                    }}
                  />
                </TabsContent>

                <TabsContent value="statistics" className="mt-0">
                  <GradeStatistics examId={selectedExam} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Instructions Card (shown when no exam is selected) */}
        {!selectedExam && !examsLoading && exams.length > 0 && (
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                How to Use
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <p className="text-gray-700">
                  Select an exam from the dropdown above to start entering grades
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <p className="text-gray-700">
                  Use the Grade Entry tab to enter marks for multiple students at once
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <p className="text-gray-700">
                  Select students using checkboxes and click "Save Grades" to submit
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <p className="text-gray-700">
                  View comprehensive statistics and grade distribution in the Statistics tab
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TeacherGradingPage;
