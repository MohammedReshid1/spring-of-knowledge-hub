import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { apiClient } from '@/lib/api';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  BookOpen,
  Users,
  MapPin,
  Bell,
  CalendarDays
} from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { cn } from '@/lib/utils';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  subject?: string;
  academic_year?: string;
  current_enrollment?: number;
}

interface ScheduleSession {
  id: string;
  class_id: string;
  class_name: string;
  subject?: string;
  day: string; // Monday, Tuesday, etc.
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  room?: string;
  student_count?: number;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'
];

export const TeacherSchedulePage = () => {
  const { user } = useAuth();
  const { isTeacher } = useRoleAccess();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState<string>('Monday');

  // Fetch teacher's timetable from backend
  const { data: timetableData, isLoading: timetableLoading } = useQuery({
    queryKey: ['teacher-timetable', user?.id],
    queryFn: async () => {
      console.log('🔍 Fetching timetable for user:', user);

      if (!user?.id) {
        console.error('❌ No user ID found');
        throw new Error('User ID not found');
      }

      // Use user.id - the backend will resolve the teacher record
      const teacherId = user.teacher_id || user.id;
      console.log('🔍 Using teacher ID:', teacherId);

      const { data, error } = await apiClient.getTeacherTimetable(teacherId);
      console.log('📡 API Response - data:', data, 'error:', error);
      if (error) throw new Error(error);
      return data;
    },
    enabled: isTeacher && !!user?.id,
  });

  // Transform backend data to component format
  const teacherSchedule: ScheduleSession[] = useMemo(() => {
    console.log('🔍 Timetable Data:', timetableData);

    if (!timetableData?.entries) {
      console.log('⚠️ No entries in timetable data');
      return [];
    }

    const schedule: ScheduleSession[] = [];
    const dayNameMap: Record<string, string> = {
      'monday': 'Monday',
      'tuesday': 'Tuesday',
      'wednesday': 'Wednesday',
      'thursday': 'Thursday',
      'friday': 'Friday',
      'saturday': 'Saturday',
    };

    // Transform organized entries back to flat list
    timetableData.entries.forEach((dayEntry: any) => {
      const day = dayNameMap[dayEntry.day] || dayEntry.day;

      Object.entries(dayEntry.periods || {}).forEach(([periodNum, periodData]: [string, any]) => {
        schedule.push({
          id: periodData.entry_id || `${dayEntry.day}-${periodNum}`,
          class_id: periodData.class_id || '',
          class_name: periodData.class_name || 'Class',
          subject: periodData.subject_name || periodData.subject || '',
          day: day,
          start_time: periodData.start_time || '',
          end_time: periodData.end_time || '',
          room: periodData.room_number || '',
          student_count: periodData.student_count,
        });
      });
    });

    console.log('📅 Transformed Schedule:', schedule);
    return schedule;
  }, [timetableData]);

  // Filter sessions by day
  const getSessionsForDay = (day: string) => {
    return teacherSchedule.filter(session => session.day === day);
  };

  // Get upcoming sessions (today and next 2 days)
  const upcomingSessions = useMemo(() => {
    const today = new Date();
    const todayName = format(today, 'EEEE');
    const tomorrowName = format(addDays(today, 1), 'EEEE');

    const todaySessions = teacherSchedule.filter(s => s.day === todayName);
    const tomorrowSessions = teacherSchedule.filter(s => s.day === tomorrowName);

    return [...todaySessions, ...tomorrowSessions].slice(0, 5);
  }, [teacherSchedule]);

  // Statistics
  const stats = useMemo(() => {
    const totalSessions = teacherSchedule.length;
    const uniqueClasses = new Set(teacherSchedule.map(s => s.class_id)).size;

    // Count unique students by getting unique classes and summing their student counts
    const classStudentMap = new Map<string, number>();
    teacherSchedule.forEach(session => {
      if (session.class_id && !classStudentMap.has(session.class_id)) {
        classStudentMap.set(session.class_id, session.student_count || 0);
      }
    });
    const totalStudents = Array.from(classStudentMap.values()).reduce((sum, count) => sum + count, 0);

    const todaySessions = getSessionsForDay(format(new Date(), 'EEEE')).length;

    return { totalSessions, uniqueClasses, totalStudents, todaySessions };
  }, [teacherSchedule]);

  const handlePreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const handleToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    setSelectedDay(format(new Date(), 'EEEE'));
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

  // Show loading state
  if (timetableLoading) {
    return (
      <BranchLoadingWrapper loadingMessage="Loading your schedule...">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your teaching schedule...</p>
          </div>
        </div>
      </BranchLoadingWrapper>
    );
  }

  return (
    <BranchLoadingWrapper loadingMessage="Loading your schedule...">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 pb-20 pt-16">
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

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Teaching Schedule
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Your Weekly <span className="bg-gradient-to-r from-cyan-200 to-blue-200 bg-clip-text text-transparent">Schedule</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                View your teaching schedule, plan your week, and stay organized with your class sessions.
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
        <div className="relative z-10 -mt-10 space-y-6 px-6 pb-16 max-w-7xl mx-auto">
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeInUp">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Today's Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900">{stats.todaySessions}</div>
                <p className="text-xs text-blue-600 mt-1">Classes scheduled</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Weekly Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-900">{stats.totalSessions}</div>
                <p className="text-xs text-green-600 mt-1">This week</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-600">Active Classes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-900">{stats.uniqueClasses}</div>
                <p className="text-xs text-purple-600 mt-1">Different classes</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-600">Total Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-900">{stats.totalStudents}</div>
                <p className="text-xs text-orange-600 mt-1">Across all sessions</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly Schedule - Main Section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Week Navigation */}
              <Card className="border-2 border-blue-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Week of {format(currentWeekStart, 'MMM dd, yyyy')}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {format(currentWeekStart, 'MMM dd')} - {format(addDays(currentWeekStart, 4), 'MMM dd')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleToday}>
                        Today
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleNextWeek}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Grid */}
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Schedule</CardTitle>
                  <CardDescription>Your class sessions for the week</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {DAYS_OF_WEEK.map((day, index) => {
                      const dayDate = addDays(currentWeekStart, index);
                      const sessions = getSessionsForDay(day);
                      const isToday = isSameDay(dayDate, new Date());

                      return (
                        <div key={day} className={cn(
                          "p-4 rounded-lg border-2 transition-all",
                          isToday ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-50"
                        )}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <CalendarDays className={cn(
                                "h-5 w-5",
                                isToday ? "text-blue-600" : "text-gray-600"
                              )} />
                              <h4 className={cn(
                                "font-semibold",
                                isToday ? "text-blue-900" : "text-gray-900"
                              )}>
                                {day}
                              </h4>
                              {isToday && (
                                <Badge className="bg-blue-600 text-white">Today</Badge>
                              )}
                            </div>
                            <span className="text-sm text-gray-600">
                              {format(dayDate, 'MMM dd')}
                            </span>
                          </div>

                          {sessions.length > 0 ? (
                            <div className="space-y-2">
                              {sessions.map((session) => (
                                <div
                                  key={session.id}
                                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Clock className="h-4 w-4 text-blue-600" />
                                    <span>{session.start_time} - {session.end_time}</span>
                                  </div>
                                  <div className="h-8 w-px bg-gray-300" />
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{session.class_name}</p>
                                    <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                                      {session.subject && (
                                        <span className="flex items-center gap-1">
                                          <BookOpen className="h-3 w-3" />
                                          {session.subject}
                                        </span>
                                      )}
                                      {session.room && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {session.room}
                                        </span>
                                      )}
                                      {session.student_count && (
                                        <span className="flex items-center gap-1">
                                          <Users className="h-3 w-3" />
                                          {session.student_count} students
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              No classes scheduled
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Upcoming Sessions */}
            <div className="space-y-6">
              <Card className="border-2 border-purple-100">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-purple-600" />
                    Upcoming Sessions
                  </CardTitle>
                  <CardDescription>Your next classes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingSessions.length > 0 ? (
                      upcomingSessions.map((session) => (
                        <div
                          key={session.id}
                          className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <Badge variant="outline" className="bg-white">
                              {session.day}
                            </Badge>
                            <span className="text-xs font-medium text-purple-700">
                              {session.start_time}
                            </span>
                          </div>
                          {session.subject && (
                            <h4 className="font-semibold text-gray-900 mb-1">{session.subject}</h4>
                          )}
                          <p className="text-sm text-gray-700 mb-1">{session.class_name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            {session.room && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {session.room}
                              </span>
                            )}
                            {session.student_count && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {session.student_count}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Bell className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No upcoming sessions</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card className="border-2 border-green-100">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button asChild variant="outline" className="w-full justify-start">
                    <a href="/teacher-attendance">
                      <Clock className="h-4 w-4 mr-2" />
                      Mark Attendance
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start">
                    <a href="/teacher-classes">
                      <BookOpen className="h-4 w-4 mr-2" />
                      View Classes
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start">
                    <a href="/calendar">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Full Calendar
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </BranchLoadingWrapper>
  );
};

export default TeacherSchedulePage;
