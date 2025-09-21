import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBranch } from '@/contexts/BranchContext';

interface ClassSuggestion {
  gradeLevel: string;
  gradeName: string;
  suggestedClasses: string[];
  currentCount: number;
  missingClasses: string[];
  hasAvailableSpace: boolean;
  existingClassesWithSpace: Array<{
    id: string;
    name: string;
    availableSpots: number;
  }>;
}

export const ClassSuggestions = () => {
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();

  // Query to fetch class suggestions
  const { data: suggestions, isLoading } = useQuery<ClassSuggestion[], Error>({
    queryKey: ['class-suggestions', selectedBranch],
    queryFn: async () => {
      const [studRes, clsRes, gradeLevelsRes] = await Promise.all([
        apiClient.getAllStudents(selectedBranch),
        apiClient.getClasses(),
        apiClient.getGradeLevels(),
      ]);
      if (studRes.error) throw new Error(studRes.error);
      if (clsRes.error) throw new Error(clsRes.error);
      if (gradeLevelsRes.error) throw new Error(gradeLevelsRes.error);
      
      const gradeLevels = gradeLevelsRes.data || [];
      console.log('ClassSuggestions - Grade levels fetched:', gradeLevels.length);
      
      // Filter by branch and active status
      const allStudents = (studRes.data || []).filter(s =>
        s.status === 'Active' && (selectedBranch === 'all' || s.branch_id === selectedBranch)
      );
      console.log('ClassSuggestions - Total active students in branch:', allStudents.length, 'Branch:', selectedBranch);
      
      // Enrich classes with grade level information
      const allClasses = (clsRes.data || [])
        .filter(c => selectedBranch === 'all' || c.branch_id === selectedBranch)
        .map(cls => {
          const gradeLevel = gradeLevels.find(gl => gl.id === cls.grade_level_id);
          console.log(`Class ${cls.class_name}: grade_level_id=${cls.grade_level_id}, found grade=${gradeLevel?.grade}`);
          return {
            ...cls,
            grade_level: gradeLevel ? { grade: gradeLevel.grade } : null
          };
        });
      // Group students by grade_level
      const gradeGroups: Record<string, any[]> = {};
      allStudents.forEach(s => {
        gradeGroups[s.grade_level] = gradeGroups[s.grade_level] || [];
        gradeGroups[s.grade_level].push(s);
      });
      const result: ClassSuggestion[] = [];
      for (const [gradeLevel, studentsInGrade] of Object.entries(gradeGroups)) {
        const studentsWithout = studentsInGrade.filter(s => !s.class_id);
        
        console.log(`ClassSuggestions - Grade ${gradeLevel}:`, {
          totalInGrade: studentsInGrade.length,
          withoutClass: studentsWithout.length,
          students: studentsWithout.map(s => ({
            name: `${s.first_name} ${s.last_name}`,
            id: s.student_id,
            class_id: s.class_id,
            branch_id: s.branch_id
          }))
        });
        
        if (studentsWithout.length === 0) continue;
        const gradeName = formatGradeLevel(gradeLevel);
        // existing class names for this grade
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
        
        // Find existing classes for this grade level
        const gradeClasses = allClasses.filter(c => {
          const classGradeDb = gradeToDbFormat[c.grade_level?.grade] || c.grade_level?.grade;
          const matches = classGradeDb === gradeLevel;
          console.log(`Class ${c.class_name}: grade="${c.grade_level?.grade}" -> db="${classGradeDb}" vs student="${gradeLevel}" = ${matches}`);
          return matches;
        });
        
        console.log(`Found ${gradeClasses.length} classes for grade ${gradeLevel}:`, gradeClasses.map(c => c.class_name));
        
        // Check for existing classes with available space
        const existingClassesWithSpace = gradeClasses.map(cls => {
          const availableSpots = cls.max_capacity - (cls.current_enrollment || 0);
          console.log(`Class ${cls.class_name}: ${cls.current_enrollment}/${cls.max_capacity} = ${availableSpots} available`);
          return {
            id: cls.id,
            name: cls.class_name,
            availableSpots
          };
        }).filter(cls => cls.availableSpots > 0);
        
        const totalAvailableSpots = existingClassesWithSpace.reduce((sum, cls) => sum + cls.availableSpots, 0);
        const hasAvailableSpace = totalAvailableSpots >= studentsWithout.length;
        
        console.log(`Grade ${gradeLevel}: ${studentsWithout.length} unassigned, ${totalAvailableSpots} available spots, hasSpace: ${hasAvailableSpace}`);
        
        const existingNames = gradeClasses.map(c => c.class_name);
        const sections = ['A', 'B', 'C', 'D', 'E'];
        const suggestionsArr: string[] = [];
        
        // Only suggest new classes if existing ones don't have enough space
        if (!hasAvailableSpace) {
          sections.forEach(sec => {
            const name = `${gradeName} - ${sec}`;
            if (!existingNames.includes(name)) suggestionsArr.push(name);
          });
        }
        
        const additionalStudents = Math.max(0, studentsWithout.length - totalAvailableSpots);
        const countNeeded = Math.ceil(additionalStudents / 30);
        
        result.push({
          gradeLevel,
          gradeName,
          suggestedClasses: suggestionsArr.slice(0, countNeeded),
          currentCount: studentsWithout.length,
          missingClasses: suggestionsArr.slice(0, countNeeded),
          hasAvailableSpace,
          existingClassesWithSpace,
        });
      }
      return result;
    },
  });

  // Mutation to create classes via backend API
  const createClassesMutation = useMutation({
    mutationFn: async (suggestion: ClassSuggestion) => {
      // Fetch grade levels to find matching ID
      const { data: gradeLevels, error: glError } = await apiClient.getGradeLevels();
      if (glError) throw new Error(glError);
      let gl = gradeLevels?.find(g => g.grade === suggestion.gradeLevel);
      // Fallback: try matching by formatted grade name
      if (!gl) {
        gl = gradeLevels?.find(g => formatGradeLevel(g.grade) === suggestion.gradeName);
      }
      if (!gl) throw new Error(`Grade level ${suggestion.gradeLevel} not found`);
      // Prepare class objects
      const classesToCreate = suggestion.missingClasses.map(name => ({
        class_name: name,
        grade_level_id: gl.id,
        max_capacity: 30,
        academic_year: new Date().getFullYear().toString(),
        branch_id: selectedBranch,
      }));
      // Call API to create each class and check for errors
      const responses = await Promise.all(classesToCreate.map(c => apiClient.createClass(c)));
      responses.forEach(res => {
        if (res.error) {
          throw new Error(res.error);
        }
      });
      return classesToCreate.length;
    },
    onSuccess: (createdCount, suggestion) => {
      queryClient.invalidateQueries({ queryKey: ['class-suggestions', selectedBranch] });
      queryClient.invalidateQueries({ queryKey: ['classes', selectedBranch] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats', selectedBranch] });
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
        <CardContent className="py-6 text-center">
          Loading class suggestions...
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
                  {suggestion.hasAvailableSpace && (
                    <p className="text-xs text-green-600">
                      {suggestion.existingClassesWithSpace.reduce((sum, cls) => sum + cls.availableSpots, 0)} spots available in existing classes
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {suggestion.hasAvailableSpace ? (
                    suggestion.existingClassesWithSpace.map(cls => (
                      <Badge key={cls.id} variant="secondary">
                        {cls.name} ({cls.availableSpots} spots)
                      </Badge>
                    ))
                  ) : (
                    suggestion.suggestedClasses.map(className => (
                      <Badge key={className} variant="outline">
                        {className}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              {suggestion.hasAvailableSpace ? (
                <div className="text-sm text-muted-foreground">
                  Use "Assign Students to Classes" below
                </div>
              ) : suggestion.suggestedClasses.length > 0 ? (
                <Button
                  onClick={() => handleCreateClasses(suggestion)}
                  disabled={isCreating}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Classes
                </Button>
              ) : (
                <div className="text-sm text-red-600">
                  All section letters used
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};