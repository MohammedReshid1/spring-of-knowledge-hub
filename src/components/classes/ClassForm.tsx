import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useMemo } from 'react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { useAcademicYear, getAcademicYearString } from '@/hooks/useAcademicYear';

const classSchema = z.object({
  grade_level_id: z.string().min(1, 'Grade level is required'),
  section: z.string().min(1, 'Section is required'),
  max_capacity: z.number().min(1, 'Max capacity must be at least 1'),
  teacher_id: z.string().optional(),
});

type ClassFormData = z.infer<typeof classSchema>;

interface ClassFormProps {
  classData?: any;
  onSuccess: () => void;
}

export const ClassForm = ({ classData, onSuccess }: ClassFormProps) => {
  const { selectedBranch } = useBranch();
  const queryClient = useQueryClient();
  const academicYearQuery = useAcademicYear();
  const currentAcademicYear = getAcademicYearString(academicYearQuery);

  const form = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      grade_level_id: classData?.grade_level_id || '',
      section: classData?.class_name ? classData.class_name.split(' - ')[1] || 'A' : 'A',
      max_capacity: classData?.max_capacity || 25,
      teacher_id: classData?.teacher_id || undefined,
    },
  });

  // Fetch grade levels (branch-aware)
  const branchForQuery = selectedBranch === 'all' ? undefined : selectedBranch;
  const { data: gradelevels, isLoading: isLoadingGrades } = useQuery({
    queryKey: ['grade-levels', branchForQuery],
    queryFn: async () => {
      const { data, error } = await apiClient.getGradeLevelsByBranch(branchForQuery);
      if (error) {
        console.error('Error fetching grade levels:', error);
        throw new Error(error);
      }
      return data || [];
    },
    enabled: selectedBranch !== null,
  });

  // Fetch teachers from FastAPI backend
  const { data: teachers, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['teachers', selectedBranch],
    queryFn: async () => {
      const resp = await apiClient.getTeachers();
      if (resp.error) {
        throw new Error(resp.error);
      }
      return resp.data || [];
    },
    staleTime: 0,
    enabled: !!selectedBranch,
  });

  // Fetch existing classes to check for duplicates
  const { data: existingClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const resp = await apiClient.getClasses();
      if (resp.error) {
        throw new Error(resp.error);
      }
      return resp.data || [];
    },
    staleTime: 0
  });
  // Only include teachers for the current branch
  const teachersFiltered = useMemo(
    () => (teachers || []).filter(t => selectedBranch === 'all' || t.branch_id === selectedBranch),
    [teachers, selectedBranch]
  );

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
      // Handle fallback formats that might exist in database
      'Grade 1': 'GRADE 1',
      'Grade 2': 'GRADE 2',
      'Grade 3': 'GRADE 3',
      'Grade 4': 'GRADE 4',
      'Grade 5': 'GRADE 5',
      'Grade 6': 'GRADE 6',
      'Grade 7': 'GRADE 7',
      'Grade 8': 'GRADE 8',
      'Grade 9': 'GRADE 9',
      'Grade 10': 'GRADE 10',
      'Grade 11': 'GRADE 11',
      'Grade 12': 'GRADE 12',
    };
    
    const selectedGradeLevel = gradelevels?.find(g => g.id === gradeLevel);
    let gradeName = '';
    
    if (selectedGradeLevel) {
      gradeName = gradeMap[selectedGradeLevel.grade];
      if (!gradeName) {
        // Fallback: convert any format to uppercase GRADE format
        if (selectedGradeLevel.grade.toLowerCase().includes('grade')) {
          gradeName = selectedGradeLevel.grade.toUpperCase();
        } else {
          gradeName = selectedGradeLevel.grade.toUpperCase();
        }
      }
    }
    
    return `${gradeName} - ${section}`;
  };

  const checkForDuplicate = (className: string) => {
    if (!existingClasses) return false;
    
    // Filter classes by same branch, excluding current class being edited
    const duplicates = existingClasses.filter(cls => 
      cls.class_name === className &&
      (cls.branch_id === selectedBranch || (selectedBranch === 'all' && !cls.branch_id)) &&
      (!classData || cls.id !== classData.id) // Exclude current class when editing
    );
    
    return duplicates.length > 0;
  };

  const submitMutation = useMutation({
    mutationFn: async (data: ClassFormData) => {
      const class_name = generateClassName(data.grade_level_id, data.section);
      
      // Check for duplicate classes before creating
      if (!classData && checkForDuplicate(class_name)) {
        throw new Error(`Class "${class_name}" already exists in this branch.`);
      }
      
      const payload = {
        class_name,
        grade_level_id: data.grade_level_id,
        max_capacity: data.max_capacity,
        academic_year: currentAcademicYear, // Use centralized academic year
        teacher_id: data.teacher_id || null,
        branch_id: selectedBranch || null,
      };

      let error;
      if (classData) {
        ({ error } = await apiClient.updateClass(classData.id, payload));
      } else {
        ({ error } = await apiClient.createClass(payload));
      }
      if (error) throw new Error(error);
      // Optionally, update grade level max_capacity if needed (not required for basic class creation)
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Premium Class Information Section */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-lg">
              <svg className="h-5 w-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="bg-gradient-to-r from-cyan-800 to-blue-600 bg-clip-text text-transparent">
              Class Information
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="grade_level_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-semibold flex items-center gap-2">
                    <div className="p-1 bg-gradient-to-br from-indigo-100 to-purple-100 rounded">
                      <svg className="h-3 w-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    Grade Level *
                  </FormLabel>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger className="relative bg-white/70 border-indigo-200/50 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                          <SelectValue placeholder="Select grade level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white/95 backdrop-blur-sm border-indigo-200/50 rounded-lg shadow-xl">
                        {isLoadingGrades ? (
                          <SelectItem value="loading-grades" disabled className="text-indigo-600">
                            <div className="flex items-center gap-2">
                              <div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
                              Loading grades...
                            </div>
                          </SelectItem>
                        ) : gradelevels && gradelevels.length > 0 ? (
                          gradelevels.map((grade) => (
                            <SelectItem key={grade.id} value={grade.id} className="hover:bg-indigo-50 focus:bg-indigo-50 rounded-md">
                              {formatGradeLevel(grade.grade)}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-grades-found" disabled className="text-gray-500">No grade levels found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="section"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-semibold flex items-center gap-2">
                    <div className="p-1 bg-gradient-to-br from-cyan-100 to-blue-100 rounded">
                      <svg className="h-3 w-3 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    Section *
                  </FormLabel>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger className="relative bg-white/70 border-cyan-200/50 focus:border-cyan-400 focus:ring-cyan-400/20 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white/95 backdrop-blur-sm border-cyan-200/50 rounded-lg shadow-xl max-h-60">
                        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map((section) => (
                          <SelectItem key={section} value={section} className="hover:bg-cyan-50 focus:bg-cyan-50 rounded-md">
                            <div className="flex items-center gap-2">
                              <div className="p-1 bg-gradient-to-br from-cyan-100 to-blue-100 rounded text-xs font-bold text-cyan-600">
                                {section}
                              </div>
                              Section {section}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Premium Class Name Preview */}
        {form.watch('grade_level_id') && form.watch('section') && (
          <div className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
            !classData && checkForDuplicate(
              generateClassName(form.watch('grade_level_id'), form.watch('section'))
            )
              ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 shadow-red-100'
              : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-emerald-100'
          } shadow-lg`}>
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
              !classData && checkForDuplicate(
                generateClassName(form.watch('grade_level_id'), form.watch('section'))
              )
                ? 'from-red-400 to-rose-500'
                : 'from-emerald-400 to-teal-500'
            }`} />

            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg shadow-md bg-gradient-to-br ${
                  !classData && checkForDuplicate(
                    generateClassName(form.watch('grade_level_id'), form.watch('section'))
                  )
                    ? 'from-red-100 to-rose-100'
                    : 'from-emerald-100 to-teal-100'
                }`}>
                  {!classData && checkForDuplicate(
                    generateClassName(form.watch('grade_level_id'), form.watch('section'))
                  ) ? (
                    <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-800">Class Name Preview</h4>
                  <p className="text-sm text-gray-600">Generated class identifier</p>
                </div>
              </div>

              <div className={`p-4 rounded-xl shadow-inner bg-white/70 backdrop-blur-sm border ${
                !classData && checkForDuplicate(
                  generateClassName(form.watch('grade_level_id'), form.watch('section'))
                )
                  ? 'border-red-200'
                  : 'border-emerald-200'
              }`}>
                <p className={`text-2xl font-bold text-center tracking-wide ${
                  !classData && checkForDuplicate(
                    generateClassName(form.watch('grade_level_id'), form.watch('section'))
                  )
                    ? 'text-red-600'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent'
                }`}>
                  {generateClassName(form.watch('grade_level_id'), form.watch('section'))}
                </p>
              </div>

              {!classData && checkForDuplicate(
                generateClassName(form.watch('grade_level_id'), form.watch('section'))
              ) && (
                <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    This class already exists in this branch
                  </p>
                  <p className="text-xs text-red-600 mt-1">Please choose a different grade level or section combination</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Premium Capacity and Teacher Section */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg">
              <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="bg-gradient-to-r from-purple-800 to-indigo-600 bg-clip-text text-transparent">
              Capacity & Teacher Assignment
            </span>
          </h3>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="max_capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-semibold flex items-center gap-2">
                    <div className="p-1 bg-gradient-to-br from-amber-100 to-orange-100 rounded">
                      <svg className="h-3 w-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    Maximum Capacity *
                  </FormLabel>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="relative bg-white/70 border-amber-200/50 focus:border-amber-400 focus:ring-amber-400/20 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-center text-lg font-semibold"
                        placeholder="25"
                      />
                    </FormControl>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Recommended: 20-30 students per class
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="teacher_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-semibold flex items-center gap-2">
                    <div className="p-1 bg-gradient-to-br from-blue-100 to-indigo-100 rounded">
                      <svg className="h-3 w-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    Class Teacher (Optional)
                  </FormLabel>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <Select onValueChange={(value) => {
                      // Handle the special "no-teacher" case
                      if (value === "no-teacher-selected") {
                        field.onChange(undefined);
                      } else {
                        field.onChange(value);
                      }
                    }} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger className="relative bg-white/70 border-blue-200/50 focus:border-blue-400 focus:ring-blue-400/20 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                          <SelectValue placeholder="Select teacher" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white/95 backdrop-blur-sm border-blue-200/50 rounded-lg shadow-xl">
                        <SelectItem value="no-teacher-selected" className="hover:bg-gray-50 focus:bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-gray-100 rounded">
                              <svg className="h-3 w-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            No teacher assigned
                          </div>
                        </SelectItem>
                        {isLoadingTeachers ? (
                          <SelectItem value="loading-teachers" disabled className="text-blue-600">
                            <div className="flex items-center gap-2">
                              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                              Loading teachers...
                            </div>
                          </SelectItem>
                        ) : teachersFiltered.length > 0 ? (
                          teachersFiltered.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id} className="hover:bg-blue-50 focus:bg-blue-50 rounded-md">
                              <div className="flex items-center gap-2">
                                <div className="p-1 bg-gradient-to-br from-blue-100 to-indigo-100 rounded">
                                  <svg className="h-3 w-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                                {`${teacher.first_name} ${teacher.last_name}`}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-teachers-available" disabled className="text-gray-500">No teachers found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    You can assign subject teachers later
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Premium Submit Section */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200/50 rounded-2xl p-6 mt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h4 className="text-lg font-bold text-gray-900">
                {classData ? 'Update Class Information' : 'Create New Class'}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                {classData
                  ? 'Save all changes to the class configuration'
                  : 'Review all information and create the class'
                }
              </p>
            </div>
            <Button
              type="submit"
              disabled={
                submitMutation.isPending ||
                (!classData && checkForDuplicate(
                  generateClassName(form.watch('grade_level_id'), form.watch('section'))
                ))
              }
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 px-8 py-3 text-lg font-semibold min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Saving...
                </>
              ) : (
                <>
                  {classData ? (
                    <>
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Update Class
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Class
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};
