import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  TrendingUp, 
  Award,
  FileText,
  Calendar,
  Target,
  BarChart3,
  Clock,
  CheckCircle,
  User
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

interface AcademicData {
  overall_performance: {
    current_grade: string;
    percentage: number;
    grade_trend: 'improving' | 'declining' | 'stable';
    class_rank?: number;
    total_students?: number;
  };
  subject_performance: Array<{
    subject_name: string;
    subject_code: string;
    current_grade: string;
    percentage: number;
    teacher_name: string;
    assignments_completed: number;
    total_assignments: number;
    recent_scores: number[];
    trend: 'improving' | 'declining' | 'stable';
  }>;
  assignments: Array<{
    id: string;
    title: string;
    subject: string;
    subject_code: string;
    type: string;
    due_date: string;
    submitted_date?: string;
    grade?: string;
    score?: number;
    max_score: number;
    status: 'pending' | 'submitted' | 'graded' | 'overdue';
    feedback?: string;
  }>;
  exams: Array<{
    id: string;
    exam_name: string;
    subject: string;
    date: string;
    duration: number;
    total_marks: number;
    obtained_marks?: number;
    grade?: string;
    status: 'upcoming' | 'completed' | 'in_progress';
  }>;
  progress_tracking: {
    weekly_progress: Array<{
      week: string;
      average_score: number;
      assignments_completed: number;
      subjects_improved: number;
    }>;
    semester_goals: Array<{
      subject: string;
      target_grade: string;
      current_grade: string;
      progress_percentage: number;
      is_achievable: boolean;
    }>;
  };
}

interface Props {
  children: StudentSummary[];
  selectedChild: string;
  onChildSelect: (childId: string) => void;
}

export const AcademicProgress: React.FC<Props> = ({ children, selectedChild, onChildSelect }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const currentChild = selectedChild ? children.find(c => c.id === selectedChild) : children[0];
  const childId = currentChild?.id || '';

  const { data: academicData, isLoading } = useQuery<AcademicData>({
    queryKey: ['academic-progress', childId],
    queryFn: async () => {
      if (!childId) throw new Error('No student selected');
      const response = await apiClient.get(`/communication/parent-dashboard/academic/${childId}`);
      return response.data;
    },
    enabled: !!childId,
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
    return <div className="text-center py-8">Loading academic progress...</div>;
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-100 text-green-800';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800';
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-800';
    if (grade.startsWith('D')) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'declining') return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
    return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'graded': 
        return 'bg-green-100 text-green-800';
      case 'submitted': 
        return 'bg-blue-100 text-blue-800';
      case 'pending':
      case 'upcoming': 
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue': 
        return 'bg-red-100 text-red-800';
      default: 
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Academic Progress</h2>
          <p className="text-muted-foreground">Comprehensive academic performance tracking</p>
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
      <Card className="bg-gradient-to-r from-green-50 to-blue-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
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
            {academicData?.overall_performance && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Overall Grade</p>
                <div className="flex items-center space-x-2">
                  <Badge className={`text-2xl px-4 py-2 ${getGradeColor(academicData.overall_performance.current_grade)}`}>
                    {academicData.overall_performance.current_grade}
                  </Badge>
                  {getTrendIcon(academicData.overall_performance.grade_trend)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {academicData.overall_performance.percentage.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="goals">Goals & Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Performance Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Average</p>
                    <p className="text-2xl font-bold">
                      {academicData?.overall_performance.percentage.toFixed(1) || 'N/A'}%
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
                    <p className="text-sm font-medium text-muted-foreground">Class Rank</p>
                    <p className="text-2xl font-bold">
                      {academicData?.overall_performance.class_rank || 'N/A'}
                      {academicData?.overall_performance.total_students && 
                        `/${academicData.overall_performance.total_students}`
                      }
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
                    <p className="text-sm font-medium text-muted-foreground">Assignments Done</p>
                    <p className="text-2xl font-bold">
                      {academicData?.assignments?.filter(a => a.status === 'graded' || a.status === 'submitted').length || 0}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Progress Chart */}
          {academicData?.progress_tracking?.weekly_progress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Weekly Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {academicData.progress_tracking.weekly_progress.slice(-6).map((week, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{week.week}</p>
                        <p className="text-sm text-muted-foreground">
                          {week.assignments_completed} assignments completed
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{week.average_score.toFixed(1)}%</p>
                        <p className="text-sm text-green-600">
                          +{week.subjects_improved} subjects improved
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="subjects" className="space-y-6">
          {academicData?.subject_performance ? (
            <div className="grid gap-4">
              {academicData.subject_performance.map((subject) => (
                <Card key={subject.subject_code}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{subject.subject_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Teacher: {subject.teacher_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <Badge className={getGradeColor(subject.current_grade)}>
                            {subject.current_grade}
                          </Badge>
                          {getTrendIcon(subject.trend)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {subject.percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Assignments Completed</p>
                        <p className="font-medium">
                          {subject.assignments_completed}/{subject.total_assignments}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Recent Trend</p>
                        <div className="flex items-center space-x-1">
                          {subject.recent_scores.slice(-5).map((score, index) => (
                            <div 
                              key={index} 
                              className={`w-3 h-6 rounded ${score >= 70 ? 'bg-green-400' : score >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              title={`Score: ${score}%`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(subject.assignments_completed / subject.total_assignments) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No subject data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          {academicData?.assignments ? (
            <div className="space-y-4">
              {academicData.assignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium">{assignment.title}</h3>
                          <Badge className={getStatusColor(assignment.status)}>
                            {assignment.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {assignment.subject} • {assignment.type}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-2">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            Due: {formatDate(assignment.due_date)}
                          </div>
                          {assignment.submitted_date && (
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              Submitted: {formatDate(assignment.submitted_date)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {assignment.grade && (
                          <Badge className={getGradeColor(assignment.grade)} variant="outline">
                            {assignment.grade}
                          </Badge>
                        )}
                        {assignment.score !== undefined && (
                          <p className="text-lg font-bold mt-1">
                            {assignment.score}/{assignment.max_score}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {assignment.feedback && (
                      <div className="mt-3 p-2 bg-blue-50 rounded border-l-4 border-l-blue-500">
                        <p className="text-sm"><strong>Feedback:</strong> {assignment.feedback}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No assignments data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          {academicData?.progress_tracking?.semester_goals ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-4">Semester Goals</h3>
                <div className="grid gap-4">
                  {academicData.progress_tracking.semester_goals.map((goal, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium">{goal.subject}</h4>
                            <p className="text-sm text-muted-foreground">
                              Target: {goal.target_grade} | Current: {goal.current_grade}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{goal.progress_percentage.toFixed(1)}%</p>
                            <Badge variant={goal.is_achievable ? "default" : "destructive"}>
                              {goal.is_achievable ? 'Achievable' : 'Challenging'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full ${goal.is_achievable ? 'bg-green-600' : 'bg-orange-600'}`}
                            style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No goals data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};