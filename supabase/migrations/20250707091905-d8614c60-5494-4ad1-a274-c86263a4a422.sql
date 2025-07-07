
-- Update the create_database_backup function to fix file_path ambiguity
CREATE OR REPLACE FUNCTION public.create_database_backup(backup_type text DEFAULT 'manual'::text, backup_method text DEFAULT 'full'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  backup_id UUID;
  table_names TEXT[];
  table_name TEXT;
  backup_data JSONB := '{}';
  temp_data JSONB;
  total_records INTEGER := 0;
  file_path TEXT;
  backup_content TEXT;
BEGIN
  -- Only allow admin and super_admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to create backups';
  END IF;

  -- Create backup log entry
  INSERT INTO backup_logs (backup_type, backup_method, performed_by)
  VALUES (backup_type, backup_method, auth.uid())
  RETURNING id INTO backup_id;

  -- Get all table names to backup
  table_names := ARRAY['students', 'users', 'classes', 'registration_payments', 
                       'attendance', 'fees', 'student_enrollments', 'grade_levels', 
                       'subjects', 'grade_transitions'];

  -- Backup each table
  FOR table_name IN SELECT unnest(table_names) LOOP
    EXECUTE format('
      SELECT jsonb_agg(to_jsonb(t)) 
      FROM %I t
    ', table_name) INTO temp_data;
    
    backup_data := backup_data || jsonb_build_object(table_name, temp_data);
    
    -- Count records
    EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO temp_data;
    total_records := total_records + (temp_data::TEXT)::INTEGER;
  END LOOP;

  -- Prepare backup content with metadata
  backup_content := jsonb_build_object(
    'backup_id', backup_id,
    'backup_type', backup_type,
    'backup_method', backup_method,
    'created_at', now(),
    'total_records', total_records,
    'tables', backup_data
  )::TEXT;

  -- Generate file path
  file_path := 'backup_' || backup_id::TEXT || '_' || EXTRACT(epoch FROM now())::TEXT || '.json';

  -- Update backup log with file info (use explicit table alias to avoid ambiguity)
  UPDATE backup_logs bl
  SET 
    status = 'completed',
    completed_at = now(),
    file_path = file_path,
    file_size = length(backup_content::TEXT),
    tables_backed_up = table_names,
    records_count = total_records
  WHERE bl.id = backup_id;

  -- Note: In a real implementation, you would save backup_content to Supabase Storage
  -- For now, we're just logging the backup with a file path reference
  RAISE NOTICE 'Backup created with ID: %, File path: %, Size: % bytes', backup_id, file_path, length(backup_content::TEXT);

  RETURN backup_id;
END;
$$;
