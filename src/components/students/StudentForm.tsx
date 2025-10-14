import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Upload, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
// Removed GradeLevel import; using string for grade_level
import { useQueryClient } from '@tanstack/react-query';
import { useBranch } from '@/contexts/BranchContext';

// Schema for creating a new student (all required except optional fields)
const studentSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  mother_name: z.string().min(1, 'Mother\'s name is required'),
  father_name: z.string().min(1, 'Father\'s name is required'),
  grandfather_name: z.string().min(1, 'Grandfather\'s name is required'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['Male', 'Female'], { required_error: 'Gender is required' }),
  grade_level: z.string().min(1, 'Grade level is required'),
  class_id: z.string().optional(),
  parent_guardian_id: z.string().optional(),
  status: z.enum(['Active', 'Graduated', 'Transferred Out', 'Dropped Out', 'On Leave'], { required_error: 'Status is required' }),
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
  id_card_url: z.string().optional(),
  previous_report_card_url: z.string().optional(),
  immunization_record_url: z.string().optional(),
  health_policy_url: z.string().optional(),
  other_document_url: z.string().optional(),
});
// Schema for updating an existing student (all fields optional and nullable)
const studentUpdateSchema = studentSchema.partial().extend({
  first_name: z.string().min(1).optional().nullable(),
  mother_name: z.string().optional().nullable(),
  father_name: z.string().optional().nullable(),
  grandfather_name: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(['Male', 'Female']).optional().nullable(),
  grade_level: z.string().optional().nullable(),
  class_id: z.string().optional().nullable(),
  parent_guardian_id: z.string().optional().nullable(),
  status: z.enum(['Active', 'Graduated', 'Transferred Out', 'Dropped Out', 'On Leave']).optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  phone_secondary: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  medical_info: z.string().optional().nullable(),
  previous_school: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  birth_certificate_url: z.string().optional().nullable(),
  id_card_url: z.string().optional().nullable(),
  previous_report_card_url: z.string().optional().nullable(),
  immunization_record_url: z.string().optional().nullable(),
  health_policy_url: z.string().optional().nullable(),
  other_document_url: z.string().optional().nullable(),
});

type StudentFormData = z.infer<typeof studentSchema>;

interface StudentFormProps {
  student?: any;
  onSuccess: () => void;
}

