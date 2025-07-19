
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useBranch } from '@/contexts/BranchContext';
import { useEffect } from 'react';

export const useBranchData = () => {
  const { user } = useAuth();
  const { selectedBranch, isHQRole } = useBranch();
  const { canAccessAllBranches } = useRoleAccess();
  const queryClient = useQueryClient();

  // Get current user's branch for automatic assignment
  const { data: currentUserBranch } = useQuery({
    queryKey: ['current-user-branch', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return user.branch_id; // User data already contains branch_id
    },
    enabled: !!user?.id
  });

  // Branch filter helper
  const getBranchFilter = () => {
    if (selectedBranch === 'all' || !selectedBranch) {
      return {}; // No filter for "all branches"
    }
    return { branch_id: selectedBranch };
  };

  // Students data
  const useStudents = () => {
    return useQuery({
      queryKey: ['students', selectedBranch],
      queryFn: async () => {
        const { data, error } = await apiClient.getStudents();
        if (error) {
          console.error('Error fetching students:', error);
          return [];
        }
        
        // Filter by branch if needed
        if (selectedBranch && selectedBranch !== 'all') {
          return data?.filter((student: any) => student.branch_id === selectedBranch) || [];
        }
        
        return data || [];
      },
      enabled: !!selectedBranch
    });
  };

  // Classes data
  const useClasses = () => {
    return useQuery({
      queryKey: ['classes', selectedBranch],
      queryFn: async () => {
        const { data, error } = await apiClient.getClasses();
        if (error) {
          console.error('Error fetching classes:', error);
          return [];
        }
        
        // Filter by branch if needed
        if (selectedBranch && selectedBranch !== 'all') {
          return data?.filter((cls: any) => cls.branch_id === selectedBranch) || [];
        }
        
        return data || [];
      },
      enabled: !!selectedBranch
    });
  };

  // Attendance data
  const useAttendance = () => {
    return useQuery({
      queryKey: ['attendance', selectedBranch],
      queryFn: async () => {
        const { data, error } = await apiClient.getAttendance();
        if (error) {
          console.error('Error fetching attendance:', error);
          return [];
        }
        
        // Filter by branch if needed
        if (selectedBranch && selectedBranch !== 'all') {
          return data?.filter((attendance: any) => attendance.branch_id === selectedBranch) || [];
        }
        
        return data || [];
      },
      enabled: !!selectedBranch
    });
  };

  // Fees data
  const useFees = () => {
    return useQuery({
      queryKey: ['fees', selectedBranch],
      queryFn: async () => {
        const { data, error } = await apiClient.getFees();
        if (error) {
          console.error('Error fetching fees:', error);
          return [];
        }
        
        return data || [];
      },
      enabled: !!selectedBranch
    });
  };

  // Payments data (using registration payments as a proxy)
  const usePayments = () => {
    return useQuery({
      queryKey: ['payments', selectedBranch],
      queryFn: async () => {
        const { data, error } = await apiClient.getRegistrationPayments();
        if (error) {
          console.error('Error fetching payments:', error);
          return [];
        }
        
        // Filter by branch if needed
        if (selectedBranch && selectedBranch !== 'all') {
          return data?.filter((payment: any) => payment.branch_id === selectedBranch) || [];
        }
        
        return data || [];
      },
      enabled: !!selectedBranch
    });
  };

  // Grade levels data
  const useGradeLevels = () => {
    return useQuery({
      queryKey: ['grade-levels'],
      queryFn: async () => {
        const { data, error } = await apiClient.getGradeLevels();
        if (error) {
          console.error('Error fetching grade levels:', error);
          return [];
        }
        
        return data || [];
      }
    });
  };

  // Subjects data
  const useSubjects = () => {
    return useQuery({
      queryKey: ['subjects'],
      queryFn: async () => {
        const { data, error } = await apiClient.getSubjects();
        if (error) {
          console.error('Error fetching subjects:', error);
          return [];
        }
        
        return data || [];
      }
    });
  };

  // Student enrollments data
  const useStudentEnrollments = () => {
    return useQuery({
      queryKey: ['student-enrollments', selectedBranch],
      queryFn: async () => {
        const { data, error } = await apiClient.getStudentEnrollments();
        if (error) {
          console.error('Error fetching student enrollments:', error);
          return [];
        }
        
        return data || [];
      },
      enabled: !!selectedBranch
    });
  };

  // Payment modes data
  const usePaymentModes = () => {
    return useQuery({
      queryKey: ['payment-modes'],
      queryFn: async () => {
        const { data, error } = await apiClient.getPaymentModes();
        if (error) {
          console.error('Error fetching payment modes:', error);
          return [];
        }
        
        return data || [];
      }
    });
  };

  // Backup logs data
  const useBackupLogs = () => {
    return useQuery({
      queryKey: ['backup-logs'],
      queryFn: async () => {
        const { data, error } = await apiClient.getBackupLogs();
        if (error) {
          console.error('Error fetching backup logs:', error);
          return [];
        }
        
        return data || [];
      }
    });
  };

  // Grade transitions data
  const useGradeTransitions = () => {
    return useQuery({
      queryKey: ['grade-transitions'],
      queryFn: async () => {
        const { data, error } = await apiClient.getGradeTransitions();
        if (error) {
          console.error('Error fetching grade transitions:', error);
          return [];
        }
        
        return data || [];
      }
    });
  };

  // Invalidate queries when branch changes
  useEffect(() => {
    if (selectedBranch) {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    }
  }, [selectedBranch, queryClient]);

  return {
    currentUserBranch,
    getBranchFilter,
    useStudents,
    useClasses,
    useAttendance,
    useFees,
    usePayments,
    useGradeLevels,
    useSubjects,
    useStudentEnrollments,
    usePaymentModes,
    useBackupLogs,
    useGradeTransitions,
    selectedBranch
  };
};
