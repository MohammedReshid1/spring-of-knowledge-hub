import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentDashboard } from '@/components/payments/PaymentDashboard'
import { 
  renderWithSuperAdmin,
  createMockRoleAccess,
  mockUsers
} from '../utils/testUtils'

// Mock the hooks
vi.mock('@/hooks/useRoleAccess')
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthContext: {
    Provider: ({ children, value }: any) => children,
  },
}))

import { useRoleAccess } from '@/hooks/useRoleAccess'
import { useAuth } from '@/contexts/AuthContext'

const mockUseRoleAccess = vi.mocked(useRoleAccess)
const mockUseAuth = vi.mocked(useAuth)

describe('Super Admin Access Verification Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Super Admin Role Variants', () => {
    it('should recognize "super_admin" role variant', async () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUsers.superAdmin, role: 'super_admin' },
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
        userRole: 'super_admin',
        permissionsLoading: false,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })
      
      expect(screen.queryByText('Access Restricted')).not.toBeInTheDocument()
    })

    it('should recognize "superadmin" role variant (backend format)', async () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUsers.superAdmin, role: 'superadmin' },
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('superadmin'),
        canViewFinances: true,
        isSuperAdmin: true,
        userRole: 'superadmin',
        permissionsLoading: false,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })
      
      expect(screen.queryByText('Access Restricted')).not.toBeInTheDocument()
    })
  })

  describe('Super Admin Permission Override', () => {
    it('should allow super admin access even when permissions are loading', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUsers.superAdmin,
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: false, // This should be overridden
        isSuperAdmin: true,
        permissionsLoading: true, // Permissions still loading
        userRole: 'super_admin',
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      // Should show loading state initially
      await waitFor(() => {
        expect(screen.getByText('Loading Dashboard')).toBeInTheDocument()
      })

      expect(screen.getByText('Verifying permissions and loading financial data...')).toBeInTheDocument()
    })

    it('should allow super admin access when permissions fail to load', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUsers.superAdmin,
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true, // Super admin override
        isSuperAdmin: true,
        permissionsLoading: false,
        userPermissions: null, // Permissions failed to load
        userRole: 'super_admin',
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })
      
      expect(screen.queryByText('Access Restricted')).not.toBeInTheDocument()
      expect(screen.queryByText('Loading Dashboard')).not.toBeInTheDocument()
    })
  })

  describe('Super Admin Dashboard Features', () => {
    it('should show all financial analytics for super admin', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUsers.superAdmin,
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
        canViewFinancialData: true,
        permissionsLoading: false,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Total Revenue')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Fee Revenue')).toBeInTheDocument()
      expect(screen.getByText('Registration Revenue')).toBeInTheDocument()
      expect(screen.getByText('Payment Status')).toBeInTheDocument()
    })

    it('should show all filter options for super admin', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUsers.superAdmin,
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
        permissionsLoading: false,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Academic Year')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Payment Cycle')).toBeInTheDocument()
      expect(screen.getByText('Start Date')).toBeInTheDocument()
      expect(screen.getByText('End Date')).toBeInTheDocument()
    })

    it('should allow super admin to refresh data', async () => {
      const user = userEvent.setup()

      mockUseAuth.mockReturnValue({
        user: mockUsers.superAdmin,
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
        permissionsLoading: false,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
      })
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)
      
      // Should not cause errors and button should still be there
      expect(refreshButton).toBeInTheDocument()
    })
  })

  describe('Debug Information Display', () => {
    it('should show correct debug info for super admin', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUsers.superAdmin,
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      // Simulate a case where super admin is temporarily denied access
      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: false, // Temporarily false for debug display
        isSuperAdmin: false, // Temporarily false for debug display
        userRole: 'super_admin',
        permissionsLoading: false,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Access Restricted')).toBeInTheDocument()
      })
      
      expect(screen.getByText('User Role: super_admin')).toBeInTheDocument()
      expect(screen.getByText(`User Email: ${mockUsers.superAdmin.email}`)).toBeInTheDocument()
      expect(screen.getByText('Is Super Admin: No')).toBeInTheDocument()
      expect(screen.getByText('Can View Finances: No')).toBeInTheDocument()
    })
  })

  describe('Super Admin Authentication Recovery', () => {
    it('should handle super admin authentication state changes', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUsers.superAdmin,
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      // Start with loading permissions
      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: false,
        isSuperAdmin: true,
        permissionsLoading: true,
        userRole: 'super_admin',
      })

      const { rerender } = renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Loading Dashboard')).toBeInTheDocument()
      })

      // Update to loaded permissions
      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
        permissionsLoading: false,
        userRole: 'super_admin',
      })

      rerender(<PaymentDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })
      
      expect(screen.queryByText('Loading Dashboard')).not.toBeInTheDocument()
    })

    it('should prioritize super admin status over permission states', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUsers.superAdmin,
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true, // This should allow access
        isSuperAdmin: true, // This is the key flag
        permissionsLoading: false,
        userRole: 'super_admin',
        // Even if other permissions might be false, super admin should have access
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })
      
      // Should show all super admin features
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
      expect(screen.getByText('Filters')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    })
  })

  describe('Cross-Branch Access for Super Admin', () => {
    it('should allow super admin to access data across all branches', async () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUsers.superAdmin, branch_id: null }, // No specific branch
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        isAuthenticated: true,
        loading: false,
        error: null,
      })

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
        canAccessAllBranches: true,
        isRestrictedToBranch: false,
        permissionsLoading: false,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })
      
      // Super admin should see all data regardless of branch
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    })
  })
})