-- Create Grade 2 - E class and move the 78 migrated students there
WITH main_campus AS (
  SELECT id as main_branch_id 
  FROM branches 
  WHERE name = 'Main Campus' 
  LIMIT 1
),

-- Create the new Grade 2 - E class
new_class AS (
  INSERT INTO classes (class_name, academic_year, max_capacity, branch_id)
  VALUES ('GRADE 2 - E', '2025', 80, (SELECT main_branch_id FROM main_campus))
  RETURNING id, class_name
),

-- Move the 78 students that were updated today (migrated) to the new class
student_move AS (
  UPDATE students 
  SET class_id = (SELECT id FROM new_class),
      updated_at = now()
  WHERE class_id = (SELECT id FROM classes WHERE class_name = 'GRADE 2 - B')
    AND updated_at::date = CURRENT_DATE 
    AND created_at::date != CURRENT_DATE
  RETURNING id, student_id, first_name, last_name
),

-- Update enrollment counts for both classes
update_old_class AS (
  UPDATE classes 
  SET current_enrollment = (
    SELECT COUNT(*) 
    FROM students 
    WHERE class_id = classes.id AND status = 'Active'
  ),
  updated_at = now()
  WHERE class_name = 'GRADE 2 - B'
  RETURNING current_enrollment as old_class_enrollment
),

update_new_class AS (
  UPDATE classes 
  SET current_enrollment = (
    SELECT COUNT(*) 
    FROM students 
    WHERE class_id = classes.id AND status = 'Active'
  ),
  updated_at = now()
  WHERE class_name = 'GRADE 2 - E'
  RETURNING current_enrollment as new_class_enrollment
)

-- Return summary
SELECT 
  'Student Redistribution Summary' as action,
  (SELECT COUNT(*) FROM student_move) as students_moved_to_new_class,
  (SELECT old_class_enrollment FROM update_old_class) as remaining_in_grade_2_b,
  (SELECT new_class_enrollment FROM update_new_class) as students_in_new_grade_2_e,
  (SELECT class_name FROM new_class) as new_class_created;