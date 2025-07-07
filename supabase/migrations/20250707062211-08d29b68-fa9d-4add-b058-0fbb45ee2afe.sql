-- Add cascade deletion for student-related records
-- This will automatically delete related records when a student is deleted

-- Update foreign key constraints to cascade delete
ALTER TABLE registration_payments 
DROP CONSTRAINT IF EXISTS registration_payments_student_id_fkey;

ALTER TABLE registration_payments 
ADD CONSTRAINT registration_payments_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE attendance 
DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;

ALTER TABLE attendance 
ADD CONSTRAINT attendance_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE student_enrollments 
DROP CONSTRAINT IF EXISTS student_enrollments_student_id_fkey;

ALTER TABLE student_enrollments 
ADD CONSTRAINT student_enrollments_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE fees 
DROP CONSTRAINT IF EXISTS fees_student_id_fkey;

ALTER TABLE fees 
ADD CONSTRAINT fees_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- Create a function for super admin to clean database tables
CREATE OR REPLACE FUNCTION public.admin_cleanup_table(table_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Only allow super_admin to execute this function
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admin can perform database cleanup operations';
  END IF;

  -- Execute delete based on table name
  CASE table_name
    WHEN 'students' THEN
      DELETE FROM students;
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    WHEN 'users' THEN
      DELETE FROM users WHERE role != 'super_admin';
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    WHEN 'classes' THEN
      DELETE FROM classes;
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    WHEN 'payment_records' THEN
      DELETE FROM registration_payments;
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    WHEN 'attendance' THEN
      DELETE FROM attendance;
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    WHEN 'all_data' THEN
      DELETE FROM attendance;
      DELETE FROM student_enrollments;
      DELETE FROM registration_payments;
      DELETE FROM fees;
      DELETE FROM students;
      DELETE FROM classes;
      DELETE FROM users WHERE role != 'super_admin';
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    ELSE
      RAISE EXCEPTION 'Invalid table name for cleanup operation';
  END CASE;

  RETURN deleted_count;
END;
$$;