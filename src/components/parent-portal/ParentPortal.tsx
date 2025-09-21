import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  GraduationCap, 
  Calendar, 
  DollarSign,
  MessageCircle,
  FileText,
  Award,
  Clock,
  Phone,
  Mail,
  MapPin,
  BookOpen,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { StudentDashboard } from './StudentDashboard';
import { AcademicProgress } from './AcademicProgress';
import { AttendanceTracking } from './AttendanceTracking';
import { PaymentPortal } from './PaymentPortal';
import { CommunicationCenter } from './CommunicationCenter';
import { ParentSettings } from './ParentSettings';
import { useWebSocket, MessageType, SubscriptionType } from '@/hooks/useWebSocket';

interface ParentInfo {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  relationship: string;
  children: StudentSummary[];
}

interface StudentSummary {
  id: string;
  student_id: string;
  full_name: string;
  grade_level: string;
  class_name: string;
  overall_grade?: string;
  attendance_percentage: number;
  behavior_points: number;
  outstanding_balance: number;
  recent_activity: string[];
}

interface DashboardStats {
  total_children: number;
  active_notifications: number;
  upcoming_events: number;
  pending_payments: number;
  recent_grades: number;
  attendance_alerts: number;
}

export const ParentPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [realtimeNotifications, setRealtimeNotifications] = useState<any[]>([]);
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [latestNotification, setLatestNotification] = useState<any>(null);

  // WebSocket integration for real-time notifications
  const { isAuthenticated, lastMessage, subscribe } = useWebSocket({
    onMessage: (message) => {
      // Handle parent-specific real-time notifications
      if (message.type === MessageType.NOTIFICATION) {
        const notification = message.payload;
        
        // Add to realtime notifications
        setRealtimeNotifications(prev => [notification, ...prev.slice(0, 9)]);
        setLatestNotification(notification);
        setShowNotificationToast(true);
        
        // Auto-hide toast after 5 seconds
        setTimeout(() => setShowNotificationToast(false), 5000);
        
        // Play notification sound if enabled
        if (notification.urgency === 'high' && 'Notification' in window) {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico'
          });
        }
      } else if (message.type === MessageType.DATA_UPDATE) {
        // Handle real-time data updates (grades, attendance, etc.)
        console.log('Real-time data update received:', message.payload);
      }
    },
    autoConnect: true,
    enableSubscriptions: true
  });

  // Subscribe to parent-specific notifications when authenticated
  React.useEffect(() => {
    if (isAuthenticated && parentInfo?.id) {
      // Subscribe to parent notifications
      subscribe(SubscriptionType.NOTIFICATIONS, `parent:${parentInfo.id}`);
      
      // Subscribe to children's data updates
      parentInfo.children.forEach(child => {
        subscribe(SubscriptionType.USER_DATA, `student:${child.id}`);
      });
    }
  }, [isAuthenticated, parentInfo, subscribe]);

  const { data: parentInfo, isLoading: parentLoading, error: parentError } = useQuery<ParentInfo>({
    queryKey: ['parent-info'],
    queryFn: async () => {
      const response = await apiClient.get('/communication/parent-info');
      return response.data;
    },
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: dashboardStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['parent-dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/communication/parent-dashboard/stats');
      return response.data;
    },
    enabled: !!parentInfo?.id,
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['parent-notifications'],
    queryFn: async () => {
      const response = await apiClient.get('/notifications/user-notifications?limit=5');
      return response.data;
    },
  });

  if (parentLoading || statsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (parentError) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Parent Portal</h2>
            <p className="text-gray-600 mb-4">
              There was an error loading your parent portal data. Please check your connection and try again.
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!parentInfo) {
    return (
      <div className="text-center py-8">
        <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Unable to load parent information</p>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, description, color = "blue" }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description: string;
    color?: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 text-${color}-600`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

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

  return (
    <div className="space-y-6">
      {/* Real-time Notification Toast */}
      {showNotificationToast && latestNotification && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg p-4 animate-slide-in">
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-full ${
              latestNotification.type === 'grade_update' ? 'bg-green-100' :
              latestNotification.type === 'attendance_alert' ? 'bg-yellow-100' :
              latestNotification.type === 'payment_due' ? 'bg-red-100' :
              'bg-blue-100'
            }`}>
              {latestNotification.type === 'grade_update' ? (
                <Award className="h-4 w-4 text-green-600" />
              ) : latestNotification.type === 'attendance_alert' ? (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              ) : latestNotification.type === 'payment_due' ? (
                <DollarSign className="h-4 w-4 text-red-600" />
              ) : (
                <MessageCircle className="h-4 w-4 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm text-gray-900">{latestNotification.title}</h4>
              <p className="text-sm text-gray-600 line-clamp-2">{latestNotification.message}</p>
              <p className="text-xs text-gray-400 mt-1">Just now</p>
            </div>
            <button
              onClick={() => setShowNotificationToast(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header with Parent Info - Mobile Responsive */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Welcome, {parentInfo.full_name}</h1>
            <p className="text-blue-100 mt-1 text-sm sm:text-base">Parent Portal - Stay connected with your child's education</p>
          </div>
          <div className="text-left sm:text-right text-blue-100">
            <div className="flex items-center mb-1 text-sm sm:text-base">
              <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
              <span className="break-all sm:break-normal">{parentInfo.email}</span>
            </div>
            {parentInfo.phone && (
              <div className="flex items-center mb-1 text-sm sm:text-base">
                <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
                {parentInfo.phone}
              </div>
            )}
            <div className="text-xs sm:text-sm">
              {parentInfo.children.length} {parentInfo.children.length === 1 ? 'child' : 'children'} enrolled
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* Mobile-first responsive tab navigation */}
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 min-w-max">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
              <span className="sm:hidden">📊</span>
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="students" className="text-xs sm:text-sm">
              <span className="sm:hidden">👨‍👩‍👧‍👦</span>
              <span className="hidden sm:inline">My Children</span>
            </TabsTrigger>
            <TabsTrigger value="academic" className="text-xs sm:text-sm">
              <span className="sm:hidden">📚</span>
              <span className="hidden sm:inline">Academic</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs sm:text-sm">
              <span className="sm:hidden">⏰</span>
              <span className="hidden sm:inline">Attendance</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm">
              <span className="sm:hidden">💳</span>
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="communication" className="text-xs sm:text-sm">
              <span className="sm:hidden">✉️</span>
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Quick Stats - Mobile Responsive */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="My Children"
              value={dashboardStats?.total_children || parentInfo.children.length}
              icon={User}
              description="Enrolled students"
              color="blue"
            />
            <StatCard
              title="New Messages"
              value={dashboardStats?.active_notifications || 0}
              icon={MessageCircle}
              description="Unread notifications"
              color="green"
            />
            <StatCard
              title="Upcoming Events"
              value={dashboardStats?.upcoming_events || 0}
              icon={Calendar}
              description="School events this week"
              color="purple"
            />
            <StatCard
              title="Pending Payments"
              value={dashboardStats?.pending_payments || 0}
              icon={DollarSign}
              description="Outstanding fees"
              color="orange"
            />
          </div>

          {/* Children Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <GraduationCap className="h-5 w-5 mr-2" />
                Children Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {parentInfo.children.map((child) => (
                  <Card key={child.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{child.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {child.grade_level} - {child.class_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            ID: {child.student_id}
                          </p>
                        </div>
                        {child.overall_grade && (
                          <Badge variant="outline" className="text-lg px-3 py-1">
                            {child.overall_grade}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Attendance</p>
                          <p className={`font-bold ${getAttendanceColor(child.attendance_percentage)}`}>
                            {child.attendance_percentage.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Behavior</p>
                          <p className={`font-bold ${getBehaviorColor(child.behavior_points)}`}>
                            {child.behavior_points} pts
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Balance</p>
                          <p className={`font-bold ${child.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${child.outstanding_balance.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {child.recent_activity.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Recent Activity:</p>
                          <div className="space-y-1">
                            {child.recent_activity.slice(0, 2).map((activity, index) => (
                              <p key={index} className="text-xs text-gray-600">• {activity}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-3"
                        onClick={() => {
                          setSelectedChild(child.id);
                          setActiveTab('students');
                        }}
                      >
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Recent Notifications
                </div>
                {isAuthenticated && (
                  <div className="flex items-center text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    Live Updates
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Show real-time notifications first */}
              {realtimeNotifications.length > 0 && (
                <>
                  {realtimeNotifications.map((notification: any, index: number) => (
                    <div key={`realtime-${index}`} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border-l-4 border-l-green-500 mb-3">
                      <div className="flex-shrink-0 p-2 bg-green-100 rounded-full">
                        {notification.type === 'grade_update' ? (
                          <Award className="h-4 w-4 text-green-600" />
                        ) : notification.type === 'attendance_alert' ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        ) : notification.type === 'payment_due' ? (
                          <DollarSign className="h-4 w-4 text-red-600" />
                        ) : (
                          <MessageCircle className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-800">NEW</Badge>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">Just now</p>
                      </div>
                    </div>
                  ))}
                  {notifications.length > 0 && <div className="border-t border-gray-200 my-4"></div>}
                </>
              )}
              
              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notification: any) => (
                    <div key={notification.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full">
                        <MessageCircle className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{notification.title}</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No recent notifications</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
                <Button 
                  variant="outline" 
                  className="h-16 sm:h-20 flex flex-col items-center justify-center text-xs sm:text-sm"
                  onClick={() => setActiveTab('academic')}
                >
                  <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                  <span className="text-center">View Grades</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-16 sm:h-20 flex flex-col items-center justify-center text-xs sm:text-sm"
                  onClick={() => setActiveTab('attendance')}
                >
                  <Clock className="h-4 w-4 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                  <span className="text-center">Check Attendance</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-16 sm:h-20 flex flex-col items-center justify-center text-xs sm:text-sm"
                  onClick={() => setActiveTab('payments')}
                >
                  <DollarSign className="h-4 w-4 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                  <span className="text-center">Make Payment</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-16 sm:h-20 flex flex-col items-center justify-center text-xs sm:text-sm"
                  onClick={() => setActiveTab('communication')}
                >
                  <MessageCircle className="h-4 w-4 sm:h-6 sm:w-6 mb-1 sm:mb-2" />
                  <span className="text-center">Send Message</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <StudentDashboard 
            children={parentInfo.children} 
            selectedChild={selectedChild}
            onChildSelect={setSelectedChild}
          />
        </TabsContent>

        <TabsContent value="academic">
          <AcademicProgress 
            children={parentInfo.children}
            selectedChild={selectedChild}
            onChildSelect={setSelectedChild}
          />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceTracking 
            children={parentInfo.children}
            selectedChild={selectedChild}
            onChildSelect={setSelectedChild}
          />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentPortal 
            children={parentInfo.children}
            parentInfo={parentInfo}
          />
        </TabsContent>

        <TabsContent value="communication">
          <CommunicationCenter 
            parentInfo={parentInfo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};