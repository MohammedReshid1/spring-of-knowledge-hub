
-- Step 1: Get the Main Campus branch ID first
WITH main_campus AS (
  SELECT id as main_branch_id 
  FROM branches 
  WHERE name = 'Main Campus' 
  LIMIT 1
),

-- Step 2: Update the GRADE 2 - B class to be assigned to Main Campus
class_update AS (
  UPDATE classes 
  SET branch_id = (SELECT main_branch_id FROM main_campus),
      updated_at = now()
  WHERE class_name = 'GRADE 2 - B' 
    AND branch_id IS NULL
  RETURNING id, class_name
),

-- Step 3: Update all students with NULL branch_id to Main Campus
student_update AS (
  UPDATE students 
  SET branch_id = (SELECT main_branch_id FROM main_campus),
      updated_at = now()
  WHERE branch_id IS NULL
  RETURNING id, student_id, first_name, last_name
),

-- Step 4: Update payment records for these students to reflect Main Campus
payment_update AS (
  UPDATE registration_payments 
  SET branch_id = (SELECT main_branch_id FROM main_campus),
      updated_at = now()
  WHERE student_id IN (
    SELECT id FROM students WHERE branch_id = (SELECT main_branch_id FROM main_campus)
  ) AND branch_id IS NULL
  RETURNING id
),

-- Step 5: Update class enrollment count for GRADE 2 - B
enrollment_update AS (
  UPDATE classes 
  SET current_enrollment = (
    SELECT COUNT(*) 
    FROM students 
    WHERE class_id = classes.id AND status = 'Active'
  ),
  updated_at = now()
  WHERE class_name = 'GRADE 2 - B'
  RETURNING id, current_enrollment
)

-- Return summary of changes
SELECT 
  'Migration Summary' as action,
  (SELECT COUNT(*) FROM student_update) as students_migrated,
  (SELECT COUNT(*) FROM class_update) as classes_migrated,
  (SELECT COUNT(*) FROM payment_update) as payment_records_updated,
  (SELECT current_enrollment FROM enrollment_update LIMIT 1) as final_class_enrollment,
  (SELECT main_branch_id FROM main_campus) as main_campus_branch_id;
