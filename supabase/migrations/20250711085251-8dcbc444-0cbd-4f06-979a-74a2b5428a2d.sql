-- Phase 1d: Complete branch isolation RLS policies

-- 1. Update RLS policies for registration_payments table with branch isolation
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

-- 2. Update RLS policies for attendance table with branch isolation
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

-- 3. Update RLS policies for fees table with branch isolation
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