import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

// Supabase usage is deprecated. Use /api endpoints for all student form data fetching with the FastAPI backend.

type GradeLevel = 'pre_k' | 'kindergarten' | 'grade_1' | 'grade_2' | 'grade_3' | 'grade_4' | 'grade_5' | 'grade_6' | 'grade_7' | 'grade_8' | 'grade_9' | 'grade_10' | 'grade_11' | 'grade_12';

const studentSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  mother_name: z.string().min(1, 'Mother\'s name is required'),
  father_name: z.string().min(1, 'Father\'s name is required'),
  grandfather_name: z.string().min(1, 'Grandfather\'s name is required'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['Male', 'Female'], { required_error: 'Gender is required' }),
  grade_level: z.string().min(1, 'Grade level is required') as z.ZodType<GradeLevel>,
  class_id: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(1, 'Parent\'s/Guardian\'s phone number is required'),
  phone_secondary: z.string().optional(),
  address: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  medical_info: z.string().optional(),
  previous_school: z.string().min(1, 'Previous school is required'),
  photo_url: z.string().min(1, 'Student photo is required'),
  birth_certificate_url: z.string().optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;

interface StudentFormProps {
  student?: any;
  onSuccess: () => void;
}

const getToken = () => localStorage.getItem('token');

export const StudentForm = ({ student, onSuccess }: StudentFormProps) => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(student?.photo_url || '');
  const [birthCertFile, setBirthCertFile] = useState<File | null>(null);

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      first_name: student?.first_name || '',
      mother_name: student?.mother_name || '',
      father_name: student?.father_name || '',
      grandfather_name: student?.grandfather_name || '',
      date_of_birth: student?.date_of_birth || '',
      gender: student?.gender || undefined,
      grade_level: student?.grade_level || '',
      class_id: student?.class_id || '',
      email: student?.email || '',
      phone: student?.phone || '',
      phone_secondary: student?.phone_secondary || '',
      address: student?.address || '',
      emergency_contact_name: student?.emergency_contact_name || '',
      emergency_contact_phone: student?.emergency_contact_phone || '',
      medical_info: student?.medical_info || '',
      previous_school: student?.previous_school || '',
      photo_url: student?.photo_url || '',
      birth_certificate_url: student?.birth_certificate_url || '',
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
        form.setValue('photo_url', result); // Set the form value to satisfy validation
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBirthCertChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBirthCertFile(file);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      const token = getToken();
      let photoUrl = data.photo_url;
      let birthCertUrl = data.birth_certificate_url;

      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/upload/photo`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to upload photo');
        }
        const { url } = await res.json();
        photoUrl = url;
      }

      if (birthCertFile) {
        const formData = new FormData();
        formData.append('file', birthCertFile);
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/upload/birth-certificate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to upload birth certificate');
        }
        const { url } = await res.json();
        birthCertUrl = url;
      }

      const payload = {
        first_name: data.first_name,
        last_name: '', // Remove last name as requested
        mother_name: data.mother_name || null,
        father_name: data.father_name || null,
        grandfather_name: data.grandfather_name || null,
        date_of_birth: data.date_of_birth,
        grade_level: data.grade_level as GradeLevel,
        gender: data.gender || null,
        email: data.email || null,
        phone: data.phone || null,
        phone_secondary: data.phone_secondary || null,
        address: data.address || null,
        emergency_contact_name: data.emergency_contact_name || null,
        emergency_contact_phone: data.emergency_contact_phone || null,
        medical_info: data.medical_info || null,
        previous_school: data.previous_school || null,
        class_id: data.class_id || null,
        photo_url: photoUrl || null,
        birth_certificate_url: birthCertUrl || null,
      };

      if (student) {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/students/${student.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to update student');
        }
      } else {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/students`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Failed to create student');
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Student ${student ? 'updated' : 'added'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to ${student ? 'update' : 'add'} student: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: StudentFormData) => {
    if (!photoPreview && !student?.photo_url) {
      toast({
        title: "Error",
        description: "Student photo is required",
        variant: "destructive",
      });
      return;
    }
    
    // Check if birth certificate is required
    if (!birthCertFile && !student?.birth_certificate_url) {
      toast({
        title: "Error",
        description: "Birth certificate is required for all students",
        variant: "destructive",
      });
      return;
    }
    
    submitMutation.mutate(data);
  };

  const gradeOptions: { value: GradeLevel; label: string }[] = [
    { value: 'pre_k', label: 'Pre-K' },
    { value: 'kindergarten', label: 'Kindergarten' },
    { value: 'grade_1', label: 'Grade 1' },
    { value: 'grade_2', label: 'Grade 2' },
    { value: 'grade_3', label: 'Grade 3' },
    { value: 'grade_4', label: 'Grade 4' },
    { value: 'grade_5', label: 'Grade 5' },
    { value: 'grade_6', label: 'Grade 6' },
    { value: 'grade_7', label: 'Grade 7' },
    { value: 'grade_8', label: 'Grade 8' },
    { value: 'grade_9', label: 'Grade 9' },
    { value: 'grade_10', label: 'Grade 10' },
    { value: 'grade_11', label: 'Grade 11' },
    { value: 'grade_12', label: 'Grade 12' },
  ];

  const selectedGrade = form.watch('grade_level');
  const availableClasses = [
    { id: 'class-1', class_name: 'Class A' },
    { id: 'class-2', class_name: 'Class B' },
    { id: 'class-3', class_name: 'Class C' },
  ]; // This data is now fetched via FastAPI

  const getInitials = (firstName: string) => {
    return firstName.charAt(0).toUpperCase();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Photo Upload Section - Required */}
        <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg bg-gray-50">
          <Avatar className="h-24 w-24">
            <AvatarImage src={photoPreview} alt="Student photo" />
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {form.watch('first_name') 
                ? getInitials(form.watch('first_name'))
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
              required={!student?.photo_url}
            />
            <label htmlFor="photo-upload">
              <Button type="button" variant="outline" size="sm" asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo *
                </span>
              </Button>
            </label>
          </div>
          <p className="text-xs text-gray-500">Student photo is required</p>
        </div>

        {/* Birth Certificate Upload Section - Required */}
        <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg bg-red-50">
          <div className="text-center">
            <h3 className="font-semibold text-red-800 mb-2">Birth Certificate (Required)</h3>
            <div className="flex items-center justify-center space-x-2">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleBirthCertChange}
                className="hidden"
                id="birth-cert-upload"
                required={!student?.birth_certificate_url}
              />
              <label htmlFor="birth-cert-upload">
                <Button type="button" variant="outline" size="sm" asChild className="border-red-300 text-red-700 hover:bg-red-100">
                  <span className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    {student?.birth_certificate_url ? 'Replace' : 'Upload'} Birth Certificate *
                  </span>
                </Button>
              </label>
            </div>
            {birthCertFile && (
              <p className="text-sm text-green-600 mt-2">
                Birth certificate selected: {birthCertFile.name}
              </p>
            )}
            {student?.birth_certificate_url && !birthCertFile && (
              <p className="text-sm text-green-600 mt-2">
                Birth certificate already uploaded
              </p>
            )}
            <p className="text-xs text-red-600 mt-2">* Birth certificate is required for all students</p>
          </div>
        </div>

        {/* First Name - Required */}
        <FormField
          control={form.control}
          name="first_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Family Names - All Required */}
        <div className="grid grid-cols-1 gap-4">
          <FormField
            control={form.control}
            name="mother_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mother's Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="father_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Father's Name *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="grandfather_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grandfather's Name *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date_of_birth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="grade_level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grade Level *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {gradeOptions.map((grade) => (
                      <SelectItem key={grade.value} value={grade.value}>
                        {grade.label}
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
            name="class_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.class_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
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
                <FormLabel>Parent's/Guardian's Phone Number *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="phone_secondary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Secondary Phone Number (Optional)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="emergency_contact_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emergency Contact Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="emergency_contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emergency Contact Phone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="medical_info"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Medical Information</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="previous_school"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Previous School *</FormLabel>
              <FormControl>
                <Input {...field} />
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
            {submitMutation.isPending ? 'Saving...' : (student ? 'Update Student' : 'Add Student')}
          </Button>
        </div>
      </form>
    </Form>
  );
};