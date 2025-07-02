-- Fix infinite recursion by dropping problematic policies and using security definer function

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "users_admin_manage" ON users;
DROP POLICY IF EXISTS "users_all_read_own" ON users;

-- Update the security definer function to properly get user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Use SECURITY DEFINER to bypass RLS and avoid recursion
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create non-recursive policies using the security definer function
CREATE POLICY "users_select_all" ON users
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "users_insert_admin_only" ON users
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "users_update_own_or_admin" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR get_current_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (auth.uid() = id OR get_current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "users_delete_admin_only" ON users
  FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('admin', 'super_admin'));