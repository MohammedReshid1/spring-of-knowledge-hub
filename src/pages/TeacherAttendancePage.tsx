import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { apiClient } from '@/lib/api';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TeacherAttendanceFilters } from '@/components/attendance/TeacherAttendanceFilters';
import { TeacherQuickAttendanceMarking } from '@/components/attendance/TeacherQuickAttendanceMarking';
import { TeacherAttendanceStats } from '@/components/attendance/TeacherAttendanceStats';
import { useLiveData } from '@/hooks/useLiveData';
import {
  ClipboardCheck,
  BarChart3,
  CalendarCheck,
  AlertCircle,
  UserCheck,
  BookOpen
} from 'lucide-react';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  subject?: string;
  subject_id?: string;
  academic_year?: string;
  current_enrollment?: number;
}

interface Subject {
  id: string;
  name: string;
}

interface Student {
  id: string;
  student_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  class_id: string;
  grade_level: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
}

export const TeacherAttendancePage = () => {
  const { user } = useAuth();
  const { isTeacher } = useRoleAccess();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Enable real-time updates for attendance data
  useLiveData(['attendance', 'classes', 'students'], {
    additionalQueryKeys: ['teacher-attendance']
  });

  // Fetch teacher's classes
  const { data: teacherClasses = [], isLoading: classesLoading } = useQuery<Class[]>({
    queryKey: ['teacher-classes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await apiClient.getTeacherDashboardData(user.id);
      if (error) throw new Error(error);
      return data?.assigned_classes || [];
    },
    enabled: isTeacher && !!user?.id,
  });

  // Fetch subjects for the selected class
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await apiClient.getSubjects({});
      if (error) throw new Error(error);
      return data?.items || [];
    },
  });

  // Fetch students for selected class
  const { data: studentsResponse, isLoading: studentsLoading } = useQuery<any>({
    queryKey: ['students', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return { items: [] };
      const params = new URLSearchParams();
      params.append('class_id', selectedClass);
      params.append('limit', '1000');
      const { data, error } = await apiClient.request(`/students/?${params.toString()}`);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!selectedClass,
  });

  const students = studentsResponse?.items || [];

  // Fetch existing attendance records
  const { data: existingRecords = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', selectedClass, selectedDate.toISOString().split('T')[0], selectedSubject],
    queryFn: async () => {
      if (!selectedClass) return [];

      const params: any = {
        class_id: selectedClass,
        date: selectedDate.toISOString().split('T')[0],
      };

      if (selectedSubject && selectedSubject !== 'all') {
        params.subject_id = selectedSubject;
      }

      const response = await apiClient.getAttendance(params);
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    enabled: !!selectedClass,
  });

  const handleClearFilters = () => {
    setSelectedClass('');
    setSelectedSubject('all');
    setSelectedDate(new Date());
  };

  const handleRefresh = () => {
    // Invalidate queries to refresh data
    // The queryClient will be automatically available through React Query
  };

  if (!isTeacher) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center border-red-200">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only accessible to teachers.</p>
        </Card>
      </div>
    );
  }

  return (
    <BranchLoadingWrapper loadingMessage="Loading attendance management...">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 pb-20 pt-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>

          {/* Floating Shapes */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Teacher Attendance System
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Attendance <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Management</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Quickly mark attendance for your classes with advanced filtering, real-time statistics,
                and comprehensive analytics to monitor student engagement.
              </p>
            </div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16 max-w-7xl mx-auto">
          {/* Filters Section */}
          <div className="animate-fadeInUp">
            <TeacherAttendanceFilters
              classes={teacherClasses}
              subjects={subjects}
              selectedClass={selectedClass}
              selectedSubject={selectedSubject}
              selectedDate={selectedDate}
              onClassChange={setSelectedClass}
              onSubjectChange={setSelectedSubject}
              onDateChange={setSelectedDate}
              onClearFilters={handleClearFilters}
            />
          </div>

          {/* Attendance Management Tabs */}
          {selectedClass ? (
            <Card className="border-white/40 shadow-2xl animate-fadeInUp">
              <Tabs defaultValue="marking" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-blue-50 to-indigo-50 p-1 rounded-t-lg">
                  <TabsTrigger
                    value="marking"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-700 font-medium"
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Mark Attendance
                  </TabsTrigger>
                  <TabsTrigger
                    value="analytics"
                    className="data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-700 font-medium"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analytics & Stats
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="marking" className="p-6">
                  <TeacherQuickAttendanceMarking
                    students={students}
                    classId={selectedClass}
                    subjectId={selectedSubject !== 'all' ? selectedSubject : undefined}
                    attendanceDate={selectedDate}
                    existingRecords={existingRecords}
                    currentUserId={user?.id || ''}
                    onSuccess={handleRefresh}
                    isLoading={studentsLoading}
                  />
                </TabsContent>

                <TabsContent value="analytics" className="p-6">
                  <TeacherAttendanceStats
                    classId={selectedClass}
                    subjectId={selectedSubject !== 'all' ? selectedSubject : undefined}
                    teacherId={user?.id || ''}
                    periodDays={30}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          ) : (
            <Card className="border-blue-200/50 shadow-lg">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-6">
                  <CalendarCheck className="h-16 w-16 text-blue-600" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-900 mb-2">Get Started</h3>
                <p className="text-slate-600 text-center max-w-md mb-6">
                  Select a class from the filters above to start marking attendance or view analytics
                </p>
                {classesLoading ? (
                  <Alert className="max-w-md">
                    <AlertDescription>
                      Loading your classes...
                    </AlertDescription>
                  </Alert>
                ) : teacherClasses.length === 0 ? (
                  <Alert className="max-w-md border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      No classes assigned. Please contact your administrator to assign classes to your account.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mt-4">
                    {teacherClasses.slice(0, 4).map((cls) => (
                      <button
                        key={cls.id}
                        onClick={() => setSelectedClass(cls.id)}
                        className="p-4 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                            <BookOpen className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{cls.name}</p>
                            <p className="text-sm text-slate-600">
                              Grade {cls.grade_level}
                              {cls.current_enrollment && ` • ${cls.current_enrollment} students`}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </BranchLoadingWrapper>
  );
};

export default TeacherAttendancePage;
