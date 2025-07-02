import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Upload, Camera } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const teacherSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Valid email is required').optional().or(z.literal('')),
  photo_url: z.string().optional(),
});

type TeacherFormData = z.infer<typeof teacherSchema>;

interface TeacherFormProps {
  teacher?: any;
  onSuccess: () => void;
}

export const TeacherForm = ({ teacher, onSuccess }: TeacherFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(teacher?.photo_url || '');

  const form = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      full_name: teacher?.full_name || '',
      phone: teacher?.phone || '',
      email: teacher?.email || '',
      photo_url: teacher?.photo_url || '',
    },
  });

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        form.setValue('photo_url', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `teacher_${Math.random()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('student-photos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('student-photos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const submitMutation = useMutation({
    mutationFn: async (data: TeacherFormData) => {
      let photoUrl = data.photo_url;

      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile);
      }

      const payload = {
        full_name: data.full_name,
        phone: data.phone,
        email: data.email || null,
        role: 'teacher' as const,
        photo_url: photoUrl || null,
      };

      if (teacher) {
        const { error } = await supabase
          .from('users')
          .update(payload)
          .eq('id', teacher.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('users')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Teacher ${teacher ? 'updated' : 'added'} successfully`,
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${teacher ? 'update' : 'add'} teacher: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: TeacherFormData) => {
    submitMutation.mutate(data);
  };

  const getInitials = (fullName: string) => {
    return fullName.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {teacher ? 'Edit Teacher' : 'Add New Teacher'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Photo Upload Section - Optional */}
            <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg bg-gray-50">
              <Avatar className="h-24 w-24">
                <AvatarImage src={photoPreview} alt="Teacher photo" />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {form.watch('full_name') 
                    ? getInitials(form.watch('full_name'))
                    : <Camera className="h-8 w-8" />
                  }
                </AvatarFallback>
              </Avatar>
              
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photo (Optional)
                    </span>
                  </Button>
                </label>
              </div>
              <p className="text-xs text-gray-500">Teacher photo is optional</p>
            </div>

            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter phone number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Optional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter email address (optional)" {...field} />
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
                {submitMutation.isPending ? 'Saving...' : (teacher ? 'Update Teacher' : 'Add Teacher')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};