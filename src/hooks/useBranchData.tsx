
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { RegistrationPayment, Fee } from '@/types/api';
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

  // Students data with enhanced filtering and search
  const useStudents = (params?: {
    search?: string;
    status?: string;
    grade_level?: string;
    class_id?: string;
    page?: number;
    limit?: number;
  }) => {
    return useQuery({
      queryKey: ['students', selectedBranch, params],
      queryFn: async () => {
        const { data, error } = await apiClient.getStudents({
          branch_id: selectedBranch,
          ...params
        });
        if (error) {
          console.error('Error fetching students:', error);
          return [];
        }
        // Handle new pagination structure: { items: [...], total: number, ... }
        return Array.isArray(data?.items) ? data.items : [];
      },
      enabled: !!selectedBranch,
      staleTime: 30000, // Cache for 30 seconds
      refetchOnMount: true,
      refetchOnWindowFocus: false
    });
  };

  // Student statistics
  const useStudentStats = () => {
    return useQuery({
      queryKey: ['student-stats', selectedBranch],
      queryFn: async () => {
        const { data, error } = await apiClient.getStudentStats(selectedBranch);
        if (error) {
          console.error('Error fetching student stats:', error);
          throw new Error('Failed to fetch student stats');
        }
        return data;
      },
      enabled: !!selectedBranch,
      staleTime: 60000, // Cache for 1 minute
      refetchOnMount: true
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
          return Array.isArray(data) ? data.filter((cls: any) => cls.branch_id === selectedBranch) : [];
        }
        
        return Array.isArray(data) ? data : [];
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
          return Array.isArray(data) ? data.filter((attendance: any) => attendance.branch_id === selectedBranch) : [];
        }
        
        return Array.isArray(data) ? data : [];
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

  // Payments data: combine registration payments and fees
  const usePayments = () => {
    // Returns combined registration payments and fee records
    return useQuery<any[], Error>({
      queryKey: ['payments', selectedBranch],
      queryFn: async () => {
        // Fetch registration payments
        const { data: regData, error: regError } = await apiClient.getRegistrationPayments();
        if (regError) {
          console.error('Error fetching registration payments:', regError);
          return [];
        }
        // Fetch fees
        const { data: feeData, error: feeError } = await apiClient.getFees();
        if (feeError) {
          console.error('Error fetching fees:', feeError);
          return Array.isArray(regData) ? regData : [];
        }
        // Filter by branch
        const rList = (Array.isArray(regData) ? regData : []).filter(
          p => !selectedBranch || selectedBranch === 'all' || p.branch_id === selectedBranch
        );
        const fList = (Array.isArray(feeData) ? feeData : [])
          .filter(f => !selectedBranch || selectedBranch === 'all' || f.branch_id === selectedBranch)
          .map((f: Fee) => ({
            id: f.id,
            student_id: f.student_id,
            amount_paid: f.amount,
            payment_date: f.paid_date || f.due_date,
            payment_status: f.status.charAt(0).toUpperCase() + f.status.slice(1),
            academic_year: f.academic_year,
            payment_cycle: f.fee_type as any,
            notes: '',
            payment_id: f.id,
            branch_id: f.branch_id,
          }));
        return [...rList, ...fList];
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

  // Dashboard stats
  const useDashboardStats = () => {
    return useQuery({
      queryKey: ['dashboard-stats', selectedBranch],
      queryFn: async () => {
        const { data, error } = await apiClient.getDashboardStats(selectedBranch);
        if (error) {
          console.error('Error fetching dashboard stats:', error);
          throw new Error('Failed to fetch dashboard stats');
        }
        return data;
      },
      enabled: !!selectedBranch,
      staleTime: 60000, // Cache for 1 minute
      refetchOnMount: true,
      refetchOnWindowFocus: true
    });
  };

  // Invalidate queries when branch changes
  useEffect(() => {
    if (selectedBranch) {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  }, [selectedBranch, queryClient]);

  return {
    currentUserBranch,
    getBranchFilter,
    useStudents,
    useStudentStats,
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
    useDashboardStats,
    selectedBranch
  };
};
