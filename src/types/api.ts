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
}

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  attendance_date: string;
  status: string;
  notes?: string;
  recorded_by: string;
  branch_id: string;
  created_at: string;
}

export interface Fee {
  id: string;
  student_id: string;
  fee_type: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: 'pending' | 'paid' | 'overdue';
  academic_year: string;
  branch_id: string;
  created_at: string;
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

export interface PaymentMode {
  id: string;
  name: string;
  payment_type: string;
  payment_data: Record<string, any>;
  payment_id: string;
  created_at: string;
}

export interface RegistrationPayment {
  id: string;
  student_id: string;
  payment_status: 'Unpaid' | 'Partial' | 'Paid' | 'Refunded';
  amount_paid: number;
  payment_date?: string;
  academic_year: string;
  notes?: string;
  payment_id?: string;
  transaction_data?: Record<string, any>;
  payment_cycle: 'registration_fee' | 'monthly_fee' | 'annual_fee';
  payment_method: 'Cash' | 'Bank Transfer' | 'Card' | 'Mobile Money';
  total_amount: number;
  payment_details?: Record<string, any>;
  branch_id: string;
  created_at: string;
  updated_at: string;
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

// API Response wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}