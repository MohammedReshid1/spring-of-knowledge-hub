import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BranchProvider } from '@/contexts/BranchContext'
import PaymentForm from '@/components/payments/PaymentForm'

// Mock the API client
const mockApiClient = {
  payments: {
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn()
  },
  students: {
    getAll: vi.fn(),
    search: vi.fn()
  },
  feeCategories: {
    getAll: vi.fn()
  }
}

vi.mock('@/lib/api', () => ({
  default: mockApiClient
}))

// Mock next/router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn()
}

vi.mock('next/router', () => ({
  useRouter: () => mockRouter
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

// Test data
const mockBranch = {
  id: 'branch-1',
  name: 'Test Branch',
  code: 'TB',
  address: '123 Test Street'
}

const mockStudents = [
  {
    id: 'student-1',
    studentId: 'STU001',
    firstName: 'John',
    lastName: 'Doe',
    gradeLevel: 'Grade 10',
    branchId: 'branch-1'
  },
  {
    id: 'student-2',
    studentId: 'STU002',
    firstName: 'Jane',
    lastName: 'Smith',
    gradeLevel: 'Grade 11',
    branchId: 'branch-1'
  }
]

const mockFeeCategories = [
  {
    id: 'fee-1',
    name: 'Tuition Fee',
    amount: 1000,
    category: 'academic',
    taxPercentage: 10,
    isActive: true
  },
  {
    id: 'fee-2',
    name: 'Activity Fee',
    amount: 200,
    category: 'extracurricular',
    taxPercentage: 0,
    isActive: true
  }
]

const renderPaymentForm = (props = {}) => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    isLoading: false,
    ...props
  }

  return render(
    <BranchProvider>
      <PaymentForm {...defaultProps} />
    </BranchProvider>
  )
}

describe('PaymentForm', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup default mock responses
    mockApiClient.students.getAll.mockResolvedValue({
      success: true,
      data: mockStudents
    })

    mockApiClient.feeCategories.getAll.mockResolvedValue({
      success: true,
      data: mockFeeCategories
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Form Rendering', () => {
    it('should render all required form fields', async () => {
      renderPaymentForm()

      await waitFor(() => {
        expect(screen.getByLabelText(/student/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/payment date/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /add fee item/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /create payment/i })).toBeInTheDocument()
      })
    })

    it('should load students and fee categories on mount', async () => {
      renderPaymentForm()

      await waitFor(() => {
        expect(mockApiClient.students.getAll).toHaveBeenCalledWith({ branchId: undefined })
        expect(mockApiClient.feeCategories.getAll).toHaveBeenCalledWith({ branchId: undefined })
      })
    })

    it('should display loading state when isLoading is true', () => {
      renderPaymentForm({ isLoading: true })

      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()
    })

    it('should populate form when editing existing payment', async () => {
      const existingPayment = {
        id: 'payment-1',
        studentId: 'student-1',
        paymentMethod: 'cash',
        paymentDate: '2024-01-15',
        payerName: 'John Doe Sr.',
        payerPhone: '+1234567890',
        payerEmail: 'john.doe.sr@email.com',
        remarks: 'Test payment'
      }

      renderPaymentForm({ payment: existingPayment, mode: 'edit' })

      await waitFor(() => {
        expect(screen.getByDisplayValue('cash')).toBeInTheDocument()
        expect(screen.getByDisplayValue('John Doe Sr.')).toBeInTheDocument()
        expect(screen.getByDisplayValue('+1234567890')).toBeInTheDocument()
        expect(screen.getByDisplayValue('john.doe.sr@email.com')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Test payment')).toBeInTheDocument()
      })
    })
  })

  describe('Student Selection', () => {
    it('should allow selecting a student from dropdown', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      await waitFor(() => {
        expect(screen.getByLabelText(/student/i)).toBeInTheDocument()
      })

      const studentSelect = screen.getByLabelText(/student/i)
      await user.click(studentSelect)

      await waitFor(() => {
        expect(screen.getByText('John Doe (STU001)')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith (STU002)')).toBeInTheDocument()
      })

      await user.click(screen.getByText('John Doe (STU001)'))

      expect(studentSelect).toHaveValue('student-1')
    })

    it('should filter students based on search input', async () => {
      const user = userEvent.setup()
      mockApiClient.students.search.mockResolvedValue({
        success: true,
        data: [mockStudents[0]]
      })

      renderPaymentForm()

      await waitFor(() => {
        expect(screen.getByLabelText(/student/i)).toBeInTheDocument()
      })

      const studentSelect = screen.getByLabelText(/student/i)
      await user.type(studentSelect, 'John')

      await waitFor(() => {
        expect(mockApiClient.students.search).toHaveBeenCalledWith({
          query: 'John',
          branchId: undefined
        })
      })
    })
  })

  describe('Fee Items Management', () => {
    it('should allow adding fee items', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add fee item/i })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/fee category/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument()
      })
    })

    it('should populate fee category dropdown with available categories', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add fee item/i })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addButton)

      const categorySelect = await screen.findByLabelText(/fee category/i)
      await user.click(categorySelect)

      await waitFor(() => {
        expect(screen.getByText('Tuition Fee - $1000.00')).toBeInTheDocument()
        expect(screen.getByText('Activity Fee - $200.00')).toBeInTheDocument()
      })
    })

    it('should calculate amounts when fee category and quantity are selected', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      // Add fee item
      const addButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addButton)

      // Select fee category
      const categorySelect = await screen.findByLabelText(/fee category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Tuition Fee - $1000.00'))

      // Set quantity
      const quantityInput = screen.getByLabelText(/quantity/i)
      await user.clear(quantityInput)
      await user.type(quantityInput, '2')

      // Check calculations
      await waitFor(() => {
        expect(screen.getByDisplayValue('2000.00')).toBeInTheDocument() // Amount
      })
    })

    it('should allow applying discounts to fee items', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      // Add and configure fee item
      const addButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addButton)

      const categorySelect = await screen.findByLabelText(/fee category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Tuition Fee - $1000.00'))

      // Apply percentage discount
      const discountInput = screen.getByLabelText(/discount percentage/i)
      await user.clear(discountInput)
      await user.type(discountInput, '10')

      // Verify calculation
      await waitFor(() => {
        // Original: 1000, Discount: 10% = 100, After discount: 900, Tax: 10% of 900 = 90, Total: 990
        expect(screen.getByDisplayValue('100.00')).toBeInTheDocument() // Discount amount
      })
    })

    it('should allow removing fee items', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      // Add fee item
      const addButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addButton)

      // Verify item exists
      await waitFor(() => {
        expect(screen.getByLabelText(/fee category/i)).toBeInTheDocument()
      })

      // Remove item
      const removeButton = screen.getByRole('button', { name: /remove item/i })
      await user.click(removeButton)

      // Verify item is removed
      await waitFor(() => {
        expect(screen.queryByLabelText(/fee category/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Payment Method Selection', () => {
    it('should show bank details fields when bank_transfer is selected', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      const paymentMethodSelect = screen.getByLabelText(/payment method/i)
      await user.click(paymentMethodSelect)
      await user.click(screen.getByText('Bank Transfer'))

      await waitFor(() => {
        expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/payment reference/i)).toBeInTheDocument()
      })
    })

    it('should show cheque details fields when cheque is selected', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      const paymentMethodSelect = screen.getByLabelText(/payment method/i)
      await user.click(paymentMethodSelect)
      await user.click(screen.getByText('Cheque'))

      await waitFor(() => {
        expect(screen.getByLabelText(/bank name/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/cheque number/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/cheque date/i)).toBeInTheDocument()
      })
    })

    it('should hide additional fields for cash payment', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      const paymentMethodSelect = screen.getByLabelText(/payment method/i)
      await user.click(paymentMethodSelect)
      await user.click(screen.getByText('Cash'))

      await waitFor(() => {
        expect(screen.queryByLabelText(/bank name/i)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/cheque number/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    it('should display validation errors for required fields', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderPaymentForm({ onSubmit })

      const submitButton = screen.getByRole('button', { name: /create payment/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/student is required/i)).toBeInTheDocument()
        expect(screen.getByText(/at least one fee item is required/i)).toBeInTheDocument()
      })

      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('should validate payer email format', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      const emailInput = screen.getByLabelText(/payer email/i)
      await user.type(emailInput, 'invalid-email')

      const submitButton = screen.getByRole('button', { name: /create payment/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument()
      })
    })

    it('should validate phone number format', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      const phoneInput = screen.getByLabelText(/payer phone/i)
      await user.type(phoneInput, '123')

      const submitButton = screen.getByRole('button', { name: /create payment/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid phone number format/i)).toBeInTheDocument()
      })
    })

    it('should validate discount percentage range', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      // Add fee item first
      const addButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addButton)

      const discountInput = screen.getByLabelText(/discount percentage/i)
      await user.type(discountInput, '150')

      await waitFor(() => {
        expect(screen.getByText(/discount cannot exceed 100%/i)).toBeInTheDocument()
      })
    })
  })

  describe('Payment Totals Calculation', () => {
    it('should calculate and display payment totals correctly', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      // Add fee items
      const addButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addButton)

      // Configure first fee item
      const categorySelect = screen.getByLabelText(/fee category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Tuition Fee - $1000.00'))

      const quantityInput = screen.getByLabelText(/quantity/i)
      await user.clear(quantityInput)
      await user.type(quantityInput, '2')

      // Add second fee item
      await user.click(addButton)

      const categorySelects = screen.getAllByLabelText(/fee category/i)
      await user.click(categorySelects[1])
      await user.click(screen.getByText('Activity Fee - $200.00'))

      // Check totals
      await waitFor(() => {
        // Subtotal: (1000 * 2) + (200 * 1) = 2200
        expect(screen.getByText(/subtotal.*2,200\.00/i)).toBeInTheDocument()
        // Tax: (2000 * 10%) + (200 * 0%) = 200
        expect(screen.getByText(/tax.*200\.00/i)).toBeInTheDocument()
        // Total: 2200 + 200 = 2400
        expect(screen.getByText(/total.*2,400\.00/i)).toBeInTheDocument()
      })
    })

    it('should recalculate totals when overall discount is applied', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      // Add fee item
      const addButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addButton)

      const categorySelect = screen.getByLabelText(/fee category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Tuition Fee - $1000.00'))

      // Apply overall discount
      const overallDiscountInput = screen.getByLabelText(/overall discount percentage/i)
      await user.clear(overallDiscountInput)
      await user.type(overallDiscountInput, '15')

      await waitFor(() => {
        // Subtotal: 1000, Discount: 15% = 150, After discount: 850, Tax: 10% of 850 = 85, Total: 935
        expect(screen.getByText(/discount.*150\.00/i)).toBeInTheDocument()
        expect(screen.getByText(/total.*935\.00/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    it('should submit form with correct data structure', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      mockApiClient.payments.create.mockResolvedValue({
        success: true,
        data: { id: 'payment-1', receiptNo: 'RCP001' }
      })

      renderPaymentForm({ onSubmit })

      // Fill required fields
      const studentSelect = await screen.findByLabelText(/student/i)
      await user.click(studentSelect)
      await user.click(screen.getByText('John Doe (STU001)'))

      // Add fee item
      const addButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addButton)

      const categorySelect = screen.getByLabelText(/fee category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Tuition Fee - $1000.00'))

      // Fill payer information
      await user.type(screen.getByLabelText(/payer name/i), 'John Doe Sr.')
      await user.type(screen.getByLabelText(/payer phone/i), '+1234567890')
      await user.type(screen.getByLabelText(/payer email/i), 'john.doe.sr@email.com')

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create payment/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          studentId: 'student-1',
          paymentMethod: 'cash', // default
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
    })

    it('should handle form submission errors', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn().mockRejectedValue(new Error('Payment creation failed'))

      renderPaymentForm({ onSubmit })

      // Fill minimum required fields
      const studentSelect = await screen.findByLabelText(/student/i)
      await user.click(studentSelect)
      await user.click(screen.getByText('John Doe (STU001)'))

      const addButton = screen.getByRole('button', { name: /add fee item/i })
      await user.click(addButton)

      const categorySelect = screen.getByLabelText(/fee category/i)
      await user.click(categorySelect)
      await user.click(screen.getByText('Tuition Fee - $1000.00'))

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create payment/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/payment creation failed/i)).toBeInTheDocument()
      })
    })

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()

      renderPaymentForm({ onCancel })

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderPaymentForm()

      expect(screen.getByRole('form')).toBeInTheDocument()
      expect(screen.getByLabelText(/student/i)).toHaveAttribute('aria-required', 'true')
      expect(screen.getByLabelText(/payment method/i)).toHaveAttribute('aria-required', 'true')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      renderPaymentForm()

      const studentSelect = screen.getByLabelText(/student/i)
      const paymentMethodSelect = screen.getByLabelText(/payment method/i)
      const submitButton = screen.getByRole('button', { name: /create payment/i })

      // Tab through form elements
      await user.tab()
      expect(studentSelect).toHaveFocus()

      await user.tab()
      expect(paymentMethodSelect).toHaveFocus()

      // Skip to submit button (other elements in between)
      submitButton.focus()
      expect(submitButton).toHaveFocus()
    })
  })
})