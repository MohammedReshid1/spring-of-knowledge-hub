-- Fix all capacity issues by updating grade_levels max_capacity to match actual enrollments
-- and ensure all class capacities are also properly adjusted

-- Update grade_levels capacities to match actual student counts
UPDATE grade_levels 
SET max_capacity = CASE 
    WHEN grade = 'pre_k' THEN 202
    WHEN grade = 'kg' THEN 190  
    WHEN grade = 'prep' THEN 182
    WHEN grade = 'grade_1' THEN 208
    WHEN grade = 'grade_2' THEN 158
    WHEN grade = 'grade_3' THEN 201
    WHEN grade = 'grade_4' THEN 175
    ELSE max_capacity
END;

-- Update all class capacities to match their actual enrollments (auto-adjust)
UPDATE classes 
SET max_capacity = GREATEST(max_capacity, current_enrollment);

-- Specifically fix the problematic classes mentioned
UPDATE classes 
SET max_capacity = current_enrollment
WHERE class_name IN ('KG - A', 'GRADE 3 - E');