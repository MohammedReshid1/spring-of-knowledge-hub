import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { AuthContext } from '@/contexts/AuthContext'
import { BranchContext } from '@/contexts/BranchContext'
import { createMockAuthContext, createMockBranchContext, mockUsers } from '../mocks/authMocks'
import type { User } from '@/types/api'

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    login: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
    getUserPermissions: vi.fn(),
    checkUserPermission: vi.fn(),
    getPaymentAnalyticsSummary: vi.fn(),
    getPaymentDashboard: vi.fn(),
  }
}))

// Note: useRoleAccess is mocked in individual test files as needed

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: vi.fn(() => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
    toasts: [],
  })),
}))

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: User | null
  branchId?: string | null
  initialEntries?: string[]
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function AllTheProviders({ 
  children, 
  user = null, 
  branchId = 'branch-1' 
}: { 
  children: React.ReactNode
  user?: User | null
  branchId?: string | null
}) {
  const queryClient = createTestQueryClient()
  const authContext = createMockAuthContext(user)
  const branchContext = createMockBranchContext(branchId)

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authContext}>
          <BranchContext.Provider value={branchContext}>
            {children}
          </BranchContext.Provider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { user, branchId, ...renderOptions } = options
  
  return render(ui, {
    wrapper: (props) => <AllTheProviders {...props} user={user} branchId={branchId} />,
    ...renderOptions,
  })
}

// Test utilities for different user roles
export const renderWithSuperAdmin = (ui: ReactElement, options?: Omit<CustomRenderOptions, 'user'>) => {
  return customRender(ui, { ...options, user: mockUsers.superAdmin })
}

export const renderWithBranchAdmin = (ui: ReactElement, options?: Omit<CustomRenderOptions, 'user'>) => {
  return customRender(ui, { ...options, user: mockUsers.branchAdmin })
}

export const renderWithTeacher = (ui: ReactElement, options?: Omit<CustomRenderOptions, 'user'>) => {
  return customRender(ui, { ...options, user: mockUsers.teacher })
}

export const renderWithStudent = (ui: ReactElement, options?: Omit<CustomRenderOptions, 'user'>) => {
  return customRender(ui, { ...options, user: mockUsers.student })
}

export const renderWithParent = (ui: ReactElement, options?: Omit<CustomRenderOptions, 'user'>) => {
  return customRender(ui, { ...options, user: mockUsers.parent })
}

export const renderWithoutAuth = (ui: ReactElement, options?: Omit<CustomRenderOptions, 'user'>) => {
  return customRender(ui, { ...options, user: null })
}

// Helper function to create mock role access return values
export const createMockRoleAccess = (userRole: string) => {
  const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin'
  const isBranchAdmin = userRole === 'branch_admin'
  const isTeacher = userRole === 'teacher'
  const isStudent = userRole === 'student'
  const isParent = userRole === 'parent'

  return {
    userRole,
    isSuperAdmin,
    isBranchAdmin,
    isTeacher,
    isStudent,
    isParent,
    isHQRole: isSuperAdmin,
    isBranchRole: isBranchAdmin,
    isAdminRole: isSuperAdmin || isBranchAdmin,
    canViewFinances: isSuperAdmin || isBranchAdmin,
    canViewFinancialData: isSuperAdmin || isBranchAdmin,
    canProcessPayments: isSuperAdmin || isBranchAdmin,
    canManageUsers: isSuperAdmin || isBranchAdmin,
    canAccessAllBranches: isSuperAdmin,
    isRestrictedToBranch: !isSuperAdmin,
    permissionsLoading: false,
    userPermissions: null,
  }
}

// Wait for queries to settle
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }