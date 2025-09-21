import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown,
  Bell,
  FileText,
  Save,
  Download,
  Filter,
  Search,
  Eye,
  UserCheck,
  AlertCircle,
  MapPin,
  MessageCircle
} from 'lucide-react';
import AttendanceCalendarView from './AttendanceCalendarView';
import QuickAttendanceMobile from './QuickAttendanceMobile';
import { useAttendanceNotifications } from '@/hooks/useAttendanceNotifications';

interface Student {
  id: string;
  student_id: string;
  full_name: string;
  class_id: string;
  grade_level: string;
  parent_contact?: string;
}

interface Class {
  id: string;
  name: string;
  grade_level: string;
  teacher_name?: string;
}

interface AttendanceRecord {
  id?: string;
  student_id: string;
  class_id: string;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused' | 'tardy' | 'early_departure';
  check_in_time?: string;
  check_out_time?: string;
  location?: string;
  notes?: string;
  recorded_by?: string;
  send_notifications?: boolean;
}

interface AttendanceSummary {
  student_id: string;
  period_start: string;
  period_end: string;
  total_days: number;
  days_present: number;
  days_absent: number;
  days_late: number;
  days_excused: number;
  attendance_percentage: number;
  punctuality_percentage: number;
  consecutive_absences: number;
  patterns_detected: string[];
  improvement_trend: 'improving' | 'stable' | 'declining';
}

interface AttendanceAlert {
  id: string;
  student_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggered_date: string;
  acknowledged: boolean;
}

interface AttendanceManagementProps {
  userRole: string;
  currentUserId: string;
}

