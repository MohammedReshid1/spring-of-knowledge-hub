import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TimetableAPI } from '@/services/timetableApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { usePermissionCheck } from '@/contexts/RoleAccessContext';
import { useBranch } from '@/contexts/BranchContext';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import {
  Clock,
  Plus,
  Edit3,
  Trash2,
  Coffee,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  Copy,
  Calendar
} from 'lucide-react';
import type { TimeSlot, TimeSlotCreate } from '@/types/timetable';

const PERIOD_TYPES = [
  { value: 'regular', label: 'Regular Class', icon: BookOpen },
  { value: 'break', label: 'Break', icon: Coffee },
  { value: 'lunch', label: 'Lunch Break', icon: Coffee },
  { value: 'assembly', label: 'Assembly', icon: Calendar },
  { value: 'sports', label: 'Sports/PE', icon: Calendar },
  { value: 'activity', label: 'Activity', icon: Calendar },
  { value: 'lab', label: 'Laboratory', icon: BookOpen },
  { value: 'other', label: 'Other', icon: Calendar }
];

export const TimeSlotManagement: React.FC = () => {
  const { hasPermission } = usePermissionCheck();
  const queryClient = useQueryClient();
  const { selectedBranch } = useBranch();
  const { data: academicYearData } = useAcademicYear();

  // Fallback to calculated year if API doesn't return one
  const currentAcademicYear = academicYearData?.year || (() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  })();

  const canManage = hasPermission('timetable.manage');
  const canCreate = hasPermission('timetable.create') || canManage;
  const canUpdate = hasPermission('timetable.update') || canManage;
  const canDelete = hasPermission('timetable.delete') || canManage;

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [bulkCreateMode, setBulkCreateMode] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<TimeSlotCreate>>({
    period_number: 1,
    start_time: '08:00:00',
    end_time: '08:45:00',
    period_type: 'regular',
    is_break: false,
    break_duration_minutes: undefined
  });

  // Bulk create state
  const [bulkConfig, setBulkConfig] = useState({
    startPeriod: 1,
    endPeriod: 8,
    startTime: '08:00',
    periodDuration: 45,
    breakDuration: 10,
    includeBreaks: true,
    lunchPeriod: 4,
    lunchDuration: 45
  });

  // Fetch time slots
  const { data: timeSlots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: ['time-slots'],
    queryFn: () => TimetableAPI.getTimeSlots({ limit: 100 })
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: TimeSlotCreate) => TimetableAPI.createTimeSlot(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-slots'] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Time slot created successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to create time slot',
        variant: 'destructive'
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: TimeSlot) => TimetableAPI.updateTimeSlot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-slots'] });
      setShowCreateDialog(false);
      setEditingSlot(null);
      resetForm();
      toast({
        title: 'Success',
        description: 'Time slot updated successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to update time slot',
        variant: 'destructive'
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => TimetableAPI.deleteTimeSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-slots'] });
      toast({
        title: 'Success',
        description: 'Time slot deleted successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Cannot delete time slot in use',
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setFormData({
      period_number: timeSlots.length + 1,
      start_time: '08:00:00',
      end_time: '08:45:00',
      period_type: 'regular',
      is_break: false,
      break_duration_minutes: undefined
    });
    setEditingSlot(null);
  };

  const handleEdit = (slot: TimeSlot) => {
    setEditingSlot(slot);
    setFormData({
      period_number: slot.period_number,
      start_time: slot.start_time,
      end_time: slot.end_time,
      period_type: slot.period_type,
      is_break: slot.is_break,
      break_duration_minutes: slot.break_duration_minutes
    });
    setShowCreateDialog(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this time slot? This will affect all timetable entries using it.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = () => {

    if (!formData.start_time || !formData.end_time || !formData.period_number) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedBranch || !currentAcademicYear) {
      toast({
        title: 'Validation Error',
        description: 'Please select a branch and ensure academic year is set',
        variant: 'destructive'
      });
      return;
    }

    const data: TimeSlotCreate = {
      period_number: formData.period_number!,
      start_time: formData.start_time,
      end_time: formData.end_time,
      period_type: formData.period_type || 'regular',
      is_break: formData.is_break || false,
      break_duration_minutes: formData.is_break ? formData.break_duration_minutes : undefined,
      branch_id: selectedBranch,
      academic_year: currentAcademicYear
    };

    if (editingSlot) {
      updateMutation.mutate({ ...editingSlot, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleBulkCreate = () => {
    if (!selectedBranch || !currentAcademicYear) {
      toast({
        title: 'Validation Error',
        description: 'Please select a branch and ensure academic year is set',
        variant: 'destructive'
      });
      return;
    }

    const slots: TimeSlotCreate[] = [];
    let currentTime = bulkConfig.startTime;
    let periodCounter = bulkConfig.startPeriod;

    const addMinutes = (time: string, minutes: number): string => {
      const [hours, mins] = time.split(':').map(Number);
      const totalMins = hours * 60 + mins + minutes;
      const newHours = Math.floor(totalMins / 60);
      const newMins = totalMins % 60;
      return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}:00`;
    };

    for (let i = bulkConfig.startPeriod; i <= bulkConfig.endPeriod; i++) {
      const startTime = currentTime + ':00';
      const endTime = addMinutes(currentTime, bulkConfig.periodDuration);

      // Add regular period
      slots.push({
        period_number: periodCounter++,
        start_time: startTime,
        end_time: endTime,
        period_type: 'regular',
        is_break: false,
        branch_id: selectedBranch,
        academic_year: currentAcademicYear
      });

      currentTime = endTime.slice(0, 5);

      // Add break after period (except last period)
      if (i < bulkConfig.endPeriod && bulkConfig.includeBreaks) {
        if (i === bulkConfig.lunchPeriod) {
          // Lunch break
          const lunchStart = currentTime + ':00';
          const lunchEnd = addMinutes(currentTime, bulkConfig.lunchDuration);

          slots.push({
            period_number: periodCounter++,
            start_time: lunchStart,
            end_time: lunchEnd,
            period_type: 'lunch',
            is_break: true,
            break_duration_minutes: bulkConfig.lunchDuration,
            branch_id: selectedBranch,
            academic_year: currentAcademicYear
          });

          currentTime = lunchEnd.slice(0, 5);
        } else {
          // Regular break
          const breakStart = currentTime + ':00';
          const breakEnd = addMinutes(currentTime, bulkConfig.breakDuration);

          slots.push({
            period_number: periodCounter++,
            start_time: breakStart,
            end_time: breakEnd,
            period_type: 'break',
            is_break: true,
            break_duration_minutes: bulkConfig.breakDuration,
            branch_id: selectedBranch,
            academic_year: currentAcademicYear
          });

          currentTime = breakEnd.slice(0, 5);
        }
      }
    }

    // Create all slots
    Promise.all(slots.map(slot => TimetableAPI.createTimeSlot(slot)))
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['time-slots'] });
        setBulkCreateMode(false);
        toast({
          title: 'Success',
          description: `Created ${slots.length} time slots`
        });
      })
      .catch((error) => {
        toast({
          title: 'Error',
          description: 'Failed to create some time slots',
          variant: 'destructive'
        });
      });
  };

  const duplicateSlot = (slot: TimeSlot) => {
    setFormData({
      period_number: timeSlots.length + 1,
      start_time: slot.start_time,
      end_time: slot.end_time,
      period_type: slot.period_type,
      is_break: slot.is_break,
      break_duration_minutes: slot.break_duration_minutes
    });
    setShowCreateDialog(true);
  };

  const getPeriodIcon = (type: string) => {
    const periodType = PERIOD_TYPES.find(p => p.value === type);
    const Icon = periodType?.icon || Clock;
    return <Icon className="h-4 w-4" />;
  };

  const getPeriodColor = (type: string, isBreak: boolean) => {
    if (isBreak) return 'border-l-orange-500 bg-orange-50';
    if (type === 'regular') return 'border-l-blue-500 bg-blue-50';
    if (type === 'lab') return 'border-l-purple-500 bg-purple-50';
    return 'border-l-green-500 bg-green-50';
  };

  if (!canManage && !canCreate) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600">You don't have permission to manage time slots.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Time Slot Management</h3>
          <p className="text-sm text-muted-foreground">
            Configure school periods and break times
          </p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <>
              <Button
                variant="outline"
                onClick={() => setBulkCreateMode(true)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Bulk Create
              </Button>
              <Button onClick={() => {
                resetForm();
                setShowCreateDialog(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Time Slot
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Time Slots List */}
      {isLoading ? (
        <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading time slots...</p>
          </CardContent>
        </Card>
      ) : timeSlots.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No time slots configured yet</p>
            {canCreate && (
              <Button onClick={() => setBulkCreateMode(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Create School Schedule
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {timeSlots
            .sort((a, b) => a.period_number - b.period_number)
            .map((slot) => (
              <Card key={slot.id} className={`border-l-4 ${getPeriodColor(slot.period_type, slot.is_break)}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-16 h-16 bg-white rounded-full flex flex-col items-center justify-center border-2 border-gray-200">
                        <span className="text-xs text-muted-foreground">Period</span>
                        <span className="text-lg font-bold text-primary">{slot.period_number}</span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getPeriodIcon(slot.period_type)}
                          <span className="font-semibold">
                            {PERIOD_TYPES.find(p => p.value === slot.period_type)?.label}
                          </span>
                          {slot.is_break && (
                            <Badge variant="secondary" className="text-xs">
                              {slot.break_duration_minutes} min
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="font-mono">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </span>
                          <span className="text-xs">
                            ({Math.round((new Date(`2000-01-01 ${slot.end_time}`) as any - new Date(`2000-01-01 ${slot.start_time}`) as any) / 60000)} min)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canCreate && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => duplicateSlot(slot)}
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {canUpdate && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(slot)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(slot.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? 'Edit Time Slot' : 'Create Time Slot'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Period Number</Label>
              <Input
                type="number"
                min="1"
                value={formData.period_number || ''}
                onChange={(e) => setFormData({ ...formData, period_number: parseInt(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={formData.start_time?.slice(0, 5) || ''}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value + ':00' })}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={formData.end_time?.slice(0, 5) || ''}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value + ':00' })}
                />
              </div>
            </div>

            <div>
              <Label>Period Type</Label>
              <Select
                value={formData.period_type}
                onValueChange={(value) => setFormData({ ...formData, period_type: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Is Break Period?</Label>
              <Switch
                checked={formData.is_break}
                onCheckedChange={(checked) => setFormData({ ...formData, is_break: checked })}
              />
            </div>

            {formData.is_break && (
              <div>
                <Label>Break Duration (minutes)</Label>
                <Input
                  type="number"
                  min="5"
                  max="60"
                  value={formData.break_duration_minutes || ''}
                  onChange={(e) => setFormData({ ...formData, break_duration_minutes: parseInt(e.target.value) })}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1">
                {editingSlot ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={bulkCreateMode} onOpenChange={setBulkCreateMode}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Create Time Slots</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                This will create a complete school schedule with periods and breaks automatically.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Period</Label>
                <Input
                  type="number"
                  min="1"
                  value={bulkConfig.startPeriod}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, startPeriod: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>End Period</Label>
                <Input
                  type="number"
                  min="1"
                  value={bulkConfig.endPeriod}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, endPeriod: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>School Start Time</Label>
              <Input
                type="time"
                value={bulkConfig.startTime}
                onChange={(e) => setBulkConfig({ ...bulkConfig, startTime: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Duration (min)</Label>
                <Input
                  type="number"
                  min="30"
                  max="90"
                  value={bulkConfig.periodDuration}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, periodDuration: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Break Duration (min)</Label>
                <Input
                  type="number"
                  min="5"
                  max="30"
                  value={bulkConfig.breakDuration}
                  onChange={(e) => setBulkConfig({ ...bulkConfig, breakDuration: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Include Breaks</Label>
              <Switch
                checked={bulkConfig.includeBreaks}
                onCheckedChange={(checked) => setBulkConfig({ ...bulkConfig, includeBreaks: checked })}
              />
            </div>

            {bulkConfig.includeBreaks && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Lunch After Period</Label>
                  <Input
                    type="number"
                    min="1"
                    max={bulkConfig.endPeriod}
                    value={bulkConfig.lunchPeriod}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, lunchPeriod: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Lunch Duration (min)</Label>
                  <Input
                    type="number"
                    min="30"
                    max="90"
                    value={bulkConfig.lunchDuration}
                    onChange={(e) => setBulkConfig({ ...bulkConfig, lunchDuration: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleBulkCreate} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Create Schedule
              </Button>
              <Button variant="outline" onClick={() => setBulkCreateMode(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimeSlotManagement;
