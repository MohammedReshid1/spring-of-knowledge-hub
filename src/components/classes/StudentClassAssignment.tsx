import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, Users, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Student, SchoolClass } from '@/types/api';

interface UnassignedStudent extends Student {}

interface GradeClassGroup {
  gradeLevel: string;
  gradeName: string;
  students: UnassignedStudent[];
  availableClasses: Array<{
    id: string;
    class_name: string;
    current_enrollment: number;
    max_capacity: number;
    available_spots: number;
  }>;
}

export const StudentClassAssignment = () => {
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();

  const { data: gradeGroups, isLoading } = useQuery({
    queryKey: ['unassigned-students', selectedBranch],
    queryFn: async () => {
      const [studentsResponse, classesResponse, gradeLevelsResponse] = await Promise.all([
        apiClient.getAllStudents(selectedBranch),
        apiClient.getClasses(),
        apiClient.getGradeLevels(),
      ]);
      
      if (studentsResponse.error) throw new Error(studentsResponse.error);
      if (classesResponse.error) throw new Error(classesResponse.error);
      if (gradeLevelsResponse.error) throw new Error(gradeLevelsResponse.error);
      
      const gradeLevels = gradeLevelsResponse.data || [];
      console.log('StudentClassAssignment - Grade levels fetched:', gradeLevels.length);
      
      // Filter students by selected branch
      const branchStudents = studentsResponse.data || [];
      const filteredBranchStudents = selectedBranch === 'all'
        ? branchStudents
        : branchStudents.filter(s => s.branch_id === selectedBranch);
      // Unassigned and active
      const unassignedStudents = filteredBranchStudents.filter(s => !s.class_id && s.status === 'Active');

      // Filter and enrich classes by selected branch
      const branchClassesRaw = classesResponse.data || [];
      const filteredClasses = selectedBranch === 'all'
        ? branchClassesRaw
        : branchClassesRaw.filter(c => c.branch_id === selectedBranch);
        
      // Enrich classes with grade level information
      const classes = filteredClasses.map(cls => {
        const gradeLevel = gradeLevels.find(gl => gl.id === cls.grade_level_id);
        console.log(`StudentAssignment - Class ${cls.class_name}: grade_level_id=${cls.grade_level_id}, found grade=${gradeLevel?.grade}`);
        return {
          ...cls,
          grade_level: gradeLevel ? { grade: gradeLevel.grade } : null
        };
      });

      // Group students by grade level
      const gradeGroups: Record<string, GradeClassGroup> = {};
      
      unassignedStudents?.forEach(student => {
        if (!gradeGroups[student.grade_level]) {
          gradeGroups[student.grade_level] = {
            gradeLevel: student.grade_level,
            gradeName: formatGradeLevel(student.grade_level),
            students: [],
            availableClasses: []
          };
        }
        gradeGroups[student.grade_level].students.push(student);
      });

      // Add available classes for each grade level
      for (const [gradeLevel, group] of Object.entries(gradeGroups)) {
        // Convert formatted grade back to database format for comparison
        const gradeToDbFormat: Record<string, string> = {
          'Pre KG': 'pre_k',
          'KG': 'kg',
          'PREP': 'prep', 
          'Grade 1': 'grade_1',
          'Grade 2': 'grade_2',
          'Grade 3': 'grade_3',
          'Grade 4': 'grade_4',
          'Grade 5': 'grade_5',
          'Grade 6': 'grade_6',
          'Grade 7': 'grade_7',
          'Grade 8': 'grade_8',
          'Grade 9': 'grade_9',
          'Grade 10': 'grade_10',
          'Grade 11': 'grade_11',
          'Grade 12': 'grade_12',
        };
        
        const gradeClasses = classes.filter(c => {
          const classGradeDb = gradeToDbFormat[c.grade_level?.grade] || c.grade_level?.grade;
          return classGradeDb === gradeLevel;
        }) || [];
        
        group.availableClasses = gradeClasses.map(cls => ({
          id: cls.id,
          class_name: cls.class_name,
          current_enrollment: cls.current_enrollment,
          max_capacity: cls.max_capacity,
          available_spots: cls.max_capacity - (cls.current_enrollment || 0)
        })).filter(cls => cls.available_spots > 0);
      }

      return Object.values(gradeGroups).filter(group => group.students.length > 0);
    }
  });

  const assignStudentsMutation = useMutation({
    mutationFn: async (assignments: Record<string, string>) => {
      const promises = Object.entries(assignments).map(([studentId, classId]) => {
        return apiClient.updateStudent(studentId, { class_id: classId });
      });
      
      const results = await Promise.all(promises);
      const failed = results.filter(r => r.error);

      if (failed.length > 0) {
        throw new Error(`Failed to assign ${failed.length} students.`);
      }

      return results.length;
    },
    onSuccess: (assignedCount) => {
      queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
      
      toast({
        title: "Students Assigned",
        description: `Successfully assigned ${assignedCount} students to classes`,
      });
      
      setSelectedAssignments({});
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to assign students: " + error.message,
        variant: "destructive",
      });
    }
  });

  const formatGradeLevel = (grade: string) => {
    const gradeMap: Record<string, string> = {
      'pre_k': 'PRE KG',
      'kg': 'KG',
      'prep': 'PREP',
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
    return gradeMap[grade] || grade;
  };

  const handleAutoAssign = (group: GradeClassGroup) => {
    const assignments = { ...selectedAssignments };
    let studentIndex = 0;

    // Distribute students across available classes
    for (const student of group.students) {
      if (group.availableClasses.length === 0) break;
      
      const classIndex = studentIndex % group.availableClasses.length;
      const selectedClass = group.availableClasses[classIndex];
      
      if (selectedClass.available_spots > 0) {
        assignments[student.student_id] = selectedClass.id;
        selectedClass.available_spots--;
      }
      
      studentIndex++;
    }

    setSelectedAssignments(assignments);
  };

  const handleAssignAll = async () => {
    if (Object.keys(selectedAssignments).length === 0) {
      toast({
        title: "No Assignments",
        description: "Please select classes for students first",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);
    await assignStudentsMutation.mutateAsync(selectedAssignments);
    setIsAssigning(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">Loading unassigned students...</div>
        </CardContent>
      </Card>
    );
  }

  if (!gradeGroups || gradeGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            All students are assigned to classes
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Assign Students to Classes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {gradeGroups.map((group) => (
            <div key={group.gradeLevel} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium">{group.gradeName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {group.students.length} unassigned students
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {group.availableClasses.length > 0 ? (
                    <Button
                      onClick={() => handleAutoAssign(group)}
                      variant="outline"
                      size="sm"
                    >
                      Auto Assign
                    </Button>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      No Classes Available
                    </Badge>
                  )}
                </div>
              </div>

              {group.availableClasses.length > 0 && (
                <div className="space-y-2">
                  {group.students.map((student) => (
                    <div key={student.student_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{student.first_name} {student.last_name}</span>
                        <Badge variant="outline">{student.student_id}</Badge>
                      </div>
                      <Select
                        value={selectedAssignments[student.student_id] || ''}
                        onValueChange={(value) => {
                          setSelectedAssignments(prev => ({
                            ...prev,
                            [student.student_id]: value
                          }));
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {group.availableClasses.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.class_name} ({cls.available_spots} spots)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {Object.keys(selectedAssignments).length > 0 && (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="font-medium">Ready to assign {Object.keys(selectedAssignments).length} students</p>
                <p className="text-sm text-muted-foreground">
                  This will update their class assignments
                </p>
              </div>
              <Button
                onClick={handleAssignAll}
                disabled={isAssigning}
              >
                {isAssigning ? 'Assigning...' : 'Assign All'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};