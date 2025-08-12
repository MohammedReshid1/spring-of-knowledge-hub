-- Tighten RLS for academic/payment tables and set immutable search_path on functions

-- 1) payment_mode: restrict to staff for SELECT, HQ/Admin for writes
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.payment_mode;
DROP POLICY IF EXISTS "payment_mode_select_authenticated" ON public.payment_mode;
DROP POLICY IF EXISTS "payment_mode_insert_authenticated" ON public.payment_mode;
DROP POLICY IF EXISTS "payment_mode_update_authenticated" ON public.payment_mode;
DROP POLICY IF EXISTS "payment_mode_delete_authenticated" ON public.payment_mode;

-- SELECT for staff roles
CREATE POLICY payment_mode_select_staff
ON public.payment_mode
FOR SELECT
USING (
  public.get_current_user_role() = ANY (
    ARRAY['super_admin','hq_admin','hq_registrar','branch_admin','registrar','admin']
  )
);

-- INSERT/UPDATE/DELETE restricted to HQ/Admin
CREATE POLICY payment_mode_manage_hq
ON public.payment_mode
FOR ALL
USING (
  public.get_current_user_role() = ANY (ARRAY['super_admin','hq_admin','admin'])
)
WITH CHECK (
  public.get_current_user_role() = ANY (ARRAY['super_admin','hq_admin','admin'])
);

-- 2) grade_transitions: replace permissive policy with role-scoped policies
DROP POLICY IF EXISTS "grade_transitions_all_authenticated" ON public.grade_transitions;

-- Allow staff to view
CREATE POLICY grade_transitions_select_staff
ON public.grade_transitions
FOR SELECT
USING (
  public.get_current_user_role() = ANY (
    ARRAY['super_admin','hq_admin','hq_registrar','branch_admin','registrar','admin']
  )
);

-- Only HQ/Admin can modify
CREATE POLICY grade_transitions_insert_admin
ON public.grade_transitions
FOR INSERT
WITH CHECK (
  public.get_current_user_role() = ANY (ARRAY['super_admin','hq_admin','admin'])
);

CREATE POLICY grade_transitions_update_admin
ON public.grade_transitions
FOR UPDATE
USING (
  public.get_current_user_role() = ANY (ARRAY['super_admin','hq_admin','admin'])
)
WITH CHECK (
  public.get_current_user_role() = ANY (ARRAY['super_admin','hq_admin','admin'])
);

CREATE POLICY grade_transitions_delete_admin
ON public.grade_transitions
FOR DELETE
USING (
  public.get_current_user_role() = ANY (ARRAY['super_admin','hq_admin','admin'])
);

-- 3) grade_levels and subjects: scope SELECT to staff (avoid expose-to-all)
DROP POLICY IF EXISTS "grade_levels_select_authenticated" ON public.grade_levels;
CREATE POLICY grade_levels_select_staff
ON public.grade_levels
FOR SELECT
USING (
  public.get_current_user_role() = ANY (
    ARRAY['super_admin','hq_admin','hq_registrar','branch_admin','registrar','admin']
  )
);

DROP POLICY IF EXISTS "subjects_select_authenticated" ON public.subjects;
CREATE POLICY subjects_select_staff
ON public.subjects
FOR SELECT
USING (
  public.get_current_user_role() = ANY (
    ARRAY['super_admin','hq_admin','hq_registrar','branch_admin','registrar','admin']
  )
);

-- 4) Make function search_path immutable for all relevant functions
-- Ensure all functions execute with a safe, explicit search_path
ALTER FUNCTION public.enforce_single_super_admin() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.get_current_user_role() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.assign_student_branch_on_insert() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.create_auth_user_and_profile(text, text, text, public.user_role, text) SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.prevent_user_privilege_escalation() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.get_current_user_info() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.fix_student_class_assignments() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.transition_students_to_next_grade() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.should_perform_grade_transition() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.preview_grade_transition() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.log_grade_transition(text, integer, integer, text) SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.should_create_automatic_backup() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.generate_student_id() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.get_next_student_id() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.create_payment_record() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.admin_cleanup_table(text) SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.get_next_grade_level(public.grade_level) SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.create_database_backup(text, text) SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.delete_backup_log(uuid) SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.user_can_access_branch(uuid, uuid) SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.update_branches_updated_at() SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.get_user_accessible_branches(uuid) SET search_path = 'public', 'pg_temp';
ALTER FUNCTION public.update_enrollment_counts() SET search_path = 'public', 'pg_temp';