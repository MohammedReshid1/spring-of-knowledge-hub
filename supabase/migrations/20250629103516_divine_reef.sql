/*
  # Create student photos storage bucket

  1. Storage Setup
    - Create `student-photos` bucket for storing student profile photos
    - Set 5MB file size limit
    - Allow common image formats (JPEG, PNG, GIF, WebP)
    - Enable public read access

  2. Security Policies
    - Allow authenticated users to upload photos
    - Allow public read access to photos
    - Allow authenticated users to update/delete photos
*/

-- Create the student-photos storage bucket
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

-- Create storage policies with proper error handling
DO $$
BEGIN
  -- Policy to allow authenticated users to upload files to student-photos bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated users to upload student photos'
  ) THEN
    CREATE POLICY "Allow authenticated users to upload student photos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'student-photos');
  END IF;

  -- Policy to allow public read access to student photos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public read access to student photos'
  ) THEN
    CREATE POLICY "Allow public read access to student photos"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'student-photos');
  END IF;

  -- Policy to allow authenticated users to update student photos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated users to update student photos'
  ) THEN
    CREATE POLICY "Allow authenticated users to update student photos"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'student-photos')
    WITH CHECK (bucket_id = 'student-photos');
  END IF;

  -- Policy to allow authenticated users to delete student photos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated users to delete student photos'
  ) THEN
    CREATE POLICY "Allow authenticated users to delete student photos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'student-photos');
  END IF;
END $$;