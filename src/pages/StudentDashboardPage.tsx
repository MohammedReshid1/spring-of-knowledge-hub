import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLiveData } from '@/hooks/useLiveData';
import { LiveUpdatesIndicator } from '@/components/common/LiveUpdatesIndicator';
import { getImageUrl } from '@/utils/imageUtils';
import {
  User,
  Calendar,
  BookOpen,
  Award,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Target,
  TrendingUp
} from 'lucide-react';

interface StudentDetails {
  basic_info: {
    full_name: string;
    student_id: string;
    grade_level: string;
    class_name?: string;
    date_of_birth?: string;
    enrollment_date?: string;
    profile_picture?: string;
  };
  academic_performance?: {
    overall_grade?: string;
    overall_percentage?: number;
    subject_grades?: Record<string, string>;
    recent_assignments?: Array<{
      subject: string;
      title: string;
      grade: string;
      date: string;
    }>;
    upcoming_exams?: Array<{
      subject: string;
      exam_name: string;
      date: string;
    }>;
  };
  attendance?: {
    total_days: number;
    days_present: number;
    days_absent: number;
    attendance_percentage: number;
    recent_attendance?: Array<{
      date: string;
      status: string;
      remarks?: string;
    }>;
  };
  behavior?: {
    total_positive_points: number;
    total_negative_points: number;
    behavior_balance: number;
    recent_incidents?: Array<{
      date: string;
      type: string;
      description: string;
      points: number;
    }>;
    achievements?: Array<{
      date: string;
      title: string;
      description: string;
    }>;
  };
  financial?: {
    total_fees: number;
    amount_paid: number;
    outstanding_balance: number;
    recent_payments?: Array<{
      date: string;
      amount: number;
      description: string;
    }>;
  };
}

