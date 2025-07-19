// Supabase usage is deprecated. Use /api endpoints for authentication with the FastAPI backend.
import { useAuth as useAuthContext } from '@/contexts/AuthContext';

export const useAuth = () => {
  const authContext = useAuthContext();
  // userRole is just authContext.user?.role
  return {
    ...authContext,
    userRole: authContext.user?.role || null,
  };
};