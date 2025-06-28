
-- Update user_role enum to include super_admin and registrar
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'registrar';

-- Drop existing student_status enum if it exists and recreate with new values
DROP TYPE IF EXISTS student_status CASCADE;
CREATE TYPE student_status AS ENUM ('Active', 'Graduated', 'Transferred Out', 'Dropped Out', 'On Leave');

-- Update students table with new fields
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS father_name TEXT,
ADD COLUMN IF NOT EXISTS grandfather_name TEXT,
ADD COLUMN IF NOT EXISTS mother_name TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS current_class TEXT,
ADD COLUMN IF NOT EXISTS current_section TEXT;

-- Add status column with new enum (drop existing if present)
ALTER TABLE students DROP COLUMN IF EXISTS status;
ALTER TABLE students ADD COLUMN status student_status DEFAULT 'Active';

-- Create registration_payments table for payment tracking
CREATE TABLE IF NOT EXISTS registration_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  payment_status TEXT DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Unpaid', 'Partially Paid', 'Waived', 'Refunded')),
  amount_paid DECIMAL(10,2) DEFAULT 0,
  payment_date DATE,
  academic_year TEXT DEFAULT EXTRACT(year FROM now())::text,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(student_id, academic_year)
);

-- Enable RLS on registration_payments
ALTER TABLE registration_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for registration_payments
CREATE POLICY "Allow read access to registration_payments" 
ON registration_payments FOR SELECT 
USING (true);

CREATE POLICY "Allow insert access to registration_payments" 
ON registration_payments FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update access to registration_payments" 
ON registration_payments FOR UPDATE 
USING (true);

-- Create sequence for student ID generation
CREATE SEQUENCE IF NOT EXISTS student_id_seq START 1;

-- Create or replace function to generate student ID in SCH-YYYY-NNNNN format
CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.student_id IS NULL OR NEW.student_id = '' THEN
    NEW.student_id := 'SCH-' || EXTRACT(year FROM now()) || '-' || LPAD(NEXTVAL('student_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for student ID generation
DROP TRIGGER IF EXISTS generate_student_id_trigger ON students;
CREATE TRIGGER generate_student_id_trigger
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION generate_student_id();

-- Create function to automatically create payment record for new students
CREATE OR REPLACE FUNCTION create_payment_record()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO registration_payments (student_id, payment_status, academic_year)
  VALUES (NEW.id, 'Unpaid', EXTRACT(year FROM now())::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic payment record creation
DROP TRIGGER IF EXISTS create_payment_record_trigger ON students;
CREATE TRIGGER create_payment_record_trigger
  AFTER INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_record();

-- Update enrollment tracking function to handle new fields
CREATE OR REPLACE FUNCTION update_enrollment_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update class enrollment count
  IF TG_OP = 'INSERT' THEN
    IF NEW.class_id IS NOT NULL THEN
      UPDATE classes 
      SET current_enrollment = current_enrollment + 1 
      WHERE id = NEW.class_id;
    END IF;
    
    -- Update grade level enrollment count
    UPDATE grade_levels 
    SET current_enrollment = current_enrollment + 1 
    WHERE grade = NEW.grade_level;
    
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.class_id IS NOT NULL THEN
      UPDATE classes 
      SET current_enrollment = current_enrollment - 1 
      WHERE id = OLD.class_id;
    END IF;
    
    UPDATE grade_levels 
    SET current_enrollment = current_enrollment - 1 
    WHERE grade = OLD.grade_level;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle class change
    IF OLD.class_id IS DISTINCT FROM NEW.class_id THEN
      IF OLD.class_id IS NOT NULL THEN
        UPDATE classes 
        SET current_enrollment = current_enrollment - 1 
        WHERE id = OLD.class_id;
      END IF;
      
      IF NEW.class_id IS NOT NULL THEN
        UPDATE classes 
        SET current_enrollment = current_enrollment + 1 
        WHERE id = NEW.class_id;
      END IF;
    END IF;
    
    -- Handle grade level change
    IF OLD.grade_level != NEW.grade_level THEN
      UPDATE grade_levels 
      SET current_enrollment = current_enrollment - 1 
      WHERE grade = OLD.grade_level;
      
      UPDATE grade_levels 
      SET current_enrollment = current_enrollment + 1 
      WHERE grade = NEW.grade_level;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for enrollment tracking
DROP TRIGGER IF EXISTS update_enrollment_counts_trigger ON students;
CREATE TRIGGER update_enrollment_counts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION update_enrollment_counts();
