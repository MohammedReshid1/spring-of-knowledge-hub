-- Update students in PREP classes to have grade_level = 'prep'
UPDATE students 
SET grade_level = 'prep'
WHERE class_id IN (
  SELECT id FROM classes 
  WHERE class_name IN ('PREP-A', 'PREP-B', 'PREP-C', 'PREP-D', 'PREP-E')
);

-- Also ensure these classes are linked to the PREP grade level
UPDATE classes 
SET grade_level_id = (
  SELECT id FROM grade_levels WHERE grade = 'prep'
)
WHERE class_name IN ('PREP-A', 'PREP-B', 'PREP-C', 'PREP-D', 'PREP-E');

-- Update current enrollment counts for grade levels (recalculate)
UPDATE grade_levels 
SET current_enrollment = (
  SELECT COUNT(*) 
  FROM students 
  WHERE students.grade_level = grade_levels.grade 
  AND students.status = 'Active'
);

-- Update current enrollment counts for classes (recalculate)
UPDATE classes 
SET current_enrollment = (
  SELECT COUNT(*) 
  FROM students 
  WHERE students.class_id = classes.id 
  AND students.status = 'Active'
);