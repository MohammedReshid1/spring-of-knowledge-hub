import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TimetableAPI } from '@/services/timetableApi';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { usePermissionCheck, useRoleAccess } from '@/contexts/RoleAccessContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear, getAcademicYearString } from '@/hooks/useAcademicYear';
import { useLiveData } from '@/hooks/useLiveData';
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Edit3,
  Trash2,
  Download,
  Upload,
  Settings,
  Eye,
  Copy,
  Shuffle,
  RefreshCw,
  FileText,
  BarChart3,
  Filter,
  Search,
  Zap,
  Bell,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type {
  TimeSlot,
  TimetableEntry,
  TimetableConflict,
  ClassTimetableView,
  TeacherTimetableView,
  TimetableStats,
  TimetableExportRequest,
  Room,
  RoomCreate,
  Substitution,
  DayOfWeek
} from '@/types/timetable';
import type { SchoolClass, Subject, Teacher } from '@/types/api';
import TimeSlotManagement from './TimeSlotManagement';
import RoomManagement from './RoomManagement';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' }
];

const PERIOD_TYPES = [
  { value: 'regular', label: 'Regular Class' },
  { value: 'break', label: 'Break' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'assembly', label: 'Assembly' },
  { value: 'sports', label: 'Sports' },
  { value: 'library', label: 'Library' },
  { value: 'lab', label: 'Laboratory' }
];

