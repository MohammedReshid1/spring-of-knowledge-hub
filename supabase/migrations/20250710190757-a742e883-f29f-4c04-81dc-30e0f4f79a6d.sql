-- Fix the ambiguous column reference in get_user_accessible_branches function
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
    
    -- Super admins and admins can see all branches
    IF user_role IN ('super_admin', 'admin') THEN
        RETURN QUERY
        SELECT b.id, b.name
        FROM public.branches b
        WHERE b.is_active = true
        ORDER BY b.name;
    ELSE
        -- Other users can only see their assigned branch
        RETURN QUERY
        SELECT b.id, b.name
        FROM public.branches b
        WHERE b.id = user_branch_id AND b.is_active = true;
    END IF;
END;
$function$