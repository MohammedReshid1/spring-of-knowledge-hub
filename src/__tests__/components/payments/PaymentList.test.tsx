import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PaymentList from '@/components/payments/PaymentList'

// Mock the API client
const mockApiClient = {
  payments: {
    getAll: vi.fn(),
    cancel: vi.fn(),
    refund: vi.fn(),
    getSummary: vi.fn()
  },
  students: {
    getById: vi.fn()
  }
}

vi.mock('@/lib/api', () => ({
  default: mockApiClient
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn()
  }
}))

// Mock date picker component
vi.mock('@nextui-org/react', async () => {
  const actual = await vi.importActual('@nextui-org/react')
  return {
    ...actual,
    DatePicker: ({ value, onChange, label, ...props }: any) => (
      <input
        {...props}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
    )
  }
})

const mockPayments = [
  {
    id: 'payment-1',
    receiptNo: 'RCP001',
    studentId: 'student-1',
    studentName: 'John Doe',
    studentIdNumber: 'STU001',
    paymentDate: '2024-01-15T10:00:00Z',
    subtotal: 1000.00,
    discountAmount: 100.00,
    taxAmount: 90.00,
    lateFeeAmount: 0.00,
    totalAmount: 990.00,
    paymentMethod: 'cash',
    status: 'completed',
    verificationStatus: 'verified',
    payerName: 'John Doe Sr.',
    payerPhone: '+1234567890',
    payerEmail: 'john.doe.sr@email.com',
    createdAt: '2024-01-15T09:30:00Z',
    createdBy: 'admin-1'
  },
  {
    id: 'payment-2',
    receiptNo: 'RCP002',
    studentId: 'student-2',
    studentName: 'Jane Smith',
    studentIdNumber: 'STU002',
    paymentDate: '2024-01-16T14:30:00Z',
    subtotal: 500.00,
    discountAmount: 0.00,
    taxAmount: 50.00,
    lateFeeAmount: 10.00,
    totalAmount: 560.00,
    paymentMethod: 'card',
    status: 'pending',
    verificationStatus: 'unverified',
    payerName: 'Jane Smith Sr.',
    payerPhone: '+1234567891',
    createdAt: '2024-01-16T14:00:00Z',
    createdBy: 'admin-1'
  },
  {
    id: 'payment-3',
    receiptNo: 'RCP003',
    studentId: 'student-3',
    studentName: 'Bob Johnson',
    studentIdNumber: 'STU003',
    paymentDate: '2024-01-17T11:00:00Z',
    subtotal: 750.00,
    discountAmount: 75.00,
    taxAmount: 67.50,
    lateFeeAmount: 0.00,
    totalAmount: 742.50,
    paymentMethod: 'bank_transfer',
    status: 'completed',
    verificationStatus: 'verified',
    bankName: 'Test Bank',
    paymentReference: 'TXN123456',
    createdAt: '2024-01-17T10:30:00Z',
    createdBy: 'admin-2'
  }
]

const mockSummary = {
  totalPayments: 3,
  totalAmount: 2292.50,
  totalDiscount: 175.00,
  totalTax: 207.50,
  totalLateFees: 10.00,
  paymentMethods: {
    cash: 1,
    card: 1,
    bank_transfer: 1
  },
  statusBreakdown: {
    completed: 2,
    pending: 1
  }
}

const renderPaymentList = (props = {}) => {
  const defaultProps = {
    branchId: 'branch-1',
    onPaymentSelect: vi.fn(),
    onEdit: vi.fn(),
    onView: vi.fn(),
    ...props
  }

  return render(<PaymentList {...defaultProps} />)
}

