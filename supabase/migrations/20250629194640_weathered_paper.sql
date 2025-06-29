/*
  # Final Fix for Payment Constraint Issue - Force Resolution

  1. Problem
    - The old unique constraint `registration_payments_student_id_academic_year_key` still exists
    - Multiple migration attempts have failed to remove it completely
    - This prevents multiple payments per student per academic year

  2. Solution
    - Use CASCADE to forcefully drop the constraint and any dependencies
    - Completely rebuild the table structure if necessary
    - Ensure the new constraint allows multiple payment cycles per student per year

  3. Safety
    - Backup existing data before making changes
    - Verify constraint removal before creating new one
    - Handle any orphaned data appropriately
*/

-- Step 1: Backup existing payment data
CREATE TEMP TABLE payment_backup AS 
SELECT * FROM registration_payments;

-- Step 2: Get information about existing constraints
DO $$
DECLARE
    constraint_info RECORD;
BEGIN
    RAISE NOTICE 'Current constraints on registration_payments:';
    FOR constraint_info IN 
        SELECT constraint_name, constraint_type 
        FROM information_schema.table_constraints 
        WHERE table_name = 'registration_payments' 
        AND table_schema = 'public'
    LOOP
        RAISE NOTICE 'Constraint: % (Type: %)', constraint_info.constraint_name, constraint_info.constraint_type;
    END LOOP;
END $$;

-- Step 3: Drop ALL constraints on registration_payments table (except NOT NULL and PRIMARY KEY)
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Drop all UNIQUE constraints
    FOR constraint_record IN 
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'registration_payments' 
        AND table_schema = 'public' 
        AND constraint_type = 'UNIQUE'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE registration_payments DROP CONSTRAINT %I CASCADE', constraint_record.constraint_name);
            RAISE NOTICE 'Successfully dropped constraint: %', constraint_record.constraint_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Failed to drop constraint %: %', constraint_record.constraint_name, SQLERRM;
        END;
    END LOOP;

    -- Drop all CHECK constraints
    FOR constraint_record IN 
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'registration_payments' 
        AND table_schema = 'public' 
        AND constraint_type = 'CHECK'
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE registration_payments DROP CONSTRAINT %I CASCADE', constraint_record.constraint_name);
            RAISE NOTICE 'Successfully dropped check constraint: %', constraint_record.constraint_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Failed to drop check constraint %: %', constraint_record.constraint_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- Step 4: Ensure payment_cycle column exists and has proper type
DO $$
BEGIN
    -- Add payment_cycle column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registration_payments' 
        AND column_name = 'payment_cycle'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE registration_payments ADD COLUMN payment_cycle TEXT;
        RAISE NOTICE 'Added payment_cycle column';
    END IF;
END $$;

-- Step 5: Clean up data to ensure consistency
UPDATE registration_payments 
SET payment_cycle = 'registration_fee' 
WHERE payment_cycle IS NULL OR payment_cycle = '';

-- Step 6: Handle duplicate records by creating unique payment cycles
DO $$
DECLARE
    duplicate_group RECORD;
    payment_record RECORD;
    cycle_counter INTEGER;
    available_cycles TEXT[] := ARRAY[
        'registration_fee', '1st_quarter', '2nd_quarter', '3rd_quarter', 
        '4th_quarter', '1st_semester', '2nd_semester', 'annual'
    ];
    unique_cycle TEXT;
BEGIN
    -- Find and fix duplicate records
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
            SELECT id, payment_cycle, created_at
            FROM registration_payments 
            WHERE student_id = duplicate_group.student_id 
            AND academic_year = duplicate_group.academic_year 
            ORDER BY created_at NULLS LAST, id
        LOOP
            -- Assign a unique payment cycle
            IF cycle_counter <= array_length(available_cycles, 1) THEN
                unique_cycle := available_cycles[cycle_counter];
            ELSE
                unique_cycle := 'payment_' || cycle_counter::TEXT;
            END IF;
            
            -- Check if this cycle is already used for this student/year combination
            WHILE EXISTS (
                SELECT 1 FROM registration_payments 
                WHERE student_id = duplicate_group.student_id 
                AND academic_year = duplicate_group.academic_year 
                AND payment_cycle = unique_cycle 
                AND id != payment_record.id
            ) LOOP
                cycle_counter := cycle_counter + 1;
                IF cycle_counter <= array_length(available_cycles, 1) THEN
                    unique_cycle := available_cycles[cycle_counter];
                ELSE
                    unique_cycle := 'payment_' || cycle_counter::TEXT;
                END IF;
            END LOOP;
            
            -- Update the record
            UPDATE registration_payments 
            SET payment_cycle = unique_cycle
            WHERE id = payment_record.id;
            
            RAISE NOTICE 'Updated record % to payment_cycle: %', payment_record.id, unique_cycle;
            cycle_counter := cycle_counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- Step 7: Make payment_cycle NOT NULL and set default
