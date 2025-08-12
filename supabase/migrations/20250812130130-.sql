-- Secure registration_payments by removing overly permissive policies
BEGIN;

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.registration_payments ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies that expose data to all authenticated users
DROP POLICY IF EXISTS "Allow read access to registration_payments" ON public.registration_payments;
DROP POLICY IF EXISTS "Allow insert access to registration_payments" ON public.registration_payments;
DROP POLICY IF EXISTS "Allow update access to registration_payments" ON public.registration_payments;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.registration_payments;

-- Note: We keep the scoped policies already present:
--  - payments_branch_roles_own_branch (ALL) -> branch staff limited to their branch or NULL branch_id
--  - payments_hq_roles_all (ALL) -> HQ roles can access all records
-- These policies already enforce proper access controls per existing configuration.

COMMIT;