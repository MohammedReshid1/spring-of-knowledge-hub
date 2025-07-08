-- Update Grade 4 max_capacity in grade_levels table
UPDATE grade_levels 
SET max_capacity = 175 
WHERE grade = 'grade_4';

-- Also update PREP capacity to match student count
UPDATE grade_levels 
SET max_capacity = 182 
WHERE grade = 'prep';