export const StudentForm = ({ student, onSuccess }: StudentFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // isEditing is true if editing an existing student, false if creating new
  const isEditing = !!student && !!student.id;
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>(student?.photo_url || '');
  const [birthCertFile, setBirthCertFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [reportCardFile, setReportCardFile] = useState<File | null>(null);
  const [immunizationFile, setImmunizationFile] = useState<File | null>(null);
  const [healthPolicyFile, setHealthPolicyFile] = useState<File | null>(null);
  const [otherDocFile, setOtherDocFile] = useState<File | null>(null);

  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();

  // Build default form values: use student data when editing, fall back to blank for create
  const defaultValues = isEditing
    ? {
        first_name: student?.first_name,
        mother_name: student?.mother_name,
        father_name: student?.father_name,
        grandfather_name: student?.grandfather_name,
        date_of_birth: student?.date_of_birth,
        gender: student?.gender,
        grade_level: student?.grade_level,
        class_id: student?.class_id,
        parent_guardian_id: student?.parent_guardian_id,
        status: student?.status,
        email: student?.email,
        phone: student?.phone,
        phone_secondary: student?.phone_secondary,
        address: student?.address,
        emergency_contact_name: student?.emergency_contact_name,
        emergency_contact_phone: student?.emergency_contact_phone,
        medical_info: student?.medical_info,
        previous_school: student?.previous_school,
        photo_url: student?.photo_url,
        birth_certificate_url: student?.birth_certificate_url,
        id_card_url: (student as any)?.id_card_url,
        previous_report_card_url: (student as any)?.previous_report_card_url,
        immunization_record_url: (student as any)?.immunization_record_url,
        health_policy_url: (student as any)?.health_policy_url,
        other_document_url: (student as any)?.other_document_url,
      }
    : {
        first_name: '',
        mother_name: '',
        father_name: '',
        grandfather_name: '',
        date_of_birth: '',
        gender: undefined,
        grade_level: '',
        class_id: '',
        parent_guardian_id: '',
        status: 'Active',
        email: '',
        phone: '',
        phone_secondary: '',
        address: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        medical_info: '',
        previous_school: '',
        photo_url: '',
        birth_certificate_url: '',
        id_card_url: '',
        previous_report_card_url: '',
        immunization_record_url: '',
        health_policy_url: '',
        other_document_url: '',
      };
  const form = useForm<any>({
    resolver: zodResolver(isEditing ? studentUpdateSchema : studentSchema),
    defaultValues,
  });

  const { data: gradelevels, isLoading: isLoadingGrades } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: async () => {
      const { data, error } = await apiClient.getGradeLevels();
      if (error) throw new Error(error as string);
      return data || [];
    }
  });

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const resp = await apiClient.getClasses();
      if (resp.error) throw new Error(resp.error as string);
      return resp.data || [];
    }
  });

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        (form.setValue as any)('photo_url', result); // Set the form value to satisfy validation
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBirthCertChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBirthCertFile(file);
      const reader = new FileReader();
      reader.onloadend = () => (form.setValue as any)('birth_certificate_url', reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleIdCardChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIdCardFile(file);
      const reader = new FileReader();
      reader.onloadend = () => (form.setValue as any)('id_card_url', reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleReportCardChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setReportCardFile(file);
      const reader = new FileReader();
      reader.onloadend = () => (form.setValue as any)('previous_report_card_url', reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleImmunizationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImmunizationFile(file);
      const reader = new FileReader();
      reader.onloadend = () => (form.setValue as any)('immunization_record_url', reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleHealthPolicyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setHealthPolicyFile(file);
      const reader = new FileReader();
      reader.onloadend = () => (form.setValue as any)('health_policy_url', reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleOtherDocChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setOtherDocFile(file);
      const reader = new FileReader();
      reader.onloadend = () => (form.setValue as any)('other_document_url', reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Generate sequential SKA student ID: SKA<4-digit>-<year>
  const generateStudentId = async (): Promise<string> => {
    const resp = await apiClient.getStudents();
    // Handle new pagination structure: { items: [...], total: number, ... }
    const students: any[] = resp.data?.items || [];
    const year = new Date().getFullYear().toString();
    const regex = new RegExp(`^SCH-${year}-(\\d{5})$`);
    let max = 0;
    students.forEach(s => {
      const m = s.student_id.match(regex);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (num > max) max = num;
      }
    });
    // Generate a random 5-digit number between max+1 and 99999
    const min = max + 1;
    const maxNum = 99999;
    const randomNum = Math.floor(Math.random() * (maxNum - min + 1)) + min;
    const next = randomNum.toString().padStart(5, '0');
    return `SCH-${year}-${next}`;
  };
  // Track generated ID for display
  const [generatedId, setGeneratedId] = useState<string>('');
  useEffect(() => {
    if (!student) {
      generateStudentId()
        .then(id => setGeneratedId(id))
        .catch(err => console.error('Error generating student ID:', err));
    }
  }, [student]);
  
  const submitMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      // Build payload directly from form data, including all document URLs
      const payload = {
        first_name: data.first_name,
        last_name: '',
        mother_name: data.mother_name || null,
        father_name: data.father_name || null,
        grandfather_name: data.grandfather_name || null,
        date_of_birth: data.date_of_birth,
        grade_level: data.grade_level,
        status: data.status,
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
        parent_guardian_id: data.parent_guardian_id === "auto-create" ? null : data.parent_guardian_id || null,
        photo_url: data.photo_url,
        birth_certificate_url: data.birth_certificate_url || null,
        id_card_url: data.id_card_url || null,
        previous_report_card_url: data.previous_report_card_url || null,
        immunization_record_url: data.immunization_record_url || null,
        health_policy_url: data.health_policy_url || null,
        other_document_url: data.other_document_url || null,
        branch_id: selectedBranch || undefined,
      };

      if (student) {
        // Include student_id for update, required by API
        const updatePayload = { ...payload, student_id: student.student_id };
        const updateRes = await apiClient.updateStudent(student.id, updatePayload);
        if (updateRes.error) throw new Error(updateRes.error);
      } else {
        const newId = await generateStudentId();
        const insertPayload = { ...payload, student_id: newId };
        const createRes = await apiClient.createStudent(insertPayload);
        if (createRes.error) throw new Error(createRes.error);
      }
    },
    onSuccess: () => {
      // Refresh student data and dashboard stats
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: "Success",
        description: `Student ${student ? 'updated' : 'added'} successfully`,
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${student ? 'update' : 'add'} student: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: StudentFormData) => {
    // Only require photo for new students, not when editing
    if (!isEditing && !photoPreview && !student?.photo_url) {
      toast({
        title: "Error",
        description: "Student photo is required",
        variant: "destructive",
      });
      return;
    }
    // Trigger mutation to create or update student
    submitMutation.mutate(data);
  };

  const gradeOptions: { value: string; label: string }[] = [
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

  // Use gradelevels to map grade string to grade_level_id
  // Show all classes from API
  const availableClasses = classes?.filter(cls => cls.branch_id === selectedBranch) || [];

  const getInitials = (firstName: string) => {
    return firstName.charAt(0).toUpperCase();
  };

  return (
    <Card className="backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-white/60 border border-white/30 shadow-premium overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] via-teal-500/[0.02] to-cyan-500/[0.02]" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-3 text-xl font-bold">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-lg" />
            <User className="relative h-6 w-6 text-emerald-600" />
          </div>
          <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
            {student ? 'Edit Student' : 'Add New Student'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Premium Student ID Section */}
        {!student && (
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200/50 rounded-xl p-6 backdrop-blur-sm">
              <FormItem className="space-y-3">
                <FormLabel className="text-sm font-semibold text-emerald-800 tracking-wide flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  Generated Student ID
                </FormLabel>
                <FormControl>
                  <Input
                    value={generatedId}
                    readOnly
                    className="h-12 bg-white/70 backdrop-blur-sm border-emerald-200 hover:border-emerald-300 text-emerald-900 font-mono text-lg text-center font-bold transition-all duration-300"
                  />
                </FormControl>
                <p className="text-xs text-emerald-600 font-medium mt-2">
                  🔐 This unique ID is automatically generated and cannot be changed
                </p>
              </FormItem>
            </div>
          </div>
        )}
        {/* Premium Photo Upload Section */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative flex flex-col items-center space-y-6 p-8 border border-white/30 rounded-xl bg-gradient-to-br from-white/60 to-white/40 backdrop-blur-sm">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Avatar className="relative h-28 w-28 ring-4 ring-white/50 group-hover:ring-emerald-300/50 transition-all duration-300 group-hover:scale-105">
                <AvatarImage src={photoPreview} alt="Student photo" className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-emerald-100 via-teal-100 to-cyan-100 text-emerald-700 text-xl font-bold">
                  {form.watch('first_name')
                    ? getInitials(form.watch('first_name'))
                    : <Camera className="h-10 w-10" />
                  }
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
                id="photo-upload"
                required={!isEditing}
              />
              <label htmlFor="photo-upload">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="group/btn relative overflow-hidden bg-gradient-to-r from-white/80 to-white/60 hover:from-emerald-50 hover:to-teal-50 border-white/40 hover:border-emerald-300/50 shadow-sm hover:shadow-glow-green transition-all duration-300 transform hover:scale-105"
                >
                  <span className="cursor-pointer flex items-center">
                    <Upload className="h-4 w-4 mr-2 text-emerald-600 group-hover/btn:rotate-12 transition-transform duration-300" />
                    <span className="text-slate-700 font-medium">Upload Photo</span>
                  </span>
                </Button>
              </label>
            </div>
            <p className="text-xs text-slate-500 font-medium text-center">
              Upload a clear photo {!isEditing && '(required)'}
            </p>
          </div>
        </div>

        {/* Premium Birth Certificate Upload Section */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-rose-500/5 to-pink-500/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative flex flex-col items-center space-y-4 p-6 border border-white/30 rounded-xl bg-gradient-to-br from-white/60 to-white/40 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-lg">
              <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Birth Certificate {!isEditing && <span className="text-red-600">*</span>}
            </div>

            <div className="flex items-center justify-center">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleBirthCertChange}
                className="hidden"
                id="birth-cert-upload"
                required={!isEditing}
              />
              <label htmlFor="birth-cert-upload">
                <Button
                  type="button"
                  variant="outline"
                  className="group/btn relative overflow-hidden bg-gradient-to-r from-white/80 to-white/60 hover:from-red-50 hover:to-rose-50 border-white/40 hover:border-red-300/50 shadow-sm hover:shadow-glow-red transition-all duration-300 transform hover:scale-105"
                >
                  <Upload className="h-4 w-4 mr-2 text-red-600 group-hover/btn:rotate-12 transition-transform duration-300" />
                  <span className="text-slate-700 font-medium">
                    {birthCertFile ? 'Change Document' : 'Upload Birth Certificate'}
                  </span>
                </Button>
              </label>
            </div>

            {birthCertFile && (
              <div className="bg-green-50/80 border border-green-200 rounded-lg p-3 backdrop-blur-sm w-full">
                <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="truncate">Document selected: {birthCertFile.name}</span>
                </p>
              </div>
            )}

            {student?.birth_certificate_url && !birthCertFile && (
              <div className="bg-green-50/80 border border-green-200 rounded-lg p-3 backdrop-blur-sm w-full">
                <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Birth certificate already uploaded
                </p>
              </div>
            )}

            {!isEditing && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 backdrop-blur-sm w-full">
                <p className="text-sm text-amber-800 font-medium">
                  📋 Birth certificate is required for student registration
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Accepted formats: PDF, JPG, PNG
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Premium Personal Information Section */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-cyan-500/5 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative bg-white/80 backdrop-blur-sm border border-white/30 rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg">
                <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="bg-gradient-to-r from-emerald-800 to-teal-600 bg-clip-text text-transparent">
                Personal Information
              </span>
            </h3>

            <div className="space-y-6">
              {/* First Name */}
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-sm font-semibold text-slate-700 tracking-wide">First Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter first name"
                        className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-emerald-300/50 focus:border-emerald-500/60 focus:ring-emerald-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
                      />
                    </FormControl>
                    <FormMessage className="text-red-500 font-medium" />
                  </FormItem>
                )}
              />

              {/* Family Names */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="mother_name"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-sm font-semibold text-slate-700 tracking-wide">Mother's Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter mother's name"
                          className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-emerald-300/50 focus:border-emerald-500/60 focus:ring-emerald-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
                        />
                      </FormControl>
                      <FormMessage className="text-red-500 font-medium" />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="father_name"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm font-semibold text-slate-700 tracking-wide">Father's Name *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter father's name"
                            className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-emerald-300/50 focus:border-emerald-500/60 focus:ring-emerald-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
                          />
                        </FormControl>
                        <FormMessage className="text-red-500 font-medium" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="grandfather_name"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-sm font-semibold text-slate-700 tracking-wide">Grandfather's Name *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter grandfather's name"
                            className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-emerald-300/50 focus:border-emerald-500/60 focus:ring-emerald-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
                          />
                        </FormControl>
                        <FormMessage className="text-red-500 font-medium" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
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
                <Select onValueChange={field.onChange} value={field.value || undefined}>
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
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingClasses || isLoadingGrades ? (
                      <SelectItem value="loading-classes" disabled>Loading classes...</SelectItem>
                    ) : availableClasses.length > 0 ? (
                      availableClasses.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.class_name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-classes" disabled>No classes found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Parent Selection */}
        <FormField
          control={form.control}
          name="parent_guardian_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parent/Guardian (Optional)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent/guardian or leave blank to auto-create" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="auto-create">Auto-create from contact info</SelectItem>
                  {/* TODO: Add parent options when parent management is fully implemented */}
                </SelectContent>
              </Select>
              <FormMessage />
              <p className="text-xs text-gray-500">
                Leave blank to automatically create parent account from phone/email info
              </p>
            </FormItem>
          )}
        />

        {/* Status selection */}
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || 'Active'}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Graduated">Graduated</SelectItem>
                  <SelectItem value="Transferred Out">Transferred Out</SelectItem>
                  <SelectItem value="Dropped Out">Dropped Out</SelectItem>
                  <SelectItem value="On Leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

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

        {/* Additional Document Upload Sections - Optional */}
        <div className="space-y-4">
          {/* ID Card Upload Section */}
          <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg bg-gray-50">
            <div className="text-center">
              <h3 className="font-semibold text-gray-800 mb-2">ID Card (Optional)</h3>
              <div className="flex items-center justify-center space-x-2">
                <Label htmlFor="id-card-upload" className="flex items-center gap-2 cursor-pointer text-emerald-600 hover:text-emerald-800">
                  <Upload className="h-4 w-4" />
                  <span>{idCardFile ? 'Change file' : 'Upload ID Card'}</span>
                </Label>
                <Input
                  id="id-card-upload"
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleIdCardChange}
                  required={!isEditing} // Only required for new students
                />
                {idCardFile && <span className="text-sm text-gray-500 ml-2">{idCardFile.name}</span>}
                {isEditing && student?.id_card_url && !idCardFile && (
                  <a href={student.id_card_url} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline ml-2">
                    View current ID Card
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Previous Report Card Upload Section */}
          <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg bg-gray-50">
            <div className="text-center">
              <h3 className="font-semibold text-gray-800 mb-2">Previous Report Card (Optional)</h3>
              <div className="flex items-center justify-center space-x-2">
                <Label htmlFor="report-card-upload" className="flex items-center gap-2 cursor-pointer text-emerald-600 hover:text-emerald-800">
                  <Upload className="h-4 w-4" />
                  <span>{reportCardFile ? 'Change file' : 'Upload Previous Report Card'}</span>
                </Label>
                <Input
                  id="report-card-upload"
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleReportCardChange}
                  required={!isEditing} // Only required for new students
                />
                {reportCardFile && <span className="text-sm text-gray-500 ml-2">{reportCardFile.name}</span>}
                {isEditing && student?.previous_report_card_url && !reportCardFile && (
                  <a href={student.previous_report_card_url} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline ml-2">
                    View current Report Card
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Immunization Record Upload Section */}
          <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg bg-gray-50">
            <div className="text-center">
              <h3 className="font-semibold text-gray-800 mb-2">Immunization Record (Optional)</h3>
              <div className="flex items-center justify-center space-x-2">
                <Label htmlFor="immunization-upload" className="flex items-center gap-2 cursor-pointer text-emerald-600 hover:text-emerald-800">
                  <Upload className="h-4 w-4" />
                  <span>{immunizationFile ? 'Change file' : 'Upload Immunization Record'}</span>
                </Label>
                <Input
                  id="immunization-upload"
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleImmunizationChange}
                  required={!isEditing} // Only required for new students
                />
                {immunizationFile && <span className="text-sm text-gray-500 ml-2">{immunizationFile.name}</span>}
                {isEditing && student?.immunization_record_url && !immunizationFile && (
                  <a href={student.immunization_record_url} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline ml-2">
                    View current Immunization Record
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Health Policy Upload Section */}
          <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg bg-gray-50">
            <div className="text-center">
              <h3 className="font-semibold text-gray-800 mb-2">Health Policy (Optional)</h3>
              <div className="flex items-center justify-center space-x-2">
                <Label htmlFor="health-policy-upload" className="flex items-center gap-2 cursor-pointer text-emerald-600 hover:text-emerald-800">
                  <Upload className="h-4 w-4" />
                  <span>{healthPolicyFile ? 'Change file' : 'Upload Health Policy'}</span>
                </Label>
                <Input
                  id="health-policy-upload"
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleHealthPolicyChange}
                  required={!isEditing} // Only required for new students
                />
                {healthPolicyFile && <span className="text-sm text-gray-500 ml-2">{healthPolicyFile.name}</span>}
                {isEditing && student?.health_policy_url && !healthPolicyFile && (
                  <a href={student.health_policy_url} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline ml-2">
                    View current Health Policy
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Other Document Upload Section */}
          <div className="flex flex-col items-center space-y-4 p-4 border rounded-lg bg-gray-50">
            <div className="text-center">
              <h3 className="font-semibold text-gray-800 mb-2">Other Document (Optional)</h3>
              <div className="flex items-center justify-center space-x-2">
                <Label htmlFor="other-doc-upload" className="flex items-center gap-2 cursor-pointer text-emerald-600 hover:text-emerald-800">
                  <Upload className="h-4 w-4" />
                  <span>{otherDocFile ? 'Change file' : 'Upload Other Document'}</span>
                </Label>
                <Input
                  id="other-doc-upload"
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleOtherDocChange}
                  // This is optional, so no required attribute
                />
                {otherDocFile && <span className="text-sm text-gray-500 ml-2">{otherDocFile.name}</span>}
                {isEditing && student?.other_document_url && !otherDocFile && (
                  <a href={student.other_document_url} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline ml-2">
                    View current document
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6">
          <Button
            type="submit"
            disabled={submitMutation.isPending}
            className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white shadow-premium hover:shadow-glow-green transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 px-8 py-3 font-semibold"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative flex items-center gap-2">
              {submitMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <User className="h-4 w-4" />
                  {student ? 'Update Student' : 'Add Student'}
                </>
              )}
            </span>
          </Button>
        </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};