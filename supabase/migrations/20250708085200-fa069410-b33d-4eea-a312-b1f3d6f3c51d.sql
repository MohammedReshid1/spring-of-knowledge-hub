-- Update current_enrollment for all grade levels to match actual student counts
UPDATE grade_levels 
SET current_enrollment = (
    SELECT COUNT(*) 
    FROM students 
    WHERE students.grade_level = grade_levels.grade 
    AND students.status = 'Active'
);