import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { apiClient } from '@/lib/api';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  Plus,
  Search,
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  BookOpen,
  Filter
} from 'lucide-react';
import { AssignmentCard } from '@/components/assignments/AssignmentCard';
import { toast } from 'sonner';
import { addDays } from 'date-fns';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  subject?: string;
  academic_year?: string;
  current_enrollment?: number;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  class_id: string;
  class_name: string;
  subject?: string;
  due_date: Date;
  total_points: number;
  status: 'draft' | 'published' | 'closed';
  created_at: Date;
  total_students?: number;
  submitted_count?: number;
  graded_count?: number;
}

export const TeacherAssignmentsPage = () => {
  const { user } = useAuth();
  const { isTeacher } = useRoleAccess();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    class_id: '',
    due_date: addDays(new Date(), 7).toISOString().split('T')[0],
    total_points: 100,
    status: 'draft' as 'draft' | 'published'
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

  // Mock assignments data (will be replaced with API call when backend is ready)
  const mockAssignments: Assignment[] = useMemo(() => {
    return teacherClasses.slice(0, 3).flatMap((cls, idx) => [
      {
        id: `assignment-${idx}-1`,
        title: `Chapter ${idx + 1} Review Questions`,
        description: `Complete all review questions from chapter ${idx + 1}. Show all work and explain your reasoning.`,
        class_id: cls.id,
        class_name: cls.name,
        subject: cls.subject,
        due_date: addDays(new Date(), 7 + idx),
        total_points: 100,
        status: 'published' as const,
        created_at: new Date(),
        total_students: cls.current_enrollment || 25,
        submitted_count: Math.floor((cls.current_enrollment || 25) * 0.7),
        graded_count: Math.floor((cls.current_enrollment || 25) * 0.4),
      },
      {
        id: `assignment-${idx}-2`,
        title: `Essay: Understanding Key Concepts`,
        description: `Write a 2-page essay discussing the main concepts covered in class. Include examples and cite sources.`,
        class_id: cls.id,
        class_name: cls.name,
        subject: cls.subject,
        due_date: addDays(new Date(), 14 + idx),
        total_points: 150,
        status: 'published' as const,
        created_at: new Date(),
        total_students: cls.current_enrollment || 25,
        submitted_count: Math.floor((cls.current_enrollment || 25) * 0.3),
        graded_count: 0,
      },
    ]);
  }, [teacherClasses]);

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    return mockAssignments.filter(assignment => {
      // Filter by search query
      if (searchQuery && !assignment.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Filter by class
      if (selectedClass !== 'all' && assignment.class_id !== selectedClass) {
        return false;
      }

      // Filter by tab (status)
      if (activeTab !== 'all' && assignment.status !== activeTab) {
        return false;
      }

      return true;
    });
  }, [mockAssignments, searchQuery, selectedClass, activeTab]);

  // Statistics
  const stats = useMemo(() => {
    const published = mockAssignments.filter(a => a.status === 'published').length;
    const drafts = mockAssignments.filter(a => a.status === 'draft').length;
    const totalSubmissions = mockAssignments.reduce((sum, a) => sum + (a.submitted_count || 0), 0);
    const pendingGrading = mockAssignments.reduce((sum, a) => sum + ((a.submitted_count || 0) - (a.graded_count || 0)), 0);

    return { published, drafts, totalSubmissions, pendingGrading };
  }, [mockAssignments]);

  const handleCreateAssignment = () => {
    if (!formData.title || !formData.class_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    toast.success('Assignment created successfully!');
    setShowCreateDialog(false);
    resetForm();
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      title: assignment.title,
      description: assignment.description,
      class_id: assignment.class_id,
      due_date: new Date(assignment.due_date).toISOString().split('T')[0],
      total_points: assignment.total_points,
      status: assignment.status === 'closed' ? 'published' : assignment.status,
    });
    setShowCreateDialog(true);
  };

  const handleDeleteAssignment = (assignment: Assignment) => {
    if (confirm(`Are you sure you want to delete "${assignment.title}"?`)) {
      toast.success('Assignment deleted successfully');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      class_id: '',
      due_date: addDays(new Date(), 7).toISOString().split('T')[0],
      total_points: 100,
      status: 'draft',
    });
    setEditingAssignment(null);
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
    <BranchLoadingWrapper loadingMessage="Loading assignments...">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 pb-20 pt-16">
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

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <FileText className="mr-2 h-4 w-4" />
                Assignment Management System
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Assignments & <span className="bg-gradient-to-r from-pink-200 to-purple-200 bg-clip-text text-transparent">Homework</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-purple-100">
                Create, manage, and grade assignments for your classes. Track submissions and provide timely feedback to students.
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
        <div className="relative z-10 -mt-10 space-y-6 px-6 pb-16 max-w-7xl mx-auto">
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeInUp">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Published</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900">{stats.published}</div>
                <p className="text-xs text-blue-600 mt-1">Active assignments</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Drafts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats.drafts}</div>
                <p className="text-xs text-gray-600 mt-1">Not yet published</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Submissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-900">{stats.totalSubmissions}</div>
                <p className="text-xs text-green-600 mt-1">Total received</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-600">Pending Grading</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-900">{stats.pendingGrading}</div>
                <p className="text-xs text-orange-600 mt-1">Needs grading</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <Card className="border-2 border-purple-100">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search assignments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Class Filter */}
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="All classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {teacherClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Create Button */}
                <Button
                  onClick={() => {
                    resetForm();
                    setShowCreateDialog(true);
                  }}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Assignment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-purple-50 to-pink-50 p-1">
              <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                All ({mockAssignments.length})
              </TabsTrigger>
              <TabsTrigger value="published" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                Published ({stats.published})
              </TabsTrigger>
              <TabsTrigger value="draft" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                Drafts ({stats.drafts})
              </TabsTrigger>
              <TabsTrigger value="closed" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                Closed
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {filteredAssignments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAssignments.map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onView={(a) => toast.info(`Viewing submissions for: ${a.title}`)}
                      onEdit={handleEditAssignment}
                      onDelete={handleDeleteAssignment}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed border-2 border-gray-300">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <FileText className="h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No assignments found</h3>
                    <p className="text-gray-500 text-center max-w-md mb-6">
                      {searchQuery || selectedClass !== 'all'
                        ? 'Try adjusting your filters or search query'
                        : 'Get started by creating your first assignment'}
                    </p>
                    {!searchQuery && selectedClass === 'all' && (
                      <Button
                        onClick={() => {
                          resetForm();
                          setShowCreateDialog(true);
                        }}
                        className="bg-gradient-to-r from-purple-600 to-pink-600"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Assignment
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Create/Edit Assignment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) resetForm();
        setShowCreateDialog(open);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}
            </DialogTitle>
            <DialogDescription>
              {editingAssignment
                ? 'Update the assignment details below'
                : 'Fill in the details to create a new assignment for your students'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Chapter 5 Review Questions"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Provide instructions and details for the assignment..."
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="class">Class *</Label>
                <Select
                  value={formData.class_id}
                  onValueChange={(value) => setFormData({ ...formData, class_id: value })}
                >
                  <SelectTrigger id="class">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="points">Total Points</Label>
                <Input
                  id="points"
                  type="number"
                  min="1"
                  value={formData.total_points}
                  onChange={(e) => setFormData({ ...formData, total_points: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'draft' | 'published') => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Save as Draft</SelectItem>
                    <SelectItem value="published">Publish Now</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreateDialog(false); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateAssignment} className="bg-gradient-to-r from-purple-600 to-pink-600">
              {editingAssignment ? 'Update' : 'Create'} Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BranchLoadingWrapper>
  );
};

export default TeacherAssignmentsPage;
