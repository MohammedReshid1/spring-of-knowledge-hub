-- Secure students table RLS and add branch auto-assignment
BEGIN;

-- Ensure RLS is enabled on students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive or legacy policies on students
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.students;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.students;
DROP POLICY IF EXISTS "Enable read access for all authenticated" ON public.students;
DROP POLICY IF EXISTS "students_all_authenticated" ON public.students;
DROP POLICY IF EXISTS "students_select_authenticated" ON public.students;
DROP POLICY IF EXISTS "students_branch_roles_own_branch" ON public.students;
DROP POLICY IF EXISTS "students_hq_roles_all" ON public.students;
DROP POLICY IF EXISTS "students_select_hq_roles_all" ON public.students;
DROP POLICY IF EXISTS "students_select_branch_roles_own_branch" ON public.students;
DROP POLICY IF EXISTS "students_insert_hq_roles" ON public.students;
DROP POLICY IF EXISTS "students_insert_branch_roles_own_branch" ON public.students;
DROP POLICY IF EXISTS "students_update_hq_roles" ON public.students;
DROP POLICY IF EXISTS "students_update_branch_roles_own_branch" ON public.students;
DROP POLICY IF EXISTS "students_delete_hq_roles" ON public.students;
DROP POLICY IF EXISTS "students_delete_branch_roles_own_branch" ON public.students;

-- Recreate precise, least-privilege policies
-- 1) SELECT policies
CREATE POLICY "students_select_hq_roles_all"
ON public.students
FOR SELECT
USING (
  public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
);

CREATE POLICY "students_select_branch_roles_own_branch"
ON public.students
FOR SELECT
USING (
  public.get_current_user_role() IN ('branch_admin','registrar','admin')
  AND branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
);

-- 2) INSERT policies
CREATE POLICY "students_insert_hq_roles"
ON public.students
FOR INSERT
WITH CHECK (
  public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
);

CREATE POLICY "students_insert_branch_roles_own_branch"
ON public.students
FOR INSERT
WITH CHECK (
  public.get_current_user_role() IN ('branch_admin','registrar','admin')
  AND branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
);

-- 3) UPDATE policies
CREATE POLICY "students_update_hq_roles"
ON public.students
FOR UPDATE
USING (
  public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
)
WITH CHECK (
  public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
);

CREATE POLICY "students_update_branch_roles_own_branch"
ON public.students
FOR UPDATE
USING (
  public.get_current_user_role() IN ('branch_admin','registrar','admin')
  AND branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
)
WITH CHECK (
  public.get_current_user_role() IN ('branch_admin','registrar','admin')
  AND branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
);

-- 4) DELETE policies
CREATE POLICY "students_delete_hq_roles"
ON public.students
FOR DELETE
USING (
  public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
);

CREATE POLICY "students_delete_branch_roles_own_branch"
ON public.students
FOR DELETE
USING (
  public.get_current_user_role() IN ('branch_admin','registrar','admin')
  AND branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
);

-- Add a trigger to auto-assign branch_id on insert for branch users to avoid NULL branch rows
CREATE OR REPLACE FUNCTION public.assign_student_branch_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_branch uuid;
  v_user_role text;
BEGIN
  -- Only set if missing
  IF NEW.branch_id IS NULL THEN
    -- Fetch current user's branch and role
    SELECT u.branch_id, u.role::text INTO v_user_branch, v_user_role
    FROM public.users u
    WHERE u.id = auth.uid();

    -- If the user has a branch assigned, enforce it for branch-level roles
    IF v_user_branch IS NOT NULL AND v_user_role IN ('branch_admin','registrar','admin') THEN
      NEW.branch_id := v_user_branch;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure stable search_path for the security definer function (linter best practice)
ALTER FUNCTION public.assign_student_branch_on_insert() SET search_path = public, pg_temp;

-- Create or replace trigger
DROP TRIGGER IF EXISTS set_student_branch_before_insert ON public.students;
CREATE TRIGGER set_student_branch_before_insert
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.assign_student_branch_on_insert();

COMMIT;