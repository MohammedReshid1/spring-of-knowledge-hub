/*
  # Fix Payment Unique Constraint

  1. Problem
    - Current unique constraint only considers student_id and academic_year
    - This prevents multiple payments for different cycles (quarters, semesters, etc.)
    - Application needs to support multiple payment records per student per year

  2. Solution
    - Drop existing unique constraint registration_payments_student_id_academic_year_key
    - Add new unique constraint that includes payment_cycle
    - New constraint: UNIQUE (student_id, academic_year, payment_cycle)

  3. Impact
    - Allows multiple payment records per student per academic year
    - Each payment cycle can have its own record
    - Maintains data integrity by preventing duplicate payments for same cycle
*/

-- Drop the existing unique constraint that's causing the issue
ALTER TABLE registration_payments 
DROP CONSTRAINT IF EXISTS registration_payments_student_id_academic_year_key;

-- Add new unique constraint that includes payment_cycle
-- This allows multiple payments per student per year, but only one per cycle
ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_student_academic_cycle_key 
UNIQUE (student_id, academic_year, payment_cycle);

-- Add comment to document the constraint purpose
COMMENT ON CONSTRAINT registration_payments_student_academic_cycle_key ON registration_payments 
IS 'Ensures one payment record per student per academic year per payment cycle';