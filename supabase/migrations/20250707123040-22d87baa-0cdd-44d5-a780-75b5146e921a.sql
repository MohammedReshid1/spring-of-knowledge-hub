-- Update class max_capacity to match actual enrollment to prevent overflow
UPDATE classes 
SET max_capacity = current_enrollment
WHERE current_enrollment > max_capacity;

-- For classes where current enrollment is 0, set a reasonable minimum capacity
UPDATE classes 
SET max_capacity = GREATEST(max_capacity, 25)
WHERE current_enrollment = 0 AND max_capacity < 25;

-- Update grade level max_capacity to sum of all class capacities in that grade
UPDATE grade_levels 
SET max_capacity = (
  SELECT COALESCE(SUM(c.max_capacity), 0)
  FROM classes c 
  WHERE c.grade_level_id = grade_levels.id
);

-- Recalculate current enrollment for grade levels to ensure consistency
UPDATE grade_levels 
SET current_enrollment = (
  SELECT COUNT(*) 
  FROM students 
  WHERE students.grade_level = grade_levels.grade 
  AND students.status = 'Active'
);