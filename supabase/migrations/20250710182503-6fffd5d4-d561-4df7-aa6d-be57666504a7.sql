-- Drop existing sequence and function
DROP TRIGGER IF EXISTS generate_student_id_trigger ON students;
DROP FUNCTION IF EXISTS generate_student_id();
DROP SEQUENCE IF EXISTS student_id_seq;

-- Create a function to get next available student ID (recycling deleted IDs)
CREATE OR REPLACE FUNCTION get_next_student_id()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  used_numbers INTEGER[];
  max_attempts INTEGER := 1000;
  attempt_count INTEGER := 0;
  random_num INTEGER;
  candidate_id TEXT;
BEGIN
  current_year := EXTRACT(year FROM now())::TEXT;
  
  -- Get all used numbers for current year
  SELECT ARRAY_AGG(
    CASE 
      WHEN student_id ~ ('^SCH-' || current_year || '-[0-9]{5}$') 
      THEN (SUBSTRING(student_id FROM '[0-9]{5}$'))::INTEGER
      ELSE NULL 
    END
  ) INTO used_numbers
  FROM students 
  WHERE student_id LIKE ('SCH-' || current_year || '-%');
  
  -- Remove NULL values
  used_numbers := ARRAY(SELECT unnest(used_numbers) WHERE unnest IS NOT NULL);
  
  -- Try to find an available random number
  WHILE attempt_count < max_attempts LOOP
    random_num := floor(random() * 99999) + 1; -- Generate 1-99999
    candidate_id := 'SCH-' || current_year || '-' || LPAD(random_num::TEXT, 5, '0');
    
    -- Check if this number is already used
    IF NOT (random_num = ANY(used_numbers)) THEN
      RETURN candidate_id;
    END IF;
    
    attempt_count := attempt_count + 1;
  END LOOP;
  
  -- Fallback: if we can't find a random number, use sequential starting from max + 1
  IF array_length(used_numbers, 1) > 0 THEN
    random_num := (SELECT MAX(unnest) FROM unnest(used_numbers)) + 1;
  ELSE
    random_num := 1;
  END IF;
  
  RETURN 'SCH-' || current_year || '-' || LPAD(random_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Create new trigger function using the recycling logic
CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.student_id IS NULL OR NEW.student_id = '' THEN
    NEW.student_id := get_next_student_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER generate_student_id_trigger
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION generate_student_id();