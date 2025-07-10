-- Fix missing grade_level_id assignments for classes
-- Update GRADE 6 classes
UPDATE classes 
SET grade_level_id = 'e5f6de3a-657c-408c-b7f9-d9272fe86389'
WHERE class_name LIKE 'GRADE 6%' AND grade_level_id IS NULL;

-- Update GRADE 7 classes  
UPDATE classes 
SET grade_level_id = '5cf4df7e-7c03-43af-a4b4-d5c672a83bf3'
WHERE class_name LIKE 'GRADE 7%' AND grade_level_id IS NULL;

-- Update GRADE 8 classes
UPDATE classes 
SET grade_level_id = '30a2e06b-e7cb-4ba4-9e1c-c3c80413d2b1'
WHERE class_name LIKE 'GRADE 8%' AND grade_level_id IS NULL;

-- Fix any other missing grade level assignments by parsing class names
UPDATE classes 
SET grade_level_id = (
  SELECT gl.id 
  FROM grade_levels gl 
  WHERE gl.grade = CASE 
    WHEN classes.class_name LIKE 'GRADE 1%' THEN 'grade_1'
    WHEN classes.class_name LIKE 'GRADE 2%' THEN 'grade_2'
    WHEN classes.class_name LIKE 'GRADE 3%' THEN 'grade_3'
    WHEN classes.class_name LIKE 'GRADE 4%' THEN 'grade_4'
    WHEN classes.class_name LIKE 'GRADE 5%' THEN 'grade_5'
    WHEN classes.class_name LIKE 'GRADE 9%' THEN 'grade_9'
    WHEN classes.class_name LIKE 'GRADE 10%' THEN 'grade_10'
    WHEN classes.class_name LIKE 'GRADE 11%' THEN 'grade_11'
    WHEN classes.class_name LIKE 'GRADE 12%' THEN 'grade_12'
    WHEN classes.class_name LIKE '%KG%' OR classes.class_name LIKE '%KINDERGARTEN%' THEN 'kg'
    WHEN classes.class_name LIKE '%PRE%' THEN 'pre_k'
    WHEN classes.class_name LIKE '%PREP%' THEN 'prep'
  END
)
WHERE grade_level_id IS NULL 
AND class_name ~ '(GRADE [0-9]+|KG|PRE|PREP|KINDERGARTEN)';