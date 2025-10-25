import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Award,
  Users,
  AlertCircle,
  RefreshCw,
  Home,
  ChevronRight,
  TrendingUp,
  GraduationCap,
  BarChart3
} from 'lucide-react';
import { StudentResultsViewer } from '@/components/exams/StudentResultsViewer';

/**
 * Parent & Student Exams Page - Enhanced Version
 *
 * A comprehensive page for students and parents to view exam results and grades.
 * Features include:
 * - Parent support with child selection
 * - Student view for their own exams
 * - Quick stats and overview cards
 * - Loading states and error handling
 * - Responsive design with breadcrumb navigation
 */
const ParentStudentExamsPage: React.FC = () => {
  const { student, user } = useAuth();
  const { selectedBranch } = useBranch();

  // Detect if user is a parent or student
  const isParent = user?.role === 'parent';
  const isStudent = !!student || user?.role === 'student';
  const parentId = (user as any)?.parent_id;

  // State for selected child (parents only)
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  // Fetch parent's children if user is a parent
  const {
    data: parentChildren = [],
    isLoading: isLoadingChildren,
    error: childrenError,
    refetch: refetchChildren
  } = useQuery({
    queryKey: ['parent-children', parentId, selectedBranch],
    queryFn: async () => {
      if (!parentId) return [];
      const { data, error } = await apiClient.getStudents({
        parent_id: parentId,
        branch_id: selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
        limit: 100
      });
      if (error) throw error;
      const items = data?.items;
      // Transform students to include full_name if missing
      const students = Array.isArray(items) ? items.map((student: any) => ({
        ...student,
        full_name: student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim()
      })) : [];
      return students;
    },
    enabled: isParent && !!parentId,
    staleTime: 60000,
    retry: 2
  });

  // Set initial selected child when children are loaded
  React.useEffect(() => {
    if (isParent && parentChildren.length > 0) {
      // Check if selectedChildId is not already set to a valid child
      const isValidChildId = parentChildren.some(child => child.student_id === selectedChildId);
      if (!isValidChildId) {
        setSelectedChildId(parentChildren[0].student_id);
      }
    }
  }, [parentChildren, selectedChildId, isParent]);

  // Get student ID from student object or user object or selected child
  const studentId = isParent
    ? selectedChildId
    : student?.student_id || (user as any)?.student_id || student?.id || user?.id;

  // Get student name for display
  const studentName = isParent
    ? parentChildren.find(c => c.student_id === selectedChildId)?.full_name || 'Child'
    : student?.full_name || user?.full_name || 'Student';

  // Breadcrumb navigation
  const renderBreadcrumb = () => (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
      <Home className="h-4 w-4" />
      <ChevronRight className="h-4 w-4" />
      <span className="font-medium">
        {isParent ? 'Parent Portal' : 'Student Dashboard'}
      </span>
      <ChevronRight className="h-4 w-4" />
      <span className="text-foreground font-semibold">Exams & Results</span>
    </nav>
  );

  // Loading skeleton for parent children
  const renderChildrenLoadingSkeleton = () => (
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
    const totalChildren = parentChildren.length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">
                  {isParent ? 'Viewing Results For' : 'Student'}
                </p>
                <p className="text-xs text-blue-700 font-semibold mt-1 truncate max-w-[200px]">
                  {studentName}
                </p>
              </div>
              <GraduationCap className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {isParent ? (
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">My Children</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">{totalChildren}</p>
                </div>
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Performance</p>
                  <p className="text-xs text-green-700 mt-1">View your exam results</p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Academic Progress</p>
                <p className="text-xs text-orange-500 mt-1">Track performance</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Error state for children loading
  if (isParent && childrenError) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {renderBreadcrumb()}
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Children</AlertTitle>
          <AlertDescription>
            Failed to load your children's information. Please try again.
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetchChildren()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Loading state for parent children
  if (isParent && isLoadingChildren) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {renderChildrenLoadingSkeleton()}
      </div>
    );
  }

  // Empty state for parents with no children
  if (isParent && parentChildren.length === 0) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {renderBreadcrumb()}
        <Card className="border-2 border-dashed">
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Children Found</h3>
            <p className="text-muted-foreground mb-4">
              You don't have any children registered in the system yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact the school administration to register your children.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in state
  if (!student && !user) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {renderBreadcrumb()}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please log in to view exam results
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No student ID available
  if (!studentId && !isParent) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {renderBreadcrumb()}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Student ID Missing</AlertTitle>
          <AlertDescription>
            No student ID available. Please contact support.
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Award className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isParent ? "Children's Exam Results" : 'My Exam Results'}
              </h1>
              <p className="text-muted-foreground">
                {isParent
                  ? 'View and track your children\'s academic performance'
                  : 'View your exam results and academic performance'}
              </p>
            </div>
          </div>

          {/* Child Selector for Parents */}
          {isParent && parentChildren.length > 1 && selectedChildId && (
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-muted-foreground">
                Select Child:
              </label>
              <Select
                key={`exam-child-select-${parentChildren.length}-${selectedChildId}`}
                value={selectedChildId}
                onValueChange={setSelectedChildId}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue>
                    {parentChildren.find(c => c.student_id === selectedChildId)?.full_name || "Select child"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {parentChildren.map((child) => (
                    <SelectItem key={child.student_id} value={child.student_id}>
                      {child.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      {renderQuickStats()}

      {/* Helpful Tips Card */}
      {isParent && parentChildren.length > 1 && (
        <Alert className="mb-6 bg-purple-50 border-purple-200">
          <Users className="h-4 w-4 text-purple-600" />
          <AlertTitle className="text-purple-900">Multiple Children</AlertTitle>
          <AlertDescription className="text-purple-700">
            You have {parentChildren.length} children registered. Use the dropdown above
            to switch between their exam results.
          </AlertDescription>
        </Alert>
      )}

      {!isParent && (
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <Award className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900">Track Your Progress</AlertTitle>
          <AlertDescription className="text-blue-700">
            View your exam results, grades, and performance analytics. Work hard and aim for excellence!
          </AlertDescription>
        </Alert>
      )}

      {/* Student Results Viewer - Shows student's exam results with analytics */}
      {studentId && (
        <StudentResultsViewer studentId={studentId} studentName={studentName} />
      )}

      {/* Footer Info */}
      <Card className="mt-6 bg-gray-50 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-start space-x-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">Need Help?</p>
              <p>
                If you notice any discrepancies in exam results or have questions about grades,
                please contact your class teacher or the examination office.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ParentStudentExamsPage;
