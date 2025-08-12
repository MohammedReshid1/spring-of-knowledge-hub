-- Tighten RLS on public.users to protect staff contact info
BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive policies that allow broad access
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_all_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_select_all" ON public.users;

-- Recreate or ensure precise policies remain in place; only create if missing
-- 1) Users can view their own record
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' AND policyname='users_select_own'
  ) THEN
    CREATE POLICY "users_select_own"
    ON public.users
    FOR SELECT
    USING (auth.uid() = id);
  END IF;
END $$;

-- 2) HQ roles can view all users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' AND policyname='users_select_hq_roles_all'
  ) THEN
    CREATE POLICY "users_select_hq_roles_all"
    ON public.users
    FOR SELECT
    USING (public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar'));
  END IF;
END $$;

-- 3) Branch admins/admin can view users in their branch
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' AND policyname='users_select_branch_admin_same_branch'
  ) THEN
    CREATE POLICY "users_select_branch_admin_same_branch"
    ON public.users
    FOR SELECT
    USING (
      public.get_current_user_role() IN ('branch_admin','admin')
      AND branch_id = (SELECT user_branch_id FROM public.get_current_user_info())
    );
  END IF;
END $$;

-- 4) Users can update their own record
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' AND policyname='users_update_own'
  ) THEN
    CREATE POLICY "users_update_own"
    ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 5) HQ roles can update users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' AND policyname='users_update_own_or_hq'
  ) THEN
    CREATE POLICY "users_update_own_or_hq"
    ON public.users
    FOR UPDATE
    USING (
      auth.uid() = id OR public.get_current_user_role() IN ('super_admin','hq_admin')
    )
    WITH CHECK (
      auth.uid() = id OR public.get_current_user_role() IN ('super_admin','hq_admin')
    );
  END IF;
END $$;

-- 6) Inserts restricted to HQ roles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' AND policyname='users_insert_hq_roles'
  ) THEN
    CREATE POLICY "users_insert_hq_roles"
    ON public.users
    FOR INSERT
    WITH CHECK (public.get_current_user_role() IN ('super_admin','hq_admin'));
  END IF;
END $$;

-- 7) Deletes allowed for HQ roles and self-delete policy (as previously configured)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' AND policyname='users_delete_hq_roles'
  ) THEN
    CREATE POLICY "users_delete_hq_roles"
    ON public.users
    FOR DELETE
    USING (public.get_current_user_role() IN ('super_admin','hq_admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' AND policyname='users_delete_own'
  ) THEN
    CREATE POLICY "users_delete_own"
    ON public.users
    FOR DELETE
    USING (auth.uid() = id);
  END IF;
END $$;

COMMIT;