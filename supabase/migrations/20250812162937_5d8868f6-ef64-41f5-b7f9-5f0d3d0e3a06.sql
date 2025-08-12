
-- 1) Remove overly permissive RLS policies

-- attendance
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.attendance;

-- classes
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.classes;

-- grade_levels
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.grade_levels;
DROP POLICY IF EXISTS "grade_levels_all_authenticated" ON public.grade_levels;

-- subjects
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.subjects;
DROP POLICY IF EXISTS "subjects_all_authenticated" ON public.subjects;

-- student_enrollments
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.student_enrollments;
DROP POLICY IF EXISTS "student_enrollments_all_authenticated" ON public.student_enrollments;

-- 2) Recreate precise policies for grade_levels, subjects, student_enrollments

-- grade_levels: allow read to authenticated, management to HQ roles
CREATE POLICY "grade_levels_select_authenticated"
  ON public.grade_levels
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "grade_levels_insert_hq"
  ON public.grade_levels
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('super_admin','hq_admin'));

CREATE POLICY "grade_levels_update_hq"
  ON public.grade_levels
  FOR UPDATE TO authenticated
  USING (public.get_current_user_role() IN ('super_admin','hq_admin'))
  WITH CHECK (public.get_current_user_role() IN ('super_admin','hq_admin'));

CREATE POLICY "grade_levels_delete_hq"
  ON public.grade_levels
  FOR DELETE TO authenticated
  USING (public.get_current_user_role() IN ('super_admin','hq_admin'));

-- subjects: allow read to authenticated, management to HQ roles
CREATE POLICY "subjects_select_authenticated"
  ON public.subjects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "subjects_insert_hq"
  ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() IN ('super_admin','hq_admin'));

CREATE POLICY "subjects_update_hq"
  ON public.subjects
  FOR UPDATE TO authenticated
  USING (public.get_current_user_role() IN ('super_admin','hq_admin'))
  WITH CHECK (public.get_current_user_role() IN ('super_admin','hq_admin'));

CREATE POLICY "subjects_delete_hq"
  ON public.subjects
  FOR DELETE TO authenticated
  USING (public.get_current_user_role() IN ('super_admin','hq_admin'));

-- student_enrollments: restrict by linked student's branch or HQ roles
CREATE POLICY "student_enrollments_select_scoped"
  ON public.student_enrollments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_enrollments.student_id
        AND (
          public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
          OR (
            public.get_current_user_role() IN ('branch_admin','registrar','admin')
            AND s.branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
          )
        )
    )
  );

CREATE POLICY "student_enrollments_insert_scoped"
  ON public.student_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_enrollments.student_id
        AND (
          public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
          OR (
            public.get_current_user_role() IN ('branch_admin','registrar','admin')
            AND s.branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
          )
        )
    )
  );

CREATE POLICY "student_enrollments_update_scoped"
  ON public.student_enrollments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_enrollments.student_id
        AND (
          public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
          OR (
            public.get_current_user_role() IN ('branch_admin','registrar','admin')
            AND s.branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_enrollments.student_id
        AND (
          public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
          OR (
            public.get_current_user_role() IN ('branch_admin','registrar','admin')
            AND s.branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
          )
        )
    )
  );

CREATE POLICY "student_enrollments_delete_scoped"
  ON public.student_enrollments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_enrollments.student_id
        AND (
          public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
          OR (
            public.get_current_user_role() IN ('branch_admin','registrar','admin')
            AND s.branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
          )
        )
    )
  );

-- 3) Prevent privilege escalation in users
CREATE OR REPLACE FUNCTION public.prevent_user_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN
  -- Block role/branch changes by the user to their own record unless HQ-level
  IF auth.uid() = NEW.id THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
      IF public.get_current_user_role() NOT IN ('super_admin','hq_admin') THEN
        RAISE EXCEPTION 'Users cannot change their own role or branch';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_user_priv_escalation ON public.users;
CREATE TRIGGER prevent_user_priv_escalation
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_user_privilege_escalation();

-- 4) Enforce branch assignment on student INSERTs
DROP TRIGGER IF EXISTS trg_assign_student_branch ON public.students;
CREATE TRIGGER trg_assign_student_branch
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.assign_student_branch_on_insert();

-- 5) Harden key SECURITY DEFINER functions with search_path
CREATE OR REPLACE FUNCTION public.get_current_user_info()
RETURNS TABLE(user_role text, user_branch_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
BEGIN
    RETURN QUERY
    SELECT u.role::TEXT, u.branch_id
    FROM public.users u
    WHERE u.id = auth.uid();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  RETURN user_role;
END;
$function$;

-- 6) Make student-photos bucket private and add storage policies

-- make bucket private
UPDATE storage.buckets SET public = false WHERE name = 'student-photos';

-- allow reads/uploads for staff roles only, scoped by bucket
CREATE POLICY "student_photos_select_roles"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar','branch_admin','registrar','admin')
  );

CREATE POLICY "student_photos_insert_roles"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-photos'
    AND public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar','branch_admin','registrar','admin')
  );

CREATE POLICY "student_photos_update_hq"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND public.get_current_user_role() IN ('super_admin','hq_admin')
  )
  WITH CHECK (
    bucket_id = 'student-photos'
    AND public.get_current_user_role() IN ('super_admin','hq_admin')
  );

CREATE POLICY "student_photos_delete_hq"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND public.get_current_user_role() IN ('super_admin','hq_admin')
  );
