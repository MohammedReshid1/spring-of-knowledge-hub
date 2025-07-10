-- Fix class names for existing classes without reassigning students
-- Extract section from current class_name and combine with grade_level to create proper naming

-- Update existing classes to have proper naming format
-- This extracts the section from the current class_name and rebuilds the name properly
UPDATE classes 
SET class_name = CASE 
  WHEN grade_levels.grade = 'pre_k' THEN 'PRE-KG - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'kg' THEN 'KG - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'prep' THEN 'PREP - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_1' THEN 'GRADE 1 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_2' THEN 'GRADE 2 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_3' THEN 'GRADE 3 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_4' THEN 'GRADE 4 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_5' THEN 'GRADE 5 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_6' THEN 'GRADE 6 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_7' THEN 'GRADE 7 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_8' THEN 'GRADE 8 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_9' THEN 'GRADE 9 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_10' THEN 'GRADE 10 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_11' THEN 'GRADE 11 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  WHEN grade_levels.grade = 'grade_12' THEN 'GRADE 12 - ' || TRIM(REGEXP_REPLACE(classes.class_name, '^.*[^A-Z]([A-Z])[^A-Z]*$', '\1'))
  ELSE classes.class_name
END
FROM grade_levels 
WHERE classes.grade_level_id = grade_levels.id;