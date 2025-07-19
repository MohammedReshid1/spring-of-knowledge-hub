import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useBranchData } from '@/hooks/useBranchData';

// Supabase usage is deprecated. Use /api endpoints for all teacher management data fetching with the FastAPI backend.

export const TeacherManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();
  const { canDelete } = useRoleAccess();
  const { getBranchFilter } = useBranchData();

  // Real-time subscription for teachers
  useEffect(() => {
    const channel = supabase
      .channel('teachers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users'
        },
        () => {
          console.log('Users table changed, refetching teachers...');
          queryClient.invalidateQueries({ queryKey: ['teachers'] });
          queryClient.invalidateQueries({ queryKey: ['teacher-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: teachers, isLoading, error } = useQuery({
    queryKey: ['teachers', getBranchFilter()],
    queryFn: async () => {
      console.log('Fetching teachers with branch filter...');
      const branchFilter = getBranchFilter();
      
      let query = supabase
        .from('users')
        .select(`
          *,
          classes:classes!teacher_id (
            id,
            class_name,
            max_capacity,
            current_enrollment,
            grade_levels:grade_level_id (
              grade
            )
          )
        `)
        .eq('role', 'teacher');

      // Apply branch filter if needed
      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }
      
      query = query.order('full_name');
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching teachers:', error);
        throw error;
      }
      console.log('Teachers fetched successfully:', data?.length);
      return data;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['teacher-stats'],
    queryFn: async () => {
      const { data: teachersData, error } = await supabase
        .from('users')
        .select('id, role')
        .eq('role', 'teacher');
      
      if (error) throw error;
      
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('teacher_id')
        .not('teacher_id', 'is', null);
      
      if (classesError) throw classesError;
      
      const totalTeachers = teachersData.length;
      const assignedTeachers = new Set(classesData.map(c => c.teacher_id)).size;
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
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', teacherId);
      
      if (error) throw error;
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

  const filteredTeachers = teachers?.filter(teacher => {
    const matchesSearch = 
      teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const hasClasses = teacher.classes && teacher.classes.length > 0;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'assigned' && hasClasses) ||
      (statusFilter === 'unassigned' && !hasClasses);
    
    return matchesSearch && matchesStatus;
  }) || [];

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = (fullName: string) => {
    return fullName.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
  };

  const handleDelete = (teacherId: string) => {
    if (confirm('Are you sure you want to delete this teacher? This action cannot be undone.')) {
      deleteTeacherMutation.mutate(teacherId);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading teachers</p>
              <p className="text-sm mt-1">{error.message}</p>
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['teachers'] })}
                className="mt-4"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teacher Management</h1>
          <p className="text-gray-600 mt-1">Manage teachers and their class assignments</p>
        </div>
        <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
          <SheetTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-600">Total Teachers</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.totalTeachers || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-green-600">Assigned</p>
                <p className="text-2xl font-bold text-green-900">{stats?.assignedTeachers || 0}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-600">Unassigned</p>
                <p className="text-2xl font-bold text-orange-900">{stats?.unassignedTeachers || 0}</p>
              </div>
              <BookOpen className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filter Teachers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teachers</SelectItem>
                <SelectItem value="assigned">Assigned to Classes</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Teachers Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            Teachers ({filteredTeachers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading teachers...</p>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No teachers found</p>
              <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Teacher</TableHead>
                    <TableHead className="font-semibold">Contact</TableHead>
                    <TableHead className="font-semibold">Classes Assigned</TableHead>
                    <TableHead className="font-semibold">Total Students</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.map((teacher) => {
                    const totalStudents = teacher.classes?.reduce((sum, cls) => sum + (cls.current_enrollment || 0), 0) || 0;
                    const hasClasses = teacher.classes && teacher.classes.length > 0;
                    
                    return (
                      <TableRow key={teacher.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {getInitials(teacher.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900">{teacher.full_name}</div>
                              <div className="text-sm text-gray-500">Teacher</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-gray-400" />
                              <span className="text-gray-600">{teacher.email}</span>
                            </div>
                            {teacher.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-gray-400" />
                                <span className="text-gray-600">{teacher.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasClasses ? (
                            <div className="space-y-1">
                              {teacher.classes.map((cls) => (
                                <div key={cls.id} className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {cls.class_name}
                                  </Badge>
                                  {cls.grade_levels && (
                                    <span className="text-xs text-gray-500">
                                      ({formatGradeLevel(cls.grade_levels.grade)})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">No classes assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-gray-900">{totalStudents}</span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={hasClasses ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}
                          >
                            {hasClasses ? 'Assigned' : 'Unassigned'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedTeacher(teacher)}
                              className="hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTeacher(teacher);
                                setIsFormOpen(true);
                              }}
                              className="hover:bg-green-50 hover:text-green-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(teacher.id)}
                              disabled={!canDelete}
                              className={`hover:bg-red-50 hover:text-red-600 ${!canDelete ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <Trash2 className="h-4 w-4" />
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

      {selectedTeacher && (
        <TeacherDetails
          teacher={selectedTeacher}
          onClose={() => setSelectedTeacher(null)}
        />
      )}
    </div>
  );
};