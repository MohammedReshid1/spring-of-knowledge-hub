import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';

type GradeLevel = Database['public']['Enums']['grade_level'];

interface MismatchedStudent {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  grade_level: GradeLevel;
  current_class_name: string;
  suggested_class_name: string;
  suggested_class_id: string | null;
}

export const GradeMismatchFixer = () => {
  const [isFixing, setIsFixing] = useState(false);
  const queryClient = useQueryClient();

  const { data: mismatchedStudents, isLoading } = useQuery({
    queryKey: ['grade-mismatches'],
    queryFn: async () => {
      // Get students with their current class assignments
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          student_id,
          grade_level,
          class_id,
          classes:class_id (
            id,
            class_name,
            grade_levels:grade_level_id (
              grade
            )
          )
        `)
        .eq('status', 'Active')
        .not('class_id', 'is', null);

      if (studentsError) throw studentsError;

      // Get all classes for finding correct assignments
      const { data: allClasses, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          class_name,
          grade_levels:grade_level_id (
            grade
          )
        `);

      if (classesError) throw classesError;

      const mismatches: MismatchedStudent[] = [];

      students?.forEach(student => {
        if (student.classes && student.classes.grade_levels) {
          const studentGrade = student.grade_level;
          const classGrade = student.classes.grade_levels.grade;
          
          // Check if there's a grade mismatch
          if (studentGrade !== classGrade) {
            // Find the correct class for this student's grade level
            const currentClassSection = student.classes.class_name.split(' - ')[1] || 'A';
            
            const gradeMap: Record<string, string> = {
              'pre_k': 'PRE-KG',
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
              'grade_12': 'GRADE 12',
            };

            const correctGradeName = gradeMap[studentGrade];
            const suggestedClassName = `${correctGradeName} - ${currentClassSection}`;
            
            // Find if the suggested class exists
            const suggestedClass = allClasses?.find(cls => 
              cls.class_name === suggestedClassName &&
              cls.grade_levels?.grade === studentGrade
            );

            mismatches.push({
              id: student.id,
              first_name: student.first_name,
              last_name: student.last_name,
              student_id: student.student_id,
              grade_level: studentGrade,
              current_class_name: student.classes.class_name,
              suggested_class_name: suggestedClassName,
              suggested_class_id: suggestedClass?.id || null
            });
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
            // Check if class exists by name (in case it was created by another process)
            const { data: existingClass } = await supabase
              .from('classes')
              .select('id')
              .eq('class_name', className)
              .single();

            if (existingClass) {
              classId = existingClass.id;
              classCache.set(className, classId);
            } else {
              // Get grade level ID for the first student in this class
              const { data: gradeLevel, error: gradeError } = await supabase
                .from('grade_levels')
                .select('id')
                .eq('grade', studentsForClass[0].grade_level)
                .single();

              if (gradeError || !gradeLevel) {
                console.error(`Grade level ${studentsForClass[0].grade_level} not found`);
                continue;
              }

              // Create the class
              const { data: newClass, error: createError } = await supabase
                .from('classes')
                .insert({
                  class_name: className,
                  grade_level_id: gradeLevel.id,
                  max_capacity: 30,
                  current_enrollment: 0,
                  academic_year: new Date().getFullYear().toString()
                })
                .select('id')
                .single();

              if (createError || !newClass) {
                console.error(`Failed to create class ${className}:`, createError);
                continue;
              }

              classId = newClass.id;
              classCache.set(className, classId);
              createdClasses++;
            }
          }
        }

        // Assign all students to this class
        for (const student of studentsForClass) {
          const { error: updateError } = await supabase
            .from('students')
            .update({ class_id: classId })
            .eq('id', student.id);

          if (!updateError) {
            fixedCount++;
          } else {
            console.error(`Failed to assign student ${student.student_id} to class ${className}:`, updateError);
          }
        }
      }

      return { fixedCount, createdClasses };
    },
    onSuccess: ({ fixedCount, createdClasses }) => {
      queryClient.invalidateQueries({ queryKey: ['grade-mismatches'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      
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
          <div className="text-center">Loading grade mismatches...</div>
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
    <Card>
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
              <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg">
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
          
          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
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