import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Save,
  Search,
  UserCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  student_id: string;
  full_name: string;
  class_id: string;
  grade_level: string;
}

interface AttendanceRecord {
  id?: string;
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
}

interface TeacherQuickAttendanceMarkingProps {
  students: Student[];
  classId: string;
  subjectId?: string;
  attendanceDate: Date;
  existingRecords: AttendanceRecord[];
  currentUserId: string;
  onSuccess: () => void;
  isLoading: boolean;
}

type StatusType = 'present' | 'absent' | 'late' | 'excused';

export const TeacherQuickAttendanceMarking: React.FC<TeacherQuickAttendanceMarkingProps> = ({
  students,
  classId,
  subjectId,
  attendanceDate,
  existingRecords,
  currentUserId,
  onSuccess,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [quickMarkStatus, setQuickMarkStatus] = useState<StatusType>('present');
  const [individualStatuses, setIndividualStatuses] = useState<Record<string, StatusType>>({});

  const queryClient = useQueryClient();

  // Initialize individual statuses from existing records
  React.useEffect(() => {
    const statuses: Record<string, StatusType> = {};
    existingRecords.forEach(record => {
      statuses[record.student_id] = record.status;
    });
    setIndividualStatuses(statuses);
  }, [existingRecords]);

  // Mutation for saving attendance
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.createBulkAttendance(data);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Attendance saved successfully',
      });
      setSelectedStudents(new Set());
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save attendance',
        variant: 'destructive',
      });
    },
  });

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleToggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleQuickMark = () => {
    if (selectedStudents.size === 0) {
      toast({
        title: 'No students selected',
        description: 'Please select students to mark attendance',
        variant: 'destructive',
      });
      return;
    }

    const attendanceData = Array.from(selectedStudents).map(studentId => ({
      student_id: studentId,
      status: quickMarkStatus,
    }));

    saveMutation.mutate({
      class_id: classId,
      subject_id: subjectId,
      attendance_date: attendanceDate.toISOString().split('T')[0],
      attendance_records: attendanceData,
      recorded_by: currentUserId,
      send_notifications: quickMarkStatus === 'absent', // Send notifications for absences
    });
  };

  const handleMarkAllPresent = () => {
    const attendanceData = filteredStudents.map(student => ({
      student_id: student.id,
      status: 'present' as StatusType,
    }));

    saveMutation.mutate({
      class_id: classId,
      subject_id: subjectId,
      attendance_date: attendanceDate.toISOString().split('T')[0],
      attendance_records: attendanceData,
      recorded_by: currentUserId,
      send_notifications: false,
    });
  };

  const handleIndividualStatusChange = (studentId: string, status: StatusType) => {
    setIndividualStatuses(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSaveIndividual = () => {
    const changedRecords = Object.entries(individualStatuses)
      .filter(([studentId, status]) => {
        const existing = existingRecords.find(r => r.student_id === studentId);
        return !existing || existing.status !== status;
      })
      .map(([studentId, status]) => ({
        student_id: studentId,
        status,
      }));

    if (changedRecords.length === 0) {
      toast({
        title: 'No changes',
        description: 'No attendance changes to save',
      });
      return;
    }

    saveMutation.mutate({
      class_id: classId,
      subject_id: subjectId,
      attendance_date: attendanceDate.toISOString().split('T')[0],
      attendance_records: changedRecords,
      recorded_by: currentUserId,
      send_notifications: changedRecords.some(r => r.status === 'absent'),
    });
  };

  const getStatusIcon = (status: StatusType) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'absent': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'late': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'excused': return <CheckCircle className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusColor = (status: StatusType) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-200';
      case 'absent': return 'bg-red-100 text-red-800 border-red-200';
      case 'late': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'excused': return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const presentCount = filteredStudents.filter(s => individualStatuses[s.id] === 'present').length;
  const absentCount = filteredStudents.filter(s => individualStatuses[s.id] === 'absent').length;
  const lateCount = filteredStudents.filter(s => individualStatuses[s.id] === 'late').length;
  const notMarkedCount = filteredStudents.filter(s => !individualStatuses[s.id]).length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading students...</span>
        </CardContent>
      </Card>
    );
  }

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
          <p className="text-slate-600">No students found for this class</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200/50 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              Quick Attendance Marking
            </CardTitle>
            <CardDescription>
              Mark attendance for {students.length} students on {attendanceDate.toLocaleDateString()}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-green-50">
              {presentCount} Present
            </Badge>
            <Badge variant="outline" className="bg-red-50">
              {absentCount} Absent
            </Badge>
            {notMarkedCount > 0 && (
              <Badge variant="outline" className="bg-slate-50">
                {notMarkedCount} Not Marked
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="bulk" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="bulk">Bulk Marking</TabsTrigger>
            <TabsTrigger value="individual">Individual Marking</TabsTrigger>
          </TabsList>

          {/* Bulk Marking Tab */}
          <TabsContent value="bulk" className="space-y-4">
            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleMarkAllPresent}
                disabled={saveMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark All Present
              </Button>
              <div className="flex gap-2 flex-1">
                <Select value={quickMarkStatus} onValueChange={(v) => setQuickMarkStatus(v as StatusType)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="excused">Excused</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleQuickMark}
                  disabled={selectedStudents.size === 0 || saveMutation.isPending}
                  className="flex-1"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Mark Selected ({selectedStudents.size})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Student List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {/* Select All Header */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <Checkbox
                  checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="font-medium text-sm">Select All ({filteredStudents.length})</span>
              </div>

              {/* Student Rows */}
              {filteredStudents.map((student) => {
                const isSelected = selectedStudents.has(student.id);
                const currentStatus = individualStatuses[student.id];

                return (
                  <div
                    key={student.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                      isSelected
                        ? "bg-blue-50 border-blue-300"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleStudent(student.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{student.full_name}</p>
                      <p className="text-sm text-slate-600">ID: {student.student_id}</p>
                    </div>
                    {currentStatus && (
                      <Badge className={cn("border", getStatusColor(currentStatus))}>
                        {getStatusIcon(currentStatus)}
                        <span className="ml-1">{currentStatus}</span>
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Individual Marking Tab */}
          <TabsContent value="individual" className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Student Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {filteredStudents.map((student) => {
                const currentStatus = individualStatuses[student.id] || 'present';

                return (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 text-sm">{student.full_name}</p>
                      <p className="text-xs text-slate-600">ID: {student.student_id}</p>
                    </div>
                    <Select
                      value={currentStatus}
                      onValueChange={(v) => handleIndividualStatusChange(student.id, v as StatusType)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            Present
                          </div>
                        </SelectItem>
                        <SelectItem value="absent">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-red-600" />
                            Absent
                          </div>
                        </SelectItem>
                        <SelectItem value="late">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-yellow-600" />
                            Late
                          </div>
                        </SelectItem>
                        <SelectItem value="excused">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-blue-600" />
                            Excused
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSaveIndividual}
              disabled={saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Attendance
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
