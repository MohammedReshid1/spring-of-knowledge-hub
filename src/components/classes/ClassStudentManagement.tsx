
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, UserMinus, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ClassStudentManagementProps {
  classData: any;
  onClose: () => void;
}

export const ClassStudentManagement = ({ classData, onClose }: ClassStudentManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [availableStudents, setAvailableStudents] = useState([]);
  const queryClient = useQueryClient();

  const { data: classStudents, isLoading: loadingClassStudents } = useQuery({
    queryKey: ['class-students', classData.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classData.id)
        .order('first_name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: allStudents } = useQuery({
    queryKey: ['all-students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('first_name');
      
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    if (allStudents && classStudents) {
      const available = allStudents.filter(student => 
        !classStudents.some(classStudent => classStudent.id === student.id) &&
        student.status === 'Active'
      );
      setAvailableStudents(available);
    }
  }, [allStudents, classStudents]);

  const addStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      // Check current class capacity
      if (classStudents && classStudents.length >= classData.max_capacity) {
        throw new Error('Class is at maximum capacity');
      }

      const { error } = await supabase
        .from('students')
        .update({ class_id: classData.id })
        .eq('id', studentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students', classData.id] });
      queryClient.invalidateQueries({ queryKey: ['all-students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: "Success",
        description: "Student added to class successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add student to class",
        variant: "destructive",
      });
    }
  });

  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from('students')
        .update({ class_id: null })
        .eq('id', studentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-students', classData.id] });
      queryClient.invalidateQueries({ queryKey: ['all-students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: "Success",
        description: "Student removed from class successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove student from class",
        variant: "destructive",
      });
    }
  });

  const formatGradeLevel = (grade: string) => {
    const gradeMap: Record<string, string> = {
      'pre_k': 'Pre KG',
      'kg': 'KG',
      'prep': 'Prep',
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

  const filteredAvailableStudents = availableStudents.filter(student =>
    !searchTerm || 
    student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClassStudents = classStudents?.filter(student =>
    !searchTerm || 
    student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Class Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {classData.class_name}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Grade: {classData.grade_levels ? formatGradeLevel(classData.grade_levels.grade) : 'N/A'}</span>
            <span>Capacity: {classStudents?.length || 0}/{classData.max_capacity}</span>
            <span>Teacher: {classData.teacher?.full_name || 'Not assigned'}</span>
          </div>
        </CardHeader>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Class Students */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Students in Class ({filteredClassStudents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClassStudents ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading students...</p>
              </div>
            ) : filteredClassStudents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No students in this class</p>
                <p className="text-gray-500 text-sm">Add students from the available list</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredClassStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{student.first_name} {student.last_name}</p>
                      <p className="text-sm text-gray-500">
                        {student.student_id} • {formatGradeLevel(student.grade_level)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeStudentMutation.mutate(student.id)}
                      disabled={removeStudentMutation.isPending}
                    >
                      <UserMinus className="h-4 w-4 mr-1" />
                      Remove
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
            <CardTitle className="text-lg">Available Students ({filteredAvailableStudents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAvailableStudents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No available students</p>
                <p className="text-gray-500 text-sm">All active students are already assigned to classes</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredAvailableStudents.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{student.first_name} {student.last_name}</p>
                      <p className="text-sm text-gray-500">
                        {student.student_id} • {formatGradeLevel(student.grade_level)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addStudentMutation.mutate(student.id)}
                      disabled={addStudentMutation.isPending || (classStudents?.length >= classData.max_capacity)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};
