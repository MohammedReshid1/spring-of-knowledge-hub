
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plus, Users, User, Edit, Trash2, AlertCircle, CheckCircle, BookOpen } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ClassForm } from './ClassForm';

export const ClassManagement = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const queryClient = useQueryClient();

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
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
      
      if (error) throw error;
      return data;
    }
  });

  const { data: gradeStats } = useQuery({
    queryKey: ['grade-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grade_levels')
        .select('*')
        .order('grade');
      
      if (error) throw error;
      return data;
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
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleDelete = (classId: string) => {
    if (confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
      deleteClassMutation.mutate(classId);
    }
  };

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
                onSuccess={() => {
                  setIsFormOpen(false);
                  setEditingClass(null);
                  queryClient.invalidateQueries({ queryKey: ['classes'] });
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Grade Level Overview */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Grade Level Capacity Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {gradeStats?.map((grade) => {
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
        </CardContent>
      </Card>

      {/* Classes Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            Active Classes ({classes?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading classes...</p>
            </div>
          ) : !classes || classes.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No classes found</p>
              <p className="text-gray-500 text-sm mb-4">Start by creating your first class</p>
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Class
              </Button>
            </div>
          ) : (
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
                  {classes.map((cls) => {
                    const percentage = cls.max_capacity > 0 ? (cls.current_enrollment / cls.max_capacity) * 100 : 0;
                    
                    return (
                      <TableRow key={cls.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium text-gray-900">{cls.class_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {cls.grade_levels ? formatGradeLevel(cls.grade_levels.grade) : 'Not assigned'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-700">
                              {cls.teacher?.full_name || 'Not assigned'}
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
                          <span className="text-gray-600">{cls.academic_year}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingClass(cls);
                                setIsFormOpen(true);
                              }}
                              className="hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(cls.id)}
                              className="hover:bg-red-50 hover:text-red-600"
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
    </div>
  );
};
