-- First, let's see what class names correspond to the class_ids
-- and then update the students properly

-- Update current_class and current_section for Grade 4 students based on their class assignments
WITH class_mapping AS (
    SELECT 
        c.id as class_id,
        CASE 
            WHEN c.class_name = 'Grade 4 - A' THEN 'A'
            WHEN c.class_name = 'Grade 4 - B' THEN 'B'
            WHEN c.class_name = 'Grade 4 - C' THEN 'C'
            WHEN c.class_name = 'Grade 4 - D' THEN 'D'
            WHEN c.class_name = 'Grade 4 - E' THEN 'E'
        END as section
    FROM classes c
    JOIN grade_levels gl ON c.grade_level_id = gl.id
    WHERE gl.grade = 'grade_4'
)
UPDATE students 
SET 
    current_class = cm.section,
    current_section = cm.section
FROM class_mapping cm
WHERE students.class_id = cm.class_id 
    AND students.status = 'Active' 
    AND students.grade_level = 'grade_4';

-- Update class enrollment counts
UPDATE classes 
SET current_enrollment = (
    SELECT COUNT(*) 
    FROM students s
    WHERE s.class_id = classes.id AND s.status = 'Active'
)
WHERE id IN (
    SELECT c.id 
    FROM classes c
    JOIN grade_levels gl ON c.grade_level_id = gl.id
    WHERE gl.grade = 'grade_4'
);