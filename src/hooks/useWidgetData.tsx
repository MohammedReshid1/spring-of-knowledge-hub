import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useBranch } from '@/contexts/BranchContext';

export const useWidgetData = () => {
  const { user } = useAuth();
  const { userRole, isTeacher, isStudent, isParent } = useRoleAccess();
  const { selectedBranch } = useBranch();

  // Admin Dashboard Stats (already implemented via useBranchData)
  const useAdminStats = () => {
    return useQuery({
      queryKey: ['admin-stats', selectedBranch],
      queryFn: async () => {
        console.log('Fetching admin stats for branch:', selectedBranch);
        const { data, error } = await apiClient.getDashboardStats(selectedBranch || undefined);
        if (error) throw new Error(error);
        console.log('Admin stats data:', data);
        return data?.data;
      },
      enabled: !!selectedBranch,
      staleTime: 60000, // 1 minute
      refetchInterval: 300000 // 5 minutes
    });
  };

  // Payment Collection Widget
  const usePaymentCollection = () => {
    return useQuery({
      queryKey: ['payment-collection', selectedBranch],
      queryFn: async () => {
        const { data, error } = await apiClient.getDashboardStats(selectedBranch);
        if (error) throw new Error(error);
        console.log('Payment collection data structure:', data);
        return data?.data?.financial;
      },
      enabled: !!selectedBranch,
      staleTime: 60000,
      refetchInterval: 300000
    });
  };

  // Attendance Overview Widget
  const useAttendanceOverview = () => {
    return useQuery({
      queryKey: ['attendance-overview', selectedBranch],
      queryFn: async () => {
        const { data, error } = await apiClient.getDashboardStats(selectedBranch);
        if (error) throw new Error(error);
        console.log('Attendance overview data structure:', data);
        return data?.data?.attendance;
      },
      enabled: !!selectedBranch,
      staleTime: 300000, // 5 minutes
      refetchInterval: 300000
    });
  };

  // System Status Widget
  const useSystemStatus = () => {
    return useQuery({
      queryKey: ['system-status'],
      queryFn: async () => {
        const { data, error } = await apiClient.getDashboardStats();
        if (error) throw new Error(error);
        
        console.log('System status data structure:', data);
        
        return {
          database: data?.data?.system?.database_status === 'connected' ? 'online' : 'offline',
          realtime: 'active',
          security: 'secure',
          performance: 'good',
          lastUpdate: new Date(),
          uptime: 86400,
          stats: {
            totalStudents: data?.data?.overview?.total_students || 0,
            totalTeachers: data?.data?.overview?.total_teachers || 0,
            totalClasses: data?.data?.overview?.total_classes || 0,
            revenue: data?.data?.financial?.total_revenue || 0
          }
        };
      },
      staleTime: 30000, // 30 seconds
      refetchInterval: 30000
    });
  };

  // Teacher Schedule Widget
  const useTeacherSchedule = () => {
    return useQuery({
      queryKey: ['teacher-schedule', user?.id],
      queryFn: async () => {
        // Try to use enhanced teacher dashboard first
        const { data: dashboardData, error: dashboardError } = await apiClient.getTeacherEnhancedDashboard(user?.id || '');
        
        if (!dashboardError && dashboardData?.assigned_classes) {
          // Transform assigned classes to schedule format
          return dashboardData.assigned_classes.map((cls: any, index: number) => {
            const startHour = 8 + (index * 2);
            const endHour = startHour + 1;
            return {
              id: cls.id,
              time: `${startHour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:30`,
              subject: cls.subject || cls.class_name || 'General',
              grade: cls.grade_level || 'Unknown',
              room: cls.classroom || 'TBA',
              students: cls.current_enrollment || 0,
              status: index === 0 ? 'current' : 'upcoming'
            };
          });
        }
        
        // Fallback to timetable data (correct endpoint)
        let timetable: any | null = null;
        try {
          const resp = await apiClient.getTeacherTimetable(user?.id || '');
          timetable = resp.data;
        } catch (e) {
          timetable = null;
        }

        // Fallback to classes if timetable doesn't exist
        if (!timetable) {
          const { data: classes, error } = await apiClient.getClasses();
          if (error) throw new Error(error);
          
          const teacherClasses = Array.isArray(classes) ? classes.filter((cls: any) => 
            cls.teacher_id === user?.id || cls.teachers?.includes(user?.id)
          ) : [];

          // Transform to schedule format with better time distribution
          return teacherClasses.map((cls: any, index: number) => {
            const startHour = 8 + (index * 2);
            const endHour = startHour + 1;
            return {
              id: cls.id,
              time: `${startHour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:30`,
              subject: cls.subject || 'General',
              grade: cls.grade_level || 'Unknown',
              room: cls.classroom || 'TBA',
              students: cls.student_count || 0,
              status: index === 0 ? 'current' : 'upcoming'
            };
          });
        }

        // Use actual timetable data: flatten days/periods to schedule items
        // Backend returns: { teacher_id, teacher_name, total_periods_per_week, entries: [{ day, periods: { [period]: { start_time, end_time, room_number, subject_id }}}], ... }
        const entries = Array.isArray(timetable?.entries) ? timetable.entries : [];
        const schedule: any[] = [];
        for (const dayEntry of entries) {
          const periods = dayEntry?.periods || {};
          for (const periodNum of Object.keys(periods)) {
            const p = periods[periodNum];
            schedule.push({
              id: p.entry_id || `${dayEntry.day}-${periodNum}`,
              time: `${(p.start_time || '08:00').slice(0,5)} - ${(p.end_time || '09:30').slice(0,5)}`,
              subject: p.subject_id || 'General',
              grade: 'Unknown',
              room: p.room_number || 'TBA',
              students: 0,
              status: 'upcoming'
            });
          }
        }
        return schedule;
      },
      enabled: isTeacher && !!user?.id,
      staleTime: 300000, // 5 minutes
      refetchInterval: 300000
    });
  };

  // Pending Grades Widget
  const usePendingGrades = () => {
    return useQuery({
      queryKey: ['pending-grades', user?.id],
      queryFn: async () => {
        try {
          // Use the new API method that properly fetches pending grades
          const { data, error } = await apiClient.getRealPendingGrades(user?.id);
          if (error) throw new Error(error);
          return data || [];
        } catch (error) {
          console.error('Error fetching pending grades:', error);
          return [];
        }
      },
      enabled: isTeacher && !!user?.id,
      staleTime: 300000,
      refetchInterval: 300000
    });
  };

  // Teacher Notifications Widget
  const useTeacherNotifications = () => {
    return useQuery({
      queryKey: ['teacher-notifications', user?.id],
      queryFn: async () => {
        const { data: notifications, error } = await apiClient.get(`/notifications/?recipient_id=${user?.id}&limit=10`);
        if (error) throw new Error(error);

        return Array.isArray(notifications) ? notifications.map((notif: any) => ({
          id: notif.id,
          type: notif.type || 'message',
          title: notif.title || 'Notification',
          content: notif.message || 'No content',
          from: notif.sender || 'System',
          time: notif.created_at || new Date().toISOString(),
          priority: notif.priority || 'medium',
          read: notif.is_read || false
        })) : [];
      },
      enabled: isTeacher && !!user?.id,
      staleTime: 60000,
      refetchInterval: 120000 // 2 minutes
    });
  };

  // Student Progress Widget
  const useStudentProgress = () => {
    return useQuery({
      queryKey: ['student-progress', user?.id],
      queryFn: async () => {
        // Try enhanced teacher dashboard first
        const { data: dashboardData, error: dashboardError } = await apiClient.getTeacherEnhancedDashboard(user?.id || '');
        
        if (!dashboardError && dashboardData?.assigned_classes) {
          // Use enhanced dashboard class data
          const progressData = await Promise.all(dashboardData.assigned_classes.map(async (cls: any) => {
            const { data: examResults, error: examError } = await apiClient.getExamResults({ class_id: cls.id });
            const results = Array.isArray(examResults) && !examError ? examResults : [];
            
            const scores = results.map((r: any) => r.marks_obtained || 0);
            const averageGrade = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            const strugglingStudents = results.filter((r: any) => (r.marks_obtained || 0) < 60).length;
            const excellentStudents = results.filter((r: any) => (r.marks_obtained || 0) >= 85).length;
            const completionRate = cls.current_enrollment > 0 ? (results.length / cls.current_enrollment) * 100 : 0;

            return {
              id: cls.id,
              className: cls.class_name || `${cls.grade_level} ${cls.subject}`,
              students: cls.current_enrollment || 0,
              averageGrade: Math.round(averageGrade),
              trend: averageGrade > 75 ? 'up' : 'down',
              trendValue: Math.round(averageGrade - 75),
              strugglingStudents,
              excellentStudents,
              lastAssessment: 'Recent Assessment',
              completionRate: Math.round(completionRate)
            };
          }));

          return progressData;
        }
        
        // Fallback to original implementation
        const { data: classes, error: classError } = await apiClient.getClasses();
        if (classError) throw new Error(classError);

        const teacherClasses = Array.isArray(classes) ? classes.filter((cls: any) => 
          cls.teacher_id === user?.id
        ) : [];

        // Fetch exam results for each class
        const progressData = await Promise.all(teacherClasses.map(async (cls: any) => {
          const { data: examResults, error: examError } = await apiClient.getExamResults({ class_id: cls.id });
          const results = Array.isArray(examResults) && !examError ? examResults : [];
          
          const scores = results.map((r: any) => r.marks_obtained || 0);
          const averageGrade = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          const strugglingStudents = results.filter((r: any) => (r.marks_obtained || 0) < 60).length;
          const excellentStudents = results.filter((r: any) => (r.marks_obtained || 0) >= 85).length;
          const completionRate = cls.student_count > 0 ? (results.length / cls.student_count) * 100 : 0;

          return {
            id: cls.id,
            className: `${cls.grade_level} ${cls.subject}`,
            students: cls.student_count || 0,
            averageGrade: Math.round(averageGrade),
            trend: averageGrade > 75 ? 'up' : 'down',
            trendValue: Math.round(averageGrade - 75),
            strugglingStudents,
            excellentStudents,
            lastAssessment: 'Recent Assessment',
            completionRate: Math.round(completionRate)
          };
        }));

        return progressData;
      },
      enabled: isTeacher && !!user?.id,
      staleTime: 600000, // 10 minutes
      refetchInterval: 600000
    });
  };

  // Student Grades Widget
  const useStudentGrades = () => {
    return useQuery({
      queryKey: ['student-grades', user?.id],
      queryFn: async () => {
        try {
          // Fetch exam results for this student using new API method
          const { data: results, error } = await apiClient.getExamResults({ student_id: user?.id });
          if (error) throw new Error(error);

          return Array.isArray(results) ? results.map((result: any) => ({
            id: result.id,
            subject: result.subject_name || 'General',
            grade: result.marks_obtained || 0,
            maxGrade: result.total_marks || 100,
            trend: 'stable',
            trendValue: 0,
            lastAssessment: result.exam_name || 'Assessment',
            date: result.exam_date || new Date().toISOString(),
            teacher: result.teacher_name || 'Teacher',
            letterGrade: result.grade || 'C',
            percentage: result.percentage || 0
          })) : [];
        } catch (error) {
          console.error('Error fetching student grades:', error);
          return [];
        }
      },
      enabled: (isStudent || isParent) && !!user?.id,
      staleTime: 300000,
      refetchInterval: 600000
    });
  };

  // Upcoming Exams Widget
  const useUpcomingExams = () => {
    return useQuery({
      queryKey: ['upcoming-exams', user?.id, selectedBranch],
      queryFn: async () => {
        try {
          // Use the new API method that properly fetches upcoming exams
          const { data, error } = await apiClient.getRealUpcomingExams(user?.id, selectedBranch);
          if (error) throw new Error(error);
          return data || [];
        } catch (error) {
          console.error('Error fetching upcoming exams:', error);
          return [];
        }
      },
      enabled: (isStudent || isParent) && !!user?.id,
      staleTime: 300000,
      refetchInterval: 600000
    });
  };

  // Attendance Summary Widget
  const useAttendanceSummary = () => {
    return useQuery({
      queryKey: ['attendance-summary', user?.id],
      queryFn: async () => {
        // Fetch attendance records for this student
        const { data: attendance, error } = await apiClient.get(`/attendance/?student_id=${user?.id}`);
        if (error) throw new Error(error);

        const records = Array.isArray(attendance) ? attendance : [];
        const present = records.filter(r => r.status === 'present').length;
        const absent = records.filter(r => r.status === 'absent').length;
        const total = records.length;

        return {
          overall: {
            percentage: total > 0 ? (present / total) * 100 : 100,
            present,
            absent,
            late: records.filter(r => r.status === 'late').length,
            totalDays: total,
            trend: 'up',
            trendValue: 2.3
          },
          thisMonth: {
            percentage: 95,
            present: 19,
            absent: 1,
            late: 0,
            totalDays: 20
          },
          thisWeek: {
            percentage: 100,
            present: 5,
            absent: 0,
            late: 0,
            totalDays: 5
          },
          recentRecords: records.slice(-5).map(r => ({
            date: r.attendance_date,
            status: r.status,
            time: r.arrival_time,
            reason: r.excuse_reason
          }))
        };
      },
      enabled: (isStudent || isParent) && !!user?.id,
      staleTime: 300000,
      refetchInterval: 600000
    });
  };

  // Announcements Widget
  const useAnnouncements = () => {
    return useQuery({
      queryKey: ['announcements', selectedBranch, userRole],
      queryFn: async () => {
        // Fetch announcements
        const { data: announcements, error } = await apiClient.get(`/notifications/?branch_id=${selectedBranch}&type=announcement`);
        if (error) throw new Error(error);

        return Array.isArray(announcements) ? announcements.map((ann: any) => ({
          id: ann.id,
          title: ann.title || 'Announcement',
          content: ann.message || 'No content',
          type: ann.category || 'info',
          priority: ann.priority || 'medium',
          author: ann.sender || 'Administration',
          date: ann.created_at || new Date().toISOString(),
          pinned: ann.is_pinned || false,
          targetAudience: ann.target_audience || [],
          category: ann.category || 'general'
        })) : [];
      },
      enabled: !!selectedBranch && !!userRole,
      staleTime: 120000, // 2 minutes
      refetchInterval: 300000
    });
  };

  // Parent Overview Widget
  const useParentOverview = () => {
    return useQuery({
      queryKey: ['parent-overview', user?.id],
      queryFn: async () => {
        // Fetch children data for this parent
        const { data: parentData, error } = await apiClient.get(`/parents/${user?.id}/children`);
        if (error) throw new Error(error);

        // If parent API doesn't exist, fallback to students with parent filter
        if (!parentData) {
          const { data: students, error: studentsError } = await apiClient.getStudents({
            parent_id: user?.id
          });
          if (studentsError) throw new Error(studentsError);
          
          const children = Array.isArray(students?.items) ? students.items : [];
          return await Promise.all(children.map(async (student: any) => {
            // Get recent exam results
            const { data: examResults } = await apiClient.get(`/exam-results/?student_id=${student.id}&limit=1`);
            const recentResult = Array.isArray(examResults) && examResults.length > 0 ? examResults[0] : null;
            
            // Get attendance data
            const { data: attendance } = await apiClient.get(`/attendance/?student_id=${student.id}`);
            const attendanceRecords = Array.isArray(attendance) ? attendance : [];
            const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
            const totalDays = attendanceRecords.length;
            const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 100;
            
            // Get fee status
            const { data: fees } = await apiClient.getFees();
            const studentFees = Array.isArray(fees) ? fees.filter(f => f.student_id === student.id) : [];
            const unpaidFees = studentFees.filter(f => f.status === 'unpaid');
            const totalUnpaid = unpaidFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
            
            return {
              id: student.id,
              name: student.full_name,
              grade: student.grade_level,
              class: student.class_name || 'TBA',
              status: student.status || 'active',
              recentGrade: recentResult ? {
                subject: recentResult.subject || 'General',
                score: recentResult.score || 0,
                date: recentResult.exam_date || new Date().toISOString()
              } : null,
              attendance: {
                rate: Math.round(attendanceRate),
                thisWeek: attendanceRecords.filter(a => {
                  const recordDate = new Date(a.attendance_date);
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return recordDate > weekAgo && a.status === 'present';
                }).length
              },
              fees: {
                status: totalUnpaid > 0 ? 'pending' : 'paid',
                amount: totalUnpaid
              },
              alerts: [
                ...(attendanceRate < 80 ? ['Low attendance rate'] : []),
                ...(totalUnpaid > 0 ? [`Outstanding fees: $${totalUnpaid}`] : [])
              ]
            };
          }));
        }

        return Array.isArray(parentData) ? parentData : [];
      },
      enabled: isParent && !!user?.id,
      staleTime: 300000,
      refetchInterval: 600000
    });
  };

  // Fee Status Widget
  const useFeeStatus = () => {
    return useQuery({
      queryKey: ['fee-status', user?.id],
      queryFn: async () => {
        // Fetch fee records for this student
        const { data: fees, error: feesError } = await apiClient.getFees();
        if (feesError) throw new Error(feesError);

        // Also fetch registration payments
        const { data: regPayments, error: regError } = await apiClient.get('/registration-payments/');
        
        const studentFees = Array.isArray(fees) ? fees.filter((fee: any) => 
          fee.student_id === user?.id
        ) : [];
        
        const studentRegPayments = Array.isArray(regPayments) && !regError ? regPayments.filter((payment: any) => 
          payment.student_id === user?.id
        ) : [];

        // Calculate fee summary
        const feeAmount = studentFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
        const regAmount = studentRegPayments.reduce((sum, payment) => sum + (payment.total_amount || 0), 0);
        const totalAmount = feeAmount + regAmount;
        
        const paidFees = studentFees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + (fee.amount || 0), 0);
        const paidReg = studentRegPayments.filter(payment => payment.payment_status === 'Paid').reduce((sum, payment) => sum + (payment.amount_paid || 0), 0);
        const paidAmount = paidFees + paidReg;

        // Get payment history
        const feeHistory = studentFees.map(fee => ({
          date: fee.paid_date || fee.due_date,
          amount: fee.amount,
          description: fee.fee_type || 'Fee',
          status: fee.status
        }));
        
        const regHistory = studentRegPayments.map(payment => ({
          date: payment.payment_date || payment.created_at,
          amount: payment.amount_paid || 0,
          description: 'Registration Fee',
          status: payment.payment_status?.toLowerCase() || 'pending'
        }));

        return {
          student: user?.full_name,
          academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
          total: {
            total: totalAmount,
            registration: regAmount,
            fees: feeAmount,
            materials: 0,
            activities: 0,
            transport: 0
          },
          paid: {
            total: paidAmount
          },
          outstanding: {
            total: totalAmount - paidAmount
          },
          paymentHistory: [...feeHistory, ...regHistory].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          ),
          upcomingDue: studentFees
            .filter(fee => fee.status === 'unpaid' && new Date(fee.due_date || new Date()) > new Date())
            .map(fee => ({
              item: fee.fee_type || 'Fee',
              amount: fee.amount,
              dueDate: fee.due_date,
              category: fee.fee_type || 'general'
            }))
        };
      },
      enabled: (isStudent || isParent) && !!user?.id,
      staleTime: 300000,
      refetchInterval: 600000
    });
  };

  // Homework Summary Widget
  const useHomeworkSummary = () => {
    return useQuery({
      queryKey: ['homework-summary', userRole, user?.id],
      queryFn: async () => {
        let endpoint = '/homework/stats/summary';
        if (userRole === 'student') {
          endpoint = '/homework/stats/student';
        } else if (userRole === 'teacher') {
          endpoint = '/homework/stats/teacher';
        } else if (userRole === 'parent') {
          endpoint = '/homework/stats/parent';
        }
        
        const { data, error } = await apiClient.get(endpoint);
        if (error) throw new Error(error);
        return data;
      },
      enabled: !!user?.id && ['student', 'teacher', 'parent'].includes(userRole),
      staleTime: 300000, // 5 minutes
      refetchInterval: 300000
    });
  };

  // Assignment Calendar Widget
  const useAssignmentCalendar = () => {
    return useQuery({
      queryKey: ['assignment-calendar', userRole, user?.id, new Date().toISOString().split('T')[0]],
      queryFn: async () => {
        let endpoint = '/homework/assignments/calendar';
        if (userRole === 'student') {
          endpoint = '/homework/assignments/student/calendar';
        } else if (userRole === 'teacher') {
          endpoint = '/homework/assignments/teacher/calendar';
        } else if (userRole === 'parent') {
          endpoint = '/homework/assignments/parent/calendar';
        }
        
        const startDate = new Date();
        startDate.setDate(1); // First day of current month
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1, 0); // Last day of current month
        
        const { data, error } = await apiClient.get(endpoint, {
          params: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString()
          }
        });
        if (error) throw new Error(error);
        return data?.assignments || [];
      },
      enabled: !!user?.id && ['student', 'teacher', 'parent'].includes(userRole),
      staleTime: 300000,
      refetchInterval: 300000
    });
  };

  // Teacher Grading Widget
  const useTeacherGrading = () => {
    return useQuery({
      queryKey: ['teacher-grading-stats', user?.id],
      queryFn: async () => {
        const { data, error } = await apiClient.get('/homework/stats/teacher/grading');
        if (error) throw new Error(error);
        return data;
      },
      enabled: isTeacher && !!user?.id,
      staleTime: 120000, // 2 minutes
      refetchInterval: 120000
    });
  };

  return {
    // Admin widgets
    useAdminStats,
    usePaymentCollection,
    useAttendanceOverview,
    useSystemStatus,
    
    // Teacher widgets
    useTeacherSchedule,
    usePendingGrades,
    useTeacherNotifications,
    useStudentProgress,
    useTeacherGrading,
    
    // Student/Parent widgets
    useStudentGrades,
    useUpcomingExams,
    useAttendanceSummary,
    useAnnouncements,
    useParentOverview,
    useFeeStatus,
    
    // Homework widgets
    useHomeworkSummary,
    useAssignmentCalendar
  };
};
