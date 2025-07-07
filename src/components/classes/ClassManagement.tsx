
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, User, Edit, Trash2, AlertCircle, CheckCircle, BookOpen, Search, Filter, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ClassForm } from './ClassForm';
import { ClassStudentsPopup } from './ClassStudentsPopup';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { getHighlightedText } from '@/utils/searchHighlight';

export const ClassManagement = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewStudentsClass, setViewStudentsClass] = useState(null);
  const [isStudentsPopupOpen, setIsStudentsPopupOpen] = useState(false);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();
  const { canDelete } = useRoleAccess();

  // Real-time subscriptions
  useEffect(() => {
    const classesChannel = supabase
      .channel('classes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classes' },
        () => {
          console.log('Classes updated, refetching...');
          queryClient.invalidateQueries({ queryKey: ['classes'] });
          queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
        }
      )
      .subscribe();

    const gradeChannel = supabase
      .channel('grade-levels-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grade_levels' },
        () => {
          console.log('Grade levels updated, refetching...');
          queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(classesChannel);
      supabase.removeChannel(gradeChannel);
    };
  }, [queryClient]);

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      console.log('Fetching classes...');
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          grade_levels:grade_level_id (
            id,
            grade,
            max_capacity,
            current_enrollment
          ),
          teacher:teacher_id (
            id,
            full_name
          )
        `)
        .order('academic_year', { ascending: false });
      
      if (error) {
        console.error('Error fetching classes:', error);
        throw error;
      }
      console.log('Classes fetched successfully:', data?.length);
      return data;
    }
  });

  // Updated grade stats query to show all grade levels from grade_levels table
  const { data: gradeStats } = useQuery({
    queryKey: ['grade-stats'],
    queryFn: async () => {
      console.log('Fetching grade stats...');
      
      // Get all grade levels from the grade_levels table
      const { data: gradeLevelsData, error: gradeLevelsError } = await supabase
        .from('grade_levels')
        .select('id, grade, max_capacity, current_enrollment, academic_year, created_at, updated_at')
        .order('grade');
      
      if (gradeLevelsError) {
        console.error('Error fetching grade levels:', gradeLevelsError);
        throw gradeLevelsError;
      }

      console.log('Grade stats fetched successfully:', gradeLevelsData?.length);
      return gradeLevelsData || [];
    }
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);
      
      if (error) throw error;
    },
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
    // Updated to handle KG and PREP properly  
    const gradeMap: Record<string, string> = {
      'pre_k': 'Pre KG',
      'kg': 'KG', 
      'prep': 'PREP',
      'kindergarten': 'KG', // Fallback if any old data exists
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

  // Filter classes based on search term and grade level
  const filteredClasses = classes?.filter(cls => {
    const matchesSearch = !searchTerm || (
      cls.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cls.grade_levels?.grade && formatGradeLevel(cls.grade_levels.grade).toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cls.teacher?.full_name && cls.teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      cls.academic_year.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const matchesGrade = !gradeFilter || gradeFilter === 'all-grades' || cls.grade_levels?.grade === gradeFilter;
    
    return matchesSearch && matchesGrade;
  }) || [];

  // Pagination
  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, startIndex + itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, gradeFilter]);

  // Get unique grade levels for filter
  const gradeOptions = Array.from(new Set(classes?.map(cls => cls.grade_levels?.grade).filter(Boolean))) || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Class Management</h1>
          <p className="text-gray-600 mt-1">Manage classes and grade level capacity</p>
        </div>
        <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
          <SheetTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Class
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
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
      </div>

      {/* Grade Level Overview */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Grade Level Capacity Overview</CardTitle>
          <p className="text-sm text-gray-600">Current enrollment and capacity for all grade levels</p>
        </CardHeader>
        <CardContent>
          {!gradeStats || gradeStats.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No grade levels found</p>
              <p className="text-gray-500 text-sm">Grade levels will appear here once configured</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {gradeStats.map((grade) => {
                const percentage = grade.max_capacity > 0 ? (grade.current_enrollment / grade.max_capacity) * 100 : 0;
                const isNearCapacity = percentage >= 80;
                const isFull = percentage >= 95;
                
                return (
                  <Card key={grade.id} className={`border-l-4 ${
                    isFull ? 'border-l-red-500 bg-red-50' : 
                    isNearCapacity ? 'border-l-yellow-500 bg-yellow-50' : 
                    'border-l-green-500 bg-green-50'
                  } hover:shadow-md transition-shadow`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">
                            {formatGradeLevel(grade.grade)}
                          </h3>
                          {isFull ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : isNearCapacity ? (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-600" />
                            <span className={`text-lg font-bold ${getCapacityColor(grade.current_enrollment, grade.max_capacity)}`}>
                              {grade.current_enrollment}
                            </span>
                            <span className="text-sm text-gray-500">/ {grade.max_capacity}</span>
                          </div>
                          <Badge className={getCapacityBadgeColor(grade.current_enrollment, grade.max_capacity)} variant="outline">
                            {Math.round(percentage)}%
                          </Badge>
                        </div>
                        
                        <Progress value={percentage} className="h-2" />
                        
                        <p className="text-xs text-gray-600">
                          {grade.max_capacity - grade.current_enrollment} spots available
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search and Filter Section */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filter Classes
          </CardTitle>
          <p className="text-sm text-gray-600">Search by class name, grade level, teacher, or academic year</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by class name, grade level, teacher, or academic year..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-grades">All Grades</SelectItem>
                  {gradeOptions.map((grade) => (
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

      {/* Classes Table */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            Classes ({filteredClasses.length})
          </CardTitle>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading classes...</p>
            </div>
          ) : !filteredClasses || filteredClasses.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">
                {searchTerm || gradeFilter ? 'No classes found matching your filters' : 'No classes found'}
              </p>
              <p className="text-gray-500 text-sm mb-4">
                {searchTerm || gradeFilter ? 'Try adjusting your search terms or filters' : 'Start by creating your first class'}
              </p>
              {!searchTerm && !gradeFilter && (
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Class
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Class Name</TableHead>
                      <TableHead className="font-semibold">Grade Level</TableHead>
                      <TableHead className="font-semibold">Teacher</TableHead>
                      <TableHead className="font-semibold">Enrollment</TableHead>
                      <TableHead className="font-semibold">Capacity</TableHead>
                      <TableHead className="font-semibold">Utilization</TableHead>
                      <TableHead className="font-semibold">Academic Year</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClasses.map((cls) => {
                    const percentage = cls.max_capacity > 0 ? (cls.current_enrollment / cls.max_capacity) * 100 : 0;
                    
                      return (
                        <TableRow key={cls.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="font-medium text-gray-900">
                            {getHighlightedText(cls.class_name, searchTerm)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-medium">
                              {cls.grade_levels ? formatGradeLevel(cls.grade_levels.grade) : 'Not assigned'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-500" />
                              <span className="text-gray-700">
                                {cls.teacher?.full_name ? getHighlightedText(cls.teacher.full_name, searchTerm) : 'Not assigned'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-medium ${getCapacityColor(cls.current_enrollment, cls.max_capacity)}`}>
                              {cls.current_enrollment}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-600">{cls.max_capacity}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16">
                                <Progress value={percentage} className="h-2" />
                              </div>
                              <Badge className={getCapacityBadgeColor(cls.current_enrollment, cls.max_capacity)} variant="outline">
                                {Math.round(percentage)}%
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-600">
                              {getHighlightedText(cls.academic_year, searchTerm)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewStudents(cls)}
                                className="hover:bg-green-50 hover:text-green-600"
                                title="View Students"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingClass(cls);
                                  setIsFormOpen(true);
                                }}
                                className="hover:bg-blue-50 hover:text-blue-600"
                                title="Edit Class"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(cls.id)}
                                disabled={!canDelete}
                                className={`hover:bg-red-50 hover:text-red-600 ${!canDelete ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Delete Class"
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
              
              {/* Pagination Info */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredClasses.length)} of {filteredClasses.length} results
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class Students Popup */}
      <ClassStudentsPopup
        classData={viewStudentsClass}
        isOpen={isStudentsPopupOpen}
        onClose={() => {
          setIsStudentsPopupOpen(false);
          setViewStudentsClass(null);
        }}
      />
    </div>
  );
};
