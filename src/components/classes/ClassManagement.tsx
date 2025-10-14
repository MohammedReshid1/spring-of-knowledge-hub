import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, User, Edit, Trash2, AlertCircle, CheckCircle, BookOpen, Search, Filter, Eye, ChevronLeft, ChevronRight, BookOpenCheck, GraduationCap, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ClassForm } from './ClassForm';
import { ClassStudentsPopup } from './ClassStudentsPopup';
import { ClassSuggestions } from './ClassSuggestions';
import { StudentClassAssignment } from './StudentClassAssignment';
import { GradeMismatchFixer } from './GradeMismatchFixer';
import { DuplicateClassCleaner } from './DuplicateClassCleaner';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/contexts/BranchContext';
import { getHighlightedText } from '@/utils/searchHighlight';
import { SchoolClass, GradeLevel } from '@/types/api';
import { useLiveData } from '@/hooks/useLiveData';
import { LiveUpdatesIndicator } from '@/components/common/LiveUpdatesIndicator';

export const ClassManagement = () => {
  const { selectedBranch } = useBranch();
  const { user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewStudentsClass, setViewStudentsClass] = useState(null);
  const [isStudentsPopupOpen, setIsStudentsPopupOpen] = useState(false);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();
  const { canDelete, isTeacher } = useRoleAccess();

  // Enable real-time updates for class management - replaces 30s polling
  useLiveData(['classes', 'students', 'teachers', 'subjects', 'grade-levels'], {
    additionalQueryKeys: ['grade-stats', 'teacher-assigned-classes', 'teacher-enhanced-classes']
  });

  const { data: classesRaw, isLoading: isClassesLoading } = useQuery<SchoolClass[], Error>({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await apiClient.getClasses();
      if (response.error) {
        throw new Error(response.error);
      }
      if ((import.meta as any)?.env?.MODE !== 'production' && isTeacher) {
      }
      return response.data || [];
    },
  });

  // Filter classes by selected branch
  const classes = useMemo(
    () => classesRaw?.filter(cls => selectedBranch === 'all' || cls.branch_id === selectedBranch) || [],
    [classesRaw, selectedBranch]
  );
  // Fetch all teachers to enrich classes
  const { data: teachersRaw } = useQuery<any[], Error>({
    queryKey: ['teachers'],
    queryFn: async () => {
      const resp = await apiClient.getTeachers();
      if (resp.error) throw new Error(resp.error);
      if ((import.meta as any)?.env?.MODE !== 'production' && isTeacher) {
      }
      return resp.data || [];
    },
    staleTime: 0
  });
  // Filter teachers by branch and map by id
  const teacherMap = useMemo(() => {
    const map = new Map<string, any>();
    (teachersRaw || [])
      .filter(t => selectedBranch === 'all' || t.branch_id === selectedBranch)
      .forEach(t => map.set(t.id, { ...t, full_name: `${t.first_name} ${t.last_name}` }));
    return map;
  }, [teachersRaw, selectedBranch]);

  // Resolve current teacher's teacher_id by matching email
  const teacherSelfId = useMemo(() => {
    if (!isTeacher || !user) return null;
    const email = (user as any)?.email;
    const self = (teachersRaw || []).find((t: any) => t.email === email);
    const id = self ? self.id : null;
    if ((import.meta as any)?.env?.MODE !== 'production' && isTeacher) {
    }
    return id;
  }, [isTeacher, user, teachersRaw]);

  const { data: gradeStats, isLoading: isGradeStatsLoading } = useQuery<GradeLevel[], Error>({
    queryKey: ['grade-stats', selectedBranch],
    queryFn: async () => {
      const response = await apiClient.getGradeLevelStats(selectedBranch || 'all');
      if (response.error) {
        throw new Error(response.error);
      }
      if ((import.meta as any)?.env?.MODE !== 'production' && isTeacher) {
      }
      return response.data || [];
    },
    staleTime: 0,
  });

  // Grade levels are already filtered by the backend based on selectedBranch
  const gradeLevelsFiltered = useMemo(
    () => gradeStats || [],
    [gradeStats]
  );

  // For teachers: fetch assigned classes (enhanced classes -> enhanced dashboard -> fallback to filtered classes)
  const { data: teacherAssigned = [], isLoading: teacherClassesLoading } = useQuery<any[], Error>({
    queryKey: ['teacher-assigned-classes', user?.id],
    queryFn: async () => {
      if (!user?.id || !isTeacher) return [];
      // Skip 'me' endpoint for now due to CORS/500 on some setups; rely on id-based + local fallback
      // Try enhanced classes endpoint next
      try {
        const { data: clsData, error: clsErr } = await apiClient.getTeacherEnhancedClasses(user.id);
        if (!clsErr && clsData?.classes) return clsData.classes as any[];
      } catch (_) {}
      // Fallback to enhanced dashboard
      try {
        const { data, error } = await apiClient.getTeacherEnhancedDashboard(user.id);
        if (!error && data?.assigned_classes) return data.assigned_classes as any[];
      } catch (_) {}
      // Try non-enhanced teacher classes endpoint
      try {
        const { data: legacy, error: legacyErr } = await apiClient.getTeacherClasses(user.id);
        if (!legacyErr && legacy?.classes) return legacy.classes as any[];
      } catch (_) {}
      // Final fallback: filter general classes by teacher assignment
      const all = await apiClient.getClasses();
      const list = (all.data || []) as any[];
      return list.filter((c: any) => c.teacher_id === user.id || (Array.isArray(c.subject_teachers) && c.subject_teachers.some((m: any) => m.teacher_id === user.id)));
    },
    enabled: !!user?.id && isTeacher,
    staleTime: 300000,
  });

  // Enrich classes with teacher objects and grade level data
  const classesEnriched = useMemo(
    () => classes.map(c => {
      const gradeLevel = gradeLevelsFiltered?.find(g => g.id === c.grade_level_id);
      return {
        ...c,
        teacher: c.teacher_id ? teacherMap.get(c.teacher_id) : undefined,
        grade_level: gradeLevel
      };
    }),
    [classes, teacherMap, gradeLevelsFiltered]
  );
  
  // Visible classes depend on role
  const visibleClasses = useMemo(() => {
    if (isTeacher) {
      // Prefer server-derived list; fallback to local filter by resolved teacher id
      if ((teacherAssigned as any[]).length > 0) return teacherAssigned as any[];
      if (teacherSelfId) {
        const filtered = classesEnriched.filter((c: any) =>
          c.teacher_id === teacherSelfId || (Array.isArray(c.subject_teachers) && c.subject_teachers.some((m: any) => m.teacher_id === teacherSelfId))
        );
        return filtered;
      }
      return [];
    }
    return classesEnriched;
  }, [isTeacher, teacherAssigned, classesEnriched, teacherSelfId]);

  // Debug visible and filtered counts for teacher view
  useEffect(() => {
    if ((import.meta as any)?.env?.MODE !== 'production' && isTeacher) {
    }
  }, [isTeacher, visibleClasses]);

  // Fetch all students and filter by branch to compute enrollment counts
  const { data: students, isLoading: isStudentsLoading } = useQuery<import('@/types/api').Student[], Error>({
    queryKey: ['students'],
    queryFn: async () => {
      const resp = await apiClient.getAllStudents();
      if (resp.error) throw new Error(resp.error);
      return resp.data || [];
    },
    staleTime: 0,
  });
  // Only include students from the selected branch (or all)
  const studentsFiltered = useMemo(
    () => students?.filter(s => selectedBranch === 'all' || s.branch_id === selectedBranch) || [],
    [students, selectedBranch]
  );

  // Compute enrollment per class
  const enrollmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    studentsFiltered.forEach(s => {
      if (s.class_id) {
        counts[s.class_id] = (counts[s.class_id] || 0) + 1;
      }
    });
    return counts;
  }, [studentsFiltered]);

  // Subject→Teacher mapping dialog state
  const [mappingClass, setMappingClass] = useState<any | null>(null);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', selectedBranch],
    queryFn: async () => {
      const resp = await apiClient.getSubjects();
      if (resp.error) throw new Error(resp.error);
      return resp.data || [];
    }
  });

  const assignMappingMutation = useMutation({
    mutationFn: async () => {
      if (!mappingClass || !selectedSubjectId || !selectedTeacherId) throw new Error('Select subject and teacher');
      const { error } = await apiClient.assignSubjectTeacher(mappingClass.id, { subject_id: selectedSubjectId, teacher_id: selectedTeacherId });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Subject teacher assigned.' });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setSelectedSubjectId('');
      setSelectedTeacherId('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' })
  });

  // Compute enrollment per grade level by summing class enrollments
  const gradeEnrollmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    classes.forEach(c => {
      const cCount = enrollmentCounts[c.id] || 0;
      counts[c.grade_level_id] = (counts[c.grade_level_id] || 0) + cCount;
    });
    return counts;
  }, [classes, enrollmentCounts]);

  const deleteClassMutation = useMutation({
    mutationFn: (classId: string) => apiClient.deleteClass(classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: "Success",
        description: "Class deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete class: " + error.message,
        variant: "destructive",
      });
    }
  });

  const getCapacityColor = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 95) return 'text-red-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getCapacityBadgeColor = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 95) return 'bg-red-100 text-red-800';
    if (percentage >= 80) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const formatGradeLevel = (grade: string) => {
    const gradeMap: Record<string, string> = {
      'pre_k': 'Pre KG',
      'kg': 'KG', 
      'prep': 'PREP',
      'kindergarten': 'KG',
      'grade_1': 'Grade 1',
      'grade_2': 'Grade 2',
      'grade_3': 'Grade 3',
      'grade_4': 'Grade 4',
      'grade_5': 'Grade 5',
      'grade_6': 'Grade 6',
      'grade_7': 'Grade 7',
      'grade_8': 'Grade 8',
      'grade_9': 'Grade 9',
      'grade_10': 'Grade 10',
      'grade_11': 'Grade 11',
      'grade_12': 'Grade 12',
    };

    return gradeMap[grade] || grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleViewStudents = (classData: any) => {
    if (isTeacher) {
      const __DEV__ = typeof window !== 'undefined' && (import.meta as any)?.env?.MODE !== 'production';
    }
    setViewStudentsClass(classData);
    setIsStudentsPopupOpen(true);
  };

  const handleDelete = (classId: string) => {
    if (confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
      deleteClassMutation.mutate(classId);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingClass(null);
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
  };

  const filteredClasses = visibleClasses.filter(cls => {
    const matchesSearch = !searchTerm || (
      cls.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cls.grade_level?.grade && formatGradeLevel(cls.grade_level.grade).toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cls.teacher?.full_name && cls.teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      cls.academic_year.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const matchesGrade = !gradeFilter || gradeFilter === 'all-grades' || cls.grade_level?.grade === gradeFilter;
    
    return matchesSearch && matchesGrade;
  }) || [];

  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, gradeFilter]);

  useEffect(() => {
    if ((import.meta as any)?.env?.MODE !== 'production' && isTeacher) {
    }
  }, [isTeacher, filteredClasses, searchTerm, gradeFilter]);

  const gradeOptions = Array.from(new Set(visibleClasses?.map(cls => cls.grade_level?.grade).filter(Boolean))) || [];
  
  // Sort grade options in proper order
  const sortedGradeOptions = gradeOptions.sort((a, b) => {
    const gradeOrder = ['pre_k', 'kg', 'prep', 'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12'];
    return gradeOrder.indexOf(a) - gradeOrder.indexOf(b);
  });

  const gradeCapacityMap = useMemo(() => {
    const map: Record<string, number> = {};
    classes.forEach(c => {
      const cap = c.max_capacity || 0;
      map[c.grade_level_id] = (map[c.grade_level_id] || 0) + cap;
    });
    return map;
  }, [classes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
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
              <BookOpen className="mr-2 h-4 w-4" />
              Class Management System
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              {isTeacher ? 'My ' : ''}Class <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Management</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-emerald-100">
              {isTeacher ? 'View and manage your assigned classes with comprehensive tools for student tracking and schedule management.' :
               'Comprehensive class administration with advanced scheduling, capacity management, and assignment tracking. Streamline your educational operations with premium tools.'}
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
              <p className="text-sm text-gray-600">Manage classes efficiently with powerful tools</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LiveUpdatesIndicator />
              {!isTeacher && (
                <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
                  <SheetTrigger asChild>
                    <Button className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0">
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                      Add Class
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle className="text-xl">
                        {editingClass ? 'Edit Class' : 'Add New Class'}
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <ClassForm
                        classData={editingClass}
                        onSuccess={handleFormSuccess}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        </div>

        {/* Duplicate Class Cleaner (admins only) */}
        {!isTeacher && (
          <div className="mx-auto max-w-7xl">
            <DuplicateClassCleaner />
          </div>
        )}

        {/* Grade Mismatch Fixer (admins only) */}
        {!isTeacher && (
          <div className="mx-auto max-w-7xl">
            <GradeMismatchFixer />
          </div>
        )}

        {/* Class Suggestions (admins only) */}
        {!isTeacher && (
          <div className="mx-auto max-w-7xl">
            <ClassSuggestions />
          </div>
        )}

        {/* Student Class Assignment (admins only) */}
        {!isTeacher && (
          <div className="mx-auto max-w-7xl">
            <StudentClassAssignment />
          </div>
        )}

        {/* Grade Level Overview (admins only) */}
        {!isTeacher && (
          <div className="mx-auto max-w-7xl">
          <div className="relative">
            {/* Background card with glass morphism */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/8 via-cyan-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none">
              <CardHeader className="p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 border border-teal-200/50">
                    <Users className="h-5 w-5 text-teal-600" />
                  </div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-teal-800 to-cyan-900 bg-clip-text text-transparent">
                    Grade Level Capacity Overview
                  </CardTitle>
                </div>
                <p className="text-slate-600 leading-relaxed">Current enrollment and capacity for all grade levels with real-time analytics</p>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                {!gradeLevelsFiltered || gradeLevelsFiltered.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50 inline-flex mb-6">
                      <BookOpen className="h-12 w-12 text-slate-400" />
                    </div>
                    <p className="text-slate-700 font-semibold text-lg mb-2">No grade levels found</p>
                    <p className="text-slate-500">Grade levels will appear here once configured</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {gradeLevelsFiltered.map((grade, index) => {
                      // Use computed enrollment per grade_level_id or fallback
                      const actualCount = gradeEnrollmentCounts[grade.id] ?? grade.current_enrollment ?? 0;
                      const computedMax = gradeCapacityMap[grade.id] ?? grade.max_capacity;
                      const percentage = computedMax > 0 ? (actualCount / computedMax) * 100 : 0;
                      const isNearCapacity = percentage >= 80;
                      const isFull = percentage >= 95;

                      return (
                        <div
                          key={grade.id}
                          className="group relative animate-fade-in-up"
                          style={{
                            animationDelay: `${index * 100}ms`,
                            animationFillMode: 'both'
                          }}
                        >
                          {/* Premium card with glass morphism */}
                          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium group-hover:shadow-glow-subtle transition-all duration-normal"></div>
                          <div className={`absolute inset-0 rounded-2xl transition-all duration-normal ${
                            isFull ? 'bg-gradient-to-br from-red-50/80 to-rose-50/80 border border-red-200/50' :
                            isNearCapacity ? 'bg-gradient-to-br from-amber-50/80 to-yellow-50/80 border border-amber-200/50' :
                            'bg-gradient-to-br from-emerald-50/80 to-green-50/80 border border-emerald-200/50'
                          }`}></div>

                          <div className="relative p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-slate-900 text-lg">
                                {formatGradeLevel(grade.grade)}
                              </h3>
                              <div className={`p-2 rounded-xl transition-all duration-normal ${
                                isFull ? 'bg-red-100 border border-red-200' :
                                isNearCapacity ? 'bg-amber-100 border border-amber-200' :
                                'bg-emerald-100 border border-emerald-200'
                              }`}>
                                {isFull ? (
                                  <AlertCircle className="h-5 w-5 text-red-600" />
                                ) : isNearCapacity ? (
                                  <AlertCircle className="h-5 w-5 text-amber-600" />
                                ) : (
                                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white/60 border border-white/40">
                                  <Users className="h-4 w-4 text-slate-600" />
                                </div>
                                <div>
                                  <span className={`text-2xl font-bold ${getCapacityColor(actualCount, computedMax)}`}>
                                    {actualCount}
                                  </span>
                                  <span className="text-sm text-slate-500 ml-1">/ {computedMax}</span>
                                </div>
                              </div>
                              <Badge className={`${getCapacityBadgeColor(actualCount, grade.max_capacity)} font-semibold`} variant="outline">
                                {Math.round(percentage)}%
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              <Progress value={percentage} className="h-2" />
                              <p className="text-sm text-slate-600 font-medium">
                                {computedMax - actualCount} spots available
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          </div>
        )}

        {/* Search and Filter Section */}
        <div className="mx-auto max-w-7xl">
          <div className="relative">
            {/* Background card with glass morphism */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/8 via-blue-500/8 to-indigo-500/8 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none">
            <CardHeader className="p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                  <Filter className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                  Search & Filter Classes
                </CardTitle>
              </div>
              <p className="text-slate-600 leading-relaxed">Search by class name, grade level, teacher, or academic year with intelligent filtering</p>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 p-1 rounded-lg bg-blue-100 border border-blue-200/50">
                      <Search className="h-4 w-4 text-blue-600" />
                    </div>
                    <Input
                      placeholder="Search by class name, grade level, teacher, or academic year..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-14 h-12 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl focus:bg-white/80 focus:border-blue-300 transition-all duration-normal"
                    />
                  </div>
                </div>
                <div className="sm:w-64">
                  <Select value={gradeFilter} onValueChange={setGradeFilter}>
                    <SelectTrigger className="h-12 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl focus:bg-white/80 focus:border-blue-300 transition-all duration-normal">
                      <SelectValue placeholder="Filter by grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-grades">All Grades</SelectItem>
                      {sortedGradeOptions.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {formatGradeLevel(grade)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            </Card>
          </div>
        </div>

        {/* Classes Table */}
        <div className="mx-auto max-w-7xl">
          <div className="relative">
            {/* Background card with glass morphism */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/8 via-purple-500/8 to-pink-500/8 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none">
            <CardHeader className="p-8 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200/50">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                </div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-900 bg-clip-text text-transparent">
                  Classes ({filteredClasses.length})
                </CardTitle>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-white/80 hover:border-indigo-300 transition-all duration-normal rounded-xl"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 py-2 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl text-sm font-semibold text-slate-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-white/80 hover:border-indigo-300 transition-all duration-normal rounded-xl"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-8 pb-8">
              {isClassesLoading || isGradeStatsLoading || (isTeacher && teacherClassesLoading) ? (
                <div className="text-center py-16">
                  <div className="relative mb-6">
                    <div className="h-12 w-12 rounded-full border-4 border-indigo-200 mx-auto"></div>
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-12 w-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                  </div>
                  <p className="text-slate-700 font-semibold text-lg mb-2">Loading classes...</p>
                  <p className="text-slate-500">Please wait while we fetch your data</p>
                </div>
              ) : !filteredClasses || filteredClasses.length === 0 ? (
                <div className="text-center py-16">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50 inline-flex mb-6">
                    <BookOpen className="h-12 w-12 text-slate-400" />
                  </div>
                  <p className="text-slate-700 font-semibold text-lg mb-2">
                    {searchTerm || gradeFilter ? 'No classes found matching your filters' : (isTeacher ? 'No assigned classes found' : 'No classes found')}
                  </p>
                  <p className="text-slate-500 mb-6 max-w-md mx-auto">
                    {searchTerm || gradeFilter ? 'Try adjusting your search terms or filters to find what you\'re looking for' : (isTeacher ? 'Please contact your admin to assign you to classes.' : 'Start by creating your first class to manage students')}
                  </p>
                  {!isTeacher && !searchTerm && !gradeFilter && (
                    <Button
                      onClick={() => setIsFormOpen(true)}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold px-6 py-3 rounded-xl shadow-premium hover:shadow-glow-indigo hover:scale-105 transition-all duration-normal border-0"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Class
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="overflow-x-auto bg-white/40 backdrop-blur-sm rounded-2xl border border-white/30">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border-b border-indigo-100/50">
                          <TableHead className="font-bold text-slate-800 py-4 px-6">Class Name</TableHead>
                          <TableHead className="font-bold text-slate-800 py-4 px-6">Grade Level</TableHead>
                          <TableHead className="font-bold text-slate-800 py-4 px-6">Enrollment</TableHead>
                          <TableHead className="font-bold text-slate-800 py-4 px-6">Capacity</TableHead>
                          <TableHead className="font-bold text-slate-800 py-4 px-6">Utilization</TableHead>
                          <TableHead className="font-bold text-slate-800 py-4 px-6">Academic Year</TableHead>
                          <TableHead className="font-bold text-slate-800 py-4 px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                  <TableBody>
                    {paginatedClasses.map((cls) => {
                      const actualEnrollment = enrollmentCounts[cls.id] ?? cls.current_enrollment ?? 0;
                      const percentage = cls.max_capacity > 0 ? (actualEnrollment / cls.max_capacity) * 100 : 0;
                      
                      return (
                        <TableRow key={cls.id} className="hover:bg-white/60 hover:backdrop-blur-sm transition-all duration-normal border-b border-slate-100/50">
                          <TableCell className="font-semibold text-slate-900 py-4 px-6">
                            {getHighlightedText(cls.class_name, searchTerm)}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <Badge variant="outline" className="font-semibold bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 text-indigo-700">
                              {(() => {
                                if (cls.grade_level && cls.grade_level.grade) {
                                  return formatGradeLevel(cls.grade_level.grade);
                                }
                                // fallback: find grade_level by id from gradeStats
                                const gradeObj = gradeStats?.find(g => g.id === cls.grade_level_id);
                                if (gradeObj) {
                                  return formatGradeLevel(gradeObj.grade);
                                }
                                return 'Not assigned';
                              })()}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <span className={`font-bold text-lg ${getCapacityColor(actualEnrollment, cls.max_capacity)}`}>
                              {actualEnrollment}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <span className="text-slate-600 font-semibold">{cls.max_capacity}</span>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-20">
                                <Progress value={percentage} className="h-2" />
                              </div>
                              <Badge className={`${getCapacityBadgeColor(actualEnrollment, cls.max_capacity)} font-semibold`} variant="outline">
                                {Math.round(percentage)}%
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <span className="text-slate-600 font-medium">
                              {getHighlightedText(cls.academic_year, searchTerm)}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewStudents(cls)}
                                className="p-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 hover:scale-105 transition-all duration-normal"
                                title="View Students"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!isTeacher && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingClass(cls);
                                    setIsFormOpen(true);
                                  }}
                                  className="p-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 hover:scale-105 transition-all duration-normal"
                                  title="Edit Class"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {!isTeacher && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setMappingClass(cls); setIsMappingOpen(true); }}
                                  className="p-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600 hover:scale-105 transition-all duration-normal"
                                  title="Manage Subject Teachers"
                                >
                                  <BookOpen className="h-4 w-4" />
                                </Button>
                              )}
                              {!isTeacher && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(cls.id)}
                                  disabled={!canDelete}
                                  className={`p-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-red-50 hover:border-red-200 hover:text-red-600 hover:scale-105 transition-all duration-normal ${!canDelete ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  title="Delete Class"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between bg-white/40 backdrop-blur-sm rounded-2xl border border-white/30 p-6">
                    <p className="text-sm font-medium text-slate-600">
                      Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredClasses.length)} of {filteredClasses.length} results
                    </p>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-white/80 hover:border-indigo-300 transition-all duration-normal rounded-xl"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <span className="px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl text-sm font-semibold text-slate-700">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-white/80 hover:border-indigo-300 transition-all duration-normal rounded-xl"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              )}
            </CardContent>
            </Card>
          </div>
        </div>

        {/* Subject→Teacher Mapping Sheet (admins only) */}
        {!isTeacher && (
          <Sheet open={isMappingOpen} onOpenChange={setIsMappingOpen}>
            <SheetContent className="w-full sm:max-w-2xl bg-white/95 backdrop-blur-glass border-0 shadow-2xl overflow-hidden">
              {/* Premium Background Effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50/80 via-indigo-50/60 to-blue-50/80 pointer-events-none"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/8 via-indigo-500/6 to-blue-500/8 pointer-events-none"></div>

              {/* Floating orbs */}
              <div className="absolute top-10 right-10 w-24 h-24 bg-gradient-to-r from-purple-200/20 to-indigo-200/20 rounded-full blur-2xl animate-float pointer-events-none"></div>
              <div className="absolute bottom-20 left-10 w-20 h-20 bg-gradient-to-r from-indigo-200/20 to-blue-200/20 rounded-full blur-2xl animate-float pointer-events-none" style={{animationDelay: '1s'}}></div>

              <div className="relative h-full overflow-y-auto">
                <SheetHeader className="p-8 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 border border-purple-200/50 shadow-premium">
                      <BookOpen className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-purple-800 to-indigo-900 bg-clip-text text-transparent">
                        Manage Subject Teachers
                      </SheetTitle>
                      {mappingClass && (
                        <p className="text-lg text-slate-600 font-medium mt-1">{mappingClass.class_name}</p>
                      )}
                    </div>
                  </div>
                </SheetHeader>

                <div className="px-8 space-y-8">
                  {/* Current Mappings Section */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium"></div>
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 to-green-50/80 rounded-2xl pointer-events-none"></div>

                    <div className="relative p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200/50">
                          <Users className="h-5 w-5 text-emerald-600" />
                        </div>
                        <h4 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-emerald-800 to-green-900 bg-clip-text text-transparent">
                          Current Mappings
                        </h4>
                      </div>

                      <div className="space-y-3">
                        {(mappingClass?.subject_teachers || []).length === 0 ? (
                          <div className="text-center py-8">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50 inline-flex mb-4">
                              <BookOpen className="h-8 w-8 text-slate-400" />
                            </div>
                            <p className="text-slate-600 font-semibold mb-2">No mappings yet</p>
                            <p className="text-slate-500 text-sm">Subject-teacher assignments will appear here once created</p>
                          </div>
                        ) : (
                          (mappingClass?.subject_teachers || []).map((m: any, idx: number) => {
                            const subj = (subjects as any[]).find(s => s.id === m.subject_id);
                            const teacher = teacherMap.get(m.teacher_id);
                            return (
                              <div
                                key={`${m.subject_id}-${m.teacher_id}-${idx}`}
                                className="group flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl hover:bg-white/80 hover:scale-105 transition-all duration-normal animate-fade-in-up"
                                style={{
                                  animationDelay: `${idx * 100}ms`,
                                  animationFillMode: 'both'
                                }}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-200">
                                    <BookOpen className="h-4 w-4 text-emerald-600" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-900">
                                      {subj ? `${subj.subject_name} (${subj.subject_code})` : m.subject_id}
                                    </p>
                                    <p className="text-sm text-slate-600 font-medium">
                                      Teacher: {teacher?.full_name || m.teacher_id}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Add Mapping Section */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium"></div>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 rounded-2xl pointer-events-none"></div>

                    <div className="relative p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                          <UserPlus className="h-5 w-5 text-blue-600" />
                        </div>
                        <h4 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                          Add New Mapping
                        </h4>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Subject</label>
                            <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                              <SelectTrigger className="bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl focus:bg-white/80 focus:border-blue-300 transition-all duration-normal">
                                <SelectValue placeholder="Select subject" />
                              </SelectTrigger>
                              <SelectContent>
                                {(subjects as any[]).map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Teacher</label>
                            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                              <SelectTrigger className="bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl focus:bg-white/80 focus:border-blue-300 transition-all duration-normal">
                                <SelectValue placeholder="Select teacher" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from(teacherMap.values()).map((t: any) => (
                                  <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            onClick={() => assignMappingMutation.mutate()}
                            disabled={assignMappingMutation.isPending || !selectedSubjectId || !selectedTeacherId}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow-premium hover:shadow-glow-blue hover:scale-105 transition-all duration-normal border-0"
                          >
                            {assignMappingMutation.isPending ? 'Assigning...' : 'Assign Teacher'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-8"></div> {/* Bottom padding */}
              </div>
            </SheetContent>
          </Sheet>
        )}

        <ClassStudentsPopup
          classData={viewStudentsClass}
          isOpen={isStudentsPopupOpen}
          onClose={() => {
            setIsStudentsPopupOpen(false);
            setViewStudentsClass(null);
          }}
        />
      </div>
    </div>
  );
};
