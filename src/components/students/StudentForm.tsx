import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, X, Save, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { StudentIdGenerator } from '@/utils/studentIdGenerator';

const formSchema = z.object({
  student_id: z.string().min(1, 'Student ID is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  father_name: z.string().optional(),
  grandfather_name: z.string().optional(),
  mother_name: z.string().optional(),
  date_of_birth: z.date({
    required_error: 'Date of birth is required',
  }),
  gender: z.enum(['Male', 'Female']).optional(),
  grade_level: z.enum([
    'pre_k', 'kg', 'prep', 'kindergarten', 'grade_1', 'grade_2', 'grade_3',
    'grade_4', 'grade_5', 'grade_6', 'grade_7', 'grade_8', 'grade_9',
    'grade_10', 'grade_11', 'grade_12'
  ]),
  class_id: z.string().optional(),
  phone: z.string().optional(),
  phone_secondary: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  medical_info: z.string().optional(),
  previous_school: z.string().optional(),
  admission_date: z.date().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface StudentFormProps {
  student?: any;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const StudentForm = ({ student, onSubmit, onCancel, isLoading }: StudentFormProps) => {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(student?.photo_url || null);
  const [birthCertFile, setBirthCertFile] = useState<File | null>(null);
  const [isGeneratingId, setIsGeneratingId] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_id: student?.student_id || '',
      first_name: student?.first_name || '',
      last_name: student?.last_name || '',
      father_name: student?.father_name || '',
      grandfather_name: student?.grandfather_name || '',
      mother_name: student?.mother_name || '',
      date_of_birth: student?.date_of_birth ? new Date(student.date_of_birth) : undefined,
      gender: student?.gender || undefined,
      grade_level: student?.grade_level || 'grade_1',
      class_id: student?.class_id || '',
      phone: student?.phone || '',
      phone_secondary: student?.phone_secondary || '',
      email: student?.email || '',
      address: student?.address || '',
      emergency_contact_name: student?.emergency_contact_name || '',
      emergency_contact_phone: student?.emergency_contact_phone || '',
      medical_info: student?.medical_info || '',
      previous_school: student?.previous_school || '',
      admission_date: student?.admission_date ? new Date(student.admission_date) : new Date(),
    },
  });

  const { data: gradeLevels } = useQuery({
    queryKey: ['gradeLevels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grade_levels')
        .select('*')
        .order('grade');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('class_name');
      
      if (error) throw error;
      return data;
    }
  });

  const generateNewStudentId = async () => {
    if (student) {
      toast({
        title: "Cannot regenerate ID",
        description: "Student ID cannot be changed for existing students.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingId(true);
    try {
      const newId = await StudentIdGenerator.generateStudentId();
      form.setValue('student_id', newId);
      
      toast({
        title: "Student ID Generated",
        description: `New student ID: ${newId}`,
      });
    } catch (error) {
      console.error('Error generating student ID:', error);
      toast({
        title: "Error",
        description: "Failed to generate student ID. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingId(false);
    }
  };

  // Auto-generate student ID for new students
  useEffect(() => {
    if (!student && !form.getValues('student_id')) {
      generateNewStudentId();
    }
  }, [student]);

  const handlePhotoRemove = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleBirthCertRemove = () => {
    setBirthCertFile(null);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File too large",
          description: "Photo must be smaller than 5MB",
          variant: "destructive"
        });
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBirthCertUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File too large",
          description: "Birth certificate must be smaller than 10MB",
          variant: "destructive"
        });
        return;
      }
      setBirthCertFile(file);
    }
  };

  const handleSubmit = async (data: FormData) => {
    try {
      let photoUrl = student?.photo_url;
      let birthCertUrl = student?.birth_certificate_url;

      // Upload photo if selected
      if (photoFile) {
        const photoPath = `${Date.now()}_${photoFile.name}`;
        const { error: photoError } = await supabase.storage
          .from('student-photos')
          .upload(photoPath, photoFile);

        if (photoError) throw photoError;

        const { data: photoData } = supabase.storage
          .from('student-photos')
          .getPublicUrl(photoPath);

        photoUrl = photoData.publicUrl;
      }

      // Upload birth certificate if selected
      if (birthCertFile) {
        const birthCertPath = `${Date.now()}_${birthCertFile.name}`;
        const { error: birthCertError } = await supabase.storage
          .from('birth-certificates')
          .upload(birthCertPath, birthCertFile);

        if (birthCertError) throw birthCertError;

        const { data: birthCertData } = supabase.storage
          .from('birth-certificates')
          .getPublicUrl(birthCertPath);

        birthCertUrl = birthCertData.publicUrl;
      }

      await onSubmit({
        ...data,
        photo_url: photoUrl,
        birth_certificate_url: birthCertUrl,
      } as any);
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "Failed to submit form. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          {student ? 'Edit Student' : 'Add New Student'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Student ID Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student_id">Student ID</Label>
              <div className="flex gap-2">
                <Input
                  id="student_id"
                  {...form.register('student_id')}
                  placeholder="SCH-2025-0001"
                  className="font-mono"
                  readOnly={!!student}
                />
                {!student && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateNewStudentId}
                    disabled={isGeneratingId}
                  >
                    {isGeneratingId ? 'Generating...' : 'Generate'}
                  </Button>
                )}
              </div>
              {form.formState.errors.student_id && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.student_id.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                {...form.register('first_name')}
                placeholder="Enter first name"
              />
              {form.formState.errors.first_name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.first_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                {...form.register('last_name')}
                placeholder="Enter last name"
              />
              {form.formState.errors.last_name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.last_name.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="father_name">Father's Name</Label>
              <Input
                id="father_name"
                {...form.register('father_name')}
                placeholder="Enter father's name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mother_name">Mother's Name</Label>
              <Input
                id="mother_name"
                {...form.register('mother_name')}
                placeholder="Enter mother's name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="grandfather_name">Grandfather's Name</Label>
              <Input
                id="grandfather_name"
                {...form.register('grandfather_name')}
                placeholder="Enter grandfather's name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={'outline'}
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.getValues('date_of_birth') && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.getValues('date_of_birth') ? (
                      format(form.getValues('date_of_birth') as Date, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.getValues('date_of_birth')}
                    onSelect={(date) => form.setValue('date_of_birth', date)}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.date_of_birth && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.date_of_birth.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select {...form.register('gender')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grade_level">Grade Level</Label>
              <Select {...form.register('grade_level')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {gradeLevels?.map((gradeLevel) => (
                    <SelectItem key={gradeLevel.id} value={gradeLevel.grade}>
                      {gradeLevel.grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="class_id">Class</Label>
              <Select {...form.register('class_id')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.class_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...form.register('phone')}
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_secondary">Secondary Phone</Label>
              <Input
                id="phone_secondary"
                {...form.register('phone_secondary')}
                placeholder="Enter secondary phone number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              {...form.register('email')}
              type="email"
              placeholder="Enter email address"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              {...form.register('address')}
              placeholder="Enter address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
              <Input
                id="emergency_contact_name"
                {...form.register('emergency_contact_name')}
                placeholder="Enter emergency contact name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
              <Input
                id="emergency_contact_phone"
                {...form.register('emergency_contact_phone')}
                placeholder="Enter emergency contact phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="medical_info">Medical Info</Label>
            <Textarea
              id="medical_info"
              {...form.register('medical_info')}
              placeholder="Enter medical information"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="previous_school">Previous School</Label>
            <Input
              id="previous_school"
              {...form.register('previous_school')}
              placeholder="Enter previous school"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admission_date">Admission Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !form.getValues('admission_date') && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.getValues('admission_date') ? (
                    format(form.getValues('admission_date') as Date, 'PPP')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.getValues('admission_date')}
                  onSelect={(date) => form.setValue('admission_date', date)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="photo">
                Student Photo
                {photoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handlePhotoRemove}
                    className="absolute top-2 right-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </Label>
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Student Photo"
                    className="rounded-md object-cover aspect-square w-32 h-32"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center w-32 h-32 rounded-md border-dashed border-2 border-gray-400 bg-gray-100">
                  <Label htmlFor="photo-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center justify-center">
                      <Upload className="h-5 w-5 text-gray-500" />
                      <p className="text-sm text-gray-500">Upload</p>
                    </div>
                  </Label>
                </div>
              )}
              <Input
                type="file"
                id="photo-upload"
                className="hidden"
                onChange={handlePhotoUpload}
                accept="image/*"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birth_certificate">
                Birth Certificate
                {birthCertFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleBirthCertRemove}
                    className="absolute top-2 right-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </Label>
              {birthCertFile ? (
                <div className="relative">
                  <p className="text-sm text-gray-500">
                    {birthCertFile.name}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full h-32 rounded-md border-dashed border-2 border-gray-400 bg-gray-100">
                  <Label htmlFor="birth-cert-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center justify-center">
                      <Upload className="h-5 w-5 text-gray-500" />
                      <p className="text-sm text-gray-500">Upload</p>
                    </div>
                  </Label>
                </div>
              )}
              <Input
                type="file"
                id="birth-cert-upload"
                className="hidden"
                onChange={handleBirthCertUpload}
                accept="application/pdf, image/*"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : student ? 'Update Student' : 'Add Student'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
