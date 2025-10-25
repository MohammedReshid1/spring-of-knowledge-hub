"""
React component tests for BankTransferDetails component.
Tests form validation, file upload, and user interactions.
"""

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from '@/hooks/use-toast';
import { BankTransferDetails } from '../BankTransferDetails';

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn()
}));

const mockToast = toast as jest.MockedFunction<typeof toast>;

describe('BankTransferDetails Component', () => {
  const mockOnChange = jest.fn();
  const mockOnFileUpload = jest.fn();
  const mockErrors: Record<string, string> = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    value: {
      bank_name: '',
      bank_code: '',
      transaction_number: '',
      transaction_screenshot_url: ''
    },
    onChange: mockOnChange,
    onFileUpload: mockOnFileUpload,
    errors: mockErrors
  };

  describe('Component Rendering', () => {
    test('renders all form fields correctly', () => {
      render(<BankTransferDetails {...defaultProps} />);

      // Check for all required fields
      expect(screen.getByLabelText(/bank name \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/bank code \(optional\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/transaction number \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/transaction screenshot \(optional\)/i)).toBeInTheDocument();
    });

    test('displays provided values in form fields', () => {
      const propsWithValues = {
        ...defaultProps,
        value: {
          bank_name: 'Commercial Bank of Ethiopia',
          bank_code: '001',
          transaction_number: 'TXN123456789',
          transaction_screenshot_url: 'https://example.com/screenshot.jpg'
        }
      };

      render(<BankTransferDetails {...propsWithValues} />);

      expect(screen.getByDisplayValue('Commercial Bank of Ethiopia')).toBeInTheDocument();
      expect(screen.getByDisplayValue('001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('TXN123456789')).toBeInTheDocument();
    });

    test('shows error messages when errors are provided', () => {
      const propsWithErrors = {
        ...defaultProps,
        errors: {
          bank_name: 'Bank name is required',
          transaction_number: 'Transaction number must be at least 3 characters'
        }
      };

      render(<BankTransferDetails {...propsWithErrors} />);

      expect(screen.getByText('Bank name is required')).toBeInTheDocument();
      expect(screen.getByText('Transaction number must be at least 3 characters')).toBeInTheDocument();
    });

    test('disables all fields when disabled prop is true', () => {
      render(<BankTransferDetails {...defaultProps} disabled={true} />);

      expect(screen.getByLabelText(/bank name \*/i)).toBeDisabled();
      expect(screen.getByLabelText(/bank code \(optional\)/i)).toBeDisabled();
      expect(screen.getByLabelText(/transaction number \*/i)).toBeDisabled();
      expect(screen.getByLabelText(/transaction screenshot \(optional\)/i)).toBeDisabled();
    });
  });

  describe('Form Field Interactions', () => {
    test('calls onChange when bank name is changed', async () => {
      const user = userEvent.setup();
      render(<BankTransferDetails {...defaultProps} />);

      const bankNameInput = screen.getByLabelText(/bank name \*/i);
      await user.type(bankNameInput, 'Commercial Bank');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...defaultProps.value,
        bank_name: 'Commercial Bank'
      });
    });

    test('calls onChange when bank code is changed', async () => {
      const user = userEvent.setup();
      render(<BankTransferDetails {...defaultProps} />);

      const bankCodeInput = screen.getByLabelText(/bank code \(optional\)/i);
      await user.type(bankCodeInput, '001');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...defaultProps.value,
        bank_code: '001'
      });
    });

    test('calls onChange when transaction number is changed', async () => {
      const user = userEvent.setup();
      render(<BankTransferDetails {...defaultProps} />);

      const transactionNumberInput = screen.getByLabelText(/transaction number \*/i);
      await user.type(transactionNumberInput, 'TXN123456789');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...defaultProps.value,
        transaction_number: 'TXN123456789'
      });
    });
  });

  describe('File Upload Functionality', () => {
    test('calls onFileUpload when valid file is selected', async () => {
      const user = userEvent.setup();
      mockOnFileUpload.mockResolvedValue('https://example.com/uploaded.jpg');

      render(<BankTransferDetails {...defaultProps} />);

      const fileInput = screen.getByLabelText(/transaction screenshot \(optional\)/i);
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockOnFileUpload).toHaveBeenCalledWith(file);
      });
    });

    test('shows success toast when file upload succeeds', async () => {
      const user = userEvent.setup();
      mockOnFileUpload.mockResolvedValue('https://example.com/uploaded.jpg');

      render(<BankTransferDetails {...defaultProps} />);

      const fileInput = screen.getByLabelText(/transaction screenshot \(optional\)/i);
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Screenshot uploaded successfully'
        });
      });
    });

    test('shows error toast when file upload fails', async () => {
      const user = userEvent.setup();
      mockOnFileUpload.mockRejectedValue(new Error('Upload failed'));

      render(<BankTransferDetails {...defaultProps} />);

      const fileInput = screen.getByLabelText(/transaction screenshot \(optional\)/i);
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Upload Failed',
          description: 'Upload failed',
          variant: 'destructive'
        });
      });
    });

    test('validates file type before upload', async () => {
      const user = userEvent.setup();
      render(<BankTransferDetails {...defaultProps} />);

      const fileInput = screen.getByLabelText(/transaction screenshot \(optional\)/i);
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, invalidFile);

      expect(mockOnFileUpload).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Invalid File Type',
        description: 'Only JPG, PNG, and PDF files are allowed',
        variant: 'destructive'
      });
    });

    test('validates file size before upload', async () => {
      const user = userEvent.setup();
      render(<BankTransferDetails {...defaultProps} />);

      const fileInput = screen.getByLabelText(/transaction screenshot \(optional\)/i);
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput, largeFile);

      expect(mockOnFileUpload).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'File Too Large',
        description: 'File size must be less than 5MB',
        variant: 'destructive'
      });
    });

    test('shows uploaded file preview when URL is provided', () => {
      const propsWithScreenshot = {
        ...defaultProps,
        value: {
          ...defaultProps.value,
          transaction_screenshot_url: 'https://example.com/screenshot.jpg'
        }
      };

      render(<BankTransferDetails {...propsWithScreenshot} />);

      expect(screen.getByText('Screenshot uploaded')).toBeInTheDocument();
      expect(screen.getByText('View file')).toBeInTheDocument();
    });

    test('calls onChange to remove screenshot when remove button is clicked', async () => {
      const user = userEvent.setup();
      const propsWithScreenshot = {
        ...defaultProps,
        value: {
          ...defaultProps.value,
          transaction_screenshot_url: 'https://example.com/screenshot.jpg'
        }
      };

      render(<BankTransferDetails {...propsWithScreenshot} />);

      const removeButton = screen.getByText('Remove');
      await user.click(removeButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        ...propsWithScreenshot.value,
        transaction_screenshot_url: undefined
      });
    });
  });

  describe('Help Text and Instructions', () => {
    test('displays helpful placeholder text', () => {
      render(<BankTransferDetails {...defaultProps} />);

      const bankNameInput = screen.getByLabelText(/bank name \*/i);
      const transactionNumberInput = screen.getByLabelText(/transaction number \*/i);

      expect(bankNameInput).toHaveAttribute('placeholder', 'e.g., Commercial Bank of Ethiopia');
      expect(transactionNumberInput).toHaveAttribute('placeholder', 'Enter transaction/reference number');
    });

    test('displays help text for optional fields', () => {
      render(<BankTransferDetails {...defaultProps} />);

      expect(screen.getByText('Branch or bank identifier code')).toBeInTheDocument();
      expect(screen.getByText('Reference number from your bank transfer receipt')).toBeInTheDocument();
      expect(screen.getByText('Upload JPG, PNG, or PDF (max 5MB)')).toBeInTheDocument();
    });

    test('displays security notice', () => {
      render(<BankTransferDetails {...defaultProps} />);

      expect(screen.getByText('Security Notice:')).toBeInTheDocument();
      expect(screen.getByText('Ensure the transaction number matches your bank receipt')).toBeInTheDocument();
      expect(screen.getByText('Upload a clear screenshot of the transaction confirmation')).toBeInTheDocument();
      expect(screen.getByText('All documents are encrypted and stored securely')).toBeInTheDocument();
    });
  });

  describe('Styling and Appearance', () => {
    test('applies error styling when validation errors exist', () => {
      const propsWithErrors = {
        ...defaultProps,
        errors: {
          bank_name: 'Bank name is required'
        }
      };

      render(<BankTransferDetails {...propsWithErrors} />);

      const bankNameInput = screen.getByLabelText(/bank name \*/i);
      expect(bankNameInput).toHaveClass('border-red-500');
    });

    test('shows upload progress indicator during upload', async () => {
      const user = userEvent.setup();
      mockOnFileUpload.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      render(<BankTransferDetails {...defaultProps} />);

      const fileInput = screen.getByLabelText(/transaction screenshot \(optional\)/i);
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput, file);

      // Check if upload progress elements are shown
      await waitFor(() => {
        expect(screen.getByText('Uploading...')).toBeInTheDocument();
      });
    });
  });
});