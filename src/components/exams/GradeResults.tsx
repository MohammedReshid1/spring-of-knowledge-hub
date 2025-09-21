import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Save, Edit, Users, Award, CheckCircle, XCircle, 
  Clock, FileText, Plus, Download
} from 'lucide-react';
import { format } from 'date-fns';

interface ExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  marks_obtained: number;
  attendance_status: string;
  submission_status: string;
  graded_by: string;
  graded_at?: string;
  feedback?: string;
  remarks?: string;
  percentage: number;
  grade: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  email?: string;
}

interface Exam {
  id: string;
  name: string;
  total_marks: number;
  passing_marks: number;
  exam_date: string;
  subject_id: string;
  class_id: string;
}

interface GradeResultsProps {
  examId: string;
  onClose: () => void;
}

export const GradeResults = ({ examId, onClose }: GradeResultsProps) => {
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<ExamResult | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();
  const { isTeacher, isAdminRole, canEdit, canCreate } = useRoleAccess();

  // Fetch exam details
  const { data: exam } = useQuery({
    queryKey: ['exam', examId],
    queryFn: async () => {
      const { data, error } = await apiClient.getExam(examId);
      if (error) throw new Error(error);
      return data as Exam;
    }
  });

  // Fetch exam results
  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['exam-results', examId],
    queryFn: async () => {
      const { data, error } = await apiClient.getExamResults({ exam_id: examId });
      if (error) throw new Error(error);
      return data as ExamResult[];
    }
  });

  // Fetch students for the class
  const { data: studentsResponse } = useQuery({
    queryKey: ['students', exam?.class_id],
    queryFn: async () => {
      if (!exam?.class_id) return { items: [] };
      const { data, error } = await apiClient.request(`/students/?class_id=${exam.class_id}`);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!exam?.class_id
  });

  const students = studentsResponse?.items || [];

  // Also get all students for the class without filter for debugging
  const { data: allStudentsResponse } = useQuery({
    queryKey: ['all-students'],
    queryFn: async () => {
      const { data, error } = await apiClient.request('/students/');
      if (error) throw new Error(error);
      return data;
    }
  });

  const allStudents = allStudentsResponse?.items || [];

  // Role-based access control for grading
  const canGradeStudents = () => {
    // Teachers can grade students, admins can grade students
    return isTeacher || isAdminRole || canEdit;
  };

  const canBulkImport = () => {
    // Only admins and teachers can bulk import results
    return isTeacher || isAdminRole;
  };

  // Create/Update exam result mutation
  const saveResultMutation = useMutation({
    mutationFn: async ({ resultData, isUpdate }: { resultData: any; isUpdate: boolean }) => {
      const { data, error } = isUpdate 
        ? await apiClient.updateExamResult(editingResult?.id!, resultData)
        : await apiClient.createExamResult(resultData);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-results', examId] });
      setIsGradeDialogOpen(false);
      setEditingResult(null);
      setSelectedStudent('');
      toast({
        title: "Success",
        description: "Result saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleGradeStudent = (formData: FormData) => {
    const isUpdate = !!editingResult;
    const resultData = {
      exam_id: examId,
      student_id: selectedStudent || editingResult?.student_id,
      marks_obtained: parseFloat(formData.get('marks_obtained') as string),
      attendance_status: formData.get('attendance_status') as string,
      submission_status: formData.get('submission_status') as string,
      feedback: formData.get('feedback') as string,
      remarks: formData.get('remarks') as string,
      graded_by: 'current_user', // This should be the current user ID
      graded_at: new Date().toISOString(),
    };

    saveResultMutation.mutate({ resultData, isUpdate });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (file.name.endsWith('.csv')) {
        parseCSV(text);
      } else {
        toast({
          title: "Error",
          description: "Only CSV files are supported for now",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      toast({
        title: "Error",
        description: "CSV file must have at least a header row and one data row",
        variant: "destructive",
      });
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['student_id', 'marks_obtained'];
    const optionalHeaders = ['attendance_status', 'submission_status', 'feedback', 'remarks'];
    
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      toast({
        title: "Error",
        description: `Missing required columns: ${missingHeaders.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    const data = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, i) => {
        if (requiredHeaders.includes(header) || optionalHeaders.includes(header)) {
          row[header] = values[i] || '';
        }
      });
      
      // Validate marks
      const marks = parseFloat(row.marks_obtained);
      if (isNaN(marks) || marks < 0 || marks > (exam?.total_marks || 100)) {
        throw new Error(`Invalid marks on row ${index + 2}: ${row.marks_obtained}`);
      }
      
      return {
        ...row,
        marks_obtained: marks,
        attendance_status: row.attendance_status || 'present',
        submission_status: row.submission_status || 'submitted',
        exam_id: examId,
        graded_by: 'current_user'
      };
    });

    setImportData(data);
  };

  const handleBulkImport = async () => {
    if (importData.length === 0) {
      toast({
        title: "Error",
        description: "No data to import",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingImport(true);
    let successCount = 0;
    let errorCount = 0;

    for (const resultData of importData) {
      try {
        await saveResultMutation.mutateAsync({ resultData, isUpdate: false });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Error importing result:', error);
      }
    }

    setIsProcessingImport(false);
    setBulkImportOpen(false);
    setImportFile(null);
    setImportData([]);

    toast({
      title: "Import Complete",
      description: `Successfully imported ${successCount} results. ${errorCount} errors.`,
      variant: successCount > 0 ? "default" : "destructive",
    });
  };

  const downloadTemplate = () => {
    const csvContent = [
      'student_id,marks_obtained,attendance_status,submission_status,feedback,remarks',
      'example_student_id,85,present,submitted,Good performance,Well done'
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exam_results_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getStudentName = (studentId: string) => {
    const student = allStudents.find(s => s.id === studentId);
    return student ? `${student.first_name} ${student.last_name}` : 'Unknown Student';
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

  const getStatusColor = (status: string) => {
    return status === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  // Filter students from the exam's class who haven't been graded yet
  const classStudents = allStudents.filter(student => student.class_id === exam?.class_id);
  const ungradedStudents = classStudents.filter(student => 
    !results.some(result => result.student_id === student.id)
  );

  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('Grade Results Debug:', {
      examClassId: exam?.class_id,
      totalStudents: allStudents.length,
      classStudents: classStudents.length,
      existingResults: results.length,
      ungradedStudents: ungradedStudents.length,
      canGrade: canGradeStudents()
    });
  }

  const passCount = results.filter(result => result.status === 'pass').length;
  const failCount = results.filter(result => result.status === 'fail').length;
  const averageMarks = results.length > 0 
    ? results.reduce((sum, result) => sum + result.marks_obtained, 0) / results.length 
    : 0;

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
                <Award className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Grade Results
                </h2>
                <p className="text-gray-600">
                  {exam?.name} - Total Marks: {exam?.total_marks}
                </p>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={onClose} className="bg-white/80 border-blue-200 text-blue-700 hover:bg-blue-50 backdrop-blur-sm">
            <FileText className="h-4 w-4 mr-2" />
            Back to Exams
          </Button>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Premium Action Bar */}
          <div className="bg-white/80 backdrop-blur-glass rounded-2xl border border-white/20 shadow-premium-lg animate-fadeInUp">
            <div className="px-8 py-6">
              <div className="flex justify-between items-center">
                <h4 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Student Results Management
                </h4>
                <div className="flex space-x-3">
                  {canBulkImport() && (
                    <Button
                      variant="outline"
                      onClick={() => setBulkImportOpen(true)}
                      className="bg-white/50 border-blue-200 text-blue-700 hover:bg-blue-50/80 backdrop-blur-sm transition-all duration-300"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Bulk Import
                    </Button>
                  )}
                  {canGradeStudents() ? (
                    <Button
                      onClick={() => {
                        setEditingResult(null);
                        setIsGradeDialogOpen(true);
                      }}
                      disabled={ungradedStudents.length === 0}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-premium hover:shadow-premium-lg transition-all duration-300 animate-pulseGlow"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Grade
                    </Button>
                  ) : (
                    <p className="text-sm text-blue-600/70 bg-blue-50/50 px-4 py-2 rounded-lg backdrop-blur-sm">
                      View only - Contact admin for grading permissions
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Premium Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-blue-100/50 shadow-premium p-6 hover:shadow-premium-lg transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {classStudents.length}
                  </div>
                  <div className="text-sm text-blue-600/70 font-medium">Total Students</div>
                </div>
              </div>
              <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-shimmer" style={{ width: '100%' }} />
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-green-100/50 shadow-premium p-6 hover:shadow-premium-lg transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    {passCount}
                  </div>
                  <div className="text-sm text-green-600/70 font-medium">Passed</div>
                </div>
              </div>
              <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-shimmer" style={{ width: `${classStudents.length > 0 ? (passCount / classStudents.length) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-red-100/50 shadow-premium p-6 hover:shadow-premium-lg transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                    {failCount}
                  </div>
                  <div className="text-sm text-red-600/70 font-medium">Failed</div>
                </div>
              </div>
              <div className="h-2 bg-red-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500 to-rose-500 rounded-full animate-shimmer" style={{ width: `${classStudents.length > 0 ? (failCount / classStudents.length) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-yellow-100/50 shadow-premium p-6 hover:shadow-premium-lg transition-all duration-300 group">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-xl p-3 group-hover:scale-110 transition-transform duration-300">
                  <Award className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                    {averageMarks.toFixed(1)}
                  </div>
                  <div className="text-sm text-yellow-600/70 font-medium">Average Marks</div>
                </div>
              </div>
              <div className="h-2 bg-yellow-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full animate-shimmer" style={{ width: `${exam?.total_marks ? (averageMarks / exam.total_marks) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* Premium Results Table */}
          <div className="bg-white/90 backdrop-blur-glass rounded-2xl border border-white/20 shadow-premium-lg animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
            <div className="px-8 py-6 border-b border-blue-100/50">
              <h4 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Student Results
              </h4>
            </div>

            <div className="p-8">
              {resultsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-blue-600/70">Loading results...</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-blue-100/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
                        <TableHead className="font-semibold text-blue-700">Student</TableHead>
                        <TableHead className="font-semibold text-blue-700">Marks</TableHead>
                        <TableHead className="font-semibold text-blue-700">Percentage</TableHead>
                        <TableHead className="font-semibold text-blue-700">Grade</TableHead>
                        <TableHead className="font-semibold text-blue-700">Status</TableHead>
                        <TableHead className="font-semibold text-blue-700">Attendance</TableHead>
                        <TableHead className="font-semibold text-blue-700">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((result, index) => (
                        <TableRow
                          key={result.id}
                          className="hover:bg-blue-50/30 transition-colors duration-200 border-b border-blue-50/50"
                          style={{ animationDelay: `${0.1 * index}s` }}
                        >
                          <TableCell className="font-medium text-gray-900">
                            {getStudentName(result.student_id)}
                          </TableCell>
                          <TableCell className="font-semibold text-blue-700">
                            {result.marks_obtained}/{exam?.total_marks}
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
                              className={`${getStatusColor(result.status)} border-0 font-semibold px-3 py-1`}
                            >
                              {result.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize font-medium text-gray-700">
                            {result.attendance_status}
                          </TableCell>
                          <TableCell>
                            {canGradeStudents() && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingResult(result);
                                  setIsGradeDialogOpen(true);
                                }}
                                className="bg-blue-50/50 border-blue-200 text-blue-700 hover:bg-blue-100/80 backdrop-blur-sm transition-all duration-300"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {results.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12">
                            <div className="text-blue-600/70">
                              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p className="text-lg font-medium mb-2">No results found</p>
                              <p className="text-sm">Start grading students to see results here!</p>
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

        </div>
      </div>

      {/* Premium Grade Dialog */}
      <Dialog open={isGradeDialogOpen} onOpenChange={setIsGradeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-xl">
          {/* Premium Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 rounded-3xl pointer-events-none"></div>

          <div className="relative">
            <DialogHeader className="pb-8">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl p-4 backdrop-blur-sm border border-blue-200/30">
                  <Award className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {editingResult ? 'Edit Student Grade' : 'Add Student Grade'}
                  </DialogTitle>
                  <p className="text-gray-600 mt-1">
                    {editingResult ? 'Update exam results and feedback' : 'Record student performance and feedback'}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={(e) => {
              e.preventDefault();
              handleGradeStudent(new FormData(e.target as HTMLFormElement));
            }} className="space-y-8">

              {/* Student Selection Card */}
              {!editingResult && (
                <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl p-2.5">
                      <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Student Selection</h3>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Select Student
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select value={selectedStudent} onValueChange={setSelectedStudent} required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90">
                        <SelectValue placeholder="Choose a student to grade" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-md border-blue-200/60 rounded-xl shadow-premium">
                        {ungradedStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id} className="rounded-lg focus:bg-blue-50">
                            {student.first_name} {student.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Grading & Assessment */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Marks Card */}
                <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-2.5">
                      <Award className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Marks & Performance</h3>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="marks_obtained" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Marks Obtained
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="marks_obtained"
                      name="marks_obtained"
                      type="number"
                      min="0"
                      max={exam?.total_marks}
                      step="0.5"
                      defaultValue={editingResult?.marks_obtained}
                      required
                      className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90 text-lg font-medium"
                    />
                    <div className="flex items-center gap-2 text-sm">
                      <div className="bg-blue-50/80 rounded-lg px-3 py-1.5 border border-blue-200/50">
                        <span className="text-blue-700 font-medium">Total: {exam?.total_marks} marks</span>
                      </div>
                      <div className="bg-green-50/80 rounded-lg px-3 py-1.5 border border-green-200/50">
                        <span className="text-green-700 font-medium">Pass: {exam?.passing_marks} marks</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Card */}
                <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-xl p-2.5">
                      <CheckCircle className="h-5 w-5 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Attendance & Submission</h3>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        Attendance Status
                        <span className="text-red-500">*</span>
                      </Label>
                      <Select name="attendance_status" defaultValue={editingResult?.attendance_status || 'present'} required>
                        <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md border-blue-200/60 rounded-xl shadow-premium">
                          <SelectItem value="present" className="rounded-lg focus:bg-blue-50">✅ Present</SelectItem>
                          <SelectItem value="absent" className="rounded-lg focus:bg-blue-50">❌ Absent</SelectItem>
                          <SelectItem value="late" className="rounded-lg focus:bg-blue-50">⏰ Late</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        Submission Status
                        <span className="text-red-500">*</span>
                      </Label>
                      <Select name="submission_status" defaultValue={editingResult?.submission_status || 'submitted'} required>
                        <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md border-blue-200/60 rounded-xl shadow-premium">
                          <SelectItem value="submitted" className="rounded-lg focus:bg-blue-50">📝 Submitted</SelectItem>
                          <SelectItem value="not_submitted" className="rounded-lg focus:bg-blue-50">📋 Not Submitted</SelectItem>
                          <SelectItem value="partial" className="rounded-lg focus:bg-blue-50">📄 Partial Submission</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback & Comments */}
              <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-2.5">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Feedback & Comments</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="feedback" className="text-sm font-medium text-gray-700">
                      Student Feedback
                      <span className="text-sm text-gray-500 ml-2">(Visible to student)</span>
                    </Label>
                    <Textarea
                      id="feedback"
                      name="feedback"
                      rows={4}
                      defaultValue={editingResult?.feedback || ''}
                      placeholder="Provide constructive feedback to help the student improve..."
                      className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90 resize-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="remarks" className="text-sm font-medium text-gray-700">
                      Internal Remarks
                      <span className="text-sm text-gray-500 ml-2">(Private notes)</span>
                    </Label>
                    <Textarea
                      id="remarks"
                      name="remarks"
                      rows={4}
                      defaultValue={editingResult?.remarks || ''}
                      placeholder="Internal notes and observations for teacher reference..."
                      className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-6 border-t border-white/30">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsGradeDialogOpen(false)}
                  className="bg-white/80 hover:bg-white/90 border-gray-300/60 text-gray-700 rounded-xl px-6 py-2.5 transition-all duration-200 hover:shadow-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveResultMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-8 py-2.5 shadow-premium hover:shadow-premium-lg transition-all duration-300 transform hover:scale-105 border-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {saveResultMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving Grade...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Save Grade
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Premium Bulk Import Dialog */}
      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-glass border border-blue-200/50 shadow-premium-lg">
          <DialogHeader className="pb-6 border-b border-blue-100/50">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Bulk Import Exam Results
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-6">
            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200/50">
              <p className="text-sm text-blue-700 mb-3 font-medium">
                Import exam results from a CSV file. Download the template to see the required format.
              </p>
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="bg-white/50 border-blue-200 text-blue-700 hover:bg-blue-50/80 backdrop-blur-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold text-blue-700">Upload CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="cursor-pointer bg-blue-50/50 border-blue-200 focus:border-blue-400 focus:ring-blue-400/20"
              />
            </div>

            {importData.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-blue-700">Preview ({importData.length} records)</Label>
                <div className="max-h-60 overflow-y-auto bg-blue-50/30 rounded-xl border border-blue-200/50 p-3">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-blue-200/50">
                        <TableHead className="text-blue-700 font-semibold">Student ID</TableHead>
                        <TableHead className="text-blue-700 font-semibold">Marks</TableHead>
                        <TableHead className="text-blue-700 font-semibold">Attendance</TableHead>
                        <TableHead className="text-blue-700 font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.slice(0, 5).map((row, index) => (
                        <TableRow key={index} className="hover:bg-blue-100/30 border-b border-blue-100/30">
                          <TableCell className="font-medium">{row.student_id}</TableCell>
                          <TableCell className="font-semibold text-blue-700">{row.marks_obtained}</TableCell>
                          <TableCell className="capitalize">{row.attendance_status}</TableCell>
                          <TableCell className="capitalize">{row.submission_status}</TableCell>
                        </TableRow>
                      ))}
                      {importData.length > 5 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-blue-600/70 py-3">
                            ... and {importData.length - 5} more records
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-blue-100/50">
              <Button
                variant="outline"
                onClick={() => setBulkImportOpen(false)}
                className="bg-white/50 border-gray-300 text-gray-700 hover:bg-gray-50/80 backdrop-blur-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkImport}
                disabled={importData.length === 0 || isProcessingImport}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-premium hover:shadow-premium-lg transition-all duration-300"
              >
                {isProcessingImport ? 'Importing...' : `Import ${importData.length} Results`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};