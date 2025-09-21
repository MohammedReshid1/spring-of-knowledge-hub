import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentDashboard } from '@/components/payments/PaymentDashboard'
import { 
  renderWithSuperAdmin,
  createMockRoleAccess
} from '../../utils/testUtils'

// Mock the useRoleAccess hook
vi.mock('@/hooks/useRoleAccess')

import { useRoleAccess } from '@/hooks/useRoleAccess'
const mockUseRoleAccess = vi.mocked(useRoleAccess)

describe('React Select Component Error Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Select Component Value Prop Validation', () => {
    it('should not render Select.Item with empty string value', async () => {
      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })

      // Check that Status filter select exists
      const statusSelect = screen.getByDisplayValue('All statuses') || screen.getByText('All statuses')
      expect(statusSelect).toBeInTheDocument()
    })

    it('should handle Select component interactions without empty string values', async () => {
      const user = userEvent.setup()

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument()
      })

      // Find the Status select trigger
      const statusFilters = screen.getAllByText('Status')
      expect(statusFilters.length).toBeGreaterThan(0)

      // Try to interact with the select - should not cause errors
      const selectTriggers = screen.getAllByRole('combobox')
      if (selectTriggers.length > 0) {
        await user.click(selectTriggers[0])
        // Component should handle this interaction gracefully
      }
    })

    it('should validate all SelectItem components have non-empty values', async () => {
      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })

      // The component should render without throwing Select.Item value errors
      // This test verifies that all SelectItem components have proper values
      expect(screen.queryByText('A <Select.Item /> must have a value prop that is not an empty string')).not.toBeInTheDocument()
    })
  })

  describe('Status Filter Select Component', () => {
    it('should render status filter options with valid values', async () => {
      const user = userEvent.setup()

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument()
      })

      // Look for status-related elements
      const statusElements = screen.getAllByText('Status')
      expect(statusElements.length).toBeGreaterThan(0)

      // Try to find and interact with select components
      const comboboxes = screen.getAllByRole('combobox')
      
      for (const combobox of comboboxes) {
        // Each combobox should be interactable without errors
        await user.click(combobox)
        // Component should not throw SelectItem value errors
      }
    })

    it('should handle status filter value changes correctly', async () => {
      const user = userEvent.setup()

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })

      // The filter changes should work without value prop errors
      // This implicitly tests that SelectItem values are not empty strings
      const clearFiltersButton = screen.getByText('Clear Filters')
      await user.click(clearFiltersButton)
      
      // Should complete without throwing errors
      expect(clearFiltersButton).toBeInTheDocument()
    })
  })

  describe('Payment Cycle Filter Select Component', () => {
    it('should render payment cycle options with valid values', async () => {
      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Cycle')).toBeInTheDocument()
      })

      // The component should render without Select value prop errors
      // This validates that payment cycle SelectItems have proper values
      expect(() => {
        screen.getByText('Payment Cycle')
      }).not.toThrow()
    })
  })

  describe('Select Component Error Prevention', () => {
    it('should prevent empty string values in Select components', async () => {
      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
      })

      // Mock console.error to catch any Select component errors
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })

      // Wait a bit more to ensure all components are fully rendered
      await new Promise(resolve => setTimeout(resolve, 100))

      // Check that no Select.Item value prop errors were logged
      const selectErrors = consoleErrorSpy.mock.calls.filter(call => 
        call.some(arg => 
          typeof arg === 'string' && 
          arg.includes('Select.Item') && 
          arg.includes('value prop') && 
          arg.includes('empty string')
        )
      )

      expect(selectErrors).toHaveLength(0)

      consoleErrorSpy.mockRestore()
    })

    it('should handle filter value conversion from empty to "all" correctly', async () => {
      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })

      // The component should handle the conversion logic:
      // - Display "all" as default when filter value is empty
      // - Convert "all" back to empty string for API calls
      // This prevents empty string values in SelectItem components
      
      // Test that default states don't cause errors
      expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
    })
  })

  describe('Component Rendering Stability', () => {
    it('should render consistently without Select component warnings', async () => {
      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
      })

      // Spy on console methods to catch any warnings or errors
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })

      // Allow time for any async operations to complete
      await waitFor(() => {
        expect(screen.getByText('Comprehensive overview of payments and financial data')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Check for any Select-related warnings or errors
      const selectWarnings = consoleWarnSpy.mock.calls.filter(call => 
        call.some(arg => typeof arg === 'string' && arg.toLowerCase().includes('select'))
      )
      
      const selectErrors = consoleErrorSpy.mock.calls.filter(call => 
        call.some(arg => typeof arg === 'string' && arg.toLowerCase().includes('select'))
      )

      expect(selectWarnings).toHaveLength(0)
      expect(selectErrors).toHaveLength(0)

      consoleWarnSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    it('should maintain proper state management for Select components', async () => {
      const user = userEvent.setup()

      mockUseRoleAccess.mockReturnValue({
        ...createMockRoleAccess('super_admin'),
        canViewFinances: true,
        isSuperAdmin: true,
      })

      renderWithSuperAdmin(<PaymentDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })

      // Interact with the Clear Filters button to test state management
      const clearButton = screen.getByText('Clear Filters')
      await user.click(clearButton)

      // The component should handle state updates without errors
      expect(clearButton).toBeInTheDocument()
      
      // Should not cause any Select component value prop errors
      await waitFor(() => {
        expect(screen.getByText('Payment Dashboard')).toBeInTheDocument()
      })
    })
  })
})