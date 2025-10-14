import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, AlertCircle, CheckCircle, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';

export const PendingGradesWidget: React.FC<WidgetProps> = ({ config }) => {
  const { usePendingGrades } = useWidgetData();
  const { data: pendingGrades, isLoading, error } = usePendingGrades();
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
    return <div className="text-sm text-red-500">Failed to load pending grades</div>;
  }

  const gradesData = pendingGrades || [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'exam': return <FileText className="h-4 w-4" />;
      case 'assignment': return <BookOpen className="h-4 w-4" />;
      case 'quiz': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-orange-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const totalPendingStudents = gradesData.reduce((sum, grade) => sum + (grade.students || 0), 0);
  const highPriorityCount = gradesData.filter(g => g.priority === 'high').length;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-2 bg-orange-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-orange-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-orange-900">{gradesData.length}</div>
          <div className="text-xs text-orange-700">Pending Items</div>
        </div>
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <FileText className="h-5 w-5 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-blue-900">{totalPendingStudents}</div>
          <div className="text-xs text-blue-700">Student Grades</div>
        </div>
      </div>

      {/* Pending Items List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {gradesData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No pending grades to review</p>
          </div>
        ) : (
          gradesData.map((item) => {
          const daysUntilDue = getDaysUntilDue(item.dueDate);
          const isOverdue = daysUntilDue < 0;
          const isDueSoon = daysUntilDue <= 2 && daysUntilDue >= 0;
          
          return (
            <div
              key={item.id}
              className={`p-3 rounded-lg border transition-all ${
                isOverdue 
                  ? 'bg-red-50 border-red-200' 
                  : isDueSoon
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-white border-gray-200 hover:border-blue-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getTypeIcon(item.type)}
                    <span className="text-sm font-medium text-gray-900">{item.title}</span>
                    <Badge 
                      variant="outline"
                      className={`text-xs ${getPriorityColor(item.priority)} border-current`}
                    >
                      {item.priority}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    {item.class} • {item.subject} • {item.students} students
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-500" />
                  <span className={
                    isOverdue ? 'text-red-600 font-medium' :
                    isDueSoon ? 'text-yellow-600 font-medium' :
                    'text-gray-500'
                  }>
                    {isOverdue 
                      ? `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`
                      : daysUntilDue === 0 
                      ? 'Due today'
                      : `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`
                    }
                  </span>
                </div>
                
                <Link 
                  to={`/grades/${item.id}`}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Grade Now
                </Link>
              </div>
            </div>
          );
          })
        )}
      </div>

      {/* Priority Alert */}
      {highPriorityCount > 0 && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          {highPriorityCount} high priority item{highPriorityCount !== 1 ? 's' : ''} need{highPriorityCount === 1 ? 's' : ''} immediate attention
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <Link 
          to="/grades?filter=pending"
          className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-center"
        >
          View All Pending
        </Link>
        <Link 
          to="/exams"
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
        >
          Exam Schedule
        </Link>
      </div>
    </div>
  );
};