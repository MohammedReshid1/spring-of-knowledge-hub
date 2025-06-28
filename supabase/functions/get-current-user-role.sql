
-- Create security definer function to avoid infinite recursion in RLS
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Update any policies that might be causing recursion
-- This function can be used in RLS policies without causing infinite loops
