import { useAuth as useAuthContext } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const authContext = useAuthContext();
  
  // Get user role - Fixed function name
  const { data: userRole } = useQuery({
    queryKey: ['user-role', authContext.user?.id],
    queryFn: async () => {
      if (!authContext.user?.id) return null;
      
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', authContext.user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }
      
      return data?.role || null;
    },
    enabled: !!authContext.user?.id,
  });

  return {
    ...authContext,
    userRole,
  };
};