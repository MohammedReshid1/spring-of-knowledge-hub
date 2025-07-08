
-- Remove automatic grade transition scheduling
-- Update the get_next_grade_level function to handle the updated grade system properly

CREATE OR REPLACE FUNCTION get_next_grade_level(current_grade grade_level)
RETURNS grade_level AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update the transition function to properly handle the current grade system
CREATE OR REPLACE FUNCTION transition_students_to_next_grade()
RETURNS TABLE(
  student_id uuid,
  old_grade grade_level,
  new_grade grade_level,
  status text
) AS $$
DECLARE
  student_record RECORD;
  next_grade grade_level;
  transition_count INTEGER := 0;
  graduation_count INTEGER := 0;
BEGIN
  -- Only allow admin and super_admin to execute this function
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to perform grade transitions';
  END IF;

  -- Process each active student
  FOR student_record IN 
    SELECT id, grade_level, current_class, current_section, first_name, last_name
    FROM students 
    WHERE status = 'Active'
    ORDER BY grade_level, current_class, current_section
  LOOP
    -- Get next grade level
    next_grade := get_next_grade_level(student_record.grade_level);
    
    IF next_grade IS NULL THEN
      -- Student is graduating (was in grade 12)
      UPDATE students 
      SET 
        status = 'Graduated',
        updated_at = now()
      WHERE id = student_record.id;
      
      graduation_count := graduation_count + 1;
      
      RETURN QUERY SELECT 
        student_record.id,
        student_record.grade_level,
        student_record.grade_level, -- Keep same grade in return
        'Graduated'::text;
    ELSE
      -- Transition to next grade
      UPDATE students 
      SET 
        grade_level = next_grade,
        -- Reset class assignment for manual reassignment
        current_class = NULL,
        current_section = NULL,
        class_id = NULL,
        updated_at = now()
      WHERE id = student_record.id;
      
      transition_count := transition_count + 1;
      
      RETURN QUERY SELECT 
        student_record.id,
        student_record.grade_level,
        next_grade,
        'Transitioned'::text;
    END IF;
  END LOOP;

  -- Log the transition summary
  RAISE NOTICE 'Grade transition completed: % students transitioned, % students graduated', 
    transition_count, graduation_count;
    
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure grade levels exist for all grades including 10 and 11
INSERT INTO grade_levels (grade, max_capacity) VALUES ('grade_10', 30) ON CONFLICT (grade) DO NOTHING;
INSERT INTO grade_levels (grade, max_capacity) VALUES ('grade_11', 30) ON CONFLICT (grade) DO NOTHING;

-- Update enrollment counts to be consistent with actual student data
UPDATE grade_levels SET current_enrollment = (
  SELECT COUNT(*) FROM students 
  WHERE students.grade_level = grade_levels.grade 
  AND students.status = 'Active'
);

-- Update class enrollment counts to be consistent with actual student data
UPDATE classes SET current_enrollment = (
  SELECT COUNT(*) FROM students 
  WHERE students.class_id = classes.id 
  AND students.status = 'Active'
);
