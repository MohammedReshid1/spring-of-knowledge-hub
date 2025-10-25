import { useState, useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { apiClient } from '@/lib/api';
import { config } from '@/lib/config';
import { TokenStorage } from '@/utils/tokenStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Key,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Download,
  RefreshCw,
  Upload,
  Search,
  Filter,
  X
} from 'lucide-react';

// Form schema for bulk password reset
const bulkPasswordResetSchema = z.object({
  student_ids: z.array(z.string()).min(1, 'At least one student must be selected'),
  reset_reason: z.string().min(1, 'Reset reason is required'),
  notify_students: z.boolean().default(false),
  notify_parents: z.boolean().default(false),
  custom_message: z.string().optional(),
});

type BulkPasswordResetFormData = z.infer<typeof bulkPasswordResetSchema>;

// Type definitions
interface Student {
  id: string;
  student_id: string;
  first_name: string;
  father_name?: string;
  grandfather_name?: string;
  grade_level: string;
  email?: string;
  branch_id?: string;
  class_id?: string;
}

interface BulkResetResponse {
  success: boolean;
  message: string;
  data?: {
    total_processed: number;
    successful_resets: number;
    failed_resets: number;
    results: Array<{
      student_id: string;
      student_name: string;
      success: boolean;
      new_password?: string;
      error?: string;
    }>;
    summary_csv_url?: string;
  };
}

interface BulkStudentPasswordResetProps {
  onSuccess?: (data: BulkResetResponse) => void;
}

