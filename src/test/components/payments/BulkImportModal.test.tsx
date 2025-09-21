import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BulkImportModal from '@/components/payments/BulkImportModal'

// Mock the API client
const mockApiClient = {
  payments: {
    bulkImport: vi.fn(),
    validateBulkImport: vi.fn(),
    downloadTemplate: vi.fn()
  },
  students: {
    getAll: vi.fn()
  },
  feeCategories: {
    getAll: vi.fn()
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

// Mock file reading utilities
const mockFileReader = {
  readAsText: vi.fn(),
  readAsArrayBuffer: vi.fn(),
  result: null,
  onload: null,
  onerror: null
}

// Mock FileReader
global.FileReader = vi.fn(() => mockFileReader) as any

const renderBulkImportModal = (props = {}) => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    branchId: 'branch-1',
    ...props
  }

  return render(<BulkImportModal {...defaultProps} />)
}

// Sample CSV data for testing
const validCSVData = `Student ID,Fee Category,Amount,Discount %,Payment Method,Payment Date,Payer Name,Payer Phone,Payer Email,Remarks
STU001,Tuition Fee,1000,10,cash,2024-01-15,John Doe Sr.,+1234567890,john.doe.sr@email.com,Monthly tuition
STU002,Activity Fee,200,0,card,2024-01-15,Jane Smith Sr.,+1234567891,jane.smith.sr@email.com,Extra-curricular activities`

const invalidCSVData = `Student ID,Fee Category,Amount
STU001,Invalid Fee,abc` // Missing required columns and invalid amount

const mockValidationResponse = {
  success: true,
  data: {
    validRecords: [
      {
        rowNumber: 2,
        studentId: 'STU001',
        studentName: 'John Doe',
        feeCategory: 'Tuition Fee',
        amount: 900, // After 10% discount
        paymentMethod: 'cash',
        paymentDate: '2024-01-15',
        payerName: 'John Doe Sr.',
        payerPhone: '+1234567890',
        payerEmail: 'john.doe.sr@email.com'
      },
      {
        rowNumber: 3,
        studentId: 'STU002',
        studentName: 'Jane Smith',
        feeCategory: 'Activity Fee',
        amount: 200,
        paymentMethod: 'card',
        paymentDate: '2024-01-15',
        payerName: 'Jane Smith Sr.',
        payerPhone: '+1234567891',
        payerEmail: 'jane.smith.sr@email.com'
      }
    ],
    invalidRecords: [],
    summary: {
      totalRows: 2,
      validRows: 2,
      invalidRows: 0,
      totalAmount: 1100.00,
      duplicateCount: 0
    }
  }
}

const mockInvalidValidationResponse = {
  success: true,
  data: {
    validRecords: [],
    invalidRecords: [
      {
        rowNumber: 2,
        errors: ['Student ID not found', 'Invalid fee category', 'Invalid amount format'],
        rawData: ['STU999', 'Invalid Fee', 'abc']
      }
    ],
    summary: {
      totalRows: 1,
      validRows: 0,
      invalidRows: 1,
      totalAmount: 0,
      duplicateCount: 0
    }
  }
}

