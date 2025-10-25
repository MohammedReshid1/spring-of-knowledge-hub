import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { apiClient } from '@/lib/api';
import { useLiveData } from '@/hooks/useLiveData';
import { useAcademicYear, getAcademicYearString } from '@/hooks/useAcademicYear';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Edit, Trash2, Eye, BarChart3, Calendar, Clock,
  BookOpen, Users, Award, AlertCircle, FileText, PlusCircle,
  Search, Filter, Download, AlignLeft, Save, Home, ChevronRight,
  ClipboardCheck, TrendingUp, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { GradeResults } from '@/components/exams/GradeResults';
import { Link } from 'react-router-dom';

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
  subject_name?: string;
  class_name?: string;
}

interface TeacherClass {
  id: string;
  class_name: string;
  current_enrollment: number;
}

interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
}

export default function TeacherExamsPage() {
  const { user } = useAuth();
  const { isTeacher } = useRoleAccess();
  const queryClient = useQueryClient();
  const academicYearQuery = useAcademicYear();

  // Enable real-time updates
  useLiveData(['exams', 'exam-results', 'classes', 'subjects']);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'stats' | 'grade'>('list');
  const [filters, setFilters] = useState({
    class_id: 'all',
    subject_id: 'all',
    exam_type: 'all',
    term: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    subject_id: '',
    class_id: '',
    exam_type: 'midterm',
    total_marks: 100,
    passing_marks: 40,
    exam_date: '',
    duration_minutes: 60,
    instructions: '',
    syllabus_topics: '',
    term: 'Term 1'
  });

  // Fetch teacher's classes
  const { data: teacherClasses = [] } = useQuery<TeacherClass[]>({
    queryKey: ['teacher-classes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await apiClient.getTeacherEnhancedClasses(user.id);
      if (error) throw error;
      return data?.classes || [];
    },
    enabled: !!user?.id
  });

  // Fetch teacher's subjects
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await apiClient.getSubjects({});
      if (error) throw error;
      // API returns array directly, not wrapped in items
      return Array.isArray(data) ? data : (data?.items || []);
    }
  });

  // Fetch teacher's exams
  const { data: examsData, isLoading } = useQuery({
    queryKey: ['teacher-exams', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return [];

      const params: any = {
        teacher_id: user.id
      };

      if (filters.class_id !== 'all') params.class_id = filters.class_id;
      if (filters.subject_id !== 'all') params.subject_id = filters.subject_id;
      if (filters.exam_type !== 'all') params.exam_type = filters.exam_type;
      if (filters.term !== 'all') params.term = filters.term;

      const { data, error } = await apiClient.getExams(params);
      if (error) throw new Error(error);
      // Handle both direct array response and object with items property
      return Array.isArray(data) ? data : (data?.items || []);
    },
    enabled: !!user?.id
  });

  // Create exam mutation
  const createExamMutation = useMutation({
    mutationFn: async (examData: any) => {
      const payload = {
        ...examData,
        teacher_id: user?.id,
        academic_year: getAcademicYearString(academicYearQuery.data),
        syllabus_topics: examData.syllabus_topics ? examData.syllabus_topics.split(',').map((t: string) => t.trim()) : []
      };
      const { data, error } = await apiClient.createExam(payload);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-exams'] });
      toast({
        title: 'Success',
        description: 'Exam created successfully',
      });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create exam',
        variant: 'destructive',
      });
    }
  });

  // Update exam mutation
  const updateExamMutation = useMutation({
    mutationFn: async ({ id, ...examData }: any) => {
      const payload = {
        ...examData,
        syllabus_topics: examData.syllabus_topics ? examData.syllabus_topics.split(',').map((t: string) => t.trim()) : []
      };
      const { data, error } = await apiClient.updateExam(id, payload);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-exams'] });
      toast({
        title: 'Success',
        description: 'Exam updated successfully',
      });
      setIsEditDialogOpen(false);
      setSelectedExam(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update exam',
        variant: 'destructive',
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
      queryClient.invalidateQueries({ queryKey: ['teacher-exams'] });
      toast({
        title: 'Success',
        description: 'Exam deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete exam',
        variant: 'destructive',
      });
    }
  });

  const exams = examsData || [];

  // Filter exams by search term
  const filteredExams = useMemo(() => {
    if (!searchTerm) return exams;
    return exams.filter((exam: Exam) =>
      exam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.class_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [exams, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: exams.length,
      upcoming: exams.filter((e: Exam) => new Date(e.exam_date) > new Date()).length,
      completed: exams.filter((e: Exam) => new Date(e.exam_date) <= new Date()).length,
      active: exams.filter((e: Exam) => e.is_active).length
    };
  }, [exams]);

  const resetForm = () => {
    setFormData({
      name: '',
      subject_id: '',
      class_id: '',
      exam_type: 'midterm',
      total_marks: 100,
      passing_marks: 40,
      exam_date: '',
      duration_minutes: 60,
      instructions: '',
      syllabus_topics: '',
      term: 'Term 1'
    });
  };

  const handleCreateExam = () => {
    createExamMutation.mutate(formData);
  };

  const handleEditExam = () => {
    if (selectedExam) {
      updateExamMutation.mutate({
        id: selectedExam.id,
        ...formData
      });
    }
  };

  const handleDeleteExam = (examId: string) => {
    if (confirm('Are you sure you want to delete this exam?')) {
      deleteExamMutation.mutate(examId);
    }
  };

  const openEditDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setFormData({
      name: exam.name,
      subject_id: exam.subject_id,
      class_id: exam.class_id,
      exam_type: exam.exam_type,
      total_marks: exam.total_marks,
      passing_marks: exam.passing_marks,
      exam_date: exam.exam_date.split('T')[0],
      duration_minutes: exam.duration_minutes,
      instructions: exam.instructions || '',
      syllabus_topics: exam.syllabus_topics?.join(', ') || '',
      term: exam.term
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setIsViewDialogOpen(true);
  };

  const openGradeDialog = (exam: Exam) => {
    setSelectedExam(exam);
    setIsGradeDialogOpen(true);
  };

  const renderBreadcrumb = () => (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
      <Home className="h-4 w-4" />
      <ChevronRight className="h-4 w-4" />
      <Link to="/teacher-dashboard" className="hover:text-foreground">Teacher Dashboard</Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-foreground font-semibold">Exam Management</span>
    </nav>
  );

  if (!isTeacher) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            This page is only accessible to teachers.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {renderBreadcrumb()}

        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                  <ClipboardCheck className="h-8 w-8 text-blue-600" />
                </div>
                Exam Management
              </h1>
              <p className="text-slate-600 font-medium mt-2">
                Create and manage exams for your classes
              </p>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Exam
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Exam</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Exam Name *</Label>
                      <Input
                        placeholder="e.g., Mid-Term Mathematics"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Exam Type *</Label>
                      <Select value={formData.exam_type} onValueChange={(value) => setFormData({ ...formData, exam_type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quiz">Quiz</SelectItem>
                          <SelectItem value="assignment">Assignment</SelectItem>
                          <SelectItem value="midterm">Mid-Term</SelectItem>
                          <SelectItem value="final">Final Exam</SelectItem>
                          <SelectItem value="practical">Practical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Class *</Label>
                      <Select value={formData.class_id} onValueChange={(value) => setFormData({ ...formData, class_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {teacherClasses.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.class_name} ({cls.current_enrollment} students)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject *</Label>
                      <Select value={formData.subject_id} onValueChange={(value) => setFormData({ ...formData, subject_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.subject_name} ({subject.subject_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Exam Date *</Label>
                      <Input
                        type="date"
                        value={formData.exam_date}
                        onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (minutes) *</Label>
                      <Input
                        type="number"
                        value={formData.duration_minutes}
                        onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Total Marks *</Label>
                      <Input
                        type="number"
                        value={formData.total_marks}
                        onChange={(e) => setFormData({ ...formData, total_marks: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Passing Marks *</Label>
                      <Input
                        type="number"
                        value={formData.passing_marks}
                        onChange={(e) => setFormData({ ...formData, passing_marks: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Term *</Label>
                      <Select value={formData.term} onValueChange={(value) => setFormData({ ...formData, term: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Term 1">Term 1</SelectItem>
                          <SelectItem value="Term 2">Term 2</SelectItem>
                          <SelectItem value="Term 3">Term 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Instructions</Label>
                    <Textarea
                      placeholder="Enter exam instructions..."
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Syllabus Topics (comma-separated)</Label>
                    <Textarea
                      placeholder="e.g., Algebra, Geometry, Trigonometry"
                      value={formData.syllabus_topics}
                      onChange={(e) => setFormData({ ...formData, syllabus_topics: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateExam}
                    disabled={createExamMutation.isPending || !formData.name || !formData.class_id || !formData.subject_id || !formData.exam_date}
                  >
                    {createExamMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Create Exam</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Total Exams</p>
                    <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
                  </div>
                  <BookOpen className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Upcoming</p>
                    <p className="text-2xl font-bold text-green-700">{stats.upcoming}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Completed</p>
                    <p className="text-2xl font-bold text-purple-700">{stats.completed}</p>
                  </div>
                  <ClipboardCheck className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600 font-medium">Active</p>
                    <p className="text-2xl font-bold text-orange-700">{stats.active}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search exams..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={filters.class_id} onValueChange={(value) => setFilters({ ...filters, class_id: value })}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {teacherClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.class_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.subject_id} onValueChange={(value) => setFilters({ ...filters, subject_id: value })}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>{subject.subject_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.exam_type} onValueChange={(value) => setFilters({ ...filters, exam_type: value })}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="assignment">Assignment</SelectItem>
                    <SelectItem value="midterm">Mid-Term</SelectItem>
                    <SelectItem value="final">Final Exam</SelectItem>
                    <SelectItem value="practical">Practical</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.term} onValueChange={(value) => setFilters({ ...filters, term: value })}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Terms</SelectItem>
                    <SelectItem value="Term 1">Term 1</SelectItem>
                    <SelectItem value="Term 2">Term 2</SelectItem>
                    <SelectItem value="Term 3">Term 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Filter to show only past exams (ready for grading)
                    setFilters({ ...filters, term: 'all' });
                    toast({
                      title: "Showing All Exams",
                      description: "Use the Grade button in each exam row to grade students",
                    });
                  }}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  View All Exams
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exams List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              My Exams
            </CardTitle>
            <CardDescription>
              Manage all exams you've created for your classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">No exams found</p>
                <p className="text-sm text-gray-400 mt-2">
                  {searchTerm || filters.class_id !== 'all' || filters.exam_type !== 'all' || filters.term !== 'all'
                    ? 'Try adjusting your filters or search term'
                    : 'Create your first exam to get started'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExams.map((exam: Exam) => {
                    const isUpcoming = new Date(exam.exam_date) > new Date();
                    const examDate = format(new Date(exam.exam_date), 'MMM dd, yyyy');

                    return (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium">{exam.name}</TableCell>
                        <TableCell>{exam.class_name || 'N/A'}</TableCell>
                        <TableCell>{exam.subject_name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {exam.exam_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{examDate}</TableCell>
                        <TableCell>
                          {exam.total_marks} ({exam.passing_marks} to pass)
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{exam.term}</Badge>
                        </TableCell>
                        <TableCell>
                          {isUpcoming ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              Upcoming
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                              Completed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openViewDialog(exam)}
                              title="View exam details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openGradeDialog(exam)}
                              disabled={isUpcoming}
                              title={isUpcoming ? "Cannot grade future exams" : "Grade students"}
                              className={isUpcoming ? "opacity-50 cursor-not-allowed" : "text-blue-600 hover:text-blue-700"}
                            >
                              <Award className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(exam)}
                              disabled={!isUpcoming}
                              title={!isUpcoming ? "Cannot edit past exams" : "Edit exam"}
                              className={!isUpcoming ? "opacity-50 cursor-not-allowed" : ""}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteExam(exam.id)}
                              disabled={!isUpcoming}
                              title={!isUpcoming ? "Cannot delete past exams" : "Delete exam"}
                              className={!isUpcoming ? "opacity-50 cursor-not-allowed" : ""}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog - Similar to Create Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Exam</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Same fields as create dialog */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Exam Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Exam Type *</Label>
                  <Select value={formData.exam_type} onValueChange={(value) => setFormData({ ...formData, exam_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="midterm">Mid-Term</SelectItem>
                      <SelectItem value="final">Final Exam</SelectItem>
                      <SelectItem value="practical">Practical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Exam Date *</Label>
                  <Input
                    type="date"
                    value={formData.exam_date}
                    onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (minutes) *</Label>
                  <Input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Total Marks *</Label>
                  <Input
                    type="number"
                    value={formData.total_marks}
                    onChange={(e) => setFormData({ ...formData, total_marks: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Passing Marks *</Label>
                  <Input
                    type="number"
                    value={formData.passing_marks}
                    onChange={(e) => setFormData({ ...formData, passing_marks: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Term *</Label>
                  <Select value={formData.term} onValueChange={(value) => setFormData({ ...formData, term: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Term 1">Term 1</SelectItem>
                      <SelectItem value="Term 2">Term 2</SelectItem>
                      <SelectItem value="Term 3">Term 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Syllabus Topics (comma-separated)</Label>
                <Textarea
                  value={formData.syllabus_topics}
                  onChange={(e) => setFormData({ ...formData, syllabus_topics: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditExam} disabled={updateExamMutation.isPending}>
                {updateExamMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Update Exam</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Exam Details</DialogTitle>
            </DialogHeader>
            {selectedExam && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Exam Name</Label>
                    <p className="font-semibold">{selectedExam.name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Type</Label>
                    <p className="font-semibold capitalize">{selectedExam.exam_type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Class</Label>
                    <p className="font-semibold">{selectedExam.class_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Subject</Label>
                    <p className="font-semibold">{selectedExam.subject_name || 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Exam Date</Label>
                    <p className="font-semibold">{format(new Date(selectedExam.exam_date), 'MMMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Duration</Label>
                    <p className="font-semibold">{selectedExam.duration_minutes} minutes</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-500">Total Marks</Label>
                    <p className="font-semibold">{selectedExam.total_marks}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Passing Marks</Label>
                    <p className="font-semibold">{selectedExam.passing_marks}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Term</Label>
                    <p className="font-semibold">{selectedExam.term}</p>
                  </div>
                </div>

                {selectedExam.instructions && (
                  <div>
                    <Label className="text-gray-500">Instructions</Label>
                    <p className="text-sm mt-1">{selectedExam.instructions}</p>
                  </div>
                )}

                {selectedExam.syllabus_topics && selectedExam.syllabus_topics.length > 0 && (
                  <div>
                    <Label className="text-gray-500">Syllabus Topics</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedExam.syllabus_topics.map((topic, index) => (
                        <Badge key={index} variant="secondary">{topic}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Grade Dialog */}
        <Dialog open={isGradeDialogOpen} onOpenChange={setIsGradeDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-blue-600" />
                Grade Exam: {selectedExam?.name}
              </DialogTitle>
              {selectedExam && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                  <span>{selectedExam.class_name}</span>
                  <span>•</span>
                  <span>{selectedExam.subject_name}</span>
                  <span>•</span>
                  <span>{format(new Date(selectedExam.exam_date), 'MMM dd, yyyy')}</span>
                  <span>•</span>
                  <span>Total Marks: {selectedExam.total_marks}</span>
                </div>
              )}
            </DialogHeader>
            {selectedExam && (
              <div className="py-4">
                <GradeResults examId={selectedExam.id} />
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsGradeDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
