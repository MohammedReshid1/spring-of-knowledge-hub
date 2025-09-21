import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Upload, Camera, BookOpen, Phone, Mail, GraduationCap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const teacherSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
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
  const [photoPreview, setPhotoPreview] = useState<string>(teacher?.photo_url || '');
  const [createAccount, setCreateAccount] = useState<boolean>(true);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(teacher?.subjects || []);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(() => {
    const cls = teacher?.classes || [];
    if (!Array.isArray(cls)) return [] as string[];
    // Normalize to id strings if classes are objects
    return cls.map((c: any) => (typeof c === 'string' ? c : (c?.id || c?._id || c?.class_id))).filter(Boolean);
  });

  const form = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      first_name: teacher?.first_name || '',
      last_name: teacher?.last_name || '',
      phone: teacher?.phone || '',
      email: teacher?.email || '',
      photo_url: teacher?.photo_url || '',
    },
  });

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        form.setValue('photo_url', result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove Supabase upload; using base64 photo in form

  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();

  // Load subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const resp = await apiClient.getSubjects();
      if (resp.error) throw new Error(resp.error);
      return resp.data || [];
    }
  });

  // Load classes (filtered by selected branch)
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', selectedBranch],
    queryFn: async () => {
      const resp = await apiClient.getClasses();
      if (resp.error) throw new Error(resp.error);
      const list = resp.data || [];
      return selectedBranch && selectedBranch !== 'all' ? list.filter((c: any) => c.branch_id === selectedBranch) : list;
    }
  });
  const submitMutation = useMutation({
    mutationFn: async (data: TeacherFormData) => {
      if (!selectedBranch || selectedBranch === 'all') {
        throw new Error('Please select a specific branch before creating a teacher');
      }
      const payload = {
        teacher_id: teacher?.teacher_id || `T${Date.now()}`,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        email: data.email || null,
        photo_url: data.photo_url || null,
        branch_id: selectedBranch || null,
        subjects: selectedSubjects,
        classes: selectedClasses,
      };
      let error;
      if (teacher) {
        ({ error } = await apiClient.updateTeacher(teacher.id, payload));
        if (!error) {
          // Reassign classes: unassign removed, assign new
          const prevClasses: string[] = (teacher.classes || []).map((c: any) => (typeof c === 'string' ? c : (c?.id || c?._id || c?.class_id))).filter(Boolean);
          const toUnassign = prevClasses.filter((id) => !selectedClasses.includes(id));
          const toAssign = selectedClasses.filter((id) => !prevClasses.includes(id));
          if (toUnassign.length > 0) {
            await Promise.all(toUnassign.map((cid) => apiClient.updateClass(cid, { teacher_id: null })));
          }
          if (toAssign.length > 0) {
            if (selectedSubjects.length === 0) {
              await Promise.all(toAssign.map((cid) => apiClient.updateClass(cid, { teacher_id: teacher.id })));
            } else {
              const ops: Promise<any>[] = [];
              toAssign.forEach((cid) => selectedSubjects.forEach((sid) => ops.push(apiClient.assignSubjectTeacher(cid, { subject_id: sid, teacher_id: teacher.id }))));
              await Promise.all(ops);
            }
          }
        }
      } else {
        const { data: created, error: createError } = await apiClient.createTeacher(payload);
        error = createError;
        // After creating the teacher, assign to selected classes at class level (authoritative)
        if (!error && created && selectedClasses.length > 0) {
          if (selectedSubjects.length === 0) {
            await Promise.all(selectedClasses.map((classId) => apiClient.updateClass(classId, { teacher_id: created.id })));
          } else {
            const ops: Promise<any>[] = [];
            selectedClasses.forEach((classId) => selectedSubjects.forEach((sid) => ops.push(apiClient.assignSubjectTeacher(classId, { subject_id: sid, teacher_id: created.id }))));
            await Promise.all(ops);
          }
        }
      }
      if (error) throw new Error(error);

      // Optionally create a linked user account for teacher
      if (!teacher && createAccount && data.email) {
        const resp = await apiClient.signUp({
          email: data.email,
          password: 'ChangeMe123!',
          full_name: `${data.first_name} ${data.last_name}`,
          role: 'teacher',
          branch_id: selectedBranch || undefined,
          phone: data.phone,
        });
        if (resp.error) {
          // If user exists, try updating role/branch quietly
          // This avoids failing the teacher creation if account already present
          console.warn('Teacher account creation warning:', resp.error);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Success", description: `Teacher ${teacher ? 'updated' : 'added'} successfully` });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
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

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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
            {teacher ? 'Edit Teacher' : 'Add New Teacher'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-sm font-semibold text-slate-700 tracking-wide">First Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-emerald-300/50 focus:border-emerald-500/60 focus:ring-emerald-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
                      placeholder="Enter first name"
                    />
                  </FormControl>
                  <FormMessage className="text-red-500 font-medium" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-sm font-semibold text-slate-700 tracking-wide">Last Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-emerald-300/50 focus:border-emerald-500/60 focus:ring-emerald-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
                      placeholder="Enter last name"
                    />
                  </FormControl>
                  <FormMessage className="text-red-500 font-medium" />
                </FormItem>
              )}
            />

            {/* Premium Photo Upload Section */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex flex-col items-center space-y-6 p-8 border border-white/30 rounded-xl bg-gradient-to-br from-white/60 to-white/40 backdrop-blur-sm">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Avatar className="relative h-28 w-28 ring-4 ring-white/50 group-hover:ring-emerald-300/50 transition-all duration-300 group-hover:scale-105">
                    <AvatarImage src={photoPreview} alt="Teacher photo" className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-100 via-teal-100 to-cyan-100 text-emerald-700 text-xl font-bold">
                      {form.watch('first_name') && form.watch('last_name')
                        ? getInitials(form.watch('first_name'), form.watch('last_name'))
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
                  Upload a professional photo (optional)
                </p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-sm font-semibold text-slate-700 tracking-wide">Phone Number *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <Phone className="h-5 w-5 text-teal-500" />
                      </div>
                      <Input
                        {...field}
                        placeholder="Enter phone number"
                        className="h-12 pl-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-teal-300/50 focus:border-teal-500/60 focus:ring-teal-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-500 font-medium" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-sm font-semibold text-slate-700 tracking-wide">Email Address *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <Mail className="h-5 w-5 text-cyan-500" />
                      </div>
                      <Input
                        {...field}
                        type="email"
                        placeholder="Enter email address"
                        className="h-12 pl-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-cyan-300/50 focus:border-cyan-500/60 focus:ring-cyan-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-500 font-medium" />
                </FormItem>
              )}
            />

            {/* Premium Subject Specializations */}
            <div className="space-y-4">
              <FormLabel className="text-sm font-semibold text-slate-700 tracking-wide flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                Subjects Taught
              </FormLabel>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-cyan-500/5 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3 p-6 border border-white/40 rounded-xl bg-gradient-to-br from-white/60 to-white/40 backdrop-blur-sm">
                  {(subjects as any[]).map((s) => (
                    <label key={s.id} className="group/subject flex items-center gap-3 p-3 rounded-lg bg-white/60 hover:bg-gradient-to-r hover:from-emerald-50/80 hover:to-teal-50/80 border border-white/30 hover:border-emerald-200/50 transition-all duration-300 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 focus:ring-4 transition-all duration-200"
                        checked={selectedSubjects.includes(s.id)}
                        onChange={(e) => {
                          setSelectedSubjects((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                          );
                        }}
                      />
                      <span className="text-sm font-medium text-slate-700 group-hover/subject:text-emerald-700 transition-colors duration-200">
                        {s.subject_name} <span className="text-slate-500">({s.subject_code})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Premium Class Assignments */}
            <div className="space-y-4">
              <FormLabel className="text-sm font-semibold text-slate-700 tracking-wide flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-teal-600" />
                Assign Classes
              </FormLabel>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-cyan-500/5 to-blue-500/5 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative max-h-64 overflow-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-6 border border-white/40 rounded-xl bg-gradient-to-br from-white/60 to-white/40 backdrop-blur-sm">
                    {(classes as any[]).map((c) => (
                      <label key={c.id} className="group/class flex items-center gap-3 p-3 rounded-lg bg-white/60 hover:bg-gradient-to-r hover:from-teal-50/80 hover:to-cyan-50/80 border border-white/30 hover:border-teal-200/50 transition-all duration-300 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/20 focus:ring-4 transition-all duration-200"
                          checked={selectedClasses.includes(c.id)}
                          onChange={(e) => {
                            setSelectedClasses((prev) =>
                              e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                            );
                          }}
                        />
                        <span className="text-sm font-medium text-slate-700 group-hover/class:text-teal-700 transition-colors duration-200">
                          {c.class_name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium bg-gradient-to-r from-slate-50 to-white p-3 rounded-lg border border-slate-200">
                💡 Selected classes will grant this teacher attendance and exam access for those classes.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6">
              {/* Premium Create account toggle */}
              {!teacher && (
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 rounded-lg border border-blue-200/50">
                  <Switch
                    id="createAccount"
                    checked={createAccount}
                    onCheckedChange={setCreateAccount}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-indigo-500"
                  />
                  <Label htmlFor="createAccount" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Create login account for teacher
                  </Label>
                </div>
              )}
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
                      {teacher ? 'Update Teacher' : 'Add Teacher'}
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
