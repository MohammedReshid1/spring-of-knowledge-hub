
import { apiClient } from '@/lib/api';

export const checkDuplicatePayment = async (
  studentId: string, 
  paymentCycle: string, 
  academicYear: string,
  excludePaymentId?: string
): Promise<boolean> => {
  try {
    // Fetch all registration payments and filter duplicates
    const { data, error } = await apiClient.getRegistrationPayments();
    if (error) {
      console.error('Error fetching payments for duplicate check:', error);
      return false;
    }
    const payments = data || [];
    const duplicates = payments.filter(p =>
      p.student_id === studentId &&
      p.payment_cycle === paymentCycle &&
      p.academic_year === academicYear &&
      (!excludePaymentId || p.id !== excludePaymentId)
    );
    return duplicates.length > 0;
  } catch (err) {
    console.error('Error in checkDuplicatePayment:', err);
    return false;
  }
};

export const validatePaymentData = async (
  formData: {
    student_id: string;
    payment_cycle: string;
    academic_year: string;
    amount_paid: number;
  },
  excludePaymentId?: string
): Promise<{ isValid: boolean; error?: string }> => {
  // Check for duplicate payment
  const isDuplicate = await checkDuplicatePayment(
    formData.student_id,
    formData.payment_cycle,
    formData.academic_year,
    excludePaymentId
  );

  if (isDuplicate) {
    return {
      isValid: false,
      error: `A payment for ${formData.payment_cycle.replace('_', ' ')} has already been recorded for this student in the ${formData.academic_year} academic year. Please select a different payment cycle or edit the existing payment.`
    };
  }

  // Validate amount
  if (formData.amount_paid <= 0) {
    return {
      isValid: false,
      error: 'Payment amount must be greater than zero.'
    };
  }

  return { isValid: true };
};
