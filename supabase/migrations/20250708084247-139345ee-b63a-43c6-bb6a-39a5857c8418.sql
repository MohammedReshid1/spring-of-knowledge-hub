-- Fix Grade 4 student assignments - update current_class and current_section based on their assigned classes
UPDATE students 
SET 
    current_class = CASE 
        WHEN class_id IN (
            SELECT c.id FROM classes c 
            JOIN grade_levels gl ON c.grade_level_id = gl.id 
            WHERE gl.grade = 'grade_4' AND c.class_name = 'Grade 4 - A'
        ) THEN 'A'
        WHEN class_id IN (
            SELECT c.id FROM classes c 
            JOIN grade_levels gl ON c.grade_level_id = gl.id 
            WHERE gl.grade = 'grade_4' AND c.class_name = 'Grade 4 - B'
        ) THEN 'B'
        WHEN class_id IN (
            SELECT c.id FROM classes c 
            JOIN grade_levels gl ON c.grade_level_id = gl.id 
            WHERE gl.grade = 'grade_4' AND c.class_name = 'Grade 4 - C'
        ) THEN 'C'
        WHEN class_id IN (
            SELECT c.id FROM classes c 
            JOIN grade_levels gl ON c.grade_level_id = gl.id 
            WHERE gl.grade = 'grade_4' AND c.class_name = 'Grade 4 - D'
        ) THEN 'D'
        WHEN class_id IN (
            SELECT c.id FROM classes c 
            JOIN grade_levels gl ON c.grade_level_id = gl.id 
            WHERE gl.grade = 'grade_4' AND c.class_name = 'Grade 4 - E'
        ) THEN 'E'
    END,
    current_section = CASE 
        WHEN class_id IN (
            SELECT c.id FROM classes c 
            JOIN grade_levels gl ON c.grade_level_id = gl.id 
            WHERE gl.grade = 'grade_4' AND c.class_name = 'Grade 4 - A'
        ) THEN 'A'
        WHEN class_id IN (
            SELECT c.id FROM classes c 
            JOIN grade_levels gl ON c.grade_level_id = gl.id 
            WHERE gl.grade = 'grade_4' AND c.class_name = 'Grade 4 - B'
        ) THEN 'B'
        WHEN class_id IN (
            SELECT c.id FROM classes c 
            JOIN grade_level_id = gl.id 
            WHERE gl.grade = 'grade_4' AND c.class_name = 'Grade 4 - C'
        ) THEN 'C'
        WHEN class_id IN (
            SELECT c.id FROM classes c 
            JOIN grade_levels gl ON c.grade_level_id = gl.id 
            WHERE gl.grade = 'grade_4' AND c.class_name = 'Grade 4 - D'
        ) THEN 'D'
        WHEN class_id IN (
            SELECT c.id FROM classes c 
            JOIN grade_levels gl ON c.grade_level_id = gl.id 
            WHERE gl.grade = 'grade_4' AND c.class_name = 'Grade 4 - E'
        ) THEN 'E'
    END
WHERE status = 'Active' 
    AND grade_level = 'grade_4' 
    AND class_id IS NOT NULL
    AND (current_class IS NULL OR current_section IS NULL);

-- Update class enrollment counts for Grade 4 classes
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