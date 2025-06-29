/*
  # Create student photos storage bucket

  1. Storage Setup
    - Create student-photos bucket with proper configuration
    - Set up RLS policies for secure file operations
    - Allow public read access and authenticated user operations

  2. Security
    - Enable proper access controls for file uploads
    - Restrict operations to authenticated users
    - Allow public viewing of student photos
*/

-- Create the student-photos storage bucket using the storage schema
DO $$
BEGIN
  -- Insert bucket if it doesn't exist
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'student-photos',
    'student-photos', 
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  ) ON CONFLICT (id) DO NOTHING;
END $$;

-- Create storage policies using the storage schema functions
-- Note: These policies will be created in the storage schema, not public

-- Policy to allow authenticated users to upload files to student-photos bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload student photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-photos');

-- Policy to allow public read access to student photos
CREATE POLICY IF NOT EXISTS "Allow public read access to student photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'student-photos');

-- Policy to allow authenticated users to update student photos
CREATE POLICY IF NOT EXISTS "Allow authenticated users to update student photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'student-photos')
WITH CHECK (bucket_id = 'student-photos');

-- Policy to allow authenticated users to delete student photos
CREATE POLICY IF NOT EXISTS "Allow authenticated users to delete student photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'student-photos');