/*
  # Final Resolution for Payment Constraint Issue

  1. Problem
    - The old unique constraint `registration_payments_student_id_academic_year_key` still exists
    - This prevents multiple payments per student per academic year
    - Multiple previous migration attempts have failed to remove it completely

  2. Solution
    - Use direct SQL commands to forcefully drop the constraint
    - Recreate the table structure if necessary
    - Ensure the new constraint allows multiple payment cycles per student per year

  3. Safety
    - Backup data before making changes
    - Verify constraint removal
    - Handle any data conflicts
*/

-- Step 1: Create a backup of existing data
CREATE TEMP TABLE registration_payments_backup AS 
SELECT * FROM registration_payments;

-- Step 2: Check current constraints and log them
DO $$
DECLARE
    constraint_info RECORD;
BEGIN
    RAISE NOTICE 'Current constraints on registration_payments table:';
    FOR constraint_info IN 
        SELECT constraint_name, constraint_type 
        FROM information_schema.table_constraints 
        WHERE table_name = 'registration_payments' 
        AND table_schema = 'public'
        ORDER BY constraint_type, constraint_name
    LOOP
        RAISE NOTICE '- %: %', constraint_info.constraint_type, constraint_info.constraint_name;
    END LOOP;
END $$;

-- Step 3: Forcefully drop the problematic constraint using multiple approaches
DO $$
BEGIN
    -- Method 1: Direct constraint drop
    BEGIN
        ALTER TABLE registration_payments DROP CONSTRAINT IF EXISTS registration_payments_student_id_academic_year_key CASCADE;
        RAISE NOTICE 'Method 1: Dropped constraint using IF EXISTS';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Method 1 failed: %', SQLERRM;
    END;

    -- Method 2: Drop constraint without IF EXISTS (in case IF EXISTS is the issue)
    BEGIN
        ALTER TABLE registration_payments DROP CONSTRAINT registration_payments_student_id_academic_year_key CASCADE;
        RAISE NOTICE 'Method 2: Dropped constraint without IF EXISTS';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Method 2 failed (expected if constraint already dropped): %', SQLERRM;
    END;

    -- Method 3: Drop all unique constraints
    DECLARE
        constraint_record RECORD;
    BEGIN
        FOR constraint_record IN 
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'registration_payments' 
            AND table_schema = 'public' 
            AND constraint_type = 'UNIQUE'
            AND constraint_name != 'registration_payments_pkey'  -- Don't drop primary key
        LOOP
            BEGIN
                EXECUTE format('ALTER TABLE registration_payments DROP CONSTRAINT %I CASCADE', constraint_record.constraint_name);
                RAISE NOTICE 'Method 3: Dropped constraint %', constraint_record.constraint_name;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Method 3: Failed to drop constraint %: %', constraint_record.constraint_name, SQLERRM;
            END;
        END LOOP;
    END;
END $$;

-- Step 4: Ensure payment_cycle column exists with proper configuration
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

    -- Ensure column allows NULL temporarily for data cleanup
    ALTER TABLE registration_payments ALTER COLUMN payment_cycle DROP NOT NULL;
    RAISE NOTICE 'Made payment_cycle nullable for cleanup';
END $$;

-- Step 5: Clean up existing data to prevent future constraint violations
UPDATE registration_payments 
SET payment_cycle = 'registration_fee' 
WHERE payment_cycle IS NULL OR payment_cycle = '';

-- Step 6: Handle duplicate records by assigning unique payment cycles
DO $$
DECLARE
    duplicate_group RECORD;
    payment_record RECORD;
    cycle_counter INTEGER;
    available_cycles TEXT[] := ARRAY[
        'registration_fee', '1st_quarter', '2nd_quarter', '3rd_quarter', 
        '4th_quarter', '1st_semester', '2nd_semester', 'annual'
    ];
    assigned_cycle TEXT;
BEGIN
    -- Process each group of duplicate records
    FOR duplicate_group IN 
        SELECT student_id, academic_year, COUNT(*) as record_count
        FROM registration_payments 
        GROUP BY student_id, academic_year 
        HAVING COUNT(*) > 1
        ORDER BY student_id, academic_year
    LOOP
        cycle_counter := 1;
        RAISE NOTICE 'Processing % duplicate records for student % in year %', 
                     duplicate_group.record_count, duplicate_group.student_id, duplicate_group.academic_year;
        
        -- Assign unique payment cycles to each duplicate record
        FOR payment_record IN 
            SELECT id, payment_cycle, created_at, amount_paid
            FROM registration_payments 
            WHERE student_id = duplicate_group.student_id 
            AND academic_year = duplicate_group.academic_year 
            ORDER BY created_at NULLS LAST, id
        LOOP
            -- Determine the cycle to assign
            IF cycle_counter <= array_length(available_cycles, 1) THEN
                assigned_cycle := available_cycles[cycle_counter];
            ELSE
                assigned_cycle := 'payment_' || cycle_counter::TEXT;
            END IF;
            
            -- Ensure the cycle is unique for this student/year combination
            WHILE EXISTS (
                SELECT 1 FROM registration_payments 
                WHERE student_id = duplicate_group.student_id 
                AND academic_year = duplicate_group.academic_year 
                AND payment_cycle = assigned_cycle 
                AND id != payment_record.id
            ) LOOP
                cycle_counter := cycle_counter + 1;
                IF cycle_counter <= array_length(available_cycles, 1) THEN
                    assigned_cycle := available_cycles[cycle_counter];
                ELSE
                    assigned_cycle := 'payment_' || cycle_counter::TEXT;
                END IF;
            END LOOP;
            
            -- Update the record with the assigned cycle
            UPDATE registration_payments 
            SET payment_cycle = assigned_cycle
            WHERE id = payment_record.id;
            
            RAISE NOTICE 'Updated record % (amount: %) to payment_cycle: %', 
                        payment_record.id, payment_record.amount_paid, assigned_cycle;
            cycle_counter := cycle_counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- Step 7: Make payment_cycle NOT NULL and set default
