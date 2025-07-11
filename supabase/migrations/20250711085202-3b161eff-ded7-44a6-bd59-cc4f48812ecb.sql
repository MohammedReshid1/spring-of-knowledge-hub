-- Phase 1b: Update functions and RLS policies for RBAC + Branch Data Isolation

-- 1. Update get_user_accessible_branches function for new role structure
CREATE OR REPLACE FUNCTION public.get_user_accessible_branches(user_id uuid)
RETURNS TABLE(branch_id uuid, branch_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    user_role TEXT;
    user_branch_id UUID;
BEGIN
    -- Get user role and branch
    SELECT u.role, u.branch_id INTO user_role, user_branch_id
    FROM public.users u
    WHERE u.id = user_id;
    
    -- HQ roles (super_admin, hq_admin, hq_registrar) can see all branches
    IF user_role IN ('super_admin', 'hq_admin', 'hq_registrar') THEN
        RETURN QUERY
        SELECT b.id, b.name
        FROM public.branches b
        WHERE b.is_active = true
        ORDER BY b.name;
    -- Branch-restricted roles (branch_admin, registrar, admin) can only see their assigned branch
    ELSE
        RETURN QUERY
        SELECT b.id, b.name
        FROM public.branches b
        WHERE b.id = user_branch_id AND b.is_active = true;
    END IF;
END;
$function$;

-- 2. Create helper function to get current user role and branch
CREATE OR REPLACE FUNCTION public.get_current_user_info()
RETURNS TABLE(user_role TEXT, user_branch_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT u.role::TEXT, u.branch_id
    FROM public.users u
    WHERE u.id = auth.uid();
END;
$function$;

-- 3. Update RLS policies for users table
DROP POLICY IF EXISTS "users_select_all" ON public.users;
DROP POLICY IF EXISTS "users_insert_admin_only" ON public.users;
DROP POLICY IF EXISTS "users_update_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin_only" ON public.users;

-- Users table policies with new role structure
CREATE POLICY "users_select_authenticated" ON public.users
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "users_insert_hq_roles" ON public.users
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin')
    )
);

CREATE POLICY "users_update_own_or_hq" ON public.users
FOR UPDATE TO authenticated
USING (
    auth.uid() = id OR 
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin')
    )
)
WITH CHECK (
    auth.uid() = id OR 
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin')
    )
);

CREATE POLICY "users_delete_hq_roles" ON public.users
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin')
    )
);