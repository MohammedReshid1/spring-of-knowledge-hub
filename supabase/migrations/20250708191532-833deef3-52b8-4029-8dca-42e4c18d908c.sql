-- Fix Grade 11 students class assignments
-- First, let's get the correct Grade 11 class IDs
DO $$
DECLARE
    grade_11_class_a_id UUID;
    grade_11_class_b_id UUID; 
    grade_11_class_c_id UUID;
    student_count INTEGER;
    students_per_class INTEGER;
    current_count INTEGER;
BEGIN
    -- Get Grade 11 class IDs
    SELECT id INTO grade_11_class_a_id FROM classes WHERE class_name = 'GRADE 11 - A';
    SELECT id INTO grade_11_class_b_id FROM classes WHERE class_name = 'GRADE 11 - B';
    SELECT id INTO grade_11_class_c_id FROM classes WHERE class_name = 'GRADE 11 - C';
    
    -- Count Grade 11 students currently assigned to wrong classes
    SELECT COUNT(*) INTO student_count 
    FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN grade_levels gl ON c.grade_level_id = gl.id
    WHERE s.grade_level = 'grade_11' AND gl.grade != 'grade_11';
    
    -- Calculate students per class (distribute evenly)
    students_per_class := CEIL(student_count::float / 3);
    
    -- Update Grade 11 students to correct classes
    WITH grade_11_students AS (
        SELECT s.id, ROW_NUMBER() OVER (ORDER BY s.first_name) as rn
        FROM students s
        JOIN classes c ON s.class_id = c.id
        JOIN grade_levels gl ON c.grade_level_id = gl.id
        WHERE s.grade_level = 'grade_11' AND gl.grade != 'grade_11'
    )
    UPDATE students 
    SET class_id = CASE 
        WHEN rn <= students_per_class THEN grade_11_class_a_id
        WHEN rn <= students_per_class * 2 THEN grade_11_class_b_id
        ELSE grade_11_class_c_id
    END
    FROM grade_11_students 
    WHERE students.id = grade_11_students.id;
    
    -- Update class enrollment counts
    UPDATE classes SET current_enrollment = (
        SELECT COUNT(*) FROM students WHERE class_id = classes.id AND status = 'Active'
    ) WHERE class_name LIKE 'GRADE 11%';
    
    RAISE NOTICE 'Fixed class assignments for % Grade 11 students', student_count;
END $$;

-- Create unique constraint for payments if it doesn't exist
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'registration_payments_unique_student_year_cycle'
    ) THEN
        -- Add unique constraint on student_id, academic_year, payment_cycle
        ALTER TABLE registration_payments 
        ADD CONSTRAINT registration_payments_unique_student_year_cycle 
        UNIQUE (student_id, academic_year, payment_cycle);
        
        RAISE NOTICE 'Added unique constraint for payment records';
    ELSE
        RAISE NOTICE 'Payment unique constraint already exists';
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'Unique constraint already exists';
END $$;

-- Add check constraint for gender values if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'students_gender_check'
    ) THEN
        ALTER TABLE students 
        ADD CONSTRAINT students_gender_check 
        CHECK (gender IN ('Male', 'Female') OR gender IS NULL);
        
        RAISE NOTICE 'Added gender check constraint';
    ELSE
        RAISE NOTICE 'Gender check constraint already exists';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Gender constraint already exists';
END $$;