import { vi } from 'vitest'
import type { User } from '@/types/api'

// Mock user data for different roles
export const mockUsers: Record<string, User> = {
  superAdmin: {
    id: '1',
    email: 'superadmin@test.com',
    role: 'super_admin',
    is_active: true,
    branch_id: null,
    branch_name: null,
    first_name: 'Super',
    last_name: 'Admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  branchAdmin: {
    id: '2',
    email: 'branchadmin@test.com',
    role: 'branch_admin',
    is_active: true,
    branch_id: 'branch-1',
    branch_name: 'Main Branch',
    first_name: 'Branch',
    last_name: 'Admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  teacher: {
    id: '3',
    email: 'teacher@test.com',
    role: 'teacher',
    is_active: true,
    branch_id: 'branch-1',
    branch_name: 'Main Branch',
    first_name: 'John',
    last_name: 'Teacher',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  student: {
    id: '4',
    email: 'student@test.com',
    role: 'student',
    is_active: true,
    branch_id: 'branch-1',
    branch_name: 'Main Branch',
    first_name: 'Jane',
    last_name: 'Student',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  parent: {
    id: '5',
    email: 'parent@test.com',
    role: 'parent',
    is_active: true,
    branch_id: 'branch-1',
    branch_name: 'Main Branch',
    first_name: 'Parent',
    last_name: 'Guardian',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
}

// Mock permissions for different roles
export const mockPermissions = {
  super_admin: {
    permissions: [
      'create_user', 'read_user', 'update_user', 'delete_user',
      'read_payment', 'create_payment', 'update_payment', 'delete_payment',
      'view_financial_reports', 'manage_branches', 'system_settings'
    ]
  },
  branch_admin: {
    permissions: [
      'read_user', 'create_user', 'update_user',
      'read_payment', 'create_payment', 'update_payment',
      'view_financial_reports'
    ]
  },
  teacher: {
    permissions: [
      'read_student', 'read_payment'
    ]
  },
  student: {
    permissions: [
      'read_student'
    ]
  },
  parent: {
    permissions: [
      'read_student', 'read_payment'
    ]
  }
}

// Mock AuthContext
export const createMockAuthContext = (user: User | null = null) => ({
  user,
  login: vi.fn().mockResolvedValue({ success: true }),
  logout: vi.fn(),
  refreshToken: vi.fn().mockResolvedValue({ success: true }),
  isAuthenticated: !!user,
  loading: false,
  error: null,
})

// Mock BranchContext
export const createMockBranchContext = (branchId: string | null = 'branch-1') => ({
  selectedBranch: branchId,
  branches: [
    { id: 'branch-1', name: 'Main Branch', location: 'Downtown' },
    { id: 'branch-2', name: 'Secondary Branch', location: 'Uptown' },
  ],
  selectBranch: vi.fn(),
  loading: false,
  error: null,
})

// Mock API Client responses
export const createMockApiClient = (user: User | null = null) => ({
  // Authentication endpoints
  login: vi.fn().mockResolvedValue({
    data: { access_token: 'mock-token', user: user || mockUsers.superAdmin },
    error: null
  }),
  
  refreshToken: vi.fn().mockResolvedValue({
    data: { access_token: 'new-mock-token' },
    error: null
  }),
  
  getCurrentUser: vi.fn().mockResolvedValue({
    data: user || mockUsers.superAdmin,
    error: null
  }),
  
  getUserPermissions: vi.fn().mockResolvedValue({
    data: user ? mockPermissions[user.role as keyof typeof mockPermissions] : mockPermissions.super_admin,
    error: null
  }),
  
  checkUserPermission: vi.fn().mockResolvedValue({
    data: { has_permission: true },
    error: null
  }),
  
  // Payment endpoints
  getPaymentAnalyticsSummary: vi.fn().mockResolvedValue({
    data: {
      total_revenue: 50000,
      payment_count: 150,
      fee_revenue: 30000,
      registration_revenue: 20000,
      status_breakdown: {
        paid: 100,
        pending: 30,
        partial: 15,
        overdue: 5
      }
    },
    error: null
  }),
  
  getPaymentDashboard: vi.fn().mockResolvedValue({
    data: {
      fees: [
        {
          id: '1',
          fee_type: 'tuition',
          amount: 1000,
          amount_paid: 800,
          status: 'partial',
          student: {
            first_name: 'John',
            last_name: 'Doe',
            student_id: 'STU001'
          }
        }
      ],
      registration_payments: [
        {
          id: '1',
          amount_paid: 500,
          payment_status: 'paid',
          payment_date: '2024-01-15',
          student: {
            first_name: 'Jane',
            last_name: 'Smith',
            student_id: 'STU002'
          }
        }
      ],
      pagination: {
        total_fees: 1,
        total_registration_payments: 1,
        total_records: 2,
        skip: 0,
        limit: 20,
        has_more: false
      }
    },
    error: null
  }),
})

// Mock error responses for testing authentication failures
export const createMockApiClientWithErrors = () => ({
  login: vi.fn().mockResolvedValue({
    data: null,
    error: 'Invalid credentials'
  }),
  
  refreshToken: vi.fn().mockResolvedValue({
    data: null,
    error: 'Token refresh failed'
  }),
  
  getCurrentUser: vi.fn().mockResolvedValue({
    data: null,
    error: 'User not found'
  }),
  
  getUserPermissions: vi.fn().mockResolvedValue({
    data: null,
    error: 'Unauthorized'
  }),
  
  getPaymentAnalyticsSummary: vi.fn().mockResolvedValue({
    data: null,
    error: '401 Unauthorized'
  }),
  
  getPaymentDashboard: vi.fn().mockResolvedValue({
    data: null,
    error: '401 Unauthorized'
  }),
})