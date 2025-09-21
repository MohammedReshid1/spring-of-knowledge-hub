import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { 
  BarChart3, Users, Award, TrendingUp, TrendingDown, 
  Download, FileText, Calendar, Target, CreditCard, Printer
} from 'lucide-react';
import { format } from 'date-fns';

interface ExamReport {
  exam_id: string;
  exam_name: string;
  total_students: number;
  students_appeared: number;
  students_passed: number;
  students_failed: number;
  highest_marks: number;
  lowest_marks: number;
  average_marks: number;
  pass_percentage: number;
  exam_date: string;
  total_marks: number;
}

interface ViewReportsProps {
  onClose: () => void;
}

export const ViewReports = ({ onClose }: ViewReportsProps) => {
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [reportType, setReportType] = useState<'overview' | 'detailed' | 'report-cards'>('overview');
  const [reportCardDialogOpen, setReportCardDialogOpen] = useState(false);
  const [reportCardData, setReportCardData] = useState({
    academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
    term: '1st_term',
    classId: '',
    studentIds: [] as string[],
    templateId: '',
    autoPublish: false
  });

  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();

  // Fetch exams for dropdown
  const { data: exams = [] } = useQuery({
    queryKey: ['exams', selectedBranch],
    queryFn: async () => {
      const params = selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {};
      const { data, error } = await apiClient.getExams(params);
      if (error) throw new Error(error);
      return data || [];
    }
  });

  // Fetch exam statistics
  const { data: examStats, isLoading: statsLoading } = useQuery({
    queryKey: ['exam-stats', selectedExam],
    queryFn: async () => {
      if (!selectedExam) return null;
      const { data, error } = await apiClient.getExamStats(selectedExam);
      if (error) throw new Error(error);
      return data as ExamReport;
    },
    enabled: !!selectedExam
  });

  // Fetch detailed results if needed
  const { data: detailedResults = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['exam-results', selectedExam],
    queryFn: async () => {
      if (!selectedExam || reportType !== 'detailed') return [];
      const { data, error } = await apiClient.getExamResults({ exam_id: selectedExam });
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: !!selectedExam && reportType === 'detailed'
  });

  // Fetch students for detailed view
  const { data: studentsResponse } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      if (reportType !== 'detailed') return { items: [] };
      const { data, error } = await apiClient.request('/students');
      if (error) throw new Error(error);
      return data || { items: [] };
    },
    enabled: reportType === 'detailed'
  });

  const students = studentsResponse?.items || [];

  // Fetch classes for report card generation
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getClasses();
      if (error) throw new Error(error);
      const allClasses = data || [];
      if (selectedBranch && selectedBranch !== 'all') {
        return allClasses.filter((cls: any) => cls.branch_id === selectedBranch);
      }
      return allClasses;
    }
  });

  // Fetch report card templates
  const { data: templates = [] } = useQuery({
    queryKey: ['report-templates'],
    queryFn: async () => {
      const { data, error } = await apiClient.getReportCardTemplates();
      if (error) throw new Error(error);
      return data || [];
    },
    enabled: reportType === 'report-cards'
  });

  // Generate report cards mutation
  const generateReportCardsMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const { data, error } = await apiClient.generateBulkReportCards(reportData);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Report cards generated successfully",
      });
      setReportCardDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['report-cards'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getStudentName = (studentId: string) => {
    const student = students.find((s: any) => s.id === studentId);
    return student ? `${student.first_name} ${student.last_name}` : 'Unknown Student';
  };

  const handleGenerateReportCards = () => {
    generateReportCardsMutation.mutate({
      class_id: reportCardData.classId,
      academic_year: reportCardData.academicYear,
      term: reportCardData.term,
      template_id: reportCardData.templateId || undefined,
      auto_publish: reportCardData.autoPublish
    });
  };

  const getGradeColor = (grade: string) => {
    const colors: { [key: string]: string } = {
      'A+': 'bg-green-100 text-green-800',
      'A': 'bg-green-100 text-green-800',
      'B+': 'bg-blue-100 text-blue-800',
      'B': 'bg-blue-100 text-blue-800',
      'C+': 'bg-yellow-100 text-yellow-800',
      'C': 'bg-yellow-100 text-yellow-800',
      'D': 'bg-orange-100 text-orange-800',
      'F': 'bg-red-100 text-red-800'
    };
    return colors[grade] || 'bg-gray-100 text-gray-800';
  };

  const handleExportReport = () => {
    if (!examStats) return;
    
    // Create CSV content
    let csvContent = '';
    
    if (reportType === 'overview') {
      csvContent = `Exam Report - ${examStats.exam_name}\n\n`;
      csvContent += `Total Students,${examStats.total_students}\n`;
      csvContent += `Students Appeared,${examStats.students_appeared}\n`;
      csvContent += `Students Passed,${examStats.students_passed}\n`;
      csvContent += `Students Failed,${examStats.students_failed}\n`;
      csvContent += `Pass Percentage,${examStats.pass_percentage.toFixed(1)}%\n`;
      csvContent += `Average Marks,${examStats.average_marks.toFixed(1)}\n`;
      csvContent += `Highest Marks,${examStats.highest_marks}\n`;
      csvContent += `Lowest Marks,${examStats.lowest_marks}\n`;
    } else {
      csvContent = `Detailed Results - ${examStats.exam_name}\n\n`;
      csvContent += `Student Name,Marks Obtained,Total Marks,Percentage,Grade,Status,Attendance\n`;
      
      detailedResults.forEach((result: any) => {
        csvContent += `${getStudentName(result.student_id)},${result.marks_obtained},${examStats.total_marks},${result.percentage.toFixed(1)}%,${result.grade},${result.status},${result.attendance_status}\n`;
      });
    }
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam-report-${examStats.exam_name.replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

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
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
          }
          50% {
            box-shadow: 0 0 40px rgba(59, 130, 246, 0.25);
          }
        }
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        .animate-slideInRight {
          animation: slideInRight 0.5s ease-out forwards;
        }
        .animate-pulseGlow {
          animation: pulseGlow 2s ease-in-out infinite;
        }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      <div className="space-y-8">
        {/* Subpage Header */}
        <div className="flex justify-between items-center">
          <div className="animate-fadeInUp">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl p-3">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Exam Reports
                </h2>
                <p className="text-gray-600">
                  View detailed analytics and export exam reports
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={onClose}
            className="bg-white/80 border-blue-200 text-blue-700 hover:bg-blue-50 backdrop-blur-sm animate-slideInRight"
          >
            <FileText className="h-4 w-4 mr-2" />
            Back to Exams
          </Button>
        </div>

        {/* Main Content */}
        <div className="space-y-8">

          {/* Premium Report Configuration */}
          <div className="bg-white/80 backdrop-blur-glass rounded-2xl border border-white/20 shadow-premium-lg animate-fadeInUp">
            <div className="px-8 py-6 border-b border-blue-100/50">
              <h4 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Report Configuration
              </h4>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-blue-700">Select Exam</label>
                  <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger className="bg-blue-50/50 border-blue-200 focus:border-blue-400 focus:ring-blue-400/20">
                      <SelectValue placeholder="Choose an exam" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 backdrop-blur-sm border border-blue-200/50">
                      {exams.map((exam: any) => (
                        <SelectItem key={exam.id} value={exam.id} className="hover:bg-blue-50/80">
                          {exam.name} - {format(new Date(exam.exam_date), 'MMM dd, yyyy')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-blue-700">Report Type</label>
                  <Select value={reportType} onValueChange={(value: 'overview' | 'detailed' | 'report-cards') => setReportType(value)}>
                    <SelectTrigger className="bg-blue-50/50 border-blue-200 focus:border-blue-400 focus:ring-blue-400/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 backdrop-blur-sm border border-blue-200/50">
                      <SelectItem value="overview" className="hover:bg-blue-50/80">Overview Statistics</SelectItem>
                      <SelectItem value="detailed" className="hover:bg-blue-50/80">Detailed Results</SelectItem>
                      <SelectItem value="report-cards" className="hover:bg-blue-50/80">Report Cards</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-blue-700">Actions</label>
                  {reportType === 'report-cards' ? (
                    <Button
                      onClick={() => setReportCardDialogOpen(true)}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-premium hover:shadow-premium-lg transition-all duration-300 animate-pulseGlow"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Generate Reports
                    </Button>
                  ) : (
                    <Button
                      onClick={handleExportReport}
                      disabled={!selectedExam || !examStats}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-premium hover:shadow-premium-lg transition-all duration-300 animate-pulseGlow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Report Content */}
          {selectedExam && (
            <>
              {reportType === 'overview' && examStats && (
                <div className="space-y-8 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
                  {/* Premium Overview Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-blue-100/50 shadow-premium p-6 hover:shadow-premium-lg transition-all duration-300 group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                          <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            {examStats.students_appeared}
                          </div>
                          <div className="text-sm text-blue-600/70 font-medium">
                            Appeared ({examStats.total_students} total)
                          </div>
                        </div>
                      </div>
                      <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-shimmer" style={{ width: `${(examStats.students_appeared / examStats.total_students) * 100}%` }} />
                      </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-green-100/50 shadow-premium p-6 hover:shadow-premium-lg transition-all duration-300 group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                          <Target className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            {examStats.pass_percentage.toFixed(1)}%
                          </div>
                          <div className="text-sm text-green-600/70 font-medium">Pass Rate</div>
                        </div>
                      </div>
                      <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-shimmer" style={{ width: `${examStats.pass_percentage}%` }} />
                      </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-yellow-100/50 shadow-premium p-6 hover:shadow-premium-lg transition-all duration-300 group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                          <Award className="h-6 w-6 text-yellow-600" />
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                            {examStats.average_marks.toFixed(1)}
                          </div>
                          <div className="text-sm text-yellow-600/70 font-medium">Average Marks</div>
                        </div>
                      </div>
                      <div className="h-2 bg-yellow-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full animate-shimmer" style={{ width: `${(examStats.average_marks / examStats.total_marks) * 100}%` }} />
                      </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-purple-100/50 shadow-premium p-6 hover:shadow-premium-lg transition-all duration-300 group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                          <TrendingUp className="h-6 w-6 text-purple-600" />
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            {examStats.highest_marks}
                          </div>
                          <div className="text-sm text-purple-600/70 font-medium">Highest Score</div>
                        </div>
                      </div>
                      <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-shimmer" style={{ width: `${(examStats.highest_marks / examStats.total_marks) * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Premium Performance Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-white/20 shadow-premium p-8 hover:shadow-premium-lg transition-all duration-300">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-2">
                          <Users className="h-5 w-5 text-green-600" />
                        </div>
                        <h4 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                          Performance Summary
                        </h4>
                      </div>
                      <div className="space-y-5">
                        <div className="flex justify-between items-center p-3 bg-green-50/50 rounded-xl border border-green-100/50">
                          <span className="font-medium text-gray-700">Students Passed</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"></div>
                            <span className="font-bold text-green-700">{examStats.students_passed}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100/50">
                          <span className="font-medium text-gray-700">Students Failed</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gradient-to-r from-red-500 to-rose-500 rounded-full"></div>
                            <span className="font-bold text-red-700">{examStats.students_failed}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50/50 rounded-xl border border-gray-100/50">
                          <span className="font-medium text-gray-700">Absent Students</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full"></div>
                            <span className="font-bold text-gray-700">{examStats.total_students - examStats.students_appeared}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-white/20 shadow-premium p-8 hover:shadow-premium-lg transition-all duration-300">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl p-2">
                          <BarChart3 className="h-5 w-5 text-blue-600" />
                        </div>
                        <h4 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                          Score Distribution
                        </h4>
                      </div>
                      <div className="space-y-5">
                        <div className="flex justify-between items-center p-3 bg-green-50/50 rounded-xl border border-green-100/50">
                          <span className="font-medium text-gray-700">Highest Score</span>
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="font-bold text-green-700">{examStats.highest_marks}/{examStats.total_marks}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100/50">
                          <span className="font-medium text-gray-700">Lowest Score</span>
                          <div className="flex items-center space-x-2">
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            <span className="font-bold text-red-700">{examStats.lowest_marks}/{examStats.total_marks}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                          <span className="font-medium text-gray-700">Average Score</span>
                          <div className="flex items-center space-x-2">
                            <BarChart3 className="h-4 w-4 text-blue-600" />
                            <span className="font-bold text-blue-700">{examStats.average_marks.toFixed(1)}/{examStats.total_marks}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {reportType === 'detailed' && (
                <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-white/20 shadow-premium-lg animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
                  <div className="px-8 py-6 border-b border-blue-100/50">
                    <h4 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      Detailed Student Results
                    </h4>
                  </div>

                  <div className="p-8">
                    {resultsLoading ? (
                      <div className="text-center py-12">
                        <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-blue-600/70">Loading detailed results...</p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-blue-100/50">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
                              <TableHead className="font-semibold text-blue-700">Student Name</TableHead>
                              <TableHead className="font-semibold text-blue-700">Marks</TableHead>
                              <TableHead className="font-semibold text-blue-700">Percentage</TableHead>
                              <TableHead className="font-semibold text-blue-700">Grade</TableHead>
                              <TableHead className="font-semibold text-blue-700">Status</TableHead>
                              <TableHead className="font-semibold text-blue-700">Attendance</TableHead>
                              <TableHead className="font-semibold text-blue-700">Submission</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detailedResults.map((result: any, index) => (
                              <TableRow
                                key={result.id}
                                className="hover:bg-blue-50/30 transition-colors duration-200 border-b border-blue-50/50"
                                style={{ animationDelay: `${0.1 * index}s` }}
                              >
                                <TableCell className="font-medium text-gray-900">
                                  {getStudentName(result.student_id)}
                                </TableCell>
                                <TableCell className="font-semibold text-blue-700">
                                  {result.marks_obtained}/{examStats?.total_marks}
                                </TableCell>
                                <TableCell className="font-semibold text-indigo-700">
                                  {result.percentage.toFixed(1)}%
                                </TableCell>
                                <TableCell>
                                  <Badge className={`${getGradeColor(result.grade)} border-0 font-semibold px-3 py-1`}>
                                    {result.grade}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={`${result.status === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} border-0 font-semibold px-3 py-1`}
                                  >
                                    {result.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="capitalize font-medium text-gray-700">
                                  {result.attendance_status}
                                </TableCell>
                                <TableCell className="capitalize font-medium text-gray-700">
                                  {result.submission_status}
                                </TableCell>
                              </TableRow>
                            ))}
                            {detailedResults.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center py-12">
                                  <div className="text-blue-600/70">
                                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium mb-2">No results found</p>
                                    <p className="text-sm">No detailed results available for this exam.</p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {reportType === 'report-cards' && (
                <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-white/20 shadow-premium-lg animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
                  <div className="px-8 py-6 border-b border-blue-100/50">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-2">
                        <CreditCard className="h-5 w-5 text-purple-600" />
                      </div>
                      <h4 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Report Card Generation
                      </h4>
                    </div>
                  </div>

                  <div className="p-12">
                    <div className="text-center">
                      <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full p-6 w-24 h-24 mx-auto mb-6">
                        <Printer className="h-12 w-12 text-purple-600 mx-auto" />
                      </div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
                        Generate Report Cards
                      </h3>
                      <p className="text-gray-600 mb-8 text-lg">
                        Create comprehensive report cards for students based on their exam performance
                      </p>
                      <Button
                        onClick={() => setReportCardDialogOpen(true)}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-premium hover:shadow-premium-lg transition-all duration-300 animate-pulseGlow px-8 py-3"
                      >
                        <CreditCard className="h-5 w-5 mr-2" />
                        Configure Report Cards
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!selectedExam && reportType !== 'report-cards' && (
            <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-white/20 shadow-premium-lg animate-fadeInUp">
              <div className="p-16">
                <div className="text-center">
                  <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full p-6 w-24 h-24 mx-auto mb-6">
                    <FileText className="h-12 w-12 text-blue-600 mx-auto" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                    Select an Exam
                  </h3>
                  <p className="text-gray-600 text-lg">
                    Choose an exam from the dropdown above to view its report and statistics.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Premium Report Card Generation Dialog */}
      <Dialog open={reportCardDialogOpen} onOpenChange={setReportCardDialogOpen}>
        <DialogContent className="max-w-md bg-white/95 backdrop-blur-glass border border-purple-200/50 shadow-premium-lg">
          <DialogHeader className="pb-6 border-b border-purple-100/50">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Generate Report Cards
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label htmlFor="academic-year" className="text-sm font-semibold text-purple-700">Academic Year</Label>
                <Input
                  id="academic-year"
                  value={reportCardData.academicYear}
                  onChange={(e) => setReportCardData({...reportCardData, academicYear: e.target.value})}
                  placeholder="2024-2025"
                  className="bg-purple-50/50 border-purple-200 focus:border-purple-400 focus:ring-purple-400/20"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="term" className="text-sm font-semibold text-purple-700">Term</Label>
                <Select
                  value={reportCardData.term}
                  onValueChange={(value) => setReportCardData({...reportCardData, term: value})}
                >
                  <SelectTrigger className="bg-purple-50/50 border-purple-200 focus:border-purple-400 focus:ring-purple-400/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-sm border border-purple-200/50">
                    <SelectItem value="1st_term" className="hover:bg-purple-50/80">1st Term</SelectItem>
                    <SelectItem value="2nd_term" className="hover:bg-purple-50/80">2nd Term</SelectItem>
                    <SelectItem value="3rd_term" className="hover:bg-purple-50/80">3rd Term</SelectItem>
                    <SelectItem value="annual" className="hover:bg-purple-50/80">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="class" className="text-sm font-semibold text-purple-700">Class</Label>
              <Select
                value={reportCardData.classId}
                onValueChange={(value) => setReportCardData({...reportCardData, classId: value})}
              >
                <SelectTrigger className="bg-purple-50/50 border-purple-200 focus:border-purple-400 focus:ring-purple-400/20">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-sm border border-purple-200/50">
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id} className="hover:bg-purple-50/80">
                      {cls.name} - {cls.grade_level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="template" className="text-sm font-semibold text-purple-700">Template (Optional)</Label>
              <Select
                value={reportCardData.templateId}
                onValueChange={(value) => setReportCardData({...reportCardData, templateId: value})}
              >
                <SelectTrigger className="bg-purple-50/50 border-purple-200 focus:border-purple-400 focus:ring-purple-400/20">
                  <SelectValue placeholder="Use default template" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-sm border border-purple-200/50">
                  {templates.map((template: any) => (
                    <SelectItem key={template.id} value={template.id} className="hover:bg-purple-50/80">
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100/50">
              <input
                type="checkbox"
                id="auto-publish"
                checked={reportCardData.autoPublish}
                onChange={(e) => setReportCardData({...reportCardData, autoPublish: e.target.checked})}
                className="h-4 w-4 text-purple-600 border-purple-300 rounded focus:ring-purple-500"
              />
              <Label htmlFor="auto-publish" className="text-sm font-medium text-purple-700">
                Auto-publish to parents
              </Label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-purple-100/50">
              <Button
                variant="outline"
                onClick={() => setReportCardDialogOpen(false)}
                className="bg-white/50 border-gray-300 text-gray-700 hover:bg-gray-50/80 backdrop-blur-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateReportCards}
                disabled={!reportCardData.classId || !reportCardData.academicYear || generateReportCardsMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-premium hover:shadow-premium-lg transition-all duration-300 disabled:opacity-50"
              >
                {generateReportCardsMutation.isPending ? 'Generating...' : 'Generate Report Cards'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};