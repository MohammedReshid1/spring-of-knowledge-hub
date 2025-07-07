-- Add missing 'kg' grade level that's used in imports but missing from grade_levels table
INSERT INTO grade_levels (grade, max_capacity, current_enrollment, academic_year)
VALUES ('kg', 30, 0, EXTRACT(year FROM now())::text);