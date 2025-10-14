import { useAuth as useAuthContext } from '@/contexts/AuthContext';

export const useAuth = () => {
  const authContext = useAuthContext();
  
  // User role is now available directly from auth context
  const userRole = authContext.user?.role;

  return {
    ...authContext,
    userRole,
  };
};