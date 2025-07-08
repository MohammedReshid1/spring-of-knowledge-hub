-- Create Grade 4 classes (A through E to accommodate 175 students)
-- First get the grade_level_id for grade_4
DO $$
DECLARE
    grade_4_id UUID;
    sections TEXT[] := ARRAY['A', 'B', 'C', 'D', 'E'];
    section TEXT;
BEGIN
    -- Get the grade_4 level ID
    SELECT id INTO grade_4_id FROM grade_levels WHERE grade = 'grade_4';
    
    -- Create Grade 4 classes A through E
    FOREACH section IN ARRAY sections LOOP
        INSERT INTO classes (
            class_name,
            grade_level_id,
            max_capacity,
            current_enrollment,
            academic_year
        ) VALUES (
            'Grade 4 - ' || section,
            grade_4_id,
            35, -- Standard capacity per class
            0,
            '2025'
        );
    END LOOP;
END $$;

-- Now assign Grade 4 students to classes based on alphabetical distribution
-- Since there are 175 students and 5 classes, distribute them evenly
DO $$
DECLARE
    student_rec RECORD;
    class_ids UUID[];
    current_class_index INTEGER := 0;
    students_per_class INTEGER := 35;
    current_count INTEGER := 0;
BEGIN
    -- Get all Grade 4 class IDs in order
    SELECT ARRAY(
        SELECT c.id 
        FROM classes c 
        JOIN grade_levels gl ON c.grade_level_id = gl.id 
        WHERE gl.grade = 'grade_4' 
        ORDER BY c.class_name
    ) INTO class_ids;
    
    -- Assign students to classes alphabetically by name
    FOR student_rec IN 
        SELECT id, first_name, last_name
        FROM students 
        WHERE status = 'Active' AND grade_level = 'grade_4' AND class_id IS NULL
        ORDER BY first_name, last_name
    LOOP
        -- Move to next class if current one is full
        IF current_count >= students_per_class AND current_class_index < array_length(class_ids, 1) - 1 THEN
            current_class_index := current_class_index + 1;
            current_count := 0;
        END IF;
        
        -- Assign student to current class
        UPDATE students 
        SET 
            class_id = class_ids[current_class_index + 1],
            current_class = CASE current_class_index
                WHEN 0 THEN 'A'
                WHEN 1 THEN 'B' 
                WHEN 2 THEN 'C'
                WHEN 3 THEN 'D'
                WHEN 4 THEN 'E'
            END,
            current_section = CASE current_class_index
                WHEN 0 THEN 'A'
                WHEN 1 THEN 'B'
                WHEN 2 THEN 'C' 
                WHEN 3 THEN 'D'
                WHEN 4 THEN 'E'
            END
        WHERE id = student_rec.id;
        
        current_count := current_count + 1;
    END LOOP;
    
    -- Update class enrollment counts
    UPDATE classes 
    SET current_enrollment = (
        SELECT COUNT(*) 
        FROM students 
        WHERE students.class_id = classes.id AND students.status = 'Active'
    )
    WHERE id = ANY(class_ids);
    
END $$;