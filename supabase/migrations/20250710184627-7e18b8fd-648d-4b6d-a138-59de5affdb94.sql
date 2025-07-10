-- Create branches table for multi-campus management
CREATE TABLE public.branches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    contact_info TEXT,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on branches table
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for branches
CREATE POLICY "Branches are viewable by authenticated users" 
ON public.branches 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can manage branches" 
ON public.branches 
FOR ALL 
USING (EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
));

-- Add branch_id to users table (for staff assignment)
ALTER TABLE public.users ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Add branch_id to students table
ALTER TABLE public.students ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Add branch_id to classes table
ALTER TABLE public.classes ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Add branch_id to registration_payments table
ALTER TABLE public.registration_payments ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Add branch_id to attendance table
ALTER TABLE public.attendance ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Add branch_id to fees table
ALTER TABLE public.fees ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Create function to get user's accessible branches
CREATE OR REPLACE FUNCTION public.get_user_accessible_branches(user_id UUID)
RETURNS TABLE(branch_id UUID, branch_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    user_branch_id UUID;
BEGIN
    -- Get user role and branch
    SELECT role, branch_id INTO user_role, user_branch_id
    FROM public.users
    WHERE id = user_id;
    
    -- Super admins and admins can see all branches
    IF user_role IN ('super_admin', 'admin') THEN
        RETURN QUERY
        SELECT b.id, b.name
        FROM public.branches b
        WHERE b.is_active = true
        ORDER BY b.name;
    ELSE
        -- Other users can only see their assigned branch
        RETURN QUERY
        SELECT b.id, b.name
        FROM public.branches b
        WHERE b.id = user_branch_id AND b.is_active = true;
    END IF;
END;
$$;

-- Create function to check if user can access a branch
CREATE OR REPLACE FUNCTION public.user_can_access_branch(user_id UUID, target_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    user_branch_id UUID;
BEGIN
    -- Get user role and branch
    SELECT role, branch_id INTO user_role, user_branch_id
    FROM public.users
    WHERE id = user_id;
    
    -- Super admins and admins can access all branches
    IF user_role IN ('super_admin', 'admin') THEN
        RETURN true;
    END IF;
    
    -- Other users can only access their assigned branch
    RETURN user_branch_id = target_branch_id;
END;
$$;

-- Insert a default main branch
INSERT INTO public.branches (name, address, contact_info) 
VALUES ('Main Campus', 'Main Campus Address', 'Main Campus Contact Info');

-- Update existing records to use the main branch
UPDATE public.students SET branch_id = (SELECT id FROM public.branches WHERE name = 'Main Campus' LIMIT 1);
UPDATE public.users SET branch_id = (SELECT id FROM public.branches WHERE name = 'Main Campus' LIMIT 1);
UPDATE public.classes SET branch_id = (SELECT id FROM public.branches WHERE name = 'Main Campus' LIMIT 1);
UPDATE public.registration_payments SET branch_id = (SELECT id FROM public.branches WHERE name = 'Main Campus' LIMIT 1);
UPDATE public.attendance SET branch_id = (SELECT id FROM public.branches WHERE name = 'Main Campus' LIMIT 1);
UPDATE public.fees SET branch_id = (SELECT id FROM public.branches WHERE name = 'Main Campus' LIMIT 1);

-- Create trigger to update updated_at on branches
CREATE OR REPLACE FUNCTION public.update_branches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_branches_updated_at
    BEFORE UPDATE ON public.branches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_branches_updated_at();