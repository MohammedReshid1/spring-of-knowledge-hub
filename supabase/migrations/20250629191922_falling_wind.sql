/*
  # Fix Payment Cycle Constraint

  1. Changes
    - Ensure payment_cycle column exists with proper default
    - Update unique constraint to allow multiple payments per student per year with different cycles
    - Add check constraint for valid payment cycles

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity with proper constraints
*/

-- Add payment_cycle column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_payments' 
    AND column_name = 'payment_cycle'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE registration_payments 
    ADD COLUMN payment_cycle TEXT DEFAULT 'registration_fee';
  END IF;
END $$;

-- Drop the old unique constraint if it exists
ALTER TABLE registration_payments 
DROP CONSTRAINT IF EXISTS registration_payments_student_id_academic_year_key;

-- Drop the new constraint if it exists (to recreate it properly)
ALTER TABLE registration_payments 
DROP CONSTRAINT IF EXISTS registration_payments_student_academic_cycle_key;

-- Create the new unique constraint that includes payment_cycle
-- This allows multiple payments per student per year, but only one per cycle
ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_student_academic_cycle_key 
UNIQUE (student_id, academic_year, payment_cycle);

-- Add check constraint for valid payment cycles
ALTER TABLE registration_payments 
DROP CONSTRAINT IF EXISTS registration_payments_payment_cycle_check;

ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_payment_cycle_check 
CHECK (payment_cycle IN (
  '1st_quarter', '2nd_quarter', '3rd_quarter', '4th_quarter',
  '1st_semester', '2nd_semester', 'registration_fee', 'annual'
));

-- Update any existing records that have NULL payment_cycle
UPDATE registration_payments 
SET payment_cycle = 'registration_fee' 
WHERE payment_cycle IS NULL;

-- Add comment to document the constraint purpose
COMMENT ON CONSTRAINT registration_payments_student_academic_cycle_key ON registration_payments 
IS 'Ensures one payment record per student per academic year per payment cycle';

COMMENT ON COLUMN registration_payments.payment_cycle 
IS 'Payment cycle: 1st_quarter, 2nd_quarter, 3rd_quarter, 4th_quarter, 1st_semester, 2nd_semester, registration_fee, annual';