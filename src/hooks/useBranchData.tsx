
import { useQuery } from '@tanstack/react-query';

const getToken = () => localStorage.getItem('token');

// Supabase usage is deprecated. Use /api endpoints for all data fetching with the FastAPI backend.
export const useBranchData = () => {
  // Get current user's branch for automatic assignment
  const { data: currentUserBranch } = useQuery({
    queryKey: ['current-user-branch'],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/users/current-branch', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch current user branch');
      return res.json();
    },
    enabled: !!getToken()
  });

  // Auto-assign branch_id for new records
  const getDefaultBranchId = () => {
    // HQ roles can choose which branch to assign to
    // This logic needs to be re-evaluated as branch selection is now client-side
    // For now, it will return the current user's branch if available
    return currentUserBranch;
  };

  // Get effective branch filter for queries
  const getBranchFilter = () => {
    // HQ roles viewing all branches
    // This logic needs to be re-evaluated as branch selection is now client-side
    // For now, it will return null, meaning no filter
    return null;
  };

  // Students query
  const useStudents = () => {
    return useQuery({
      queryKey: ['students'],
      queryFn: async () => {
        const token = getToken();
        const res = await fetch('/api/students', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch students');
        return res.json();
      },
    });
  };

  // Classes query with branch filtering - bypassing 1000 row limit
  const useClasses = () => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['classes', branchFilter],
      queryFn: async () => {
        const token = getToken();
        const params = new URLSearchParams({
          branch_id: branchFilter || '',
        });
        const res = await fetch(`/api/classes?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch classes');
        return res.json();
      },
      enabled: !!getToken()
    });
  };

  // Payments query with FIXED server-side search - NO LIMITS and correct syntax
  const usePayments = (searchTerm?: string, statusFilter?: string, cycleFilter?: string, gradeFilter?: string) => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['payments', branchFilter, searchTerm, statusFilter, cycleFilter, gradeFilter],
      queryFn: async () => {
        const token = getToken();
        const params = new URLSearchParams({
          branch_id: branchFilter || '',
          search: searchTerm || '',
          payment_status: statusFilter || '',
          payment_cycle: cycleFilter || '',
          grade_level: gradeFilter || '',
        });
        const res = await fetch(`/api/payments?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch payments');
        return res.json();
      },
      enabled: !!getToken()
    });
  };

  // Attendance query with branch filtering - bypassing 1000 row limit
  const useAttendance = () => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['attendance', branchFilter],
      queryFn: async () => {
        const token = getToken();
        const params = new URLSearchParams({
          branch_id: branchFilter || '',
        });
        const res = await fetch(`/api/attendance?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch attendance');
        return res.json();
      },
      enabled: !!getToken()
    });
  };

  return {
    useStudents,
    useClasses,
    usePayments,
    useAttendance,
    getDefaultBranchId,
    getBranchFilter,
    currentUserBranch,
    selectedBranch: null, // This will be removed as branch selection is client-side
    canAccessAllBranches: true, // This will be removed as branch selection is client-side
    isHQRole: false // This will be removed as branch selection is client-side
  };
};
