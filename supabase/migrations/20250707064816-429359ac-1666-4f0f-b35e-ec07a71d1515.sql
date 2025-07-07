-- Add birth certificate field to students table
ALTER TABLE students ADD COLUMN birth_certificate_url TEXT;

-- Add birth certificate storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('birth-certificates', 'birth-certificates', false);

-- Create storage policies for birth certificates
CREATE POLICY "Users can view birth certificates they have access to" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'birth-certificates' AND 
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin', 'registrar')
  )
);

CREATE POLICY "Users can upload birth certificates" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'birth-certificates' AND 
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin', 'registrar')
  )
);

CREATE POLICY "Users can update birth certificates" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'birth-certificates' AND 
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin', 'registrar')
  )
);

CREATE POLICY "Users can delete birth certificates" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'birth-certificates' AND 
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin', 'registrar')
  )
);

-- Create backup logs table
CREATE TABLE public.backup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_type TEXT NOT NULL, -- 'manual', 'automatic'
  backup_method TEXT NOT NULL, -- 'full', 'incremental'
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
  file_path TEXT,
  file_size BIGINT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  performed_by UUID REFERENCES auth.users(id),
  error_message TEXT,
  tables_backed_up TEXT[],
  records_count INTEGER
);

-- Enable RLS on backup_logs
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for backup logs (admin/super_admin only)
CREATE POLICY "Only admins can manage backup logs" 
ON public.backup_logs 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- Create backup storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('system-backups', 'system-backups', false);

-- Create storage policies for backups (super admin only)
CREATE POLICY "Super admins can manage backup files" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id = 'system-backups' AND 
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Function to create database backup
CREATE OR REPLACE FUNCTION public.create_database_backup(
  backup_type TEXT DEFAULT 'manual',
  backup_method TEXT DEFAULT 'full'
)
RETURNS UUID
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

  -- Update backup log
  UPDATE backup_logs 
  SET 
    status = 'completed',
    completed_at = now(),
    tables_backed_up = table_names,
    records_count = total_records
  WHERE id = backup_id;

  RETURN backup_id;
END;
$$;

-- Function to schedule automatic backups (to be called by cron or edge function)
CREATE OR REPLACE FUNCTION public.should_create_automatic_backup()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM backup_logs 
    WHERE backup_type = 'automatic' 
    AND status = 'completed'
    AND started_at > (now() - INTERVAL '14 days')
  );
$$;