import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranchData } from '@/hooks/useBranchData';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Edit, Trash2, Eye, BarChart3, Calendar, Clock,
  BookOpen, Users, Award, AlertCircle, FileText, PlusCircle,
  Search, Filter, Download, AlignLeft, Save
} from 'lucide-react';
import { format } from 'date-fns';
import { GradeResults } from '@/components/exams/GradeResults';
import { ViewReports } from '@/components/exams/ViewReports';

interface Exam {
  id: string;
  name: string;
  subject_id: string;
  class_id: string;
  teacher_id: string;
  exam_type: string;
  total_marks: number;
  passing_marks: number;
  exam_date: string;
  duration_minutes: number;
  instructions?: string;
  syllabus_topics?: string[];
  academic_year: string;
  term: string;
  is_active: boolean;
  created_at: string;
}

export default function ExamsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'stats' | 'grade' | 'grading' | 'reports'>('list');
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [gradingExamId, setGradingExamId] = useState<string>('');
  const [filters, setFilters] = useState({
    class_id: 'all',
    subject_id: 'all',
    exam_type: 'all',
    academic_year: '',
    term: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();
  const { getBranchFilter } = useBranchData();

  // Fetch exams
  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['exams', filters, selectedBranch, searchTerm],
    queryFn: async () => {
      const params = {
        ...filters,
        ...(selectedBranch && selectedBranch !== 'all' && { branch_id: selectedBranch })
      };

      // Remove empty values and 'all' values
      Object.keys(params).forEach(key => {
        if (!params[key] || params[key] === 'all') {
          delete params[key];
        }
      });

      const { data, error } = await apiClient.getExams(params);
      if (error) throw new Error(error);
      return data || [];
    }
  });

  // Fetch subjects for dropdown
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getSubjects();
      if (error) throw new Error(error);
      return data || [];
    }
  });

  // Fetch classes for dropdown
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getClasses();
      if (error) throw new Error(error);
      const allClasses = data || [];
      if (selectedBranch && selectedBranch !== 'all') {
        return allClasses.filter(cls => cls.branch_id === selectedBranch);
      }
      return allClasses;
    }
  });

  // Fetch teachers for dropdown
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getTeachers();
      if (error) throw new Error(error);
      const allTeachers = data || [];
      if (selectedBranch && selectedBranch !== 'all') {
        return allTeachers.filter(teacher => teacher.branch_id === selectedBranch);
      }
      return allTeachers;
    }
  });

  // Fetch current academic year for auto-population
  const { data: currentAcademicYear } = useQuery({
    queryKey: ['current-academic-year'],
    queryFn: async () => {
      const { data, error } = await apiClient.request('/academic-calendar/academic-years/current');
      if (error) throw new Error(error);
      return data;
    }
  });

  // Create exam mutation
  const createExamMutation = useMutation({
    mutationFn: async (examData: Partial<Exam>) => {
      const { data, error } = await apiClient.createExam(examData);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Exam created successfully",
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

  // Update exam mutation
  const updateExamMutation = useMutation({
    mutationFn: async ({ id, examData }: { id: string; examData: Partial<Exam> }) => {
      const { data, error } = await apiClient.updateExam(id, examData);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: (updatedExam) => {
      queryClient.invalidateQueries({
        queryKey: ['exams'],
        refetchType: 'all'
      });

      queryClient.setQueryData(['exams', filters, selectedBranch, searchTerm], (oldData: Exam[] | undefined) => {
        if (!oldData) return [updatedExam];
        return oldData.map(exam =>
          exam.id === updatedExam.id ? updatedExam : exam
        );
      });

      setIsEditDialogOpen(false);
      setSelectedExam(null);
      toast({
        title: "Success",
        description: "Exam updated successfully",
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

  // Delete exam mutation
  const deleteExamMutation = useMutation({
    mutationFn: async (examId: string) => {
      const { error } = await apiClient.deleteExam(examId);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast({
        title: "Success",
        description: "Exam deleted successfully",
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

  // Helper function to map viewMode to tab values
  const getTabValue = (mode: string) => {
    switch (mode) {
      case 'list': return 'exams';
      case 'stats': return 'statistics';
      case 'grading': return 'grading';
      case 'reports': return 'reports';
      default: return 'exams';
    }
  };

  const handleCreateExam = (formData: FormData) => {
    const examDateValue = formData.get('exam_date') as string;
    const durationValue = formData.get('duration_minutes') as string;

    if (!examDateValue) {
      toast({
        title: "Error",
        description: "Please select exam date and time",
        variant: "destructive",
      });
      return;
    }

    const examData = {
      name: formData.get('name') as string,
      subject_id: formData.get('subject_id') as string,
      class_id: formData.get('class_id') as string,
      teacher_id: formData.get('teacher_id') as string,
      exam_type: formData.get('exam_type') as string,
      total_marks: parseFloat(formData.get('total_marks') as string),
      passing_marks: parseFloat(formData.get('passing_marks') as string),
      exam_date: new Date(examDateValue).toISOString(),
      duration_minutes: parseInt(durationValue),
      instructions: formData.get('instructions') as string || '',
      academic_year: formData.get('academic_year') as string,
      term: formData.get('term') as string,
      branch_id: selectedBranch && selectedBranch !== 'all' ? selectedBranch : null,
    };

    createExamMutation.mutate(examData);
  };

  const handleUpdateExam = (formData: FormData) => {
    if (!selectedExam) return;

    const examDateValue = formData.get('exam_date') as string;
    const durationValue = formData.get('duration_minutes') as string;

    if (!examDateValue) {
      toast({
        title: "Error",
        description: "Please select exam date and time",
        variant: "destructive",
      });
      return;
    }

    const examData = {
      name: formData.get('name') as string,
      subject_id: formData.get('subject_id') as string,
      class_id: formData.get('class_id') as string,
      teacher_id: formData.get('teacher_id') as string,
      exam_type: formData.get('exam_type') as string,
      total_marks: parseFloat(formData.get('total_marks') as string),
      passing_marks: parseFloat(formData.get('passing_marks') as string),
      exam_date: new Date(examDateValue).toISOString(),
      duration_minutes: parseInt(durationValue),
      instructions: formData.get('instructions') as string || '',
      academic_year: formData.get('academic_year') as string,
      term: formData.get('term') as string,
      branch_id: selectedBranch && selectedBranch !== 'all' ? selectedBranch : null,
    };

    updateExamMutation.mutate({ id: selectedExam.id, examData });
  };

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.subject_name || 'Unknown Subject';
  };

  const getClassName = (classId: string) => {
    const classData = classes.find(c => c.id === classId);
    return classData?.class_name || 'Unknown Class';
  };

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Unknown Teacher';
  };

  const getExamTypeColor = (examType: string) => {
    const colors = {
      'midterm': 'bg-blue-100 text-blue-800',
      'final': 'bg-red-100 text-red-800',
      'quiz': 'bg-green-100 text-green-800',
      'assignment': 'bg-yellow-100 text-yellow-800',
      'project': 'bg-purple-100 text-purple-800'
    };
    return colors[examType as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const handleViewExam = (exam: Exam) => {
    setSelectedExam(exam);
    setIsViewDialogOpen(true);
  };

  const handleEditExam = (exam: Exam) => {
    setSelectedExam(exam);
    setIsEditDialogOpen(true);
  };

  const handleQuickAction = (action: string, examId?: string) => {
    switch (action) {
      case 'grade':
        // Always go to grade results tab
        setViewMode('grading');
        if (examId) {
          setGradingExamId(examId);
        }
        break;
      case 'reports':
        setViewMode('reports');
        break;
      case 'schedule':
        setIsCreateDialogOpen(true);
        break;
      default:
        break;
    }
  };

  const handleSearch = () => {
    setShowSearch(!showSearch);
  };

  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };

  const handleExport = () => {
    if (exams.length === 0) {
      toast({
        title: "No Data to Export",
        description: "No exams found to export",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    let csvContent = 'Name,Subject,Class,Type,Date,Duration,Total Marks,Passing Marks,Academic Year,Term\n';

    exams.forEach((exam) => {
      csvContent += `"${exam.name}","${getSubjectName(exam.subject_id)}","${getClassName(exam.class_id)}","${exam.exam_type}","${format(new Date(exam.exam_date), 'yyyy-MM-dd HH:mm')}","${exam.duration_minutes}","${exam.total_marks}","${exam.passing_marks}","${exam.academic_year}","${exam.term}"\n`;
    });

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exams-export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Exams data has been exported to CSV",
    });
  };

  // Filter exams based on search term
  const filteredExams = exams.filter(exam => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      exam.name.toLowerCase().includes(searchLower) ||
      getSubjectName(exam.subject_id).toLowerCase().includes(searchLower) ||
      getClassName(exam.class_id).toLowerCase().includes(searchLower) ||
      exam.exam_type.toLowerCase().includes(searchLower)
    );
  });

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
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out;
        }
        .animate-slide-in-right {
          animation: slideInRight 0.6s ease-out;
        }
        .animate-pulse-glow {
          animation: pulseGlow 2s infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Premium Hero Header */}
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
                <BookOpen className="mr-2 h-4 w-4" />
                Examination Management System
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Exam <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Management</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Create, schedule, and manage examinations with comprehensive analytics and reporting.
                Streamline your assessment operations with premium tools.
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
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
          {/* Premium Action Bar */}
          <div className="mx-auto max-w-7xl">
            <div className="animate-fade-in-up bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium-lg p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleSearch}
                    size="sm"
                    variant="ghost"
                    className="bg-white/60 hover:bg-white/80 border border-white/40 rounded-2xl text-gray-700 font-medium backdrop-blur-sm transition-all duration-300 hover:scale-105"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search Exams
                  </Button>
                  <Button
                    onClick={handleFilterToggle}
                    size="sm"
                    variant="ghost"
                    className="bg-white/60 hover:bg-white/80 border border-white/40 rounded-2xl text-gray-700 font-medium backdrop-blur-sm transition-all duration-300 hover:scale-105"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button
                    onClick={handleExport}
                    size="sm"
                    variant="ghost"
                    className="bg-white/60 hover:bg-white/80 border border-white/40 rounded-2xl text-gray-700 font-medium backdrop-blur-sm transition-all duration-300 hover:scale-105"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleQuickAction('grade')}
                    variant="outline"
                    size="sm"
                    className="bg-white/60 hover:bg-white/80 border border-white/40 rounded-2xl font-medium backdrop-blur-sm transition-all duration-300 hover:scale-105"
                  >
                    <Award className="h-4 w-4 mr-2" />
                    Grade Results
                  </Button>
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create Exam
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          {showSearch && (
            <div className="mx-auto max-w-7xl">
              <div className="animate-fade-in-up bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium-lg p-6">
                <div className="flex items-center gap-4">
                  <Search className="h-5 w-5 text-blue-600" />
                  <Input
                    placeholder="Search exams by name, subject, class, or type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-white/60 border-white/40 rounded-xl focus:border-blue-400 focus:ring-blue-400/20"
                  />
                  <Button
                    onClick={() => setSearchTerm('')}
                    variant="outline"
                    size="sm"
                    className="bg-white/60 border-white/40 rounded-xl hover:bg-white/80"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Filter Panel */}
          {showFilters && (
            <div className="mx-auto max-w-7xl">
              <div className="animate-fade-in-up bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Filter className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Filter Exams</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="filter-class">Class</Label>
                    <Select value={filters.class_id} onValueChange={(value) => setFilters(prev => ({ ...prev, class_id: value }))}>
                      <SelectTrigger className="bg-white/60 border-white/40 rounded-xl">
                        <SelectValue placeholder="All classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All classes</SelectItem>
                        {classes.map((classData) => (
                          <SelectItem key={classData.id} value={classData.id}>
                            {classData.class_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="filter-subject">Subject</Label>
                    <Select value={filters.subject_id} onValueChange={(value) => setFilters(prev => ({ ...prev, subject_id: value }))}>
                      <SelectTrigger className="bg-white/60 border-white/40 rounded-xl">
                        <SelectValue placeholder="All subjects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All subjects</SelectItem>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.subject_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="filter-type">Exam Type</Label>
                    <Select value={filters.exam_type} onValueChange={(value) => setFilters(prev => ({ ...prev, exam_type: value }))}>
                      <SelectTrigger className="bg-white/60 border-white/40 rounded-xl">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="midterm">Midterm</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="assignment">Assignment</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="filter-year">Academic Year</Label>
                    <Input
                      placeholder="2023-2024"
                      value={filters.academic_year}
                      onChange={(e) => setFilters(prev => ({ ...prev, academic_year: e.target.value }))}
                      className="bg-white/60 border-white/40 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="filter-term">Term</Label>
                    <Select value={filters.term} onValueChange={(value) => setFilters(prev => ({ ...prev, term: value }))}>
                      <SelectTrigger className="bg-white/60 border-white/40 rounded-xl">
                        <SelectValue placeholder="All terms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All terms</SelectItem>
                        <SelectItem value="1st_term">1st Term</SelectItem>
                        <SelectItem value="2nd_term">2nd Term</SelectItem>
                        <SelectItem value="3rd_term">3rd Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    onClick={() => setFilters({
                      class_id: 'all',
                      subject_id: 'all',
                      exam_type: 'all',
                      academic_year: '',
                      term: 'all'
                    })}
                    variant="outline"
                    size="sm"
                    className="bg-white/60 border-white/40 rounded-xl hover:bg-white/80"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Premium Analytics Cards */}
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="animate-slide-in-right bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:scale-105" style={{animationDelay: '0.1s'}}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Exams</p>
                      <p className="text-3xl font-bold text-gray-900">{exams.length}</p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl">
                      <BookOpen className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-slide-in-right bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:scale-105" style={{animationDelay: '0.2s'}}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">This Month</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {exams.filter(exam => {
                          const examDate = new Date(exam.exam_date);
                          const now = new Date();
                          return examDate.getMonth() === now.getMonth() &&
                                 examDate.getFullYear() === now.getFullYear();
                        }).length}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl">
                      <Calendar className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-slide-in-right bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:scale-105" style={{animationDelay: '0.3s'}}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {exams.filter(exam => new Date(exam.exam_date) > new Date()).length}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-2xl">
                      <Clock className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-slide-in-right bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:scale-105" style={{animationDelay: '0.4s'}}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Exams</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {exams.filter(exam => exam.is_active).length}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-purple-500/10 to-violet-500/10 rounded-2xl">
                      <Award className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Premium Tabs */}
          <div className="mx-auto max-w-7xl">
            <Tabs value={getTabValue(viewMode)} className="space-y-6">
              <TabsList className="bg-white/60 backdrop-blur-glass border border-white/40 rounded-2xl p-1 shadow-premium">
                <TabsTrigger
                  value="exams"
                  className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  onClick={() => setViewMode('list')}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Exams
                </TabsTrigger>
                <TabsTrigger
                  value="statistics"
                  className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  onClick={() => setViewMode('stats')}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Statistics
                </TabsTrigger>
                <TabsTrigger
                  value="grading"
                  className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  onClick={() => handleQuickAction('grade')}
                >
                  <Award className="h-4 w-4 mr-2" />
                  Grade Results
                </TabsTrigger>
                <TabsTrigger
                  value="reports"
                  className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  onClick={() => handleQuickAction('reports')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Reports
                </TabsTrigger>
              </TabsList>

              {/* Exams List */}
              <TabsContent value="exams" className="space-y-6">
                {/* Filters Card */}
                <Card className="bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-900">Filters</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-4">
                      <div>
                        <Label htmlFor="filter-class">Class</Label>
                        <Select value={filters.class_id} onValueChange={(value) => setFilters(prev => ({ ...prev, class_id: value }))}>
                          <SelectTrigger className="bg-white/60 border-white/40 rounded-xl">
                            <SelectValue placeholder="All classes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All classes</SelectItem>
                            {classes.map((classData) => (
                              <SelectItem key={classData.id} value={classData.id}>
                                {classData.class_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="filter-subject">Subject</Label>
                        <Select value={filters.subject_id} onValueChange={(value) => setFilters(prev => ({ ...prev, subject_id: value }))}>
                          <SelectTrigger className="bg-white/60 border-white/40 rounded-xl">
                            <SelectValue placeholder="All subjects" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All subjects</SelectItem>
                            {subjects.map((subject) => (
                              <SelectItem key={subject.id} value={subject.id}>
                                {subject.subject_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="filter-type">Exam Type</Label>
                        <Select value={filters.exam_type} onValueChange={(value) => setFilters(prev => ({ ...prev, exam_type: value }))}>
                          <SelectTrigger className="bg-white/60 border-white/40 rounded-xl">
                            <SelectValue placeholder="All types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All types</SelectItem>
                            <SelectItem value="midterm">Midterm</SelectItem>
                            <SelectItem value="final">Final</SelectItem>
                            <SelectItem value="quiz">Quiz</SelectItem>
                            <SelectItem value="assignment">Assignment</SelectItem>
                            <SelectItem value="project">Project</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="filter-year">Academic Year</Label>
                        <Input
                          placeholder="2023-2024"
                          value={filters.academic_year}
                          onChange={(e) => setFilters(prev => ({ ...prev, academic_year: e.target.value }))}
                          className="bg-white/60 border-white/40 rounded-xl"
                        />
                      </div>
                      <div>
                        <Label htmlFor="filter-term">Term</Label>
                        <Select value={filters.term} onValueChange={(value) => setFilters(prev => ({ ...prev, term: value }))}>
                          <SelectTrigger className="bg-white/60 border-white/40 rounded-xl">
                            <SelectValue placeholder="All terms" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All terms</SelectItem>
                            <SelectItem value="1st_term">1st Term</SelectItem>
                            <SelectItem value="2nd_term">2nd Term</SelectItem>
                            <SelectItem value="3rd_term">3rd Term</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Premium Exams Grid */}
                <div className="space-y-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                        Scheduled Exams
                      </h2>
                      <p className="text-gray-600 mt-1">Manage and monitor examination schedules</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <BookOpen className="h-4 w-4" />
                      {filteredExams.length} exams found
                    </div>
                  </div>

                  {isLoading ? (
                    <Card className="bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium">
                      <CardContent className="flex items-center justify-center py-12">
                        <div className="text-center space-y-3">
                          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                          <p className="text-gray-600">Loading exams...</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : filteredExams.length === 0 ? (
                    <Card className="bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium">
                      <CardContent className="flex items-center justify-center py-12">
                        <div className="text-center space-y-3">
                          <BookOpen className="h-12 w-12 text-gray-400 mx-auto" />
                          <p className="text-lg font-medium text-gray-900">No exams found</p>
                          <p className="text-gray-600">Get started by creating your first exam</p>
                          <Button
                            onClick={() => setIsCreateDialogOpen(true)}
                            className="mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Exam
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-6">
                      {filteredExams.map((exam) => (
                        <Card key={exam.id} className="group relative overflow-hidden bg-white/95 backdrop-blur-xl border border-white/50 rounded-3xl shadow-premium hover:shadow-premium-xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1">
                          {/* Premium Gradient Border Effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                          <CardContent className="relative p-8">
                            <div className="grid grid-cols-12 gap-6 items-center">
                              {/* Left Section - Main Info (5 columns) */}
                              <div className="col-span-5 space-y-4">
                                {/* Exam Header */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-200/50">
                                      <BookOpen className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors duration-300">
                                        {exam.name}
                                      </h3>
                                      <p className="text-sm text-gray-600 font-medium">
                                        {getSubjectName(exam.subject_id)}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Class & Type Tags */}
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-green-200/50 rounded-xl px-3 py-2">
                                    <Users className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-semibold text-green-800">{getClassName(exam.class_id)}</span>
                                  </div>
                                  <Badge className={`${getExamTypeColor(exam.exam_type)} rounded-xl text-xs font-bold px-4 py-2 border shadow-sm`}>
                                    {exam.exam_type.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>

                              {/* Middle Section - Date & Duration (3 columns) */}
                              <div className="col-span-3 space-y-4">
                                <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/80 backdrop-blur-sm border border-purple-200/50 rounded-2xl p-4">
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-purple-600" />
                                      <div>
                                        <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Exam Date</p>
                                        <p className="text-sm font-bold text-purple-800">
                                          {format(new Date(exam.exam_date), 'MMM dd, yyyy')}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="h-px bg-gradient-to-r from-purple-200/0 via-purple-200 to-purple-200/0"></div>
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 text-orange-600" />
                                      <div>
                                        <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Duration</p>
                                        <p className="text-sm font-bold text-orange-800">{exam.duration_minutes}m</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Middle-Right Section - Marks (2 columns) */}
                              <div className="col-span-2">
                                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-sm border-2 border-blue-200/50 rounded-2xl p-4 text-center group-hover:border-blue-300/70 transition-colors duration-300">
                                  <div className="space-y-2">
                                    <Award className="h-6 w-6 text-blue-600 mx-auto" />
                                    <div>
                                      <p className="text-2xl font-black text-blue-700 group-hover:text-blue-800 transition-colors duration-300">
                                        {exam.total_marks}
                                      </p>
                                      <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Total Marks</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Section - Actions (2 columns) */}
                              <div className="col-span-2">
                                <div className="flex flex-col gap-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewExam(exam)}
                                      title="View Details"
                                      className="bg-white/70 hover:bg-blue-50 border-blue-200/60 hover:border-blue-400 rounded-xl text-blue-700 hover:text-blue-800 transition-all duration-300 hover:scale-110 hover:shadow-lg group/btn"
                                    >
                                      <Eye className="h-4 w-4 group-hover/btn:scale-110 transition-transform duration-200" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleQuickAction('grade', exam.id)}
                                      title="Grade Results"
                                      className="bg-white/70 hover:bg-green-50 border-green-200/60 hover:border-green-400 rounded-xl text-green-700 hover:text-green-800 transition-all duration-300 hover:scale-110 hover:shadow-lg group/btn"
                                    >
                                      <Award className="h-4 w-4 group-hover/btn:scale-110 transition-transform duration-200" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditExam(exam)}
                                      title="Edit Exam"
                                      className="bg-white/70 hover:bg-amber-50 border-amber-200/60 hover:border-amber-400 rounded-xl text-amber-700 hover:text-amber-800 transition-all duration-300 hover:scale-110 hover:shadow-lg group/btn"
                                    >
                                      <Edit className="h-4 w-4 group-hover/btn:scale-110 transition-transform duration-200" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => deleteExamMutation.mutate(exam.id)}
                                      title="Delete Exam"
                                      className="bg-white/70 hover:bg-red-50 border-red-200/60 hover:border-red-400 rounded-xl text-red-600 hover:text-red-700 transition-all duration-300 hover:scale-110 hover:shadow-lg group/btn"
                                    >
                                      <Trash2 className="h-4 w-4 group-hover/btn:scale-110 transition-transform duration-200" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Statistics */}
              <TabsContent value="statistics" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Exam Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span>Total Exams</span>
                          <span className="font-semibold">{exams.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>This Month</span>
                          <span className="font-semibold">
                            {exams.filter(exam => {
                              const examDate = new Date(exam.exam_date);
                              const now = new Date();
                              return examDate.getMonth() === now.getMonth() &&
                                     examDate.getFullYear() === now.getFullYear();
                            }).length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Upcoming</span>
                          <span className="font-semibold">
                            {exams.filter(exam => new Date(exam.exam_date) > new Date()).length}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        By Type
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {['midterm', 'final', 'quiz', 'assignment', 'project'].map(type => {
                          const count = exams.filter(exam => exam.exam_type === type).length;
                          return (
                            <div key={type} className="flex justify-between items-center">
                              <span className="capitalize">{type}</span>
                              <Badge className={getExamTypeColor(type)}>{count}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-white/60 hover:bg-white/80 border-white/40 rounded-xl"
                          onClick={() => handleQuickAction('grade')}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Grade Results
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-white/60 hover:bg-white/80 border-white/40 rounded-xl"
                          onClick={() => handleQuickAction('reports')}
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          View Reports
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-white/60 hover:bg-white/80 border-white/40 rounded-xl"
                          onClick={() => handleQuickAction('schedule')}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Exam
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Grade Results */}
              <TabsContent value="grading" className="space-y-6">
                {gradingExamId ? (
                  <GradeResults
                    examId={gradingExamId}
                    onClose={() => {
                      setViewMode('list');
                      setGradingExamId('');
                    }}
                  />
                ) : (
                  <Card className="bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium">
                    <CardHeader>
                      <CardTitle>Select Exam to Grade</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <p className="text-muted-foreground">
                          Choose an exam to grade student results:
                        </p>
                        <div className="grid gap-4">
                          {exams.map((exam) => (
                            <Card key={exam.id} className="cursor-pointer hover:bg-muted/50 bg-white/60 border-white/40 rounded-2xl" onClick={() => {
                              setGradingExamId(exam.id);
                            }}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h4 className="font-semibold">{exam.name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      {getSubjectName(exam.subject_id)} • {getClassName(exam.class_id)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium">{exam.total_marks} marks</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(exam.exam_date), 'MMM dd, yyyy')}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        {exams.length === 0 && (
                          <div className="text-center py-8">
                            <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Exams Found</h3>
                            <p className="text-muted-foreground mb-4">
                              Create an exam first to grade student results.
                            </p>
                            <Button onClick={() => setIsCreateDialogOpen(true)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Create Exam
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Reports */}
              <TabsContent value="reports" className="space-y-6">
                <ViewReports onClose={() => setViewMode('list')} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Create Exam Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-xl">
          {/* Premium Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 rounded-3xl pointer-events-none"></div>

          <div className="relative">
            <DialogHeader className="pb-8">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl p-4 backdrop-blur-sm border border-blue-200/30">
                  <PlusCircle className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Create New Exam
                  </DialogTitle>
                  <p className="text-gray-600 mt-1">Set up a new examination with detailed configuration</p>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateExam(new FormData(e.target as HTMLFormElement));
            }} className="space-y-8">

              {/* Basic Information Card */}
              <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl p-2.5">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Exam Name
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="e.g., Mathematics Midterm Exam"
                      required
                      className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="exam_type" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Exam Type
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select name="exam_type" required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90">
                        <SelectValue placeholder="Choose exam type" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-md border-blue-200/60 rounded-xl shadow-premium">
                        <SelectItem value="midterm" className="rounded-lg focus:bg-blue-50">Midterm Examination</SelectItem>
                        <SelectItem value="final" className="rounded-lg focus:bg-blue-50">Final Examination</SelectItem>
                        <SelectItem value="quiz" className="rounded-lg focus:bg-blue-50">Quiz</SelectItem>
                        <SelectItem value="assignment" className="rounded-lg focus:bg-blue-50">Assignment</SelectItem>
                        <SelectItem value="project" className="rounded-lg focus:bg-blue-50">Project</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Class Details Card */}
              <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl p-2.5">
                    <Users className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Class & Teacher Assignment</h3>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="subject_id" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Subject
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select name="subject_id" required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-md border-blue-200/60 rounded-xl shadow-premium">
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id} className="rounded-lg focus:bg-blue-50">
                            {subject.subject_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="class_id" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Class
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select name="class_id" required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-md border-blue-200/60 rounded-xl shadow-premium">
                        {classes.map((classData) => (
                          <SelectItem key={classData.id} value={classData.id} className="rounded-lg focus:bg-blue-50">
                            {classData.class_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="teacher_id" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Teacher
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select name="teacher_id" required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90">
                        <SelectValue placeholder="Assign teacher" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-md border-blue-200/60 rounded-xl shadow-premium">
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id} className="rounded-lg focus:bg-blue-50">
                            {teacher.first_name} {teacher.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Schedule & Grading */}
              <div className="grid grid-cols-2 gap-6">
                {/* Schedule Card */}
                <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-2.5">
                      <Calendar className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Schedule</h3>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="exam_date" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        Date & Time
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="exam_date"
                        name="exam_date"
                        type="datetime-local"
                        required
                        className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90"
                      />
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Select exam date and start time
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="duration_minutes" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        Duration
                        <span className="text-red-500">*</span>
                      </Label>
                      <Select name="duration_minutes" required>
                        <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-md border-blue-200/60 rounded-xl shadow-premium">
                          <SelectItem value="30" className="rounded-lg focus:bg-blue-50">30 minutes</SelectItem>
                          <SelectItem value="45" className="rounded-lg focus:bg-blue-50">45 minutes</SelectItem>
                          <SelectItem value="60" className="rounded-lg focus:bg-blue-50">1 hour</SelectItem>
                          <SelectItem value="90" className="rounded-lg focus:bg-blue-50">1.5 hours</SelectItem>
                          <SelectItem value="120" className="rounded-lg focus:bg-blue-50">2 hours</SelectItem>
                          <SelectItem value="180" className="rounded-lg focus:bg-blue-50">3 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Grading Card */}
                <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-2.5">
                      <Award className="h-5 w-5 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Marks & Grading</h3>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="total_marks" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        Total Marks
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="total_marks"
                        name="total_marks"
                        type="number"
                        min="1"
                        placeholder="100"
                        required
                        className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="passing_marks" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        Passing Marks
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="passing_marks"
                        name="passing_marks"
                        type="number"
                        min="1"
                        placeholder="40"
                        required
                        className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Period Card */}
              <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-2.5">
                    <BookOpen className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Academic Period</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="academic_year" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Academic Year
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="academic_year"
                      name="academic_year"
                      placeholder="2024-2025"
                      defaultValue={currentAcademicYear?.name || ''}
                      required
                      className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="term" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Term
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select name="term" required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90">
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-md border-blue-200/60 rounded-xl shadow-premium">
                        <SelectItem value="1st_term" className="rounded-lg focus:bg-blue-50">1st Term</SelectItem>
                        <SelectItem value="2nd_term" className="rounded-lg focus:bg-blue-50">2nd Term</SelectItem>
                        <SelectItem value="3rd_term" className="rounded-lg focus:bg-blue-50">3rd Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Instructions Card */}
              <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-gradient-to-br from-gray-500/10 to-slate-500/10 rounded-xl p-2.5">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Additional Instructions</h3>
                  <span className="text-sm text-gray-500">(Optional)</span>
                </div>
                <div className="space-y-3">
                  <Textarea
                    id="instructions"
                    name="instructions"
                    rows={3}
                    placeholder="Enter any special instructions, rules, or notes for the exam..."
                    className="bg-white/80 border-blue-200/60 rounded-xl focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200 hover:bg-white/90 resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    These instructions will be visible to students during the exam
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-6 border-t border-white/30">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="bg-white/80 hover:bg-white/90 border-gray-300/60 text-gray-700 rounded-xl px-6 py-2.5 transition-all duration-200 hover:shadow-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createExamMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-8 py-2.5 shadow-premium hover:shadow-premium-lg transition-all duration-300 transform hover:scale-105 border-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {createExamMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Creating Exam...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Create Exam
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Exam Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-premium border border-white/50 rounded-3xl shadow-premium-xl">
          {/* Premium Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 via-purple-500/4 to-indigo-500/8 rounded-3xl pointer-events-none"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent rounded-3xl pointer-events-none"></div>

          <div className="relative">
            <DialogHeader className="pb-6 border-b border-white/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl border border-blue-200/50">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Exam Details Overview
                  </DialogTitle>
                  <p className="text-gray-600 mt-1">Complete examination information and configuration</p>
                </div>
              </div>
            </DialogHeader>

            {selectedExam && (
              <div className="space-y-8 pt-6">
                {/* Header Card - Exam Name & Type */}
                <Card className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-gray-900">{selectedExam.name}</h2>
                      <div className="flex items-center gap-3">
                        <Badge className={`${getExamTypeColor(selectedExam.exam_type)} rounded-xl px-4 py-2 text-sm font-bold shadow-sm border`}>
                          {selectedExam.exam_type.toUpperCase()}
                        </Badge>
                        <Badge variant={selectedExam.is_active ? "default" : "secondary"} className="rounded-xl px-4 py-2 text-sm font-bold shadow-sm">
                          {selectedExam.is_active ? "🟢 Active" : "🔴 Inactive"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-sm border-2 border-blue-200/50 rounded-2xl p-4 text-center min-w-[140px]">
                        <div className="flex flex-col items-center space-y-2">
                          <Award className="h-8 w-8 text-blue-600" />
                          <div className="space-y-1">
                            <p className="text-3xl font-black text-blue-700 leading-none">{selectedExam.total_marks}</p>
                            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Total Marks</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Main Information Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Academic Information */}
                  <Card className="bg-gradient-to-br from-green-50/80 to-emerald-50/80 backdrop-blur-sm rounded-2xl p-6 border border-green-200/50 shadow-premium">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-green-500/10 rounded-xl">
                        <BookOpen className="h-5 w-5 text-green-600" />
                      </div>
                      <h3 className="text-lg font-bold text-green-800">Academic Information</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-green-600 font-bold uppercase tracking-wide">Subject</Label>
                          <p className="text-lg font-semibold text-green-800 mt-1">{getSubjectName(selectedExam.subject_id)}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-green-600 font-bold uppercase tracking-wide">Class</Label>
                          <p className="text-lg font-semibold text-green-800 mt-1">{getClassName(selectedExam.class_id)}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-green-600 font-bold uppercase tracking-wide">Teacher</Label>
                        <p className="text-lg font-semibold text-green-800 mt-1">{getTeacherName(selectedExam.teacher_id)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-green-600 font-bold uppercase tracking-wide">Academic Year</Label>
                          <p className="text-lg font-semibold text-green-800 mt-1">{selectedExam.academic_year}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-green-600 font-bold uppercase tracking-wide">Term</Label>
                          <p className="text-lg font-semibold text-green-800 mt-1">{selectedExam.term}</p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Exam Configuration */}
                  <Card className="bg-gradient-to-br from-purple-50/80 to-pink-50/80 backdrop-blur-sm rounded-2xl p-6 border border-purple-200/50 shadow-premium">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-purple-500/10 rounded-xl">
                        <Clock className="h-5 w-5 text-purple-600" />
                      </div>
                      <h3 className="text-lg font-bold text-purple-800">Exam Configuration</h3>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs text-purple-600 font-bold uppercase tracking-wide">Exam Date & Time</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4 text-purple-600" />
                          <p className="text-lg font-semibold text-purple-800">
                            {format(new Date(selectedExam.exam_date), 'MMM dd, yyyy')}
                          </p>
                          <span className="text-sm text-purple-600">at</span>
                          <p className="text-lg font-semibold text-purple-800">
                            {format(new Date(selectedExam.exam_date), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-purple-600 font-bold uppercase tracking-wide">Duration</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-4 w-4 text-purple-600" />
                            <p className="text-lg font-semibold text-purple-800">{selectedExam.duration_minutes} min</p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-purple-600 font-bold uppercase tracking-wide">Passing Marks</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Award className="h-4 w-4 text-purple-600" />
                            <p className="text-lg font-semibold text-purple-800">{selectedExam.passing_marks}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Instructions Section */}
                {selectedExam.instructions && (
                  <Card className="bg-gradient-to-br from-orange-50/80 to-amber-50/80 backdrop-blur-sm rounded-2xl p-6 border border-orange-200/50 shadow-premium">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-orange-500/10 rounded-xl">
                        <AlignLeft className="h-5 w-5 text-orange-600" />
                      </div>
                      <h3 className="text-lg font-bold text-orange-800">Exam Instructions</h3>
                    </div>
                    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-orange-200/30">
                      <p className="text-sm text-orange-800 leading-relaxed">{selectedExam.instructions}</p>
                    </div>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end items-center gap-4 pt-6 border-t border-white/30">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      handleEditExam(selectedExam);
                    }}
                    className="bg-white/70 hover:bg-amber-50 border-amber-200/60 hover:border-amber-400 rounded-xl text-amber-700 hover:text-amber-800 transition-all duration-300 hover:scale-105 hover:shadow-lg px-6 py-3"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Exam
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      handleQuickAction('grade', selectedExam.id);
                    }}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 px-6 py-3"
                  >
                    <Award className="h-4 w-4 mr-2" />
                    Grade Results
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsViewDialogOpen(false)}
                    className="bg-white/80 hover:bg-white/90 border-gray-300/60 text-gray-700 hover:text-gray-800 rounded-xl px-6 py-3 transition-all duration-300 hover:scale-105"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Exam Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-xl">
          {/* Premium Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>

          <DialogHeader className="relative pb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                <Edit className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Edit Exam
                </DialogTitle>
                <p className="text-gray-600 text-sm mt-1">Update exam details and configuration</p>
              </div>
            </div>
          </DialogHeader>
          {selectedExam && (
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateExam(new FormData(e.target as HTMLFormElement));
            }} className="relative space-y-6">

              {/* Basic Information Card */}
              <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700">Exam Name</Label>
                    <Input
                      id="edit-name"
                      name="name"
                      defaultValue={selectedExam.name}
                      required
                      className="bg-white/80 border-blue-200/60 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-exam_type" className="text-sm font-medium text-gray-700">Exam Type</Label>
                    <Select name="exam_type" defaultValue={selectedExam.exam_type} required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl">
                        <SelectValue placeholder="Select exam type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="midterm">Midterm</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="assignment">Assignment</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Assignment & Configuration Card */}
              <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  Assignment & Configuration
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-subject_id" className="text-sm font-medium text-gray-700">Subject</Label>
                    <Select name="subject_id" defaultValue={selectedExam.subject_id} required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.subject_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-class_id" className="text-sm font-medium text-gray-700">Class</Label>
                    <Select name="class_id" defaultValue={selectedExam.class_id} required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((classData) => (
                          <SelectItem key={classData.id} value={classData.id}>
                            {classData.class_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-teacher_id" className="text-sm font-medium text-gray-700">Teacher</Label>
                    <Select name="teacher_id" defaultValue={selectedExam.teacher_id} required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl">
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.first_name} {teacher.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Scoring & Timing Card */}
              <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" />
                  Scoring & Timing
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-total_marks" className="text-sm font-medium text-gray-700">Total Marks</Label>
                      <Input
                        id="edit-total_marks"
                        name="total_marks"
                        type="number"
                        min="1"
                        defaultValue={selectedExam.total_marks}
                        required
                        className="bg-white/80 border-blue-200/60 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-passing_marks" className="text-sm font-medium text-gray-700">Passing Marks</Label>
                      <Input
                        id="edit-passing_marks"
                        name="passing_marks"
                        type="number"
                        min="1"
                        defaultValue={selectedExam.passing_marks}
                        required
                        className="bg-white/80 border-blue-200/60 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-exam_date" className="text-sm font-medium text-gray-700">Exam Date & Time</Label>
                      <Input
                        id="edit-exam_date"
                        name="exam_date"
                        type="datetime-local"
                        defaultValue={new Date(selectedExam.exam_date).toISOString().slice(0, 16)}
                        required
                        className="bg-white/80 border-blue-200/60 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-duration_minutes" className="text-sm font-medium text-gray-700">Duration</Label>
                      <Select name="duration_minutes" defaultValue={selectedExam.duration_minutes?.toString()} required>
                        <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="90">1.5 hours</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                          <SelectItem value="180">3 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Information Card */}
              <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  Academic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-academic_year" className="text-sm font-medium text-gray-700">Academic Year</Label>
                    <Input
                      id="edit-academic_year"
                      name="academic_year"
                      placeholder="2023-2024"
                      defaultValue={selectedExam.academic_year}
                      required
                      className="bg-white/80 border-blue-200/60 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-term" className="text-sm font-medium text-gray-700">Term</Label>
                    <Select name="term" defaultValue={selectedExam.term} required>
                      <SelectTrigger className="bg-white/80 border-blue-200/60 rounded-xl">
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1st_term">1st Term</SelectItem>
                        <SelectItem value="2nd_term">2nd Term</SelectItem>
                        <SelectItem value="3rd_term">3rd Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Instructions Card */}
              <div className="bg-gradient-to-br from-white/80 to-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/50 shadow-premium">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
                  <AlignLeft className="h-5 w-5 text-indigo-600" />
                  Instructions & Notes
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="edit-instructions" className="text-sm font-medium text-gray-700">Special Instructions</Label>
                  <Textarea
                    id="edit-instructions"
                    name="instructions"
                    rows={4}
                    defaultValue={selectedExam.instructions || ''}
                    placeholder="Enter any special instructions for students or invigilators..."
                    className="bg-white/80 border-blue-200/60 rounded-xl resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-white/30">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="bg-white/80 hover:bg-white/90 border-gray-300/60 text-gray-700 rounded-xl px-6 py-2.5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateExamMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-8 py-2.5 shadow-premium hover:shadow-premium-lg transition-all duration-300 transform hover:scale-105"
                >
                  {updateExamMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Updating...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Update Exam
                    </div>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}