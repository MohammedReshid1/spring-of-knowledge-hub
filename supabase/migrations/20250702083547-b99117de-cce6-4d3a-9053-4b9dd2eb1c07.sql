
-- Fix role-based access control by updating RLS policies

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "registration_payments_all_authenticated" ON registration_payments;
DROP POLICY IF EXISTS "students_all_authenticated" ON students;
DROP POLICY IF EXISTS "users_insert_authenticated" ON users;
DROP POLICY IF EXISTS "users_select_authenticated" ON users;

-- Create proper role-based policies for registration_payments
CREATE POLICY "registration_payments_admin_all" ON registration_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "registration_payments_registrar_read" ON registration_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'registrar')
  );

CREATE POLICY "registration_payments_registrar_insert" ON registration_payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'registrar')
  );

-- Create proper role-based policies for students
CREATE POLICY "students_admin_all" ON students
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "students_registrar_read_create" ON students
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('registrar', 'admin', 'super_admin'))
  );

CREATE POLICY "students_registrar_insert" ON students
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('registrar', 'admin', 'super_admin'))
  );

-- Update users table policies to be more restrictive
CREATE POLICY "users_admin_manage" ON users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "users_all_read_own" ON users
  FOR SELECT USING (
    id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
