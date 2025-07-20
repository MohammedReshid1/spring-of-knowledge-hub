import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useBranch } from '@/contexts/BranchContext';
import { useBranchData } from '@/hooks/useBranchData';
import { BranchLoadingWrapper, CardsLoadingSkeleton } from '@/components/common/BranchLoadingWrapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, BookOpen, GraduationCap, TrendingUp, Calendar, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Overview = () => {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin } = useRoleAccess();
  const { selectedBranch, userBranches } = useBranch();
  const { useStudents, useClasses, usePayments, getBranchFilter } = useBranchData();
  const queryClient = useQueryClient();

  // Use branch-filtered data with loading states
  const { data: students, isLoading: isStudentsLoading } = useStudents();
  const { data: classes, isLoading: isClassesLoading } = useClasses();
  const { data: payments, isLoading: isPaymentsLoading } = usePayments();

  // Get accurate counts using proper database queries with branch-aware reset handling
  const { data: dashboardStats, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['dashboard-stats', selectedBranch, getBranchFilter()],
    queryFn: async () => {
      console.log('Fetching dashboard stats for branch:', selectedBranch, 'Filter:', getBranchFilter());
      
      const branchFilter = getBranchFilter();

      // Fetch data from your API client
      const [studentsResponse, classesResponse, paymentsResponse] = await Promise.all([
        apiClient.getStudents(),
        apiClient.getClasses(),
        apiClient.getRegistrationPayments(),
      ]);

      if (studentsResponse.error || classesResponse.error || paymentsResponse.error) {
        console.error('Error fetching dashboard data:', {
          studentsError: studentsResponse.error,
          classesError: classesResponse.error,
          paymentsError: paymentsResponse.error,
        });
        throw new Error('Failed to fetch dashboard data');
      }

      const allStudents = studentsResponse.data || [];
      const allPayments = paymentsResponse.data || [];

      // Apply branch filtering
      const branchStudents = branchFilter ? allStudents.filter(s => s.branch_id === branchFilter) : allStudents;
      const branchPayments = branchFilter ? allPayments.filter(p => p.branch_id === branchFilter) : allPayments;

      const totalStudents = branchStudents.length;
      const activeStudents = branchStudents.filter(s => s.status === 'Active').length;
      const totalClasses = classesResponse.data?.length || 0;

      // Calculate payment stats from actual payment data
      const totalRevenue = branchPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
      const paidStudents = branchPayments.filter(p => p.payment_status === 'Paid').length;
      const unpaidStudents = branchPayments.filter(p => p.payment_status === 'Unpaid').length;
      const pendingPayments = branchPayments.filter(p => p.payment_status === 'Unpaid' || p.payment_status === 'Partially Paid').length;

      // Get recent registrations count
      const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const recentRegistrations = branchStudents.filter(s => new Date(s.created_at) >= thisMonthStart).length;

      // Status breakdown
      const statusCounts: Record<string, number> = branchStudents.reduce((acc, student) => {
        const status = student.status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Grade level utilization
      const gradeUtilization = Object.entries(
        branchStudents.reduce((acc, student) => {
          const grade = student.grade_level || 'unknown';
          acc[grade] = (acc[grade] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([grade, count]) => ({
        grade: grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        utilization: 100,
        enrolled: count,
        capacity: Math.max(count, 10)
      }));

      const result = {
        totalStudents,
        activeStudents,
        totalClasses,
        enrollmentRate: 0,
        totalRevenue,
        paidStudents,
        unpaidStudents,
        recentRegistrations,
        pendingPayments,
        statusCounts,
        gradeUtilization: gradeUtilization.slice(0, 5)
      };

      console.log('Dashboard stats with branch-aware filtering:', result);
      return result;
    },
    enabled: !!user?.id,
    staleTime: 60000, // Cache for 1 minute
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  const isLoading = isDashboardLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-6"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </div>
        <div className="text-center py-8">
          <div className="text-sm text-muted-foreground">
            {selectedBranch === 'all' ? 'Loading data from all branches...' : 
             selectedBranch ? `Loading data for ${userBranches.find(b => b.id === selectedBranch)?.name || 'selected branch'}...` :
             'Loading dashboard data...'}
          </div>
        </div>
      </div>
    );
  }

  const stats = dashboardStats || {
    totalStudents: 0,
    activeStudents: 0,
    totalClasses: 0,
    enrollmentRate: 0,
    totalRevenue: 0,
    paidStudents: 0,
    unpaidStudents: 0,
    recentRegistrations: 0,
    pendingPayments: 0,
    statusCounts: {} as Record<string, number>,
    gradeUtilization: []
  };

  // Get currency from system settings
  const getCurrency = () => {
    const settings = localStorage.getItem('systemSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.currency || 'ETB';
    }
    return 'ETB';
  };

  const formatCurrency = (amount: number) => {
    const currency = getCurrency();
    const symbols = {
      'ETB': 'ETB',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    const symbol = symbols[currency as keyof typeof symbols] || currency;
    
    // For ETB, show the symbol after the amount (consistent with PaymentList)
    if (currency === 'ETB') {
      return `${amount.toFixed(2)} ${symbol}`;
    }
    
    return `${symbol} ${amount.toFixed(2)}`;
  };

  return (
    <BranchLoadingWrapper
      loadingMessage="Loading dashboard data..."
      customSkeleton={<CardsLoadingSkeleton />}
    >
      <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">
          Welcome to the Spring of Knowledge Academy Registration Management System
        </p>
        {selectedBranch && selectedBranch !== 'all' && userBranches.length > 1 && (
          <p className="text-sm text-blue-600 mt-1">
            Currently viewing: {userBranches.find(b => b.id === selectedBranch)?.name || 'Selected Branch'}
          </p>
        )}
        {selectedBranch === 'all' && (
          <p className="text-sm text-green-600 mt-1">
            Currently viewing: All Branches Combined
          </p>
        )}
      </div>

      {/* Main Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total Students</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{stats.totalStudents}</div>
            <p className="text-xs text-blue-600 mt-1">
              {stats.recentRegistrations} new this month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Active Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{stats.activeStudents}</div>
            <p className="text-xs text-green-600 mt-1">
              {stats.totalStudents > 0 ? Math.round((stats.activeStudents / stats.totalStudents) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Active Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{stats.totalClasses}</div>
            <p className="text-xs text-purple-600 mt-1">
              Across all grade levels
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700">Total Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-emerald-600 mt-1">
              All payment records
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Statistics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Payment Status */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Paid</span>
              </div>
              <Badge className="bg-green-100 text-green-800">{stats.paidStudents}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm">Unpaid</span>
              </div>
              <Badge className="bg-red-100 text-red-800">{stats.unpaidStudents}</Badge>
            </div>
            <div className="pt-2">
              <Progress 
                value={stats.totalStudents > 0 ? (stats.paidStudents / stats.totalStudents) * 100 : 0} 
                className="h-2"
              />
              <p className="text-xs text-gray-600 mt-1">
                {stats.totalStudents > 0 ? Math.round((stats.paidStudents / stats.totalStudents) * 100) : 0}% payment completion
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Student Status Breakdown */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Student Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm capitalize">{status.replace('_', ' ')}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
            {Object.keys(stats.statusCounts).length === 0 && (
              <p className="text-sm text-gray-500">No student data available</p>
            )}
          </CardContent>
        </Card>

        {/* Grade Level Utilization */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-green-600" />
              Grade Utilization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.gradeUtilization.map((grade) => (
              <div key={grade.grade} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{grade.grade}</span>
                  <span className="text-gray-600">{grade.enrolled}/{grade.capacity}</span>
                </div>
                <Progress value={grade.utilization} className="h-2" />
              </div>
            ))}
            {stats.gradeUtilization.length === 0 && (
              <p className="text-sm text-gray-500">No grade level data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>
              Common tasks you can perform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/students">
              <Button variant="outline" className="w-full justify-start hover:bg-blue-50">
                <Users className="h-4 w-4 mr-2" />
                Manage Students
              </Button>
            </Link>
            <Link to="/classes">
              <Button variant="outline" className="w-full justify-start hover:bg-green-50">
                <BookOpen className="h-4 w-4 mr-2" />
                Manage Classes
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>
              Latest system activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentRegistrations > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">{stats.recentRegistrations} new student{stats.recentRegistrations !== 1 ? 's' : ''} registered</p>
                    <p className="text-xs text-gray-600">This month</p>
                  </div>
                </div>
                {stats.pendingPayments > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium">{stats.pendingPayments} pending payment{stats.pendingPayments !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-gray-600">Requires attention</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 font-medium">No recent activity</p>
                <p className="text-xs text-gray-500">Start by registering students or creating classes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg">System Status</CardTitle>
          <CardDescription>
            Current system information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-800">Database Connected</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-800">Real-time Active</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-800">All Systems Operational</span>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </BranchLoadingWrapper>
  );
};
