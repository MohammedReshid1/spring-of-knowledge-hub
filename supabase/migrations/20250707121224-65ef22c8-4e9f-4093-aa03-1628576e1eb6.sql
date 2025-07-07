
-- Add PREP as a separate grade level in the enum
ALTER TYPE grade_level ADD VALUE IF NOT EXISTS 'prep';

-- Update the get_next_grade_level function to handle the new grade progression
CREATE OR REPLACE FUNCTION public.get_next_grade_level(current_grade grade_level)
 RETURNS grade_level
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  CASE current_grade
    WHEN 'pre_k' THEN RETURN 'kg';
    WHEN 'kg' THEN RETURN 'prep';
    WHEN 'prep' THEN RETURN 'grade_1';
    WHEN 'kindergarten' THEN RETURN 'grade_1'; -- Legacy support
    WHEN 'grade_1' THEN RETURN 'grade_2';
    WHEN 'grade_2' THEN RETURN 'grade_3';
    WHEN 'grade_3' THEN RETURN 'grade_4';
    WHEN 'grade_4' THEN RETURN 'grade_5';
    WHEN 'grade_5' THEN RETURN 'grade_6';
    WHEN 'grade_6' THEN RETURN 'grade_7';
    WHEN 'grade_7' THEN RETURN 'grade_8';
    WHEN 'grade_8' THEN RETURN 'grade_9';
    WHEN 'grade_9' THEN RETURN 'grade_10';
    WHEN 'grade_10' THEN RETURN 'grade_11';
    WHEN 'grade_11' THEN RETURN 'grade_12';
    WHEN 'grade_12' THEN RETURN NULL; -- Graduation
    ELSE RETURN NULL;
  END CASE;
END;
$function$;
