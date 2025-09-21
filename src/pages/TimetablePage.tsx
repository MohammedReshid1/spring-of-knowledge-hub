import TimetableManagement from '@/components/timetable/TimetableManagement';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';

export default function TimetablePage() {
  const { user } = useAuth();
  const { selectedBranch } = useBranch();
  
  // Get user role - handle both 'super_admin' and 'superadmin' formats
  const userRole = user?.role === 'super_admin' ? 'superadmin' : (user?.role || 'user');
  const userId = user?.user_id || '';
  
  return (
    <TimetableManagement 
      userRole={userRole}
      currentUserId={userId}
      branchId={selectedBranch}
    />
  );
}