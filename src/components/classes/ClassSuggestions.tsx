import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';

type GradeLevel = Database['public']['Enums']['grade_level'];

interface ClassSuggestion {
  gradeLevel: string;
  gradeName: string;
  suggestedClasses: string[];
  currentCount: number;
  missingClasses: string[];
}

export const ClassSuggestions = () => {
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['class-suggestions'],
    queryFn: async () => {
      // Get all students grouped by grade level
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('grade_level, class_id, classes:class_id(class_name)')
        .eq('status', 'Active');

      if (studentsError) throw studentsError;

      // Get existing classes
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('*, grade_levels:grade_level_id(grade)');

      if (classesError) throw classesError;

      // Group students by grade level
      const gradeGroups: Record<string, any[]> = {};
      students?.forEach(student => {
        if (!gradeGroups[student.grade_level]) {
          gradeGroups[student.grade_level] = [];
        }
        gradeGroups[student.grade_level].push(student);
      });

      // Create suggestions for each grade level
      const suggestions: ClassSuggestion[] = [];
      
      for (const [gradeLevel, studentsInGrade] of Object.entries(gradeGroups)) {
        const gradeName = formatGradeLevel(gradeLevel);
        const studentsWithoutClasses = studentsInGrade.filter(s => !s.class_id);
        
        if (studentsWithoutClasses.length === 0) continue;

      // Get existing classes for this grade
      const existingClasses = classes?.filter(c => c.grade_levels?.grade === gradeLevel as GradeLevel) || [];
      const existingClassNames = existingClasses.map(c => c.class_name);

        // Generate suggested class names
        const suggestedClasses = [];
        const sections = ['A', 'B', 'C', 'D', 'E'];
        
        for (const section of sections) {
          const className = `${gradeName} - ${section}`;
          if (!existingClassNames.includes(className)) {
            suggestedClasses.push(className);
          }
        }

        suggestions.push({
          gradeLevel,
          gradeName,
          suggestedClasses: suggestedClasses.slice(0, Math.ceil(studentsWithoutClasses.length / 30)),
          currentCount: studentsWithoutClasses.length,
          missingClasses: suggestedClasses.slice(0, Math.ceil(studentsWithoutClasses.length / 30))
        });
      }

      return suggestions.filter(s => s.currentCount > 0);
    }
  });

  const createClassesMutation = useMutation({
    mutationFn: async (suggestion: ClassSuggestion) => {
      // Get grade level ID
      const { data: gradeLevel, error: gradeError } = await supabase
        .from('grade_levels')
        .select('id')
        .eq('grade', suggestion.gradeLevel as GradeLevel)
        .single();

      if (gradeError || !gradeLevel) {
        throw new Error(`Grade level ${suggestion.gradeLevel} not found`);
      }

      // Create classes
      const classesToCreate = suggestion.missingClasses.map(className => ({
        class_name: className,
        grade_level_id: gradeLevel.id,
        max_capacity: 30,
        current_enrollment: 0,
        academic_year: new Date().getFullYear().toString()
      }));

      const { error } = await supabase
        .from('classes')
        .insert(classesToCreate);

      if (error) throw error;

      return classesToCreate.length;
    },
    onSuccess: (createdCount, suggestion) => {
      queryClient.invalidateQueries({ queryKey: ['class-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
      
      toast({
        title: "Classes Created",
        description: `Created ${createdCount} classes for ${suggestion.gradeName}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create classes: " + error.message,
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

  const handleCreateClasses = async (suggestion: ClassSuggestion) => {
    setIsCreating(true);
    await createClassesMutation.mutateAsync(suggestion);
    setIsCreating(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">Loading class suggestions...</div>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            All students are properly assigned to classes
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Suggested Classes for Unassigned Students
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <div key={suggestion.gradeLevel} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="font-medium">{suggestion.gradeName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.currentCount} students without classes
                  </p>
                </div>
                <div className="flex gap-2">
                  {suggestion.suggestedClasses.map(className => (
                    <Badge key={className} variant="outline">
                      {className}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => handleCreateClasses(suggestion)}
                disabled={isCreating}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Classes
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};