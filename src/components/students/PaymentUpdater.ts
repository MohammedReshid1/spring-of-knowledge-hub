import { supabase } from '@/integrations/supabase/client';
import type { PaymentUpdateResult } from './types';

export class PaymentUpdater {
  async updateAllStudentPayments(): Promise<PaymentUpdateResult> {
    const result: PaymentUpdateResult = {
      studentsProcessed: 0,
      updatedPayments: 0,
      errors: []
    };

    try {
      // Get all students in the system
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name');

      if (studentsError) {
        result.errors.push(`Failed to fetch students: ${studentsError.message}`);
        return result;
      }

      if (!students || students.length === 0) {
        return result;
      }

      result.studentsProcessed = students.length;

      // Get existing payment records for these students
      const studentIds = students.map(s => s.id);
      const { data: payments, error: paymentsError } = await supabase
        .from('registration_payments')
        .select('*')
        .in('student_id', studentIds)
        .in('payment_cycle', ['registration_fee', '1st_semester'])
        .eq('payment_status', 'Unpaid');

      if (paymentsError) {
        result.errors.push(`Failed to fetch payments: ${paymentsError.message}`);
        return result;
      }

      if (!payments || payments.length === 0) {
        return result;
      }

      // Update all unpaid registration and first semester fees to paid
      const paymentIds = payments.map(p => p.id);
      const { error: updateError } = await supabase
        .from('registration_payments')
        .update({
          payment_status: 'Paid',
          payment_date: new Date().toISOString().split('T')[0], // Today's date
          updated_at: new Date().toISOString()
        })
        .in('id', paymentIds);

      if (updateError) {
        result.errors.push(`Failed to update payments: ${updateError.message}`);
        return result;
      }

      result.updatedPayments = paymentIds.length;

      return result;
    } catch (error) {
      result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }
}