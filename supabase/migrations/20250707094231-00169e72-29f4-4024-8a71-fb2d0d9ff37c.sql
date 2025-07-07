
-- Fix the admin_cleanup_table function to properly handle student deletion
CREATE OR REPLACE FUNCTION public.admin_cleanup_table(table_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
      DELETE FROM students WHERE id IS NOT NULL;
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    WHEN 'users' THEN
      DELETE FROM users WHERE role != 'super_admin';
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    WHEN 'classes' THEN
      DELETE FROM classes WHERE id IS NOT NULL;
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    WHEN 'payment_records' THEN
      DELETE FROM registration_payments WHERE id IS NOT NULL;
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    WHEN 'attendance' THEN
      DELETE FROM attendance WHERE id IS NOT NULL;
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    WHEN 'all_data' THEN
      DELETE FROM attendance WHERE id IS NOT NULL;
      DELETE FROM student_enrollments WHERE id IS NOT NULL;
      DELETE FROM registration_payments WHERE id IS NOT NULL;
      DELETE FROM fees WHERE id IS NOT NULL;
      DELETE FROM students WHERE id IS NOT NULL;
      DELETE FROM classes WHERE id IS NOT NULL;
      DELETE FROM users WHERE role != 'super_admin';
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
    ELSE
      RAISE EXCEPTION 'Invalid table name for cleanup operation';
  END CASE;

  RETURN deleted_count;
END;
$function$;

-- Update the grade_level enum to include KG and PREP
ALTER TYPE grade_level ADD VALUE IF NOT EXISTS 'kg' AFTER 'pre_k';
ALTER TYPE grade_level ADD VALUE IF NOT EXISTS 'prep' AFTER 'kg';

-- Update the get_next_grade_level function to handle the new grade levels
CREATE OR REPLACE FUNCTION public.get_next_grade_level(current_grade grade_level)
RETURNS grade_level
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  CASE current_grade
    WHEN 'pre_k' THEN RETURN 'kg';
    WHEN 'kg' THEN RETURN 'prep';
    WHEN 'prep' THEN RETURN 'kindergarten';
    WHEN 'kindergarten' THEN RETURN 'grade_1';
    WHEN 'grade_1' THEN RETURN 'grade_2';
    WHEN 'grade_2' THEN RETURN 'grade_3';
    WHEN 'grade_3' THEN RETURN 'grade_4';
    WHEN 'grade_4' THEN RETURN 'grade_5';
    WHEN 'grade_5' THEN RETURN 'grade_6';
    WHEN 'grade_6' THEN RETURN 'grade_7';
    WHEN 'grade_7' THEN RETURN 'grade_8';
    WHEN 'grade_8' THEN RETURN 'grade_9';
    WHEN 'grade_9' THEN RETURN 'grade_10';
    WHEN 'grade_10' THEN RETURN 'grade_11';
    WHEN 'grade_11' THEN RETURN 'grade_12';
    WHEN 'grade_12' THEN RETURN NULL; -- Graduation
    ELSE RETURN NULL;
  END CASE;
END;
$function$;
