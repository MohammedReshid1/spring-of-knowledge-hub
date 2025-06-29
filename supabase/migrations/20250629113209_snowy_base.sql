/*
  # Fix RLS policies for users table

  1. Security Updates
    - Update INSERT policy to allow authenticated users to create teacher accounts
    - Ensure proper permissions for user management operations
    - Add policy for admins and super_admins to manage users

  2. Changes
    - Modify existing INSERT policy to be more permissive for user creation
    - Add role-based access for user management
*/

-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "users_insert_own" ON users;

-- Create new INSERT policy that allows authenticated users to create users
-- This is needed for admin/teacher management functionality
CREATE POLICY "users_insert_authenticated"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update SELECT policy to allow all authenticated users to view user data
-- This is needed for teacher management and user listings
DROP POLICY IF EXISTS "users_select_authenticated" ON users;
CREATE POLICY "users_select_authenticated"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- Update UPDATE policy to allow users to update their own data
-- and allow admins to update any user data
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  ))
  WITH CHECK (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  ));

-- Update DELETE policy to allow users to delete their own data
-- and allow admins to delete any user data
DROP POLICY IF EXISTS "users_delete_own" ON users;
CREATE POLICY "users_delete_own"
  ON users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  ));