export const TimetableManagement: React.FC = () => {
  // Context hooks
  const { user } = useAuth();
  const { hasPermission } = usePermissionCheck();
  const { loading: permissionsLoading } = useRoleAccess();
  const academicYearQuery = useAcademicYear();
  const currentAcademicYear = getAcademicYearString(academicYearQuery);

  // Permission checks
  const canView = hasPermission('timetable.read') || hasPermission('timetable.manage');
  const canCreate = hasPermission('timetable.create') || hasPermission('timetable.manage');
  const canUpdate = hasPermission('timetable.update') || hasPermission('timetable.manage');
  const canDelete = hasPermission('timetable.delete') || hasPermission('timetable.manage');
  const canManage = hasPermission('timetable.manage');

  // Get branch from user profile
  const branchId = user?.profile?.branch_id;
  const [activeTab, setActiveTab] = useState('schedule');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [showConflicts, setShowConflicts] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'room'>('class');

  const queryClient = useQueryClient();

  // Enable real-time updates for timetable data
  useLiveData(['timetable-entries', 'timetable-view', 'timetable-conflicts', 'timetable-stats', 'classes', 'teachers', 'subjects', 'rooms', 'time-slots'], {
    additionalQueryKeys: ['classes', 'teachers', 'subjects']
  });

  // Fetch data
  const { data: classes = [], isLoading: classesLoading } = useQuery<SchoolClass[]>({
    queryKey: ['classes', branchId],
    queryFn: async () => {
      const { data, error } = await apiClient.request('/classes');
      if (error) throw new Error(error);
      // Filter classes by branch if specified
      const allClasses = data || [];
      if (branchId && branchId !== 'all') {
        return allClasses.filter((cls: any) => cls.branch_id === branchId);
      }
      return allClasses;
    }
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await apiClient.request('/subjects');
      if (error) throw new Error(error);
      return data || [];
    }
  });

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ['teachers', branchId],
    queryFn: async () => {
      const { data, error } = await apiClient.request('/teachers');
      if (error) throw new Error(error);
      // Filter teachers by branch if specified
      const allTeachers = data || [];
      if (branchId && branchId !== 'all') {
        return allTeachers.filter((teacher: any) => teacher.branch_id === branchId);
      }
      return allTeachers;
    }
  });

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['rooms', branchId],
    queryFn: () => TimetableAPI.getRooms({ limit: 100 })
  });

  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ['time-slots', branchId],
    queryFn: () => TimetableAPI.getTimeSlots({ limit: 100 })
  });

  const { data: timetableData, isLoading: timetableLoading } = useQuery<ClassTimetableView | TeacherTimetableView | null>({
    queryKey: ['timetable-view', selectedClass, viewMode],
    queryFn: async () => {
      if (!selectedClass) return null;

      if (viewMode === 'class') {
        return await TimetableAPI.getClassTimetable(selectedClass);
      } else if (viewMode === 'teacher') {
        return await TimetableAPI.getTeacherTimetable(selectedClass);
      }

      return null;
    },
    enabled: !!selectedClass
  });

  const { data: timetableEntries = [] } = useQuery<TimetableEntry[]>({
    queryKey: ['timetable-entries', selectedClass, viewMode, rooms.length],
    queryFn: async () => {
      if (!selectedClass) return [];

      const params: any = { limit: 500 };

      if (viewMode === 'class') {
        params.class_id = selectedClass;
      } else if (viewMode === 'teacher') {
        params.teacher_id = selectedClass;
      } else if (viewMode === 'room') {
        // For room view, fetch all entries and filter by room_number on client side
        const allEntries = await TimetableAPI.getEntries(params);
        const selectedRoom = rooms.find(r => r.id === selectedClass);
        if (selectedRoom) {
          return allEntries.filter(entry => entry.room_number === selectedRoom.room_number);
        }
        return [];
      }

      return TimetableAPI.getEntries(params);
    },
    enabled: !!selectedClass && (viewMode !== 'room' || rooms.length > 0)
  });

  const { data: conflicts = [] } = useQuery<TimetableConflict[]>({
    queryKey: ['timetable-conflicts'],
    queryFn: () => TimetableAPI.getConflicts({ resolved: false })
  });

  const { data: stats } = useQuery<TimetableStats>({
    queryKey: ['timetable-stats', branchId],
    queryFn: () => TimetableAPI.getStats()
  });

  // Mutations
  const createEntryMutation = useMutation({
    mutationFn: (entry: any) => TimetableAPI.createEntry(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-conflicts'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-view'] });
      setShowCreateDialog(false);
      setEditingEntry(null);
      toast({
        title: "Success",
        description: "Timetable entry created successfully",
      });
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || error.message || "Failed to create entry";
      if (message.includes('Critical conflicts')) {
        toast({
          title: "Conflict Detected",
          description: "Entry created but has conflicts. Check conflicts tab.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }
    }
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, ...entry }: any) => TimetableAPI.updateEntry(id, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-view'] });
      setEditingEntry(null);
      toast({
        title: "Success",
        description: "Timetable entry updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update entry",
        variant: "destructive",
      });
    }
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => TimetableAPI.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-view'] });
      toast({
        title: "Success",
        description: "Timetable entry deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete entry",
        variant: "destructive",
      });
    }
  });

  const resolveConflictMutation = useMutation({
    mutationFn: ({ conflictId, notes }: { conflictId: string; notes: string }) =>
      TimetableAPI.resolveConflict(conflictId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-conflicts'] });
      toast({
        title: "Success",
        description: "Conflict resolved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to resolve conflict",
        variant: "destructive",
      });
    }
  });

  const exportTimetableMutation = useMutation({
    mutationFn: (exportRequest: TimetableExportRequest) =>
      TimetableAPI.exportTimetable(exportRequest),
    onSuccess: (data) => {
      toast({
        title: "Export Started",
        description: `Timetable export started. Download will be available shortly.`,
      });
      if (data.download_url) {
        window.open(data.download_url, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.response?.data?.detail || "Failed to export timetable",
        variant: "destructive",
      });
    }
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (entries: any[]) =>
      TimetableAPI.createBulkEntries({
        entries,
        auto_resolve_conflicts: false,
        notify_affected_users: true
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['timetable-entries'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-conflicts'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-view'] });
      toast({
        title: "Success",
        description: `Created ${data.length} timetable entries`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Create Failed",
        description: error.response?.data?.detail || "Failed to create timetable entries",
        variant: "destructive",
      });
    }
  });

  // Helper functions
  const getConflictColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50 text-red-800';
      case 'high': return 'border-orange-500 bg-orange-50 text-orange-800';
      case 'medium': return 'border-yellow-500 bg-yellow-50 text-yellow-800';
      case 'low': return 'border-blue-500 bg-blue-50 text-blue-800';
      default: return 'border-gray-500 bg-gray-50 text-gray-800';
    }
  };

  const getTimeSlotByPeriod = (periodNumber: number) => {
    return timeSlots.find(slot => slot.period_number === periodNumber);
  };

  const getEntryForSlot = (day: string, timeSlotId: string) => {
    return timetableEntries.find(
      entry => entry.day_of_week === day && entry.time_slot_id === timeSlotId
    );
  };

  const getSubjectName = (subjectId?: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject ? subject.subject_name : 'No Subject';
  };

  const getTeacherName = (teacherId?: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher ? `${teacher.first_name} ${teacher.last_name}` : 'No Teacher';
  };

  const handleCreateEntry = (day: string, timeSlotId: string) => {
    setEditingEntry({
      class_id: selectedClass,
      day_of_week: day,
      time_slot_id: timeSlotId,
      subject_id: '',
      teacher_id: '',
      room_number: '',
      notes: '',
      resources_needed: [],
      academic_year: currentAcademicYear
    });
    setShowCreateDialog(true);
  };

  const handleEditEntry = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setShowCreateDialog(true);
  };

  const handleSaveEntry = () => {
    if (!editingEntry) return;

    if (editingEntry.id) {
      updateEntryMutation.mutate(editingEntry as TimetableEntry & { id: string });
    } else {
      createEntryMutation.mutate(editingEntry);
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    if (confirm('Are you sure you want to delete this timetable entry?')) {
      deleteEntryMutation.mutate(entryId);
    }
  };

  const handleResolveConflict = (conflictId: string, notes: string) => {
    resolveConflictMutation.mutate({ conflictId, notes });
  };

  const handleExportTimetable = (format: TimetableExportRequest['format']) => {
    if (!selectedClass) {
      toast({
        title: "Export Error",
        description: "Please select a class, teacher, or room to export",
        variant: "destructive",
      });
      return;
    }

    const exportRequest: TimetableExportRequest = {
      format,
      view_type: viewMode,
      target_id: selectedClass,
      include_breaks: true,
      include_notes: true,
      custom_fields: []
    };

    exportTimetableMutation.mutate(exportRequest);
  };

  const handleBulkActions = (action: 'copy' | 'move' | 'delete', entryIds: string[]) => {
    // Implementation for bulk operations
    toast({
      title: "Bulk Action",
      description: `${action.toUpperCase()} operation for ${entryIds.length} entries`,
    });
  };

  const handleAutoResolveConflicts = () => {
    if (conflicts.length === 0) {
      toast({
        title: "No Conflicts",
        description: "There are no conflicts to resolve",
      });
      return;
    }

    // Auto-resolve low severity conflicts
    const lowSeverityConflicts = conflicts.filter(c => c.severity === 'low');
    lowSeverityConflicts.forEach(conflict => {
      if (conflict.id) {
        resolveConflictMutation.mutate({
          conflictId: conflict.id,
          notes: 'Auto-resolved by system'
        });
      }
    });
  };

  const handleSyncToCalendar = async () => {
    try {
      const response = await TimetableAPI.syncToCalendar({
        academic_year: currentAcademicYear,
        class_id: viewMode === 'class' ? selectedClass : undefined
      });

      toast({
        title: "Calendar Sync",
        description: response.message,
      });
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.response?.data?.detail || "Failed to sync to calendar",
        variant: "destructive",
      });
    }
  };

  // Render mobile-friendly day cards
  const renderMobileDayCards = () => {
    return (
      <div className="md:hidden space-y-4">
        {DAYS_OF_WEEK.map(day => {
          const dayEntries = timetableEntries.filter(entry => entry.day_of_week === day.value);
          const sortedEntries = [...dayEntries].sort((a, b) => {
            const timeSlotA = timeSlots.find(ts => ts.id === a.time_slot_id);
            const timeSlotB = timeSlots.find(ts => ts.id === b.time_slot_id);
            return (timeSlotA?.period_number || 0) - (timeSlotB?.period_number || 0);
          });

          return (
            <Card key={day.value}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{day.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedEntries.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No classes scheduled</p>
                ) : (
                  sortedEntries.map(entry => {
                    const timeSlot = timeSlots.find(ts => ts.id === entry.time_slot_id);
                    const hasConflict = conflicts.some(c => c.affected_entries.includes(entry.id));
                    
                    return (
                      <div
                        key={entry.id}
                        className={`p-3 rounded border-l-4 ${
                          hasConflict 
                            ? 'border-l-red-500 bg-red-50' 
                            : 'border-l-blue-500 bg-blue-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              Period {timeSlot?.period_number} | {timeSlot?.start_time} - {timeSlot?.end_time}
                            </div>
                            <div className="text-lg font-semibold">{getSubjectName(entry.subject_id)}</div>
                            <div className="text-sm text-gray-600">
                              {getTeacherName(entry.teacher_id)} | Room {entry.room_number}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {canUpdate && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditEntry(entry)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => entry.id && handleDeleteEntry(entry.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {hasConflict && (
                          <div className="text-xs text-red-600 font-medium">
                            ⚠️ Has conflicts
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // Render timetable grid
  const renderTimetableGrid = () => {
    const sortedTimeSlots = [...timeSlots].sort((a, b) => a.period_number - b.period_number);

    return (
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 min-w-[800px]">
          <thead>
            <tr>
              <th className="border border-gray-300 p-2 bg-gray-100 min-w-20">Period</th>
              <th className="border border-gray-300 p-2 bg-gray-100 min-w-16">Time</th>
              {DAYS_OF_WEEK.map(day => (
                <th key={day.value} className="border border-gray-300 p-2 bg-gray-100 min-w-40">
                  <span className="hidden lg:inline">{day.label}</span>
                  <span className="lg:hidden">{day.label.slice(0, 3)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTimeSlots.map(timeSlot => (
              <tr key={timeSlot.id}>
                <td className="border border-gray-300 p-2 text-center font-medium">
                  {timeSlot.period_number}
                </td>
                <td className="border border-gray-300 p-2 text-center text-xs">
                  <div>{timeSlot.start_time}</div>
                  <div>{timeSlot.end_time}</div>
                </td>
                {DAYS_OF_WEEK.map(day => {
                  const entry = getEntryForSlot(day.value, timeSlot.id);
                  const hasConflict = conflicts.some(c => 
                    c.affected_entries.includes(entry?.id || '')
                  );

                  if (timeSlot.is_break) {
                    return (
                      <td key={day.value} className="border border-gray-300 p-1 bg-gray-100 text-center">
                        <div className="text-xs text-gray-600">
                          {timeSlot.period_type.charAt(0).toUpperCase() + timeSlot.period_type.slice(1)}
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td key={day.value} className={`border border-gray-300 p-1 relative ${hasConflict ? 'bg-red-50' : ''}`}>
                      {entry ? (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-blue-800">
                            {getSubjectName(entry.subject_id)}
                          </div>
                          <div className="text-xs text-gray-600">
                            {getTeacherName(entry.teacher_id)}
                          </div>
                          {entry.room_number && (
                            <div className="text-xs text-gray-500 flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {entry.room_number}
                            </div>
                          )}
                          {hasConflict && (
                            <AlertTriangle className="h-3 w-3 text-red-500 absolute top-1 right-1" />
                          )}
                          <div className="flex space-x-1 mt-1">
                            {canUpdate && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0"
                                onClick={() => handleEditEntry(entry)}
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-red-600"
                                onClick={() => entry.id && handleDeleteEntry(entry.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : canCreate ? (
                        <Button
                          variant="ghost"
                          className="w-full h-full min-h-16 border-dashed border-2 border-gray-300 hover:border-blue-500"
                          onClick={() => handleCreateEntry(day.value, timeSlot.id)}
                        >
                          <Plus className="h-4 w-4 text-gray-400" />
                        </Button>
                      ) : (
                        <div className="w-full h-full min-h-16 flex items-center justify-center text-gray-400">
                          -
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Compute filtered teachers and subjects using useMemo
  const availableTeachers = useMemo(() => {
    if (!editingEntry) return teachers;

    const currentClass = classes.find(c => c.id === editingEntry.class_id);
    if (!currentClass) return teachers;

    return teachers.filter(teacher => {
      // Check if teacher is the main class teacher
      if (currentClass.teacher_id === teacher.id) return true;

      // Check if teacher is in subject_teachers array
      if (currentClass.subject_teachers) {
        const isSubjectTeacher = currentClass.subject_teachers.some((st: any) =>
          st.teacher_id === teacher.id
        );
        if (isSubjectTeacher) return true;
      }

      // Check if class is in teacher's assigned classes list
      if (teacher.classes && teacher.classes.includes(editingEntry.class_id)) {
        return true;
      }

      return false;
    });
  }, [editingEntry, classes, teachers]);

  const availableSubjects = useMemo(() => {
    if (!editingEntry || !editingEntry.teacher_id) return subjects;

    const selectedTeacher = teachers.find(t => t.id === editingEntry.teacher_id);
    if (!selectedTeacher || !selectedTeacher.subjects || selectedTeacher.subjects.length === 0) {
      return subjects;
    }

    return subjects.filter(subject => selectedTeacher.subjects.includes(subject.id));
  }, [editingEntry, teachers, subjects]);

  // Permission check - wait for permissions to load before showing denied message
  if (permissionsLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading permissions...</p>
        </CardContent>
      </Card>
    );
  }

  if (!canView) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600">You don't have permission to view timetables.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blue Banner with Circular Animation */}
      <div className="relative bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 text-white overflow-hidden">
        {/* Floating Circles Animation */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full animate-pulse"></div>
          <div className="absolute top-20 -right-16 w-64 h-64 bg-white/5 rounded-full animate-bounce"></div>
          <div className="absolute -bottom-8 left-1/3 w-32 h-32 bg-white/10 rounded-full animate-pulse"></div>
          <div className="absolute top-1/2 left-1/4 w-20 h-20 bg-white/10 rounded-full animate-ping"></div>
          <div className="absolute bottom-10 right-1/4 w-28 h-28 bg-white/5 rounded-full animate-bounce"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Timetable Management</h1>
          <p className="text-blue-100 text-lg">Manage class schedules and detect conflicts</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold sr-only">Timetable Management</h2>
          <p className="text-muted-foreground sr-only">Manage class schedules and detect conflicts</p>
        </div>
        
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <div className="flex items-center space-x-1">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExportTimetable('pdf')}
              disabled={!selectedClass}
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!selectedClass}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Export Timetable</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {(['pdf', 'excel', 'csv', 'ical', 'json'] as const).map((format) => (
                    <Button
                      key={format}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleExportTimetable(format)}
                      disabled={exportTimetableMutation.isPending}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Export as {format.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSyncToCalendar}
            disabled={!selectedClass}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Sync Calendar</span>
            <span className="sm:hidden">Sync</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConflicts(!showConflicts)}
            className={conflicts.length > 0 ? 'text-red-600 border-red-200' : ''}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Conflicts ({conflicts.length})</span>
            <span className="sm:hidden">⚠️ {conflicts.length}</span>
          </Button>

          {conflicts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoResolveConflicts}
              className="text-blue-600 border-blue-200"
            >
              <Zap className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Auto-resolve</span>
              <span className="sm:hidden">Auto</span>
            </Button>
          )}

          {/* Live Updates Indicator */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-md text-xs bg-green-50 text-green-700 border border-green-200">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="hidden sm:inline">Live Updates</span>
            <span className="sm:hidden">●</span>
          </div>
        </div>
      </div>

      {/* Conflict Alerts */}
      {showConflicts && conflicts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Timetable Conflicts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {conflicts.map((conflict) => (
                <Alert key={conflict.id} className={getConflictColor(conflict.severity)}>
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{conflict.description}</p>
                        {conflict.suggested_resolution && (
                          <p className="text-sm mt-1 opacity-80">
                            Suggestion: {conflict.suggested_resolution}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{conflict.severity}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveConflict(conflict.id, 'Manually resolved')}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="schedule" className="text-xs md:text-sm">
            <span className="hidden md:inline">Schedule</span>
            <span className="md:hidden">Sched</span>
          </TabsTrigger>
          <TabsTrigger
            value="time-slots"
            className="text-xs md:text-sm"
          >
            <span className="hidden md:inline">Time Slots</span>
            <span className="md:hidden">Times</span>
          </TabsTrigger>
          <TabsTrigger
            value="rooms"
            className="text-xs md:text-sm"
          >
            <span className="hidden sm:inline">Rooms</span>
            <span className="sm:hidden">Rooms</span>
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="text-xs md:text-sm"
          >
            <span className="hidden md:inline">Analytics</span>
            <span className="md:hidden">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6">
          {/* View Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Timetable View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>View Mode</Label>
                  <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class">Class View</SelectItem>
                      <SelectItem value="teacher">Teacher View</SelectItem>
                      <SelectItem value="room">Room View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>
                    {viewMode === 'class' ? 'Select Class' : 
                     viewMode === 'teacher' ? 'Select Teacher' : 'Select Room'}
                  </Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Choose a ${viewMode}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {viewMode === 'class' && classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          <span className="hidden sm:inline">{cls.class_name} - {cls.grade_level}</span>
                          <span className="sm:hidden">{cls.class_name}</span>
                        </SelectItem>
                      ))}
                      {viewMode === 'teacher' && teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          <span className="hidden sm:inline">{teacher.first_name} {teacher.last_name}</span>
                          <span className="sm:hidden">{teacher.first_name} {teacher.last_name.charAt(0)}.</span>
                        </SelectItem>
                      ))}
                      {viewMode === 'room' && rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          <span className="hidden sm:inline">{room.room_number} ({room.room_type})</span>
                          <span className="sm:hidden">{room.room_number}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2">
                  {selectedClass && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                      <Eye className="h-4 w-4" />
                      <span>Viewing: {
                        viewMode === 'class' ? classes.find(c => c.id === selectedClass)?.class_name :
                        viewMode === 'teacher' ? teachers.find(t => t.id === selectedClass)?.first_name + ' ' + teachers.find(t => t.id === selectedClass)?.last_name :
                        rooms.find(r => r.id === selectedClass)?.room_number
                      }</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timetable Grid */}
          {selectedClass && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {viewMode === 'class' && `Class: ${classes.find(c => c.id === selectedClass)?.class_name}`}
                  {viewMode === 'teacher' && `Teacher: ${getTeacherName(selectedClass)}`}
                  {viewMode === 'room' && `Room: ${rooms.find(r => r.id === selectedClass)?.room_number}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderMobileDayCards()}
                {renderTimetableGrid()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="time-slots">
          <TimeSlotManagement />
        </TabsContent>

        <TabsContent value="rooms">
          <RoomManagement />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_periods_scheduled || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Across all timetables
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Utilization</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.utilization_rate.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  Schedule efficiency
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Conflicts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{conflicts.length}</div>
                <p className="text-xs text-muted-foreground">
                  Require attention
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Free Periods</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_free_periods || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Available slots
                </p>
              </CardContent>
            </Card>
          </div>

          {stats && (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Busiest Day</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <div className="text-3xl font-bold capitalize text-blue-600">
                        {stats.most_busy_day}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Peak scheduling day
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Peak Period</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4">
                      <div className="text-3xl font-bold text-green-600">
                        Period {stats.most_busy_period}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Most scheduled period
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Subject Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.subject_distribution).map(([subject, count]) => (
                      <div key={subject} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{subject}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ 
                                width: `${Math.min(100, (count / Math.max(...Object.values(stats.subject_distribution))) * 100)}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Entry Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEntry?.id ? 'Edit Timetable Entry' : 'Create Timetable Entry'}
            </DialogTitle>
          </DialogHeader>

          {editingEntry && (
            <div className="space-y-4">
              <div>
                <Label>Teacher</Label>
                <Select
                  value={editingEntry.teacher_id}
                  onValueChange={(value) => setEditingEntry({ ...editingEntry, teacher_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeachers.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500 text-center">
                        No teachers assigned to this class
                      </div>
                    ) : (
                      availableTeachers.map(teacher => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.first_name} {teacher.last_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {availableTeachers.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ No teachers are assigned to this class. Please assign teachers first in Teacher Management.
                  </p>
                )}
              </div>

              <div>
                <Label>Subject</Label>
                <Select
                  value={editingEntry.subject_id}
                  onValueChange={(value) => setEditingEntry({ ...editingEntry, subject_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500 text-center">
                        Selected teacher has no assigned subjects
                      </div>
                    ) : (
                      availableSubjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.subject_name} ({subject.subject_code})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {editingEntry.teacher_id && availableSubjects.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Selected teacher is not qualified to teach any subjects. Please assign subjects to this teacher first.
                  </p>
                )}
              </div>

              <div>
                <Label>Room</Label>
                <Select
                  value={editingEntry.room_number}
                  onValueChange={(value) => setEditingEntry({ ...editingEntry, room_number: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.filter(room => room.is_available).map(room => (
                      <SelectItem key={room.id} value={room.room_number}>
                        {room.room_number} - {room.room_type} (Cap: {room.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editingEntry.notes || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleSaveEntry} className="flex-1">
                  {editingEntry.id ? 'Update' : 'Create'}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimetableManagement;