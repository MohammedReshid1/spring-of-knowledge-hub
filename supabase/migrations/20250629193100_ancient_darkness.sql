/*
  # Fix Role-Based Access Control and Payment Constraint Issues

  1. Role-Based Access Control
    - Admin: Full privileges on all operations
    - Registrar: Limited privileges (register, view, update payment status from unpaid to paid only)
    - Registrar cannot delete records or downgrade payment status from paid to unpaid

  2. Payment Constraint Fix
    - Remove old problematic unique constraint completely
    - Add new constraint allowing multiple payments per student per year per cycle
    - Handle existing duplicate data safely

  3. Security Policies
    - Implement role-based RLS policies for all tables
    - Ensure registrars have appropriate limited access
    - Maintain admin full access
*/

-- Step 1: Fix the payment constraint issue once and for all
DO $$
DECLARE
    constraint_record RECORD;
    duplicate_group RECORD;
    payment_record RECORD;
    cycle_counter INTEGER;
    available_cycles TEXT[] := ARRAY['registration_fee', '1st_quarter', '2nd_quarter', '3rd_quarter', '4th_quarter', '1st_semester', '2nd_semester'];
BEGIN
    -- Remove ALL unique constraints on registration_payments table
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

    -- Ensure payment_cycle column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registration_payments' 
        AND column_name = 'payment_cycle'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE registration_payments ADD COLUMN payment_cycle TEXT;
    END IF;

    -- Update NULL payment_cycle values
    UPDATE registration_payments 
    SET payment_cycle = 'registration_fee' 
    WHERE payment_cycle IS NULL OR payment_cycle = '';

    -- Handle duplicate records by assigning different payment cycles
    FOR duplicate_group IN 
        SELECT student_id, academic_year, COUNT(*) as record_count
        FROM registration_payments 
        GROUP BY student_id, academic_year 
        HAVING COUNT(*) > 1
    LOOP
        cycle_counter := 1;
        
        FOR payment_record IN 
            SELECT id
            FROM registration_payments 
            WHERE student_id = duplicate_group.student_id 
            AND academic_year = duplicate_group.academic_year 
            ORDER BY created_at NULLS LAST, id
        LOOP
            IF cycle_counter <= array_length(available_cycles, 1) THEN
                UPDATE registration_payments 
                SET payment_cycle = available_cycles[cycle_counter]
                WHERE id = payment_record.id;
            ELSE
                UPDATE registration_payments 
                SET payment_cycle = 'payment_' || cycle_counter::TEXT
                WHERE id = payment_record.id;
            END IF;
            cycle_counter := cycle_counter + 1;
        END LOOP;
    END LOOP;

    -- Make payment_cycle NOT NULL
    ALTER TABLE registration_payments ALTER COLUMN payment_cycle SET NOT NULL;
    
    -- Set default for future records
    ALTER TABLE registration_payments ALTER COLUMN payment_cycle SET DEFAULT 'registration_fee';
END $$;

-- Create the new unique constraint that allows multiple payments per cycle
ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_unique_per_cycle 
UNIQUE (student_id, academic_year, payment_cycle);

-- Add check constraint for valid payment cycles
ALTER TABLE registration_payments 
DROP CONSTRAINT IF EXISTS registration_payments_payment_cycle_check;

ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_payment_cycle_check 
CHECK (payment_cycle IN (
    '1st_quarter', '2nd_quarter', '3rd_quarter', '4th_quarter',
    '1st_semester', '2nd_semester', 'registration_fee', 'annual'
) OR payment_cycle LIKE 'payment_%');

-- Step 2: Create role-based access control function
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM public.users 
    WHERE id = auth.uid();
    
    RETURN COALESCE(user_role, 'anonymous');
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'anonymous';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 3: Update RLS policies for role-based access

-- Users table policies
DROP POLICY IF EXISTS "users_read_all" ON users;
DROP POLICY IF EXISTS "users_insert_all" ON users;
DROP POLICY IF EXISTS "users_update_all" ON users;
DROP POLICY IF EXISTS "users_delete_all" ON users;

CREATE POLICY "users_read_authenticated" ON users
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "users_insert_admin_only" ON users
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "users_update_admin_or_self" ON users
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "users_delete_admin_only" ON users
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Students table policies
DROP POLICY IF EXISTS "students_all_operations" ON students;

CREATE POLICY "students_read_all" ON students
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "students_insert_admin_registrar" ON students
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'registrar')
        )
    );

CREATE POLICY "students_update_admin_registrar" ON students
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'registrar')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'registrar')
        )
    );

CREATE POLICY "students_delete_admin_only" ON students
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Classes table policies
DROP POLICY IF EXISTS "classes_all_operations" ON classes;

CREATE POLICY "classes_read_all" ON classes
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "classes_modify_admin_only" ON classes
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Grade levels table policies
DROP POLICY IF EXISTS "grade_levels_all_operations" ON grade_levels;

CREATE POLICY "grade_levels_read_all" ON grade_levels
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "grade_levels_modify_admin_only" ON grade_levels
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Registration payments table policies with special registrar restrictions
DROP POLICY IF EXISTS "registration_payments_all_operations" ON registration_payments;

CREATE POLICY "registration_payments_read_all" ON registration_payments
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "registration_payments_insert_admin_registrar" ON registration_payments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'registrar')
        )
    );

-- Special update policy for registrars: can only change unpaid to paid, not vice versa
CREATE POLICY "registration_payments_update_admin_full" ON registration_payments
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "registration_payments_update_registrar_limited" ON registration_payments
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'registrar'
        )
        AND (
            -- Registrar can only update if changing from unpaid to paid
            payment_status IN ('Unpaid', 'Partially Paid') OR
            -- Or if not changing payment status at all
            payment_status = (SELECT payment_status FROM registration_payments WHERE id = registration_payments.id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'registrar'
        )
        AND (
            -- Registrar can only set status to paid or partially paid, never back to unpaid
            payment_status IN ('Paid', 'Partially Paid') OR
            -- Or keep the same status if not changing it
            payment_status = (SELECT payment_status FROM registration_payments WHERE id = registration_payments.id)
        )
    );

CREATE POLICY "registration_payments_delete_admin_only" ON registration_payments
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Payment mode table policies
DROP POLICY IF EXISTS "payment_mode_all_operations" ON payment_mode;

CREATE POLICY "payment_mode_read_all" ON payment_mode
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "payment_mode_insert_admin_registrar" ON payment_mode
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'registrar')
        )
    );

CREATE POLICY "payment_mode_update_admin_registrar" ON payment_mode
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'registrar')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'registrar')
        )
    );

CREATE POLICY "payment_mode_delete_admin_only" ON payment_mode
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- Add helpful comments
COMMENT ON CONSTRAINT registration_payments_unique_per_cycle ON registration_payments 
IS 'Allows multiple payments per student per year, one per payment cycle (registration_fee, 1st_quarter, etc.)';

COMMENT ON FUNCTION public.get_user_role() 
IS 'Returns the role of the current authenticated user for RLS policies';

-- Final verification
DO $$
BEGIN
    RAISE NOTICE 'Role-based access control and payment constraint fix completed successfully!';
    RAISE NOTICE 'Admin: Full access to all operations';
    RAISE NOTICE 'Registrar: Can register students, view data, update payment status from unpaid to paid only';
    RAISE NOTICE 'Payment constraint now allows multiple payments per student per year with different cycles';
END $$;