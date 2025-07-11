-- Phase 1: Database Foundation - Complete RBAC + Branch Data Isolation

-- 1. Update user role enum to include all 5 roles
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hq_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'branch_admin'; 
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hq_registrar';

-- 2. Update get_user_accessible_branches function for new role structure
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

-- 3. Create helper function to get current user role and branch
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

-- 4. Update RLS policies for users table
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

-- 5. Update RLS policies for students table with branch isolation
DROP POLICY IF EXISTS "students_admin_all" ON public.students;
DROP POLICY IF EXISTS "students_registrar_read_create" ON public.students;
DROP POLICY IF EXISTS "students_registrar_insert" ON public.students;

CREATE POLICY "students_hq_roles_all" ON public.students
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin', 'hq_registrar')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin', 'hq_registrar')
    )
);

CREATE POLICY "students_branch_roles_own_branch" ON public.students
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('branch_admin', 'registrar', 'admin')
        AND (students.branch_id = u.branch_id OR students.branch_id IS NULL)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('branch_admin', 'registrar', 'admin')
        AND (students.branch_id = u.branch_id OR students.branch_id IS NULL)
    )
);

-- 6. Update RLS policies for classes table with branch isolation
DROP POLICY IF EXISTS "classes_all_authenticated" ON public.classes;

CREATE POLICY "classes_hq_roles_all" ON public.classes
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin', 'hq_registrar')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin', 'hq_registrar')
    )
);

CREATE POLICY "classes_branch_roles_own_branch" ON public.classes
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('branch_admin', 'registrar', 'admin')
        AND (classes.branch_id = u.branch_id OR classes.branch_id IS NULL)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('branch_admin', 'registrar', 'admin')
        AND (classes.branch_id = u.branch_id OR classes.branch_id IS NULL)
    )
);

-- 7. Update RLS policies for registration_payments table with branch isolation
DROP POLICY IF EXISTS "registration_payments_admin_all" ON public.registration_payments;
DROP POLICY IF EXISTS "registration_payments_registrar_read" ON public.registration_payments;
DROP POLICY IF EXISTS "registration_payments_registrar_insert" ON public.registration_payments;

CREATE POLICY "payments_hq_roles_all" ON public.registration_payments
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin', 'hq_registrar')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin', 'hq_registrar')
    )
);

CREATE POLICY "payments_branch_roles_own_branch" ON public.registration_payments
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('branch_admin', 'registrar', 'admin')
        AND (registration_payments.branch_id = u.branch_id OR registration_payments.branch_id IS NULL)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('branch_admin', 'registrar', 'admin')
        AND (registration_payments.branch_id = u.branch_id OR registration_payments.branch_id IS NULL)
    )
);

-- 8. Update RLS policies for attendance table with branch isolation
DROP POLICY IF EXISTS "attendance_all_authenticated" ON public.attendance;

CREATE POLICY "attendance_hq_roles_all" ON public.attendance
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin', 'hq_registrar')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin', 'hq_registrar')
    )
);

CREATE POLICY "attendance_branch_roles_own_branch" ON public.attendance
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('branch_admin', 'registrar', 'admin')
        AND (attendance.branch_id = u.branch_id OR attendance.branch_id IS NULL)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('branch_admin', 'registrar', 'admin')
        AND (attendance.branch_id = u.branch_id OR attendance.branch_id IS NULL)
    )
);

-- 9. Update RLS policies for fees table with branch isolation
DROP POLICY IF EXISTS "fees_all_authenticated" ON public.fees;

CREATE POLICY "fees_hq_roles_all" ON public.fees
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin', 'hq_registrar')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'hq_admin', 'hq_registrar')
    )
);

CREATE POLICY "fees_branch_roles_own_branch" ON public.fees
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('branch_admin', 'registrar', 'admin')
        AND (fees.branch_id = u.branch_id OR fees.branch_id IS NULL)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() 
        AND u.role IN ('branch_admin', 'registrar', 'admin')
        AND (fees.branch_id = u.branch_id OR fees.branch_id IS NULL)
    )
);