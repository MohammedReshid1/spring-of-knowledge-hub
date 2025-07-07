
-- Create function to delete backup logs
CREATE OR REPLACE FUNCTION public.delete_backup_log(backup_log_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
BEGIN
  -- Only allow admin and super_admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to delete backups';
  END IF;

  -- Delete the backup log
  DELETE FROM backup_logs WHERE id = backup_log_id;
  
  -- Return true if deletion was successful
  RETURN FOUND;
END;
$$;
