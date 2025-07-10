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

-- Fix other missing grade level assignments one by one
UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'grade_1'::grade_level)
WHERE class_name LIKE 'GRADE 1%' AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'grade_2'::grade_level)
WHERE class_name LIKE 'GRADE 2%' AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'grade_3'::grade_level)
WHERE class_name LIKE 'GRADE 3%' AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'grade_4'::grade_level)
WHERE class_name LIKE 'GRADE 4%' AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'grade_5'::grade_level)
WHERE class_name LIKE 'GRADE 5%' AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'grade_9'::grade_level)
WHERE class_name LIKE 'GRADE 9%' AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'grade_10'::grade_level)
WHERE class_name LIKE 'GRADE 10%' AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'grade_11'::grade_level)
WHERE class_name LIKE 'GRADE 11%' AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'grade_12'::grade_level)
WHERE class_name LIKE 'GRADE 12%' AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'kg'::grade_level)
WHERE (class_name LIKE '%KG%' OR class_name LIKE '%KINDERGARTEN%') AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'pre_k'::grade_level)
WHERE class_name LIKE '%PRE%' AND grade_level_id IS NULL;

UPDATE classes 
SET grade_level_id = (SELECT id FROM grade_levels WHERE grade = 'prep'::grade_level)
WHERE class_name LIKE '%PREP%' AND grade_level_id IS NULL;