export const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ 
  userRole, 
  currentUserId 
}) => {
  const [activeTab, setActiveTab] = useState('daily');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('present');
  const [searchTerm, setSearchTerm] = useState('');
  const [sendNotifications, setSendNotifications] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);
  
  const queryClient = useQueryClient();

  // Real-time notifications
  const {
    isConnected,
    notifications,
    unreadCount,
    markAsRead,
    sendAttendanceUpdate
  } = useAttendanceNotifications({
    classId: selectedClass,
    enableToastNotifications: true,
    onNotificationReceived: (notification) => {
      console.log('New attendance notification:', notification);
    },
    onStatsUpdate: (stats) => {
      console.log('Attendance stats updated:', stats);
    }
  });

  // Fetch classes
  const { data: classes = [], isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = await apiClient.get('/classes');
      return response.data;
    },
  });

  // Fetch students for selected class
  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ['students', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const response = await apiClient.get(`/students?class_id=${selectedClass}`);
      return response.data;
    },
    enabled: !!selectedClass,
  });

  // Fetch attendance records for selected class and date
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', selectedClass, selectedDate.toISOString().split('T')[0]],
    queryFn: async () => {
      if (!selectedClass) return [];
      const response = await apiClient.getAttendance({
        class_id: selectedClass,
        date: selectedDate.toISOString().split('T')[0]
      });
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    enabled: !!selectedClass,
  });

  // Fetch attendance alerts
  const { data: alerts = [], isLoading: alertsLoading } = useQuery<AttendanceAlert[]>({
    queryKey: ['attendance-alerts'],
    queryFn: async () => {
      const response = await apiClient.getAttendanceAlerts({ unresolved_only: true });
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  // Mutation for creating/updating attendance
  const attendanceMutation = useMutation({
    mutationFn: async (attendanceData: AttendanceRecord[]) => {
      const response = await apiClient.createBulkAttendance({
        attendance_records: attendanceData,
        class_id: selectedClass,
        attendance_date: selectedDate.toISOString().split('T')[0],
        recorded_by: currentUserId,
        send_notifications: sendNotifications
      });
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-alerts'] });
      
      // Send real-time update notification
      if (sendAttendanceUpdate && data) {
        sendAttendanceUpdate({
          action: 'bulk_attendance_saved',
          class_id: selectedClass,
          date: selectedDate.toISOString().split('T')[0],
          total_records: data.length || attendanceRecords.length,
          timestamp: new Date().toISOString()
        });
      }
    },
    onError: (error) => {
      console.error('Failed to save attendance:', error);
      // You could show a toast notification here
    },
  });

  // Mutation for acknowledging alerts
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiClient.acknowledgeAttendanceAlert(alertId);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-alerts'] });
    },
    onError: (error) => {
      console.error('Failed to acknowledge alert:', error);
    },
  });

  // Helper functions
  const getAttendanceStatus = (studentId: string): AttendanceRecord | undefined => {
    return attendanceRecords.find(record => record.student_id === studentId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle };
      case 'absent': return { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle };
      case 'late': return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock };
      case 'excused': return { bg: 'bg-blue-100', text: 'text-blue-800', icon: CheckCircle };
      case 'tardy': return { bg: 'bg-orange-100', text: 'text-orange-800', icon: Clock };
      case 'early_departure': return { bg: 'bg-purple-100', text: 'text-purple-800', icon: AlertTriangle };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', icon: AlertCircle };
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleStatusChange = (studentId: string, status: string) => {
    const existingRecord = getAttendanceStatus(studentId);
    const updatedRecord: AttendanceRecord = {
      ...existingRecord,
      student_id: studentId,
      class_id: selectedClass,
      attendance_date: selectedDate.toISOString().split('T')[0],
      status: status as any,
      check_in_time: status === 'present' || status === 'late' ? new Date().toISOString() : undefined,
      send_notifications: sendNotifications
    };

    // Update local state and save
    attendanceMutation.mutate([updatedRecord]);
  };

  const handleBulkStatusChange = () => {
    if (selectedStudents.length === 0) return;

    const bulkRecords: AttendanceRecord[] = selectedStudents.map(studentId => ({
      student_id: studentId,
      class_id: selectedClass,
      attendance_date: selectedDate.toISOString().split('T')[0],
      status: bulkStatus as any,
      check_in_time: bulkStatus === 'present' || bulkStatus === 'late' ? new Date().toISOString() : undefined,
      send_notifications: sendNotifications
    }));

    attendanceMutation.mutate(bulkRecords);
    setSelectedStudents([]);
  };

  const handleSelectAllStudents = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  };

  const handleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const acknowledgeAlert = (alertId: string) => {
    acknowledgeAlertMutation.mutate(alertId);
  };

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!['admin', 'teacher', 'superadmin'].includes(userRole)) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600">You don't have permission to access attendance management.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Premium Header */}
      <div className="relative">
        {/* Background card with glass morphism */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>

        <Card className="relative bg-transparent border-0 shadow-none">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                      Attendance Management
                    </CardTitle>
                    {/* Premium Connection Status Indicator */}
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-white/40 shadow-sm">
                      <div className={`w-2 h-2 rounded-full ${
                        isConnected
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-sm shadow-green-300'
                          : 'bg-gradient-to-r from-red-500 to-rose-500 shadow-sm shadow-red-300'
                      }`}></div>
                      <span className={`text-xs font-medium ${
                        isConnected ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {isConnected ? 'Live' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed">Manage student attendance with real-time tracking and analytics</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Premium Notifications Badge */}
                <Button
                  variant="outline"
                  size="sm"
                  className="relative group overflow-hidden bg-white/90 hover:bg-blue-50 border-blue-200/50 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105"
                  onClick={() => setShowAlerts(!showAlerts)}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Bell className="h-4 w-4 text-blue-600" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-gradient-to-r from-red-500 to-rose-500 text-white border-2 border-white shadow-lg">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAlerts(!showAlerts)}
                  className={`group relative overflow-hidden bg-white/90 hover:bg-orange-50 border-orange-200/50 hover:border-orange-300 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105 ${
                    alerts.length > 0 ? 'text-orange-600 border-orange-300' : ''
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Alerts {alerts.length > 0 && (
                    <Badge className="ml-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                      {alerts.length}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Premium Attendance Alerts Panel */}
      {showAlerts && alerts.length > 0 && (
        <div className="relative">
          {/* Premium glass card background */}
          <div className="absolute inset-0 bg-white/95 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/8 via-orange-500/5 to-rose-500/8 rounded-3xl pointer-events-none"></div>

          <Card className="relative bg-transparent border-0 shadow-none">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-red-700 via-rose-700 to-pink-700 bg-clip-text text-transparent flex items-center">
                <div className="p-2 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 border border-red-200/50 mr-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                Attendance Alerts
              </CardTitle>
              <p className="text-slate-600 leading-relaxed">
                Critical attendance notifications requiring attention
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="relative group"
                  >
                    {/* Premium alert card background */}
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
                    <div className={`absolute inset-0 rounded-2xl pointer-events-none ${
                      alert.severity === 'critical' ? 'bg-gradient-to-r from-red-500/10 to-rose-500/10' :
                      alert.severity === 'high' ? 'bg-gradient-to-r from-orange-500/10 to-amber-500/10' :
                      alert.severity === 'medium' ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10' :
                      'bg-gradient-to-r from-blue-500/10 to-indigo-500/10'
                    }`}></div>

                    <div className="relative p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900 mb-1">{alert.message}</p>
                          <p className="text-sm text-slate-600">
                            {new Date(alert.triggered_date).toLocaleDateString()} - {alert.alert_type}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge className={`px-3 py-1 font-medium ${
                            alert.severity === 'critical' ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white' :
                            alert.severity === 'high' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' :
                            alert.severity === 'medium' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' :
                            'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                          }`}>
                            {alert.severity}
                          </Badge>
                          {!alert.acknowledged && (
                            <Button
                              size="sm"
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="group relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Premium Tab Navigation */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-2xl shadow-premium"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-2xl pointer-events-none"></div>

          <TabsList className="relative bg-transparent border-0 grid w-full grid-cols-6 text-xs p-2">
            <TabsTrigger
              value="daily"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Daily
            </TabsTrigger>
            <TabsTrigger
              value="mobile"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Mobile
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Calendar
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Reports
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-blue-50 transition-all duration-300 rounded-xl font-medium"
            >
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="daily" className="space-y-6">
          {/* Premium Class Selection and Date Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent flex items-center">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50 mr-3">
                    <CalendarIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  Daily Attendance Tracking
                </CardTitle>
                <p className="text-slate-600 leading-relaxed">
                  Select a class and date to track attendance with real-time updates
                </p>
              </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="class-select">Select Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} - {cls.grade_level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Date</Label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    disabled={(date) => date > new Date()}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <Label>Settings</Label>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={sendNotifications}
                        onCheckedChange={setSendNotifications}
                      />
                      <Label className="text-sm">Send notifications to parents</Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

          {/* Premium Student Attendance List */}
          {selectedClass && (
            <div className="relative">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-emerald-500/5 rounded-3xl pointer-events-none"></div>

              <Card className="relative bg-transparent border-0 shadow-none">
                <CardHeader className="pb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 via-green-800 to-emerald-900 bg-clip-text text-transparent flex items-center">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50 mr-3">
                          <Users className="h-5 w-5 text-green-600" />
                        </div>
                        Student Attendance - {selectedDate.toLocaleDateString()}
                      </CardTitle>
                      <p className="text-slate-600 leading-relaxed mt-1">
                        Mark attendance for students with bulk actions and real-time sync
                      </p>
                    </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      <Search className="h-4 w-4" />
                      <Input
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Premium Bulk Actions */}
                {selectedStudents.length > 0 && (
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/8 to-blue-500/10 rounded-2xl pointer-events-none"></div>

                    <div className="relative flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 p-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {selectedStudents.length} students selected
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Select value={bulkStatus} onValueChange={setBulkStatus}>
                          <SelectTrigger className="w-40 bg-white/80 border-blue-200/50 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                            <SelectItem value="late">Late</SelectItem>
                            <SelectItem value="excused">Excused</SelectItem>
                            <SelectItem value="tardy">Tardy</SelectItem>
                            <SelectItem value="early_departure">Early Departure</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleBulkStatusChange}
                          size="sm"
                          disabled={attendanceMutation.isPending}
                          className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          {attendanceMutation.isPending ? (
                            <>
                              <div className="animate-spin h-4 w-4 mr-2 rounded-full border-2 border-white/30 border-t-white"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                              Apply to Selected
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardHeader>
              
              <CardContent>
                {studentsLoading ? (
                  <div className="text-center py-8">Loading students...</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No students found for this class
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Premium Select All Header */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl"></div>
                      <div className="relative flex items-center space-x-3 p-4 border-b border-blue-200/30">
                        <Checkbox
                          checked={selectedStudents.length === filteredStudents.length}
                          onCheckedChange={handleSelectAllStudents}
                          className="border-blue-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        <span className="font-semibold text-sm text-slate-900">Select All</span>
                        <div className="flex-1" />
                        <span className="text-xs font-medium text-slate-600 w-20 sm:w-24 hidden sm:block">Status</span>
                        <span className="text-xs font-medium text-slate-600 w-16 sm:w-20">Actions</span>
                      </div>
                    </div>
                    
                    {/* Student Rows */}
                    {filteredStudents.map((student) => {
                      const attendanceRecord = getAttendanceStatus(student.id);
                      const status = attendanceRecord?.status || 'not_marked';
                      const statusInfo = getStatusColor(status);
                      const StatusIcon = statusInfo.icon;

                      return (
                        <div key={student.id} className="relative group">
                          <div className="absolute inset-0 bg-white/80 hover:bg-white/95 border border-white/30 hover:border-blue-200/50 rounded-2xl shadow-sm hover:shadow-premium transition-all duration-300"></div>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/3 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300"></div>

                          <div className="relative flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 p-4">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={selectedStudents.includes(student.id)}
                                onCheckedChange={() => handleStudentSelection(student.id)}
                                className="border-blue-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />

                              <div className="flex items-center space-x-3 flex-1">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg">
                                  {student.full_name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900">{student.full_name}</p>
                                  <p className="text-sm text-slate-600">
                                    ID: {student.student_id}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end space-x-4 sm:space-x-4">
                              <div className="sm:w-24">
                                <Badge className={`${statusInfo.bg} ${statusInfo.text} text-xs px-3 py-1 font-medium shadow-sm`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">
                                    {status === 'not_marked' ? 'Not Marked' : status}
                                  </span>
                                  <span className="sm:hidden">
                                    {status === 'not_marked' ? 'Not Set' : status.charAt(0).toUpperCase()}
                                  </span>
                                </Badge>
                              </div>

                              <div className="w-32 sm:w-24">
                                <Select
                                  value={status === 'not_marked' ? '' : status}
                                  onValueChange={(value) => handleStatusChange(student.id, value)}
                                  disabled={attendanceMutation.isPending}
                                >
                                  <SelectTrigger className="w-full bg-white/80 border-blue-200/50 hover:border-blue-300 shadow-sm hover:shadow-md transition-all duration-300">
                                    <SelectValue placeholder="Mark" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="present">Present</SelectItem>
                                    <SelectItem value="absent">Absent</SelectItem>
                                    <SelectItem value="late">Late</SelectItem>
                                    <SelectItem value="excused">Excused</SelectItem>
                                    <SelectItem value="tardy">Tardy</SelectItem>
                                    <SelectItem value="early_departure">Early Departure</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          )}
        </TabsContent>

        <TabsContent value="mobile" className="space-y-6">
          <QuickAttendanceMobile
            selectedClass={selectedClass}
            selectedDate={selectedDate}
            onAttendanceUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['attendance'] });
            }}
          />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <AttendanceCalendarView
            selectedClass={selectedClass}
            onDateSelect={(date) => {
              setSelectedDate(date);
              setActiveTab('daily'); // Switch to daily tab when a date is selected
            }}
          />
        </TabsContent>

        <TabsContent value="summary">
          <AttendanceSummaryTab 
            selectedClass={selectedClass}
            students={filteredStudents}
            dateRange={{ start: selectedDate, end: selectedDate }}
          />
        </TabsContent>

        <TabsContent value="reports">
          <AttendanceReportsTab 
            selectedClass={selectedClass}
            selectedDate={selectedDate}
          />
        </TabsContent>

        <TabsContent value="settings">
          {/* Premium Settings Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 via-transparent to-gray-500/5 rounded-3xl pointer-events-none"></div>

            <Card className="relative bg-transparent border-0 shadow-none">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 via-gray-800 to-slate-900 bg-clip-text text-transparent">
                  Attendance Settings
                </CardTitle>
                <p className="text-slate-600 leading-relaxed">
                  Configure notification preferences and automated attendance features
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="space-y-4">
                    <Label className="text-lg font-semibold text-slate-900">Notification Preferences</Label>
                    <div className="space-y-4 pl-4">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-white/40">
                        <Label className="text-sm font-medium text-slate-700">Send immediate absence notifications</Label>
                        <Switch
                          defaultChecked
                          className="data-[state=checked]:bg-blue-600"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-white/40">
                        <Label className="text-sm font-medium text-slate-700">Send late arrival notifications</Label>
                        <Switch
                          defaultChecked
                          className="data-[state=checked]:bg-blue-600"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-white/40">
                        <Label className="text-sm font-medium text-slate-700">Pattern detection alerts</Label>
                        <Switch
                          defaultChecked
                          className="data-[state=checked]:bg-blue-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-lg font-semibold text-slate-900">Auto-Mark Settings</Label>
                    <div className="space-y-4 pl-4">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-white/40">
                        <Label className="text-sm font-medium text-slate-700">Auto-mark absent after 2 hours</Label>
                        <Switch className="data-[state=checked]:bg-blue-600" />
                      </div>
                    </div>
                  </div>

                  <Button className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Save className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Attendance Summary Tab Component
interface AttendanceSummaryTabProps {
  selectedClass: string;
  students: Student[];
  dateRange: { start: Date; end: Date };
}

const AttendanceSummaryTab: React.FC<AttendanceSummaryTabProps> = ({
  selectedClass,
  students,
  dateRange
}) => {
  const [selectedStudent, setSelectedStudent] = useState<string>('');

  // Fetch attendance summary for selected student
  const { data: attendanceSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['attendance-summary', selectedStudent, dateRange.start.toISOString().split('T')[0]],
    queryFn: async () => {
      if (!selectedStudent) return null;
      const response = await apiClient.getAttendanceSummary(
        selectedStudent,
        dateRange.start.toISOString().split('T')[0],
        dateRange.end.toISOString().split('T')[0]
      );
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    enabled: !!selectedStudent,
  });

  return (
    <div className="space-y-6">
      {/* Premium Summary Card */}
      <div className="relative">
        <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

        <Card className="relative bg-transparent border-0 shadow-none">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 via-purple-800 to-indigo-900 bg-clip-text text-transparent">
              Student Attendance Summary
            </CardTitle>
            <p className="text-slate-600 leading-relaxed mb-4">
              Detailed analytics and insights for individual student attendance patterns
            </p>
            <div className="flex items-center space-x-4">
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="w-64 bg-white/80 border-purple-200/50 hover:border-purple-300 shadow-sm hover:shadow-md transition-all duration-300">
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        <CardContent>
          {!selectedStudent ? (
            <p className="text-muted-foreground text-center py-8">
              Select a student to view their attendance summary
            </p>
          ) : summaryLoading ? (
            <div className="text-center py-8">Loading summary...</div>
          ) : attendanceSummary ? (
            <div className="space-y-6">
              {/* Premium Summary Stats */}
              <div className="grid gap-6 md:grid-cols-4">
                {/* Attendance Rate */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 to-emerald-500/8 rounded-2xl pointer-events-none"></div>
                  <Card className="relative bg-transparent border-0 shadow-none">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold bg-gradient-to-br from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                        {attendanceSummary.attendance_percentage?.toFixed(1)}%
                      </div>
                      <p className="text-sm font-medium text-slate-600">Attendance Rate</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Days Present */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 to-indigo-500/8 rounded-2xl pointer-events-none"></div>
                  <Card className="relative bg-transparent border-0 shadow-none">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                        {attendanceSummary.days_present}
                      </div>
                      <p className="text-sm font-medium text-slate-600">Days Present</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Days Absent */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/8 to-rose-500/8 rounded-2xl pointer-events-none"></div>
                  <Card className="relative bg-transparent border-0 shadow-none">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold bg-gradient-to-br from-red-600 to-rose-600 bg-clip-text text-transparent mb-2">
                        {attendanceSummary.days_absent}
                      </div>
                      <p className="text-sm font-medium text-slate-600">Days Absent</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Days Late */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/8 to-orange-500/8 rounded-2xl pointer-events-none"></div>
                  <Card className="relative bg-transparent border-0 shadow-none">
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold bg-gradient-to-br from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-2">
                        {attendanceSummary.days_late}
                      </div>
                      <p className="text-sm font-medium text-slate-600">Days Late</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Attendance Patterns */}
              {attendanceSummary.patterns_detected?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detected Patterns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {attendanceSummary.patterns_detected.map((pattern: string, index: number) => (
                        <Badge key={index} variant="outline" className="mr-2">
                          {pattern.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Trend Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Trend Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      {attendanceSummary.improvement_trend === 'improving' ? 
                        <TrendingUp className="h-5 w-5 text-green-600 mr-2" /> :
                        attendanceSummary.improvement_trend === 'declining' ?
                        <TrendingDown className="h-5 w-5 text-red-600 mr-2" /> :
                        <div className="h-5 w-5 bg-gray-400 rounded-full mr-2" />
                      }
                      <span className="capitalize font-medium">
                        {attendanceSummary.improvement_trend}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Current streak: {attendanceSummary.current_streak} days
                    </div>
                    {attendanceSummary.consecutive_absences > 0 && (
                      <Badge variant="destructive">
                        {attendanceSummary.consecutive_absences} consecutive absences
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No attendance data found for this student
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  </div>
  );
};

// Attendance Reports Tab Component
interface AttendanceReportsTabProps {
  selectedClass: string;
  selectedDate: Date;
}

const AttendanceReportsTab: React.FC<AttendanceReportsTabProps> = ({
  selectedClass,
  selectedDate
}) => {
  const [reportType, setReportType] = useState('daily');
  const [reportFormat, setReportFormat] = useState('pdf');

  // Generate report
  const reportMutation = useMutation({
    mutationFn: async (params: any) => {
      const response = await apiClient.exportAttendanceReport(params);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Report generated:', data);
      // Handle report download or display
    },
    onError: (error) => {
      console.error('Failed to generate report:', error);
    },
  });

  const handleGenerateReport = () => {
    const params = {
      type: reportType,
      format: reportFormat,
      ...(selectedClass && { class_id: selectedClass }),
      ...(reportType === 'daily' && { 
        period_days: 1,
        // You might want to add specific date handling here
      }),
    };

    reportMutation.mutate(params);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Attendance Reports
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="report-type">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Report</SelectItem>
                  <SelectItem value="weekly">Weekly Report</SelectItem>
                  <SelectItem value="monthly">Monthly Report</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="report-format">Format</Label>
              <Select value={reportFormat} onValueChange={setReportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium mb-2">Report Preview</h4>
              <p className="text-sm text-muted-foreground">
                {reportType === 'daily' && `Daily attendance report for ${selectedDate.toLocaleDateString()}`}
                {reportType === 'weekly' && 'Weekly attendance summary with trends and patterns'}
                {reportType === 'monthly' && 'Monthly attendance analysis with detailed statistics'}
                {reportType === 'comprehensive' && 'Comprehensive attendance report with analytics and insights'}
              </p>
              {selectedClass && (
                <p className="text-sm text-muted-foreground mt-1">
                  Filtered for selected class
                </p>
              )}
            </div>

            <Button 
              onClick={handleGenerateReport}
              disabled={reportMutation.isPending}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {reportMutation.isPending ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceManagement;