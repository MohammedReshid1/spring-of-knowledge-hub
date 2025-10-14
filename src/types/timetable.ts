// Timetable System TypeScript Interfaces
// Generated from TIMETABLE_FRONTEND_INTEGRATION_GUIDE.md

// Enums
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type PeriodType = 'regular' | 'break' | 'lunch' | 'assembly' | 'sports' | 'activity' | 'lab' | 'other';
export type RoomType = 'classroom' | 'laboratory' | 'auditorium' | 'gym' | 'library';
export type ConflictType = 'teacher_overlap' | 'room_overlap' | 'class_overlap' | 'resource_overlap' | 'time_constraint';
export type ConflictSeverity = 'critical' | 'high' | 'medium' | 'low';
export type SubstitutionStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type ExportFormat = 'json' | 'csv' | 'excel' | 'ical' | 'pdf';
export type ExportViewType = 'class' | 'teacher' | 'room' | 'master';

// Time Slot
export interface TimeSlotCreate {
  period_number: number;  // 1-10
  start_time: string;  // HH:MM:SS
  end_time: string;  // HH:MM:SS
  period_type: PeriodType;
  is_break: boolean;
  break_duration_minutes?: number;  // 5-60, required if is_break=true
  branch_id: string;
  academic_year: string;
}

export interface TimeSlot extends TimeSlotCreate {
  id: string;
  created_at: string;
  updated_at: string;
}

// Timetable Entry
export interface TimetableEntryCreate {
  class_id: string;
  subject_id?: string;
  teacher_id?: string;
  room_number?: string;
  day_of_week: DayOfWeek;
  time_slot_id: string;
  academic_year: string;
  term?: string;
  is_recurring: boolean;
  specific_date?: string;  // YYYY-MM-DD, required if is_recurring=false
  notes?: string;
  resources_needed?: string[];
  is_substitution?: boolean;
  original_teacher_id?: string;
}

export interface TimetableEntry extends TimetableEntryCreate {
  id: string;
  branch_id: string;
  created_by: string;
  last_modified_by?: string;
  created_at: string;
  updated_at: string;
}

// Bulk Create
export interface BulkTimetableCreate {
  entries: TimetableEntryCreate[];
  auto_resolve_conflicts: boolean;
  notify_affected_users: boolean;
}

// Room
export interface RoomCreate {
  room_number: string;
  room_name?: string;
  room_type: RoomType;
  capacity: number;  // >= 1
  equipment?: string[];
  is_available: boolean;
  floor?: string;
  building?: string;
  notes?: string;
  branch_id: string;
}

export interface Room extends RoomCreate {
  id: string;
  created_at: string;
  updated_at: string;
}

// Substitution
export interface SubstitutionCreate {
  original_entry_id: string;
  substitute_teacher_id: string;
  substitution_date: string;  // YYYY-MM-DD
  start_time: string;  // HH:MM:SS
  end_time: string;  // HH:MM:SS
  reason: string;
  notes?: string;
}

export interface Substitution extends SubstitutionCreate {
  id: string;
  status: SubstitutionStatus;
  notification_sent: boolean;
  approved_by?: string;
  approved_at?: string;
  created_by: string;
  created_at: string;
}

// Conflict
export interface TimetableConflict {
  id: string;
  conflict_type: ConflictType;
  severity: ConflictSeverity;
  description: string;
  affected_entries: string[];
  suggested_resolution: string;
  detected_at: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  metadata: Record<string, any>;
}

// Views
export interface ClassTimetableView {
  class_id: string;
  class_name: string;
  grade_level: string;
  academic_year: string;
  entries: {
    day: DayOfWeek;
    periods: Record<number, {
      entry_id: string;
      subject_id?: string;
      teacher_id?: string;
      room_number?: string;
      start_time: string;
      end_time: string;
      notes?: string;
    }>;
  }[];
  conflicts: TimetableConflict[];
}

export interface TeacherTimetableView {
  teacher_id: string;
  teacher_name: string;
  total_periods_per_week: number;
  entries: {
    day: DayOfWeek;
    periods: Record<number, {
      entry_id: string;
      subject_id?: string;
      class_id?: string;
      room_number?: string;
      start_time: string;
      end_time: string;
    }>;
  }[];
  free_periods: {
    day: DayOfWeek;
    period: number;
    start_time: string;
    end_time: string;
  }[];
  conflicts: TimetableConflict[];
}

// Statistics
export interface TimetableStats {
  total_periods_scheduled: number;
  total_free_periods: number;
  utilization_rate: number;
  teacher_workload_stats: Record<string, {
    total_periods: number;
    classes: string[];
    utilization: number;
  }>;
  room_utilization_stats: Record<string, {
    total_periods_used: number;
    utilization: number;
  }>;
  conflict_count: number;
  most_busy_day: string;
  most_busy_period: number;
  subject_distribution: Record<string, number>;
}

// Export
export interface TimetableExportRequest {
  format: ExportFormat;
  view_type: ExportViewType;
  target_id?: string;  // class_id, teacher_id, or room_id depending on view_type
  include_breaks?: boolean;
  include_notes?: boolean;
  date_range_start?: string;  // YYYY-MM-DD
  date_range_end?: string;  // YYYY-MM-DD
  custom_fields?: string[];
}

export interface TimetableExportResponse {
  download_url: string;
  filename: string;
  format: ExportFormat;
  generated_at: string;
}
