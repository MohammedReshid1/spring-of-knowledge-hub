-- Function to fix student class assignments where grade level doesn't match class name
CREATE OR REPLACE FUNCTION fix_student_class_assignments()
RETURNS TABLE(
  student_id text,
  student_name text,
  old_class text,
  new_class text,
  action_taken text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  student_record RECORD;
  section_letter text;
  expected_grade_number text;
  new_class_name text;
  target_class_id uuid;
  students_fixed integer := 0;
BEGIN
  -- Process each student with mismatched grade and class
  FOR student_record IN 
    SELECT 
      s.id,
      s.student_id,
      s.first_name,
      s.last_name,
      s.grade_level,
      s.class_id,
      c.class_name,
      CASE 
        WHEN s.grade_level = 'grade_1' THEN '1'
        WHEN s.grade_level = 'grade_2' THEN '2'
        WHEN s.grade_level = 'grade_3' THEN '3'
        WHEN s.grade_level = 'grade_4' THEN '4'
        WHEN s.grade_level = 'grade_5' THEN '5'
        WHEN s.grade_level = 'grade_6' THEN '6'
        WHEN s.grade_level = 'grade_7' THEN '7'
        WHEN s.grade_level = 'grade_8' THEN '8'
        WHEN s.grade_level = 'grade_9' THEN '9'
        WHEN s.grade_level = 'grade_10' THEN '10'
        WHEN s.grade_level = 'grade_11' THEN '11'
        WHEN s.grade_level = 'grade_12' THEN '12'
        ELSE NULL
      END as expected_grade_number
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    WHERE s.class_id IS NOT NULL
      AND s.grade_level IN ('grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12')
      AND c.class_name IS NOT NULL
      AND c.class_name ~ 'GRADE [0-9]+ - [A-Z]'
  LOOP
    -- Extract the expected grade number for this student
    expected_grade_number := student_record.expected_grade_number;
    
    -- Extract section letter from current class name (e.g., 'A' from 'GRADE 12 - A')
    SELECT regexp_replace(student_record.class_name, '^GRADE [0-9]+ - ([A-Z])$', '\1') INTO section_letter;
    
    -- Skip if we couldn't extract a valid section letter
    IF section_letter IS NULL OR section_letter = student_record.class_name THEN
      CONTINUE;
    END IF;
    
    -- Create the correct class name
    new_class_name := 'GRADE ' || expected_grade_number || ' - ' || section_letter;
    
    -- Check if the student is already in the correct class
    IF student_record.class_name = new_class_name THEN
      CONTINUE;
    END IF;
    
    -- Find or create the target class
    SELECT id INTO target_class_id
    FROM classes 
    WHERE class_name = new_class_name
    LIMIT 1;
    
    -- If the target class doesn't exist, create it
    IF target_class_id IS NULL THEN
      INSERT INTO classes (class_name, academic_year, max_capacity)
      VALUES (new_class_name, EXTRACT(year FROM now())::text, 40)
      RETURNING id INTO target_class_id;
    END IF;
    
    -- Update the student's class assignment
    UPDATE students 
    SET 
      class_id = target_class_id,
      updated_at = now()
    WHERE id = student_record.id;
    
    students_fixed := students_fixed + 1;
    
    -- Return the details of what was fixed
    RETURN QUERY SELECT 
      student_record.student_id,
      (student_record.first_name || ' ' || student_record.last_name)::text,
      student_record.class_name,
      new_class_name,
      ('Fixed: Moved from ' || student_record.class_name || ' to ' || new_class_name)::text;
      
  END LOOP;
  
  -- Log the total number of students fixed
  RAISE NOTICE 'Fixed class assignments for % students', students_fixed;
  
  RETURN;
END;
$$;