"""
React component tests for PaymentFormExtended component.
Tests conditional rendering, form validation, and submission logic.
"""

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentFormExtended } from '../PaymentFormExtended';
import { z } from 'zod';

// Mock the child components
jest.mock('../BankTransferDetails', () => ({
  BankTransferDetails: ({ value, onChange, errors, disabled }: any) => (
    <div data-testid="bank-transfer-details">
      <input
        data-testid="bank-name-input"
        value={value.bank_name || ''}
        onChange={(e) => onChange({ ...value, bank_name: e.target.value })}
        disabled={disabled}
      />
      {errors.bank_name && <span data-testid="bank-name-error">{errors.bank_name}</span>}
    </div>
  )
}));

jest.mock('../MobilePaymentDetails', () => ({
  MobilePaymentDetails: ({ value, onChange, errors, disabled, paymentMethod }: any) => (
    <div data-testid="mobile-payment-details">
      <input
        data-testid="transaction-id-input"
        value={value.transaction_id || ''}
        onChange={(e) => onChange({ ...value, transaction_id: e.target.value })}
        disabled={disabled}
      />
      {errors.transaction_id && <span data-testid="transaction-id-error">{errors.transaction_id}</span>}
    </div>
  )
}));

// Mock the file upload function
const mockFileUpload = jest.fn();

