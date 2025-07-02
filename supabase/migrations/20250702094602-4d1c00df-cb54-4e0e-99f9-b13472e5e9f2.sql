-- Update the specific user to be super_admin
UPDATE public.users 
SET role = 'super_admin' 
WHERE email = 'swifteasesolutions@gmail.com';

-- Add a constraint to ensure only one super admin exists
CREATE OR REPLACE FUNCTION enforce_single_super_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'super_admin' THEN
    -- Check if there's already a super admin
    IF EXISTS (
      SELECT 1 FROM public.users 
      WHERE role = 'super_admin' 
      AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Only one super admin is allowed in the system';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single super admin
DROP TRIGGER IF EXISTS enforce_single_super_admin_trigger ON public.users;
CREATE TRIGGER enforce_single_super_admin_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_super_admin();