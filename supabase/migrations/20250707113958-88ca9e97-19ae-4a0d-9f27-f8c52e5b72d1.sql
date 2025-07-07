
-- First, let's check if 'prep' already exists and handle it properly
DO $$
BEGIN
    -- Only add 'prep' if it doesn't already exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'prep' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'grade_level')) THEN
        ALTER TYPE grade_level ADD VALUE 'prep';
    END IF;
END$$;

-- Update any students that should be in prep grade
UPDATE students 
SET grade_level = 'prep' 
WHERE (current_class ILIKE '%prep%' OR current_section ILIKE '%prep%')
AND grade_level != 'prep';
