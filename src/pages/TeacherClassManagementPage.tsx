import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { apiClient } from '@/lib/api';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TeacherClassCard } from '@/components/classes/TeacherClassCard';
import { useLiveData } from '@/hooks/useLiveData';
import {
  Users,
  Search,
  BookOpen,
  GraduationCap,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  ClipboardCheck,
  AlertCircle,
  Filter,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Class {
  id: string;
  name: string;
  grade_level: string;
  subject?: string;
  subject_id?: string;
  subject_name?: string;
  academic_year?: string;
  current_enrollment?: number;
}

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
  phone?: string;
  parent_contact?: string;
  date_of_birth?: string;
  gender?: string;
  class_id: string;
  grade_level: string;
  enrollment_date?: string;
}

export const TeacherClassManagementPage = () => {
  const { user } = useAuth();
  const { isTeacher } = useRoleAccess();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'classes' | 'students'>('classes');

  // Enable real-time updates
  useLiveData(['classes', 'students'], {
    additionalQueryKeys: ['teacher-classes']
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

  // Fetch all students from teacher's classes
  const { data: allStudentsResponse, isLoading: studentsLoading } = useQuery({
    queryKey: ['teacher-students', teacherClasses.map(c => c.id)],
    queryFn: async () => {
      if (teacherClasses.length === 0) return { items: [] };

      // Fetch students for all classes
      const studentPromises = teacherClasses.map(async (cls) => {
        const params = new URLSearchParams();
        params.append('class_id', cls.id);
        params.append('limit', '1000');
        const { data, error } = await apiClient.request(`/students/?${params.toString()}`);
        if (error) return [];
        return data?.items || [];
      });

      const studentArrays = await Promise.all(studentPromises);
      const allStudents = studentArrays.flat();

      return { items: allStudents };
    },
    enabled: teacherClasses.length > 0,
  });

  const allStudents = allStudentsResponse?.items || [];

  // Filter classes
  const filteredClasses = teacherClasses.filter((cls) => {
    const matchesSearch = cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cls.grade_level.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = selectedGrade === 'all' || cls.grade_level === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  // Filter students
  const filteredStudents = allStudents.filter((student: Student) => {
    const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.student_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = selectedGrade === 'all' || student.grade_level === selectedGrade;
    const matchesClass = !selectedClass || student.class_id === selectedClass.id;
    return matchesSearch && matchesGrade && matchesClass;
  });

  // Get unique grade levels
  const uniqueGrades = Array.from(new Set(teacherClasses.map(c => c.grade_level))).sort();

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedGrade('all');
    setSelectedClass(null);
  };

  const handleViewStudentDetails = (student: Student) => {
    setSelectedStudent(student);
    setShowStudentDialog(true);
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
    <BranchLoadingWrapper loadingMessage="Loading class management...">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-700 pb-20 pt-16">
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>

          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <BookOpen className="mr-2 h-4 w-4" />
                Class & Student Management
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                My <span className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent">Classes</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Manage your classes and students with comprehensive views, quick actions,
                and detailed student information at your fingertips.
              </p>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16 max-w-7xl mx-auto">
          {/* Filters and Stats Bar */}
          <Card className="border-white/40 shadow-2xl">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {/* Search */}
                <div className="md:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search classes or students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Grade Filter */}
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {uniqueGrades.map(grade => (
                      <SelectItem key={grade} value={grade}>
                        Grade {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* View Toggle */}
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'classes' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('classes')}
                    className="flex-1"
                  >
                    <BookOpen className="h-4 w-4 mr-1" />
                    Classes
                  </Button>
                  <Button
                    variant={viewMode === 'students' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('students')}
                    className="flex-1"
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Students
                  </Button>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-900">{teacherClasses.length}</div>
                    <div className="text-xs text-slate-600">Classes</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">{allStudents.length}</div>
                    <div className="text-xs text-slate-600">Students</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <GraduationCap className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-900">{uniqueGrades.length}</div>
                    <div className="text-xs text-slate-600">Grades</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <Calendar className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-900">
                      {teacherClasses[0]?.academic_year || 'N/A'}
                    </div>
                    <div className="text-xs text-slate-600">Academic Year</div>
                  </div>
                </div>
              </div>

              {/* Active Filters */}
              {(searchTerm || selectedGrade !== 'all' || selectedClass) && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                  <Filter className="h-4 w-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Active Filters:</span>
                  {searchTerm && (
                    <Badge variant="secondary">Search: {searchTerm}</Badge>
                  )}
                  {selectedGrade !== 'all' && (
                    <Badge variant="secondary">Grade {selectedGrade}</Badge>
                  )}
                  {selectedClass && (
                    <Badge variant="secondary">{selectedClass.name}</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="ml-auto"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content Area */}
          {viewMode === 'classes' ? (
            <>
              {classesLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-slate-600">Loading classes...</p>
                </div>
              ) : filteredClasses.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-600 font-medium">No classes found</p>
                    <p className="text-sm text-slate-500 mt-2">
                      {searchTerm || selectedGrade !== 'all'
                        ? 'Try adjusting your filters'
                        : 'You have no classes assigned'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClasses.map((cls) => (
                    <TeacherClassCard
                      key={cls.id}
                      {...cls}
                      onClick={() => {
                        setSelectedClass(cls);
                        setViewMode('students');
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {studentsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-slate-600">Loading students...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-600 font-medium">No students found</p>
                    <p className="text-sm text-slate-500 mt-2">
                      Try adjusting your filters
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-2">
                      {filteredStudents.map((student: Student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                          onClick={() => handleViewStudentDetails(student)}
                        >
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {student.full_name}
                            </p>
                            <p className="text-sm text-slate-600">
                              ID: {student.student_id} • Grade {student.grade_level}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-white">
                            {teacherClasses.find(c => c.id === student.class_id)?.name || 'Unknown Class'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Student Details Dialog */}
      <Dialog open={showStudentDialog} onOpenChange={setShowStudentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Student Details</DialogTitle>
            <DialogDescription>
              Comprehensive information about {selectedStudent?.full_name}
            </DialogDescription>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-6">
              {/* Student Header */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {selectedStudent.first_name[0]}{selectedStudent.last_name[0]}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedStudent.full_name}</h3>
                  <p className="text-sm text-slate-600">Student ID: {selectedStudent.student_id}</p>
                </div>
              </div>

              {/* Student Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600">Grade Level</label>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    Grade {selectedStudent.grade_level}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Class</label>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {teacherClasses.find(c => c.id === selectedStudent.class_id)?.name || 'N/A'}
                  </p>
                </div>
                {selectedStudent.email && (
                  <div>
                    <label className="text-xs font-medium text-slate-600">Email</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <p className="text-sm text-slate-900">{selectedStudent.email}</p>
                    </div>
                  </div>
                )}
                {selectedStudent.phone && (
                  <div>
                    <label className="text-xs font-medium text-slate-600">Phone</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <p className="text-sm text-slate-900">{selectedStudent.phone}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  asChild
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  <a href={`/teacher-attendance?student=${selectedStudent.id}`}>
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    View Attendance
                  </a>
                </Button>
                <Button
                  asChild
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <a href={`/teacher-grading?student=${selectedStudent.id}`}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Grades
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </BranchLoadingWrapper>
  );
};

export default TeacherClassManagementPage;
