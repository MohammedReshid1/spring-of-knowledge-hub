import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, UserMinus, Search, School } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ClassStudentsPopupProps {
  classData: any;
  isOpen: boolean;
  onClose: () => void;
}

export const ClassStudentsPopup = ({ classData, isOpen, onClose }: ClassStudentsPopupProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const queryClient = useQueryClient();

  // Fetch students in this class
  const { data: classStudents, isLoading: loadingClassStudents } = useQuery({
    queryKey: ['class-students', classData?.id],
    queryFn: async () => {
      if (!classData?.id) return [];
      
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classData.id)
        .eq('status', 'Active')
        .order('first_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!classData?.id && isOpen,
  });

  // Fetch available students (same grade level, not assigned to any class)
  const { data: availableStudents, isLoading: loadingAvailable } = useQuery({
    queryKey: ['available-students', classData?.grade_level_id],
    queryFn: async () => {
      if (!classData?.grade_level_id) return [];
      
      // Get the grade level enum value
      const { data: gradeLevel, error: gradeError } = await supabase
        .from('grade_levels')
        .select('grade')
        .eq('id', classData.grade_level_id)
        .single();
      
      if (gradeError) throw gradeError;
      
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('grade_level', gradeLevel.grade)
        .is('class_id', null)
        .eq('status', 'Active')
        .order('first_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!classData?.grade_level_id && isOpen,
  });

  // Add student to class
  const addStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from('students')
        .update({ class_id: classData.id })
        .eq('id', studentId);
      
      if (error) throw error;
      
      // Update class enrollment count
      const { error: updateError } = await supabase
        .from('classes')
        .update({ current_enrollment: (classData.current_enrollment || 0) + 1 })
        .eq('id', classData.id);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student added to class successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['class-students'] });
      queryClient.invalidateQueries({ queryKey: ['available-students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
      setSelectedStudentId('');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add student to class: " + error.message,
        variant: "destructive",
      });
    }
  });

  // Remove student from class
  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from('students')
        .update({ class_id: null })
        .eq('id', studentId);
      
      if (error) throw error;
      
      // Update class enrollment count
      const { error: updateError } = await supabase
        .from('classes')
        .update({ current_enrollment: Math.max(0, (classData.current_enrollment || 0) - 1) })
        .eq('id', classData.id);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student removed from class successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['class-students'] });
      queryClient.invalidateQueries({ queryKey: ['available-students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove student from class: " + error.message,
        variant: "destructive",
      });
    }
  });

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

  // Filter students based on search term
  const filteredClassStudents = classStudents?.filter(student => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      student.first_name.toLowerCase().includes(searchLower) ||
      student.last_name.toLowerCase().includes(searchLower) ||
      student.student_id.toLowerCase().includes(searchLower)
    );
  }) || [];

  const filteredAvailableStudents = availableStudents?.filter(student => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      student.first_name.toLowerCase().includes(searchLower) ||
      student.last_name.toLowerCase().includes(searchLower) ||
      student.student_id.toLowerCase().includes(searchLower)
    );
  }) || [];

  if (!classData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <School className="h-6 w-6" />
            {classData.class_name} - Students Management
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Grade Level: {classData.grade_levels ? formatGradeLevel(classData.grade_levels.grade) : 'N/A'} | 
            Capacity: {classData.current_enrollment || 0} / {classData.max_capacity}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search students by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Students */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Current Students ({filteredClassStudents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingClassStudents ? (
                  <div className="text-center py-4">Loading students...</div>
                ) : filteredClassStudents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No students found matching search' : 'No students in this class'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredClassStudents.map((student) => (
                      <div key={student.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <div>
                          <p className="font-medium">{student.first_name} {student.last_name}</p>
                          <p className="text-sm text-muted-foreground">{student.student_id}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeStudentMutation.mutate(student.id)}
                          disabled={removeStudentMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Students */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Available Students ({filteredAvailableStudents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Add Student Dropdown */}
                  <div className="flex gap-2">
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select student to add..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredAvailableStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.first_name} {student.last_name} ({student.student_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => selectedStudentId && addStudentMutation.mutate(selectedStudentId)}
                      disabled={!selectedStudentId || addStudentMutation.isPending || (classData.current_enrollment >= classData.max_capacity)}
                      size="sm"
                    >
                      Add
                    </Button>
                  </div>

                  {(classData.current_enrollment >= classData.max_capacity) && (
                    <Badge variant="destructive" className="w-full justify-center">
                      Class is at full capacity
                    </Badge>
                  )}

                  {loadingAvailable ? (
                    <div className="text-center py-4">Loading available students...</div>
                  ) : filteredAvailableStudents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No available students found matching search' : 'No available students for this grade level'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {filteredAvailableStudents.map((student) => (
                        <div key={student.id} className="flex items-center justify-between p-2 border rounded-lg">
                          <div>
                            <p className="font-medium">{student.first_name} {student.last_name}</p>
                            <p className="text-sm text-muted-foreground">{student.student_id}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addStudentMutation.mutate(student.id)}
                            disabled={addStudentMutation.isPending || (classData.current_enrollment >= classData.max_capacity)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};