export function BulkStudentPasswordReset({ onSuccess }: BulkStudentPasswordResetProps) {
  const { selectedBranch } = useBranch();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const enableQueries = !!selectedBranch;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [resetResult, setResetResult] = useState<BulkResetResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  const form = useForm<BulkPasswordResetFormData>({
    resolver: zodResolver(bulkPasswordResetSchema),
    defaultValues: {
      student_ids: [],
      reset_reason: '',
      notify_students: false,
      notify_parents: false,
      custom_message: '',
    },
  });

  // Reset class filter when grade changes to 'all'
  useEffect(() => {
    if (selectedGrade === 'all') {
      setSelectedClass('all');
    }
  }, [selectedGrade]);

  // Fetch all students
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['all-students', branchId ?? 'all'],
    queryFn: () => apiClient.getAllStudents(),
    enabled: enableQueries,
    select: (resp) => (resp as any).data || (resp as any).items || [],
  });

  // Fetch grades for filtering
  const { data: gradesData } = useQuery({
    queryKey: ['grades', branchId ?? 'all'],
    queryFn: () => apiClient.getGrades({ branch_id: branchId }),
    enabled: enableQueries,
    select: (resp) => (resp as any).data || (resp as any).items || [],
  });

  // Fetch classes for filtering
  const { data: classesData } = useQuery({
    queryKey: ['classes', branchId ?? 'all', selectedGrade],
    queryFn: () => apiClient.getClasses({
      branch_id: branchId,
      grade_level: selectedGrade === 'all' ? undefined : selectedGrade
    }),
    enabled: enableQueries && selectedGrade !== 'all',
    select: (resp) => (resp as any).data || (resp as any).items || [],
  });

  // Bulk password reset mutation
  const bulkResetMutation = useMutation({
    mutationFn: async (data: BulkPasswordResetFormData) => {
      if (!branchId) {
        throw new Error('Please select a branch before resetting passwords');
      }

      const response = await fetch(`${config.API_BASE_URL}/admin/students/password-reset/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TokenStorage.getToken()}`,
        },
        body: JSON.stringify({
          student_ids: data.student_ids,
          branch_id: branchId,
          reset_reason: data.reset_reason,
          notify_students: data.notify_students,
          notify_parents: data.notify_parents,
          custom_message: data.custom_message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reset passwords');
      }

      return response.json() as Promise<BulkResetResponse>;
    },
    onSuccess: (data) => {
      setResetResult(data);
      setShowResults(true);
      toast({
        title: 'Bulk Password Reset Completed',
        description: `Successfully reset ${data.data?.successful_resets || 0} passwords`,
      });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast({
        title: 'Bulk Password Reset Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const formatStudentName = useCallback((student: Student) => {
    const parts = [student.first_name, student.father_name, student.grandfather_name].filter(Boolean);
    return parts.join(' ');
  }, []);

  // Filter students based on search and filters using useMemo to prevent infinite loops
  const filteredStudents = useMemo(() => {
    if (!studentsData) return [];

    return studentsData.filter((student: Student) => {
      const matchesSearch = !studentSearch ||
        formatStudentName(student).toLowerCase().includes(studentSearch.toLowerCase()) ||
        student.student_id.toLowerCase().includes(studentSearch.toLowerCase());

      const matchesGrade = selectedGrade === 'all' || student.grade_level === selectedGrade;
      const matchesClass = selectedClass === 'all' || student.class_id === selectedClass;

      return matchesSearch && matchesGrade && matchesClass;
    });
  }, [studentsData, studentSearch, selectedGrade, selectedClass, formatStudentName]);

  // Handle student selection
  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev => {
      const newSelection = prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId];

      form.setValue('student_ids', newSelection);
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    const allIds = filteredStudents.map(s => s.student_id); // Use student_id instead of MongoDB id
    setSelectedStudents(allIds);
    form.setValue('student_ids', allIds);
  };

  const handleDeselectAll = () => {
    setSelectedStudents([]);
    form.setValue('student_ids', []);
  };

  const handleSubmit = async (data: BulkPasswordResetFormData) => {
    await bulkResetMutation.mutateAsync(data);
  };

  const resetForm = () => {
    form.reset();
    setSelectedStudents([]);
    setResetResult(null);
    setShowResults(false);
    setStudentSearch('');
    setSelectedGrade('all');
    setSelectedClass('all');
  };

  const downloadResults = async () => {
    if (resetResult?.data?.summary_csv_url) {
      try {
        const response = await fetch(resetResult.data.summary_csv_url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `password-reset-results-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        toast({
          title: 'Download Failed',
          description: 'Failed to download results file',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.5s ease-out;
        }
      `}</style>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl animate-fadeInUp">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200/50">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            Bulk Student Password Reset
          </h2>
          <p className="text-slate-600 font-medium">
            Reset passwords for multiple students at once with detailed tracking and reporting
          </p>
        </div>
      </div>

      {!showResults ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Student Selection */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp">
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200/50">
                        <Users className="h-5 w-5 text-purple-600" />
                      </div>
                      Student Selection
                    </CardTitle>
                    <CardDescription>
                      Search, filter, and select students for password reset
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                      {selectedStudents.length} Selected
                    </Badge>
                    {selectedStudents.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDeselectAll}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {/* Search and Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name or ID..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {gradesData?.map((grade: any) => (
                        <SelectItem key={grade.id} value={grade.grade}>
                          {grade.grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                    disabled={selectedGrade === 'all'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classesData?.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selection Controls */}
                <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleSelectAll();
                        } else {
                          handleDeselectAll();
                        }
                      }}
                    />
                    <span className="text-sm font-medium text-purple-800">
                      Select all ({filteredStudents.length} students)
                    </span>
                  </div>
                  <div className="text-sm text-purple-600">
                    {selectedStudents.length} of {filteredStudents.length} selected
                  </div>
                </div>

                {/* Students Table */}
                <ScrollArea className="h-96 border rounded-lg">
                  <Table>
                    <TableHeader className="bg-purple-50">
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student: Student) => (
                        <TableRow
                          key={student.id}
                          className={`hover:bg-purple-50 cursor-pointer ${
                            selectedStudents.includes(student.student_id) ? 'bg-purple-100' : ''
                          }`}
                          onClick={() => handleStudentToggle(student.student_id)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedStudents.includes(student.student_id)}
                              onCheckedChange={() => handleStudentToggle(student.student_id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{student.student_id}</TableCell>
                          <TableCell>{formatStudentName(student)}</TableCell>
                          <TableCell>{student.grade_level}</TableCell>
                          <TableCell>{student.email || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {filteredStudents.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            No students found matching your criteria
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Reset Configuration */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200/50">
                    <Key className="h-5 w-5 text-purple-600" />
                  </div>
                  Reset Configuration
                </CardTitle>
                <CardDescription>
                  Configure the bulk password reset settings and notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <FormField
                  control={form.control}
                  name="reset_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reset Reason *</FormLabel>
                      <FormControl>
                        <textarea
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                          rows={3}
                          placeholder="Explain why this bulk password reset is necessary..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="notify_students"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-medium">Notify Students</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notify_parents"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-medium">Notify Parents</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                {(form.watch('notify_students') || form.watch('notify_parents')) && (
                  <FormField
                    control={form.control}
                    name="custom_message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Message (Optional)</FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                            rows={2}
                            placeholder="Add a custom message to include in the notification emails..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {selectedStudents.length > 0 && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      You are about to reset passwords for {selectedStudents.length} student(s).
                      This action cannot be undone.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="border-slate-300 hover:bg-slate-50 transition-all duration-300"
              >
                Clear Form
              </Button>
              <Button
                type="submit"
                disabled={bulkResetMutation.isPending || selectedStudents.length === 0}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
              >
                {bulkResetMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting Passwords...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset {selectedStudents.length} Password{selectedStudents.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        /* Results Display */
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-xl animate-fadeInUp">
          <CardHeader className="border-b border-green-100/50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Bulk Password Reset Results
              </CardTitle>
              <div className="flex items-center gap-2">
                {resetResult?.data?.summary_csv_url && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadResults}
                    className="border-green-300 hover:bg-green-50 text-green-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="border-purple-300 hover:bg-purple-50 text-purple-700"
                >
                  Reset Another Batch
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-700">
                  {resetResult?.data?.total_processed || 0}
                </div>
                <div className="text-sm text-gray-600">Total Processed</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">
                  {resetResult?.data?.successful_resets || 0}
                </div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600">
                  {resetResult?.data?.failed_resets || 0}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
            </div>

            {/* Results Table */}
            <ScrollArea className="h-96 border rounded-lg">
              <Table>
                <TableHeader className="bg-green-50">
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>New Password</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resetResult?.data?.results?.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{result.student_name}</TableCell>
                      <TableCell>{result.student_id}</TableCell>
                      <TableCell>
                        {result.success ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {result.success ? result.new_password : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {result.error || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}