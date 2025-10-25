import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Search, Eye, Edit, Trash2, Users, GraduationCap, BookOpen, Filter, Mail, Phone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { TeacherForm } from './TeacherForm';
import { TeacherDetails } from './TeacherDetails';
import { useBranch } from '@/contexts/BranchContext';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { usePermissionCheck } from '@/contexts/RoleAccessContext';
import { useDialogSidebarCollapse } from '@/hooks/useDialogSidebarCollapse';
import { useLiveData } from '@/hooks/useLiveData';
import { LiveUpdatesIndicator } from '@/components/common/LiveUpdatesIndicator';

export const TeacherManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [detailsTeacher, setDetailsTeacher] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const openDetails = (t: any) => { setDetailsTeacher(t); setIsDetailsOpen(true); };
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();
  const { canDelete } = useRoleAccess();

  // Enable real-time updates for teacher management
  useLiveData(['teachers', 'classes', 'subjects', 'students'], {
    additionalQueryKeys: ['teacher-stats', 'teacher-assignments']
  });

  // Auto-collapse sidebar when teacher details dialog opens
  useDialogSidebarCollapse(!!selectedTeacher);
  useDialogSidebarCollapse(isFormOpen);

  // Permission checks
  const { hasPermission } = usePermissionCheck();
  const canCreate = hasPermission('teacher.create');
  const canUpdate = hasPermission('teacher.update');
  const canManage = hasPermission('teacher.manage');

  // Fetch all teachers
  const { data: teachersRaw = [], isLoading, error } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const response = await apiClient.getTeachers();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    }
  });
  // Filter by selected branch
  const teachers = teachersRaw.filter(t => selectedBranch === 'all' || t.branch_id === selectedBranch);
  
  // Fetch all classes to build assignments
  const { data: classesRaw = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await apiClient.getClasses();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    }
  });

  // Fetch all subjects for subject assignment display
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const response = await apiClient.getSubjects();
      if (response.error) throw new Error(response.error);
      const subjectsData = response.data || [];
      return subjectsData;
    }
  });
  // Group classes by teacher_id for current branch (including subject teachers)
  const classesByTeacherId = useMemo(() => {
    const map = new Map<string, any[]>();
    (classesRaw as any[])
      .filter(c => selectedBranch === 'all' || c.branch_id === selectedBranch)
      .forEach(c => {
        // Add class for main teacher
        if (c.teacher_id) {
          const list = map.get(c.teacher_id) || [];
          if (!list.some(cls => cls.id === c.id)) {
            list.push(c);
          }
          map.set(c.teacher_id, list);
        }

        // Also add class for subject teachers
        if (c.subject_teachers && Array.isArray(c.subject_teachers)) {
          c.subject_teachers.forEach(st => {
            if (st.teacher_id) {
              const list = map.get(st.teacher_id) || [];
              if (!list.some(cls => cls.id === c.id)) {
                list.push(c);
              }
              map.set(st.teacher_id, list);
            }
          });
        }
      });
    return map;
  }, [classesRaw, selectedBranch]);
  // Enrich teacher objects with their assigned classes
  const teachersEnriched = useMemo(
    () => teachers.map(t => ({ ...t, classes: classesByTeacherId.get(t.id) || [] })),
    [teachers, classesByTeacherId]
  );

  const { data: stats } = useQuery({
    queryKey: ['teacher-stats'],
    queryFn: async () => {
      const teachersResponse = await apiClient.getTeachers();
      const classesResponse = await apiClient.getClasses();
      if (teachersResponse.error) throw new Error(teachersResponse.error);
      if (classesResponse.error) throw new Error(classesResponse.error);
      const teachersData = teachersResponse.data || [];
      const classesData = classesResponse.data || [];
      // Filter both lists by selectedBranch
      const branch = selectedBranch;
      const branchTeachers = teachersData.filter(t => branch === 'all' || t.branch_id === branch);
      const branchClasses = classesData.filter(c => branch === 'all' || c.branch_id === branch);
      const totalTeachers = branchTeachers.length;
      const assignedTeachers = new Set([
        // Teachers assigned directly to classes
        ...branchClasses
          .filter(c => c.teacher_id)
          .map(c => c.teacher_id),
        // Teachers assigned to subjects within classes
        ...branchClasses
          .flatMap(c => (c.subject_teachers || []).map(st => st.teacher_id))
      ]).size;
      const unassignedTeachers = totalTeachers - assignedTeachers;
      
      return {
        totalTeachers,
        assignedTeachers,
        unassignedTeachers
      };
    }
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (teacherId: string) => {
      const response = await apiClient.deleteTeacher(teacherId);
      if (response.error) throw new Error(response.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-stats'] });
      toast({
        title: "Success",
        description: "Teacher deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete teacher: " + error.message,
        variant: "destructive",
      });
    }
  });

  const filteredTeachers = teachersEnriched.filter(teacher => {
    const fullName = `${teacher.first_name} ${teacher.last_name}`;
    const matchesSearch = 
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.teacher_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Now teacher.classes includes all classes where they teach (main or subject)
    const isAssigned = teacher.classes && teacher.classes.length > 0;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'assigned' && isAssigned) ||
      (statusFilter === 'unassigned' && !isAssigned);
    
    return matchesSearch && matchesStatus;
  }) || [];

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = (teacher: any) => {
    return `${teacher.first_name.charAt(0)}${teacher.last_name.charAt(0)}`.toUpperCase();
  };

  const getFullName = (teacher: any) => {
    return `${teacher.first_name} ${teacher.last_name}`;
  };

  const handleDelete = (teacherId: string) => {
    if (confirm('Are you sure you want to delete this teacher? This action cannot be undone.')) {
      deleteTeacherMutation.mutate(teacherId);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/80 via-blue-50/60 to-indigo-50/80 flex items-center justify-center p-8">
        <Card className="w-full max-w-md backdrop-blur-glass bg-gradient-to-br from-white/90 to-white/70 border border-white/30 shadow-premium">
          <CardContent className="pt-8 pb-6">
            <div className="text-center">
              <div className="relative mx-auto w-16 h-16 mb-6">
                <div className="absolute inset-0 bg-red-200 rounded-full blur-lg" />
                <div className="relative w-16 h-16 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-full" />
                </div>
              </div>
              <p className="font-bold text-lg text-slate-800 mb-2">Error loading teachers</p>
              <p className="text-sm text-slate-600 mb-6">{error.message}</p>
              <Button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['teachers'] })}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-premium hover:shadow-glow-blue transition-all duration-300 transform hover:scale-105"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }

        .animate-pulseGlow {
          animation: pulseGlow 2s infinite;
        }
      `}</style>

    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Enhanced Floating Shapes with Animation */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
        <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />
        <div className="absolute top-1/2 left-20 w-8 h-8 bg-white/8 rounded-full animate-pulse delay-300" />
        <div className="absolute top-1/3 right-1/4 w-14 h-14 bg-white/8 rounded-full animate-pulse delay-700" />
        <div className="absolute bottom-1/3 right-10 w-10 h-10 bg-white/8 rounded-full animate-pulse delay-900" />
        <div className="absolute top-1/4 left-1/2 w-6 h-6 bg-white/6 rounded-full animate-pulse delay-400" />
        <div className="absolute bottom-10 left-1/4 w-18 h-18 bg-white/8 rounded-full animate-pulse delay-800" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
              <Users className="mr-2 h-4 w-4" />
              Teacher Management System
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Teacher <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Management</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              Comprehensive teacher administration with advanced assignment tracking, class management, and performance analytics.
              Streamline your educational staff management with premium tools.
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
        {/* Action Bar */}
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
              <p className="text-sm text-gray-600">Manage teachers efficiently with powerful tools</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LiveUpdatesIndicator />
              {(canCreate || canManage) && (
                <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
                  <SheetTrigger asChild>
                    <Button className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0">
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                      Add Teacher
                    </Button>
                  </SheetTrigger>
                <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="text-xl">
                      {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <TeacherForm
                      teacher={editingTeacher}
                      onSuccess={() => {
                        setIsFormOpen(false);
                        setEditingTeacher(null);
                        queryClient.invalidateQueries({ queryKey: ['teachers'] });
                        queryClient.invalidateQueries({ queryKey: ['teacher-stats'] });
                      }}
                    />
                  </div>
                </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        </div>

        {/* Premium Stats Cards */}
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-blue-50/50 border border-white/20 shadow-premium hover:shadow-glow-blue transition-all duration-500 hover:scale-105 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="relative p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-600/80 uppercase tracking-wider">Total Teachers</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent mt-1">{stats?.totalTeachers || 0}</p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                <Users className="relative h-10 w-10 text-blue-500 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-indigo-50/50 border border-white/20 shadow-premium hover:shadow-glow-blue transition-all duration-500 hover:scale-105 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="relative p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-600/80 uppercase tracking-wider">Assigned</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-cyan-600 bg-clip-text text-transparent mt-1">{stats?.assignedTeachers || 0}</p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                <GraduationCap className="relative h-10 w-10 text-indigo-500 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-cyan-50/50 border border-white/20 shadow-premium hover:shadow-glow-orange transition-all duration-500 hover:scale-105 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="relative p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold text-cyan-600/80 uppercase tracking-wider">Unassigned</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-cyan-700 to-orange-600 bg-clip-text text-transparent mt-1">{stats?.unassignedTeachers || 0}</p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                <BookOpen className="relative h-10 w-10 text-orange-500 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>

        {/* Premium Filters and Search */}
        <div className="mx-auto max-w-7xl">
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/90 via-white/70 to-white/50 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.02] via-indigo-500/[0.03] to-cyan-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardHeader className="relative pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-3 bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-lg group-hover:blur-xl transition-all duration-300" />
              <Filter className="relative h-6 w-6 text-blue-600" />
            </div>
            Search & Filter Teachers
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1">
              <div className="relative group/search">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-lg opacity-0 group-hover/search:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-500/60 group-hover/search:text-blue-600 transition-colors duration-300" />
                <Input
                  placeholder="Search by name, email, or teacher ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="relative pl-12 h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="w-full sm:w-56">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-indigo-300/50 focus:border-indigo-500/60 focus:ring-indigo-500/20 focus:ring-4 transition-all duration-300">
                  <SelectValue placeholder="Filter by assignment" />
                </SelectTrigger>
                <SelectContent className="backdrop-blur-xl bg-white/95 border-white/40">
                  <SelectItem value="all" className="hover:bg-blue-50/80">All Teachers</SelectItem>
                  <SelectItem value="assigned" className="hover:bg-indigo-50/80">Assigned to Classes</SelectItem>
                  <SelectItem value="unassigned" className="hover:bg-cyan-50/80">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
          </Card>
        </div>

        {/* Premium Teachers Table */}
        <div className="mx-auto max-w-7xl">
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-white/60 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-indigo-500/[0.02] to-cyan-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardHeader className="relative">
          <CardTitle className="text-2xl font-bold flex items-center gap-3">
            <span className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
              Teachers
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200/50">
              {filteredTeachers.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 opacity-20 animate-pulse" />
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-blue-500 border-r-indigo-500"></div>
              </div>
              <p className="text-slate-600 mt-6 font-medium animate-pulse">Loading teachers...</p>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="text-center py-16">
              <div className="relative mx-auto w-16 h-16 mb-6">
                <div className="absolute inset-0 bg-slate-200 rounded-full blur-lg" />
                <Users className="relative h-16 w-16 text-slate-400 mx-auto" />
              </div>
              <p className="text-slate-600 font-semibold text-lg">No teachers found</p>
              <p className="text-slate-400 text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/20">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50/80 via-white/60 to-slate-50/80 border-b border-white/30 hover:from-blue-50/50 hover:via-indigo-50/30 hover:to-cyan-50/50 transition-all duration-300">
                    <TableHead className="font-bold text-slate-700 tracking-wide">Teacher</TableHead>
                    <TableHead className="font-bold text-slate-700 tracking-wide">Contact</TableHead>
                    <TableHead className="font-bold text-slate-700 tracking-wide">Classes Assigned</TableHead>
                    <TableHead className="font-bold text-slate-700 tracking-wide">Total Students</TableHead>
                    <TableHead className="font-bold text-slate-700 tracking-wide">Status</TableHead>
                    <TableHead className="font-bold text-slate-700 tracking-wide">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.map((teacher, index) => {
                    const totalStudents = teacher.classes?.reduce((sum, cls) => sum + (cls.current_enrollment || 0), 0) || 0;
                    // Now teacher.classes includes all classes where they teach (main or subject)
                    const isAssigned = teacher.classes && teacher.classes.length > 0;

                    return (
                      <TableRow
                        key={teacher.id}
                        className="group border-b border-white/20 hover:bg-gradient-to-r hover:from-blue-50/30 hover:via-indigo-50/20 hover:to-cyan-50/30 transition-all duration-300 animate-fade-in-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell>
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              <Avatar className="relative h-12 w-12 ring-2 ring-white/50 group-hover:ring-blue-300/50 transition-all duration-300">
                                <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 font-bold text-sm group-hover:scale-110 transition-transform duration-300">
                                  {getInitials(teacher)}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors duration-300">{getFullName(teacher)}</div>
                              <div className="text-sm text-slate-500 font-medium">{teacher.specialization || 'General Teacher'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 text-sm group/email">
                              <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-sm opacity-0 group-hover/email:opacity-100 transition-opacity duration-300" />
                                <Mail className="relative h-4 w-4 text-indigo-500" />
                              </div>
                              <span className="text-slate-700 font-medium">{teacher.email}</span>
                            </div>
                            {teacher.phone && (
                              <div className="flex items-center gap-3 text-sm group/phone">
                                <div className="relative">
                                  <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-sm opacity-0 group-hover/phone:opacity-100 transition-opacity duration-300" />
                                  <Phone className="relative h-4 w-4 text-cyan-500" />
                                </div>
                                <span className="text-slate-700 font-medium">{teacher.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const directClasses = teacher.classes?.filter(cls => cls.teacher_id === teacher.id) || [];
                            const subjectAssignments = teacher.classes?.flatMap(cls =>
                              (cls.subject_teachers || []).filter(st => st.teacher_id === teacher.id)
                                .map(st => ({ ...st, class: cls }))
                            ) || [];

                            // Debug log to see the assignment structure
                            if (subjectAssignments.length > 0) {
                            }

                            if (directClasses.length === 0 && subjectAssignments.length === 0) {
                              return <span className="text-slate-400 text-sm font-medium italic">No assignments</span>;
                            }

                            return (
                              <div className="space-y-2">
                                {/* Direct class assignments */}
                                {directClasses.slice(0, 2).map((cls) => (
                                  <div key={`direct-${cls.id}`} className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200/50 text-blue-700 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300">
                                      {cls.class_name} (Class Teacher)
                                    </Badge>
                                    {cls.grade_levels && (
                                      <span className="text-xs text-slate-500 font-medium">
                                        ({formatGradeLevel(cls.grade_levels.grade)})
                                      </span>
                                    )}
                                  </div>
                                ))}

                                {/* Subject assignments */}
                                {subjectAssignments.slice(0, directClasses.length >= 2 ? 0 : 2 - directClasses.length).map((assignment, idx) => {
                                  // First check if subject info is embedded in the assignment
                                  const subjectName = assignment.subject_name || assignment.subject?.name || assignment.subject?.subject_name;

                                  // If not, look it up in the subjects list
                                  const subject = !subjectName && assignment.subject_id
                                    ? subjects.find(s => s.id === assignment.subject_id)
                                    : null;

                                  const finalSubjectName = subjectName || subject?.name || subject?.subject_name || 'Subject';

                                  return (
                                    <div key={`subject-${assignment.class.id}-${assignment.subject_id}-${idx}`} className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200/50 text-purple-700 hover:from-purple-100 hover:to-pink-100 transition-all duration-300">
                                        {assignment.class.class_name} - {finalSubjectName}
                                      </Badge>
                                      {assignment.class.grade_levels && (
                                        <span className="text-xs text-slate-500 font-medium">
                                          ({formatGradeLevel(assignment.class.grade_levels.grade)})
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}

                                {(directClasses.length + subjectAssignments.length) > 2 && (
                                  <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 text-slate-600">
                                    +{(directClasses.length + subjectAssignments.length) - 2} more
                                  </Badge>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xl bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                              {totalStudents}
                            </span>
                            {totalStudents > 0 && (
                              <div className="h-1.5 w-8 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={isAssigned
                              ? 'bg-gradient-to-r from-blue-100 to-green-100 border-blue-300/50 text-blue-800 font-semibold shadow-sm'
                              : 'bg-gradient-to-r from-orange-100 to-red-100 border-orange-300/50 text-orange-800 font-semibold shadow-sm'
                            }
                          >
                            <div className={`w-2 h-2 rounded-full mr-2 ${isAssigned ? 'bg-blue-500' : 'bg-orange-500'} animate-pulse`} />
                            {isAssigned ? 'Assigned' : 'Unassigned'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedTeacher(teacher)}
                              className="group/btn relative overflow-hidden h-10 w-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200/50 hover:border-blue-300/60 shadow-sm hover:shadow-glow-blue transition-all duration-300 hover:scale-110"
                            >
                              <Eye className="h-4 w-4 text-blue-600 group-hover/btn:scale-110 transition-transform duration-200" />
                            </Button>
                            {(canUpdate || canManage) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingTeacher(teacher);
                                  setIsFormOpen(true);
                                }}
                                className="group/btn relative overflow-hidden h-10 w-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200/50 hover:border-blue-300/60 shadow-sm hover:shadow-glow-green transition-all duration-300 hover:scale-110"
                              >
                                <Edit className="h-4 w-4 text-blue-600 group-hover/btn:scale-110 transition-transform duration-200" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(teacher.id)}
                              disabled={!canDelete}
                              className={`group/btn relative overflow-hidden h-10 w-10 rounded-lg bg-gradient-to-br from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 border border-red-200/50 hover:border-red-300/60 shadow-sm hover:shadow-glow-orange transition-all duration-300 hover:scale-110 ${!canDelete ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600 group-hover/btn:scale-110 transition-transform duration-200" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
          </Card>
        </div>

        {selectedTeacher && (
          <TeacherDetails
            teacher={selectedTeacher}
            onClose={() => setSelectedTeacher(null)}
          />
        )}
      </div>
    </div>
    </>
  );
};