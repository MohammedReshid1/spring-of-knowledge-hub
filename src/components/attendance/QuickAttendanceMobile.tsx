import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Save, 
  Users,
  Calendar as CalendarIcon,
  Filter,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';

interface Student {
  id: string;
  student_id: string;
  full_name: string;
  class_id: string;
  status: string;
}

interface QuickAttendanceMobileProps {
  selectedClass: string;
  selectedDate: Date;
  onAttendanceUpdate?: () => void;
  className?: string;
}

const QuickAttendanceMobile: React.FC<QuickAttendanceMobileProps> = ({
  selectedClass,
  selectedDate,
  onAttendanceUpdate,
  className = ""
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [attendanceData, setAttendanceData] = useState<{ [key: string]: string }>({});
  
  const queryClient = useQueryClient();

  // Fetch students for selected class
  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ['students', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const response = await apiClient.getAllStudents();
      if (response.error) throw new Error(response.error);
      return (response.data || []).filter((student: any) => student.class_id === selectedClass);
    },
    enabled: !!selectedClass,
  });

  // Fetch existing attendance for the date
  const { data: existingAttendance = [] } = useQuery({
    queryKey: ['attendance', selectedClass, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedClass) return [];
      const response = await apiClient.getAttendance({
        class_id: selectedClass,
        date: format(selectedDate, 'yyyy-MM-dd')
      });
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    enabled: !!selectedClass,
  });

  // Initialize attendance data when existing data is loaded
  React.useEffect(() => {
    if (existingAttendance.length > 0) {
      const initialData: { [key: string]: string } = {};
      existingAttendance.forEach((record: any) => {
        initialData[record.student_id] = record.status;
      });
      setAttendanceData(initialData);
    }
  }, [existingAttendance]);

  // Save attendance mutation
  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      const attendanceRecords = Object.entries(attendanceData).map(([studentId, status]) => ({
        student_id: studentId,
        status,
        attendance_date: format(selectedDate, 'yyyy-MM-dd'),
        recorded_by: 'current_user', // This would come from user context
        notes: ''
      }));

      const response = await apiClient.createBulkAttendance({
        attendance_records: attendanceRecords,
        class_id: selectedClass,
        attendance_date: format(selectedDate, 'yyyy-MM-dd'),
        recorded_by: 'current_user'
      });

      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      onAttendanceUpdate?.();
    },
  });

  // Filter students based on search and status
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = searchTerm === '' || 
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
        attendanceData[student.id] === statusFilter ||
        (statusFilter === 'unmarked' && !attendanceData[student.id]);
      
      return matchesSearch && matchesStatus;
    });
  }, [students, searchTerm, statusFilter, attendanceData]);

  const setStudentStatus = (studentId: string, status: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'absent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'late':
      case 'tardy':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'excused':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4" />;
      case 'absent':
        return <XCircle className="h-4 w-4" />;
      case 'late':
      case 'tardy':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getAttendanceSummary = () => {
    const totalStudents = students.length;
    const markedStudents = Object.keys(attendanceData).length;
    const presentCount = Object.values(attendanceData).filter(status => status === 'present').length;
    const absentCount = Object.values(attendanceData).filter(status => status === 'absent').length;
    const lateCount = Object.values(attendanceData).filter(status => status === 'late' || status === 'tardy').length;
    
    return { totalStudents, markedStudents, presentCount, absentCount, lateCount };
  };

  const summary = getAttendanceSummary();

  if (studentsLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p>Loading students...</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Premium Header */}
      <div className="relative">
        {/* Background card with glass morphism */}
        <div className="absolute inset-0 bg-white/90 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>

        <Card className="relative bg-transparent border-0 shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-xl">
              <div className="flex items-center">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50 mr-3">
                  <CalendarIcon className="h-5 w-5 text-blue-600" />
                </div>
                <span className="font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                  Quick Attendance
                </span>
              </div>
              <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200/50 text-xs font-medium">
                {format(selectedDate, 'MMM d, yyyy')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
          {/* Premium Summary Stats */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl"></div>
              <div className="relative text-center p-3 bg-white/60 backdrop-blur-sm border border-blue-200/30 rounded-2xl">
                <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{summary.totalStudents}</div>
                <div className="text-xs font-medium text-blue-600">Total</div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-2xl"></div>
              <div className="relative text-center p-3 bg-white/60 backdrop-blur-sm border border-emerald-200/30 rounded-2xl">
                <div className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">{summary.presentCount}</div>
                <div className="text-xs font-medium text-emerald-600">Present</div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-rose-500/10 rounded-2xl"></div>
              <div className="relative text-center p-3 bg-white/60 backdrop-blur-sm border border-red-200/30 rounded-2xl">
                <div className="text-xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">{summary.absentCount}</div>
                <div className="text-xs font-medium text-red-600">Absent</div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 rounded-2xl"></div>
              <div className="relative text-center p-3 bg-white/60 backdrop-blur-sm border border-amber-200/30 rounded-2xl">
                <div className="text-xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">{summary.lateCount}</div>
                <div className="text-xs font-medium text-amber-600">Late</div>
              </div>
            </div>
          </div>

          {/* Premium Search and Filters */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-400" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-white/60 backdrop-blur-sm border-blue-200/50 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
              />
            </div>

            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                <Filter className="h-4 w-4 text-blue-600" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 h-12 bg-white/60 backdrop-blur-sm border-blue-200/50 rounded-2xl shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="unmarked">Unmarked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium Student List */}
      <div className="space-y-3">
        {filteredStudents.map((student) => {
          const currentStatus = attendanceData[student.id];

          return (
            <div key={student.id} className="relative">
              {/* Premium glass card background */}
              <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/40 rounded-3xl shadow-premium"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

              <Card className="relative bg-transparent border-0 shadow-none p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-800 text-base">{student.full_name}</h4>
                    <p className="text-sm text-slate-500 font-medium">ID: {student.student_id}</p>
                  </div>
                  {currentStatus && (
                    <Badge className={`${getStatusColor(currentStatus)} border shadow-sm font-medium`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(currentStatus)}
                        <span className="text-xs capitalize">{currentStatus}</span>
                      </div>
                    </Badge>
                  )}
                </div>
              
                {/* Premium Status Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={currentStatus === 'present' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStudentStatus(student.id, 'present')}
                    className={`h-11 text-xs font-medium rounded-2xl transition-all duration-300 transform hover:scale-105 ${
                      currentStatus === 'present'
                        ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg'
                        : 'bg-white/60 backdrop-blur-sm border-emerald-200/50 text-emerald-700 hover:bg-emerald-50/80'
                    }`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Present
                  </Button>
                  <Button
                    variant={currentStatus === 'absent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStudentStatus(student.id, 'absent')}
                    className={`h-11 text-xs font-medium rounded-2xl transition-all duration-300 transform hover:scale-105 ${
                      currentStatus === 'absent'
                        ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg'
                        : 'bg-white/60 backdrop-blur-sm border-red-200/50 text-red-700 hover:bg-red-50/80'
                    }`}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Absent
                  </Button>
                  <Button
                    variant={currentStatus === 'late' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStudentStatus(student.id, 'late')}
                    className={`h-11 text-xs font-medium rounded-2xl transition-all duration-300 transform hover:scale-105 ${
                      currentStatus === 'late'
                        ? 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white shadow-lg'
                        : 'bg-white/60 backdrop-blur-sm border-amber-200/50 text-amber-700 hover:bg-amber-50/80'
                    }`}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Late
                  </Button>
                  <Button
                    variant={currentStatus === 'excused' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStudentStatus(student.id, 'excused')}
                    className={`h-11 text-xs font-medium rounded-2xl transition-all duration-300 transform hover:scale-105 ${
                      currentStatus === 'excused'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg'
                        : 'bg-white/60 backdrop-blur-sm border-blue-200/50 text-blue-700 hover:bg-blue-50/80'
                    }`}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Excused
                  </Button>
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Premium Save Button */}
      {Object.keys(attendanceData).length > 0 && (
        <div className="relative">
          {/* Premium glass card background */}
          <div className="absolute inset-0 bg-white/95 backdrop-blur-premium border border-white/50 rounded-3xl shadow-premium-lg"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 rounded-3xl pointer-events-none"></div>

          <Card className="relative bg-transparent border-0 shadow-none sticky bottom-4">
            <CardContent className="p-5">
              <Button
                onClick={() => saveAttendanceMutation.mutate()}
                disabled={saveAttendanceMutation.isPending}
                className="w-full h-14 text-base font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                {saveAttendanceMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-3"></div>
                    <span>Saving Attendance...</span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="h-5 w-5 mr-3" />
                    <span>Save Attendance ({summary.markedStudents}/{summary.totalStudents})</span>
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default QuickAttendanceMobile;