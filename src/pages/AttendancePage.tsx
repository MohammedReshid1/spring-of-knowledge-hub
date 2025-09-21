import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  Calendar as CalendarIcon, Users, UserCheck, UserX, Clock, 
  TrendingUp, AlertCircle, CheckCircle2, XCircle, Timer,
  Download, Upload, RefreshCw, Filter, Search, Save
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Dev-only debugger
const __DEV__ = (import.meta as any)?.env?.MODE !== 'production';
const dbg = (...args: any[]) => { if (__DEV__) console.log('[Attendance][Teacher]', ...args); };

// Helper function to convert data to CSV format
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  // Convert each object to CSV row
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Handle values that might contain commas
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value ?? '';
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}

// Helper function to download CSV file
function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

interface Student {
  student_id: string;
  full_name: string;
  registration_number: string;
  class_id: string;
}

interface AttendanceRecord {
  id?: string;
  student_id: string;
  student_name?: string;
  class_id: string;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks?: string;
  recorded_by?: string;
  created_at?: string;
}

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState('mark');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');
  
  const { selectedBranch } = useBranch();
  const { user } = useAuth();
  const { userRole } = useRoleAccess();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (userRole === 'teacher') {
      dbg('Opened Attendance page', { userId: (user as any)?.id, email: (user as any)?.email, branch: selectedBranch });
    }
  }, [userRole, (user as any)?.id, (user as any)?.email, selectedBranch]);

  // Fetch teachers to resolve current teacher's teacher_id by email
  const { data: allTeachers = [] } = useQuery({
    queryKey: ['teachers', selectedBranch],
    queryFn: async () => {
      const resp = await apiClient.getTeachers();
      if (resp.error) throw resp.error;
      return resp.data || [];
    }
  });

  const teacherSelfId = (() => {
    if (userRole !== 'teacher') return null;
    const email = (user as any)?.email;
    const self = (allTeachers as any[]).find(t => t.email === email);
    const id = self?.id || null;
    dbg('Resolved teacherSelfId from email lookup', { email, teacherSelfId: id });
    return id;
  })();

  // Fetch classes - filter by branch
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ['classes', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getClasses();
      if (error) throw error;
      // Filter classes by selected branch
      const allClasses = data || [];
      const byBranch = (selectedBranch && selectedBranch !== 'all') ? allClasses.filter((cls: any) => cls.branch_id === selectedBranch) : allClasses;
      if (userRole === 'teacher' && teacherSelfId) {
        // Only show classes assigned to this teacher (primary or subject mapping)
        const byTeacher = byBranch.filter((c: any) => c.teacher_id === teacherSelfId || (Array.isArray(c.subject_teachers) && c.subject_teachers.some((m: any) => m.teacher_id === teacherSelfId)));
        dbg('Classes fetched', { byBranch: byBranch.length, byTeacher: byTeacher.length });
        return byTeacher;
      }
      dbg('Classes fetched (non-teacher)', { byBranch: byBranch.length });
      return byBranch;
    },
    enabled: !!selectedBranch
  });

  // Auto-select first class for teachers to streamline flow
  useEffect(() => {
    if (userRole === 'teacher' && !selectedClass && Array.isArray(classes) && classes.length > 0) {
      const first = (classes as any[])[0];
      setSelectedClass(first.id);
      dbg('Auto-selected first class', { classId: first.id, name: first.class_name });
    }
  }, [userRole, classes, selectedClass]);

  // Fetch students for selected class
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data, error } = await apiClient.getStudents({ 
        class_id: selectedClass,
        branch_id: selectedBranch,
        limit: 100  // Maximum allowed by backend validation
      });
      if (error) throw error;
      // Handle paginated response - extract items array
      return data?.items || [];
    },
    enabled: !!selectedClass
  });

  // Fetch existing attendance for selected date and class
  const { data: existingAttendance = [], refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance', selectedClass, selectedSubject, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data, error } = await apiClient.getAttendance({
        class_id: selectedClass,
        date: format(selectedDate, 'yyyy-MM-dd'),
        subject_id: selectedSubject || undefined
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClass
  });

  // Load subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getSubjects();
      if (error) throw error;
      return data || [];
    }
  });

  // Resolve selected class object and teacher-mapped subjects
  const selectedClassObj = (classes as any[]).find((c) => c.id === selectedClass);
  const teacherId = teacherSelfId || user?.id;
  const allowedSubjectIds = (() => {
    if (userRole !== 'teacher' || !selectedClassObj) return null;
    const mappings: Array<{ subject_id: string; teacher_id: string }> = selectedClassObj.subject_teachers || [];
    const ids = mappings.filter(m => m.teacher_id === teacherId).map(m => m.subject_id);
    // If no explicit mapping but the teacher is primary teacher, allow all subjects
    if (ids.length === 0 && selectedClassObj.teacher_id === teacherId) return null; // null means no filtering
    return new Set(ids);
  })();

  const filteredSubjects = (() => {
    if (!allowedSubjectIds) return subjects as any[];
    const arr = (subjects as any[]).filter((s) => allowedSubjectIds.has(s.id));
    dbg('Filtered subjects', { total: (subjects as any[]).length, allowed: arr.length, allowedIds: Array.from(allowedSubjectIds as any) });
    return arr;
  })();

  // Auto-select subject for teachers when exactly one allowed
  useEffect(() => {
    if (userRole === 'teacher' && selectedClass && (!selectedSubject || !filteredSubjects.some((s: any) => s.id === selectedSubject))) {
      if (Array.isArray(filteredSubjects) && filteredSubjects.length === 1) {
        setSelectedSubject((filteredSubjects as any[])[0].id);
        dbg('Auto-selected subject', { subjectId: (filteredSubjects as any[])[0].id });
      }
    }
  }, [userRole, selectedClass, selectedSubject, filteredSubjects]);

  // Reset subject if not allowed after class change or mapping change
  useEffect(() => {
    if (userRole === 'teacher' && selectedSubject) {
      const ok = filteredSubjects.some((s: any) => s.id === selectedSubject);
      if (!ok) setSelectedSubject('');
    }
  }, [userRole, selectedSubject, filteredSubjects]);

  // Fetch attendance analytics
  const { data: analytics } = useQuery({
    queryKey: ['attendance-analytics', selectedClass, selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getAttendanceAnalytics({
        class_id: selectedClass || undefined,
        branch_id: selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
        period_days: 30,
        teacher_id: userRole === 'teacher' ? (teacherSelfId || undefined) : undefined
      });
      if (error) throw error;
      dbg('Attendance analytics fetched', { hasData: !!data, class_id: selectedClass, teacher_id: userRole === 'teacher' ? (teacherSelfId || null) : null });
      return data;
    },
    enabled: userRole !== 'teacher' ? true : !!selectedClass
  });

  // Initialize attendance data when existing records are loaded
  useEffect(() => {
    if (existingAttendance.length > 0) {
      const initialData: Record<string, string> = {};
      const initialRemarks: Record<string, string> = {};
      existingAttendance.forEach((record: AttendanceRecord) => {
        initialData[record.student_id] = record.status;
        if (record.remarks) {
          initialRemarks[record.student_id] = record.remarks;
        }
      });
      setAttendanceData(initialData);
      setRemarks(initialRemarks);
    } else if (Array.isArray(students) && students.length > 0) {
      // Default all to present if no existing records
      const initialData: Record<string, string> = {};
      students.forEach((student: Student) => {
        initialData[student.student_id] = 'present';
      });
      setAttendanceData(initialData);
    }
  }, [existingAttendance, students]);

  // Save attendance mutation
  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      if ((userRole === 'teacher') && !selectedSubject) {
        throw new Error('Please select a subject before saving attendance');
      }
      const attendance_records = Object.entries(attendanceData).map(([student_id, status]) => ({
        student_id,
        class_id: selectedClass,
        status,
        notes: remarks[student_id] || ''
      }));

      const { error } = await apiClient.createBulkAttendance({
        attendance_records,
        class_id: selectedClass,
        attendance_date: format(selectedDate, 'yyyy-MM-dd'),
        recorded_by: (user as any)?.id || (user as any)?.email || 'current_user',
        branch_id: selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
        send_notifications: true,
        subject_id: selectedSubject || undefined
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Attendance has been saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      refetchAttendance();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save attendance",
        variant: "destructive",
      });
      console.error('Save attendance error:', error);
    }
  });

  // Update attendance mutation
  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ id, status, remarks }: { id: string; status: string; remarks: string }) => {
      const { error } = await apiClient.updateAttendance(id, {
        status,
        notes: remarks
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Attendance record updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      setEditingRecord(null);
      setEditStatus('');
      setEditRemarks('');
      refetchAttendance();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update attendance record",
        variant: "destructive",
      });
      console.error('Update attendance error:', error);
    }
  });

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleRemarkChange = (studentId: string, remark: string) => {
    setRemarks(prev => ({
      ...prev,
      [studentId]: remark
    }));
  };

  const markAllPresent = () => {
    const newData: Record<string, string> = {};
    if (Array.isArray(students)) {
      students.forEach((student: Student) => {
        newData[student.student_id] = 'present';
      });
    }
    setAttendanceData(newData);
  };

  const markAllAbsent = () => {
    const newData: Record<string, string> = {};
    if (Array.isArray(students)) {
      students.forEach((student: Student) => {
        newData[student.student_id] = 'absent';
      });
    }
    setAttendanceData(newData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      case 'excused': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle2 className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      case 'late': return <Timer className="h-4 w-4" />;
      case 'excused': return <AlertCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  // Edit dialog handlers
  const handleEditRecord = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditStatus(record.status);
    setEditRemarks(record.remarks || '');
  };

  const handleSaveEdit = () => {
    if (!editingRecord?.id) return;
    
    updateAttendanceMutation.mutate({
      id: editingRecord.id,
      status: editStatus,
      remarks: editRemarks
    });
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setEditStatus('');
    setEditRemarks('');
  };

  const filteredStudents = Array.isArray(students) ? students.filter((student: any) => {
    const fullName = [student.first_name, student.father_name, student.grandfather_name].filter(Boolean).join(' ');
    return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (student.student_id?.toLowerCase() || '').includes(searchTerm.toLowerCase());
  }) : [];

  // Calculate attendance summary
  const attendanceSummary = {
    present: Object.values(attendanceData).filter(s => s === 'present').length,
    absent: Object.values(attendanceData).filter(s => s === 'absent').length,
    late: Object.values(attendanceData).filter(s => s === 'late').length,
    excused: Object.values(attendanceData).filter(s => s === 'excused').length,
    total: Array.isArray(students) ? students.length : 0
  };

  return (
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(37, 99, 235, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(37, 99, 235, 0.5);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .animate-slide-in-right {
          animation: slideInRight 0.4s ease-out forwards;
        }

        .animate-pulse-glow:hover {
          animation: pulseGlow 2s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
          <div className="absolute inset-0 opacity-20"
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
               }} />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <Users className="mr-2 h-4 w-4" />
                Student Attendance System
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Attendance <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Management</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Comprehensive attendance tracking and analytics with real-time insights.
                Streamline your attendance operations with premium tools.
              </p>
            </div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
          {/* Action Bar */}
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
                <p className="text-sm text-gray-600">Manage attendance efficiently with powerful tools</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => refetchAttendance()}
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-0 hover:from-indigo-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            </div>
          </div>

          {/* Premium Analytics Cards */}
          {analytics && (userRole !== 'teacher' || (userRole === 'teacher' && selectedClass)) && (
            <div className="mx-auto max-w-7xl">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Average Attendance Card */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-100/90 to-emerald-100/90 backdrop-blur-glass border border-green-200/50 rounded-3xl shadow-premium-lg group-hover:shadow-premium-xl transition-all duration-300"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-emerald-500/5 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none hover:scale-105 transition-transform duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700/80">Average Attendance</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
                      {analytics.average_attendance_rate?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Total Students Card */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100/90 to-indigo-100/90 backdrop-blur-glass border border-blue-200/50 rounded-3xl shadow-premium-lg group-hover:shadow-premium-xl transition-all duration-300"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none hover:scale-105 transition-transform duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700/80">Total Students</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
                      {analytics.total_students || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Days Tracked Card */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-100/90 to-violet-100/90 backdrop-blur-glass border border-purple-200/50 rounded-3xl shadow-premium-lg group-hover:shadow-premium-xl transition-all duration-300"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-violet-500/5 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none hover:scale-105 transition-transform duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700/80">Days Tracked</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-purple-700 to-violet-600 bg-clip-text text-transparent">
                      {analytics.total_days || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200/50">
                    <CalendarIcon className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts Card */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-100/90 to-amber-100/90 backdrop-blur-glass border border-orange-200/50 rounded-3xl shadow-premium-lg group-hover:shadow-premium-xl transition-all duration-300"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-amber-500/5 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none hover:scale-105 transition-transform duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-700/80">Active Alerts</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-orange-700 to-amber-600 bg-clip-text text-transparent">
                      {analytics.unresolved_alerts || 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200/50">
                    <AlertCircle className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
              </div>
            </div>
            </div>
          )}

          {/* Premium Tabs */}
          <div className="mx-auto max-w-7xl">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-2 shadow-xl">
                <TabsList className="grid w-full grid-cols-3 gap-1 bg-transparent p-1">
                  <TabsTrigger
                    value="mark"
                    className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl py-3 px-4 transition-all duration-300 hover:bg-gray-100 font-medium"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>Mark Attendance</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="view"
                    className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl py-3 px-4 transition-all duration-300 hover:bg-gray-100 font-medium"
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>View Records</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="reports"
                    className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl py-3 px-4 transition-all duration-300 hover:bg-gray-100 font-medium"
                  >
                    <Download className="h-4 w-4" />
                    <span>Reports</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Mark Attendance Tab */}
              <TabsContent value="mark" className="space-y-6">
                {/* Premium Filters Section */}
                <div className="relative">
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

                  <Card className="relative bg-transparent border-0 shadow-none">
                    <CardHeader className="pb-6">
                      <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                        Select Class and Date
                      </CardTitle>
                      <p className="text-slate-600 leading-relaxed">
                        Choose the class, date, and subject for attendance marking
                      </p>
                    </CardHeader>
                    <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes
                        .filter((cls: any) => cls.id && cls.id.trim() !== '')
                        .map((cls: any) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.class_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Subject selection */}
                <div className="space-y-2">
                  <Label>Subject {userRole === 'teacher' && <span className="text-red-500">*</span>}</Label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {(filteredSubjects as any[]).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Search Student</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
                </div>

          {selectedClass && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <Badge variant="outline">{attendanceSummary.total}</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Present</span>
                      <Badge className="bg-green-100 text-green-800">
                        {attendanceSummary.present}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Absent</span>
                      <Badge className="bg-red-100 text-red-800">
                        {attendanceSummary.absent}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Late</span>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        {attendanceSummary.late}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Excused</span>
                      <Badge className="bg-blue-100 text-blue-800">
                        {attendanceSummary.excused}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

                {/* Premium Quick Actions */}
                <div className="flex justify-between items-center">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllPresent}
                      className="group relative overflow-hidden bg-white/90 hover:bg-green-50 border-green-200/50 hover:border-green-300 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <UserCheck className="h-4 w-4 mr-2 text-green-600" />
                      Mark All Present
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllAbsent}
                      className="group relative overflow-hidden bg-white/90 hover:bg-red-50 border-red-200/50 hover:border-red-300 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <UserX className="h-4 w-4 mr-2 text-red-600" />
                      Mark All Absent
                    </Button>
                  </div>
                  <Button
                    onClick={() => saveAttendanceMutation.mutate()}
                    disabled={saveAttendanceMutation.isPending || !selectedClass}
                    className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Save className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                    {saveAttendanceMutation.isPending ? 'Saving...' : 'Save Attendance'}
                  </Button>
                </div>

              {/* Student List */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentsLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center">
                            Loading students...
                          </TableCell>
                        </TableRow>
                      ) : filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center">
                            No students found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStudents.map((student: any) => (
                          <TableRow key={student.id || student.student_id}>
                            <TableCell className="font-medium">
                              {student.student_id}
                            </TableCell>
                            <TableCell>
                              {[student.first_name, student.father_name, student.grandfather_name].filter(Boolean).join(' ')}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {['present', 'absent', 'late', 'excused'].map((status) => (
                                  <Button
                                    key={status}
                                    variant={attendanceData[student.student_id] === status ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleStatusChange(student.student_id, status)}
                                    className={cn(
                                      "capitalize",
                                      attendanceData[student.student_id] === status && getStatusColor(status)
                                    )}
                                  >
                                    {getStatusIcon(status)}
                                    <span className="ml-1">{status}</span>
                                  </Button>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Add remarks..."
                                value={remarks[student.student_id] || ''}
                                onChange={(e) => handleRemarkChange(student.student_id, e.target.value)}
                                className="max-w-xs"
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* View Records Tab */}
        <TabsContent value="view" className="space-y-4">
          {/* Filters for viewing records */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>
                View and manage past attendance records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Class Selection */}
                <div>
                  <Label htmlFor="view-class">Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes
                        .filter((cls) => cls.id && cls.id.trim() !== '')
                        .map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.class_name} - {cls.section}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Selection */}
                <div>
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Search */}
                <div>
                  <Label htmlFor="search-students">Search Students</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search-students"
                      placeholder="Search by name or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* View Results */}
          {selectedClass && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Attendance Records for {format(selectedDate, 'PPP')}
                </CardTitle>
                <CardDescription>
                  Total attendance records found
                </CardDescription>
              </CardHeader>
              <CardContent>
                {existingAttendance.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {existingAttendance
                        .filter(record => {
                          if (!searchTerm) return true;
                          const student = Array.isArray(students) ? students.find(s => s.student_id === record.student_id) : null;
                          const fullName = student ? [student.first_name, student.father_name, student.grandfather_name].filter(Boolean).join(' ') : '';
                          return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 record.student_id.toLowerCase().includes(searchTerm.toLowerCase());
                        })
                        .map((record) => {
                          const student = Array.isArray(students) ? students.find(s => s.student_id === record.student_id) : null;
                          const fullName = student ? [student.first_name, student.father_name, student.grandfather_name].filter(Boolean).join(' ') : 'Unknown Student';
                          
                          return (
                            <TableRow key={record.student_id}>
                              <TableCell className="font-medium">{record.student_id}</TableCell>
                              <TableCell>{fullName}</TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    record.status === 'present'
                                      ? 'bg-green-100 text-green-800'
                                      : record.status === 'absent'
                                      ? 'bg-red-100 text-red-800'
                                      : record.status === 'late'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }
                                >
                                  {record.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm') : '-'}
                              </TableCell>
                              <TableCell>{record.notes || '-'}</TableCell>
                              <TableCell>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEditRecord(record)}
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No attendance records found for the selected date and class.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          {/* Report Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Reports</CardTitle>
              <CardDescription>
                Generate and export attendance reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Class Selection */}
                <div>
                  <Label htmlFor="report-class">Class (Optional)</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes
                        .filter((cls) => cls.id && cls.id.trim() !== '')
                        .map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.class_name} - {cls.section}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Period Selection */}
                <div>
                  <Label>Report Period</Label>
                  <Select defaultValue="30">
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 3 months</SelectItem>
                      <SelectItem value="365">Last year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analytics Summary */}
          {analytics && (
            <Card>
              <CardHeader>
                <CardTitle>Current Period Summary</CardTitle>
                <CardDescription>
                  Overview of attendance for the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">
                      {analytics.average_attendance_rate?.toFixed(1) || 0}%
                    </p>
                    <p className="text-sm text-green-600">Average Attendance</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">
                      {analytics.total_students || 0}
                    </p>
                    <p className="text-sm text-blue-600">Total Students</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-700">
                      {analytics.total_days || 0}
                    </p>
                    <p className="text-sm text-purple-600">School Days</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-700">
                      {analytics.unresolved_alerts || 0}
                    </p>
                    <p className="text-sm text-orange-600">Active Alerts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Export Reports</CardTitle>
              <CardDescription>
                Download attendance data in various formats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={async () => {
                    try {
                      const { data, error } = await apiClient.getMonthlyAttendanceReport({
                        class_id: selectedClass || undefined,
                        branch_id: selectedBranch
                      });
                      if (error) throw error;
                      
                      // Create and download CSV
                      const csv = convertToCSV(data);
                      downloadCSV(csv, 'monthly_attendance_report.csv');
                      
                      toast({
                        title: "Success",
                        description: "Monthly report exported successfully",
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to export monthly report",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Monthly Report
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={async () => {
                    if (!selectedClass) {
                      toast({
                        title: "Error",
                        description: "Please select a class first",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    try {
                      const { data, error } = await apiClient.getClassAttendanceReport(selectedClass, {
                        start_date: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                        end_date: format(new Date(), 'yyyy-MM-dd')
                      });
                      if (error) throw error;
                      
                      // Create and download CSV
                      const csv = convertToCSV(data);
                      downloadCSV(csv, 'class_attendance_summary.csv');
                      
                      toast({
                        title: "Success",
                        description: "Class summary exported successfully",
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to export class summary",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Class Summary
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={async () => {
                    try {
                      const { data, error } = await apiClient.exportAttendanceReport({
                        format: 'csv',
                        class_id: selectedClass || undefined,
                        start_date: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                        end_date: format(new Date(), 'yyyy-MM-dd')
                      });
                      if (error) throw error;
                      
                      // Handle the blob response for download
                      const blob = new Blob([data], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'attendance_detailed_report.csv';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                      
                      toast({
                        title: "Success",
                        description: "Detailed report exported successfully",
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to export detailed report",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Detailed Report
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    if (!analytics) {
                      toast({
                        title: "Error",
                        description: "No analytics data available",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    try {
                      // Generate analytics report
                      const analyticsData = {
                        report_date: format(new Date(), 'yyyy-MM-dd'),
                        period: '30 days',
                        average_attendance_rate: analytics.average_attendance_rate,
                        total_students: analytics.total_students,
                        total_days: analytics.total_days,
                        unresolved_alerts: analytics.unresolved_alerts,
                        class_filter: selectedClass ? 'Specific Class' : 'All Classes'
                      };
                      
                      const csv = convertToCSV([analyticsData]);
                      downloadCSV(csv, 'attendance_analytics_summary.csv');
                      
                      toast({
                        title: "Success",
                        description: "Analytics report exported successfully",
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to export analytics report",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Analytics Summary
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </div>
      </div>
      </div>

      {/* Premium Edit Attendance Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-xl">
          {/* Premium Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>
          <div className="relative">
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
            <DialogDescription>
              Modify the attendance status and remarks for {editingRecord?.student_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="excused">Excused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Input
                id="remarks"
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="Add any remarks..."
              />
            </div>
          </div>

            <DialogFooter className="gap-3">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                className="group relative overflow-hidden bg-white/90 hover:bg-gray-50 border-gray-200/50 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-gray-500/10 to-slate-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateAttendanceMutation.isPending}
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {updateAttendanceMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
