
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plus, Users, User } from 'lucide-react';
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

  const handleDelete = (classId: string) => {
    if (confirm('Are you sure you want to delete this class? This action cannot be undone.')) {
      deleteClassMutation.mutate(classId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Class Management</h1>
        <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Class
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                {editingClass ? 'Edit Class' : 'Add New Class'}
              </SheetTitle>
            </SheetHeader>
            <ClassForm
              classData={editingClass}
              onSuccess={() => {
                setIsFormOpen(false);
                setEditingClass(null);
                queryClient.invalidateQueries({ queryKey: ['classes'] });
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Grade Level Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {gradeStats?.map((grade) => (
          <Card key={grade.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {grade.grade.replace('_', ' ').toUpperCase()}
                  </p>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className={`text-2xl font-bold ${getCapacityColor(grade.current_enrollment, grade.max_capacity)}`}>
                      {grade.current_enrollment}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / {grade.max_capacity}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={grade.current_enrollment >= grade.max_capacity ? "destructive" : "secondary"}>
                    {Math.round((grade.current_enrollment / grade.max_capacity) * 100)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Classes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading classes...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class Name</TableHead>
                    <TableHead>Grade Level</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Enrollment</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes?.map((cls) => (
                    <TableRow key={cls.id}>
                      <TableCell className="font-medium">{cls.class_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {cls.grade_levels?.grade.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {cls.teacher?.full_name || 'Not assigned'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={getCapacityColor(cls.current_enrollment, cls.max_capacity)}>
                          {cls.current_enrollment}
                        </span>
                      </TableCell>
                      <TableCell>{cls.max_capacity}</TableCell>
                      <TableCell>{cls.academic_year}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingClass(cls);
                              setIsFormOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cls.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
