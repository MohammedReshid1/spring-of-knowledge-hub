import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { apiClient } from '@/lib/api';
import { config } from '@/lib/config';
import { TokenStorage } from '@/utils/tokenStorage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Eye,
  EyeOff,
  Key,
  User,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Copy,
  Download
} from 'lucide-react';

// Type definitions
interface Student {
  id: string;
  student_id: string;
  first_name: string;
  father_name?: string;
  grandfather_name?: string;
  grade_level: string;
  email?: string;
}

interface PasswordPreviewResponse {
  success: boolean;
  data?: {
    student_id: string;
    student_name: string;
    default_password: string;
    password_format: string;
    last_reset?: string;
    reset_count?: number;
  };
  message?: string;
}

interface PasswordPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student;
  studentId?: string;
}

export function PasswordPreviewModal({
  open,
  onOpenChange,
  student,
  studentId
}: PasswordPreviewModalProps) {
  const { selectedBranch } = useBranch();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const enableQueries = !!selectedBranch;

  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(student || null);

  // Get password preview
  const { data: previewData, isLoading: previewLoading, refetch: refetchPreview } = useQuery({
    queryKey: ['password-preview', selectedStudent?.id, branchId],
    queryFn: async () => {
      if (!selectedStudent?.id || !branchId) return null;

      const response = await fetch(`${config.API_BASE_URL}/admin/students/password-reset/preview/${selectedStudent.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TokenStorage.getToken()}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch password preview');
      }

      return response.json() as Promise<PasswordPreviewResponse>;
    },
    enabled: !!selectedStudent?.id && enableQueries,
  });

  // Search students
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-search', studentSearch, branchId],
    queryFn: () => apiClient.searchStudentsForPayments(studentSearch, branchId),
    enabled: studentSearch.length > 2 && enableQueries,
    select: (resp) => (resp as any).data || (resp as any).items || [],
  });

  const formatStudentName = (student: Student) => {
    const parts = [student.first_name, student.father_name, student.grandfather_name].filter(Boolean);
    return parts.join(' ');
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setStudentSearch(formatStudentName(student));
    setShowPassword(false);
  };

  const handleCopyPassword = async () => {
    if (previewData?.data?.default_password) {
      try {
        await navigator.clipboard.writeText(previewData.data.default_password);
        toast({
          title: 'Password Copied',
          description: 'Password has been copied to clipboard',
        });
      } catch (error) {
        toast({
          title: 'Copy Failed',
          description: 'Failed to copy password to clipboard',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDownloadPassword = () => {
    if (previewData?.data && selectedStudent) {
      const passwordInfo = `
Student Password Information
==========================

Student Name: ${previewData.data.student_name}
Student ID: ${previewData.data.student_id}
Default Password: ${previewData.data.default_password}
Password Format: ${previewData.data.password_format}
Last Reset: ${previewData.data.last_reset || 'Never'}
Reset Count: ${previewData.data.reset_count || 0}

Generated on: ${new Date().toLocaleString()}
Branch: ${selectedBranch}

Note: This is the default password that will be set when the student's password is reset.
      `.trim();

      const blob = new Blob([passwordInfo], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `password-preview-${selectedStudent.student_id}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Download Complete',
        description: 'Password information has been downloaded',
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedStudent(null);
    setStudentSearch('');
    setShowPassword(false);
  };

  const currentStudent = selectedStudent || student;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

        <DialogHeader className="animate-fadeInUp">
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-teal-700 to-cyan-700 bg-clip-text text-transparent flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 border border-teal-200/50">
              <Key className="h-6 w-6 text-teal-600" />
            </div>
            Password Preview
          </DialogTitle>
          <DialogDescription>
            Preview what the default password will be for a student without actually resetting it
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
          {/* Student Selection */}
          {!currentStudent && (
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-teal-700 to-cyan-700 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 border border-teal-200/50">
                    <User className="h-5 w-5 text-teal-600" />
                  </div>
                  Select Student
                </CardTitle>
                <CardDescription>
                  Search and select a student to preview their default password
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="student-search">Search Student</Label>
                  <Input
                    id="student-search"
                    placeholder="Search by name or ID..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                  {studentsData && studentsData.length > 0 && (
                    <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
                      {studentsData.map((student: Student) => (
                        <div
                          key={student.id}
                          className="p-2 hover:bg-muted rounded cursor-pointer"
                          onClick={() => handleStudentSelect(student)}
                        >
                          <div className="font-medium">
                            {formatStudentName(student)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ID: {student.student_id} | Grade: {student.grade_level}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected Student Info */}
          {currentStudent && (
            <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200 shadow-xl">
              <CardHeader className="border-b border-teal-100/50 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-teal-800 flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 border border-teal-200/50">
                      <User className="h-5 w-5 text-teal-600" />
                    </div>
                    Student Information
                  </CardTitle>
                  {!student && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedStudent(null)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Change Student
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Student Name</Label>
                    <p className="text-lg font-semibold text-gray-900">{formatStudentName(currentStudent)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Student ID</Label>
                    <p className="text-lg font-semibold text-gray-900">{currentStudent.student_id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Grade Level</Label>
                    <p className="text-lg font-semibold text-gray-900">{currentStudent.grade_level}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Email</Label>
                    <p className="text-lg font-semibold text-gray-900">{currentStudent.email || 'Not provided'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Password Preview */}
          {currentStudent && (
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold bg-gradient-to-r from-teal-700 to-cyan-700 bg-clip-text text-transparent flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 border border-teal-200/50">
                      <Key className="h-5 w-5 text-teal-600" />
                    </div>
                    Default Password Preview
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchPreview()}
                    disabled={previewLoading}
                    className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                  >
                    {previewLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {previewLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                  </div>
                ) : previewData?.success && previewData.data ? (
                  <div className="space-y-4">
                    <Alert className="bg-teal-50 border-teal-200">
                      <AlertCircle className="h-4 w-4 text-teal-600" />
                      <AlertDescription className="text-teal-800">
                        This is the password that will be set when you reset this student's password.
                        The actual password has not been changed.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Password Format</Label>
                        <p className="text-lg font-semibold text-gray-900">{previewData.data.password_format}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Default Password</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-lg font-mono font-semibold text-teal-600 bg-teal-50 px-3 py-1 rounded flex-1">
                            {showPassword ? previewData.data.default_password : '••••••••••••'}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Last Reset</Label>
                        <p className="text-sm text-gray-900">
                          {previewData.data.last_reset
                            ? new Date(previewData.data.last_reset).toLocaleString()
                            : 'Never'
                          }
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-600">Reset Count</Label>
                        <p className="text-sm text-gray-900">{previewData.data.reset_count || 0} times</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4">
                      <Button
                        type="button"
                        onClick={handleCopyPassword}
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Password
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDownloadPassword}
                        className="border-teal-300 hover:bg-teal-50 text-teal-700"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Info
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      {previewData?.message || 'Failed to load password preview. Please try again.'}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-slate-300 hover:bg-slate-50"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}