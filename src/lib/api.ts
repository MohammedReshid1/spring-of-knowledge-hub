// API Client for FastAPI Backend
import type { ApiResponse, User, Branch, Student, SchoolClass, Attendance, Fee, GradeLevel, Subject, StudentEnrollment, PaymentMode, RegistrationPayment, BackupLog, GradeTransition } from '@/types/api';
import { config } from './config';

const API_BASE_URL = config.API_BASE_URL;

class ApiClient {
  private token: string | null = null;

  constructor() {
    // Get token from localStorage if it exists
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  removeToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
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

  // Authentication methods
  async signIn(email: string, password: string): Promise<ApiResponse<{ access_token: string; token_type: string }>> {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    formData.append('grant_type', 'password');

    const response = await this.request<string>('/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (response.data) {
      return { data: { access_token: response.data, token_type: 'bearer' } };
    }
    return response;
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
  async getStudents(): Promise<ApiResponse<any[]>> {
    return this.request('/students/');
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

  // Attendance methods
  async getAttendance(): Promise<ApiResponse<any[]>> {
    return this.request('/attendance/');
  }

  async createAttendance(attendanceData: any): Promise<ApiResponse<any>> {
    return this.request('/attendance/', {
      method: 'POST',
      body: JSON.stringify(attendanceData),
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

  // Fee methods
  async getFees(): Promise<ApiResponse<any[]>> {
    return this.request('/fees/');
  }

  async createFee(feeData: any): Promise<ApiResponse<any>> {
    return this.request('/fees/', {
      method: 'POST',
      body: JSON.stringify(feeData),
    });
  }

  async updateFee(feeId: string, feeData: any): Promise<ApiResponse<any>> {
    return this.request(`/fees/${feeId}`, {
      method: 'PUT',
      body: JSON.stringify(feeData),
    });
  }

  async deleteFee(feeId: string): Promise<ApiResponse<void>> {
    return this.request(`/fees/${feeId}`, {
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

  // Registration Payment methods
  async getRegistrationPayments(): Promise<ApiResponse<any[]>> {
    return this.request('/registration-payments/');
  }

  async createRegistrationPayment(paymentData: any): Promise<ApiResponse<any>> {
    return this.request('/registration-payments/', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  async updateRegistrationPayment(paymentId: string, paymentData: any): Promise<ApiResponse<any>> {
    return this.request(`/registration-payments/${paymentId}`, {
      method: 'PUT',
      body: JSON.stringify(paymentData),
    });
  }

  async deleteRegistrationPayment(paymentId: string): Promise<ApiResponse<void>> {
    return this.request(`/registration-payments/${paymentId}`, {
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
}

export const apiClient = new ApiClient();