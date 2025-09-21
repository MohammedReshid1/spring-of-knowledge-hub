import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { BranchProvider } from '@/contexts/BranchContext'
import { AuthProvider } from '@/contexts/AuthContext'
import PaymentDashboard from '@/components/payments/PaymentDashboard'
import PaymentForm from '@/components/payments/PaymentForm'
import PaymentList from '@/components/payments/PaymentList'
import BulkImportModal from '@/components/payments/BulkImportModal'

// Mock the API client with realistic responses
const mockApiClient = {
  payments: {
    create: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    refund: vi.fn(),
    getSummary: vi.fn(),
    bulkImport: vi.fn(),
    validateBulkImport: vi.fn(),
    downloadTemplate: vi.fn()
  },
  students: {
    getAll: vi.fn(),
    getById: vi.fn(),
    search: vi.fn()
  },
  feeCategories: {
    getAll: vi.fn(),
    getById: vi.fn()
  },
  branches: {
    getAll: vi.fn(),
    getById: vi.fn()
  },
  dashboard: {
    getPaymentStats: vi.fn(),
    getPaymentChartData: vi.fn()
  }
}

vi.mock('@/lib/api', () => ({
  default: mockApiClient
}))

// Mock react-hot-toast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn()
}

vi.mock('react-hot-toast', () => ({
  toast: mockToast
}))

// Mock next/router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  pathname: '/',
  query: {},
  asPath: '/'
}

vi.mock('next/router', () => ({
  useRouter: () => mockRouter
}))

// Test data
const mockBranch = {
  id: 'branch-1',
  name: 'Test Branch',
  code: 'TB'
}

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  role: 'admin',
  branchId: 'branch-1'
}

const mockStudents = [
  {
    id: 'student-1',
    studentId: 'STU001',
    firstName: 'John',
    lastName: 'Doe',
    gradeLevel: 'Grade 10',
    branchId: 'branch-1',
    isActive: true
  },
  {
    id: 'student-2',
    studentId: 'STU002',
    firstName: 'Jane',
    lastName: 'Smith',
    gradeLevel: 'Grade 11',
    branchId: 'branch-1',
    isActive: true
  }
]

const mockFeeCategories = [
  {
    id: 'fee-1',
    name: 'Tuition Fee',
    amount: 1000,
    category: 'academic',
    taxPercentage: 10,
    lateFeePercentage: 5,
    branchId: 'branch-1',
    isActive: true
  },
  {
    id: 'fee-2',
    name: 'Activity Fee',
    amount: 200,
    category: 'extracurricular',
    taxPercentage: 0,
    lateFeePercentage: 0,
    branchId: 'branch-1',
    isActive: true
  }
]

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
    branchId: 'branch-1',
    createdAt: '2024-01-15T09:30:00Z'
  }
]

const mockPaymentStats = {
  totalPayments: 1,
  totalAmount: 990.00,
  totalDiscount: 100.00,
  totalTax: 90.00,
  averagePayment: 990.00,
  completedPayments: 1,
  pendingPayments: 0,
  monthlyGrowth: 0,
  weeklyGrowth: 0,
  paymentMethodBreakdown: { cash: 1 },
  verificationStatus: { verified: 1 }
}

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <BranchProvider>
        {children}
      </BranchProvider>
    </AuthProvider>
  </BrowserRouter>
)