describe('BulkImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockApiClient.students.getAll.mockResolvedValue({
      success: true,
      data: [
        { id: 'student-1', studentId: 'STU001', firstName: 'John', lastName: 'Doe' },
        { id: 'student-2', studentId: 'STU002', firstName: 'Jane', lastName: 'Smith' }
      ]
    })

    mockApiClient.feeCategories.getAll.mockResolvedValue({
      success: true,
      data: [
        { id: 'fee-1', name: 'Tuition Fee', amount: 1000 },
        { id: 'fee-2', name: 'Activity Fee', amount: 200 }
      ]
    })
  })

  describe('Modal Rendering', () => {
    it('should render modal when isOpen is true', () => {
      renderBulkImportModal()

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/bulk import payments/i)).toBeInTheDocument()
    })

    it('should not render modal when isOpen is false', () => {
      renderBulkImportModal({ isOpen: false })

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should display all import steps initially', () => {
      renderBulkImportModal()

      expect(screen.getByText(/step 1.*download template/i)).toBeInTheDocument()
      expect(screen.getByText(/step 2.*prepare data/i)).toBeInTheDocument()
      expect(screen.getByText(/step 3.*upload file/i)).toBeInTheDocument()
    })

    it('should show file upload area', () => {
      renderBulkImportModal()

      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument()
      expect(screen.getByText(/click to browse/i)).toBeInTheDocument()
      expect(screen.getByText(/csv files only/i)).toBeInTheDocument()
    })
  })

  describe('Template Download', () => {
    it('should handle template download', async () => {
      const user = userEvent.setup()
      const mockBlob = new Blob(['template,data'], { type: 'text/csv' })
      mockApiClient.payments.downloadTemplate.mockResolvedValue(mockBlob)
      global.URL.createObjectURL = vi.fn(() => 'blob:url')
      global.URL.revokeObjectURL = vi.fn()

      renderBulkImportModal()

      const downloadButton = screen.getByRole('button', { name: /download template/i })
      await user.click(downloadButton)

      await waitFor(() => {
        expect(mockApiClient.payments.downloadTemplate).toHaveBeenCalledWith('branch-1')
        expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
      })
    })

    it('should show error message when template download fails', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.downloadTemplate.mockRejectedValue(new Error('Download failed'))

      renderBulkImportModal()

      const downloadButton = screen.getByRole('button', { name: /download template/i })
      await user.click(downloadButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to download template/i)).toBeInTheDocument()
      })
    })
  })

  describe('File Upload', () => {
    it('should handle file selection via file input', async () => {
      const user = userEvent.setup()
      const file = new File([validCSVData], 'payments.csv', { type: 'text/csv' })

      renderBulkImportModal()

      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      expect(fileInput.files).toHaveLength(1)
      expect(fileInput.files![0]).toBe(file)
    })

    it('should validate file type and show error for non-CSV files', async () => {
      const user = userEvent.setup()
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })

      renderBulkImportModal()

      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByText(/only csv files are allowed/i)).toBeInTheDocument()
      })
    })

    it('should validate file size and show error for large files', async () => {
      const user = userEvent.setup()
      // Create a large file (mock size property)
      const file = new File([validCSVData], 'large.csv', { type: 'text/csv' })
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 }) // 6MB

      renderBulkImportModal()

      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByText(/file size cannot exceed 5mb/i)).toBeInTheDocument()
      })
    })

    it('should handle drag and drop file upload', async () => {
      const file = new File([validCSVData], 'payments.csv', { type: 'text/csv' })

      renderBulkImportModal()

      const dropZone = screen.getByText(/drag and drop/i).closest('div')
      expect(dropZone).toBeInTheDocument()

      // Simulate drag and drop
      const dropEvent = new Event('drop', { bubbles: true })
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [file] }
      })

      fireEvent(dropZone!, dropEvent)

      // File should be processed
      expect(mockFileReader.readAsText).toHaveBeenCalledWith(file)
    })

    it('should show visual feedback during drag over', () => {
      renderBulkImportModal()

      const dropZone = screen.getByText(/drag and drop/i).closest('div')

      const dragOverEvent = new Event('dragover', { bubbles: true })
      fireEvent(dropZone!, dragOverEvent)

      expect(dropZone).toHaveClass('border-primary')
    })
  })

  describe('File Validation', () => {
    it('should validate uploaded CSV and show preview of valid records', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.validateBulkImport.mockResolvedValue(mockValidationResponse)

      // Mock FileReader
      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = validCSVData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      const file = new File([validCSVData], 'payments.csv', { type: 'text/csv' })

      renderBulkImportModal()

      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(mockApiClient.payments.validateBulkImport).toHaveBeenCalledWith({
          csvData: validCSVData,
          branchId: 'branch-1'
        })
      })

      await waitFor(() => {
        expect(screen.getByText(/validation results/i)).toBeInTheDocument()
        expect(screen.getByText(/2 valid records/i)).toBeInTheDocument()
        expect(screen.getByText(/0 invalid records/i)).toBeInTheDocument()
        expect(screen.getByText(/total amount.*\$1,100\.00/i)).toBeInTheDocument()
      })

      // Check preview table
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Tuition Fee')).toBeInTheDocument()
      expect(screen.getByText('Activity Fee')).toBeInTheDocument()
    })

    it('should show validation errors for invalid records', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.validateBulkImport.mockResolvedValue(mockInvalidValidationResponse)

      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = invalidCSVData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      const file = new File([invalidCSVData], 'invalid.csv', { type: 'text/csv' })

      renderBulkImportModal()

      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByText(/0 valid records/i)).toBeInTheDocument()
        expect(screen.getByText(/1 invalid record/i)).toBeInTheDocument()
      })

      // Check error details
      expect(screen.getByText(/student id not found/i)).toBeInTheDocument()
      expect(screen.getByText(/invalid fee category/i)).toBeInTheDocument()
      expect(screen.getByText(/invalid amount format/i)).toBeInTheDocument()
    })

    it('should handle validation API errors', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.validateBulkImport.mockRejectedValue(new Error('Validation failed'))

      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = validCSVData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      const file = new File([validCSVData], 'payments.csv', { type: 'text/csv' })

      renderBulkImportModal()

      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByText(/validation failed/i)).toBeInTheDocument()
      })
    })

    it('should allow editing invalid records inline', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.validateBulkImport.mockResolvedValue(mockInvalidValidationResponse)

      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = invalidCSVData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      const file = new File([invalidCSVData], 'invalid.csv', { type: 'text/csv' })

      renderBulkImportModal()

      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /fix errors/i })).toBeInTheDocument()
      })

      const fixButton = screen.getByRole('button', { name: /fix errors/i })
      await user.click(fixButton)

      // Should show inline editing form
      await waitFor(() => {
        expect(screen.getByLabelText(/student id/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/fee category/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
      })
    })
  })

  describe('Import Process', () => {
    it('should process import when validation passes and user confirms', async () => {
      const user = userEvent.setup()
      const onSuccess = vi.fn()

      mockApiClient.payments.validateBulkImport.mockResolvedValue(mockValidationResponse)
      mockApiClient.payments.bulkImport.mockResolvedValue({
        success: true,
        data: {
          successfulImports: 2,
          failedImports: 0,
          totalAmount: 1100.00,
          paymentIds: ['payment-1', 'payment-2']
        }
      })

      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = validCSVData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      renderBulkImportModal({ onSuccess })

      const file = new File([validCSVData], 'payments.csv', { type: 'text/csv' })
      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /import payments/i })).toBeInTheDocument()
      })

      const importButton = screen.getByRole('button', { name: /import payments/i })
      expect(importButton).not.toBeDisabled()

      await user.click(importButton)

      // Confirm import in confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/confirm import/i)).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', { name: /yes, import/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockApiClient.payments.bulkImport).toHaveBeenCalledWith({
          validRecords: mockValidationResponse.data.validRecords,
          branchId: 'branch-1'
        })
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({
          successfulImports: 2,
          failedImports: 0,
          totalAmount: 1100.00
        })
      })
    })

    it('should disable import button when there are no valid records', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.validateBulkImport.mockResolvedValue(mockInvalidValidationResponse)

      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = invalidCSVData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      renderBulkImportModal()

      const file = new File([invalidCSVData], 'invalid.csv', { type: 'text/csv' })
      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      await waitFor(() => {
        const importButton = screen.getByRole('button', { name: /import payments/i })
        expect(importButton).toBeDisabled()
      })
    })

    it('should handle import API errors', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.validateBulkImport.mockResolvedValue(mockValidationResponse)
      mockApiClient.payments.bulkImport.mockRejectedValue(new Error('Import failed'))

      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = validCSVData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      renderBulkImportModal()

      const file = new File([validCSVData], 'payments.csv', { type: 'text/csv' })
      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      const importButton = await screen.findByRole('button', { name: /import payments/i })
      await user.click(importButton)

      const confirmButton = await screen.findByRole('button', { name: /yes, import/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText(/import failed/i)).toBeInTheDocument()
      })
    })

    it('should show import progress during processing', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.validateBulkImport.mockResolvedValue(mockValidationResponse)

      // Delay the import response to show loading state
      mockApiClient.payments.bulkImport.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { successfulImports: 2, failedImports: 0, totalAmount: 1100.00 }
        }), 1000))
      )

      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = validCSVData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      renderBulkImportModal()

      const file = new File([validCSVData], 'payments.csv', { type: 'text/csv' })
      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      const importButton = await screen.findByRole('button', { name: /import payments/i })
      await user.click(importButton)

      const confirmButton = await screen.findByRole('button', { name: /yes, import/i })
      await user.click(confirmButton)

      // Should show loading state
      expect(screen.getByText(/importing payments/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /importing/i })).toBeDisabled()
    })
  })

  describe('Modal Actions', () => {
    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      renderBulkImportModal({ onClose })

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })

    it('should close modal when clicking outside', async () => {
      const onClose = vi.fn()
      renderBulkImportModal({ onClose })

      const modalBackdrop = screen.getByRole('dialog').parentElement
      fireEvent.click(modalBackdrop!)

      expect(onClose).toHaveBeenCalled()
    })

    it('should close modal when escape key is pressed', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      renderBulkImportModal({ onClose })

      await user.keyboard('{Escape}')

      expect(onClose).toHaveBeenCalled()
    })

    it('should reset form when modal is reopened', async () => {
      const { rerender } = renderBulkImportModal({ isOpen: false })

      // Open modal with some state
      rerender(<BulkImportModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} branchId="branch-1" />)

      // Upload file to set state
      const file = new File([validCSVData], 'payments.csv', { type: 'text/csv' })
      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = validCSVData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      const fileInput = screen.getByLabelText(/upload csv file/i)
      await userEvent.upload(fileInput, file)

      // Close and reopen modal
      rerender(<BulkImportModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} branchId="branch-1" />)
      rerender(<BulkImportModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} branchId="branch-1" />)

      // Form should be reset
      expect(screen.queryByText(/validation results/i)).not.toBeInTheDocument()
      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderBulkImportModal()

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby')
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby')
      expect(screen.getByLabelText(/upload csv file/i)).toBeInTheDocument()
    })

    it('should trap focus within modal', async () => {
      const user = userEvent.setup()
      renderBulkImportModal()

      const modal = screen.getByRole('dialog')
      const firstFocusable = screen.getByRole('button', { name: /download template/i })
      const lastFocusable = screen.getByRole('button', { name: /close/i })

      // Focus should start on first focusable element
      firstFocusable.focus()
      expect(firstFocusable).toHaveFocus()

      // Tab should cycle through focusable elements
      await user.tab()
      await user.tab()
      expect(lastFocusable).toHaveFocus()

      // Shift+Tab from first element should go to last
      firstFocusable.focus()
      await user.keyboard('{Shift>}{Tab}{/Shift}')
      expect(lastFocusable).toHaveFocus()
    })

    it('should announce validation results to screen readers', async () => {
      const user = userEvent.setup()
      mockApiClient.payments.validateBulkImport.mockResolvedValue(mockValidationResponse)

      mockFileReader.readAsText.mockImplementation((file) => {
        mockFileReader.result = validCSVData
        mockFileReader.onload?.({ target: mockFileReader })
      })

      renderBulkImportModal()

      const file = new File([validCSVData], 'payments.csv', { type: 'text/csv' })
      const fileInput = screen.getByLabelText(/upload csv file/i)
      await user.upload(fileInput, file)

      await waitFor(() => {
        const resultsSummary = screen.getByText(/2 valid records/i)
        expect(resultsSummary).toHaveAttribute('aria-live', 'polite')
      })
    })
  })
})