describe('PaymentList', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockApiClient.payments.getAll.mockResolvedValue({
      success: true,
      data: mockPayments
    })

    mockApiClient.payments.getSummary.mockResolvedValue({
      success: true,
      data: mockSummary
    })
  })

  describe('Component Rendering', () => {
    it('should render payments table with correct columns', async () => {
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText('Receipt No')).toBeInTheDocument()
        expect(screen.getByText('Student')).toBeInTheDocument()
        expect(screen.getByText('Payment Date')).toBeInTheDocument()
        expect(screen.getByText('Amount')).toBeInTheDocument()
        expect(screen.getByText('Method')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Actions')).toBeInTheDocument()
      })
    })

    it('should display payment data correctly', async () => {
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText('RCP001')).toBeInTheDocument()
        expect(screen.getByText('John Doe (STU001)')).toBeInTheDocument()
        expect(screen.getByText('$990.00')).toBeInTheDocument()
        expect(screen.getByText('Cash')).toBeInTheDocument()
      })
    })

    it('should show loading state initially', () => {
      mockApiClient.payments.getAll.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      renderPaymentList()

      expect(screen.getByText(/loading payments/i)).toBeInTheDocument()
    })

    it('should handle empty payment list', async () => {
      mockApiClient.payments.getAll.mockResolvedValue({
        success: true,
        data: []
      })

      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText(/no payments found/i)).toBeInTheDocument()
      })
    })

    it('should display error message on API failure', async () => {
      mockApiClient.payments.getAll.mockRejectedValue(new Error('API Error'))

      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText(/failed to load payments/i)).toBeInTheDocument()
      })
    })
  })

  describe('Payment Filters', () => {
    it('should render filter controls', async () => {
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByLabelText(/search/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/status/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/from date/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/to date/i)).toBeInTheDocument()
      })
    })

    it('should filter payments by search term', async () => {
      const user = userEvent.setup()
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText('RCP001')).toBeInTheDocument()
        expect(screen.getByText('RCP002')).toBeInTheDocument()
      })

      const searchInput = screen.getByLabelText(/search/i)
      await user.type(searchInput, 'John Doe')

      await waitFor(() => {
        expect(mockApiClient.payments.getAll).toHaveBeenCalledWith({
          branchId: 'branch-1',
          search: 'John Doe'
        })
      })
    })

    it('should filter payments by status', async () => {
      const user = userEvent.setup()
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByLabelText(/status/i)).toBeInTheDocument()
      })

      const statusSelect = screen.getByLabelText(/status/i)
      await user.click(statusSelect)
      await user.click(screen.getByText('Completed'))

      await waitFor(() => {
        expect(mockApiClient.payments.getAll).toHaveBeenCalledWith({
          branchId: 'branch-1',
          status: 'completed'
        })
      })
    })

    it('should filter payments by payment method', async () => {
      const user = userEvent.setup()
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument()
      })

      const methodSelect = screen.getByLabelText(/payment method/i)
      await user.click(methodSelect)
      await user.click(screen.getByText('Card'))

      await waitFor(() => {
        expect(mockApiClient.payments.getAll).toHaveBeenCalledWith({
          branchId: 'branch-1',
          paymentMethod: 'card'
        })
      })
    })

    it('should filter payments by date range', async () => {
      const user = userEvent.setup()
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByLabelText(/from date/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/to date/i)).toBeInTheDocument()
      })

      const fromDateInput = screen.getByLabelText(/from date/i)
      const toDateInput = screen.getByLabelText(/to date/i)

      await user.type(fromDateInput, '2024-01-15')
      await user.type(toDateInput, '2024-01-16')

      await waitFor(() => {
        expect(mockApiClient.payments.getAll).toHaveBeenCalledWith({
          branchId: 'branch-1',
          fromDate: '2024-01-15',
          toDate: '2024-01-16'
        })
      })
    })

    it('should clear filters when clear button is clicked', async () => {
      const user = userEvent.setup()
      renderPaymentList()

      // Apply filters first
      const searchInput = screen.getByLabelText(/search/i)
      await user.type(searchInput, 'John')

      const statusSelect = screen.getByLabelText(/status/i)
      await user.click(statusSelect)
      await user.click(screen.getByText('Completed'))

      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i })
      await user.click(clearButton)

      await waitFor(() => {
        expect(searchInput).toHaveValue('')
        expect(mockApiClient.payments.getAll).toHaveBeenCalledWith({
          branchId: 'branch-1'
        })
      })
    })
  })

  describe('Payment Actions', () => {
    it('should call onView when view button is clicked', async () => {
      const user = userEvent.setup()
      const onView = vi.fn()
      renderPaymentList({ onView })

      await waitFor(() => {
        expect(screen.getByText('RCP001')).toBeInTheDocument()
      })

      const viewButtons = screen.getAllByRole('button', { name: /view/i })
      await user.click(viewButtons[0])

      expect(onView).toHaveBeenCalledWith(mockPayments[0])
    })

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()
      renderPaymentList({ onEdit })

      await waitFor(() => {
        expect(screen.getByText('RCP001')).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[0])

      expect(onEdit).toHaveBeenCalledWith(mockPayments[0])
    })

    it('should show cancel option only for pending/completed payments', async () => {
      renderPaymentList()

      await waitFor(() => {
        const actionMenus = screen.getAllByRole('button', { name: /more actions/i })
        expect(actionMenus).toHaveLength(3)
      })

      // Check first payment (completed)
      const firstMenu = screen.getAllByRole('button', { name: /more actions/i })[0]
      await userEvent.click(firstMenu)

      await waitFor(() => {
        expect(screen.getByText(/cancel payment/i)).toBeInTheDocument()
      })
    })

    it('should handle payment cancellation', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.cancel.mockResolvedValue({
        success: true,
        data: { ...mockPayments[0], status: 'cancelled' }
      })

      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText('RCP001')).toBeInTheDocument()
      })

      // Open action menu for first payment
      const actionMenu = screen.getAllByRole('button', { name: /more actions/i })[0]
      await user.click(actionMenu)

      // Click cancel option
      const cancelOption = screen.getByText(/cancel payment/i)
      await user.click(cancelOption)

      // Fill cancellation reason in modal
      const reasonInput = screen.getByLabelText(/cancellation reason/i)
      await user.type(reasonInput, 'Student requested cancellation')

      // Confirm cancellation
      const confirmButton = screen.getByRole('button', { name: /confirm cancellation/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockApiClient.payments.cancel).toHaveBeenCalledWith(
          'payment-1',
          { cancellationReason: 'Student requested cancellation' }
        )
      })
    })

    it('should handle payment refund', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.refund.mockResolvedValue({
        success: true,
        data: { ...mockPayments[0], status: 'partial_refund', refundAmount: 200 }
      })

      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText('RCP001')).toBeInTheDocument()
      })

      // Open action menu for first payment
      const actionMenu = screen.getAllByRole('button', { name: /more actions/i })[0]
      await user.click(actionMenu)

      // Click refund option
      const refundOption = screen.getByText(/refund payment/i)
      await user.click(refundOption)

      // Fill refund details in modal
      const amountInput = screen.getByLabelText(/refund amount/i)
      await user.type(amountInput, '200')

      const referenceInput = screen.getByLabelText(/refund reference/i)
      await user.type(referenceInput, 'REF123456')

      const reasonInput = screen.getByLabelText(/refund reason/i)
      await user.type(reasonInput, 'Partial service not delivered')

      // Process refund
      const refundButton = screen.getByRole('button', { name: /process refund/i })
      await user.click(refundButton)

      await waitFor(() => {
        expect(mockApiClient.payments.refund).toHaveBeenCalledWith('payment-1', {
          refundAmount: 200,
          refundReference: 'REF123456',
          refundReason: 'Partial service not delivered'
        })
      })
    })
  })

  describe('Payment Summary', () => {
    it('should display payment summary statistics', async () => {
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText(/total payments.*3/i)).toBeInTheDocument()
        expect(screen.getByText(/total amount.*\$2,292\.50/i)).toBeInTheDocument()
        expect(screen.getByText(/total discount.*\$175\.00/i)).toBeInTheDocument()
        expect(screen.getByText(/total tax.*\$207\.50/i)).toBeInTheDocument()
      })
    })

    it('should show payment method breakdown', async () => {
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText(/cash.*1/i)).toBeInTheDocument()
        expect(screen.getByText(/card.*1/i)).toBeInTheDocument()
        expect(screen.getByText(/bank transfer.*1/i)).toBeInTheDocument()
      })
    })

    it('should show status breakdown', async () => {
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText(/completed.*2/i)).toBeInTheDocument()
        expect(screen.getByText(/pending.*1/i)).toBeInTheDocument()
      })
    })

    it('should update summary when filters change', async () => {
      const user = userEvent.setup()
      const filteredSummary = {
        ...mockSummary,
        totalPayments: 1,
        totalAmount: 990.00
      }

      mockApiClient.payments.getSummary.mockResolvedValueOnce({
        success: true,
        data: filteredSummary
      })

      renderPaymentList()

      // Apply status filter
      const statusSelect = screen.getByLabelText(/status/i)
      await user.click(statusSelect)
      await user.click(screen.getByText('Completed'))

      await waitFor(() => {
        expect(mockApiClient.payments.getSummary).toHaveBeenCalledWith({
          branchId: 'branch-1',
          status: 'completed'
        })
      })
    })
  })

  describe('Sorting and Pagination', () => {
    it('should allow sorting by different columns', async () => {
      const user = userEvent.setup()
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText('Payment Date')).toBeInTheDocument()
      })

      // Click on payment date column header to sort
      const dateHeader = screen.getByText('Payment Date')
      await user.click(dateHeader)

      await waitFor(() => {
        expect(mockApiClient.payments.getAll).toHaveBeenCalledWith({
          branchId: 'branch-1',
          sortBy: 'paymentDate',
          sortOrder: 'asc'
        })
      })

      // Click again to sort descending
      await user.click(dateHeader)

      await waitFor(() => {
        expect(mockApiClient.payments.getAll).toHaveBeenCalledWith({
          branchId: 'branch-1',
          sortBy: 'paymentDate',
          sortOrder: 'desc'
        })
      })
    })

    it('should handle pagination controls', async () => {
      const user = userEvent.setup()
      const paginatedResponse = {
        success: true,
        data: mockPayments,
        pagination: {
          currentPage: 1,
          totalPages: 3,
          totalItems: 25,
          itemsPerPage: 10
        }
      }

      mockApiClient.payments.getAll.mockResolvedValue(paginatedResponse)
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument()
      })

      // Click next page
      const nextButton = screen.getByRole('button', { name: /next page/i })
      await user.click(nextButton)

      await waitFor(() => {
        expect(mockApiClient.payments.getAll).toHaveBeenCalledWith({
          branchId: 'branch-1',
          page: 2,
          limit: 10
        })
      })
    })
  })

  describe('Export Functionality', () => {
    it('should show export button', async () => {
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
      })
    })

    it('should handle CSV export', async () => {
      const user = userEvent.setup()
      const mockBlob = new Blob(['csv,data'], { type: 'text/csv' })
      global.URL.createObjectURL = vi.fn(() => 'blob:url')
      global.URL.revokeObjectURL = vi.fn()

      renderPaymentList()

      const exportButton = screen.getByRole('button', { name: /export/i })
      await user.click(exportButton)

      const csvOption = screen.getByText(/export as csv/i)
      await user.click(csvOption)

      // Verify download was initiated
      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper table structure and ARIA labels', async () => {
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
        expect(screen.getByRole('table')).toHaveAttribute('aria-label', /payments table/i)
      })

      // Check column headers
      const columnHeaders = screen.getAllByRole('columnheader')
      expect(columnHeaders.length).toBeGreaterThan(0)

      // Check rows
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBeGreaterThan(1) // Header + data rows
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByLabelText(/search/i)).toBeInTheDocument()
      })

      // Tab through interactive elements
      const searchInput = screen.getByLabelText(/search/i)
      const statusSelect = screen.getByLabelText(/status/i)

      await user.tab()
      expect(searchInput).toHaveFocus()

      await user.tab()
      expect(statusSelect).toHaveFocus()
    })

    it('should announce sort changes to screen readers', async () => {
      const user = userEvent.setup()
      renderPaymentList()

      await waitFor(() => {
        expect(screen.getByText('Payment Date')).toBeInTheDocument()
      })

      const dateHeader = screen.getByText('Payment Date')
      await user.click(dateHeader)

      await waitFor(() => {
        expect(dateHeader).toHaveAttribute('aria-sort', 'ascending')
      })
    })
  })
})