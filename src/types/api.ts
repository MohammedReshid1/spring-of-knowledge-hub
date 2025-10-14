// API Types for FastAPI Backend

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin' | 'super_admin' | 'hq_admin' | 'hq_registrar' | 'branch_admin' | 'branch_registrar';
  phone?: string;
  branch_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address?: string;
  contact_info?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  address: string;
  phone: string;
  email: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  medical_info?: string;
  previous_school?: string;
  grade_level: string;
  class_id?: string;
  /** Nested class information loaded from API */
  classes?: SchoolClass;
  admission_date: string;
  parent_guardian_id?: string;
  father_name: string;
  grandfather_name: string;
  mother_name: string;
  photo_url?: string;
  current_class?: string;
  current_section?: string;
  status: 'Active' | 'Inactive' | 'Graduated' | 'Transferred';
  phone_secondary?: string;
  birth_certificate_url?: string;
  branch_id: string;
}

export interface Teacher {
  id: string;
  teacher_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  qualification?: string;
  experience_years?: number;
  specialization?: string;
  joining_date?: string;
  salary?: number;
  status: string;
  branch_id?: string;
  photo_url?: string;
  subjects?: string[];
  classes?: string[];
  employee_id?: string;
  department?: string;
  blood_group?: string;
  nationality?: string;
  marital_status?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SchoolClass {
  id: string;
  grade_level_id: string;
  class_name: string;
  max_capacity: number;
  current_enrollment: number;
  teacher_id?: string;
  academic_year: string;
  branch_id: string;
  created_at: string;
  updated_at: string;
  grade_level?: GradeLevel;
  teacher?: User;
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  subject_id?: string;
  attendance_date: string;
  status: string;
  notes?: string;
  check_in_time?: string;
  check_out_time?: string;
  recorded_by: string;
  branch_id: string;
  created_at: string;
  updated_at?: string;
}

export interface Fee {
  id: string;
  student_id: string;
  fee_type: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  academic_year: string;
  branch_id: string;
  created_at: string;
  // Extended fields present in API
  notes?: string;
  amount_paid?: number;
  remaining_amount?: number;
}

export interface GradeLevel {
  id: string;
  grade: string;
  max_capacity: number;
  current_enrollment: number;
  academic_year: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  subject_name: string;
  subject_code: string;
  description?: string;
  grade_levels: string[];
  created_at: string;
}

export interface StudentEnrollment {
  id: string;
  student_id: string;
  subject_id: string;
  academic_year: string;
  enrolled_at: string;
}

export interface BackupLog {
  id: string;
  backup_type: string;
  backup_method: string;
  status: 'in_progress' | 'completed' | 'failed';
  file_path?: string;
  file_size?: number;
  started_at: string;
  completed_at?: string;
  performed_by: string;
  error_message?: string;
  tables_backed_up?: string[];
  records_count?: number;
}

export interface GradeTransition {
  id: string;
  academic_year: string;
  transition_date: string;
  students_transitioned: number;
  students_graduated: number;
  performed_by: string;
  notes?: string;
  created_at: string;
}

export interface Parent {
  id: string;
  father_name?: string;
  father_phone?: string;
  father_email?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_phone?: string;
  mother_email?: string;
  mother_occupation?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  guardian_relationship?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  student_ids: string[];
  user_id?: string;
  branch_id?: string;
  created_at?: string;
  updated_at?: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Timetable Types
export interface TimeSlot {
  id: string;
  period_number: number;
  start_time: string;
  end_time: string;
  period_type: 'regular' | 'break' | 'lunch' | 'assembly' | 'sports' | 'library' | 'lab' | 'extra_curricular';
  is_break: boolean;
  break_duration_minutes?: number;
  branch_id: string;
  academic_year: string;
  created_at: string;
  updated_at?: string;
}

export interface TimetableEntry {
  id?: string;
  class_id: string;
  subject_id?: string;
  teacher_id?: string;
  room_number?: string;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  time_slot_id: string;
  academic_year: string;
  term?: string;
  is_recurring: boolean;
  specific_date?: string;
  notes?: string;
  resources_needed?: string[];
  is_substitution: boolean;
  original_teacher_id?: string;
  branch_id: string;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  last_modified_by?: string;
  // Enriched data from joins
  subject_name?: string;
  subject_code?: string;
  teacher_name?: string;
  class_name?: string;
  start_time?: string;
  end_time?: string;
  period_number?: number;
}

export interface TimetableConflict {
  id?: string;
  conflict_type: 'teacher_overlap' | 'room_overlap' | 'class_overlap' | 'resource_overlap' | 'time_constraint';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_entries: string[];
  suggested_resolution?: string;
  detected_at: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  metadata?: Record<string, any>;
}

export interface Room {
  id: string;
  room_number: string;
  room_name?: string;
  room_type: 'classroom' | 'laboratory' | 'auditorium' | 'gym' | 'library';
  capacity: number;
  equipment: string[];
  is_available: boolean;
  branch_id: string;
  floor?: string;
  building?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface WeeklyTimetable {
  id: string;
  name: string;
  description?: string;
  academic_year: string;
  term?: string;
  effective_from: string;
  effective_to?: string;
  status: 'draft' | 'active' | 'archived' | 'suspended';
  is_default: boolean;
  branch_id: string;
  entries?: TimetableEntry[];
  time_slots?: TimeSlot[];
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface ClassTimetableView {
  class_id: string;
  class_name: string;
  grade_level: string;
  academic_year: string;
  entries: Array<{
    day: string;
    periods: Record<number, {
      entry_id: string;
      subject_id?: string;
      teacher_id?: string;
      room_number?: string;
      start_time: string;
      end_time: string;
      notes?: string;
    }>;
  }>;
  conflicts?: TimetableConflict[];
}

export interface TeacherTimetableView {
  teacher_id: string;
  teacher_name: string;
  total_periods_per_week: number;
  entries: Array<{
    day: string;
    periods: Record<number, {
      entry_id: string;
      subject_id?: string;
      class_id?: string;
      room_number?: string;
      start_time: string;
      end_time: string;
      notes?: string;
    }>;
  }>;
  free_periods: Array<{
    day: string;
    period: number;
    start_time: string;
    end_time: string;
  }>;
  conflicts?: TimetableConflict[];
}

export interface RoomTimetableView {
  room_id: string;
  room_number: string;
  room_type: string;
  utilization_percentage: number;
  entries: Array<{
    day: string;
    periods: Record<number, {
      entry_id: string;
      subject_id?: string;
      teacher_id?: string;
      class_id?: string;
      start_time: string;
      end_time: string;
      notes?: string;
    }>;
  }>;
  free_slots: Array<{
    day: string;
    period: number;
    start_time: string;
    end_time: string;
  }>;
}

export interface TimetableStats {
  total_periods_scheduled: number;
  total_free_periods: number;
  utilization_rate: number;
  teacher_workload_stats: Record<string, any>;
  room_utilization_stats: Record<string, any>;
  conflict_count: number;
  most_busy_day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  most_busy_period: number;
  subject_distribution: Record<string, number>;
}

export interface TimetableExportRequest {
  format: 'pdf' | 'excel' | 'ical' | 'json' | 'csv';
  view_type: 'class' | 'teacher' | 'room' | 'master';
  target_id?: string;
  date_range_start?: string;
  date_range_end?: string;
  include_breaks: boolean;
  include_notes: boolean;
  custom_fields?: string[];
}

export interface TimetableTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: 'primary' | 'secondary' | 'kindergarten' | 'custom';
  total_periods: number;
  break_periods: number[];
  lunch_period?: number;
  daily_start_time: string;
  daily_end_time: string;
  period_duration_minutes: number;
  break_duration_minutes: number;
  lunch_duration_minutes: number;
  working_days: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
  branch_id?: string;
  created_at: string;
  created_by?: string;
  usage_count: number;
}

export interface Substitution {
  id: string;
  original_entry_id: string;
  substitute_teacher_id: string;
  substitution_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  notes?: string;
  notification_sent: boolean;
  approved_by?: string;
  created_at: string;
  created_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

// Payment Management Types
export interface GradeLevelTier {
  grade_levels: string[];
  amount: number;
}

export interface FeeCategory {
  id: string;
  name: string;
  description?: string;
  base_amount: number;
  amount?: number; // Default amount if no tiers
  grade_level_tiers?: GradeLevelTier[]; // Tiers with different amounts per grade range
  is_active: boolean;
  is_mandatory: boolean;
  due_period: 'monthly' | 'quarterly' | 'annually' | 'one_time';
  late_fee_amount?: number;
  late_fee_days?: number;
  branch_id: string;
  academic_year: string;
  grade_levels?: string[];
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  receipt_number: string;
  payment_id?: string;
  student_id: string;
  payment_date: string;
  academic_year?: string;
  semester?: string;
  due_date?: string;