const StudentDashboardPage: React.FC = () => {
  const { student, user } = useAuth();

  // Debug logging - check what properties the student object actually has
  console.log('StudentDashboardPage - Debug:', {
    student,
    user,
    student_id: student?.student_id,
    student_full_name: student?.full_name,
    student_grade_level: student?.grade_level,
    hasStudent: !!student,
    hasUser: !!user,
    allStudentProps: student ? Object.keys(student) : [],
    allUserProps: user ? Object.keys(user) : [],
    studentObjectFull: student,
    userObjectFull: user
  });

  // Get student ID from student object or user object
  // IMPORTANT: We need the actual student_id string (like "SCH-2025-00002"), not the MongoDB ObjectId
  // Priority: student.student_id > user.student_id > fallback to user.id
  const studentId = student?.student_id || (user as any)?.student_id || student?.id || user?.id;

  console.log('Resolved student ID:', studentId);
  console.log('Student object:', student);
  console.log('User object keys:', user ? Object.keys(user) : 'no user');
  console.log('User object full:', user);

  // Enable real-time updates for student dashboard
  useLiveData(['students', 'attendance', 'grades', 'exams', 'behavior', 'payments', 'assignments'], {
    additionalQueryKeys: ['student-details']
  });

  // Fetch student dashboard data from the dedicated student endpoint
  const { data: studentDetails, isLoading, error } = useQuery<StudentDetails>({
    queryKey: ['student-dashboard', studentId],
    queryFn: async () => {
      console.log('Fetching student dashboard for student_id:', studentId);
      if (!studentId) throw new Error('No student ID available');
      const response = await apiClient.get(`/auth/student/dashboard/${studentId}`);
      console.log('Student dashboard response:', response);
      return response.data;
    },
    enabled: !!studentId && !!student,
    retry: 1,
    onError: (err) => {
      console.error('Error fetching student dashboard:', err);
    },
  });

  // Show loading only if we're fetching and don't have basic student info
  if (isLoading && !student) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't show error - just use basic student info from auth context
  // if (error) {
  //   console.warn('Failed to load detailed student data:', error);
  // }

  if (!student && !studentDetails && !user) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No student data available</p>
          <p className="text-sm text-muted-foreground mt-2">Please log in as a student to view this page</p>
        </CardContent>
      </Card>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-100 text-green-800';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800';
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-800';
    if (grade.startsWith('D')) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getAttendanceStatus = (status: string) => {
    switch (status) {
      case 'present': return { color: 'text-green-600', icon: CheckCircle };
      case 'absent': return { color: 'text-red-600', icon: AlertTriangle };
      case 'late': return { color: 'text-yellow-600', icon: Clock };
      default: return { color: 'text-gray-600', icon: Calendar };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Use data from studentDetails API response if available, otherwise fall back to auth context
  const basicInfo = {
    full_name: studentDetails?.basic_info?.full_name || student?.full_name || user?.full_name || 'Student',
    student_id: studentDetails?.basic_info?.student_id || studentId || 'N/A',
    grade_level: studentDetails?.basic_info?.grade_level || student?.grade_level || user?.grade_level || 'N/A',
    class_name: studentDetails?.basic_info?.class_name || student?.section || student?.class_name || 'Not assigned',
    profile_picture: studentDetails?.basic_info?.profile_picture || student?.profile_picture || user?.profile_picture
  };

  console.log('BasicInfo constructed:', basicInfo);
  console.log('StudentDetails from API:', studentDetails);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold">{getGreeting()}, {basicInfo.full_name.split(' ')[0]}</h1>
            <p className="text-muted-foreground">Welcome to your student dashboard</p>
          </div>
          <LiveUpdatesIndicator />
        </div>
      </div>

      {/* Student Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold overflow-hidden">
                {basicInfo.profile_picture ? (
                  <img
                    src={getImageUrl(basicInfo.profile_picture)}
                    alt={basicInfo.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{basicInfo.full_name.split(' ').map(n => n[0]).join('')}</span>
                )}
              </div>
              <div>
                <h3 className="text-2xl font-bold">{basicInfo.full_name}</h3>
                <p className="text-muted-foreground">
                  {basicInfo.class_name}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  Student ID: {basicInfo.student_id}
                </p>
              </div>
            </div>
            {studentDetails?.academic_performance?.overall_grade && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Overall Grade</p>
                <Badge className={`text-2xl px-4 py-2 ${getGradeColor(studentDetails.academic_performance.overall_grade)}`}>
                  {studentDetails.academic_performance.overall_grade}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats - Financial info hidden for students, shown only in parent portal */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Academic Performance</p>
                <p className="text-2xl font-bold">
                  {studentDetails?.academic_performance?.overall_percentage?.toFixed(1) || 'N/A'}%
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Attendance Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {studentDetails?.attendance?.attendance_percentage?.toFixed(1) || 'N/A'}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Behavior Points</p>
                <p className={`text-2xl font-bold ${(studentDetails?.behavior?.behavior_balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {studentDetails?.behavior?.behavior_balance || 0}
                </p>
              </div>
              <Award className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Academic Performance */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              Subject Grades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentDetails?.academic_performance?.subject_grades ? (
              <div className="space-y-3">
                {Object.entries(studentDetails.academic_performance.subject_grades).map(([subject, grade]) => (
                  <div key={subject} className="flex justify-between items-center">
                    <span className="font-medium capitalize">{subject.replace('_', ' ')}</span>
                    <Badge className={getGradeColor(grade as string)}>{grade}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No grade data available yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Recent Exam Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentDetails?.academic_performance?.recent_assignments && studentDetails.academic_performance.recent_assignments.length > 0 ? (
              <div className="space-y-3">
                {studentDetails.academic_performance.recent_assignments.slice(0, 5).map((assignment, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-1">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">{assignment.subject}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <Badge className={getGradeColor(assignment.grade)}>{assignment.grade}</Badge>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(assignment.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent exam results</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Exams */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Upcoming Exams
          </CardTitle>
        </CardHeader>
        <CardContent>
          {studentDetails?.academic_performance?.upcoming_exams && studentDetails.academic_performance.upcoming_exams.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {studentDetails.academic_performance.upcoming_exams.map((exam, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{exam.exam_name}</h4>
                      <p className="text-sm text-muted-foreground">{exam.subject}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="whitespace-nowrap">{formatDateTime(exam.date)}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming exams scheduled</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDashboardPage;
