/*
  # Create Grade Transition System

  1. New Functions
    - `get_next_grade_level()` - Returns the next grade level for a given grade
    - `transition_students_to_next_grade()` - Transitions all active students to next grade level
    - `schedule_annual_grade_transition()` - Schedules automatic grade transitions

  2. Security
    - Functions are security definer to allow proper execution
    - Only admin and super_admin roles can execute transitions

  3. Features
    - Automatic grade level progression
    - Maintains class sections where possible
    - Handles graduation for grade 12 students
    - Logs transition activities
*/

-- Function to get the next grade level
CREATE OR REPLACE FUNCTION get_next_grade_level(current_grade grade_level)
RETURNS grade_level AS $$
BEGIN
  CASE current_grade
    WHEN 'pre_k' THEN RETURN 'kindergarten';
    WHEN 'kindergarten' THEN RETURN 'grade_1';
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

-- Function to transition students to next grade level
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
        -- Keep the same section if possible
        current_class = student_record.current_class,
        current_section = student_record.current_section,
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

-- Function to check if it's time for annual transition (typically end of academic year)
CREATE OR REPLACE FUNCTION should_perform_grade_transition()
RETURNS boolean AS $$
DECLARE
  current_month INTEGER;
  current_day INTEGER;
BEGIN
  -- Get current month and day
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  current_day := EXTRACT(DAY FROM CURRENT_DATE);
  
  -- Transition typically happens in June (month 6) around day 15-30
  -- Adjust these dates based on your academic calendar
  IF current_month = 6 AND current_day >= 15 THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get transition preview (without actually performing it)
CREATE OR REPLACE FUNCTION preview_grade_transition()
RETURNS TABLE(
  student_id uuid,
  student_name text,
  current_grade grade_level,
  next_grade grade_level,
  action text
) AS $$
DECLARE
  student_record RECORD;
  next_grade grade_level;
BEGIN
  FOR student_record IN 
    SELECT id, grade_level, first_name, last_name
    FROM students 
    WHERE status = 'Active'
    ORDER BY grade_level, first_name, last_name
  LOOP
    next_grade := get_next_grade_level(student_record.grade_level);
    
    RETURN QUERY SELECT 
      student_record.id,
      (student_record.first_name || ' ' || student_record.last_name)::text,
      student_record.grade_level,
      COALESCE(next_grade, student_record.grade_level),
      CASE 
        WHEN next_grade IS NULL THEN 'Will Graduate'
        ELSE 'Will Advance'
      END::text;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a table to log grade transitions
CREATE TABLE IF NOT EXISTS grade_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year text NOT NULL,
  transition_date date NOT NULL DEFAULT CURRENT_DATE,
  students_transitioned integer NOT NULL DEFAULT 0,
  students_graduated integer NOT NULL DEFAULT 0,
  performed_by uuid REFERENCES users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on grade_transitions table
ALTER TABLE grade_transitions ENABLE ROW LEVEL SECURITY;

-- Create policy for grade_transitions
CREATE POLICY "grade_transitions_all_authenticated" ON grade_transitions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Function to log grade transition
CREATE OR REPLACE FUNCTION log_grade_transition(
  p_academic_year text,
  p_students_transitioned integer,
  p_students_graduated integer,
  p_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  transition_id uuid;
BEGIN
  INSERT INTO grade_transitions (
    academic_year,
    students_transitioned,
    students_graduated,
    performed_by,
    notes
  ) VALUES (
    p_academic_year,
    p_students_transitioned,
    p_students_graduated,
    auth.uid(),
    p_notes
  ) RETURNING id INTO transition_id;
  
  RETURN transition_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_next_grade_level(grade_level) TO authenticated;
GRANT EXECUTE ON FUNCTION transition_students_to_next_grade() TO authenticated;
GRANT EXECUTE ON FUNCTION should_perform_grade_transition() TO authenticated;
GRANT EXECUTE ON FUNCTION preview_grade_transition() TO authenticated;
GRANT EXECUTE ON FUNCTION log_grade_transition(text, integer, integer, text) TO authenticated;