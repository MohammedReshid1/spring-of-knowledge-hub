import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBranch } from '@/contexts/BranchContext';

interface MismatchedStudent {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  grade_level: string;
  current_class_name: string;
  current_class_grade: string;
  suggested_class_name: string;
  suggested_class_id: string | null;
}

export const GradeMismatchFixer = () => {
  const [isFixing, setIsFixing] = useState(false);
  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();

  const { data: mismatchedStudents, isLoading } = useQuery({
    queryKey: ['grade-mismatches', selectedBranch],
    queryFn: async () => {
      // Get all students from FastAPI
      const studentsResponse = await apiClient.getAllStudents(selectedBranch);
      if (studentsResponse.error) throw new Error(studentsResponse.error);
      
      // Get all classes from FastAPI
      const classesResponse = await apiClient.getClasses();
      if (classesResponse.error) throw new Error(classesResponse.error);
      
      // Get all grade levels from FastAPI
      const gradeLevelsResponse = await apiClient.getGradeLevels();
      if (gradeLevelsResponse.error) throw new Error(gradeLevelsResponse.error);
      
      const students = studentsResponse.data || [];
      const classes = classesResponse.data || [];
      const gradeLevels = gradeLevelsResponse.data || [];
      
      // Filter by branch
      const filteredStudents = selectedBranch === 'all' 
        ? students 
        : students.filter(s => s.branch_id === selectedBranch);
        
      const filteredClasses = selectedBranch === 'all'
        ? classes
        : classes.filter(c => c.branch_id === selectedBranch);
      
      // Create a map of grade level IDs to grade names
      const gradeLevelMap = new Map(gradeLevels.map(g => [g.id, g.grade]));
      
      // Check for mismatches
      const mismatches: MismatchedStudent[] = [];
      
      filteredStudents.forEach(student => {
        if (student.class_id && student.status === 'Active') {
          // Find the student's current class
          const currentClass = filteredClasses.find(c => c.id === student.class_id);
          
          if (currentClass && currentClass.grade_level_id) {
            const classGrade = gradeLevelMap.get(currentClass.grade_level_id);
            
            // Check if there's a grade mismatch
            if (student.grade_level !== classGrade) {
              // Extract section from current class name
              const currentClassSection = currentClass.class_name.split(' - ')[1] || 'A';
              
              // Map the student grade level to the expected class name format
              // This should match the format used by BulkStudentImport.tsx (GRADE X format)
              const studentGradeToClassNameMap: Record<string, string> = {
                'KG': 'KG',
                'G1': 'GRADE 1', 
                'G2': 'GRADE 2',
                'G3': 'GRADE 3',
                'G4': 'GRADE 4',
                'G5': 'GRADE 5',
                'G6': 'GRADE 6',
                'G7': 'GRADE 7',
                'G8': 'GRADE 8',
                'G9': 'GRADE 9',
                'G10': 'GRADE 10',
                'G11': 'GRADE 11',
                'G12': 'GRADE 12',
                // Also handle full grade name format
                'pre_k': 'PRE KG',
                'kg': 'KG', 
                'prep': 'PREP',
                'grade_1': 'GRADE 1',
                'grade_2': 'GRADE 2',
                'grade_3': 'GRADE 3',
                'grade_4': 'GRADE 4',
                'grade_5': 'GRADE 5',
                'grade_6': 'GRADE 6',
                'grade_7': 'GRADE 7',
                'grade_8': 'GRADE 8',
                'grade_9': 'GRADE 9',
                'grade_10': 'GRADE 10',
                'grade_11': 'GRADE 11',
                'grade_12': 'GRADE 12'
              };
              
              const correctGradeName = studentGradeToClassNameMap[student.grade_level] || student.grade_level;
              const suggestedClassName = `${correctGradeName} - ${currentClassSection}`;
              
              // Only add to mismatches if the student is actually in the wrong class
              // Skip if the current class name already matches what it should be
              if (currentClass.class_name !== suggestedClassName) {
                // Find if the suggested class exists (should match both grade and class name)
                const suggestedClass = filteredClasses.find(cls => {
                  const clsGrade = gradeLevelMap.get(cls.grade_level_id);
                  const clsGradeFormatted = studentGradeToClassNameMap[clsGrade || ''] || clsGrade;
                  return cls.class_name === suggestedClassName && clsGradeFormatted === correctGradeName;
                });
                
                mismatches.push({
                  id: student.id,
                  first_name: student.first_name,
                  last_name: student.last_name,
                  student_id: student.student_id,
                  grade_level: student.grade_level,
                  current_class_name: currentClass.class_name,
                  current_class_grade: classGrade || 'Unknown',
                  suggested_class_name: suggestedClassName,
                  suggested_class_id: suggestedClass?.id || null
                });
              }
            }
          }
        }
      });
      
      return mismatches;
    }
  });

  const fixMismatchesMutation = useMutation({
    mutationFn: async (mismatches: MismatchedStudent[]) => {
      let fixedCount = 0;
      let createdClasses = 0;
      const classCache = new Map<string, string>(); // Cache for class names to IDs
      
      // Get grade levels for creating new classes
      const gradeLevelsResponse = await apiClient.getGradeLevels();
      if (gradeLevelsResponse.error) throw new Error(gradeLevelsResponse.error);
      const gradeLevels = gradeLevelsResponse.data || [];
      
      // Group students by suggested class name to avoid duplicates
      const studentsByClass = new Map<string, MismatchedStudent[]>();
      
      for (const student of mismatches) {
        const className = student.suggested_class_name;
        if (!studentsByClass.has(className)) {
          studentsByClass.set(className, []);
        }
        studentsByClass.get(className)!.push(student);
      }
      
      // Process each unique class
      for (const [className, studentsForClass] of studentsByClass) {
        let classId = studentsForClass[0].suggested_class_id;
        
        // If suggested class doesn't exist, check if we already created it or create it
        if (!classId) {
          // Check cache first
          if (classCache.has(className)) {
            classId = classCache.get(className)!;
          } else {
            // Check if class exists by fetching fresh class list
            const classesResponse = await apiClient.getClasses();
            if (classesResponse.error) throw new Error(classesResponse.error);
            
            const existingClass = (classesResponse.data || []).find(
              cls => cls.class_name === className && cls.branch_id === selectedBranch
            );
            
            if (existingClass) {
              classId = existingClass.id;
              classCache.set(className, classId);
            } else {
              // Find grade level ID for the first student in this class
              const gradeLevel = gradeLevels.find(
                g => g.grade === studentsForClass[0].grade_level
              );
              
              if (!gradeLevel) {
                console.error(`Grade level ${studentsForClass[0].grade_level} not found`);
                continue;
              }
              
              // Create the class
              const createResponse = await apiClient.createClass({
                class_name: className,
                grade_level_id: gradeLevel.id,
                max_capacity: 30,
                academic_year: new Date().getFullYear().toString(),
                branch_id: selectedBranch === 'all' ? null : selectedBranch
              });
              
              if (createResponse.error) {
                console.error(`Failed to create class ${className}:`, createResponse.error);
                continue;
              }
              
              if (createResponse.data) {
                classId = createResponse.data.id;
                classCache.set(className, classId);
                createdClasses++;
              }
            }
          }
        }
        
        // Assign all students to this class
        if (classId) {
          for (const student of studentsForClass) {
            const updateResponse = await apiClient.updateStudent(student.id, {
              class_id: classId
            });
            
            if (!updateResponse.error) {
              fixedCount++;
            } else {
              console.error(`Failed to assign student ${student.student_id} to class ${className}:`, updateResponse.error);
            }
          }
        }
      }
      
      return { fixedCount, createdClasses };
    },
    onSuccess: ({ fixedCount, createdClasses }) => {
      queryClient.invalidateQueries({ queryKey: ['grade-mismatches'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
      
      toast({
        title: "Grade Mismatches Fixed",
        description: `Fixed ${fixedCount} students and created ${createdClasses} new classes`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to fix grade mismatches: " + error.message,
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

  const handleFixAll = async () => {
    if (!mismatchedStudents || mismatchedStudents.length === 0) return;
    
    setIsFixing(true);
    await fixMismatchesMutation.mutateAsync(mismatchedStudents);
    setIsFixing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">Checking for grade mismatches...</div>
        </CardContent>
      </Card>
    );
  }

  if (!mismatchedStudents || mismatchedStudents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Grade Level Consistency Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            All students are assigned to classes matching their grade levels
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Grade Level Mismatches Found
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {mismatchedStudents.length} students are assigned to classes that don't match their grade levels
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="max-h-64 overflow-y-auto space-y-2">
            {mismatchedStudents.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{student.first_name} {student.last_name}</p>
                    <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
                  </div>
                  <Badge variant="outline">{formatGradeLevel(student.grade_level)}</Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-red-600">Currently: {student.current_class_name}</p>
                  <p className="text-sm text-green-600">Should be: {student.suggested_class_name}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between p-4 bg-orange-100 rounded-lg">
            <div>
              <p className="font-medium">Fix All Mismatches</p>
              <p className="text-sm text-muted-foreground">
                This will move students to classes matching their grade levels and create missing classes if needed
              </p>
            </div>
            <Button
              onClick={handleFixAll}
              disabled={isFixing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isFixing ? 'Fixing...' : `Fix All (${mismatchedStudents.length})`}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};