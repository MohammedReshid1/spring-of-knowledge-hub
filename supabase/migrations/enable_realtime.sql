
-- Enable real-time updates for all relevant tables
-- This will allow the UI to receive live updates when data changes

-- Enable replica identity for real-time updates
ALTER TABLE public.students REPLICA IDENTITY FULL;
ALTER TABLE public.classes REPLICA IDENTITY FULL;
ALTER TABLE public.grade_levels REPLICA IDENTITY FULL;
ALTER TABLE public.registration_payments REPLICA IDENTITY FULL;

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.grade_levels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.registration_payments;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_grade_level ON public.students(grade_level);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON public.students(created_at);
CREATE INDEX IF NOT EXISTS idx_classes_grade_level_id ON public.classes(grade_level_id);
CREATE INDEX IF NOT EXISTS idx_registration_payments_student_id ON public.registration_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_registration_payments_status ON public.registration_payments(payment_status);