  // Amount fields
  amount: number;
  currency?: string;
  discount_amount?: number;
  discount_percentage?: number;
  discount_reason?: string;
  tax_amount?: number;
  late_fee_amount?: number;

  // Payment category and description
  category?: string;
  description?: string;

  // Payment details
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'check' | 'mobile_money';
  payment_reference?: string;
  payment_gateway?: string;

  // Payer information
  payer_name?: string;
  payer_phone?: string;
  payer_email?: string;

  // Bank/Card specific fields
  bank_name?: string;
  cheque_number?: string;
  cheque_date?: string;
  card_last_four?: string;

  // Status and metadata
  status: 'pending' | 'completed' | 'overdue' | 'partial' | 'refunded' | 'partial_refund';
  verification_status?: 'unverified' | 'verified' | 'rejected';
  verified_by?: string;
  verified_at?: string;
  remarks?: string;
  internal_notes?: string;

  // Additional fields
  fee_template_id?: string;

  // Cancellation/Refund info
  cancellation_reason?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  refund_amount?: number;
  refund_date?: string;
  refund_reference?: string;

  // System fields
  branch_id: string;
  created_by: string;
  created_at: string;
  updated_at?: string;

  // Enriched fields from joins
  student?: Student;
  payment_details?: PaymentDetail[];
  fee_category?: FeeCategory;
}

export interface PaymentItem {
  id?: string;
  payment_id?: string;
  fee_category_id: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
  discount_amount?: number;
  late_fee_amount?: number;
  notes?: string;
  fee_category?: FeeCategory;
}

export interface PaymentDetail {
  id: string;
  payment_id: string;
  fee_category_id: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
  discount_amount?: number;
  late_fee_amount?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  fee_category?: FeeCategory;
}

export interface PaymentWithDetails {
  payment: Payment;
  details: PaymentDetail[];
}

export interface FeeItemCreate {
  fee_category_id: string;
  quantity: number;
  discount_amount?: number;
  notes?: string;
}

export interface PaymentReceipt {
  id: string;
  payment_id: string;
  receipt_number: string;
  issue_date: string;
  pdf_url?: string;
  email_sent: boolean;
  created_at: string;
  payment?: Payment;
}

export interface PaymentReport {
  report_type: 'daily_collection' | 'outstanding_fees' | 'payment_summary' | 'fee_category_analysis';
  date_from: string;
  date_to: string;
  branch_id?: string;
  fee_category_id?: string;
  grade_level?: string;
  data: Record<string, any>;
  generated_at: string;
  generated_by: string;
}

export interface PaymentStats {
  total_payments: number;
  total_amount_collected: number;
  pending_payments: number;
  pending_amount: number;
  overdue_payments: number;
  overdue_amount: number;
  collection_rate: number;
  average_payment_amount: number;
  top_fee_categories: Array<{
    category_name: string;
    total_amount: number;
    payment_count: number;
  }>;
  monthly_collection_trend: Array<{
    month: string;
    amount: number;
    payment_count: number;
  }>;
}

// Grade-level Fee Rates and Bulk Import Types
export interface GradeLevelFeeRate {
  id: string;
  grade_range: string;
  branch_id: string;
  registration_fee: number;
  quarterly_fee: number;
  academic_year: string;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface GradeLevelFeeRateCreate {
  grade_range: string;
  branch_id: string;
  registration_fee: number;
  quarterly_fee: number;
  academic_year: string;
  is_active?: boolean;
  description?: string;
}

export interface BulkPaymentImportRequest {
  branch_id: string;
  academic_year: string;
  payment_period: string;
  fee_type: 'registration' | 'quarterly';
  due_date: string;
  validate_only?: boolean;
  notes?: string;
}

export interface BulkPaymentImportResult {
  id: string;
  total_items: number;
  successful_imports: number;
  failed_imports: number;
  validation_errors: Array<{
    row: number;
    error: string;
  }>;
  import_summary: {
    grade_breakdown: Record<string, {
      count: number;
      total_amount: string;
    }>;
    total_amount: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'completed_with_errors';
  created_at: string;
  processed_at?: string;
  branch_id: string;
  academic_year: string;
  created_by: string;
}

export interface BulkImportValidationInfo {
  required_columns: string[];
  optional_columns: string[];
  example_row: Record<string, string>;
  supported_grade_levels: Record<string, string[]>;
}
