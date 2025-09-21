// API Client for FastAPI Backend
import type { ApiResponse, User, Branch, Student, Teacher, SchoolClass, Attendance, Fee, GradeLevel, Subject, StudentEnrollment, PaymentMode, RegistrationPayment, BackupLog, GradeTransition, Parent, FeeCategory, Payment, PaymentItem, PaymentReceipt, PaymentReport, BulkPaymentImport, PaymentStats } from '@/types/api';
import { config } from './config';
import { isTokenExpired, shouldRefreshToken } from '@/utils/jwt';
import { TokenStorage } from '@/utils/tokenStorage';

const API_BASE_URL = config.API_BASE_URL;

// ---------------------------
// Fee Category shape mappers
// ---------------------------
// Backend expects: { name, description?, amount, fee_type, frequency?, is_active, branch_id, late_fee_grace_days?, ... }
// Frontend uses:   { name, description?, base_amount, is_active, is_mandatory, due_period, late_fee_amount?, late_fee_days?, branch_id, academic_year, grade_levels? }

type FrontendFeeCategory = FeeCategory;

function mapDuePeriodToBackend(due_period?: FrontendFeeCategory['due_period']): string | undefined {
  if (!due_period) return undefined;
  switch (due_period) {
    case 'monthly':
      return 'monthly';
    case 'quarterly':
      return 'quarterly';
    case 'annually':
      return 'annual';
    case 'one_time':
      return 'one-time';
    default:
      return undefined;
  }
}

function mapFrequencyToFrontend(frequency?: string): FrontendFeeCategory['due_period'] | undefined {
  if (!frequency) return undefined;
  switch (frequency) {
    case 'monthly':
      return 'monthly';
    case 'quarterly':
      return 'quarterly';
    case 'annual':
      return 'annually';
    case 'one-time':
      return 'one_time';
    default:
      return undefined;
  }
}

function mapToBackendFeeCategory(payload: Partial<FrontendFeeCategory>): Record<string, unknown> {
  const backend: Record<string, unknown> = {};

  if (payload.name !== undefined) backend.name = payload.name;
  if (payload.description !== undefined) backend.description = payload.description;
  if (payload.base_amount !== undefined) backend.amount = payload.base_amount;
  if (payload.is_mandatory !== undefined) backend.fee_type = payload.is_mandatory ? 'mandatory' : 'optional';
  if (payload.due_period !== undefined) backend.frequency = mapDuePeriodToBackend(payload.due_period);
  if (payload.is_active !== undefined) backend.is_active = payload.is_active;
  if ((payload as any).branch_id !== undefined) backend.branch_id = (payload as any).branch_id;
  if (payload.late_fee_days !== undefined) backend['late_fee_grace_days'] = payload.late_fee_days;

  return backend;
}

