import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const classSchema = z.object({
  class_name: z.string().min(1, 'Class name is required'),
  grade_level_id: z.string().min(1, 'Grade level is required'),
  max_capacity: z.number().min(1, 'Max capacity must be at least 1'),
  teacher_id: z.string().optional(),
  academic_year: z.string().min(1, 'Academic year is required'),
});

type ClassFormData = z.infer<typeof classSchema>;

interface ClassFormProps {
  classData?: any;
  onSuccess: () => void;
}

export const ClassForm = ({ classData, onSuccess }: ClassFormProps) => {
  const queryClient = useQueryClient();
  
  const form = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      class_name: classData?.class_name || '',
      grade_level_id: classData?.grade_level_id || '',
      max_capacity: classData?.max_capacity || 25,
      teacher_id: classData?.teacher_id || 'unassigned',
      academic_year: classData?.academic_year || new Date().getFullYear().toString(),
    },
  });

  // Fixed query to properly fetch grade levels
  const { data: gradelevels, isLoading: isLoadingGrades } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: async () => {
      console.log('Fetching grade levels...');
      const { data, error } = await supabase
        .from('grade_levels')
        .select('*')
        .order('grade');
      
      if (error) {
        console.error('Error fetching grade levels:', error);
        throw error;
      }
      
      console.log('Grade levels fetched:', data);
      return data;
    }
  });

  // Simplified teachers query to avoid RLS issues
  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      console.log('Fetching teachers...');
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'teacher')
        .order('full_name');
      
      if (error) {
        console.error('Error fetching teachers:', error);
        // Return empty array instead of throwing to prevent form from breaking
        return [];
      }
      
      console.log('Teachers fetched:', data?.length);
      return data || [];
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ClassFormData) => {
      const payload = {
        class_name: data.class_name,
        grade_level_id: data.grade_level_id,
        max_capacity: data.max_capacity,
        academic_year: data.academic_year,
        teacher_id: data.teacher_id === 'unassigned' ? null : data.teacher_id,
      };

      if (classData) {
        const { error } = await supabase
          .from('classes')
          .update(payload)
          .eq('id', classData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('classes')
          .insert([payload]);
        if (error) throw error;
      }

      // Update grade level capacity when creating/updating classes
      if (data.grade_level_id) {
        // Get current grade level data
        const { data: gradeLevel, error: gradeError } = await supabase
          .from('grade_levels')
          .select('max_capacity')
          .eq('id', data.grade_level_id)
          .single();

        if (!gradeError && gradeLevel) {
          // Update grade level max capacity to accommodate this class
          const newMaxCapacity = Math.max(gradeLevel.max_capacity, data.max_capacity);
          
          const { error: updateError } = await supabase
            .from('grade_levels')
            .update({ max_capacity: newMaxCapacity })
            .eq('id', data.grade_level_id);

          if (updateError) {
            console.error('Error updating grade level capacity:', updateError);
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
    onError: (error) => {
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
        <FormField
          control={form.control}
          name="class_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Class Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., KG - A, PREP - B" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="grade_level_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grade Level</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingGrades ? (
                    <SelectItem value="loading" disabled>Loading grades...</SelectItem>
                  ) : gradelevels && gradelevels.length > 0 ? (
                    gradelevels.map((grade) => (
                      <SelectItem key={grade.id} value={grade.id}>
                        {formatGradeLevel(grade.grade)}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-grades" disabled>No grade levels found</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="unassigned">No teacher assigned</SelectItem>
                  {teachers && teachers.length > 0 ? (
                    teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.full_name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-teachers" disabled>No teachers found</SelectItem>
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
