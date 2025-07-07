-- Update automatic backup frequency from 14 days to 7 days
CREATE OR REPLACE FUNCTION public.should_create_automatic_backup()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM backup_logs 
    WHERE backup_type = 'automatic' 
    AND status = 'completed'
    AND started_at > (now() - INTERVAL '7 days')
  );
$function$;