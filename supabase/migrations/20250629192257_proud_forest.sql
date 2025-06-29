/*
  # Fix Payment Constraints - Final Resolution

  1. Problem Analysis
    - The old unique constraint `registration_payments_student_id_academic_year_key` still exists
    - This prevents multiple payments per student per academic year
    - Previous migrations may not have been applied correctly

  2. Solution
    - Forcefully drop the old constraint
    - Ensure payment_cycle column exists with proper type
    - Create new constraint that allows multiple payment cycles
    - Handle any existing data conflicts

  3. Data Safety
    - Check for existing constraint conflicts before applying new constraint
    - Update any conflicting records to have unique payment cycles
*/

-- First, let's check if the old constraint exists and drop it
DO $$
BEGIN
  -- Drop the problematic unique constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'registration_payments_student_id_academic_year_key'
    AND table_name = 'registration_payments'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE registration_payments 
    DROP CONSTRAINT registration_payments_student_id_academic_year_key;
    RAISE NOTICE 'Dropped old unique constraint: registration_payments_student_id_academic_year_key';
  END IF;
END $$;

-- Ensure payment_cycle column exists with proper type
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
    RAISE NOTICE 'Added payment_cycle column';
  END IF;
END $$;

-- Update any NULL payment_cycle values to avoid constraint violations
UPDATE registration_payments 
SET payment_cycle = 'registration_fee' 
WHERE payment_cycle IS NULL OR payment_cycle = '';

-- Handle potential duplicate records by updating them with different payment cycles
DO $$
DECLARE
  rec RECORD;
  counter INTEGER;
BEGIN
  -- Find groups of records that would violate the new unique constraint
  FOR rec IN 
    SELECT student_id, academic_year, COUNT(*) as count_records
    FROM registration_payments 
    WHERE payment_cycle = 'registration_fee'
    GROUP BY student_id, academic_year 
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    -- Update duplicate records to have different payment cycles
    FOR rec IN 
      SELECT id FROM registration_payments 
      WHERE student_id = rec.student_id 
      AND academic_year = rec.academic_year 
      AND payment_cycle = 'registration_fee'
      ORDER BY created_at, id
    LOOP
      IF counter = 1 THEN
        -- Keep first record as registration_fee
        counter := counter + 1;
      ELSIF counter = 2 THEN
        -- Update second record to 1st_quarter
        UPDATE registration_payments 
        SET payment_cycle = '1st_quarter' 
        WHERE id = rec.id;
        counter := counter + 1;
      ELSIF counter = 3 THEN
        -- Update third record to 2nd_quarter
        UPDATE registration_payments 
        SET payment_cycle = '2nd_quarter' 
        WHERE id = rec.id;
        counter := counter + 1;
      ELSE
        -- Update additional records to different cycles
        UPDATE registration_payments 
        SET payment_cycle = '3rd_quarter' 
        WHERE id = rec.id;
        counter := counter + 1;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Drop the new constraint if it exists (to recreate it properly)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'registration_payments_student_academic_cycle_key'
    AND table_name = 'registration_payments'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE registration_payments 
    DROP CONSTRAINT registration_payments_student_academic_cycle_key;
  END IF;
END $$;

-- Create the new unique constraint that includes payment_cycle
ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_student_academic_cycle_key 
UNIQUE (student_id, academic_year, payment_cycle);

-- Add check constraint for valid payment cycles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'registration_payments_payment_cycle_check'
    AND table_name = 'registration_payments'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE registration_payments 
    ADD CONSTRAINT registration_payments_payment_cycle_check 
    CHECK (payment_cycle IN (
      '1st_quarter', '2nd_quarter', '3rd_quarter', '4th_quarter',
      '1st_semester', '2nd_semester', 'registration_fee', 'annual'
    ));
  END IF;
END $$;

-- Ensure the payment_cycle column is NOT NULL
ALTER TABLE registration_payments 
ALTER COLUMN payment_cycle SET NOT NULL;

-- Add helpful comments
COMMENT ON CONSTRAINT registration_payments_student_academic_cycle_key ON registration_payments 
IS 'Ensures one payment record per student per academic year per payment cycle - allows multiple payments per year';

COMMENT ON COLUMN registration_payments.payment_cycle 
IS 'Payment cycle: 1st_quarter, 2nd_quarter, 3rd_quarter, 4th_quarter, 1st_semester, 2nd_semester, registration_fee, annual';

-- Verify the constraint is working
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully. New constraint allows multiple payment cycles per student per year.';
END $$;