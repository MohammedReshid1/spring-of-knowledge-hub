
import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, BookOpen, GraduationCap, TrendingUp, Calendar, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Overview = () => {
  const queryClient = useQueryClient();

  // Real-time subscriptions for dashboard updates
  useEffect(() => {
    const studentsChannel = supabase
      .channel('dashboard-students')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          console.log('Students updated, refreshing dashboard...');
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .subscribe();

    const classesChannel = supabase
      .channel('dashboard-classes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classes' },
        () => {
          console.log('Classes updated, refreshing dashboard...');
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .subscribe();

    const gradesChannel = supabase
      .channel('dashboard-grades')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grade_levels' },
        () => {
          console.log('Grade levels updated, refreshing dashboard...');
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
      supabase.removeChannel(classesChannel);
      supabase.removeChannel(gradesChannel);
    };
  }, [queryClient]);

  const { data: dashboardStats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      console.log('Fetching dashboard stats...');
      
      // Use count queries for accurate totals and fetch all data without 1000-row limit
      const [studentsCountResult, activeStudentsCountResult, newStudentsCountResult, pendingPaymentsCountResult, unpaidStudentsCountResult, studentsResult, classesResult, gradeLevelsResult, paymentsResult] = await Promise.all([
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Active'),
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase
          .from('registration_payments')
          .select('*', { count: 'exact', head: true })
          .in('payment_status', ['Unpaid', 'Partially Paid']),
        supabase
          .from('registration_payments')
          .select('*', { count: 'exact', head: true })
          .eq('payment_status', 'Unpaid'),
        supabase
          .from('students')
          .select('status, grade_level, created_at, registration_payments(payment_status)')
        supabase
          .from('classes')
          .select('id, current_enrollment, max_capacity'),
        supabase
          .from('grade_levels')
          .select('grade, current_enrollment, max_capacity'),
        supabase
          .from('registration_payments')
          .select('amount_paid, payment_status')
      ]);

      if (studentsCountResult.error) throw studentsCountResult.error;
      if (activeStudentsCountResult.error) throw activeStudentsCountResult.error;
      if (newStudentsCountResult.error) throw newStudentsCountResult.error;
      if (pendingPaymentsCountResult.error) throw pendingPaymentsCountResult.error;
      if (unpaidStudentsCountResult.error) throw unpaidStudentsCountResult.error;
      if (studentsResult.error) throw studentsResult.error;
      if (classesResult.error) throw classesResult.error;
      if (gradeLevelsResult.error) throw gradeLevelsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const students = studentsResult.data || [];
      const classes = classesResult.data || [];
      const gradeLevels = gradeLevelsResult.data || [];
      const payments = paymentsResult.data || [];

      // Calculate stats using accurate counts from database
      const totalStudents = studentsCountResult.count || 0;
      const activeStudents = activeStudentsCountResult.count || 0;
      const recentRegistrations = newStudentsCountResult.count || 0;
      const pendingPayments = pendingPaymentsCountResult.count || 0;
      const unpaidStudents = unpaidStudentsCountResult.count || 0;
      const totalClasses = classes.length;
      
      // Calculate enrollment rate
      const totalCapacity = gradeLevels.reduce((sum, grade) => sum + grade.max_capacity, 0);
      const totalEnrolled = gradeLevels.reduce((sum, grade) => sum + grade.current_enrollment, 0);
      const enrollmentRate = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

      // Calculate total revenue from all payments
      const totalRevenue = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

      // Payment statistics - calculate paid students from the sample data
      const paidStudents = students.filter(s => 
        s.registration_payments?.some(p => p.payment_status === 'Paid')
      ).length;

      // Status breakdown
      const statusCounts: Record<string, number> = students.reduce((acc, student) => {
        const status = student.status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Grade level utilization
      const gradeUtilization = gradeLevels.map(grade => ({
        grade: grade.grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        utilization: grade.max_capacity > 0 ? Math.round((grade.current_enrollment / grade.max_capacity) * 100) : 0,
        enrolled: grade.current_enrollment,
        capacity: grade.max_capacity
      }));

      console.log('Dashboard stats calculated successfully');
      return {
        totalStudents,
        activeStudents,
        totalClasses,
        enrollmentRate,
        totalRevenue,
        paidStudents,
        unpaidStudents,
        recentRegistrations,
        pendingPayments,
        statusCounts,
        gradeUtilization: gradeUtilization.slice(0, 5)
      };
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
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
    return `${symbols[currency as keyof typeof symbols] || currency} ${amount.toFixed(2)}`;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">
          Welcome to the Spring of Knowledge Academy Registration Management System
        </p>
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
  );
};
