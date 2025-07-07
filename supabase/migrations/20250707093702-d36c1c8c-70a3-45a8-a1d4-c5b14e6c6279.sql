
-- First, let's see what the current gender check constraint allows
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'students'::regclass 
AND conname LIKE '%gender%';

-- Update the gender check constraint to allow the values our import function uses
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_gender_check;

-- Add a new constraint that allows the gender values we're using in the import
ALTER TABLE students ADD CONSTRAINT students_gender_check 
CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'M', 'F'));
