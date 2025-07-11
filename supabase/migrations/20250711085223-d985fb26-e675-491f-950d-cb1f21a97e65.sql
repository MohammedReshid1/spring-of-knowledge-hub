-- Phase 1c: Branch isolation RLS policies for data tables

-- 1. Update RLS policies for students table with branch isolation
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

-- 2. Update RLS policies for classes table with branch isolation
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