import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLiveData } from '@/hooks/useLiveData';
import { LiveUpdatesIndicator } from '@/components/common/LiveUpdatesIndicator';
import { getImageUrl } from '@/utils/imageUtils';
import {
  User,
  Users,
  Calendar,
  BookOpen,
  Award,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Bell,
  TrendingUp,
  GraduationCap
} from 'lucide-react';

interface ParentDashboardData {
  basic_info: {
    full_name: string;
    parent_id: string;
    email?: string;
    phone?: string;
    relationship: string;
    address?: string;
  };
  summary: {
    total_children: number;
    average_attendance: number;
    average_behavior: number;
    total_outstanding_balance: number;
    unread_notifications: number;
  };
  children: Array<{
    id: string;
    student_id: string;
    full_name: string;
    grade_level: string;
    class_name: string;
    profile_picture?: string;
    overall_grade: string;
    overall_percentage: number;
    attendance_percentage: number;
    behavior_points: number;
    outstanding_balance: number;
  }>;
  recent_activities: Array<{
    student_name: string;
    type: string;
    message: string;
    date: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    created_at: string;
    read: boolean;
  }>;
}

const ParentDashboardPage: React.FC = () => {
  const { user } = useAuth();

  console.log('ParentDashboardPage - user:', user);
  console.log('User ID:', user?.id);
  console.log('User role:', user?.role);

  // Enable real-time updates for parent dashboard
  useLiveData(['students', 'attendance', 'grades', 'exams', 'behavior', 'payments', 'notifications'], {
    additionalQueryKeys: ['parent-dashboard']
  });

  // Fetch parent dashboard data from the dedicated parent endpoint
  // IMPORTANT: Use parent_id from JWT token, not user.id
  const parentId = (user as any)?.parent_id || user?.id;

  const { data: parentDashboard, isLoading, error } = useQuery<ParentDashboardData>({
    queryKey: ['parent-dashboard', parentId],
    queryFn: async () => {
      console.log('Fetching parent dashboard for parent_id:', parentId);
      if (!parentId) throw new Error('No parent ID available');
      const response = await apiClient.get(`/auth/parent/dashboard/${parentId}`);
      console.log('Parent dashboard response:', response);
      return response.data;
    },
    enabled: !!parentId && user?.role === 'parent',
    retry: 1,
    onError: (err) => {
      console.error('Error fetching parent dashboard:', err);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="m-6">
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-600 mb-4" />
          <p className="text-red-600 font-semibold mb-2">Error Loading Dashboard</p>
          <p className="text-muted-foreground text-sm">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!parentDashboard) {
    return (
      <Card className="m-6">
        <CardContent className="text-center py-8">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No parent data available</p>
          <p className="text-sm text-muted-foreground mt-2">Please log in as a parent to view this page</p>
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

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 95) return 'text-green-600';
    if (percentage >= 90) return 'text-blue-600';
    if (percentage >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBehaviorColor = (points: number) => {
    if (points >= 80) return 'text-green-600';
    if (points >= 60) return 'text-blue-600';
    if (points >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const basicInfo = parentDashboard.basic_info;
  const summary = parentDashboard.summary;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold">{getGreeting()}, {basicInfo.full_name.split(' ')[0]}</h1>
            <p className="text-muted-foreground">Welcome to your parent dashboard</p>
          </div>
          <LiveUpdatesIndicator />
        </div>
      </div>

      {/* Parent Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {basicInfo.full_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h3 className="text-2xl font-bold">{basicInfo.full_name}</h3>
                <p className="text-muted-foreground">{basicInfo.relationship}</p>
                {basicInfo.email && (
                  <p className="text-sm text-muted-foreground">{basicInfo.email}</p>
                )}
                {basicInfo.phone && (
                  <p className="text-sm text-muted-foreground">{basicInfo.phone}</p>
                )}
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Children</p>
              <Badge className="text-2xl px-4 py-2 bg-purple-100 text-purple-800">
                {summary.total_children}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Attendance</p>
                <p className={`text-2xl font-bold ${getAttendanceColor(summary.average_attendance)}`}>
                  {summary.average_attendance.toFixed(1)}%
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
                <p className="text-sm font-medium text-muted-foreground">Avg. Behavior</p>
                <p className={`text-2xl font-bold ${getBehaviorColor(summary.average_behavior)}`}>
                  {summary.average_behavior.toFixed(0)} pts
                </p>
              </div>
              <Award className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
                <p className={`text-2xl font-bold ${summary.total_outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(summary.total_outstanding_balance)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Notifications</p>
                <p className="text-2xl font-bold text-blue-600">
                  {summary.unread_notifications}
                </p>
              </div>
              <Bell className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Children Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <GraduationCap className="h-5 w-5 mr-2" />
            My Children
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {parentDashboard.children.map((child) => (
              <Card key={child.id} className="border-l-4 border-l-purple-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                        {child.profile_picture ? (
                          <img
                            src={getImageUrl(child.profile_picture)}
                            alt={child.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{child.full_name.split(' ').map(n => n[0]).join('')}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{child.full_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {child.grade_level} - {child.class_name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          ID: {child.student_id}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-lg px-3 py-1 ${getGradeColor(child.overall_grade)}`}>
                      {child.overall_grade}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Performance</p>
                      <p className="font-bold text-sm">{child.overall_percentage.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Attendance</p>
                      <p className={`font-bold text-sm ${getAttendanceColor(child.attendance_percentage)}`}>
                        {child.attendance_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Behavior</p>
                      <p className={`font-bold text-sm ${getBehaviorColor(child.behavior_points)}`}>
                        {child.behavior_points} pts
                      </p>
                    </div>
                  </div>

                  {child.outstanding_balance > 0 && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-center">
                      <p className="text-xs text-red-600 font-medium">
                        Outstanding: {formatCurrency(child.outstanding_balance)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities and Notifications */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {parentDashboard.recent_activities && parentDashboard.recent_activities.length > 0 ? (
              <div className="space-y-3">
                {parentDashboard.recent_activities.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full">
                      {activity.type === 'grade_update' ? (
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      ) : activity.type === 'attendance_alert' ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.student_name}</p>
                      <p className="text-sm text-gray-600">{activity.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(activity.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No recent activities</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {parentDashboard.notifications && parentDashboard.notifications.length > 0 ? (
              <div className="space-y-3">
                {parentDashboard.notifications.slice(0, 5).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border ${
                      notification.read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(notification.created_at)}</p>
                      </div>
                      {!notification.read && (
                        <Badge className="bg-blue-600 text-white text-xs">New</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParentDashboardPage;
