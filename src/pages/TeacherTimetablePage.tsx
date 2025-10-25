import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PersonalizedTimetable } from '@/components/timetable/PersonalizedTimetable';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveData } from '@/hooks/useLiveData';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  AlertCircle,
  RefreshCw,
  Home,
  ChevronRight,
  TrendingUp,
  GraduationCap,
  User
} from 'lucide-react';

/**
 * Teacher Timetable Page - Enhanced Version
 *
 * A comprehensive page for teachers to view their personalized teaching schedules.
 * Features include:
 * - Real-time timetable updates via WebSocket
 * - Class selection to view specific class schedules
 * - Quick stats and overview cards
 * - Loading states and error handling
 * - Responsive design with breadcrumb navigation
 */
const TeacherTimetablePage: React.FC = () => {
  const { user } = useAuth();
  const { selectedBranch } = useBranch();
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  // Enable real-time updates for timetable via WebSocket
  useLiveData(['timetable', 'subjects', 'teachers', 'classes'], {
    additionalQueryKeys: ['personal-timetable', 'teacher-classes']
  });

  const userId = user?.id;
  const teacherName = user?.full_name || 'Teacher';

  // Fetch teacher's assigned classes
  const {
    data: teacherClassesData,
    isLoading: classesLoading,
    error: classesError,
    refetch: refetchClasses
  } = useQuery({
    queryKey: ['teacher-classes', userId, selectedBranch],
    queryFn: async () => {
      if (!userId) return { classes: [], summary: null };
      const { data, error } = await apiClient.getTeacherEnhancedClasses(userId);
      if (error) throw error;
      return {
        classes: data?.classes || [],
        summary: data?.summary || null
      };
    },
    enabled: !!userId,
    staleTime: 60000,
    retry: 2
  });

  const teacherClasses = teacherClassesData?.classes || [];
  const summary = teacherClassesData?.summary;

  // Breadcrumb navigation
  const renderBreadcrumb = () => (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
      <Home className="h-4 w-4" />
      <ChevronRight className="h-4 w-4" />
      <span className="font-medium">Teacher Dashboard</span>
      <ChevronRight className="h-4 w-4" />
      <span className="text-foreground font-semibold">Timetable</span>
    </nav>
  );

  // Loading skeleton
  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      {renderBreadcrumb()}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );

  // Quick stats cards
  const renderQuickStats = () => {
    const totalClasses = teacherClasses.length;
    const totalStudents = summary?.total_students || 0;
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Today</p>
                <p className="text-xs text-blue-500 mt-1">{currentDate}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">My Classes</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{totalClasses}</p>
              </div>
              <BookOpen className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total Students</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{totalStudents}</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Error state for classes loading
  if (classesError) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {renderBreadcrumb()}
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Classes</AlertTitle>
          <AlertDescription>
            Failed to load your assigned classes. Please try again.
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetchClasses()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Loading state
  if (classesLoading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {renderLoadingSkeleton()}
      </div>
    );
  }

  // Empty state for teachers with no classes
  if (teacherClasses.length === 0) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {renderBreadcrumb()}
        <Card className="border-2 border-dashed">
          <CardContent className="text-center py-12">
            <BookOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Classes Assigned</h3>
            <p className="text-muted-foreground mb-4">
              You don't have any classes assigned yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact the administration to get classes assigned to you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in state
  if (!user) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {renderBreadcrumb()}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please log in to view your timetable
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {renderBreadcrumb()}

      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Teaching Schedule</h1>
            <p className="text-muted-foreground">
              View your personalized teaching timetable and class schedules
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {renderQuickStats()}

      {/* Class Selection for teachers with multiple classes */}
      {teacherClasses.length > 1 && (
        <Card className="mb-6 bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <BookOpen className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-purple-900 mb-2">Multiple Classes</p>
                <p className="text-sm text-purple-700 mb-3">
                  You are teaching {teacherClasses.length} classes. Select a specific class to view its detailed schedule,
                  or view your complete teaching schedule below.
                </p>
                <div className="flex items-center gap-3">
                  <label htmlFor="class-select" className="text-sm font-medium text-purple-900">
                    Filter by Class:
                  </label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="w-64 bg-white">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {teacherClasses.map((cls: any) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.class_name} ({cls.current_enrollment || 0} students)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Helpful Tips Card */}
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <Clock className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900">Pro Tip</AlertTitle>
        <AlertDescription className="text-blue-700">
          Your timetable updates in real-time. Current classes are highlighted, and you can
          toggle between week and day views for better planning.
        </AlertDescription>
      </Alert>

      {/* Main Timetable Component */}
      <PersonalizedTimetable
        userRole="teacher"
        userId={userId || ''}
        userName={teacherName}
        classId={selectedClassId === 'all' ? undefined : selectedClassId}
      />

      {/* Footer Info */}
      <Card className="mt-6 bg-gray-50 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-start space-x-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">Need Help?</p>
              <p>
                If you notice any discrepancies in your timetable or need to request changes to your schedule,
                please contact the administration office or your department head.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherTimetablePage;
