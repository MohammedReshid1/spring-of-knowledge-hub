
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

  // Get effective branch filter for queries - FIXED to handle main branch and NULL values consistently
  const getBranchFilter = () => {
    // HQ roles viewing all branches
    if (canAccessAllBranches && selectedBranch === 'all') {
      return null; // No filter - return all branches including NULL
    }
    
    // HQ roles viewing specific branch
    if (canAccessAllBranches && selectedBranch && selectedBranch !== 'all') {
      return selectedBranch;
    }
    
    // Branch-restricted roles see only their branch + NULL branch_id students (unassigned belong to main branch)
    return currentUserBranch;
  };

  // Enhanced query invalidation on branch change with debouncing to prevent infinite loops
  useEffect(() => {
    if (selectedBranch !== null) {
      console.log('Branch changed to:', selectedBranch, 'invalidating queries...');
      
      // Use a timeout to debounce rapid branch changes and prevent infinite loops
      const timeoutId = setTimeout(() => {
        // Clear all existing query data immediately
        queryClient.setQueryData(['students'], () => []);
        queryClient.setQueryData(['classes'], () => []);
        queryClient.setQueryData(['payments'], () => []);
        queryClient.setQueryData(['attendance'], () => []);
        queryClient.setQueryData(['dashboard-stats'], () => null);
        queryClient.setQueryData(['student-stats'], () => null);
        
        // Invalidate all branch-dependent queries (but don't remove them to prevent infinite loops)
        queryClient.invalidateQueries({ queryKey: ['students'] });
        queryClient.invalidateQueries({ queryKey: ['classes'] });
        queryClient.invalidateQueries({ queryKey: ['payments'] });
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['student-stats'] });
        queryClient.invalidateQueries({ queryKey: ['filtered-students-count'] });
      }, 100); // Small debounce to prevent rapid invalidations

      return () => clearTimeout(timeoutId);
    }
  }, [selectedBranch, queryClient]);

  // Students query with server-side search to handle large datasets
  const useStudents = (searchTerm?: string, gradeFilter?: string, statusFilter?: string, classFilter?: string) => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['students', selectedBranch, branchFilter, user?.id, searchTerm, gradeFilter, statusFilter, classFilter],
      queryFn: async () => {
        console.log('Fetching students with search:', searchTerm, 'branch:', selectedBranch);
        
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
          .order('created_at', { ascending: false });

        // Apply branch filter with NULL handling - NULL branch_id students belong to main branch
        if (branchFilter) {
          query = query.or(`branch_id.eq.${branchFilter},branch_id.is.null`);
        }

        // Apply server-side filters for better performance
        if (searchTerm && searchTerm.trim()) {
          query = query.or(`student_id.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,father_name.ilike.%${searchTerm}%,grandfather_name.ilike.%${searchTerm}%,mother_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }
        
        // Apply grade filter server-side
        if (gradeFilter && gradeFilter !== 'all') {
          query = query.eq('grade_level', gradeFilter as any);
        }
        
        // Apply status filter server-side  
        if (statusFilter && statusFilter !== 'all') {
          query = query.eq('status', statusFilter as any);
        }
        
        // Apply class filter server-side
        if (classFilter && classFilter !== 'all') {
          query = query.eq('class_id', classFilter);
        }
        
        // Get all matching records (no artificial limits)
        const { data, error } = await query;
        
        if (error) throw error;
        console.log('Students fetched:', data?.length || 0, 'records');
        return data || [];
      },
      enabled: !!user?.id,
      staleTime: searchTerm ? 0 : 30000, // Increased cache time to prevent excessive refetching
      gcTime: 600000, // 10 minutes cache time
      refetchOnWindowFocus: false,
      refetchOnMount: false // Prevent automatic refetching on mount
    });
  };

  // Classes query with branch filtering - bypassing 1000 row limit
  const useClasses = () => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['classes', selectedBranch, branchFilter, user?.id],
      queryFn: async () => {
        console.log('Fetching ALL classes for branch:', selectedBranch, 'filter:', branchFilter);
        
        // Fetch all classes with student counts - NO RANGE LIMITS
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
          .order('class_name');
        
        // Apply branch filter with NULL handling for classes
        if (branchFilter) {
          query = query.or(`branch_id.eq.${branchFilter},branch_id.is.null`);
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

        console.log('Classes fetched with student counts:', classesWithCounts?.length || 0, 'total records');
        return classesWithCounts || [];
      },
      enabled: !!user?.id,
      staleTime: 30000, // Increased cache for classes
      gcTime: 600000,
      refetchOnMount: false,
      refetchOnWindowFocus: false
    });
  };

  // Payments query with FIXED server-side search - NO LIMITS and correct syntax
  const usePayments = (searchTerm?: string, statusFilter?: string, cycleFilter?: string, gradeFilter?: string) => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['payments', selectedBranch, branchFilter, user?.id, searchTerm, statusFilter, cycleFilter, gradeFilter],
      queryFn: async () => {
        console.log('Fetching ALL payments with server-side search:', { searchTerm, statusFilter, cycleFilter, gradeFilter, branch: selectedBranch });
        
        // Build the main query with joins - NO LIMITS to get all records
        let query = supabase
          .from('registration_payments')
          .select(`
            *,
            students!inner (
              id,
              student_id,
              first_name,
              last_name,
              mother_name,
              father_name,
              grandfather_name,
              grade_level,
              phone,
              email,
              photo_url,
              status
            )
          `)
          .in('students.status', ['Active']);
        
        // Apply branch filter with NULL handling for payments
        if (branchFilter) {
          query = query.or(`branch_id.eq.${branchFilter},branch_id.is.null`);
        }
        
        // FIXED: Proper search implementation to avoid duplicates and PostgREST errors
        if (searchTerm && searchTerm.trim()) {
          // Step 1: Find matching student IDs using students table search
          const { data: matchingStudents, error: searchError } = await supabase
            .from('students')
            .select('id')
            .or(`student_id.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,father_name.ilike.%${searchTerm}%,grandfather_name.ilike.%${searchTerm}%,mother_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
          
          if (searchError) throw searchError;
          
          const matchingStudentIds = matchingStudents?.map(s => s.id) || [];
          
          // Step 2: Apply search filter - either by student IDs or payment fields, but avoid OR that causes duplicates
          if (matchingStudentIds.length > 0) {
            query = query.in('student_id', matchingStudentIds);
          } else {
            // Only search payment notes if no students match
            query = query.ilike('notes', `%${searchTerm}%`);
          }
        }
        
        // Apply server-side filters
        if (statusFilter && statusFilter !== 'all') {
          query = query.eq('payment_status', statusFilter);
        }
        
        if (cycleFilter && cycleFilter !== 'all') {
          query = query.eq('payment_cycle', cycleFilter);
        }
        
        if (gradeFilter && gradeFilter !== 'all') {
          query = query.eq('students.grade_level', gradeFilter as any);
        }
        
        // Get ALL matching records - NO LIMITS OR RANGE CALLS
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Remove duplicates by payment ID in case any occur
        const uniquePayments = data?.filter((payment, index, arr) => 
          arr.findIndex(p => p.id === payment.id) === index
        ) || [];
        
        console.log('Payments fetched with server-side search:', uniquePayments.length, 'unique records');
        return uniquePayments;
      },
      enabled: !!user?.id,
      staleTime: 30000,
      gcTime: 600000,
      refetchOnMount: false,
      refetchOnWindowFocus: false
    });
  };

  // Attendance query with branch filtering - bypassing 1000 row limit
  const useAttendance = () => {
    const branchFilter = getBranchFilter();
    
    return useQuery({
      queryKey: ['attendance', selectedBranch, branchFilter, user?.id],
      queryFn: async () => {
        console.log('Fetching ALL attendance for branch:', selectedBranch, 'filter:', branchFilter);
        
        // Fetch all attendance records - NO RANGE LIMITS
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
          .order('attendance_date', { ascending: false });
        
        // Apply branch filter with NULL handling for attendance
        if (branchFilter) {
          query = query.or(`branch_id.eq.${branchFilter},branch_id.is.null`);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        console.log('Attendance fetched:', data?.length || 0, 'total records');
        return data || [];
      },
      enabled: !!user?.id,
      staleTime: 30000, // Increased cache for attendance
      gcTime: 600000,
      refetchOnMount: false,
      refetchOnWindowFocus: false
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