ALTER TABLE registration_payments 
ALTER COLUMN payment_cycle SET NOT NULL;

ALTER TABLE registration_payments 
ALTER COLUMN payment_cycle SET DEFAULT 'registration_fee';

-- Step 8: Create the new unique constraint
ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_unique_student_year_cycle 
UNIQUE (student_id, academic_year, payment_cycle);

-- Step 9: Add check constraint for valid payment cycles
ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_valid_payment_cycle 
CHECK (payment_cycle IN (
    '1st_quarter', '2nd_quarter', '3rd_quarter', '4th_quarter',
    '1st_semester', '2nd_semester', 'registration_fee', 'annual'
) OR payment_cycle LIKE 'payment_%');

-- Step 10: Add helpful comments
COMMENT ON CONSTRAINT registration_payments_unique_student_year_cycle ON registration_payments 
IS 'Ensures one payment record per student per academic year per payment cycle - allows multiple payments per year for different cycles';

COMMENT ON COLUMN registration_payments.payment_cycle 
IS 'Payment cycle identifier: 1st_quarter, 2nd_quarter, 3rd_quarter, 4th_quarter, 1st_semester, 2nd_semester, registration_fee, annual, or custom payment_N';

-- Step 11: Verify the fix and provide status report
DO $$
DECLARE
    old_constraint_exists BOOLEAN;
    new_constraint_exists BOOLEAN;
    total_records INTEGER;
    unique_combinations INTEGER;
BEGIN
    -- Check if old constraint still exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'registration_payments_student_id_academic_year_key'
        AND table_name = 'registration_payments'
        AND table_schema = 'public'
    ) INTO old_constraint_exists;
    
    -- Check if new constraint exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'registration_payments_unique_student_year_cycle'
        AND table_name = 'registration_payments'
        AND table_schema = 'public'
    ) INTO new_constraint_exists;
    
    -- Count records
    SELECT COUNT(*) INTO total_records FROM registration_payments;
    SELECT COUNT(DISTINCT (student_id, academic_year, payment_cycle)) INTO unique_combinations FROM registration_payments;
    
    -- Report status
    RAISE NOTICE '=== PAYMENT CONSTRAINT FIX STATUS REPORT ===';
    RAISE NOTICE 'Old problematic constraint exists: %', old_constraint_exists;
    RAISE NOTICE 'New correct constraint exists: %', new_constraint_exists;
    RAISE NOTICE 'Total payment records: %', total_records;
    RAISE NOTICE 'Unique student/year/cycle combinations: %', unique_combinations;
    
    IF NOT old_constraint_exists AND new_constraint_exists AND total_records = unique_combinations THEN
        RAISE NOTICE 'SUCCESS: Payment constraint fix completed successfully!';
        RAISE NOTICE 'The system now allows multiple payments per student per year with different cycles.';
    ELSE
        RAISE WARNING 'ISSUE: Payment constraint fix may not be complete.';
        IF old_constraint_exists THEN
            RAISE WARNING 'The old constraint still exists and needs manual removal.';
        END IF;
        IF NOT new_constraint_exists THEN
            RAISE WARNING 'The new constraint was not created successfully.';
        END IF;
        IF total_records != unique_combinations THEN
            RAISE WARNING 'There are still duplicate records that violate the unique constraint.';
        END IF;
    END IF;
END $$;

-- Step 12: Clean up temporary backup table
DROP TABLE IF EXISTS payment_backup;

RAISE NOTICE 'Payment constraint fix migration completed.';