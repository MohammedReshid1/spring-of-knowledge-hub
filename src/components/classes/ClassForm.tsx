
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  const form = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      class_name: classData?.class_name || '',
      grade_level_id: classData?.grade_level_id || '',
      max_capacity: classData?.max_capacity || 25,
      teacher_id: classData?.teacher_id || '',
      academic_year: classData?.academic_year || new Date().getFullYear().toString(),
    },
  });

  const { data: gradelevels } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grade_levels')
        .select('*')
        .order('grade');
      if (error) throw error;
      return data;
    }
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'teacher')
        .order('full_name');
      if (error) throw error;
      return data;
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ClassFormData) => {
      const payload = {
        ...data,
        teacher_id: data.teacher_id || null,
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
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Class ${classData ? 'updated' : 'created'} successfully`,
      });
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
                <Input placeholder="e.g., Grade 1A" {...field} />
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
                  {gradelevels?.map((grade) => (
                    <SelectItem key={grade.id} value={grade.id}>
                      {grade.grade.replace('_', ' ').toUpperCase()}
                    </SelectItem>
                  ))}
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
                  {teachers?.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                    </SelectItem>
                  ))}
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