describe('Payment System Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default API responses
    mockApiClient.students.getAll.mockResolvedValue({
      success: true,
      data: mockStudents
    })

    mockApiClient.feeCategories.getAll.mockResolvedValue({
      success: true,
      data: mockFeeCategories
    })

    mockApiClient.payments.getAll.mockResolvedValue({
      success: true,
      data: mockPayments
    })

    mockApiClient.dashboard.getPaymentStats.mockResolvedValue({
      success: true,
      data: mockPaymentStats
    })

    mockApiClient.dashboard.getPaymentChartData.mockResolvedValue({
      success: true,
      data: {
        monthlyRevenue: [],
        paymentMethodDistribution: [],
        weeklyTrends: []
      }
    })

    mockApiClient.payments.getSummary.mockResolvedValue({
      success: true,
      data: {
        totalPayments: 1,
        totalAmount: 990.00,
        totalDiscount: 100.00,
        totalTax: 90.00,
        paymentMethods: { cash: 1 },
        statusBreakdown: { completed: 1 }
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('End-to-End Payment Creation Workflow', () => {
    it('should complete full payment creation from dashboard to confirmation', async () => {
      const user = userEvent.setup()

      // Mock payment creation success
      const createdPayment = {
        id: 'payment-new',
        receiptNo: 'RCP002',
        studentId: 'student-1',
        totalAmount: 1100.00,
        paymentMethod: 'cash',
        status: 'completed'
      }

      mockApiClient.payments.create.mockResolvedValue({
        success: true,
        data: {
          payment: createdPayment,
          details: [
            {
              id: 'detail-1',
              feeCategoryId: 'fee-1',
              feeCategoryName: 'Tuition Fee',
              originalAmount: 1000.00,
              discountAmount: 0.00,
              taxAmount: 100.00,
              paidAmount: 1100.00,
              quantity: 1
            }
          ],
          summary: {
            paymentId: 'payment-new',
            totalItems: 1,
            totalPaid: 1100.00
          }
        }
      })

      // 1. Start with dashboard
      const onCreatePayment = vi.fn()
      render(
        <TestWrapper>
          <PaymentDashboard branchId="branch-1" onCreatePayment={onCreatePayment} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText(/payment dashboard/i)).toBeInTheDocument()
      })

      // 2. Click "New Payment" button
      const newPaymentButton = screen.getByRole('button', { name: /new payment/i })
      await user.click(newPaymentButton)

      expect(mockRouter.push).toHaveBeenCalledWith('/payments/new')

      // 3. Render payment form
      const onSubmit = vi.fn()
      const onCancel = vi.fn()

      const { rerender } = render(
        <TestWrapper>
          <PaymentForm onSubmit={onSubmit} onCancel={onCancel} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument()
      })

      // 4. Fill out payment form
      // Select student
      const studentSelect = await screen.findByLabelText(/student/i)
      await user.click(studentSelect)
      await user.click(screen.getByText('John Doe (STU001)'))

      // Add fee item
      const addFeeButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addFeeButton)

      // Select fee category
      const categorySelect = screen.getByLabelText(/fee category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Tuition Fee - $1000.00'))

      // Fill payer information
      await user.type(screen.getByLabelText(/payer name/i), 'John Doe Sr.')
      await user.type(screen.getByLabelText(/payer phone/i), '+1234567890')
      await user.type(screen.getByLabelText(/payer email/i), 'john.doe.sr@email.com')

      // 5. Submit payment
      const submitButton = screen.getByRole('button', { name: /create payment/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          studentId: 'student-1',
          paymentMethod: 'cash',
          paymentDate: expect.any(String),
          feeItems: [
            {
              feeCategoryId: 'fee-1',
              quantity: 1,
              discountPercentage: null,
              discountAmount: null,
              remarks: null
            }
          ],
          payerName: 'John Doe Sr.',
          payerPhone: '+1234567890',
          payerEmail: 'john.doe.sr@email.com',
          remarks: null
        })
      })

      // 6. Verify success toast and navigation
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Payment created successfully')
        expect(mockRouter.push).toHaveBeenCalledWith('/payments/payment-new')
      })
    })

    it('should handle payment creation errors gracefully', async () => {
      const user = userEvent.setup()

      // Mock payment creation failure
      mockApiClient.payments.create.mockRejectedValue(new Error('Insufficient permissions'))

      const onSubmit = vi.fn().mockRejectedValue(new Error('Payment creation failed'))

      render(
        <TestWrapper>
          <PaymentForm onSubmit={onSubmit} />
        </TestWrapper>
      )

      // Fill minimum required fields
      const studentSelect = await screen.findByLabelText(/student/i)
      await user.click(studentSelect)
      await user.click(screen.getByText('John Doe (STU001)'))

      const addFeeButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addFeeButton)

      const categorySelect = screen.getByLabelText(/fee category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Tuition Fee - $1000.00'))

      // Submit payment
      const submitButton = screen.getByRole('button', { name: /create payment/i })
      await user.click(submitButton)

      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText(/payment creation failed/i)).toBeInTheDocument()
        expect(mockToast.error).toHaveBeenCalledWith('Payment creation failed')
      })
    })
  })

  describe('Payment Management Workflow', () => {
    it('should complete payment view, edit, and cancel workflow', async () => {
      const user = userEvent.setup()

      // Mock updated payment responses
      mockApiClient.payments.getById.mockResolvedValue({
        success: true,
        data: {
          payment: mockPayments[0],
          details: [
            {
              id: 'detail-1',
              feeCategoryId: 'fee-1',
              feeCategoryName: 'Tuition Fee',
              originalAmount: 1000.00,
              discountAmount: 100.00,
              taxAmount: 90.00,
              paidAmount: 990.00
            }
          ],
          summary: {
            paymentId: 'payment-1',
            totalItems: 1,
            totalPaid: 990.00
          }
        }
      })

      mockApiClient.payments.update.mockResolvedValue({
        success: true,
        data: {
          ...mockPayments[0],
          remarks: 'Updated payment remarks',
          verificationStatus: 'verified'
        }
      })

      mockApiClient.payments.cancel.mockResolvedValue({
        success: true,
        data: {
          ...mockPayments[0],
          status: 'cancelled',
          cancellationReason: 'Student requested cancellation'
        }
      })

      // 1. Start with payment list
      const onView = vi.fn()
      const onEdit = vi.fn()

      render(
        <TestWrapper>
          <PaymentList branchId="branch-1" onView={onView} onEdit={onEdit} />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('RCP001')).toBeInTheDocument()
      })

      // 2. View payment details
      const viewButton = screen.getByRole('button', { name: /view/i })
      await user.click(viewButton)

      expect(onView).toHaveBeenCalledWith(mockPayments[0])

      // 3. Edit payment
      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      expect(onEdit).toHaveBeenCalledWith(mockPayments[0])

      // 4. Cancel payment workflow
      const actionMenu = screen.getByRole('button', { name: /more actions/i })
      await user.click(actionMenu)

      const cancelOption = screen.getByText(/cancel payment/i)
      await user.click(cancelOption)

      // Fill cancellation reason
      const reasonInput = screen.getByLabelText(/cancellation reason/i)
      await user.type(reasonInput, 'Student requested cancellation')

      const confirmButton = screen.getByRole('button', { name: /confirm cancellation/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockApiClient.payments.cancel).toHaveBeenCalledWith('payment-1', {
          cancellationReason: 'Student requested cancellation'
        })
        expect(mockToast.success).toHaveBeenCalledWith('Payment cancelled successfully')
      })
    })

    it('should handle payment refund workflow', async () => {
      const user = userEvent.setup()

      mockApiClient.payments.refund.mockResolvedValue({
        success: true,
        data: {
          ...mockPayments[0],
          status: 'partial_refund',
          refundAmount: 400.00,
          refundReference: 'REF123456'
        }
      })

      render(
        <TestWrapper>
          <PaymentList branchId="branch-1" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('RCP001')).toBeInTheDocument()
      })

      // Open action menu
      const actionMenu = screen.getByRole('button', { name: /more actions/i })
      await user.click(actionMenu)

      // Click refund option
      const refundOption = screen.getByText(/refund payment/i)
      await user.click(refundOption)

      // Fill refund details
      const amountInput = screen.getByLabelText(/refund amount/i)
      await user.clear(amountInput)
      await user.type(amountInput, '400')

      const referenceInput = screen.getByLabelText(/refund reference/i)
      await user.type(referenceInput, 'REF123456')

      const reasonInput = screen.getByLabelText(/refund reason/i)
      await user.type(reasonInput, 'Partial service not delivered')

      // Process refund
      const refundButton = screen.getByRole('button', { name: /process refund/i })
      await user.click(refundButton)

      await waitFor(() => {
        expect(mockApiClient.payments.refund).toHaveBeenCalledWith('payment-1', {
          refundAmount: 400,
          refundReference: 'REF123456',
          refundReason: 'Partial service not delivered'
        })
        expect(mockToast.success).toHaveBeenCalledWith('Refund processed successfully')
      })
    })
  })

  describe('Bulk Import Workflow', () => {
    it('should complete full bulk import workflow from template download to import confirmation', async () => {
      const user = userEvent.setup()

      // Mock bulk import responses
      mockApiClient.payments.downloadTemplate.mockResolvedValue(
        new Blob(['template,data'], { type: 'text/csv' })
      )

      mockApiClient.payments.validateBulkImport.mockResolvedValue({
        success: true,
        data: {
          validRecords: [
            {
              rowNumber: 2,
              studentId: 'STU001',
              studentName: 'John Doe',
              feeCategory: 'Tuition Fee',
              amount: 1000.00,
              paymentMethod: 'cash'
            }
          ],
          invalidRecords: [],
          summary: {
            totalRows: 1,
            validRows: 1,
            invalidRows: 0,
            totalAmount: 1000.00
          }
        }
      })

      mockApiClient.payments.bulkImport.mockResolvedValue({
        success: true,
        data: {
          successfulImports: 1,
          failedImports: 0,
          totalAmount: 1000.00,
          paymentIds: ['payment-bulk-1']
        }
      })

      const onSuccess = vi.fn()

      global.URL.createObjectURL = vi.fn(() => 'blob:url')
      global.URL.revokeObjectURL = vi.fn()

      // Mock FileReader
      const mockFileReader = {
        readAsText: vi.fn(),
        result: null,
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader) as any

      render(
        <TestWrapper>
          <BulkImportModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={onSuccess}
            branchId="branch-1"
          />
        </TestWrapper>
      )

      // 1. Download template
      const downloadButton = screen.getByRole('button', { name: /download template/i })
      await user.click(downloadButton)

      await waitFor(() => {
        expect(mockApiClient.payments.downloadTemplate).toHaveBeenCalledWith('branch-1')
        expect(global.URL.createObjectURL).toHaveBeenCalled()
      })

      // 2. Upload CSV file
      const csvData = `Student ID,Fee Category,Amount,Payment Method
STU001,Tuition Fee,1000,cash`

      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = csvData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      const file = new File([csvData], 'payments.csv', { type: 'text/csv' })
      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      // 3. Verify validation results
      await waitFor(() => {
        expect(mockApiClient.payments.validateBulkImport).toHaveBeenCalledWith({
          csvData,
          branchId: 'branch-1'
        })
        expect(screen.getByText(/1 valid record/i)).toBeInTheDocument()
        expect(screen.getByText(/0 invalid records/i)).toBeInTheDocument()
      })

      // 4. Import payments
      const importButton = screen.getByRole('button', { name: /import payments/i })
      expect(importButton).not.toBeDisabled()
      await user.click(importButton)

      // Confirm import
      const confirmButton = screen.getByRole('button', { name: /yes, import/i })
      await user.click(confirmButton)

      // 5. Verify successful import
      await waitFor(() => {
        expect(mockApiClient.payments.bulkImport).toHaveBeenCalledWith({
          validRecords: expect.any(Array),
          branchId: 'branch-1'
        })
        expect(onSuccess).toHaveBeenCalledWith({
          successfulImports: 1,
          failedImports: 0,
          totalAmount: 1000.00
        })
        expect(mockToast.success).toHaveBeenCalledWith('1 payments imported successfully')
      })
    })

    it('should handle bulk import validation errors and correction workflow', async () => {
      const user = userEvent.setup()

      // Mock validation with errors
      mockApiClient.payments.validateBulkImport.mockResolvedValue({
        success: true,
        data: {
          validRecords: [],
          invalidRecords: [
            {
              rowNumber: 2,
              errors: ['Student ID not found', 'Invalid amount format'],
              rawData: ['STU999', 'Invalid Fee', 'abc']
            }
          ],
          summary: {
            totalRows: 1,
            validRows: 0,
            invalidRows: 1,
            totalAmount: 0
          }
        }
      })

      const mockFileReader = {
        readAsText: vi.fn(),
        result: null,
        onload: null,
        onerror: null
      }
      global.FileReader = vi.fn(() => mockFileReader) as any

      render(
        <TestWrapper>
          <BulkImportModal
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
            branchId="branch-1"
          />
        </TestWrapper>
      )

      // Upload invalid CSV
      const invalidCsvData = `Student ID,Fee Category,Amount
STU999,Invalid Fee,abc`

      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = invalidCsvData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      const file = new File([invalidCsvData], 'invalid.csv', { type: 'text/csv' })
      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      // Verify error display
      await waitFor(() => {
        expect(screen.getByText(/0 valid records/i)).toBeInTheDocument()
        expect(screen.getByText(/1 invalid record/i)).toBeInTheDocument()
        expect(screen.getByText(/student id not found/i)).toBeInTheDocument()
        expect(screen.getByText(/invalid amount format/i)).toBeInTheDocument()
      })

      // Import button should be disabled
      const importButton = screen.getByRole('button', { name: /import payments/i })
      expect(importButton).toBeDisabled()

      // Fix errors option should be available
      const fixButton = screen.getByRole('button', { name: /fix errors/i })
      expect(fixButton).toBeInTheDocument()
    })
  })

  describe('Dashboard Integration Workflow', () => {
    it('should navigate between dashboard components seamlessly', async () => {
      const user = userEvent.setup()

      // Mock enhanced dashboard data
      mockApiClient.dashboard.getPaymentStats.mockResolvedValue({
        success: true,
        data: {
          ...mockPaymentStats,
          totalPayments: 5,
          totalAmount: 4500.00,
          pendingPayments: 2
        }
      })

      mockApiClient.payments.getAll.mockResolvedValue({
        success: true,
        data: [
          ...mockPayments,
          {
            id: 'payment-2',
            receiptNo: 'RCP002',
            studentName: 'Jane Smith',
            studentIdNumber: 'STU002',
            totalAmount: 750.00,
            status: 'pending',
            paymentMethod: 'card'
          }
        ]
      })

      render(
        <TestWrapper>
          <PaymentDashboard branchId="branch-1" />
        </TestWrapper>
      )

      // 1. Verify dashboard loads with statistics
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument() // Total payments
        expect(screen.getByText('$4,500.00')).toBeInTheDocument() // Total amount
        expect(screen.getByText(/2.*pending/i)).toBeInTheDocument() // Pending payments
      })

      // 2. Navigate to payments list
      const viewAllLink = screen.getByText(/view all payments/i)
      await user.click(viewAllLink)

      expect(mockRouter.push).toHaveBeenCalledWith('/payments')

      // 3. Open bulk import from dashboard
      const bulkImportButton = screen.getByRole('button', { name: /bulk import/i })
      await user.click(bulkImportButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText(/bulk import payments/i)).toBeInTheDocument()
      })

      // 4. Close modal and verify dashboard is still functional
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByText(/payment dashboard/i)).toBeInTheDocument()
      })
    })

    it('should refresh dashboard data after payment operations', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <PaymentDashboard branchId="branch-1" />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(mockApiClient.dashboard.getPaymentStats).toHaveBeenCalledTimes(1)
      })

      // Simulate payment creation success
      const event = new CustomEvent('paymentCreated', {
        detail: { paymentId: 'payment-new', amount: 1200.00 }
      })
      window.dispatchEvent(event)

      // Dashboard should refresh
      await waitFor(() => {
        expect(mockApiClient.dashboard.getPaymentStats).toHaveBeenCalledTimes(2)
      })

      // Manual refresh
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)

      await waitFor(() => {
        expect(mockApiClient.dashboard.getPaymentStats).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('Error Recovery Workflow', () => {
    it('should handle network failures with retry mechanism', async () => {
      const user = userEvent.setup()

      // Mock network failure then success
      mockApiClient.dashboard.getPaymentStats
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          data: mockPaymentStats
        })

      render(
        <TestWrapper>
          <PaymentDashboard branchId="branch-1" />
        </TestWrapper>
      )

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument()
      })

      // Retry should work
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText(/payment dashboard/i)).toBeInTheDocument()
        expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument()
      })
    })

    it('should handle concurrent payment operations gracefully', async () => {
      const user = userEvent.setup()

      // Mock optimistic updates
      let paymentData = [...mockPayments]

      mockApiClient.payments.getAll.mockImplementation(() =>
        Promise.resolve({ success: true, data: paymentData })
      )

      mockApiClient.payments.create.mockImplementation((data) => {
        const newPayment = {
          id: 'payment-concurrent',
          receiptNo: 'RCP999',
          ...data,
          status: 'completed'
        }
        paymentData = [...paymentData, newPayment]
        return Promise.resolve({ success: true, data: newPayment })
      })

      const onSubmit = vi.fn().mockImplementation(async (data) => {
        await mockApiClient.payments.create(data)
      })

      render(
        <TestWrapper>
          <PaymentForm onSubmit={onSubmit} />
        </TestWrapper>
      )

      // Fill and submit form rapidly
      const studentSelect = await screen.findByLabelText(/student/i)
      await user.click(studentSelect)
      await user.click(screen.getByText('John Doe (STU001)'))

      const addFeeButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addFeeButton)

      const categorySelect = screen.getByLabelText(/fee category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Tuition Fee - $1000.00'))

      const submitButton = screen.getByRole('button', { name: /create payment/i })

      // Rapid multiple clicks (should be handled gracefully)
      await user.click(submitButton)
      await user.click(submitButton)
      await user.click(submitButton)

      // Should only create one payment
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(mockApiClient.payments.create).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Data Consistency Workflow', () => {
    it('should maintain data consistency across components during payment lifecycle', async () => {
      const user = userEvent.setup()

      // Mock data that changes over time
      let currentPayments = [...mockPayments]
      let currentStats = { ...mockPaymentStats }

      mockApiClient.payments.getAll.mockImplementation(() =>
        Promise.resolve({ success: true, data: currentPayments })
      )

      mockApiClient.dashboard.getPaymentStats.mockImplementation(() =>
        Promise.resolve({ success: true, data: currentStats })
      )

      mockApiClient.payments.cancel.mockImplementation((id) => {
        const cancelledPayment = {
          ...currentPayments.find(p => p.id === id)!,
          status: 'cancelled'
        }
        currentPayments = currentPayments.map(p =>
          p.id === id ? cancelledPayment : p
        )
        currentStats = {
          ...currentStats,
          totalPayments: currentStats.totalPayments - 1,
          cancelledPayments: currentStats.cancelledPayments + 1
        }
        return Promise.resolve({ success: true, data: cancelledPayment })
      })

      const { rerender } = render(
        <TestWrapper>
          <div>
            <PaymentDashboard branchId="branch-1" />
            <PaymentList branchId="branch-1" />
          </div>
        </TestWrapper>
      )

      // Initial state
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument() // Total payments in dashboard
        expect(screen.getByText('RCP001')).toBeInTheDocument() // Payment in list
      })

      // Cancel payment from list
      const actionMenu = screen.getByRole('button', { name: /more actions/i })
      await user.click(actionMenu)

      const cancelOption = screen.getByText(/cancel payment/i)
      await user.click(cancelOption)

      const reasonInput = screen.getByLabelText(/cancellation reason/i)
      await user.type(reasonInput, 'Test cancellation')

      const confirmButton = screen.getByRole('button', { name: /confirm cancellation/i })
      await user.click(confirmButton)

      // Both components should reflect the change
      await waitFor(() => {
        // Dashboard should show updated stats
        expect(screen.getByText(/cancelled.*1/i)).toBeInTheDocument()

        // Payment list should show cancelled status
        expect(screen.getByText('Cancelled')).toBeInTheDocument()
      })
    })
  })
})