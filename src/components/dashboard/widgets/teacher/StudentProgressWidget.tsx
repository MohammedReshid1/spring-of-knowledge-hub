import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, BarChart3, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';

export const StudentProgressWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useStudentProgress } = useWidgetData();
  const { data: progressData, isLoading, error } = useStudentProgress();
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
    return <div className="text-sm text-red-500">Failed to load student progress</div>;
  }

  const classProgressData = progressData || [];
  const totalStudents = classProgressData.reduce((sum, cls) => sum + (cls.students || 0), 0);
  const totalStruggling = classProgressData.reduce((sum, cls) => sum + (cls.strugglingStudents || 0), 0);
  const totalExcellent = classProgressData.reduce((sum, cls) => sum + (cls.excellentStudents || 0), 0);
  const overallAverage = classProgressData.length > 0 
    ? classProgressData.reduce((sum, cls) => sum + (cls.averageGrade || 0), 0) / classProgressData.length 
    : 0;

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

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <Users className="h-5 w-5 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-blue-900">{totalStudents}</div>
          <div className="text-xs text-blue-700">Total Students</div>
        </div>
        <div className="text-center p-2 bg-purple-50 rounded-lg">
          <BarChart3 className="h-5 w-5 text-purple-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-purple-900">{overallAverage.toFixed(1)}%</div>
          <div className="text-xs text-purple-700">Overall Average</div>
        </div>
      </div>

      {/* Performance Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between p-2 bg-red-50 rounded">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-800">Struggling</span>
          </div>
          <Badge className="bg-red-100 text-red-800">{totalStruggling}</Badge>
        </div>
        <div className="flex items-center justify-between p-2 bg-green-50 rounded">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-800">Excellent</span>
          </div>
          <Badge className="bg-green-100 text-green-800">{totalExcellent}</Badge>
        </div>
      </div>

      {/* Class Progress List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {classProgressData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No class progress data available</p>
          </div>
        ) : (
          classProgressData.map((classItem) => (
          <div
            key={classItem.id}
            className="p-3 rounded-lg border bg-white hover:border-blue-200 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {classItem.className}
                  </span>
                  <Badge className={getGradeBadgeColor(classItem.averageGrade)}>
                    {classItem.averageGrade.toFixed(1)}%
                  </Badge>
                </div>
                <div className="text-xs text-gray-600">
                  {classItem.students || 0} students • {classItem.lastAssessment || 'No recent assessment'}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {classItem.trend === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-xs font-medium ${
                  classItem.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {classItem.trend === 'up' ? '+' : ''}{(classItem.trendValue || 0).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Completion Rate</span>
                <span>{classItem.completionRate || 0}%</span>
              </div>
              <Progress value={classItem.completionRate || 0} className="h-1" />
            </div>

            {(classItem.strugglingStudents || 0) > 0 && (
              <div className="flex items-center justify-between text-xs text-orange-600 mt-2 pt-2 border-t">
                <span>{classItem.strugglingStudents} students need support</span>
                <Link 
                  to={`/classes/${classItem.id}/struggling`}
                  className="underline hover:text-orange-800"
                >
                  View Details
                </Link>
              </div>
            )}
          </div>
        ))
      )}
      </div>

      {/* Alerts */}
      {totalStruggling > 0 && (
        <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          {totalStruggling} student{totalStruggling !== 1 ? 's' : ''} across all classes need additional support
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <Link 
          to="/grades?view=progress"
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
        >
          Progress Reports
        </Link>
        <Link 
          to="/students?filter=struggling"
          className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-center"
        >
          Support Plans
        </Link>
      </div>
    </div>
  );
};