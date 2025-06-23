
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, GraduationCap, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export const Overview = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [studentsRes, classesRes, gradeStatsRes] = await Promise.all([
        supabase.from('students').select('status, grade_level'),
        supabase.from('classes').select('current_enrollment, max_capacity'),
        supabase.from('grade_levels').select('grade, current_enrollment, max_capacity')
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (classesRes.error) throw classesRes.error;
      if (gradeStatsRes.error) throw gradeStatsRes.error;

      const totalStudents = studentsRes.data?.length || 0;
      const activeStudents = studentsRes.data?.filter(s => s.status === 'active').length || 0;
      const pendingStudents = studentsRes.data?.filter(s => s.status === 'pending').length || 0;
      
      const totalCapacity = classesRes.data?.reduce((acc, cls) => acc + cls.max_capacity, 0) || 0;
      const totalEnrollment = classesRes.data?.reduce((acc, cls) => acc + cls.current_enrollment, 0) || 0;
      
      const gradeData = gradeStatsRes.data?.map(grade => ({
        grade: grade.grade.replace('_', ' ').toUpperCase(),
        enrollment: grade.current_enrollment,
        capacity: grade.max_capacity,
        utilization: Math.round((grade.current_enrollment / grade.max_capacity) * 100)
      })) || [];

      const statusData = [
        { name: 'Active', value: activeStudents, color: '#10b981' },
        { name: 'Pending', value: pendingStudents, color: '#f59e0b' },
        { name: 'Others', value: totalStudents - activeStudents - pendingStudents, color: '#6b7280' }
      ];

      return {
        totalStudents,
        activeStudents,
        pendingStudents,
        totalClasses: classesRes.data?.length || 0,
        totalCapacity,
        totalEnrollment,
        utilizationRate: totalCapacity > 0 ? Math.round((totalEnrollment / totalCapacity) * 100) : 0,
        gradeData,
        statusData
      };
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <Badge variant="outline" className="text-sm">
          Academic Year {new Date().getFullYear()}
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold">{stats?.totalStudents}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Students</p>
                <p className="text-3xl font-bold text-green-600">{stats?.activeStudents}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Classes</p>
                <p className="text-3xl font-bold">{stats?.totalClasses}</p>
              </div>
              <BookOpen className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Capacity Utilization</p>
                <p className="text-3xl font-bold">{stats?.utilizationRate}%</p>
              </div>
              <AlertCircle className={`h-8 w-8 ${
                (stats?.utilizationRate || 0) > 90 ? 'text-red-600' : 
                (stats?.utilizationRate || 0) > 75 ? 'text-yellow-600' : 'text-green-600'
              }`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Enrollment by Grade Level</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.gradeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="enrollment" fill="#3b82f6" />
                <Bar dataKey="capacity" fill="#e5e7eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Student Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats?.statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {stats?.statusData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats?.totalEnrollment}</p>
              <p className="text-sm text-muted-foreground">Total Enrollment</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats?.totalCapacity}</p>
              <p className="text-sm text-muted-foreground">Total Capacity</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats?.pendingStudents}</p>
              <p className="text-sm text-muted-foreground">Pending Applications</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {stats?.totalCapacity && stats?.totalEnrollment ? stats.totalCapacity - stats.totalEnrollment : 0}
              </p>
              <p className="text-sm text-muted-foreground">Available Spots</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
