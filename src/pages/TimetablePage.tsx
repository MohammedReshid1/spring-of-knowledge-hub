import TimetableManagement from '@/components/timetable/TimetableManagement';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useLiveDataForPage } from '@/hooks/useLiveData';

export default function TimetablePage() {
  // Enable real-time updates for timetable and related data
  useLiveDataForPage('timetable', {
    relatedCollections: ['classes', 'teachers', 'subjects', 'rooms']
  });

  const { user } = useAuth();
  const { selectedBranch } = useBranch();
  
  // Get user role - handle both 'superadmin' and 'superadmin' formats
  const userRole = user?.role === 'superadmin' ? 'superadmin' : (user?.role || 'user');
  const userId = user?.user_id || '';
  
  return (
    <TimetableManagement 
      userRole={userRole}
      currentUserId={userId}
      branchId={selectedBranch}
    />
  );
}