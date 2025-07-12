-- Fix Grade 5 students branch assignment
-- Set branch_id for Grade 5 students to match the current branch context
UPDATE students 
SET branch_id = '7f1cae26-375e-4be9-980f-056971f12e0a'
WHERE grade_level = 'grade_5' 
  AND branch_id IS NULL;

-- Fix Grade 5 classes branch assignment  
UPDATE classes 
SET branch_id = '7f1cae26-375e-4be9-980f-056971f12e0a'
WHERE class_name LIKE 'GRADE 5 - %' 
  AND branch_id IS NULL;