-- Tighten RLS on students: remove overly permissive authenticated policy
BEGIN;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Remove permissive policies that allow any authenticated user broad access
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.students;
DROP POLICY IF EXISTS "students_select_authenticated" ON public.students;
DROP POLICY IF EXISTS "students_all_authenticated" ON public.students;

-- Keep existing scoped policies:
--  - students_branch_roles_own_branch (ALL): branch staff limited to their own branch or NULL
--  - students_hq_roles_all (ALL): HQ roles can access all records

COMMIT;