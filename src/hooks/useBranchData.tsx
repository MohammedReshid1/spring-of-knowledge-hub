import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      
      const { data, error } = await supabase
        .from('users')
        .select('branch_id')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user branch:', error);
        return null;
      }
      
      return data?.branch_id;
    },
    enabled: !!user?.id
  });

  // Auto-assign branch_id for new records
  const getDefaultBranchId = () => {
    // HQ roles can choose which branch to assign to
    if (canAccessAllBranches && selectedBranch && selectedBranch !== 'all') {
      return selectedBranch;
    }
    
    // Branch-restricted roles use their assigned branch
    return currentUserBranch;
  };

  // Get effective branch filter for queries
  const getBranchFilter = () => {
    // HQ roles viewing all branches
    if (canAccessAllBranches && selectedBranch === 'all') {
      return null; // No filter - return all branches
    }
    
    // HQ roles viewing specific branch
    if (canAccessAllBranches && selectedBranch && selectedBranch !== 'all') {
      return selectedBranch;
    }
    
    // Branch-restricted roles see only their branch
    return currentUserBranch;
  };

  // Invalidate all queries when branch changes
  useEffect(() => {
    if (selectedBranch !== null) {
      console.log('Branch changed to:', selectedBranch, 'invalidating queries...');
      // Invalidate all branch-dependent queries
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
    }
  }, [selectedBranch, queryClient]);

  // Students query with branch filtering - bypassing 1000 row limit
  const useStudents = () => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['students', selectedBranch, branchFilter, user?.id],
      queryFn: async () => {
        console.log('Fetching ALL students for branch:', selectedBranch, 'filter:', branchFilter);
        
        // First get the count to ensure we're fetching all data
        let countQuery = supabase
          .from('students')
          .select('*', { count: 'exact', head: true });
        
        if (branchFilter) {
          countQuery = countQuery.eq('branch_id', branchFilter);
        }
        
        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        
        console.log('Total students to fetch:', count);
        
        // Fetch all students by using range to bypass 1000 limit
        let query = supabase
          .from('students')
          .select(`
            *,
            classes:class_id (
              id,
              class_name,
              grade_levels:grade_level_id (
                grade
              )
            ),
            registration_payments (
              id,
              payment_status,
              amount_paid,
              total_amount,
              payment_cycle,
              academic_year
            )
          `)
          .range(0, (count || 5000) - 1) // Ensure we get all records
          .order('created_at', { ascending: false });
        
        // Apply branch filter if needed
        if (branchFilter) {
          query = query.eq('branch_id', branchFilter);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        console.log('Students fetched:', data?.length || 0, 'of', count, 'total records');
        return data || [];
      },
      enabled: !!user?.id,
      staleTime: 0, // Always refetch when branch changes
      refetchOnMount: true
    });
  };

  // Classes query with branch filtering - bypassing 1000 row limit
  const useClasses = () => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['classes', selectedBranch, branchFilter, user?.id],
      queryFn: async () => {
        console.log('Fetching ALL classes for branch:', selectedBranch, 'filter:', branchFilter);
        
        // First get the count
        let countQuery = supabase
          .from('classes')
          .select('*', { count: 'exact', head: true });
        
        if (branchFilter) {
          countQuery = countQuery.eq('branch_id', branchFilter);
        }
        
        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        
        console.log('Total classes to fetch:', count);
        
        // Fetch all classes with student counts
        let query = supabase
          .from('classes')
          .select(`
            *,
            grade_levels:grade_level_id (
              id,
              grade,
              max_capacity
            ),
            teacher:teacher_id (
              id,
              full_name,
              email
            )
          `)
          .range(0, (count || 1000) - 1)
          .order('class_name');
        
        // Apply branch filter if needed
        if (branchFilter) {
          query = query.eq('branch_id', branchFilter);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;

        // Get actual student counts for each class and update capacities if needed
        const classesWithCounts = await Promise.all(data?.map(async (cls) => {
          const { count: studentCount, error: countError } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .eq('status', 'Active');

          if (countError) {
            console.error(`Error counting students for class ${cls.id}:`, countError);
          }

          const currentEnrollment = studentCount || 0;
          
          // Automatically increase capacity if enrollment exceeds current capacity
          let adjustedCapacity = cls.max_capacity;
          if (currentEnrollment > cls.max_capacity) {
            // Round up to nearest 5 to give some buffer
            adjustedCapacity = Math.ceil(currentEnrollment / 5) * 5;
            
            // Update the capacity in the database
            await supabase
              .from('classes')
              .update({ max_capacity: adjustedCapacity })
              .eq('id', cls.id);
          }

          return {
            ...cls,
            current_enrollment: currentEnrollment,
            max_capacity: adjustedCapacity
          };
        }) || []);

        console.log('Classes fetched with student counts:', classesWithCounts?.length || 0, 'of', count, 'total records');
        return classesWithCounts || [];
      },
      enabled: !!user?.id,
      staleTime: 0,
      refetchOnMount: true
    });
  };

  // Payments query with branch filtering - bypassing 1000 row limit
  const usePayments = () => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['payments', selectedBranch, branchFilter, user?.id],
      queryFn: async () => {
        console.log('Fetching ALL payments for branch:', selectedBranch, 'filter:', branchFilter);
        
        // First get the count
        let countQuery = supabase
          .from('registration_payments')
          .select('*', { count: 'exact', head: true });
        
        if (branchFilter) {
          countQuery = countQuery.eq('branch_id', branchFilter);
        }
        
        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        
        console.log('Total payments to fetch:', count);
        
        // Fetch all payments
        let query = supabase
          .from('registration_payments')
          .select(`
            *,
            students (
              id,
              student_id,
              first_name,
              last_name,
              mother_name,
              father_name,
              grandfather_name,
              grade_level,
              photo_url,
              status
            )
          `)
          .range(0, (count || 5000) - 1)
          .order('created_at', { ascending: false });
        
        // Apply branch filter if needed
        if (branchFilter) {
          query = query.eq('branch_id', branchFilter);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        console.log('Payments fetched:', data?.length || 0, 'of', count, 'total records');
        return data || [];
      },
      enabled: !!user?.id,
      staleTime: 0,
      refetchOnMount: true
    });
  };

  // Attendance query with branch filtering - bypassing 1000 row limit
  const useAttendance = () => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['attendance', selectedBranch, branchFilter, user?.id],
      queryFn: async () => {
        console.log('Fetching ALL attendance for branch:', selectedBranch, 'filter:', branchFilter);
        
        // First get the count
        let countQuery = supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true });
        
        if (branchFilter) {
          countQuery = countQuery.eq('branch_id', branchFilter);
        }
        
        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        
        console.log('Total attendance records to fetch:', count);
        
        // Fetch all attendance records
        let query = supabase
          .from('attendance')
          .select(`
            *,
            students (
              first_name,
              last_name,
              student_id
            ),
            classes (
              class_name
            )
          `)
          .range(0, (count || 5000) - 1)
          .order('attendance_date', { ascending: false });
        
        // Apply branch filter if needed
        if (branchFilter) {
          query = query.eq('branch_id', branchFilter);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        console.log('Attendance fetched:', data?.length || 0, 'of', count, 'total records');
        return data || [];
      },
      enabled: !!user?.id,
      staleTime: 0,
      refetchOnMount: true
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
    selectedBranch,
    canAccessAllBranches,
    isHQRole
  };
};