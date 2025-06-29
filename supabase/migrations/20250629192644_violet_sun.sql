/*
  # Final Fix for Payment Constraint Issue

  1. Problem
    - The old unique constraint `registration_payments_student_id_academic_year_key` still exists
    - This prevents multiple payments per student per academic year
    - Previous migrations may not have been applied or the constraint was recreated

  2. Solution
    - Forcefully drop ALL existing unique constraints on registration_payments
    - Ensure payment_cycle column exists and is properly configured
    - Create the correct unique constraint that allows multiple payment cycles
    - Handle any existing data conflicts safely

  3. Safety Measures
    - Use IF EXISTS clauses to prevent errors
    - Handle duplicate data by assigning different payment cycles
    - Verify constraint creation before completing
*/

-- Step 1: Drop ALL existing unique constraints on registration_payments table
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find and drop all unique constraints on registration_payments table
    FOR constraint_record IN 
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'registration_payments' 
        AND table_schema = 'public' 
        AND constraint_type = 'UNIQUE'
    LOOP
        EXECUTE format('ALTER TABLE registration_payments DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_record.constraint_name;
    END LOOP;
END $$;

-- Step 2: Ensure payment_cycle column exists with proper configuration
DO $$
BEGIN
    -- Add payment_cycle column if it doesn't exist
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
    
    -- Ensure the column allows NULL temporarily for data cleanup
    ALTER TABLE registration_payments 
    ALTER COLUMN payment_cycle DROP NOT NULL;
END $$;

-- Step 3: Clean up existing data to prevent constraint violations
UPDATE registration_payments 
SET payment_cycle = 'registration_fee' 
WHERE payment_cycle IS NULL OR payment_cycle = '';

-- Step 4: Handle duplicate records by assigning different payment cycles
DO $$
DECLARE
    duplicate_group RECORD;
    payment_record RECORD;
    cycle_counter INTEGER;
    available_cycles TEXT[] := ARRAY['registration_fee', '1st_quarter', '2nd_quarter', '3rd_quarter', '4th_quarter', '1st_semester', '2nd_semester', 'annual'];
BEGIN
    -- Find groups of records that would violate the new unique constraint
    FOR duplicate_group IN 
        SELECT student_id, academic_year, COUNT(*) as record_count
        FROM registration_payments 
        GROUP BY student_id, academic_year 
        HAVING COUNT(*) > 1
    LOOP
        cycle_counter := 1;
        RAISE NOTICE 'Processing % duplicate records for student % in year %', 
                     duplicate_group.record_count, duplicate_group.student_id, duplicate_group.academic_year;
        
        -- Update each duplicate record with a different payment cycle
        FOR payment_record IN 
            SELECT id, payment_cycle
            FROM registration_payments 
            WHERE student_id = duplicate_group.student_id 
            AND academic_year = duplicate_group.academic_year 
            ORDER BY created_at NULLS LAST, id
        LOOP
            -- Assign a unique payment cycle from available cycles
            IF cycle_counter <= array_length(available_cycles, 1) THEN
                UPDATE registration_payments 
                SET payment_cycle = available_cycles[cycle_counter]
                WHERE id = payment_record.id;
                
                RAISE NOTICE 'Updated record % to payment_cycle: %', 
                           payment_record.id, available_cycles[cycle_counter];
                cycle_counter := cycle_counter + 1;
            ELSE
                -- If we run out of predefined cycles, create a unique one
                UPDATE registration_payments 
                SET payment_cycle = 'payment_' || cycle_counter::TEXT
                WHERE id = payment_record.id;
                
                RAISE NOTICE 'Updated record % to payment_cycle: payment_%', 
                           payment_record.id, cycle_counter;
                cycle_counter := cycle_counter + 1;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Step 5: Make payment_cycle NOT NULL now that all records have values
ALTER TABLE registration_payments 
ALTER COLUMN payment_cycle SET NOT NULL;

-- Step 6: Create the new unique constraint that includes payment_cycle
ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_student_academic_cycle_unique 
UNIQUE (student_id, academic_year, payment_cycle);

-- Step 7: Add check constraint for valid payment cycles
ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_payment_cycle_check 
CHECK (payment_cycle IN (
    '1st_quarter', '2nd_quarter', '3rd_quarter', '4th_quarter',
    '1st_semester', '2nd_semester', 'registration_fee', 'annual'
) OR payment_cycle LIKE 'payment_%');

-- Step 8: Add helpful comments and verify
COMMENT ON CONSTRAINT registration_payments_student_academic_cycle_unique ON registration_payments 
IS 'Ensures one payment record per student per academic year per payment cycle - allows multiple payments per year for different cycles';

COMMENT ON COLUMN registration_payments.payment_cycle 
IS 'Payment cycle identifier: 1st_quarter, 2nd_quarter, 3rd_quarter, 4th_quarter, 1st_semester, 2nd_semester, registration_fee, annual, or custom payment_N';

-- Step 9: Verify the fix worked
DO $$
DECLARE
    constraint_exists BOOLEAN;
    old_constraint_exists BOOLEAN;
BEGIN
    -- Check if new constraint exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'registration_payments_student_academic_cycle_unique'
        AND table_name = 'registration_payments'
        AND table_schema = 'public'
    ) INTO constraint_exists;
    
    -- Check if old constraint still exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'registration_payments_student_id_academic_year_key'
        AND table_name = 'registration_payments'
        AND table_schema = 'public'
    ) INTO old_constraint_exists;
    
    IF constraint_exists AND NOT old_constraint_exists THEN
        RAISE NOTICE 'SUCCESS: Payment constraint fix completed successfully!';
        RAISE NOTICE 'New constraint allows multiple payments per student per year with different cycles.';
    ELSE
        RAISE WARNING 'ISSUE: Constraint fix may not have completed properly. New constraint exists: %, Old constraint exists: %', constraint_exists, old_constraint_exists;
    END IF;
END $$;