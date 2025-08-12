-- Secure financial records: restrict access on registration_payments and fees
BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_payments ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive policies if they exist
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.fees;
DROP POLICY IF EXISTS "fees_all_authenticated" ON public.fees;
DROP POLICY IF EXISTS "fees_select_authenticated" ON public.fees;

DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.registration_payments;
DROP POLICY IF EXISTS "registration_payments_all_authenticated" ON public.registration_payments;
DROP POLICY IF EXISTS "registration_payments_select_authenticated" ON public.registration_payments;

-- Create precise policies for fees if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='fees' AND policyname='fees_branch_roles_own_branch'
  ) THEN
    CREATE POLICY "fees_branch_roles_own_branch"
    ON public.fees
    FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('branch_admin','registrar','admin')
        AND (fees.branch_id = u.branch_id OR fees.branch_id IS NULL)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('branch_admin','registrar','admin')
        AND (fees.branch_id = u.branch_id OR fees.branch_id IS NULL)
    ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='fees' AND policyname='fees_hq_roles_all'
  ) THEN
    CREATE POLICY "fees_hq_roles_all"
    ON public.fees
    FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin','hq_admin','hq_registrar')
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin','hq_admin','hq_registrar')
    ));
  END IF;
END $$;

-- Create precise policies for registration_payments if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='registration_payments' AND policyname='payments_branch_roles_own_branch'
  ) THEN
    CREATE POLICY "payments_branch_roles_own_branch"
    ON public.registration_payments
    FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('branch_admin','registrar','admin')
        AND (registration_payments.branch_id = u.branch_id OR registration_payments.branch_id IS NULL)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('branch_admin','registrar','admin')
        AND (registration_payments.branch_id = u.branch_id OR registration_payments.branch_id IS NULL)
    ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='registration_payments' AND policyname='payments_hq_roles_all'
  ) THEN
    CREATE POLICY "payments_hq_roles_all"
    ON public.registration_payments
    FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin','hq_admin','hq_registrar')
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin','hq_admin','hq_registrar')
    ));
  END IF;
END $$;

COMMIT;