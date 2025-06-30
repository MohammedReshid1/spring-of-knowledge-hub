
-- Drop the old problematic constraint that doesn't include payment_cycle
ALTER TABLE registration_payments 
DROP CONSTRAINT IF EXISTS registration_payments_student_id_academic_year_key;

-- Ensure the correct constraint exists (should include payment_cycle)
ALTER TABLE registration_payments 
DROP CONSTRAINT IF EXISTS registration_payments_unique_student_year_cycle;

-- Create the new constraint that allows multiple payments per student per year with different cycles
ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_unique_student_year_cycle 
UNIQUE (student_id, academic_year, payment_cycle);

-- Make sure payment_cycle column is properly configured
ALTER TABLE registration_payments 
ALTER COLUMN payment_cycle SET NOT NULL;

ALTER TABLE registration_payments 
ALTER COLUMN payment_cycle SET DEFAULT 'registration_fee';

-- Add check constraint for valid payment cycles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'registration_payments_valid_payment_cycle'
        AND table_name = 'registration_payments'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE registration_payments 
        ADD CONSTRAINT registration_payments_valid_payment_cycle 
        CHECK (payment_cycle IN (
            '1st_quarter', '2nd_quarter', '3rd_quarter', '4th_quarter',
            '1st_semester', '2nd_semester', 'registration_fee', 'annual'
        ) OR payment_cycle LIKE 'payment_%');
    END IF;
END $$;

-- Create a function to handle user creation with proper authentication
CREATE OR REPLACE FUNCTION public.create_auth_user_and_profile(
    user_email TEXT,
    user_password TEXT,
    user_full_name TEXT,
    user_role user_role DEFAULT 'registrar',
    user_phone TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    new_user_id UUID;
    result JSON;
BEGIN
    -- This function needs to be called from an edge function with admin privileges
    -- For now, just create the profile record
    INSERT INTO public.users (
        email,
        full_name,
        role,
        phone
    ) VALUES (
        user_email,
        user_full_name,
        user_role,
        user_phone
    ) RETURNING id INTO new_user_id;
    
    result := json_build_object(
        'success', true,
        'user_id', new_user_id,
        'message', 'User profile created. Admin must manually create auth account.'
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on the constraint
COMMENT ON CONSTRAINT registration_payments_unique_student_year_cycle ON registration_payments 
IS 'Allows multiple payments per student per year, one per payment cycle (registration_fee, 1st_quarter, etc.)';
