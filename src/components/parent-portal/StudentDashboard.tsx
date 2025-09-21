import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Calendar, 
  BookOpen, 
  Award,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  FileText,
  Target
} from 'lucide-react';

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

interface StudentDetails {
  basic_info: {
    full_name: string;
    student_id: string;
    grade_level: string;
    class_name: string;
    date_of_birth: string;
    enrollment_date: string;
  };
  academic_performance: {
    overall_grade: string;
    overall_percentage: number;
    subject_grades: Record<string, string>;
    recent_assignments: Array<{
      subject: string;
      title: string;
      grade: string;
      date: string;
    }>;
    upcoming_exams: Array<{
      subject: string;
      exam_name: string;
      date: string;
    }>;
  };
  attendance: {
    total_days: number;
    days_present: number;
    days_absent: number;
    attendance_percentage: number;
    recent_attendance: Array<{
      date: string;
      status: string;
      remarks?: string;
    }>;
  };
  behavior: {
    total_positive_points: number;
    total_negative_points: number;
    behavior_balance: number;
    recent_incidents: Array<{
      date: string;
      type: string;
      description: string;
      points: number;
    }>;
    achievements: Array<{
      date: string;
      title: string;
      description: string;
    }>;
  };
  financial: {
    total_fees: number;
    amount_paid: number;
    outstanding_balance: number;
    recent_payments: Array<{
      date: string;
      amount: number;
      description: string;
    }>;
  };
}

interface Props {
  children: StudentSummary[];
  selectedChild: string;
  onChildSelect: (childId: string) => void;
}

export const StudentDashboard: React.FC<Props> = ({ children, selectedChild, onChildSelect }) => {
  const currentChild = selectedChild ? children.find(c => c.id === selectedChild) : children[0];
  const childId = currentChild?.id || '';

  const { data: studentDetails, isLoading } = useQuery<StudentDetails>({
    queryKey: ['student-details', childId],
    queryFn: async () => {
      if (!childId) throw new Error('No student selected');
      const response = await apiClient.get(`/communication/parent-dashboard/student/${childId}`);
      return response.data;
    },
    enabled: !!childId,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  if (!currentChild) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No student data available</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading student details...</div>;
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-100 text-green-800';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800';
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-800';
    if (grade.startsWith('D')) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getAttendanceStatus = (status: string) => {
    switch (status) {
      case 'present': return { color: 'text-green-600', icon: CheckCircle };
      case 'absent': return { color: 'text-red-600', icon: AlertTriangle };
      case 'late': return { color: 'text-yellow-600', icon: Clock };
      default: return { color: 'text-gray-600', icon: Calendar };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Student Dashboard</h2>
          <p className="text-muted-foreground">Detailed view of your child's progress</p>
        </div>
        
        {children.length > 1 && (
          <Select value={selectedChild || children[0].id} onValueChange={onChildSelect}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.full_name} - {child.grade_level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Student Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {currentChild.full_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h3 className="text-2xl font-bold">{currentChild.full_name}</h3>
                <p className="text-muted-foreground">
                  {currentChild.grade_level} - {currentChild.class_name}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  Student ID: {currentChild.student_id}
                </p>
              </div>
            </div>
            {currentChild.overall_grade && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Overall Grade</p>
                <Badge className={`text-2xl px-4 py-2 ${getGradeColor(currentChild.overall_grade)}`}>
                  {currentChild.overall_grade}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Academic Performance</p>
                <p className="text-2xl font-bold">
                  {studentDetails?.academic_performance.overall_percentage.toFixed(1) || 'N/A'}%
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Attendance Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {studentDetails?.attendance.attendance_percentage.toFixed(1) || currentChild.attendance_percentage.toFixed(1)}%
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
                <p className="text-sm font-medium text-muted-foreground">Behavior Points</p>
                <p className={`text-2xl font-bold ${currentChild.behavior_points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {studentDetails?.behavior.behavior_balance || currentChild.behavior_points}
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
                <p className={`text-2xl font-bold ${currentChild.outstanding_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(studentDetails?.financial.outstanding_balance || currentChild.outstanding_balance)}
                </p>
              </div>
              <Target className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Academic Performance */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              Subject Grades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentDetails?.academic_performance.subject_grades ? (
              <div className="space-y-3">
                {Object.entries(studentDetails.academic_performance.subject_grades).map(([subject, grade]) => (
                  <div key={subject} className="flex justify-between items-center">
                    <span className="font-medium capitalize">{subject.replace('_', ' ')}</span>
                    <Badge className={getGradeColor(grade)}>{grade}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No grade data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Recent Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentDetails?.academic_performance.recent_assignments ? (
              <div className="space-y-3">
                {studentDetails.academic_performance.recent_assignments.slice(0, 5).map((assignment, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-sm">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">{assignment.subject}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={getGradeColor(assignment.grade)}>{assignment.grade}</Badge>
                      <p className="text-xs text-muted-foreground">{formatDate(assignment.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent assignments</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance and Behavior */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Recent Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentDetails?.attendance.recent_attendance ? (
              <div className="space-y-2">
                {studentDetails.attendance.recent_attendance.slice(0, 7).map((record, index) => {
                  const statusInfo = getAttendanceStatus(record.status);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                        <span className="text-sm">{formatDate(record.date)}</span>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={statusInfo.color}>
                          {record.status}
                        </Badge>
                        {record.remarks && (
                          <p className="text-xs text-muted-foreground">{record.remarks}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No attendance data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="h-5 w-5 mr-2" />
              Behavior & Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Behavior Summary */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Behavior Balance</span>
                  <span className={`font-bold ${(studentDetails?.behavior.behavior_balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {studentDetails?.behavior.behavior_balance || 0} points
                  </span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Positive: +{studentDetails?.behavior.total_positive_points || 0}</span>
                  <span>Negative: -{studentDetails?.behavior.total_negative_points || 0}</span>
                </div>
              </div>

              {/* Recent Achievements */}
              {studentDetails?.behavior.achievements && studentDetails.behavior.achievements.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Recent Achievements</h4>
                  <div className="space-y-2">
                    {studentDetails.behavior.achievements.slice(0, 3).map((achievement, index) => (
                      <div key={index} className="p-2 bg-green-50 rounded border-l-4 border-l-green-500">
                        <p className="font-medium text-sm text-green-800">{achievement.title}</p>
                        <p className="text-xs text-green-600">{achievement.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(achievement.date)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Upcoming Exams
          </CardTitle>
        </CardHeader>
        <CardContent>
          {studentDetails?.academic_performance.upcoming_exams && studentDetails.academic_performance.upcoming_exams.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {studentDetails.academic_performance.upcoming_exams.map((exam, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{exam.exam_name}</h4>
                      <p className="text-sm text-muted-foreground">{exam.subject}</p>
                    </div>
                    <Badge variant="outline">{formatDate(exam.date)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming exams scheduled</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};