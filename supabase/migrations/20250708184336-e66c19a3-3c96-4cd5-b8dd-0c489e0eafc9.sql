-- Create missing Grade 10-B class
INSERT INTO classes (class_name, grade_level_id, max_capacity, academic_year)
SELECT 
    'GRADE 10 - B',
    id as grade_level_id,
    30,
    '2025'
FROM grade_levels 
WHERE grade = 'grade_10'
AND NOT EXISTS (
    SELECT 1 FROM classes 
    WHERE class_name = 'GRADE 10 - B' 
    AND grade_level_id = grade_levels.id
);

-- Create Grade 11 classes (A, B, C)
INSERT INTO classes (class_name, grade_level_id, max_capacity, academic_year)
SELECT 
    'GRADE 11 - ' || section.letter,
    gl.id as grade_level_id,
    30,
    '2025'
FROM grade_levels gl,
    (VALUES ('A'), ('B'), ('C')) AS section(letter)
WHERE gl.grade = 'grade_11'
AND NOT EXISTS (
    SELECT 1 FROM classes 
    WHERE class_name = 'GRADE 11 - ' || section.letter 
    AND grade_level_id = gl.id
);

-- Fix student assignments: assign Grade 10 students to proper Grade 10 classes
-- First, get the Grade 10 class IDs
WITH grade_10_classes AS (
    SELECT c.id, c.class_name, gl.grade
    FROM classes c
    JOIN grade_levels gl ON c.grade_level_id = gl.id
    WHERE gl.grade = 'grade_10'
    ORDER BY c.class_name
),
grade_10_students AS (
    SELECT s.id, s.first_name, s.last_name, s.grade_level, s.class_id,
           ROW_NUMBER() OVER (ORDER BY s.first_name, s.last_name) as rn
    FROM students s
    WHERE s.grade_level = 'grade_10'
)
UPDATE students 
SET class_id = (
    SELECT gc.id 
    FROM grade_10_classes gc
    WHERE gc.class_name = CASE 
        WHEN (SELECT rn FROM grade_10_students WHERE id = students.id) % 3 = 1 THEN 'GRADE 10 - A'
        WHEN (SELECT rn FROM grade_10_students WHERE id = students.id) % 3 = 2 THEN 'GRADE 10 - B'
        ELSE 'GRADE 10 - C'
    END
)
WHERE grade_level = 'grade_10';