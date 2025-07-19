
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

// Supabase usage is deprecated. Use /api endpoints for all class form data fetching with the FastAPI backend.

const classSchema = z.object({
  grade_level_id: z.string().min(1, 'Grade level is required'),
  section: z.string().min(1, 'Section is required'),
  max_capacity: z.number().min(1, 'Max capacity must be at least 1'),
  teacher_id: z.string().optional(),
  academic_year: z.string().min(1, 'Academic year is required'),
});

type ClassFormData = z.infer<typeof classSchema>;

interface ClassFormProps {
  classData?: any;
  onSuccess: () => void;
}

const getToken = () => localStorage.getItem('token');

export const ClassForm = ({ classData, onSuccess }: any) => {
  const queryClient = useQueryClient();
  
  const form = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      grade_level_id: classData?.grade_level_id || '',
      section: classData?.class_name ? classData.class_name.split(' - ')[1] || 'A' : 'A',
      max_capacity: classData?.max_capacity || 25,
      teacher_id: classData?.teacher_id || undefined,
      academic_year: classData?.academic_year || new Date().getFullYear().toString(),
    },
  });

  // Fixed query to properly fetch grade levels
  const { data: gradelevels, isLoading: isLoadingGrades } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: async () => {
      console.log('Fetching grade levels...');
      const res = await fetch('/api/grade-levels', {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to fetch grade levels');
      }
      const data = await res.json();
      console.log('Grade levels fetched:', data);
      return data;
    }
  });

  // Simplified teachers query to avoid RLS issues
  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      console.log('Fetching teachers...');
      const res = await fetch('/api/users/teachers', {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (!res.ok) {
        const err = await res.json();
        // Return empty array instead of throwing to prevent form from breaking
        return [];
      }
      const data = await res.json();
      console.log('Teachers fetched:', data?.length);
      return data || [];
    }
  });

  const generateClassName = (gradeLevel: string, section: string) => {
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
    
    const selectedGradeLevel = gradelevels?.find(g => g.id === gradeLevel);
    const gradeName = selectedGradeLevel ? gradeMap[selectedGradeLevel.grade] || selectedGradeLevel.grade : '';
    return `${gradeName} - ${section}`;
  };

  const submitMutation = useMutation({
    mutationFn: async (data: ClassFormData) => {
      const token = getToken();
      const class_name = generateClassName(data.grade_level_id, data.section);
      const payload = {
        class_name,
        grade_level_id: data.grade_level_id,
        max_capacity: data.max_capacity,
        academic_year: data.academic_year,
        teacher_id: data.teacher_id || null,
      };

      if (classData) {
        const res = await fetch(`/api/classes/${classData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to update class');
        }
      } else {
        const res = await fetch('/api/classes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to create class');
        }
      }

      // Update grade level capacity when creating/updating classes
      if (data.grade_level_id) {
        // Get current grade level data
        const res = await fetch(`/api/grade-levels/${data.grade_level_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          const err = await res.json();
          console.error('Error fetching grade level capacity:', err);
        } else {
          const gradeLevel = await res.json();
          if (gradeLevel) {
            // Update grade level max capacity to accommodate this class
            const newMaxCapacity = Math.max(gradeLevel.max_capacity, data.max_capacity);
            
            const updateRes = await fetch(`/api/grade-levels/${data.grade_level_id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ max_capacity: newMaxCapacity }),
            });

            if (!updateRes.ok) {
              const err = await updateRes.json();
              console.error('Error updating grade level capacity:', err);
            }
          }
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Class ${classData ? 'updated' : 'created'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to ${classData ? 'update' : 'create'} class: ${error.message}`,
        variant: "destructive",
      });
    }
  });

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

  const onSubmit = (data: ClassFormData) => {
    submitMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="grade_level_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grade Level</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingGrades ? (
                      <SelectItem value="loading-grades" disabled>Loading grades...</SelectItem>
                    ) : gradelevels && gradelevels.length > 0 ? (
                      gradelevels.map((grade) => (
                        <SelectItem key={grade.id} value={grade.id}>
                          {formatGradeLevel(grade.grade)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-grades-found" disabled>No grade levels found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="section"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Section</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map((section) => (
                      <SelectItem key={section} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {form.watch('grade_level_id') && form.watch('section') && (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">Class Name Preview:</p>
            <p className="text-lg font-semibold text-primary">
              {generateClassName(form.watch('grade_level_id'), form.watch('section'))}
            </p>
          </div>
        )}


        <FormField
          control={form.control}
          name="max_capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Capacity</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="teacher_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teacher (Optional)</FormLabel>
              <Select onValueChange={(value) => {
                // Handle the special "no-teacher" case
                if (value === "no-teacher-selected") {
                  field.onChange(undefined);
                } else {
                  field.onChange(value);
                }
              }} value={field.value || undefined}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="no-teacher-selected">No teacher assigned</SelectItem>
                  {teachers && teachers.length > 0 ? (
                    teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.full_name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-teachers-available" disabled>No teachers found</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="academic_year"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Academic Year</FormLabel>
              <FormControl>
                <Input placeholder="2024" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="submit"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Saving...' : (classData ? 'Update Class' : 'Create Class')}
          </Button>
        </div>
      </form>
    </Form>
  );
};
