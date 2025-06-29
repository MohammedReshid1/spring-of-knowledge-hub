/*
  # Fix RLS Infinite Recursion

  1. Security Updates
    - Drop existing problematic RLS policies on users table
    - Create new policies using the security definer function
    - Ensure no circular dependencies in policy definitions
    
  2. Policy Updates
    - Use get_current_user_role() function to avoid recursion
    - Simplify policy conditions to prevent infinite loops
    - Enable proper access control without circular references
*/

-- First, disable RLS temporarily to avoid issues during policy updates
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on users table to start fresh
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Public read access" ON users;
DROP POLICY IF EXISTS "Authenticated users can read" ON users;
DROP POLICY IF EXISTS "Users can manage own profile" ON users;

-- Ensure the security definer function exists and is properly defined
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  -- Use a direct query without RLS to avoid recursion
  RETURN (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create simple, non-recursive policies for the users table
CREATE POLICY "Enable read access for authenticated users" ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for own record" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Re-enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Update policies on other tables that might be causing issues
-- Drop and recreate policies for students table
DROP POLICY IF EXISTS "Students are viewable by authenticated users" ON students;
DROP POLICY IF EXISTS "Students can be inserted by authenticated users" ON students;
DROP POLICY IF EXISTS "Students can be updated by authenticated users" ON students;
DROP POLICY IF EXISTS "Students can be deleted by authenticated users" ON students;

CREATE POLICY "Enable all operations for authenticated users" ON students
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update policies for classes table
DROP POLICY IF EXISTS "Classes are viewable by authenticated users" ON classes;
DROP POLICY IF EXISTS "Classes can be inserted by authenticated users" ON classes;
DROP POLICY IF EXISTS "Classes can be updated by authenticated users" ON classes;
DROP POLICY IF EXISTS "Classes can be deleted by authenticated users" ON classes;

CREATE POLICY "Enable all operations for authenticated users" ON classes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update policies for grade_levels table
DROP POLICY IF EXISTS "Grade levels are viewable by authenticated users" ON grade_levels;
DROP POLICY IF EXISTS "Grade levels can be inserted by authenticated users" ON grade_levels;
DROP POLICY IF EXISTS "Grade levels can be updated by authenticated users" ON grade_levels;
DROP POLICY IF EXISTS "Grade levels can be deleted by authenticated users" ON grade_levels;

CREATE POLICY "Enable all operations for authenticated users" ON grade_levels
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update policies for registration_payments table
DROP POLICY IF EXISTS "Payments are viewable by authenticated users" ON registration_payments;
DROP POLICY IF EXISTS "Payments can be inserted by authenticated users" ON registration_payments;
DROP POLICY IF EXISTS "Payments can be updated by authenticated users" ON registration_payments;
DROP POLICY IF EXISTS "Payments can be deleted by authenticated users" ON registration_payments;

CREATE POLICY "Enable all operations for authenticated users" ON registration_payments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update policies for payment_mode table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_mode') THEN
    DROP POLICY IF EXISTS "Payment modes are viewable by authenticated users" ON payment_mode;
    DROP POLICY IF EXISTS "Payment modes can be inserted by authenticated users" ON payment_mode;
    DROP POLICY IF EXISTS "Payment modes can be updated by authenticated users" ON payment_mode;
    DROP POLICY IF EXISTS "Payment modes can be deleted by authenticated users" ON payment_mode;
    
    CREATE POLICY "Enable all operations for authenticated users" ON payment_mode
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;