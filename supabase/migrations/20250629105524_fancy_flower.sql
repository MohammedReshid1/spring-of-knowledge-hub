/*
  # Enhanced Payment System

  1. New Tables
    - Add payment_cycle column to registration_payments
    - Create payment-screenshots storage bucket
    - Add bank and transaction fields to payment_mode

  2. Security
    - Enable RLS on storage objects for payment screenshots
    - Add policies for payment screenshot access

  3. Changes
    - Add payment cycle tracking (quarters/semesters/registration)
    - Add bank transfer details support
    - Add payment screenshot upload capability
*/

-- Add payment_cycle column to registration_payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'registration_payments' 
    AND column_name = 'payment_cycle'
  ) THEN
    ALTER TABLE registration_payments 
    ADD COLUMN payment_cycle TEXT CHECK (payment_cycle IN (
      '1st_quarter', '2nd_quarter', '3rd_quarter', '4th_quarter',
      '1st_semester', '2nd_semester', 'registration_fee'
    ));
  END IF;
END $$;

-- Create payment-screenshots storage bucket
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'payment-screenshots',
    'payment-screenshots', 
    false, -- Private bucket for security
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  ) ON CONFLICT (id) DO NOTHING;
END $$;

-- Create storage policies for payment screenshots
DO $$
BEGIN
  -- Policy to allow authenticated users to upload payment screenshots
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated users to upload payment screenshots'
  ) THEN
    CREATE POLICY "Allow authenticated users to upload payment screenshots"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'payment-screenshots');
  END IF;

  -- Policy to allow authenticated users to view payment screenshots
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated users to view payment screenshots'
  ) THEN
    CREATE POLICY "Allow authenticated users to view payment screenshots"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'payment-screenshots');
  END IF;

  -- Policy to allow authenticated users to update payment screenshots
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated users to update payment screenshots'
  ) THEN
    CREATE POLICY "Allow authenticated users to update payment screenshots"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'payment-screenshots')
    WITH CHECK (bucket_id = 'payment-screenshots');
  END IF;

  -- Policy to allow authenticated users to delete payment screenshots
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated users to delete payment screenshots'
  ) THEN
    CREATE POLICY "Allow authenticated users to delete payment screenshots"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'payment-screenshots');
  END IF;
END $$;

-- Update payment_mode table to support enhanced payment data
-- The payment_data JSON column can now store:
-- - bank_name
-- - transaction_number  
-- - payment_screenshot
-- - payment_cycle
-- This is already flexible with the existing JSON structure

-- Add some sample payment cycles for reference
COMMENT ON COLUMN registration_payments.payment_cycle IS 'Payment cycle: 1st_quarter, 2nd_quarter, 3rd_quarter, 4th_quarter, 1st_semester, 2nd_semester, registration_fee';