describe('PaymentFormExtended Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileUpload.mockResolvedValue('https://example.com/uploaded.jpg');
  });

  const defaultProps = {
    onSuccess: mockOnSuccess,
    onCancel: mockOnCancel,
    onFileUpload: mockFileUpload
  };

  describe('Component Rendering', () => {
    test('renders all payment method options', () => {
      render(<PaymentFormExtended {...defaultProps} />);

      expect(screen.getByText(/cash/i)).toBeInTheDocument();
      expect(screen.getByText(/check/i)).toBeInTheDocument();
      expect(screen.getByText(/bank transfer/i)).toBeInTheDocument();
      expect(screen.getByText(/online payment/i)).toBeInTheDocument();
      expect(screen.getByText(/mobile payment/i)).toBeInTheDocument();
    });

    test('renders basic payment fields', () => {
      render(<PaymentFormExtended {...defaultProps} />);

      expect(screen.getByLabelText(/student/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/fee type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/payment date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    test('renders action buttons', () => {
      render(<PaymentFormExtended {...defaultProps} />);

      expect(screen.getByRole('button', { name: /create payment/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Conditional Rendering', () => {
    test('shows bank transfer details when bank transfer is selected', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      const bankTransferRadio = screen.getByLabelText(/bank transfer/i);
      await user.click(bankTransferRadio);

      expect(screen.getByTestId('bank-transfer-details')).toBeInTheDocument();
      expect(screen.queryByTestId('mobile-payment-details')).not.toBeInTheDocument();
    });

    test('shows mobile payment details when mobile payment is selected', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      const mobilePaymentRadio = screen.getByLabelText(/mobile payment/i);
      await user.click(mobilePaymentRadio);

      expect(screen.getByTestId('mobile-payment-details')).toBeInTheDocument();
      expect(screen.queryByTestId('bank-transfer-details')).not.toBeInTheDocument();
    });

    test('shows online payment details when online payment is selected', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      const onlinePaymentRadio = screen.getByLabelText(/online payment/i);
      await user.click(onlinePaymentRadio);

      expect(screen.getByTestId('mobile-payment-details')).toBeInTheDocument();
      expect(screen.queryByTestId('bank-transfer-details')).not.toBeInTheDocument();
    });

    test('hides method-specific details for cash and check payments', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      // Select bank transfer first
      await user.click(screen.getByLabelText(/bank transfer/i));
      expect(screen.getByTestId('bank-transfer-details')).toBeInTheDocument();

      // Switch to cash
      await user.click(screen.getByLabelText(/cash/i));
      expect(screen.queryByTestId('bank-transfer-details')).not.toBeInTheDocument();

      // Select mobile payment
      await user.click(screen.getByLabelText(/mobile payment/i));
      expect(screen.getByTestId('mobile-payment-details')).toBeInTheDocument();

      // Switch to check
      await user.click(screen.getByLabelText(/check/i));
      expect(screen.queryByTestId('mobile-payment-details')).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('shows validation errors for required fields', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /create payment/i });
      await user.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/student is required/i)).toBeInTheDocument();
        expect(screen.getByText(/fee type is required/i)).toBeInTheDocument();
        expect(screen.getByText(/amount must be greater than 0/i)).toBeInTheDocument();
      });
    });

    test('shows validation errors for bank transfer fields', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      // Fill basic fields
      await user.selectOptions(screen.getByLabelText(/student/i), 'student1');
      await user.selectOptions(screen.getByLabelText(/fee type/i), 'tuition');
      await user.type(screen.getByLabelText(/amount/i), '5000');

      // Select bank transfer
      await user.click(screen.getByLabelText(/bank transfer/i));

      // Try to submit without bank transfer details
      const submitButton = screen.getByRole('button', { name: /create payment/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('bank-name-error')).toBeInTheDocument();
      });
    });

    test('shows validation errors for mobile payment fields', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      // Fill basic fields
      await user.selectOptions(screen.getByLabelText(/student/i), 'student1');
      await user.selectOptions(screen.getByLabelText(/fee type/i), 'tuition');
      await user.type(screen.getByLabelText(/amount/i), '2500');

      // Select mobile payment
      await user.click(screen.getByLabelText(/mobile payment/i));

      // Try to submit without mobile payment details
      const submitButton = screen.getByRole('button', { name: /create payment/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('transaction-id-error')).toBeInTheDocument();
      });
    });

    test('validates minimum amount', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      await user.selectOptions(screen.getByLabelText(/student/i), 'student1');
      await user.selectOptions(screen.getByLabelText(/fee type/i), 'tuition');
      await user.type(screen.getByLabelText(/amount/i), '0'); // Zero amount

      const submitButton = screen.getByRole('button', { name: /create payment/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/amount must be greater than 0/i)).toBeInTheDocument();
      });
    });

    test('validates negative amounts', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      await user.selectOptions(screen.getByLabelText(/student/i), 'student1');
      await user.selectOptions(screen.getByLabelText(/fee type/i), 'tuition');
      await user.type(screen.getByLabelText(/amount/i), '-1000'); // Negative amount

      const submitButton = screen.getByRole('button', { name: /create payment/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/number must be greater than 0/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    test('calls onSuccess with correct data for cash payment', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      // Fill form
      await user.selectOptions(screen.getByLabelText(/student/i), 'student1');
      await user.selectOptions(screen.getByLabelText(/fee type/i), 'tuition');
      await user.type(screen.getByLabelText(/amount/i), '5000');
      await user.type(screen.getByLabelText(/payment date/i), '2024-01-01');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create payment/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith({
          student_id: 'student1',
          fee_id: 'tuition',
          amount: 5000,
          payment_method: 'cash',
          payment_date: '2024-01-01',
          notes: ''
        });
      });
    });

    test('calls onSuccess with correct data for bank transfer payment', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      // Fill basic fields
      await user.selectOptions(screen.getByLabelText(/student/i), 'student1');
      await user.selectOptions(screen.getByLabelText(/fee type/i), 'tuition');
      await user.type(screen.getByLabelText(/amount/i), '5000');

      // Select bank transfer
      await user.click(screen.getByLabelText(/bank transfer/i));

      // Fill bank transfer details
      await user.type(screen.getByTestId('bank-name-input'), 'Commercial Bank of Ethiopia');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create payment/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith({
          student_id: 'student1',
          fee_id: 'tuition',
          amount: 5000,
          payment_method: 'bank_transfer',
          payment_date: expect.any(String),
          notes: '',
          bank_details: {
            bank_name: 'Commercial Bank of Ethiopia',
            bank_code: '',
            transaction_number: '',
            transaction_screenshot_url: ''
          }
        });
      });
    });

    test('calls onSuccess with correct data for mobile payment', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      // Fill basic fields
      await user.selectOptions(screen.getByLabelText(/student/i), 'student1');
      await user.selectOptions(screen.getByLabelText(/fee type/i), 'tuition');
      await user.type(screen.getByLabelText(/amount/i), '2500');

      // Select mobile payment
      await user.click(screen.getByLabelText(/mobile payment/i));

      // Fill mobile payment details
      await user.type(screen.getByTestId('transaction-id-input'), 'MP123456789');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create payment/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith({
          student_id: 'student1',
          fee_id: 'tuition',
          amount: 2500,
          payment_method: 'mobile_payment',
          payment_date: expect.any(String),
          notes: '',
          mobile_details: {
            transaction_id: 'MP123456789',
            transaction_screenshot_url: ''
          }
        });
      });
    });
  });

  describe('Form Actions', () => {
    test('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    test('shows loading state during submission', async () => {
      const user = userEvent.setup();
      mockOnSuccess.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      render(<PaymentFormExtended {...defaultProps} />);

      // Fill form
      await user.selectOptions(screen.getByLabelText(/student/i), 'student1');
      await user.selectOptions(screen.getByLabelText(/fee type/i), 'tuition');
      await user.type(screen.getByLabelText(/amount/i), '5000');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create payment/i });
      await user.click(submitButton);

      // Check loading state
      expect(screen.getByRole('button', { name: /creating payment/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /creating payment/i })).toBeDisabled();
    });
  });

  describe('Form Reset and Changes', () => {
    test('resets method-specific fields when payment method changes', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      // Select bank transfer and fill details
      await user.click(screen.getByLabelText(/bank transfer/i));
      await user.type(screen.getByTestId('bank-name-input'), 'Test Bank');

      // Switch to mobile payment
      await user.click(screen.getByLabelText(/mobile payment/i));

      // Bank transfer details should be hidden and potentially reset
      expect(screen.queryByTestId('bank-transfer-details')).not.toBeInTheDocument();
    });

    test('maintains basic fields when payment method changes', async () => {
      const user = userEvent.setup();
      render(<PaymentFormExtended {...defaultProps} />);

      // Fill basic fields
      await user.selectOptions(screen.getByLabelText(/student/i), 'student1');
      await user.type(screen.getByLabelText(/amount/i), '5000');

      // Change payment method
      await user.click(screen.getByLabelText(/bank transfer/i));

      // Basic fields should retain their values
      expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
    });
  });
});