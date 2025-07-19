
import { apiClient } from '@/lib/api';

export const checkDuplicatePayment = async (
  studentId: string, 
  paymentCycle: string, 
  academicYear: string,
  excludePaymentId?: string
): Promise<boolean> => {
  try {
    let query = supabase
      .from('registration_payments')
      .select('id')
      .eq('student_id', studentId)
      .eq('payment_cycle', paymentCycle)
      .eq('academic_year', academicYear);

    if (excludePaymentId) {
      query = query.neq('id', excludePaymentId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error checking duplicate payment:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error in checkDuplicatePayment:', error);
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
