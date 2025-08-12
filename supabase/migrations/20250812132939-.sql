-- Harden students table RLS: remove permissive policies and enforce role/branch restrictions
BEGIN;

-- Ensure RLS is on
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Drop known overly-permissive policies if present
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.students;
DROP POLICY IF EXISTS "students_select_authenticated" ON public.students;
DROP POLICY IF EXISTS "students_all_authenticated" ON public.students;
DROP POLICY IF EXISTS "students_all" ON public.students;
DROP POLICY IF EXISTS "students_select_all" ON public.students;

-- Dynamically drop any policies with USING true or WITH CHECK true
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'students'
      AND (qual IS NULL OR btrim(qual) = 'true')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.students', p.policyname);
  END LOOP;

  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'students'
      AND (with_check IS NOT NULL AND btrim(with_check) = 'true')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.students', p.policyname);
  END LOOP;
END $$;

-- Create precise policies if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='students' AND policyname='students_branch_roles_own_branch'
  ) THEN
    CREATE POLICY "students_branch_roles_own_branch"
    ON public.students
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('branch_admin','registrar','admin')
          AND (students.branch_id = u.branch_id OR students.branch_id IS NULL)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('branch_admin','registrar','admin')
          AND (students.branch_id = u.branch_id OR students.branch_id IS NULL)
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='students' AND policyname='students_hq_roles_all'
  ) THEN
    CREATE POLICY "students_hq_roles_all"
    ON public.students
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.role IN ('super_admin','hq_admin','hq_registrar')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.role IN ('super_admin','hq_admin','hq_registrar')
      )
    );
  END IF;
END $$;

COMMIT;