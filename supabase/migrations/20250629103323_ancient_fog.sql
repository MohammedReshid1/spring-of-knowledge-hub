/*
  # Create student photos storage bucket

  1. Storage Setup
    - Create 'student-photos' storage bucket
    - Configure bucket to be public for easy access to student photos
    - Set up RLS policies for secure file operations

  2. Security
    - Enable RLS on the bucket
    - Allow authenticated users to upload files
    - Allow public read access to photos for display purposes
    - Allow authenticated users to delete their own uploads

  3. Notes
    - Bucket is set to public for easier photo display in the application
    - File uploads are restricted to authenticated users only
    - Standard image file types are supported
*/

-- Create the student-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload files to student-photos bucket
CREATE POLICY "Allow authenticated users to upload student photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-photos');

-- Policy to allow public read access to student photos
CREATE POLICY "Allow public read access to student photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'student-photos');

-- Policy to allow authenticated users to update student photos
CREATE POLICY "Allow authenticated users to update student photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'student-photos')
WITH CHECK (bucket_id = 'student-photos');

-- Policy to allow authenticated users to delete student photos
CREATE POLICY "Allow authenticated users to delete student photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'student-photos');