import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { useAuth } from '@/hooks/useAuth';
import { useLiveDataForPage } from '@/hooks/useLiveData';
import { usePermissionCheck } from '@/contexts/RoleAccessContext';
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
import { format, subDays } from 'date-fns';
import {
  Calendar as CalendarIcon, Users, UserCheck, UserX,
  TrendingUp, AlertCircle, CheckCircle2, XCircle, Timer,
  Download, Search, Save
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
import { StatsCardLoader, TableLoader } from '@/components/ui/loading-states';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceReports } from '@/components/reports/AttendanceReports';


// Helper function to convert data to CSV format
function convertToCSV<T extends Record<string, unknown>>(data: T[]): string {
  if (!data || data.length === 0) return '';
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  // Convert each object to CSV row
  const csvRows = data.map((row) => {
    return headers.map((header) => {
      const rawValue = row[header];
      if (rawValue === null || rawValue === undefined) {
        return '';
      }
      if (typeof rawValue === 'string') {
        return rawValue.includes(',') ? `"${rawValue}"` : rawValue;
      }
      if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        return String(rawValue);
      }
      try {
        return JSON.stringify(rawValue);
      } catch {
        return '';
      }
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

type StudentProfile = Student & {
  first_name?: string;
  father_name?: string;
  grandfather_name?: string;
};

interface TeacherSummary {
  id?: string;
  email?: string;
}

interface SubjectSummary {
  id: string;
  subject_name?: string;
  subject_code?: string;
}

interface ClassSummary {
  id?: string;
  class_id?: string;
  class_name?: string;
  name?: string;
  section?: string;
  teacher_id?: string;
  subject_teachers?: Array<{ subject_id?: string; teacher_id?: string }>;
  branch_id?: string;
}

interface AttendanceRecord {
  id?: string;
  student_id: string;
  student_name?: string;
  class_id: string;
  subject_id?: string;
  subject_name?: string;
  subject_code?: string;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  remarks?: string;
  check_in_time?: string;
  check_out_time?: string;
  recorded_by?: string;
  created_at?: string;
}

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState('mark');
  const { selectedBranch } = useBranch();

  // Enable real-time updates for attendance and related data
  useLiveDataForPage('attendance', {
    relatedCollections: ['students', 'classes', 'subjects'],
    filters: selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}
  });
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedMarkSubject, setSelectedMarkSubject] = useState<string>('');
  const [selectedHistorySubject, setSelectedHistorySubject] = useState<string>('all');
  const [selectedReportClass, setSelectedReportClass] = useState<string>('all');
  const [reportPeriod, setReportPeriod] = useState<string>('30');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const historySubjectManuallySet = useRef(false);
  const { user, student } = useAuth();
  const { userRole, isStudent } = useRoleAccess();
  const queryClient = useQueryClient();

  // Parent detection
  const isParent = user?.role === 'parent';
  const parentId = (user as any)?.parent_id;

  const userId = typeof user === 'object' && user !== null && 'id' in user ? (user as { id?: string }).id : undefined;
  const userEmail = typeof user === 'object' && user !== null && 'email' in user ? (user as { email?: string }).email : undefined;

  // Permission checks
  const { hasPermission } = usePermissionCheck();
  const canRead = hasPermission('attendance.read');
  const canCreate = hasPermission('attendance.create');
  const canUpdate = hasPermission('attendance.update');
  const canManage = hasPermission('attendance.manage');

  useEffect(() => {
    if (userRole === 'teacher') {
      // Teacher opened Attendance page
    }
  }, [userRole, userId, userEmail, selectedBranch]);

  // Fetch teachers to resolve current teacher's teacher_id by email
  const { data: allTeachers = [] } = useQuery<TeacherSummary[]>({
    queryKey: ['teachers', selectedBranch],
    queryFn: async () => {
      const resp = await apiClient.getTeachers();
      if (resp.error) throw resp.error;
      const items = resp.data;
      return Array.isArray(items) ? (items as TeacherSummary[]) : [];
    },
    staleTime: 300000, // Cache for 5 minutes (teachers don't change often)
    refetchOnWindowFocus: false
  });

  const teacherSelfId = (() => {
    if (userRole !== 'teacher') return null;
    const email = typeof user === 'object' && user !== null && 'email' in user ? (user as { email?: string }).email : undefined;
    const self = allTeachers.find((t) => t.email === email);
    const id = self?.id || null;
    return id;
  })();

  // Fetch classes - filter by branch and teacher
  const { data: classes = [], isLoading: classesLoading } = useQuery<ClassSummary[]>({
    queryKey: userRole === 'teacher' ? ['teacher-classes', userId, selectedBranch] : ['classes', selectedBranch],
    queryFn: async () => {
      if (userRole === 'teacher' && userId) {
        // For teachers, fetch only their assigned classes from backend
        const { data, error } = await apiClient.getTeacherEnhancedClasses(userId);
        if (error) throw error;
        // Extract classes from the response
        const teacherClasses = data?.classes || [];
        // Filter by branch if needed
        if (selectedBranch && selectedBranch !== 'all') {
          return teacherClasses.filter((cls: ClassSummary) => cls.branch_id === selectedBranch);
        }
        return teacherClasses;
      } else {
        // For non-teachers, fetch all classes and filter by branch
        const { data, error } = await apiClient.getClasses();
        if (error) throw error;
        const allClasses = Array.isArray(data) ? (data as ClassSummary[]) : [];
        const byBranch = (selectedBranch && selectedBranch !== 'all')
          ? allClasses.filter((cls) => cls.branch_id === selectedBranch)
          : allClasses;
        return byBranch;
      }
    },
    enabled: !!selectedBranch,
    staleTime: 60000, // Cache for 60 seconds
    refetchOnWindowFocus: false // Prevent refetch on window focus
  });

  // Auto-select first class for teachers to streamline flow
  useEffect(() => {
    if (userRole === 'teacher' && !selectedClass && Array.isArray(classes) && classes.length > 0) {
      const first = classes[0];
      if (first?.id) {
        setSelectedClass(first.id);
      }
    }
  }, [userRole, classes, selectedClass]);

  useEffect(() => {
    if (userRole === 'teacher' && selectedClass && selectedReportClass === 'all') {
      setSelectedReportClass(selectedClass);
    }
  }, [userRole, selectedClass, selectedReportClass]);

  // Fetch students for selected class
  const { data: students = [], isLoading: studentsLoading } = useQuery<StudentProfile[]>({
    queryKey: ['students', selectedClass, selectedBranch],
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data, error } = await apiClient.getStudents({
        class_id: selectedClass,
        branch_id: selectedBranch,
        limit: 100  // Maximum allowed by backend validation
      });
      if (error) throw error;
      // Handle paginated response - extract items array
      const items = data?.items;
      return Array.isArray(items) ? (items as StudentProfile[]) : [];
    },
    enabled: !!selectedClass,
    staleTime: 30000, // Cache for 30 seconds to prevent excessive refetching
    refetchOnWindowFocus: false // Prevent refetch on window focus
  });

  // Fetch existing attendance for selected date and class
  const { data: existingAttendance = [], refetch: refetchAttendance, isLoading: historyLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', selectedClass, selectedHistorySubject, format(selectedDate, 'yyyy-MM-dd'), selectedBranch],
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data, error } = await apiClient.getAttendance({
        class_id: selectedClass,
        date: format(selectedDate, 'yyyy-MM-dd'),
        branch_id: selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
        subject_id: selectedHistorySubject && selectedHistorySubject !== 'all' ? selectedHistorySubject : undefined
      });
      if (error) throw error;
      return Array.isArray(data) ? (data as AttendanceRecord[]) : [];
    },
    enabled: !!selectedClass,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false // Prevent refetch on window focus
  });

  // Load subjects
  const { data: subjects = [] } = useQuery<SubjectSummary[]>({
    queryKey: ['subjects', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getSubjects();
      if (error) throw error;
      return Array.isArray(data) ? (data as SubjectSummary[]) : [];
    },
    staleTime: 300000, // Cache for 5 minutes (subjects don't change often)
    refetchOnWindowFocus: false
  });

  // Resolve selected class object
  const selectedClassObj = classes.find((cls) => cls.id === selectedClass);

  // For teachers, the backend already filters subjects to only return their assigned subjects
  // So we can trust the subjects array as-is without additional frontend filtering
  const filteredSubjects = useMemo(() => {
    return subjects;
  }, [subjects]);

  const subjectLookup = useMemo(() => {
    const map = new Map<string, { name: string; code?: string }>();
    subjects.forEach((subject) => {
      if (subject?.id) {
        map.set(subject.id, {
          name: subject.subject_name || subject.id,
          code: subject.subject_code,
        });
      }
    });
    return map;
  }, [subjects]);

  const formatSubjectLabel = (subjectId?: string) => {
    if (!subjectId) return '—';
    const subjectInfo = subjectLookup.get(subjectId);
    if (!subjectInfo) return subjectId;
    return subjectInfo.code ? `${subjectInfo.name} (${subjectInfo.code})` : subjectInfo.name;
  };

  const formatClassLabel = (cls: ClassSummary) => {
    const name = cls.class_name || cls.name || cls.class_id || cls.id || 'Class';
    return cls.section ? `${name} - ${cls.section}` : name;
  };

  const classLookup = useMemo(() => {
    const map = new Map<string, { name: string; section?: string }>();
    classes.forEach((cls) => {
      const label = {
        name: cls?.class_name || cls?.name || cls?.id || cls?.class_id || 'Unnamed Class',
        section: cls?.section,
      };
      if (cls?.id) {
        map.set(cls.id, label);
      }
      if (cls?.class_id) {
        map.set(cls.class_id, label);
      }
    });
    return map;
  }, [classes]);

  const attendanceRecordsForMarking = useMemo(() => {
    if (!Array.isArray(existingAttendance) || existingAttendance.length === 0) return [];
    if (selectedMarkSubject) {
      return existingAttendance.filter((record: AttendanceRecord) => record.subject_id === selectedMarkSubject);
    }
    if (selectedHistorySubject && selectedHistorySubject !== 'all') {
      return existingAttendance.filter((record: AttendanceRecord) => record.subject_id === selectedHistorySubject);
    }
    return existingAttendance;
  }, [existingAttendance, selectedMarkSubject, selectedHistorySubject]);

  const reportPeriodDays = Number(reportPeriod) || 30;
  const { data: reportSummary, isLoading: reportSummaryLoading, isFetching: reportSummaryFetching, error: reportSummaryError } = useQuery({
    queryKey: ['attendance-report-summary', selectedReportClass, reportPeriodDays, selectedBranch],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = subDays(endDate, Math.max(reportPeriodDays - 1, 0));
      const { data, error } = await apiClient.getAttendanceReportSummary({
        class_id: selectedReportClass !== 'all' ? selectedReportClass : undefined,
        branch_id: selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd')
      });
      if (error) throw error;
      return data;
    },
    enabled: (canRead || canManage) && (!!selectedBranch || userRole === 'superadmin' || userRole === 'superadmin'),
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  const classAttendanceEntries = useMemo(() => {
    if (!reportSummary || !reportSummary.class_attendance_rates) return [];
    return Object.entries(reportSummary.class_attendance_rates as Record<string, number>)
      .map(([classId, rate]) => {
        const info = classLookup.get(classId);
        const label = info?.section ? `${info.name} - ${info.section}` : (info?.name || classId || 'Unknown Class');
        return {
          classId,
          label,
          rate: typeof rate === 'number' ? rate : Number(rate)
        };
      })
      .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  }, [reportSummary, classLookup]);

  const dailyTrendEntries = useMemo(() => {
    if (!reportSummary || !reportSummary.daily_trends) return [];
    return Object.entries(reportSummary.daily_trends as Record<string, number>)
      .map(([day, percentage]) => ({
        day,
        percentage: typeof percentage === 'number' ? percentage : Number(percentage)
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [reportSummary]);

  const isSummaryReady = !!reportSummary && !(reportSummaryLoading || reportSummaryFetching);

  const summaryPeriodLabel = useMemo(() => {
    const start = reportSummary?.date_range?.start_date;
    const end = reportSummary?.date_range?.end_date;
    if (!start || !end) return null;
    try {
      return `${format(new Date(start), 'PPP')} - ${format(new Date(end), 'PPP')}`;
    } catch {
      return null;
    }
  }, [reportSummary]);

  const selectableClasses = useMemo(
    () => classes.filter((cls): cls is ClassSummary & { id: string } => typeof cls.id === 'string' && cls.id.trim().length > 0),
    [classes]
  );

  const concerningAttendanceEntries = Array.isArray(reportSummary?.concerning_attendance)
    ? (reportSummary.concerning_attendance as Array<{ student_id?: string; student_name?: string; attendance_rate?: number }>)
    : [];

  // Dynamic tabs based on permissions
  const availableTabs = useMemo(() => {
    const tabs = [];

    if (canCreate || canManage) {
      tabs.push({ value: 'mark', label: 'Mark Attendance', icon: UserCheck });
    }

    if (canRead || canManage) {
      tabs.push(
        { value: 'view', label: 'View Records', icon: TrendingUp },
        { value: 'reports', label: 'Reports', icon: Download }
      );
    }

    return tabs;
  }, [canRead, canCreate, canManage]);

  // Auto-select subject for teachers when exactly one allowed
  useEffect(() => {
    const hasMatchingSubject = selectedMarkSubject ? filteredSubjects.some((subject) => subject.id === selectedMarkSubject) : false;
    if (userRole === 'teacher' && selectedClass && (!selectedMarkSubject || !hasMatchingSubject)) {
      if (filteredSubjects.length === 1) {
        const soleSubjectId = filteredSubjects[0]?.id;
        if (soleSubjectId) {
          setSelectedMarkSubject(soleSubjectId);
        }
      }
    }
  }, [userRole, selectedClass, selectedMarkSubject, filteredSubjects]);

  // Reset subject if not allowed after class change or mapping change
  useEffect(() => {
    if (userRole === 'teacher' && selectedMarkSubject) {
      const ok = filteredSubjects.some((subject) => subject.id === selectedMarkSubject);
      if (!ok) setSelectedMarkSubject('');
    }
  }, [userRole, selectedMarkSubject, filteredSubjects]);

  useEffect(() => {
    if (selectedMarkSubject && !historySubjectManuallySet.current) {
      setSelectedHistorySubject(selectedMarkSubject);
    }
  }, [selectedMarkSubject]);

  useEffect(() => {
    if (selectedHistorySubject && selectedHistorySubject !== 'all') {
      const ok = filteredSubjects.some((subject) => subject.id === selectedHistorySubject);
      if (!ok) {
        historySubjectManuallySet.current = false;
        const fallbackSubject = selectedMarkSubject && filteredSubjects.some((subject) => subject.id === selectedMarkSubject)
          ? selectedMarkSubject
          : 'all';
        setSelectedHistorySubject(fallbackSubject || 'all');
      }
    }
  }, [selectedHistorySubject, filteredSubjects, selectedMarkSubject]);

  useEffect(() => {
    historySubjectManuallySet.current = false;
    setSelectedHistorySubject('all');
  }, [selectedClass]);

  // Fetch attendance analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['attendance-analytics', selectedClass, selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getAttendanceAnalytics({
        class_id: selectedClass || undefined,
        branch_id: selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
        period_days: 30,
        teacher_id: userRole === 'teacher' ? (teacherSelfId || undefined) : undefined
      });
      if (error) throw error;
      return data;
    },
    enabled: userRole !== 'teacher' ? true : !!selectedClass,
    staleTime: 60000, // Cache for 60 seconds
    refetchOnWindowFocus: false // Prevent refetch on window focus
  });

  // Fetch parent's children
  const { data: parentChildren = [] } = useQuery<StudentProfile[]>({
    queryKey: ['parent-children', parentId, selectedBranch],
    queryFn: async () => {
      if (!parentId) return [];
      const { data, error } = await apiClient.getStudents({
        parent_id: parentId,
        branch_id: selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
        limit: 100
      });
      if (error) throw error;
      const items = data?.items;
      return Array.isArray(items) ? (items as StudentProfile[]) : [];
    },
    enabled: isParent && !!parentId,
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  // Student-specific attendance data
  const { data: studentAttendanceRecords = [], isLoading: studentAttendanceLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['student-attendance', student?.student_id, startDate, endDate, selectedHistorySubject],
    queryFn: async () => {
      if (!student?.student_id) return [];
      const { data, error } = await apiClient.getAttendance({
        student_id: student.student_id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        subject_id: selectedHistorySubject && selectedHistorySubject !== 'all' ? selectedHistorySubject : undefined
      });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
    enabled: isStudent && !!student?.student_id,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  // Parent-specific attendance data - fetch for all children
  const { data: parentAttendanceRecords = [], isLoading: parentAttendanceLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['parent-attendance', parentChildren, startDate, endDate, selectedHistorySubject],
    queryFn: async () => {
      if (!parentChildren || parentChildren.length === 0) return [];

      // Fetch attendance for all children
      const allRecords: AttendanceRecord[] = [];
      for (const child of parentChildren) {
        if (!child.student_id) continue;
        const { data, error } = await apiClient.getAttendance({
          student_id: child.student_id,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          subject_id: selectedHistorySubject && selectedHistorySubject !== 'all' ? selectedHistorySubject : undefined
        });
        if (!error && Array.isArray(data)) {
          allRecords.push(...data);
        }
      }
      return allRecords;
    },
    enabled: isParent && parentChildren.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  // Calculate student attendance stats
  const studentAttendanceStats = useMemo(() => {
    if (!isStudent || studentAttendanceRecords.length === 0) return null;

    const total = studentAttendanceRecords.length;
    const present = studentAttendanceRecords.filter(r => r.status === 'present').length;
    const absent = studentAttendanceRecords.filter(r => r.status === 'absent').length;
    const late = studentAttendanceRecords.filter(r => r.status === 'late').length;
    const excused = studentAttendanceRecords.filter(r => r.status === 'excused').length;
    const attendanceRate = total > 0 ? ((present + late) / total) * 100 : 0;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate
    };
  }, [isStudent, studentAttendanceRecords]);

  // Calculate parent attendance stats (for all children combined)
  const parentAttendanceStats = useMemo(() => {
    if (!isParent || parentAttendanceRecords.length === 0) return null;

    const total = parentAttendanceRecords.length;
    const present = parentAttendanceRecords.filter(r => r.status === 'present').length;
    const absent = parentAttendanceRecords.filter(r => r.status === 'absent').length;
    const late = parentAttendanceRecords.filter(r => r.status === 'late').length;
    const excused = parentAttendanceRecords.filter(r => r.status === 'excused').length;
    const attendanceRate = total > 0 ? ((present + late) / total) * 100 : 0;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate,
      childrenCount: parentChildren.length
    };
  }, [isParent, parentAttendanceRecords, parentChildren]);

  // Initialize attendance data when existing records are loaded
  useEffect(() => {
    if (attendanceRecordsForMarking.length > 0) {
      const initialData: Record<string, string> = {};
      const initialRemarks: Record<string, string> = {};
      attendanceRecordsForMarking.forEach((record: AttendanceRecord) => {
        initialData[record.student_id] = record.status;
        const note = record.notes ?? record.remarks;
        if (note) {
          initialRemarks[record.student_id] = note;
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
  }, [attendanceRecordsForMarking, students]);

  // Save attendance mutation
  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      if ((userRole === 'teacher') && !selectedMarkSubject) {
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
        recorded_by: userId || userEmail || 'current_user',
        branch_id: selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
        send_notifications: true,
        subject_id: selectedMarkSubject || undefined
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
    setEditRemarks(record.notes ?? record.remarks ?? '');
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

  const filteredStudents = students.filter((student) => {
    const nameParts = [student.first_name, student.father_name, student.grandfather_name].filter(Boolean);
    const fullName = nameParts.join(' ');
    const term = searchTerm.toLowerCase();
    return fullName.toLowerCase().includes(term) || (student.student_id?.toLowerCase() ?? '').includes(term);
  });

  // Calculate attendance summary
  const attendanceSummary = {
    present: Object.values(attendanceData).filter(s => s === 'present').length,
    absent: Object.values(attendanceData).filter(s => s === 'absent').length,
    late: Object.values(attendanceData).filter(s => s === 'late').length,
    excused: Object.values(attendanceData).filter(s => s === 'excused').length,
    total: Array.isArray(students) ? students.length : 0
  };

  // If student or parent, show read-only attendance view
  if (isStudent || isParent) {
    // Determine which data to use
    const attendanceRecords = isStudent ? studentAttendanceRecords : parentAttendanceRecords;
    const attendanceStats = isStudent ? studentAttendanceStats : parentAttendanceStats;
    const isLoading = isStudent ? studentAttendanceLoading : parentAttendanceLoading;
    const viewTitle = isStudent ? "My Attendance" : "My Children's Attendance";
    const viewDescription = isStudent
      ? "Track your attendance history and maintain excellent attendance records."
      : "Monitor your children's attendance records and track their progress.";
    const recordsTitle = isStudent ? "My Attendance History" : "Children's Attendance History";
    const recordsDescription = isStudent
      ? "View your attendance records for the selected date range"
      : "View your children's attendance records for the selected date range";
    const noRecordsMessage = isStudent
      ? "No attendance records found for the selected date range."
      : "No attendance records found for your children in the selected date range.";

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Student Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-700 pb-20 pt-16">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/90 via-blue-600/90 to-blue-700/90" />
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <UserCheck className="mr-2 h-4 w-4" />
                {viewTitle}
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Attendance <span className="bg-gradient-to-r from-indigo-200 to-blue-200 bg-clip-text text-transparent">Records</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-indigo-100">
                {viewDescription}
              </p>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
          <div className="mx-auto max-w-7xl">
            {/* Attendance Stats Cards */}
            {isLoading ? (
              <StatsCardLoader count={4} />
            ) : attendanceStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Attendance Rate Card */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-100/90 to-emerald-100/90 backdrop-blur-glass border border-green-200/50 rounded-3xl shadow-premium-lg group-hover:shadow-premium-xl transition-all duration-300"></div>
                  <Card className="relative bg-transparent border-0 shadow-none hover:scale-105 transition-transform duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-700/80">Attendance Rate</p>
                          <p className="text-3xl font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
                            {attendanceStats.attendanceRate.toFixed(1)}%
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Present Days Card */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-100/90 to-indigo-100/90 backdrop-blur-glass border border-blue-200/50 rounded-3xl shadow-premium-lg group-hover:shadow-premium-xl transition-all duration-300"></div>
                  <Card className="relative bg-transparent border-0 shadow-none hover:scale-105 transition-transform duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-700/80">Present Days</p>
                          <p className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
                            {attendanceStats.present}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                          <CheckCircle2 className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Absent Days Card */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-100/90 to-rose-100/90 backdrop-blur-glass border border-red-200/50 rounded-3xl shadow-premium-lg group-hover:shadow-premium-xl transition-all duration-300"></div>
                  <Card className="relative bg-transparent border-0 shadow-none hover:scale-105 transition-transform duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-700/80">Absent Days</p>
                          <p className="text-3xl font-bold bg-gradient-to-r from-red-700 to-rose-600 bg-clip-text text-transparent">
                            {attendanceStats.absent}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 border border-red-200/50">
                          <XCircle className="h-6 w-6 text-red-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Total Days Card */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-100/90 to-violet-100/90 backdrop-blur-glass border border-purple-200/50 rounded-3xl shadow-premium-lg group-hover:shadow-premium-xl transition-all duration-300"></div>
                  <Card className="relative bg-transparent border-0 shadow-none hover:scale-105 transition-transform duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-700/80">Total Days</p>
                          <p className="text-3xl font-bold bg-gradient-to-r from-purple-700 to-violet-600 bg-clip-text text-transparent">
                            {attendanceStats.total}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200/50">
                          <CalendarIcon className="h-6 w-6 text-purple-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}

            {/* Attendance Records Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{recordsTitle}</span>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(startDate, 'PP')} - {format(endDate, 'PP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4" align="end">
                        <div className="space-y-4">
                          <div>
                            <Label>Start Date</Label>
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={(date) => date && setStartDate(date)}
                              initialFocus
                            />
                          </div>
                          <div>
                            <Label>End Date</Label>
                            <Calendar
                              mode="single"
                              selected={endDate}
                              onSelect={(date) => date && setEndDate(date)}
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardTitle>
                <CardDescription>
                  {recordsDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : attendanceRecords.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        {isParent && <TableHead>Child Name</TableHead>}
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Check In Time</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.map((record, index) => {
                        // For parents, find the child's name
                        const childName = isParent && parentChildren
                          ? parentChildren.find(c => c.student_id === record.student_id)
                          : null;
                        const displayName = childName
                          ? [childName.first_name, childName.father_name, childName.grandfather_name].filter(Boolean).join(' ')
                          : null;

                        return (
                        <TableRow key={record.id || index}>
                          <TableCell className="font-medium">
                            {format(new Date(record.attendance_date), 'PPP')}
                          </TableCell>
                          {isParent && <TableCell>{displayName || 'Unknown'}</TableCell>}
                          <TableCell>{formatSubjectLabel(record.subject_id)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(record.status)}>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(record.status)}
                                {record.status}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm') : '-'}
                          </TableCell>
                          <TableCell>{record.notes ?? record.remarks ?? '-'}</TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      {noRecordsMessage}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Admin/Teacher view
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-700 pb-20 pt-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/90 via-blue-600/90 to-blue-700/90" />
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          {/* Enhanced Floating Shapes with Animation */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />
          <div className="absolute top-1/2 left-20 w-8 h-8 bg-white/8 rounded-full animate-pulse delay-300" />
          <div className="absolute top-1/3 right-1/4 w-14 h-14 bg-white/8 rounded-full animate-pulse delay-700" />
          <div className="absolute bottom-1/3 right-10 w-10 h-10 bg-white/8 rounded-full animate-pulse delay-900" />
          <div className="absolute top-1/4 left-1/2 w-6 h-6 bg-white/6 rounded-full animate-pulse delay-400" />
          <div className="absolute bottom-10 left-1/4 w-18 h-18 bg-white/8 rounded-full animate-pulse delay-800" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <Users className="mr-2 h-4 w-4" />
                Student Attendance System
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Attendance <span className="bg-gradient-to-r from-indigo-200 to-blue-200 bg-clip-text text-transparent">Management</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-indigo-100">
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
              {/* Real-time updates via WebSocket - no manual refresh needed */}
            </div>
          </div>

          {/* Premium Analytics Cards */}
          {(userRole !== 'teacher' || (userRole === 'teacher' && selectedClass)) && (
            <div className="mx-auto max-w-7xl">
              {analyticsLoading ? (
                <StatsCardLoader count={4} />
              ) : analytics ? (
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
              ) : null}
            </div>
          )}

          {/* Premium Tabs */}
          <div className="mx-auto max-w-7xl">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-2 shadow-xl">
                <TabsList className={`grid w-full grid-cols-${availableTabs.length} gap-1 bg-transparent p-1`}>
                  {availableTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl py-3 px-4 transition-all duration-300 hover:bg-gray-100 font-medium"
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* Mark Attendance Tab */}
              {(canCreate || canManage) && (
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
                      {selectableClasses.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {formatClassLabel(cls)}
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
                        disabled={(date) => {
                          // For teachers, only allow today's date (disable past and future dates)
                          if (userRole === 'teacher') {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const checkDate = new Date(date);
                            checkDate.setHours(0, 0, 0, 0);
                            return checkDate.getTime() !== today.getTime();
                          }
                          // Admins and other roles can select any date
                          return false;
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Subject selection */}
                <div className="space-y-2">
                  <Label>Subject {userRole === 'teacher' && <span className="text-red-500">*</span>}</Label>
                  <Select
                    value={selectedMarkSubject}
                    onValueChange={(value) => {
                      historySubjectManuallySet.current = false;
                      setSelectedMarkSubject(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>{formatSubjectLabel(subject.id)}</SelectItem>
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
                {(canCreate || canManage) && (
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
                )}

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
                        Array.from({ length: 5 }).map((_, index) => (
                          <TableRow key={index} className="animate-pulse">
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                  <Skeleton key={i} className="h-8 w-20" />
                                ))}
                              </div>
                            </TableCell>
                            <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                          </TableRow>
                        ))
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
              )}

              {/* View Records Tab */}
              {(canRead || canManage) && (
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Class Selection */}
                <div>
                  <Label htmlFor="view-class">Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableClasses.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {formatClassLabel(cls)}
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

                {/* Subject Selection */}
                <div>
                  <Label htmlFor="view-subject">Subject</Label>
                  <Select
                    value={selectedHistorySubject}
                    onValueChange={(value) => {
                      historySubjectManuallySet.current = value !== selectedMarkSubject;
                      setSelectedHistorySubject(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subjects</SelectItem>
                      {filteredSubjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {formatSubjectLabel(subject.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  {selectedHistorySubject === 'all'
                    ? 'Showing all subjects for the selected class'
                    : `Showing ${formatSubjectLabel(selectedHistorySubject)} only`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <TableLoader rows={5} columns={7} />
                ) : existingAttendance.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Subject</TableHead>
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
                          const subjectLabel = formatSubjectLabel(record.subject_id);
                          
                          return (
                            <TableRow key={record.id || `${record.student_id}-${record.subject_id || 'all'}`}>
                              <TableCell className="font-medium">{record.student_id}</TableCell>
                              <TableCell>{fullName}</TableCell>
                              <TableCell>{subjectLabel}</TableCell>
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
                              <TableCell>{record.notes ?? record.remarks ?? '-'}</TableCell>
                              <TableCell>
                                {(canUpdate || canManage) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditRecord(record)}
                                  >
                                    Edit
                                  </Button>
                                )}
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
              )}

              {/* Reports Tab */}
              {(canRead || canManage) && (
                <TabsContent value="reports" className="space-y-4">
                  <AttendanceReports />
                </TabsContent>
              )}
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
              {editingRecord?.subject_id ? ` · ${formatSubjectLabel(editingRecord.subject_id)}` : ''}
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
