-- First, move all Grade 4 students from the wrong Grade 2 classes to the correct Grade 4 classes
-- Get the correct Grade 4 class IDs
WITH grade4_classes AS (
    SELECT c.id, c.class_name,
           ROW_NUMBER() OVER (ORDER BY c.class_name) as row_num
    FROM classes c
    JOIN grade_levels gl ON c.grade_level_id = gl.id
    WHERE gl.grade = 'grade_4'
),
student_assignments AS (
    SELECT s.id as student_id,
           ROW_NUMBER() OVER (ORDER BY s.first_name, s.last_name) as student_row,
           ((ROW_NUMBER() OVER (ORDER BY s.first_name, s.last_name) - 1) / 35 + 1) as target_class_num
    FROM students s
    WHERE s.status = 'Active' AND s.grade_level = 'grade_4'
)
UPDATE students 
SET 
    class_id = gc.id,
    current_class = CASE 
        WHEN gc.class_name = 'Grade 4 - A' THEN 'A'
        WHEN gc.class_name = 'Grade 4 - B' THEN 'B'
        WHEN gc.class_name = 'Grade 4 - C' THEN 'C'
        WHEN gc.class_name = 'Grade 4 - D' THEN 'D'
        WHEN gc.class_name = 'Grade 4 - E' THEN 'E'
    END,
    current_section = CASE 
        WHEN gc.class_name = 'Grade 4 - A' THEN 'A'
        WHEN gc.class_name = 'Grade 4 - B' THEN 'B'
        WHEN gc.class_name = 'Grade 4 - C' THEN 'C'
        WHEN gc.class_name = 'Grade 4 - D' THEN 'D'
        WHEN gc.class_name = 'Grade 4 - E' THEN 'E'
    END
FROM student_assignments sa
JOIN grade4_classes gc ON sa.target_class_num = gc.row_num
WHERE students.id = sa.student_id;

-- Update all class enrollment counts (both Grade 2 and Grade 4 classes)
UPDATE classes 
SET current_enrollment = (
    SELECT COUNT(*) 
    FROM students s
    WHERE s.class_id = classes.id AND s.status = 'Active'
);