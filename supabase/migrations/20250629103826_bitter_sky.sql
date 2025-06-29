/*
  # Fix Payment Mode Table Structure

  1. Changes
    - Add auto-increment to the id column in payment_mode table
    - Update the primary key to use only the id column
    - Keep payment_id as unique but not part of primary key
    - Add proper RLS policies for insert operations

  2. Security
    - Update RLS policies to allow authenticated users to insert payment modes
    - Maintain existing read permissions
*/

-- First, drop the existing primary key constraint
ALTER TABLE payment_mode DROP CONSTRAINT payment_mode_pkey;

-- Add auto-increment to the id column
CREATE SEQUENCE IF NOT EXISTS payment_mode_id_seq;
ALTER TABLE payment_mode ALTER COLUMN id SET DEFAULT nextval('payment_mode_id_seq');
ALTER SEQUENCE payment_mode_id_seq OWNED BY payment_mode.id;

-- Set the sequence to start from the next available number
SELECT setval('payment_mode_id_seq', COALESCE((SELECT MAX(id) FROM payment_mode), 0) + 1);

-- Create new primary key with just id
ALTER TABLE payment_mode ADD CONSTRAINT payment_mode_pkey PRIMARY KEY (id);

-- Ensure payment_id remains unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payment_mode_payment_id_key' 
    AND table_name = 'payment_mode'
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