function coerceNumber(n: unknown, fallback = 0): number {
  if (typeof n === 'number') return n;
  if (typeof n === 'string') {
    const parsed = parseFloat(n);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function mapFromBackendFeeCategory(doc: any): FrontendFeeCategory {
  const now = new Date();
  const yearRange = `${now.getFullYear()}-${now.getFullYear() + 1}`;
  return {
    id: doc.id ?? doc._id ?? '',
    name: doc.name ?? '',
    description: doc.description ?? '',
    base_amount: coerceNumber(doc.amount, 0),
    is_active: doc.is_active ?? true,
    is_mandatory: (doc.fee_type === 'mandatory') ? true : false,
    due_period: mapFrequencyToFrontend(doc.frequency) ?? 'monthly',
    late_fee_amount: 0,
    late_fee_days: typeof doc.late_fee_grace_days === 'number' ? doc.late_fee_grace_days : 0,
    branch_id: doc.branch_id ?? '',
    academic_year: doc.academic_year ?? yearRange,
    grade_levels: Array.isArray(doc.grade_levels) ? doc.grade_levels : [],
    created_at: doc.created_at ?? now.toISOString(),
    updated_at: doc.updated_at ?? now.toISOString(),
  } as FrontendFeeCategory;
}

class ApiClient {
  private token: string | null = null;
  private errorHandler: ((error: unknown, endpoint?: string, context?: Record<string, unknown>) => void) | null = null;

  constructor() {
    // Get token from secure storage if it exists
    this.token = TokenStorage.getToken();
  }

  setToken(token: string) {
    this.token = token;
    TokenStorage.setToken(token);
  }

  removeToken() {
    this.token = null;
    TokenStorage.removeToken();
  }

  setErrorHandler(handler: (error: unknown, endpoint?: string, context?: Record<string, unknown>) => void) {
    this.errorHandler = handler;
  }

  private handleRequestError(error: unknown, endpoint: string, context?: Record<string, unknown>) {
    if (this.errorHandler) {
      this.errorHandler(error, endpoint, context);
    }
  }

  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    maxAttempts: number = 3
  ): Promise<ApiResponse<T>> {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.request<T>(endpoint, options);
        
        // If we get an error but it's not retryable, return immediately
        if (result.error && !this.isRetryableError(result.error)) {
          return result;
        }
        
        // If successful or non-retryable error, return
        if (!result.error) {
          return result;
        }
        
        // If this is the last attempt, return the error
        if (attempt === maxAttempts) {
          return result;
        }
        
        // Store error for potential retry
        lastError = result.error;
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`Retrying API request (attempt ${attempt + 1}/${maxAttempts}): ${endpoint}`);
        
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) {
          const errorMessage = error instanceof Error ? error.message : 'Network error';
          this.handleRequestError(error, endpoint, { attempt, maxAttempts, ...options });
          return { error: errorMessage };
        }
      }
    }
    
    // This shouldn't be reached, but just in case
    const errorMessage = lastError instanceof Error ? lastError.message : 'Network error';
    return { error: errorMessage };
  }

  private isRetryableError(error: string): boolean {
    // Only retry on network errors and server errors (5xx)
    return error.includes('Network') || 
           error.includes('fetch') ||
           error.includes('HTTP 5') ||
           error.includes('timeout') ||
           error.includes('connection');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Check if token needs refresh (but not for auth endpoints)
    if (this.token && !endpoint.includes('/auth/') && shouldRefreshToken(this.token)) {
      try {
        const refreshResponse = await this.refreshToken();
        if (refreshResponse.data?.access_token) {
          this.setToken(refreshResponse.data.access_token);
        }
      } catch (error) {
        console.warn('Token refresh failed:', error);
      }
    }
    
    const headers: HeadersInit = {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    };

    if (this.token) {
      // Validate token before using it
      if (isTokenExpired(this.token)) {
        this.removeToken();
        return { error: 'Token expired' };
      }
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized - token might be invalid
      if (response.status === 401 && this.token && retryCount === 0) {
        // Try to refresh token and retry once
        try {
          const refreshResponse = await this.refreshToken();
          if (refreshResponse.data?.access_token) {
            this.setToken(refreshResponse.data.access_token);
            return this.request(endpoint, options, retryCount + 1);
          }
        } catch (refreshError) {
          // Refresh failed, remove token
          this.removeToken();
          return { error: 'Authentication failed' };
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
        const error = errorData.detail || `HTTP ${response.status}`;
        
        // Notify error handler
        this.handleRequestError(error, endpoint, { 
          status: response.status, 
          statusText: response.statusText,
          ...options 
        });
        
        return { error };
      }

      // Handle empty responses (e.g., 204 No Content)
      if (response.status === 204) {
        return { data: undefined as unknown as T };
      }

      // Attempt to parse JSON; if no body, return undefined
      const text = await response.text();
      if (!text) {
        return { data: undefined as unknown as T };
      }
      const data = JSON.parse(text);
      return { data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      
      // Notify error handler
      this.handleRequestError(error, endpoint, { type: 'network_error', ...options });
      
      return { error: errorMessage };
    }
  }

  // Authentication methods
  async signIn(email: string, password: string): Promise<ApiResponse<{ access_token: string; token_type: string }>> {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
        return { error: errorData.detail || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  async signUp(userData: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    phone?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/users/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request('/users/me');
  }

  async refreshToken(): Promise<ApiResponse<{ access_token: string; token_type: string }>> {
    return this.request('/auth/refresh', {
      method: 'POST',
    });
  }

  // RBAC methods
  async getUserPermissions(): Promise<ApiResponse<{ 
    permissions: string[]; 
    role: string;
    normalized_role: string;
    role_hierarchy_level: number;
    branch_access: string;
  }>> {
    return this.request('/permissions/me');
  }

  async checkUserPermission(permission: string): Promise<ApiResponse<{ 
    has_permission: boolean;
    hasPermission?: boolean; // For backward compatibility
  }>> {
    return this.request('/permissions/check', {
      method: 'POST',
      body: JSON.stringify({ permission, resource_id: null }),
    });
  }

  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request('/users/');
  }

  async updateUser(userId: string, userData: any): Promise<ApiResponse<User>> {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Branch methods
  async getBranches(): Promise<ApiResponse<Branch[]>> {
    return this.request('/branches/');
  }

  async createBranch(branchData: any): Promise<ApiResponse<any>> {
    return this.request('/branches/', {
      method: 'POST',
      body: JSON.stringify(branchData),
    });
  }

  async updateBranch(branchId: string, branchData: any): Promise<ApiResponse<any>> {
    return this.request(`/branches/${branchId}`, {
      method: 'PUT',
      body: JSON.stringify(branchData),
    });
  }

  async deleteBranch(branchId: string): Promise<ApiResponse<void>> {
    return this.request(`/branches/${branchId}`, {
      method: 'DELETE',
    });
  }

  // Student methods
  async getStudents(params?: {
    branch_id?: string;
    search?: string;
    status?: string;
    grade_level?: string;
    class_id?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>> {
    const searchParams = new URLSearchParams();
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.grade_level) searchParams.append('grade_level', params.grade_level);
    if (params?.class_id) searchParams.append('class_id', params.class_id);
    if (params?.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.append('sort_order', params.sort_order);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/students/?${queryString}` : '/students/';
    return this.request(url);
  }

  async getAllStudents(branchId?: string): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (branchId) searchParams.append('branch_id', branchId);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/students/all?${queryString}` : '/students/all';
    return this.request(url);
  }

  async getStudentStats(branchId?: string): Promise<ApiResponse<any>> {
    const params = branchId ? `?branch_id=${branchId}` : '';
    return this.request(`/students/stats${params}`);
  }

  async createStudent(studentData: any): Promise<ApiResponse<any>> {
    return this.request('/students/', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  }

  async updateStudent(studentId: string, studentData: any): Promise<ApiResponse<any>> {
    return this.request(`/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  }

  async deleteStudent(studentId: string): Promise<ApiResponse<void>> {
    return this.request(`/students/${studentId}`, {
      method: 'DELETE',
    });
  }

  async bulkDeleteStudents(studentIds: string[]): Promise<ApiResponse<any>> {
    return this.request('/students/bulk-delete', {
      method: 'POST',
      body: JSON.stringify(studentIds),
    });
  }

  // Teacher methods
  async getTeachers(): Promise<ApiResponse<Teacher[]>> {
    return this.request('/teachers/');
  }

  async createTeacher(teacherData: Partial<Teacher>): Promise<ApiResponse<Teacher>> {
    return this.request('/teachers/', {
      method: 'POST',
      body: JSON.stringify(teacherData),
    });
  }

  async getTeacher(teacherId: string): Promise<ApiResponse<Teacher>> {
    return this.request(`/teachers/${teacherId}`);
  }

  async updateTeacher(teacherId: string, teacherData: Partial<Teacher>): Promise<ApiResponse<Teacher>> {
    return this.request(`/teachers/${teacherId}`, {
      method: 'PUT',
      body: JSON.stringify(teacherData),
    });
  }

  async deleteTeacher(teacherId: string): Promise<ApiResponse<void>> {
    return this.request(`/teachers/${teacherId}`, {
      method: 'DELETE',
    });
  }

  // Attendance methods
  async getAttendance(params?: {
    class_id?: string;
    date?: string;
    student_id?: string;
    status?: string;
    branch_id?: string;
    subject_id?: string;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.class_id) searchParams.append('class_id', params.class_id);
    if (params?.date) searchParams.append('date', params.date);
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.subject_id) searchParams.append('subject_id', params.subject_id);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/attendance/?${queryString}` : '/attendance/';
    return this.request(url);
  }

  async createAttendance(attendanceData: any): Promise<ApiResponse<any>> {
    return this.request('/attendance/', {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    });
  }

  async createBulkAttendance(bulkData: {
    attendance_records: any[];
    class_id: string;
    attendance_date: string;
    recorded_by: string;
    send_notifications?: boolean;
    subject_id?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any[]>> {
    return this.request('/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify(bulkData),
    });
  }

  async updateAttendance(attendanceId: string, attendanceData: any): Promise<ApiResponse<any>> {
    return this.request(`/attendance/${attendanceId}`, {
      method: 'PUT',
      body: JSON.stringify(attendanceData),
    });
  }

  async deleteAttendance(attendanceId: string): Promise<ApiResponse<void>> {
    return this.request(`/attendance/${attendanceId}`, {
      method: 'DELETE',
    });
  }

  // Attendance Analytics and Reporting
  async getAttendanceAnalytics(params?: {
    period_days?: number;
    class_id?: string;
    branch_id?: string;
    teacher_id?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.period_days) searchParams.append('period_days', params.period_days.toString());
    if (params?.class_id) searchParams.append('class_id', params.class_id);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.teacher_id) searchParams.append('teacher_id', params.teacher_id);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/attendance/analytics?${queryString}` : '/attendance/analytics';
    return this.request(url);
  }

  async getAttendanceSummary(
    studentId: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (periodStart) searchParams.append('period_start', periodStart);
    if (periodEnd) searchParams.append('period_end', periodEnd);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/attendance/summary/${studentId}?${queryString}` : `/attendance/summary/${studentId}`;
    return this.request(url);
  }

  async getAttendanceAlerts(params?: {
    student_id?: string;
    unresolved_only?: boolean;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.unresolved_only !== undefined) searchParams.append('unresolved_only', params.unresolved_only.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/attendance/alerts?${queryString}` : '/attendance/alerts';
    return this.request(url);
  }

  async acknowledgeAttendanceAlert(alertId: string): Promise<ApiResponse<any>> {
    return this.request(`/attendance/alerts/${alertId}/acknowledge`, {
      method: 'PATCH',
    });
  }

  async getAttendancePatterns(studentId: string): Promise<ApiResponse<any[]>> {
    return this.request(`/attendance/patterns/${studentId}`);
  }

  async getClassAttendanceReport(
    classId: string,
    reportDate?: string
  ): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (reportDate) searchParams.append('report_date', reportDate);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/attendance/reports/class/${classId}?${queryString}` : `/attendance/reports/class/${classId}`;
    return this.request(url);
  }

  async getMonthlyAttendanceReports(params?: {
    months?: number;
    branch_id?: string;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.months) searchParams.append('months', params.months.toString());
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/attendance/reports/monthly?${queryString}` : '/attendance/reports/monthly';
    return this.request(url);
  }

  async exportAttendanceReport(params: {
    type: string;
    period_days?: number;
    class_id?: string;
    branch_id?: string;
    format?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    searchParams.append('type', params.type);
    if (params.period_days) searchParams.append('period_days', params.period_days.toString());
    if (params.class_id) searchParams.append('class_id', params.class_id);
    if (params.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params.format) searchParams.append('format', params.format);
    
    return this.request(`/attendance/reports/export?${searchParams.toString()}`);
  }

  // Fee methods
  async getFees(branchId?: string, studentId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (branchId) params.append('branch_id', branchId);
    if (studentId) params.append('student_id', studentId);
    return this.request(`/payments/${params.toString() ? '?' + params.toString() : ''}`);
  }

  async createFee(feeData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/', {
      method: 'POST',
      body: JSON.stringify(feeData),
    });
  }

  async updateFee(feeId: string, feeData: any): Promise<ApiResponse<any>> {
    return this.request(`/payments/${feeId}`, {
      method: 'PUT',
      body: JSON.stringify(feeData),
    });
  }

  async deleteFee(feeId: string): Promise<ApiResponse<void>> {
    return this.request(`/payments/${feeId}`, {
      method: 'DELETE',
    });
  }

  // Class methods
  async getClasses(): Promise<ApiResponse<any[]>> {
    return this.request('/classes/');
  }

  async createClass(classData: any): Promise<ApiResponse<any>> {
    return this.request('/classes/', {
      method: 'POST',
      body: JSON.stringify(classData),
    });
  }

  async updateClass(classId: string, classData: any): Promise<ApiResponse<any>> {
    return this.request(`/classes/${classId}`, {
      method: 'PUT',
      body: JSON.stringify(classData),
    });
  }

  async assignSubjectTeacher(classId: string, payload: { subject_id: string; teacher_id: string }): Promise<ApiResponse<any>> {
    return this.request(`/classes/${classId}/subject-teachers`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteClass(classId: string): Promise<ApiResponse<void>> {
    return this.request(`/classes/${classId}`, {
      method: 'DELETE',
    });
  }

  // Grade Level methods
  async getGradeLevels(): Promise<ApiResponse<any[]>> {
    return this.request('/grade-levels/');
  }

  async createGradeLevel(gradeLevelData: any): Promise<ApiResponse<any>> {
    return this.request('/grade-levels/', {
      method: 'POST',
      body: JSON.stringify(gradeLevelData),
    });
  }

  async updateGradeLevel(gradeLevelId: string, gradeLevelData: any): Promise<ApiResponse<any>> {
    return this.request(`/grade-levels/${gradeLevelId}`, {
      method: 'PUT',
      body: JSON.stringify(gradeLevelData),
    });
  }

  async deleteGradeLevel(gradeLevelId: string): Promise<ApiResponse<void>> {
    return this.request(`/grade-levels/${gradeLevelId}`, {
      method: 'DELETE',
    });
  }

  // Subject methods
  async getSubjects(): Promise<ApiResponse<any[]>> {
    return this.request('/subjects/');
  }

  async createSubject(subjectData: any): Promise<ApiResponse<any>> {
    return this.request('/subjects/', {
      method: 'POST',
      body: JSON.stringify(subjectData),
    });
  }

  async updateSubject(subjectId: string, subjectData: any): Promise<ApiResponse<any>> {
    return this.request(`/subjects/${subjectId}`, {
      method: 'PUT',
      body: JSON.stringify(subjectData),
    });
  }

  async deleteSubject(subjectId: string): Promise<ApiResponse<void>> {
    return this.request(`/subjects/${subjectId}`, {
      method: 'DELETE',
    });
  }

  // Payment methods
  async getPaymentModes(): Promise<ApiResponse<any[]>> {
    return this.request('/payment-mode/');
  }

  async createPaymentMode(paymentModeData: any): Promise<ApiResponse<any>> {
    return this.request('/payment-mode/', {
      method: 'POST',
      body: JSON.stringify(paymentModeData),
    });
  }

  async updatePaymentMode(pmId: string, paymentModeData: any): Promise<ApiResponse<any>> {
    return this.request(`/payment-mode/${pmId}`, {
      method: 'PUT',
      body: JSON.stringify(paymentModeData),
    });
  }

  async deletePaymentMode(pmId: string): Promise<ApiResponse<void>> {
    return this.request(`/payment-mode/${pmId}`, {
      method: 'DELETE',
    });
  }

  // Reports and Analytics API Methods
  async getFinancialSummary(params?: {
    start_date?: string;
    end_date?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    
    const queryString = searchParams.toString();
    return this.request(`/reports/financial-reports/summary${queryString ? '?' + queryString : ''}`);
  }

  async getAttendanceReportSummary(params?: {
    start_date?: string;
    end_date?: string;
    class_id?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.class_id) searchParams.append('class_id', params.class_id);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    
    const queryString = searchParams.toString();
    return this.request(`/reports/attendance-reports/summary${queryString ? '?' + queryString : ''}`);
  }

  async getAnalyticsOverview(params?: {
    branch_id?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    
    const queryString = searchParams.toString();
    return this.request(`/reports/analytics/overview${queryString ? '?' + queryString : ''}`);
  }

  async getPerformanceAnalytics(params?: {
    academic_year?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    
    const queryString = searchParams.toString();
    return this.request(`/reports/analytics/performance${queryString ? '?' + queryString : ''}`);
  }

  async getAcademicReports(params?: {
    skip?: number;
    limit?: number;
    report_type?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.report_type) searchParams.append('report_type', params.report_type);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    
    const queryString = searchParams.toString();
    return this.request(`/reports/academic-reports${queryString ? '?' + queryString : ''}`);
  }

  async createAcademicReport(reportData: any): Promise<ApiResponse<any>> {
    return this.request('/reports/academic-reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  }

  async getStudentReports(params?: {
    skip?: number;
    limit?: number;
    student_id?: string;
    class_id?: string;
    academic_year?: string;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.class_id) searchParams.append('class_id', params.class_id);
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    
    const queryString = searchParams.toString();
    return this.request(`/reports/student-reports${queryString ? '?' + queryString : ''}`);
  }

  async generateStudentReportCard(
    studentId: string,
    academicYear: string,
    term: string
  ): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    searchParams.append('academic_year', academicYear);
    searchParams.append('term', term);
    
    return this.request(`/reports/student-reports/generate/${studentId}?${searchParams.toString()}`);
  }

  async getClassReports(params?: {
    skip?: number;
    limit?: number;
    class_id?: string;
    teacher_id?: string;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.class_id) searchParams.append('class_id', params.class_id);
    if (params?.teacher_id) searchParams.append('teacher_id', params.teacher_id);
    
    const queryString = searchParams.toString();
    return this.request(`/reports/class-reports${queryString ? '?' + queryString : ''}`);
  }

  async createClassReport(reportData: any): Promise<ApiResponse<any>> {
    return this.request('/reports/class-reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  }

  async getReportTemplates(params?: {
    skip?: number;
    limit?: number;
    report_type?: string;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.report_type) searchParams.append('report_type', params.report_type);
    
    const queryString = searchParams.toString();
    return this.request(`/reports/templates${queryString ? '?' + queryString : ''}`);
  }

  async createReportTemplate(templateData: any): Promise<ApiResponse<any>> {
    return this.request('/reports/templates', {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  async getReportSchedules(params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    
    const queryString = searchParams.toString();
    return this.request(`/reports/schedules${queryString ? '?' + queryString : ''}`);
  }

  async createReportSchedule(scheduleData: any): Promise<ApiResponse<any>> {
    return this.request('/reports/schedules', {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
  }

  // Registration Payment methods
  async getRegistrationPayments(branchId?: string, studentId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (branchId) params.append('branch_id', branchId);
    if (studentId) params.append('student_id', studentId);
    return this.request(`/payments/${params.toString() ? '?' + params.toString() : ''}`);
  }

  async createRegistrationPayment(paymentData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  async updateRegistrationPayment(paymentId: string, paymentData: any): Promise<ApiResponse<any>> {
    return this.request(`/payments/${paymentId}`, {
      method: 'PUT',
      body: JSON.stringify(paymentData),
    });
  }

  async addPartialPayment(paymentId: string, additionalPayment: any): Promise<ApiResponse<any>> {
    return this.request(`/payments/${paymentId}/add-payment`, {
      method: 'POST',
      body: JSON.stringify(additionalPayment),
    });
  }

  async addPartialPaymentToFee(feeId: string, additionalPayment: any): Promise<ApiResponse<any>> {
    return this.request(`/payments/${feeId}/add-payment`, {
      method: 'POST',
      body: JSON.stringify(additionalPayment),
    });
  }

  async checkExistingFees(studentId: string, academicYear: string): Promise<ApiResponse<any>> {
    return this.request(`/payments/check-existing/${studentId}?academic_year=${academicYear}`, {
      method: 'GET',
    });
  }

  async deleteRegistrationPayment(paymentId: string): Promise<ApiResponse<void>> {
    return this.request(`/payments/${paymentId}`, {
      method: 'DELETE',
    });
  }

  // Student Enrollment methods
  async getStudentEnrollments(): Promise<ApiResponse<any[]>> {
    return this.request('/student-enrollments/');
  }

  async createStudentEnrollment(enrollmentData: any): Promise<ApiResponse<any>> {
    return this.request('/student-enrollments/', {
      method: 'POST',
      body: JSON.stringify(enrollmentData),
    });
  }

  async updateStudentEnrollment(enrollmentId: string, enrollmentData: any): Promise<ApiResponse<any>> {
    return this.request(`/student-enrollments/${enrollmentId}`, {
      method: 'PUT',
      body: JSON.stringify(enrollmentData),
    });
  }

  async deleteStudentEnrollment(enrollmentId: string): Promise<ApiResponse<void>> {
    return this.request(`/student-enrollments/${enrollmentId}`, {
      method: 'DELETE',
    });
  }

  // Backup Log methods
  async getBackupLogs(): Promise<ApiResponse<any[]>> {
    return this.request('/backup-logs/');
  }

  async createBackupLog(backupData: any): Promise<ApiResponse<any>> {
    return this.request('/backup-logs/', {
      method: 'POST',
      body: JSON.stringify(backupData),
    });
  }

  async createManualBackup(): Promise<ApiResponse<any>> {
    return this.request('/backup-logs/create-backup', {
      method: 'POST',
    });
  }

  async restoreFromBackup(backupId: string): Promise<ApiResponse<any>> {
    return this.request(`/backup-logs/restore/${backupId}`, {
      method: 'POST',
    });
  }

  async updateBackupLog(backupId: string, backupData: any): Promise<ApiResponse<any>> {
    return this.request(`/backup-logs/${backupId}`, {
      method: 'PUT',
      body: JSON.stringify(backupData),
    });
  }

  async deleteBackupLog(backupId: string): Promise<ApiResponse<void>> {
    return this.request(`/backup-logs/${backupId}`, {
      method: 'DELETE',
    });
  }

  // Grade Transition methods
  async getGradeTransitions(): Promise<ApiResponse<any[]>> {
    return this.request('/grade-transitions/');
  }

  async createGradeTransition(transitionData: any): Promise<ApiResponse<any>> {
    return this.request('/grade-transitions/', {
      method: 'POST',
      body: JSON.stringify(transitionData),
    });
  }

  async updateGradeTransition(transitionId: string, transitionData: any): Promise<ApiResponse<any>> {
    return this.request(`/grade-transitions/${transitionId}`, {
      method: 'PUT',
      body: JSON.stringify(transitionData),
    });
  }

  async deleteGradeTransition(transitionId: string): Promise<ApiResponse<void>> {
    return this.request(`/grade-transitions/${transitionId}`, {
      method: 'DELETE',
    });
  }

  async getGradeTransitionPreview(): Promise<ApiResponse<any[]>> {
    return this.request('/grade-transitions/preview/transition');
  }

  async executeGradeTransition(): Promise<ApiResponse<any>> {
    return this.request('/grade-transitions/execute/transition', {
      method: 'POST',
    });
  }

  // Parent methods
  async getParents(params?: { branch_id?: string; search?: string; page?: number; limit?: number }): Promise<ApiResponse<{ items: Parent[]; total: number; page: number; limit: number; pages: number }>> {
    const searchParams = new URLSearchParams();
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/parents/${queryString}`);
  }

  async getParent(parentId: string): Promise<ApiResponse<Parent>> {
    return this.request(`/parents/${parentId}`);
  }

  async createParent(parentData: Partial<Parent>): Promise<ApiResponse<Parent>> {
    return this.request('/parents/', {
      method: 'POST',
      body: JSON.stringify(parentData),
    });
  }

  async updateParent(parentId: string, parentData: Partial<Parent>): Promise<ApiResponse<Parent>> {
    return this.request(`/parents/${parentId}`, {
      method: 'PUT',
      body: JSON.stringify(parentData),
    });
  }

  async deleteParent(parentId: string): Promise<ApiResponse<void>> {
    return this.request(`/parents/${parentId}`, {
      method: 'DELETE',
    });
  }

  async getParentStudents(parentId: string): Promise<ApiResponse<Student[]>> {
    return this.request(`/parents/${parentId}/students`);
  }

  async linkStudentToParent(parentId: string, studentId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/parents/${parentId}/link-student/${studentId}`, {
      method: 'POST',
    });
  }

  async unlinkStudentFromParent(parentId: string, studentId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/parents/${parentId}/unlink-student/${studentId}`, {
      method: 'DELETE',
    });
  }

  // Teacher class assignment methods
  async getTeacherClasses(teacherId: string): Promise<ApiResponse<{ teacher_id: string; teacher_name: string; classes: any[]; total_classes: number; total_students: number }>> {
    return this.request(`/teachers/${teacherId}/classes`);
  }

  async syncClassRoster(teacherId: string, classId: string): Promise<ApiResponse<any>> {
    return this.request(`/teachers/${teacherId}/classes/${classId}/sync-roster`, {
      method: 'POST',
    });
  }

  async getTeacherDashboardData(teacherId: string): Promise<ApiResponse<any>> {
    return this.request(`/teachers/${teacherId}/dashboard-data`);
  }

  // Enhanced teacher dashboard endpoints
  async getTeacherEnhancedDashboard(teacherId: string): Promise<ApiResponse<any>> {
    return this.request(`/teachers/enhanced/${teacherId}/dashboard-data`);
  }

  async getTeacherEnhancedClasses(teacherId: string): Promise<ApiResponse<any>> {
    return this.request(`/teachers/enhanced/${teacherId}/classes`);
  }

  async getMyTeacherClasses(): Promise<ApiResponse<any>> {
    return this.request(`/teachers/enhanced/me/classes`);
  }

  async syncTeacherClassRoster(teacherId: string, classId: string): Promise<ApiResponse<any>> {
    return this.request(`/teachers/enhanced/${teacherId}/classes/${classId}/sync-roster`, {
      method: 'POST',
    });
  }

  async assignTeacherToClass(classId: string, teacherId: string): Promise<ApiResponse<any>> {
    return this.request(`/classes/${classId}`, {
      method: 'PUT',
      body: JSON.stringify({ teacher_id: teacherId }),
    });
  }

  async unassignTeacherFromClass(classId: string): Promise<ApiResponse<any>> {
    return this.request(`/classes/${classId}`, {
      method: 'PUT',
      body: JSON.stringify({ teacher_id: null }),
    });
  }

  // Dashboard and Statistics methods
  async getDashboardStats(branchId?: string): Promise<ApiResponse<any>> {
    const params = branchId ? `?branch_id=${branchId}` : '';
    return this.request(`/stats/dashboard${params}`);
  }

  // System Monitoring endpoints
  async getSystemMetrics(): Promise<ApiResponse<any>> {
    return this.request('/system-monitoring/metrics');
  }

  async getActivityLogs(limit: number = 20): Promise<ApiResponse<any>> {
    return this.request(`/system-monitoring/activity-logs?limit=${limit}`);
  }

  async getSystemHealth(): Promise<ApiResponse<any>> {
    return this.request('/system-monitoring/health');
  }

  // Widget-specific API methods
  async getTeacherSchedule(teacherId?: string): Promise<ApiResponse<any>> {
    const params = teacherId ? `?teacher_id=${teacherId}` : '';
    return this.request(`/teachers/schedule${params}`);
  }

  // Timetable API methods
  async getTeacherTimetable(teacherId: string): Promise<ApiResponse<any>> {
    // Uses backend route: GET /timetable/teacher/{teacher_id}
    return this.request(`/timetable/teacher/${teacherId}`);
  }

  async getPendingGrades(teacherId?: string): Promise<ApiResponse<any>> {
    const params = teacherId ? `?teacher_id=${teacherId}` : '';
    return this.request(`/exams/pending-grades${params}`);
  }

  async getTeacherNotifications(teacherId?: string): Promise<ApiResponse<any>> {
    const params = teacherId ? `?teacher_id=${teacherId}` : '';
    return this.request(`/notifications/teacher${params}`);
  }

  async getStudentProgress(teacherId?: string): Promise<ApiResponse<any>> {
    const params = teacherId ? `?teacher_id=${teacherId}` : '';
    return this.request(`/students/progress${params}`);
  }

  async getStudentGrades(studentId?: string): Promise<ApiResponse<any>> {
    const params = studentId ? `?student_id=${studentId}` : '';
    return this.request(`/exam-results/student${params}`);
  }

  async getUpcomingExams(studentId?: string, branchId?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (studentId) searchParams.append('student_id', studentId);
    if (branchId) searchParams.append('branch_id', branchId);
    const params = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/exams/upcoming${params}`);
  }

  async getStudentAttendance(studentId?: string): Promise<ApiResponse<any>> {
    const params = studentId ? `?student_id=${studentId}` : '';
    return this.request(`/attendance/student${params}`);
  }

  async getAnnouncements(branchId?: string, userRole?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (branchId) searchParams.append('branch_id', branchId);
    if (userRole) searchParams.append('target_audience', userRole);
    const params = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/notifications/announcements${params}`);
  }

  async getParentChildren(parentId?: string): Promise<ApiResponse<any>> {
    const params = parentId ? `?parent_id=${parentId}` : '';
    return this.request(`/students/parent-children${params}`);
  }

  async getStudentFeeStatus(studentId?: string): Promise<ApiResponse<any>> {
    const params = studentId ? `?student_id=${studentId}` : '';
    return this.request(`/fees/student-status${params}`);
  }

  async getSystemStatus(): Promise<ApiResponse<any>> {
    return this.request('/stats/system-status');
  }

  // Upload methods
  async uploadFile(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/uploads/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
        return { error: errorData.detail || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  async getUploadedFiles(): Promise<ApiResponse<any[]>> {
    return this.request('/uploads/files');
  }

  async deleteUploadedFile(filename: string): Promise<ApiResponse<void>> {
    return this.request(`/uploads/${filename}`, {
      method: 'DELETE',
    });
  }

  // Discipline Management methods
  async getDisciplinaryStats(branchId?: string): Promise<ApiResponse<any>> {
    const params = branchId ? `?branch_id=${branchId}` : '';
    return this.request(`/discipline/stats${params}`);
  }

  async getIncidents(params?: {
    student_id?: string;
    incident_type?: string;
    severity?: string;
    status?: string;
    branch_id?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.incident_type) searchParams.append('incident_type', params.incident_type);
    if (params?.severity) searchParams.append('severity', params.severity);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/discipline/incidents?${queryString}` : '/discipline/incidents';
    return this.request(url);
  }

  async createIncident(incidentData: any): Promise<ApiResponse<any>> {
    return this.request('/discipline/incidents', {
      method: 'POST',
      body: JSON.stringify(incidentData),
    });
  }

  async updateIncident(incidentId: string, incidentData: any): Promise<ApiResponse<any>> {
    return this.request(`/discipline/incidents/${incidentId}`, {
      method: 'PUT',
      body: JSON.stringify(incidentData),
    });
  }

  async deleteIncident(incidentId: string): Promise<ApiResponse<void>> {
    return this.request(`/discipline/incidents/${incidentId}`, {
      method: 'DELETE',
    });
  }

  async getBehaviorPoints(params?: {
    student_id?: string;
    point_type?: string;
    category?: string;
    branch_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.point_type) searchParams.append('point_type', params.point_type);
    if (params?.category) searchParams.append('category', params.category);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/discipline/behavior-points?${queryString}` : '/discipline/behavior-points';
    return this.request(url);
  }

  async createBehaviorPoint(pointData: any): Promise<ApiResponse<any>> {
    return this.request('/discipline/behavior-points', {
      method: 'POST',
      body: JSON.stringify(pointData),
    });
  }

  async updateBehaviorPoint(pointId: string, pointData: any): Promise<ApiResponse<any>> {
    return this.request(`/discipline/behavior-points/${pointId}`, {
      method: 'PUT',
      body: JSON.stringify(pointData),
    });
  }

  async deleteBehaviorPoint(pointId: string): Promise<ApiResponse<void>> {
    return this.request(`/discipline/behavior-points/${pointId}`, {
      method: 'DELETE',
    });
  }

  async getRewards(params?: {
    student_id?: string;
    reward_type?: string;
    branch_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.reward_type) searchParams.append('reward_type', params.reward_type);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/discipline/rewards?${queryString}` : '/discipline/rewards';
    return this.request(url);
  }

  async createReward(rewardData: any): Promise<ApiResponse<any>> {
    return this.request('/discipline/rewards', {
      method: 'POST',
      body: JSON.stringify(rewardData),
    });
  }

  async updateReward(rewardId: string, rewardData: any): Promise<ApiResponse<any>> {
    return this.request(`/discipline/rewards/${rewardId}`, {
      method: 'PUT',
      body: JSON.stringify(rewardData),
    });
  }

  async deleteReward(rewardId: string): Promise<ApiResponse<void>> {
    return this.request(`/discipline/rewards/${rewardId}`, {
      method: 'DELETE',
    });
  }

  async getCounselingSessions(params?: {
    student_id?: string;
    counselor_id?: string;
    status?: string;
    branch_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.counselor_id) searchParams.append('counselor_id', params.counselor_id);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/discipline/counseling-sessions?${queryString}` : '/discipline/counseling-sessions';
    return this.request(url);
  }

  async createCounselingSession(sessionData: any): Promise<ApiResponse<any>> {
    return this.request('/discipline/counseling-sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async updateCounselingSession(sessionId: string, sessionData: any): Promise<ApiResponse<any>> {
    return this.request(`/discipline/counseling-sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(sessionData),
    });
  }

  async deleteCounselingSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.request(`/discipline/counseling-sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async getBehaviorContracts(params?: {
    student_id?: string;
    status?: string;
    branch_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/discipline/behavior-contracts?${queryString}` : '/discipline/behavior-contracts';
    return this.request(url);
  }

  async createBehaviorContract(contractData: any): Promise<ApiResponse<any>> {
    return this.request('/discipline/behavior-contracts', {
      method: 'POST',
      body: JSON.stringify(contractData),
    });
  }

  async updateBehaviorContract(contractId: string, contractData: any): Promise<ApiResponse<any>> {
    return this.request(`/discipline/behavior-contracts/${contractId}`, {
      method: 'PUT',
      body: JSON.stringify(contractData),
    });
  }

  async deleteBehaviorContract(contractId: string): Promise<ApiResponse<void>> {
    return this.request(`/discipline/behavior-contracts/${contractId}`, {
      method: 'DELETE',
    });
  }

  // Exam Management Methods
  async getExams(params?: {
    class_id?: string;
    subject_id?: string;
    academic_year?: string;
    term?: string;
    exam_type?: string;
    branch_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.class_id) searchParams.append('class_id', params.class_id);
    if (params?.subject_id) searchParams.append('subject_id', params.subject_id);
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.term) searchParams.append('term', params.term);
    if (params?.exam_type) searchParams.append('exam_type', params.exam_type);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/exams?${queryString}` : '/exams';
    return this.request(url);
  }

  async getExam(examId: string): Promise<ApiResponse<any>> {
    return this.request(`/exams/${examId}`);
  }

  async createExam(examData: any): Promise<ApiResponse<any>> {
    return this.request('/exams', {
      method: 'POST',
      body: JSON.stringify(examData),
    });
  }

  async updateExam(examId: string, examData: any): Promise<ApiResponse<any>> {
    return this.request(`/exams/${examId}`, {
      method: 'PUT',
      body: JSON.stringify(examData),
    });
  }

  async deleteExam(examId: string): Promise<ApiResponse<void>> {
    return this.request(`/exams/${examId}`, {
      method: 'DELETE',
    });
  }

  async getExamStats(examId: string): Promise<ApiResponse<any>> {
    return this.request(`/exams/${examId}/stats`);
  }

  // Exam Results Management Methods
  async getExamResults(params?: {
    exam_id?: string;
    student_id?: string;
    class_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.exam_id) searchParams.append('exam_id', params.exam_id);
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.class_id) searchParams.append('class_id', params.class_id);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/exam-results?${queryString}` : '/exam-results';
    return this.request(url);
  }

  async getExamResult(resultId: string): Promise<ApiResponse<any>> {
    return this.request(`/exam-results/${resultId}`);
  }

  async createExamResult(resultData: any): Promise<ApiResponse<any>> {
    return this.request('/exam-results', {
      method: 'POST',
      body: JSON.stringify(resultData),
    });
  }

  async updateExamResult(resultId: string, resultData: any): Promise<ApiResponse<any>> {
    return this.request(`/exam-results/${resultId}`, {
      method: 'PUT',
      body: JSON.stringify(resultData),
    });
  }

  async deleteExamResult(resultId: string): Promise<ApiResponse<void>> {
    return this.request(`/exam-results/${resultId}`, {
      method: 'DELETE',
    });
  }

  async getStudentExamSummary(studentId: string, academicYear?: string, term?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (academicYear) searchParams.append('academic_year', academicYear);
    if (term) searchParams.append('term', term);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/exam-results/student/${studentId}/summary?${queryString}` : `/exam-results/student/${studentId}/summary`;
    return this.request(url);
  }

  // Report Card Generation Methods
  async generateReportCard(reportData: {
    student_id: string;
    academic_year: string;
    term: string;
    template_id?: string;
    include_transcript?: boolean;
    publish_to_parent?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request('/exams/report-cards', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  }

  async generateBulkReportCards(bulkData: {
    class_id?: string;
    student_ids?: string[];
    academic_year: string;
    term: string;
    template_id?: string;
    auto_publish?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request('/exams/report-cards/bulk', {
      method: 'POST',
      body: JSON.stringify(bulkData),
    });
  }

  async publishReportCard(reportCardId: string): Promise<ApiResponse<any>> {
    return this.request(`/exams/report-cards/${reportCardId}/publish`, {
      method: 'PUT',
    });
  }

  async getReportCardTemplates(templateType?: string, gradeLevel?: string): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (templateType) searchParams.append('template_type', templateType);
    if (gradeLevel) searchParams.append('grade_level', gradeLevel);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/exams/report-templates?${queryString}` : '/exams/report-templates';
    return this.request(url);
  }

  async createReportCardTemplate(templateData: any): Promise<ApiResponse<any>> {
    return this.request('/exams/report-templates', {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  // Grade Analytics and GPA Methods
  async getStudentGPA(studentId: string, academicYear?: string, term?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (academicYear) searchParams.append('academic_year', academicYear);
    if (term) searchParams.append('term', term);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/exams/students/${studentId}/gpa?${queryString}` : `/exams/students/${studentId}/gpa`;
    return this.request(url);
  }

  async getStudentTranscript(studentId: string, academicYears: string[]): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    academicYears.forEach(year => searchParams.append('academic_years', year));
    
    return this.request(`/exams/students/${studentId}/transcript?${searchParams.toString()}`);
  }

  async getClassRankings(classId: string, academicYear: string, term: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    searchParams.append('academic_year', academicYear);
    searchParams.append('term', term);
    
    return this.request(`/exams/classes/${classId}/rankings?${searchParams.toString()}`);
  }

  async getGradeAnalytics(studentId: string, subjectId?: string, academicYear?: string, term?: string): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (subjectId) searchParams.append('subject_id', subjectId);
    if (academicYear) searchParams.append('academic_year', academicYear);
    if (term) searchParams.append('term', term);
    
    const queryString = searchParams.toString();
    const url = queryString ? `/exams/students/${studentId}/grade-analytics?${queryString}` : `/exams/students/${studentId}/grade-analytics`;
    return this.request(url);
  }

  // Widget-specific enhanced methods
  async getRealPendingGrades(teacherId?: string): Promise<ApiResponse<any>> {
    // Get exams where teacher_id matches and no results exist yet
    const { data: exams, error: examError } = await this.getExams({
      // We'll filter by teacher in the frontend since the API doesn't support teacher_id directly
    });
    
    if (examError) throw new Error(examError);
    
    const teacherExams = Array.isArray(exams) ? exams.filter((exam: any) => 
      exam.teacher_id === teacherId
    ) : [];
    
    // For each exam, check if results exist
    const pendingGrades = await Promise.all(
      teacherExams.map(async (exam: any) => {
        const { data: results } = await this.getExamResults({ exam_id: exam.id });
        const resultsCount = Array.isArray(results) ? results.length : 0;
        
        // If no results or incomplete results, this exam needs grading
        if (resultsCount === 0) {
          return {
            id: exam.id,
            type: exam.exam_type || 'exam',
            title: exam.name || 'Untitled Exam',
            class: exam.class_name || 'Unknown Class',
            subject: exam.subject_name || 'General',
            students: exam.total_students || 0,
            dueDate: exam.exam_date,
            priority: new Date(exam.exam_date) < new Date() ? 'high' : 'medium',
          };
        }
        return null;
      })
    );
    
    return { data: pendingGrades.filter(Boolean) };
  }

  async getRealUpcomingExams(studentId?: string, branchId?: string): Promise<ApiResponse<any>> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3); // Get exams for next 3 months
    
    const { data: exams, error } = await this.getExams({
      branch_id: branchId,
      // Filter for future exams in the frontend since API doesn't support date filtering
    });
    
    if (error) throw new Error(error);
    
    const upcomingExams = Array.isArray(exams) ? exams
      .filter((exam: any) => new Date(exam.exam_date) > today)
      .sort((a: any, b: any) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime())
      .map((exam: any) => ({
        id: exam.id,
        subject: exam.subject_name || 'General',
        title: exam.name || 'Exam',
        date: exam.exam_date,
        time: '09:00 AM', // Default time since API doesn't provide it
        duration: `${exam.duration_minutes || 120} minutes`,
        room: 'TBA', // Not in current API
        type: exam.exam_type || 'final',
        teacher: exam.teacher_name || 'Teacher',
        syllabus: exam.syllabus_topics || [],
        priority: 'medium'
      })) : [];
    
    return { data: upcomingExams };
  }

  // Generic HTTP methods for flexibility (used by inventory and other modules)
  async get<T>(endpoint: string): Promise<{ data: T }> {
    const response = await this.request<T>(endpoint);
    if (response.error) {
      throw new Error(response.error);
    }
    return { data: response.data };
  }

  async post<T>(endpoint: string, data?: any): Promise<{ data: T }> {
    const response = await this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (response.error) {
      throw new Error(response.error);
    }
    return { data: response.data };
  }

  async put<T>(endpoint: string, data?: any): Promise<{ data: T }> {
    const response = await this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (response.error) {
      throw new Error(response.error);
    }
    return { data: response.data };
  }

  async patch<T>(endpoint: string, data?: any): Promise<{ data: T }> {
    const response = await this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (response.error) {
      throw new Error(response.error);
    }
    return { data: response.data };
  }

  async delete<T>(endpoint: string): Promise<{ data: T }> {
    const response = await this.request<T>(endpoint, {
      method: 'DELETE',
    });
    if (response.error) {
      throw new Error(response.error);
    }
    return { data: response.data };
  }

  // Payment API methods
  async getPaymentAnalyticsSummary(params?: {
    academic_year?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/analytics/summary?${queryString}` : '/payments/analytics/summary';
    return this.request(url);
  }

  async getPaymentDashboard(params?: {
    academic_year?: string;
    status?: string;
    payment_cycle?: string;
    start_date?: string;
    end_date?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.payment_cycle) searchParams.append('payment_cycle', params.payment_cycle);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/dashboard?${queryString}` : '/payments/dashboard';
    return this.request(url);
  }


  async getStudentPaymentStatus(
    studentId: string,
    academicYear?: string
  ): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (academicYear) params.append('academic_year', academicYear);
    const queryString = params.toString();
    const url = queryString ? 
      `/payments/student-status/${studentId}?${queryString}` : 
      `/payments/student-status/${studentId}`;
    return this.request(url);
  }

  async createPaymentLink(paymentData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/payment-links', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  async getPaymentFees(params?: {
    student_id?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/fees?${queryString}` : '/payments/fees';
    return this.request(url);
  }

  async checkPaymentsHealth(): Promise<ApiResponse<any>> {
    return this.request('/payments/health');
  }

  // Fee Template Management Methods
  async getFeeTemplates(params?: {
    branch_id?: string;
    academic_year?: string;
    category?: string;
    is_active?: boolean;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.category) searchParams.append('category', params.category);
    if (params?.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/fee-templates?${queryString}` : '/payments/fee-templates';
    return this.request(url);
  }

  async createFeeTemplate(templateData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/fee-templates', {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  async updateFeeTemplate(templateId: string, templateData: any): Promise<ApiResponse<any>> {
    return this.request(`/payments/fee-templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(templateData),
    });
  }

  async deleteFeeTemplate(templateId: string): Promise<ApiResponse<void>> {
    return this.request(`/payments/fee-templates/${templateId}`, {
      method: 'DELETE',
    });
  }

  async bulkCreateFeeTemplates(templates: any[]): Promise<ApiResponse<any[]>> {
    return this.request('/payments/fee-templates/bulk', {
      method: 'POST',
      body: JSON.stringify(templates),
    });
  }

  async getCurrentAcademicYear(): Promise<ApiResponse<{ academic_year: string }>> {
    return this.request('/academic-calendar/academic-years/current');
  }

  // ======================== COMPREHENSIVE PAYMENT API METHODS ========================

  // Fee Template Management
  async createFeeTemplateComprehensive(templateData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/fee-templates', {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  async getFeeTemplatesComprehensive(params?: {
    branch_id?: string;
    academic_year?: string;
    category?: string;
    is_active?: boolean;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.category) searchParams.append('category', params.category);
    if (params?.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/fee-templates?${queryString}` : '/payments/fee-templates';
    return this.request(url);
  }

  async updateFeeTemplateComprehensive(templateId: string, templateData: any): Promise<ApiResponse<any>> {
    return this.request(`/payments/fee-templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(templateData),
    });
  }

  async deleteFeeTemplateComprehensive(templateId: string): Promise<ApiResponse<void>> {
    return this.request(`/payments/fee-templates/${templateId}`, {
      method: 'DELETE',
    });
  }

  async bulkCreateFeeTemplatesComprehensive(templates: any[]): Promise<ApiResponse<any[]>> {
    return this.request('/payments/fee-templates/bulk', {
      method: 'POST',
      body: JSON.stringify(templates),
    });
  }

  // Payment Transaction Management
  async createPaymentTransaction(transactionData: any, branchId?: string): Promise<ApiResponse<any>> {
    // Extract branch_id from transactionData or use the provided parameter
    const branch = branchId || transactionData.branch_id;
    const queryParams = branch ? `?branch_id=${branch}` : '';

    return this.request(`/payments/transactions${queryParams}`, {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  async getPaymentTransactions(params?: {
    student_id?: string;
    status?: string;
    payment_method?: string;
    academic_year?: string;
    date_from?: string;
    date_to?: string;
    student_name?: string;
    amount_min?: number;
    amount_max?: number;
    transaction_reference?: string;
    branch_id?: string;
    skip?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse<{
    data: PaymentTransaction[];
    total: number;
    page: number;
    pages: number;
  }>> {
    const searchParams = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (key === 'branch_id' && value === 'all') {
          // Pass 'all' as-is to backend for cross-branch queries
          searchParams.append(key, 'all');
          return;
        }
        searchParams.append(key, value.toString());
      }
    });

    const queryString = searchParams.toString();
    const url = queryString ? `/payments/transactions/search?${queryString}` : '/payments/transactions/search';
    const response = await this.request(url);

    // Transform the response to match expected structure
    if (response.data && 'transactions' in response.data) {
      const backendData = response.data as any;
      response.data = {
        data: backendData.transactions || [],
        total: backendData.total_count || 0,
        page: Math.floor((backendData.skip || 0) / (backendData.limit || 10)) + 1,
        pages: Math.ceil((backendData.total_count || 0) / (backendData.limit || 10))
      };
    }

    return response;
  }

  async bulkCreatePaymentTransactions(transactionsData: any[]): Promise<ApiResponse<any[]>> {
    return this.request('/payments/transactions/bulk', {
      method: 'POST',
      body: JSON.stringify(transactionsData),
    });
  }

  async approvePaymentTransaction(transactionId: string, approvalData: any): Promise<ApiResponse<any>> {
    return this.request(`/payments/transactions/${transactionId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(approvalData),
    });
  }

  // Pending Approvals API Methods
  async getPendingApprovals(params?: {
    branch_id?: string;
    priority?: 'high' | 'medium' | 'low';
    approval_reason?: string;
    limit?: number;
    skip?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse<{ data: any[], total: number }>> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
    }
    const queryString = queryParams.toString();
    const url = `/payments/transactions/pending-approvals${queryString ? `?${queryString}` : ''}`;
    return this.request(url);
  }

  async getApprovalQueueMetrics(branchId?: string): Promise<ApiResponse<any>> {
    const params = branchId ? `?branch_id=${branchId}` : '';
    return this.request(`/payments/approvals/metrics${params}`);
  }

  async bulkApproveTransactions(data: {
    transaction_ids: string[];
    action: 'approve' | 'reject';
    notes?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/payments/transactions/bulk-approve', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getApprovalAuditTrail(transactionId: string): Promise<ApiResponse<any>> {
    return this.request(`/payments/transactions/${transactionId}/approval-history`);
  }

  async escalateApproval(transactionId: string, data: {
    escalate_to: string;
    reason: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request(`/payments/transactions/${transactionId}/escalate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async requestAdditionalInfo(transactionId: string, data: {
    requested_info: string[];
    notes?: string;
    due_date?: string;
  }): Promise<ApiResponse<any>> {
    return this.request(`/payments/transactions/${transactionId}/request-info`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getApprovalWorkflowConfig(branchId?: string): Promise<ApiResponse<any>> {
    const params = branchId ? `?branch_id=${branchId}` : '';
    return this.request(`/payments/approval-config${params}`);
  }

  async reconcilePayments(reconciliationData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/transactions/reconcile', {
      method: 'POST',
      body: JSON.stringify(reconciliationData),
    });
  }

  // Export transactions with filtering
  async exportPaymentTransactions(params: {
    branch_id?: string;
    status?: string;
    payment_method?: string;
    date_from?: string;
    date_to?: string;
    student_name?: string;
    amount_min?: number;
    amount_max?: number;
    transaction_reference?: string;
    export_type: 'csv' | 'excel' | 'json';
    selected_ids?: string[];
  }): Promise<ApiResponse<Blob>> {
    const searchParams = new URLSearchParams();

    // Add all filter parameters
    if (params.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params.status) searchParams.append('status', params.status);
    if (params.payment_method) searchParams.append('payment_method', params.payment_method);
    if (params.date_from) searchParams.append('date_from', params.date_from);
    if (params.date_to) searchParams.append('date_to', params.date_to);
    if (params.student_name) searchParams.append('student_name', params.student_name);
    if (params.amount_min) searchParams.append('amount_min', params.amount_min.toString());
    if (params.amount_max) searchParams.append('amount_max', params.amount_max.toString());
    if (params.transaction_reference) searchParams.append('transaction_reference', params.transaction_reference);
    if (params.export_type) searchParams.append('format', params.export_type);
    if (params.selected_ids && params.selected_ids.length > 0) {
      params.selected_ids.forEach(id => searchParams.append('transaction_ids', id));
    }

    const queryString = searchParams.toString();
    const url = `/payments/transactions/export${queryString ? `?${queryString}` : ''}`;

    // Return raw response for file download
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return {
      data: await response.blob(),
      message: 'Export successful'
    };
  }

  // Void/refund transaction
  async voidPaymentTransaction(transactionId: string, data: {
    reason: string;
    refund_amount?: number;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request(`/payments/transactions/${transactionId}/void`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Download payment receipt
  async downloadPaymentReceipt(transactionId: string, format: 'pdf' | 'html' = 'pdf'): Promise<ApiResponse<Blob>> {
    const response = await fetch(`${API_BASE_URL}/payments/transactions/${transactionId}/receipt?format=${format}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Receipt download failed: ${response.statusText}`);
    }

    return {
      data: await response.blob(),
      message: 'Receipt downloaded successfully'
    };
  }

  // Invoice Management
  async createPaymentInvoice(invoiceData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    });
  }

  async generateBatchInvoices(batchData: any): Promise<ApiResponse<any[]>> {
    return this.request('/payments/invoices/batch', {
      method: 'POST',
      body: JSON.stringify(batchData),
    });
  }

  async getPaymentInvoices(params?: {
    student_id?: string;
    status?: string;
    academic_year?: string;
    start_date?: string;
    end_date?: string;
    branch_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/invoices?${queryString}` : '/payments/invoices';
    return this.request(url);
  }

  async sendInvoice(invoiceId: string, sendData: any): Promise<ApiResponse<any>> {
    return this.request(`/payments/invoices/${invoiceId}/send`, {
      method: 'POST',
      body: JSON.stringify(sendData),
    });
  }

  async sendPaymentReminders(reminderData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/invoices/reminders', {
      method: 'POST',
      body: JSON.stringify(reminderData),
    });
  }

  // Analytics & Reporting
  async getPaymentAnalyticsSummaryComprehensive(params?: {
    academic_year?: string;
    start_date?: string;
    end_date?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/analytics/summary?${queryString}` : '/payments/analytics/summary';
    return this.request(url);
  }

  async getPaymentAnalyticsDetailed(params?: {
    academic_year?: string;
    start_date?: string;
    end_date?: string;
    branch_id?: string;
    include_forecasting?: boolean;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.include_forecasting) searchParams.append('include_forecasting', params.include_forecasting.toString());
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/analytics/detailed?${queryString}` : '/payments/analytics/detailed';
    return this.request(url);
  }

  async getRevenueTrends(params?: {
    period?: string;
    granularity?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.append('period', params.period);
    if (params?.granularity) searchParams.append('granularity', params.granularity);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/analytics/trends?${queryString}` : '/payments/analytics/trends';
    return this.request(url);
  }

  // Student Payment Operations
  async getStudentPaymentHistory(
    studentId: string,
    params?: {
      academic_year?: string;
      start_date?: string;
      end_date?: string;
      skip?: number;
      limit?: number;
    }
  ): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const queryString = searchParams.toString();
    const url = queryString ? 
      `/payments/students/${studentId}/payment-history?${queryString}` : 
      `/payments/students/${studentId}/payment-history`;
    return this.request(url);
  }

  async getStudentBalance(
    studentId: string,
    academicYear?: string
  ): Promise<ApiResponse<any>> {
    const params = academicYear ? `?academic_year=${academicYear}` : '';
    return this.request(`/payments/students/${studentId}/balance${params}`);
  }

  async getStudentPaymentSummary(
    studentId: string,
    academicYear?: string
  ): Promise<ApiResponse<any>> {
    const params = academicYear ? `?academic_year=${academicYear}` : '';
    return this.request(`/payments/students/${studentId}/summary${params}`);
  }

  // Payment Dashboard
  async getPaymentDashboardData(params?: {
    branch_id?: string;
    academic_year?: string;
    date_range?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.date_range) searchParams.append('date_range', params.date_range);
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/dashboard?${queryString}` : '/payments/dashboard';
    return this.request(url);
  }

  // Payment Plans
  async createPaymentPlan(planData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/payment-plans', {
      method: 'POST',
      body: JSON.stringify(planData),
    });
  }

  async getPaymentPlans(params?: {
    student_id?: string;
    status?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/payment-plans?${queryString}` : '/payments/payment-plans';
    return this.request(url);
  }

  async updatePaymentPlan(planId: string, planData: any): Promise<ApiResponse<any>> {
    return this.request(`/payments/payment-plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(planData),
    });
  }

  // Export & Reports
  async exportPaymentData(exportParams: {
    type: 'transactions' | 'invoices' | 'analytics' | 'reconciliation';
    format: 'csv' | 'excel' | 'pdf';
    filters?: Record<string, any>;
  }): Promise<ApiResponse<any>> {
    return this.request('/payments/export', {
      method: 'POST',
      body: JSON.stringify(exportParams),
    });
  }

  async getPaymentExports(): Promise<ApiResponse<any[]>> {
    return this.request('/payments/exports');
  }

  async downloadPaymentExport(exportId: string): Promise<ApiResponse<Blob>> {
    const response = await fetch(`${API_BASE_URL}/payments/exports/${exportId}/download`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Download failed' }));
      return { error: errorData.detail };
    }
    
    const blob = await response.blob();
    return { data: blob };
  }

  // Payment Settings
  async getPaymentSettings(branchId?: string): Promise<ApiResponse<any>> {
    const params = branchId ? `?branch_id=${branchId}` : '';
    return this.request(`/payments/settings${params}`);
  }

  async updatePaymentSettings(settingsData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/settings', {
      method: 'PUT',
      body: JSON.stringify(settingsData),
    });
  }

  // Bulk Operations
  async bulkAssignFeesToStudents(assignmentData: {
    fee_template_ids: string[];
    student_ids: string[];
    academic_year: string;
    due_date?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/payments/bulk/assign-fees', {
      method: 'POST',
      body: JSON.stringify(assignmentData),
    });
  }

  async bulkGenerateInvoices(generationData: {
    student_ids?: string[];
    class_ids?: string[];
    fee_template_ids?: string[];
    academic_year: string;
    due_date: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/payments/bulk/generate-invoices', {
      method: 'POST',
      body: JSON.stringify(generationData),
    });
  }

  async bulkSendReminders(reminderData: {
    student_ids?: string[];
    reminder_type: 'email' | 'sms' | 'both';
    template_id?: string;
    custom_message?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/payments/bulk/send-reminders', {
      method: 'POST',
      body: JSON.stringify(reminderData),
    });
  }

  // Payment Gateway Integration
  async initializePaymentGateway(gatewayData: {
    student_id: string;
    amount: number;
    currency: string;
    payment_method: string;
    return_url?: string;
    webhook_url?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/payments/gateway/initialize', {
      method: 'POST',
      body: JSON.stringify(gatewayData),
    });
  }

  async verifyPaymentGatewayTransaction(
    transactionReference: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/payments/gateway/verify/${transactionReference}`);
  }

  // Refunds & Adjustments
  async createRefund(refundData: {
    transaction_id: string;
    amount?: number; // If not provided, full refund
    reason: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/payments/refunds', {
      method: 'POST',
      body: JSON.stringify(refundData),
    });
  }

  async getRefunds(params?: {
    student_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params?.student_id) searchParams.append('student_id', params.student_id);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/refunds?${queryString}` : '/payments/refunds';
    return this.request(url);
  }

  async createPaymentAdjustment(adjustmentData: {
    student_id: string;
    amount: number;
    type: 'credit' | 'debit';
    reason: string;
    description: string;
    reference?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/payments/adjustments', {
      method: 'POST',
      body: JSON.stringify(adjustmentData),
    });
  }

  // Notifications & Reminders
  async getPaymentNotificationTemplates(): Promise<ApiResponse<any[]>> {
    return this.request('/payments/notification-templates');
  }

  async createPaymentNotificationTemplate(templateData: any): Promise<ApiResponse<any>> {
    return this.request('/payments/notification-templates', {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  async schedulePaymentReminder(reminderData: {
    student_id: string;
    invoice_id: string;
    reminder_type: 'email' | 'sms' | 'phone';
    scheduled_date: string;
    template_id?: string;
    custom_message?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/payments/schedule-reminder', {
      method: 'POST',
      body: JSON.stringify(reminderData),
    });
  }

  // Health & Monitoring
  async getPaymentSystemHealth(): Promise<ApiResponse<any>> {
    return this.request('/payments/health');
  }

  async getPaymentMetrics(params?: {
    period?: string;
    branch_id?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.append('period', params.period);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/metrics?${queryString}` : '/payments/metrics';
    return this.request(url);
  }

  // Additional helper methods for common operations
  async searchStudentsForPayments(query: string, branchId?: string): Promise<ApiResponse<any[]>> {
    // Use existing /students/ listing with search support
    const params = new URLSearchParams();
    params.append('search', query);
    params.append('limit', '20');
    params.append('page', '1');
    params.append('sort_by', 'name');
    params.append('sort_order', 'asc');
    if (branchId) params.append('branch_id', branchId);

    const endpoint = `/students/?${params.toString()}`;

    const result = await this.request(endpoint);

    // Normalize to array of students
    if (result.data && typeof result.data === 'object' && 'items' in result.data) {
      return { data: (result.data as any).items || [] };
    }
    if (Array.isArray(result.data)) {
      return { data: result.data as any[] };
    }
    return { data: [] };
  }

  async getPaymentMethodStats(branchId?: string): Promise<ApiResponse<any>> {
    const params = branchId ? `?branch_id=${branchId}` : '';
    return this.request(`/payments/stats/payment-methods${params}`);
  }

  async getFeeCollectionStats(params?: {
    academic_year?: string;
    branch_id?: string;
    period?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.academic_year) searchParams.append('academic_year', params.academic_year);
    if (params?.branch_id) searchParams.append('branch_id', params.branch_id);
    if (params?.period) searchParams.append('period', params.period);
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/stats/fee-collection?${queryString}` : '/payments/stats/fee-collection';
    return this.request(url);
  }

  // ======================== ENHANCED TRANSACTION MANAGEMENT ========================

  // Update transaction status
  async updateTransactionStatus(
    transactionId: string,
    data: {
      status: 'completed' | 'pending' | 'processing' | 'failed' | 'refunded';
      reason?: string;
      notes?: string;
    }
  ): Promise<ApiResponse<any>> {
    return this.request(`/payments/transactions/${transactionId}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Approve transaction
  async approveTransaction(
    transactionId: string,
    data?: {
      notes?: string;
      approved_by?: string;
    }
  ): Promise<ApiResponse<any>> {
    return this.request(`/payments/transactions/${transactionId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  // Reject transaction
  async rejectTransaction(
    transactionId: string,
    data: {
      reason: string;
      notes?: string;
      rejected_by?: string;
    }
  ): Promise<ApiResponse<any>> {
    return this.request(`/payments/transactions/${transactionId}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Refund transaction
  async refundTransaction(
    transactionId: string,
    data: {
      amount?: number; // Partial refund if specified
      reason: string;
      notes?: string;
      refund_method?: string;
    }
  ): Promise<ApiResponse<any>> {
    return this.request(`/payments/transactions/${transactionId}/refund`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Get transaction analytics with status counts
  async getTransactionAnalytics(params?: {
    branch_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<ApiResponse<{
    status_summary: Record<string, number>;
    recent_activity: Array<{
      transaction_id: string;
      student_name: string;
      amount: number;
      status: string;
    }>;
    total_count: number;
    total_amount: number;
  }>> {
    const searchParams = new URLSearchParams();
    if (params?.branch_id) {
      searchParams.append('branch_id', params.branch_id);
    }
    if (params?.date_from) searchParams.append('date_from', params.date_from);
    if (params?.date_to) searchParams.append('date_to', params.date_to);

    const queryString = searchParams.toString();
    const url = queryString ? `/payments/analytics/status-summary?${queryString}` : '/payments/analytics/status-summary';
    return this.request(url);
  }

  // Search transactions with comprehensive filters
  async searchTransactions(params: {
    query?: string;
    status?: string;
    payment_method?: string;
    date_from?: string;
    date_to?: string;
    amount_min?: number;
    amount_max?: number;
    branch_id?: string;
    student_id?: string;
    transaction_reference?: string;
    skip?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse<{
    data: any[];
    total: number;
    page: number;
    pages: number;
  }>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (key === 'branch_id' && value === 'all') {
          // Pass 'all' as-is to backend for cross-branch queries
          searchParams.append(key, 'all');
          return;
        }
        searchParams.append(key, value.toString());
      }
    });

    const queryString = searchParams.toString();
    const url = queryString ? `/payments/transactions/search?${queryString}` : '/payments/transactions/search';
    return this.request(url);
  }

  // Bulk transaction operations
  async bulkUpdateTransactionStatus(data: {
    transaction_ids: string[];
    status: 'completed' | 'pending' | 'processing' | 'failed' | 'refunded';
    reason?: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/payments/transactions/bulk-status-update', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Get transaction history and audit trail
  async getTransactionHistory(transactionId: string): Promise<ApiResponse<any[]>> {
    return this.request(`/payments/transactions/${transactionId}/history`);
  }

  // Generate transaction reports
  async generateTransactionReport(params: {
    format: 'pdf' | 'excel' | 'csv';
    date_from?: string;
    date_to?: string;
    status?: string;
    branch_id?: string;
    include_analytics?: boolean;
  }): Promise<ApiResponse<Blob>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (key === 'branch_id' && value === 'all') {
          return;
        }
        searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(`${API_BASE_URL}/payments/transactions/report?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to generate report: ${response.statusText}`);
    }

    return { data: await response.blob() };
  }

  // Fee Categories API (for Payment Management System)
  async getFeeCategories(params?: {
    branch_id?: string;
    academic_year?: string;
    is_active?: boolean;
    grade_level?: string;
  }): Promise<ApiResponse<FeeCategory[]>> {
    // If caller provided explicit is_active, fetch once; otherwise fetch both active and inactive
    const buildUrl = (p?: typeof params) => {
      const sp = new URLSearchParams();
      if (p) {
        Object.entries(p).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') sp.append(key, value.toString());
        });
      }
      const qs = sp.toString();
      return qs ? `/fee-categories?${qs}` : '/fee-categories';
    };

    // Explicit filter path
    if (params && Object.prototype.hasOwnProperty.call(params, 'is_active')) {
      const res = await this.request<any[]>(buildUrl(params));
      if (res.data) {
        try { return { data: (res.data as any[]).map(mapFromBackendFeeCategory) }; } catch (e) { return { error: e instanceof Error ? e.message : 'Mapping error' }; }
      }
      return res as ApiResponse<FeeCategory[]>;
    }

    // Fetch both active and inactive to ensure visibility regardless of backend defaults
    const base = { ...(params || {}) } as any;
    const [activeRes, inactiveRes] = await Promise.all([
      this.request<any[]>(buildUrl({ ...base, is_active: true })),
      this.request<any[]>(buildUrl({ ...base, is_active: false })),
    ]);

    if (activeRes.error && inactiveRes.error) {
      return { error: activeRes.error || inactiveRes.error } as ApiResponse<FeeCategory[]>;
    }

    const items: any[] = [];
    if (activeRes.data) items.push(...activeRes.data);
    if (inactiveRes.data) items.push(...inactiveRes.data);
    try {
      return { data: items.map(mapFromBackendFeeCategory) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Mapping error' };
    }
  }

  async createFeeCategory(categoryData: Omit<FeeCategory, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<FeeCategory>> {
    const backendPayload = mapToBackendFeeCategory(categoryData);
    const res = await this.request<any>('/fee-categories', {
      method: 'POST',
      body: JSON.stringify(backendPayload),
    });
    if (res.data) {
      try {
        return { data: mapFromBackendFeeCategory(res.data) };
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Mapping error' };
      }
    }
    return res as ApiResponse<FeeCategory>;
  }

  async updateFeeCategory(categoryId: string, categoryData: Partial<FeeCategory>): Promise<ApiResponse<FeeCategory>> {
    const backendPayload = mapToBackendFeeCategory(categoryData);
    const res = await this.request<any>(`/fee-categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(backendPayload),
    });
    if (res.data) {
      try {
        return { data: mapFromBackendFeeCategory(res.data) };
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Mapping error' };
      }
    }
    return res as ApiResponse<FeeCategory>;
  }

  async deleteFeeCategory(categoryId: string): Promise<ApiResponse<void>> {
    return this.request(`/fee-categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  // Enhanced Payment Methods for Payment Management System
  async getPayments(params?: {
    student_id?: string;
    fee_category_id?: string;
    status?: string;
    payment_method?: string;
    date_from?: string;
    date_to?: string;
    branch_id?: string;
    academic_year?: string;
    skip?: number;
    limit?: number;
  }): Promise<ApiResponse<{ data: Payment[]; total: number; page: number; pages: number }>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    // Use trailing slash to avoid FastAPI's redirect (which can drop CORS headers)
    const url = queryString ? `/payments/?${queryString}` : '/payments/';
    return this.request(url);
  }

  async createPayment(paymentData: {
    student_id: string;
    branch_id: string;
    payment_method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'online';
    payment_date?: string; // yyyy-mm-dd
    reference_number?: string;
    notes?: string;
    discount_amount?: number; // overall discount to distribute to first item
    items: Array<{
      fee_category_id: string;
      quantity: number;
      unit_amount: number;
      discount_amount?: number;
      notes?: string;
    }>;
  }): Promise<ApiResponse<Payment>> {
    // Build fee_items payload expected by backend
    const feeItems = (paymentData.items || []).map((it) => ({
      fee_category_id: it.fee_category_id,
      amount: it.unit_amount,
      quantity: it.quantity,
      discount_amount: it.discount_amount || 0,
      discount_percentage: undefined,
      remarks: it.notes || undefined,
    }));

    // Apply overall discount to the first item if provided
    if (paymentData.discount_amount && paymentData.discount_amount > 0 && feeItems.length > 0) {
      const first = feeItems[0];
      first.discount_amount = (Number(first.discount_amount) || 0) + Number(paymentData.discount_amount);
    }

    const params = new URLSearchParams();
    params.append('student_id', paymentData.student_id);
    params.append('branch_id', paymentData.branch_id);
    // Map payment method to backend expected values (cheque vs check)
    const methodMap: Record<string, string> = { cheque: 'check' };
    params.append('payment_method', (methodMap[paymentData.payment_method] || paymentData.payment_method));
    // Let backend default payment_date when omitted to avoid parsing issues
    if (paymentData.reference_number) params.append('payment_reference', paymentData.reference_number);
    if (paymentData.notes) params.append('remarks', paymentData.notes);

    const endpoint = `/payments/?${params.toString()}`;

    const res = await this.request<any>(endpoint, {
      method: 'POST',
      body: JSON.stringify(feeItems),
    });

    // Backend returns { payment, details, summary }. Return just payment to match consumer expectations.
    if (res.data && typeof res.data === 'object' && 'payment' in res.data) {
      return { data: (res.data as any).payment } as ApiResponse<Payment>;
    }
    return res as ApiResponse<Payment>;
  }

  async cancelPayment(paymentId: string, reason: string): Promise<ApiResponse<Payment>> {
    return this.request(`/payments/${paymentId}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  async refundPayment(paymentId: string, data: {
    amount: number;
    reason: string;
    refund_method?: string;
  }): Promise<ApiResponse<Payment>> {
    return this.request(`/payments/${paymentId}/refund`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Payment Reports
  async getPaymentReports(reportType: string, params?: {
    date_from?: string;
    date_to?: string;
    branch_id?: string;
    fee_category_id?: string;
    grade_level?: string;
    format?: 'json' | 'csv' | 'pdf';
  }): Promise<ApiResponse<PaymentReport | Blob>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    const url = queryString ? `/payment-reports/${reportType}?${queryString}` : `/payment-reports/${reportType}`;

    if (params?.format && ['csv', 'pdf'].includes(params.format)) {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'GET',
        headers: {
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.statusText}`);
      }
      return { data: await response.blob() };
    }

    return this.request(url);
  }

  // Bulk Import
  async uploadBulkPaymentFile(file: File, options?: {
    validate_only?: boolean;
    branch_id?: string;
    academic_year?: string;
  }): Promise<ApiResponse<BulkPaymentImport>> {
    const formData = new FormData();
    formData.append('file', file);

    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });
    }

    return this.request('/payment-bulk-import', {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
        ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      },
    });
  }

  async getBulkImportStatus(importId: string): Promise<ApiResponse<BulkPaymentImport>> {
    return this.request(`/payment-bulk-import/${importId}`);
  }

  // Payment Receipts
  async generatePaymentReceipt(paymentId: string, format: 'pdf' | 'html' = 'pdf'): Promise<ApiResponse<Blob>> {
    // Backend expects POST to /payment-receipts/generate with JSON body
    const response = await fetch(`${API_BASE_URL}/payment-receipts/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({ payment_id: paymentId, format }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to generate receipt: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`);
    }

    return { data: await response.blob() };
  }

  // Payment Dashboard Stats
  async getPaymentStatsForDashboard(params?: {
    branch_id?: string;
    academic_year?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<ApiResponse<PaymentStats>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    const url = queryString ? `/payments/dashboard-stats?${queryString}` : '/payments/dashboard-stats';
    return this.request(url);
  }
}

export const apiClient = new ApiClient();
