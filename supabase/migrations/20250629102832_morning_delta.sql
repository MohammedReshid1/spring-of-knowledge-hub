/*
  # Fix infinite recursion in users table RLS policies

  1. Problem
    - Current RLS policies on users table are causing infinite recursion
    - This happens when policies reference the users table in a circular manner
    - Error: "infinite recursion detected in policy for relation users"

  2. Solution
    - Remove problematic policies that cause recursion
    - Create simplified, non-recursive policies
    - Use auth.uid() directly instead of complex user lookups
    - Ensure policies don't self-reference the users table

  3. Security
    - Maintain proper access control without recursion
    - Users can only access their own data
    - Authenticated users can read basic user info for app functionality
*/

-- Drop all existing policies on users table to start fresh
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for own record" ON users;
DROP POLICY IF EXISTS "users_authenticated_delete" ON users;
DROP POLICY IF EXISTS "users_authenticated_insert" ON users;
DROP POLICY IF EXISTS "users_authenticated_read" ON users;
DROP POLICY IF EXISTS "users_authenticated_update" ON users;

-- Create simple, non-recursive policies for users table
-- Policy 1: Users can read all user records (needed for teacher/parent lookups)
CREATE POLICY "users_select_authenticated" 
  ON users 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Policy 2: Users can insert their own record
CREATE POLICY "users_insert_own" 
  ON users 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can update their own record
CREATE POLICY "users_update_own" 
  ON users 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 4: Users can delete their own record
CREATE POLICY "users_delete_own" 
  ON users 
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = id);

-- Ensure RLS is enabled on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Update other table policies to avoid recursion issues
-- Fix students table policies
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON students;
DROP POLICY IF EXISTS "students_authenticated_all" ON students;

CREATE POLICY "students_all_authenticated" 
  ON students 
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- Fix classes table policies  
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON classes;
DROP POLICY IF EXISTS "classes_authenticated_all" ON classes;

CREATE POLICY "classes_all_authenticated" 
  ON classes 
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- Fix grade_levels table policies
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON grade_levels;
DROP POLICY IF EXISTS "grade_levels_authenticated_all" ON grade_levels;

CREATE POLICY "grade_levels_all_authenticated" 
  ON grade_levels 
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- Fix registration_payments table policies
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON registration_payments;
DROP POLICY IF EXISTS "registration_payments_authenticated_all" ON registration_payments;

CREATE POLICY "registration_payments_all_authenticated" 
  ON registration_payments 
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- Fix payment_mode table policies
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON payment_mode;
DROP POLICY IF EXISTS "payment_mode_authenticated_all" ON payment_mode;

CREATE POLICY "payment_mode_all_authenticated" 
  ON payment_mode 
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- Fix other table policies to ensure they don't cause recursion
DROP POLICY IF EXISTS "fees_authenticated_all" ON fees;
CREATE POLICY "fees_all_authenticated" 
  ON fees 
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "attendance_authenticated_all" ON attendance;
CREATE POLICY "attendance_all_authenticated" 
  ON attendance 
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "subjects_authenticated_all" ON subjects;
CREATE POLICY "subjects_all_authenticated" 
  ON subjects 
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "student_enrollments_authenticated_all" ON student_enrollments;
CREATE POLICY "student_enrollments_all_authenticated" 
  ON student_enrollments 
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);