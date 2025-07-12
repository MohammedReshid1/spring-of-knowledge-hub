-- Fix the get_next_student_id function to properly use unnest
CREATE OR REPLACE FUNCTION public.get_next_student_id()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  current_year TEXT;
  used_numbers INTEGER[];
  max_attempts INTEGER := 1000;
  attempt_count INTEGER := 0;
  random_num INTEGER;
  candidate_id TEXT;
  max_used_number INTEGER;
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
  
  -- Remove NULL values properly
  SELECT ARRAY_AGG(num) INTO used_numbers 
  FROM unnest(used_numbers) AS num 
  WHERE num IS NOT NULL;
  
  -- Handle case where used_numbers is NULL or empty
  IF used_numbers IS NULL THEN
    used_numbers := ARRAY[]::INTEGER[];
  END IF;
  
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
    SELECT MAX(num) INTO max_used_number FROM unnest(used_numbers) AS num;
    random_num := max_used_number + 1;
  ELSE
    random_num := 1;
  END IF;
  
  RETURN 'SCH-' || current_year || '-' || LPAD(random_num::TEXT, 5, '0');
END;
$function$;