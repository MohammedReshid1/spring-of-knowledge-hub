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
import { toast } from '@/hooks/use-toast';
import { 
  Plus, Edit, Trash2, Eye, BarChart3, Calendar, Clock, 
  BookOpen, Users, Award, AlertCircle 
} from 'lucide-react';
import { format } from 'date-fns';
import { GradeResults } from './GradeResults';
import { ViewReports } from './ViewReports';

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

interface ExamStats {
  exam_id: string;
  total_students: number;
  students_appeared: number;
  students_passed: number;
  students_failed: number;
  highest_marks: number;
  lowest_marks: number;
  average_marks: number;
  pass_percentage: number;
}

export const ExamManagement = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'stats' | 'grade' | 'reports'>('list');
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [gradingExamId, setGradingExamId] = useState<string>('');
  const [filters, setFilters] = useState({
    class_id: '',
    subject_id: '',
    exam_type: '',
    academic_year: '',
    term: ''
  });

  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();
  const { getBranchFilter } = useBranchData();

  // Fetch exams
  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['exams', filters, selectedBranch],
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

  // Fetch subjects for dropdown (subjects are global but can be filtered by grade levels in the branch)
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getSubjects();
      if (error) throw new Error(error);
      // Subjects are global - no branch filtering needed for now
      return data || [];
    }
  });

  // Fetch classes for dropdown
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getClasses();
      if (error) throw new Error(error);
      // Filter classes by branch if a specific branch is selected
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
      // Filter teachers by branch if a specific branch is selected
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
      // Invalidate all exam-related queries to ensure fresh data
      queryClient.invalidateQueries({ 
        queryKey: ['exams'],
        refetchType: 'all'
      });
      
      // Also update the cache directly with the new data
      queryClient.setQueryData(['exams', filters, selectedBranch], (oldData: Exam[] | undefined) => {
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

  const handleCreateExam = (formData: FormData) => {
    const examDateValue = formData.get('exam_date') as string;
    const durationValue = formData.get('duration_minutes') as string;
    
    // Ensure we have a valid date and time
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

    console.log('Exam data being sent:', examData); // Debug log
    createExamMutation.mutate(examData);
  };

  const handleUpdateExam = (formData: FormData) => {
    if (!selectedExam) return;
    
    const examDateValue = formData.get('exam_date') as string;
    const durationValue = formData.get('duration_minutes') as string;
    
    // Ensure we have a valid date and time
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

    console.log('Updated exam data being sent:', examData); // Debug log
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
        if (examId) {
          setGradingExamId(examId);
          setViewMode('grade');
        } else {
          // Show exam selection for grading
          if (exams.length === 0) {
            toast({
              title: "No Exams Found",
              description: "Create an exam first to grade results",
              variant: "destructive",
            });
          } else {
            setViewMode('grade');
          }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Exam Management</h2>
          <p className="text-muted-foreground">Create and manage exams, view statistics</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Exams
          </Button>
          <Button
            variant={viewMode === 'stats' ? 'default' : 'outline'}
            onClick={() => setViewMode('stats')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Statistics
          </Button>
          <Button
            variant={viewMode === 'grade' ? 'default' : 'outline'}
            onClick={() => handleQuickAction('grade')}
          >
            <Award className="h-4 w-4 mr-2" />
            Grade Results
          </Button>
          <Button
            variant={viewMode === 'reports' ? 'default' : 'outline'}
            onClick={() => handleQuickAction('reports')}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Exam
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Exam</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleCreateExam(new FormData(e.target as HTMLFormElement));
              }} className="space-y-4">
                {/* Basic Information */}
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-gray-900">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Exam Name *</Label>
                      <Input 
                        id="name" 
                        name="name" 
                        placeholder="e.g., Mathematics Midterm"
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exam_type">Exam Type *</Label>
                      <Select name="exam_type" required>
                        <SelectTrigger>
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

                {/* Class Details */}
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-gray-900">Class Details</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject_id">Subject *</Label>
                      <Select name="subject_id" required>
                        <SelectTrigger>
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
                      <Label htmlFor="class_id">Class *</Label>
                      <Select name="class_id" required>
                        <SelectTrigger>
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
                      <Label htmlFor="teacher_id">Teacher *</Label>
                      <Select name="teacher_id" required>
                        <SelectTrigger>
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

                {/* Exam Schedule */}
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-gray-900">Schedule & Duration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="exam_date">Date & Time *</Label>
                      <Input 
                        id="exam_date" 
                        name="exam_date" 
                        type="datetime-local" 
                        required 
                      />
                      <p className="text-xs text-gray-500">Select the exam date and start time</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration_minutes">Duration *</Label>
                      <Select name="duration_minutes" required>
                        <SelectTrigger>
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

                {/* Marks & Grading */}
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-gray-900">Marks & Grading</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="total_marks">Total Marks *</Label>
                      <Input 
                        id="total_marks" 
                        name="total_marks" 
                        type="number" 
                        min="1" 
                        placeholder="100"
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passing_marks">Passing Marks *</Label>
                      <Input 
                        id="passing_marks" 
                        name="passing_marks" 
                        type="number" 
                        min="1" 
                        placeholder="40"
                        required 
                      />
                    </div>
                  </div>
                </div>

                {/* Academic Period */}
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-gray-900">Academic Period</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="academic_year">Academic Year *</Label>
                      <Input 
                        id="academic_year" 
                        name="academic_year" 
                        placeholder="2024-2025" 
                        defaultValue={currentAcademicYear?.name || ''}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="term">Term *</Label>
                      <Select name="term" required>
                        <SelectTrigger>
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

                {/* Instructions */}
                <div className="space-y-3">
                  <h3 className="text-base font-medium text-gray-900">Instructions (Optional)</h3>
                  <div className="space-y-2">
                    <Textarea 
                      id="instructions" 
                      name="instructions" 
                      rows={2} 
                      placeholder="Any special instructions for the exam..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createExamMutation.isPending}>
                    {createExamMutation.isPending ? 'Creating...' : 'Create Exam'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <Label htmlFor="filter-class">Class</Label>
              <Select value={filters.class_id} onValueChange={(value) => setFilters(prev => ({ ...prev, class_id: value }))}>
                <SelectTrigger>
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
                <SelectTrigger>
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
                <SelectTrigger>
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
              />
            </div>
            <div>
              <Label htmlFor="filter-term">Term</Label>
              <Select value={filters.term} onValueChange={(value) => setFilters(prev => ({ ...prev, term: value }))}>
                <SelectTrigger>
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

      {/* Content */}
      {viewMode === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>Exams</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading exams...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.name}</TableCell>
                      <TableCell>{getSubjectName(exam.subject_id)}</TableCell>
                      <TableCell>{getClassName(exam.class_id)}</TableCell>
                      <TableCell>
                        <Badge className={getExamTypeColor(exam.exam_type)}>
                          {exam.exam_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                          {format(new Date(exam.exam_date), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                          {exam.duration_minutes}m
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Award className="h-4 w-4 mr-1 text-muted-foreground" />
                          {exam.total_marks}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewExam(exam)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleQuickAction('grade', exam.id)}
                            title="Grade Results"
                          >
                            <Award className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditExam(exam)}
                            title="Edit Exam"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => deleteExamMutation.mutate(exam.id)}
                            title="Delete Exam"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {viewMode === 'stats' && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
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

          <Card>
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

          <Card>
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
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('grade')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Grade Results
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('reports')}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Reports
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('schedule')}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grade Results View */}
      {viewMode === 'grade' && (
        <>
          {gradingExamId ? (
            <GradeResults 
              examId={gradingExamId} 
              onClose={() => {
                setViewMode('list');
                setGradingExamId('');
              }} 
            />
          ) : (
            <Card>
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
                      <Card key={exam.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
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
        </>
      )}

      {/* Reports View */}
      {viewMode === 'reports' && (
        <ViewReports onClose={() => setViewMode('list')} />
      )}

      {/* View Exam Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>View Exam Details</DialogTitle>
          </DialogHeader>
          {selectedExam && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Exam Name</Label>
                  <p className="text-sm">{selectedExam.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                  <Badge className={getExamTypeColor(selectedExam.exam_type)}>
                    {selectedExam.exam_type}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Subject</Label>
                  <p className="text-sm">{getSubjectName(selectedExam.subject_id)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Class</Label>
                  <p className="text-sm">{getClassName(selectedExam.class_id)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Teacher</Label>
                  <p className="text-sm">{getTeacherName(selectedExam.teacher_id)}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Total Marks</Label>
                  <p className="text-sm">{selectedExam.total_marks}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Passing Marks</Label>
                  <p className="text-sm">{selectedExam.passing_marks}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
                  <p className="text-sm">{selectedExam.duration_minutes} minutes</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Date</Label>
                  <p className="text-sm">{format(new Date(selectedExam.exam_date), 'MMM dd, yyyy HH:mm')}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Academic Year</Label>
                  <p className="text-sm">{selectedExam.academic_year}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Term</Label>
                  <p className="text-sm">{selectedExam.term}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge variant={selectedExam.is_active ? "default" : "secondary"}>
                    {selectedExam.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              {selectedExam.instructions && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Instructions</Label>
                  <p className="text-sm text-muted-foreground">{selectedExam.instructions}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Exam Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Exam</DialogTitle>
          </DialogHeader>
          {selectedExam && (
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateExam(new FormData(e.target as HTMLFormElement));
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Exam Name</Label>
                  <Input id="edit-name" name="name" defaultValue={selectedExam.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-exam_type">Exam Type</Label>
                  <Select name="exam_type" defaultValue={selectedExam.exam_type} required>
                    <SelectTrigger>
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

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-subject_id">Subject</Label>
                  <Select name="subject_id" defaultValue={selectedExam.subject_id} required>
                    <SelectTrigger>
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
                  <Label htmlFor="edit-class_id">Class</Label>
                  <Select name="class_id" defaultValue={selectedExam.class_id} required>
                    <SelectTrigger>
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
                  <Label htmlFor="edit-teacher_id">Teacher</Label>
                  <Select name="teacher_id" defaultValue={selectedExam.teacher_id} required>
                    <SelectTrigger>
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

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-total_marks">Total Marks</Label>
                  <Input 
                    id="edit-total_marks" 
                    name="total_marks" 
                    type="number" 
                    min="1" 
                    defaultValue={selectedExam.total_marks} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-passing_marks">Passing Marks</Label>
                  <Input 
                    id="edit-passing_marks" 
                    name="passing_marks" 
                    type="number" 
                    min="1" 
                    defaultValue={selectedExam.passing_marks} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-exam_date">Exam Date</Label>
                  <Input 
                    id="edit-exam_date" 
                    name="exam_date" 
                    type="datetime-local" 
                    defaultValue={new Date(selectedExam.exam_date).toISOString().slice(0, 16)} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-duration_minutes">Duration (minutes)</Label>
                  <Select name="duration_minutes" defaultValue={selectedExam.duration_minutes?.toString()} required>
                    <SelectTrigger>
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

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-academic_year">Academic Year</Label>
                  <Input 
                    id="edit-academic_year" 
                    name="academic_year" 
                    placeholder="2023-2024" 
                    defaultValue={selectedExam.academic_year} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-term">Term</Label>
                  <Select name="term" defaultValue={selectedExam.term} required>
                    <SelectTrigger>
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

              <div className="space-y-2">
                <Label htmlFor="edit-instructions">Instructions</Label>
                <Textarea 
                  id="edit-instructions" 
                  name="instructions" 
                  rows={3} 
                  defaultValue={selectedExam.instructions || ''} 
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateExamMutation.isPending}>
                  {updateExamMutation.isPending ? 'Updating...' : 'Update Exam'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};