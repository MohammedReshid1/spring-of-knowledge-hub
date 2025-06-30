
-- Add missing columns to registration_payments table
ALTER TABLE registration_payments 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Cash';

ALTER TABLE registration_payments 
ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0;

ALTER TABLE registration_payments 
ADD COLUMN IF NOT EXISTS payment_details json;

-- Add check constraint for valid payment methods (without IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'registration_payments_valid_payment_method'
    AND table_name = 'registration_payments'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE registration_payments 
    ADD CONSTRAINT registration_payments_valid_payment_method 
    CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Mobile Payment', 'Check'));
  END IF;
END $$;

-- Update existing records to have default values
UPDATE registration_payments 
SET payment_method = 'Cash' 
WHERE payment_method IS NULL;

UPDATE registration_payments 
SET total_amount = amount_paid 
WHERE total_amount IS NULL OR total_amount = 0;

-- Copy transaction_data to payment_details for compatibility
UPDATE registration_payments 
SET payment_details = transaction_data 
WHERE payment_details IS NULL AND transaction_data IS NOT NULL;