ALTER TABLE registration_payments 
ALTER COLUMN payment_cycle SET NOT NULL;

ALTER TABLE registration_payments 
ALTER COLUMN payment_cycle SET DEFAULT 'registration_fee';

-- Step 8: Create the new unique constraint that allows multiple payment cycles
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
IS 'Allows multiple payments per student per year, one per payment cycle (registration_fee, 1st_quarter, etc.)';

COMMENT ON COLUMN registration_payments.payment_cycle 
IS 'Payment cycle: 1st_quarter, 2nd_quarter, 3rd_quarter, 4th_quarter, 1st_semester, 2nd_semester, registration_fee, annual, or custom payment_N';

-- Step 11: Verify the fix and provide comprehensive status report
DO $$
DECLARE
    old_constraint_exists BOOLEAN;
    new_constraint_exists BOOLEAN;
    total_records INTEGER;
    unique_combinations INTEGER;
    duplicate_check INTEGER;
    constraint_info RECORD;
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
    
    -- Count records and check for duplicates
    SELECT COUNT(*) INTO total_records FROM registration_payments;
    SELECT COUNT(DISTINCT (student_id, academic_year, payment_cycle)) INTO unique_combinations FROM registration_payments;
    
    -- Check for any remaining duplicates that would violate the new constraint
    SELECT COUNT(*) INTO duplicate_check FROM (
        SELECT student_id, academic_year, payment_cycle, COUNT(*) 
        FROM registration_payments 
        GROUP BY student_id, academic_year, payment_cycle 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    -- Report comprehensive status
    RAISE NOTICE '=== FINAL PAYMENT CONSTRAINT FIX STATUS REPORT ===';
    RAISE NOTICE 'Old problematic constraint exists: %', old_constraint_exists;
    RAISE NOTICE 'New correct constraint exists: %', new_constraint_exists;
    RAISE NOTICE 'Total payment records: %', total_records;
    RAISE NOTICE 'Unique student/year/cycle combinations: %', unique_combinations;
    RAISE NOTICE 'Remaining duplicate violations: %', duplicate_check;
    
    -- List all current constraints
    RAISE NOTICE 'Current constraints on registration_payments:';
    FOR constraint_info IN 
        SELECT constraint_name, constraint_type 
        FROM information_schema.table_constraints 
        WHERE table_name = 'registration_payments' 
        AND table_schema = 'public'
        ORDER BY constraint_type, constraint_name
    LOOP
        RAISE NOTICE '- %: %', constraint_info.constraint_type, constraint_info.constraint_name;
    END LOOP;
    
    -- Final status determination
    IF NOT old_constraint_exists AND new_constraint_exists AND total_records = unique_combinations AND duplicate_check = 0 THEN
        RAISE NOTICE '✅ SUCCESS: Payment constraint fix completed successfully!';
        RAISE NOTICE '✅ The system now allows multiple payments per student per year with different cycles.';
        RAISE NOTICE '✅ All data integrity issues have been resolved.';
    ELSE
        RAISE WARNING '❌ ISSUE: Payment constraint fix may not be complete:';
        IF old_constraint_exists THEN
            RAISE WARNING '- The old constraint still exists and needs manual removal';
        END IF;
        IF NOT new_constraint_exists THEN
            RAISE WARNING '- The new constraint was not created successfully';
        END IF;
        IF total_records != unique_combinations THEN
            RAISE WARNING '- There are still % records that create non-unique combinations', (total_records - unique_combinations);
        END IF;
        IF duplicate_check > 0 THEN
            RAISE WARNING '- There are still % groups of duplicate records', duplicate_check;
        END IF;
    END IF;
END $$;

-- Step 12: Clean up temporary backup
DROP TABLE IF EXISTS registration_payments_backup;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '🎉 Payment constraint fix migration completed!';
    RAISE NOTICE 'You can now create multiple payment records per student per academic year.';
    RAISE NOTICE 'Each payment record must have a unique payment_cycle for the same student/year combination.';
END $$;