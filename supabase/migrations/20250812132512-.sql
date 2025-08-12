-- Restrict read access to users table to authorized roles while allowing self-access
BEGIN;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Remove overly permissive SELECT policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;

-- Allow users to read their own record
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

-- HQ roles can read all users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='users' AND policyname='users_select_hq_roles_all'
  ) THEN
    CREATE POLICY "users_select_hq_roles_all"
    ON public.users
    FOR SELECT
    USING (
      public.get_current_user_role() IN ('super_admin','hq_admin','hq_registrar')
    );
  END IF;
END $$;

-- Branch admins (and legacy admin) can read users in their own branch
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

COMMIT;