-- Phase 1a: Add new enum values for user roles
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hq_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'branch_admin'; 
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hq_registrar';