import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, TrendingUp, TrendingDown, Award, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';

export const StudentGradesWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useStudentGrades } = useWidgetData();
  const { data: gradesData, isLoading, error } = useStudentGrades();
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-3 bg-gray-100 rounded animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-500">Failed to load grades</div>;
  }

  const grades = gradesData || [];
  const overallAverage = grades.length > 0 
    ? grades.reduce((sum, grade) => sum + (grade.grade || 0), 0) / grades.length 
    : 0;
  const improvingSubjects = grades.filter(g => g.trend === 'up').length;
  const needsAttention = grades.filter(g => (g.grade || 0) < 80).length;

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return 'text-green-600';
    if (grade >= 80) return 'text-blue-600';
    if (grade >= 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeBadgeColor = (grade: number) => {
    if (grade >= 90) return 'bg-green-100 text-green-800';
    if (grade >= 80) return 'bg-blue-100 text-blue-800';
    if (grade >= 70) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getLetterGradeColor = (letterGrade: string) => {
    if (letterGrade.startsWith('A')) return 'text-green-600';
    if (letterGrade.startsWith('B')) return 'text-blue-600';
    if (letterGrade.startsWith('C')) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-blue-50 rounded">
          <div className="text-lg font-bold text-blue-900">{overallAverage.toFixed(1)}%</div>
          <div className="text-xs text-blue-700">Overall GPA</div>
        </div>
        <div className="text-center p-2 bg-green-50 rounded">
          <TrendingUp className="h-4 w-4 text-green-600 mx-auto mb-1" />
          <div className="text-sm font-bold text-green-900">{improvingSubjects}</div>
          <div className="text-xs text-green-700">Improving</div>
        </div>
        <div className="text-center p-2 bg-orange-50 rounded">
          <AlertCircle className="h-4 w-4 text-orange-600 mx-auto mb-1" />
          <div className="text-sm font-bold text-orange-900">{needsAttention}</div>
          <div className="text-xs text-orange-700">Needs Focus</div>
        </div>
      </div>

      {/* Recent Grades List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {grades.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No grades available</p>
          </div>
        ) : (
          grades.slice(0, 4).map((subject) => (
          <div
            key={subject.id}
            className="p-3 rounded-lg border bg-white hover:border-blue-200 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">{subject.subject}</span>
                  <Badge className={getGradeBadgeColor(subject.grade || 0)}>
                    {subject.letterGrade || 'N/A'}
                  </Badge>
                </div>
                <div className="text-xs text-gray-600">
                  {subject.lastAssessment || 'No assessment'} • {subject.teacher || 'Unknown teacher'}
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-lg font-bold ${getGradeColor(subject.grade || 0)}`}>
                  {subject.grade || 0}%
                </div>
                <div className="flex items-center gap-1 justify-end">
                  {subject.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : subject.trend === 'down' ? (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  ) : null}
                  <span className={`text-xs ${
                    subject.trend === 'up' ? 'text-green-600' : 
                    subject.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {subject.trend !== 'stable' && (subject.trend === 'up' ? '+' : '')}{(subject.trendValue || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Progress</span>
                <span>{subject.grade || 0}/{subject.maxGrade || 100}</span>
              </div>
              <Progress value={subject.grade || 0} className="h-1" />
            </div>
          </div>
        ))
      )}
      </div>

      {/* Performance Alerts */}
      {needsAttention > 0 && (
        <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          {needsAttention} subject{needsAttention !== 1 ? 's need' : ' needs'} additional attention
        </div>
      )}

      {/* Excellence Recognition */}
      {grades.some(g => (g.grade || 0) >= 95) && (
        <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          <Award className="h-3 w-3 inline mr-1" />
          Excellent performance in {grades.filter(g => (g.grade || 0) >= 95).length} subject{grades.filter(g => (g.grade || 0) >= 95).length !== 1 ? 's' : ''}!
        </div>
      )}

      {/* Show More */}
      {grades.length > 4 && (
        <div className="text-center">
          <Link 
            to="/grades"
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            View all {grades.length} subjects
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <Link 
          to="/grades?view=detailed"
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
        >
          Grade Details
        </Link>
        <Link 
          to="/assignments"
          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-center"
        >
          Assignments
        </Link>
      </div>
    </div>
  );
};