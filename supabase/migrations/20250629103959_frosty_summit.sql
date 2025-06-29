/*
  # Fix Payment Mode Table Structure

  1. Table Structure Changes
    - Remove composite primary key constraint
    - Create new primary key with just id column
    - Ensure payment_id remains unique
    
  2. Security Updates
    - Drop existing broad policy
    - Create specific policies for each operation type
    - Allow authenticated users full access to payment_mode table

  Note: The id column is already an identity column, so no sequence changes needed.
*/

-- First, drop the existing composite primary key constraint
ALTER TABLE payment_mode DROP CONSTRAINT IF EXISTS payment_mode_pkey;

-- Create new primary key with just the id column
ALTER TABLE payment_mode ADD CONSTRAINT payment_mode_pkey PRIMARY KEY (id);

-- Ensure payment_id remains unique (check if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payment_mode_payment_id_key' 
    AND table_name = 'payment_mode'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE payment_mode ADD CONSTRAINT payment_mode_payment_id_key UNIQUE (payment_id);
  END IF;
END $$;

-- Drop existing policies and create new ones
DROP POLICY IF EXISTS "payment_mode_all_authenticated" ON payment_mode;

-- Create specific policies for different operations
CREATE POLICY "payment_mode_select_authenticated"
  ON payment_mode
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "payment_mode_insert_authenticated"
  ON payment_mode
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "payment_mode_update_authenticated"
  ON payment_mode
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "payment_mode_delete_authenticated"
  ON payment_mode
  FOR DELETE
  TO authenticated
  USING (true);