import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export const useUserNames = () => {
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.getUsers();
      if (response.error) {
        console.error('Error fetching users:', response.error);
        return [];
      }
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const getUserName = (userId: string | undefined): string => {
    if (!userId) return 'Unknown';
    
    const user = users.find((u: any) => 
      u.id === userId || 
      u.user_id === userId || 
      u.email === userId
    );
    
    if (user) {
      return user.full_name || user.email || userId;
    }
    
    // If no user found, return the userId
    return userId;
  };

  const getUserByEmail = (email: string | undefined): any => {
    if (!email) return null;
    return users.find((u: any) => u.email === email);
  };

  return { 
    users, 
    getUserName,
    getUserByEmail
  };
};