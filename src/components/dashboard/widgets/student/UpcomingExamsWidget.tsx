import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, BookOpen, AlertTriangle, FileText, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';
const mockExams = [
  {
    id: 1,
    subject: 'Mathematics',
    title: 'Final Exam',
    date: '2025-09-05',
    time: '09:00 AM',
    duration: '2 hours',
    room: 'Room A-201',
    type: 'final',
    teacher: 'Mr. Smith',
    syllabus: ['Calculus', 'Trigonometry', 'Statistics'],
    priority: 'high'
  },
  {
    id: 2,
    subject: 'Physics',
    title: 'Lab Practical Exam',
    date: '2025-09-07',
    time: '02:00 PM',
    duration: '1.5 hours',
    room: 'Physics Lab B-105',
    type: 'practical',
    teacher: 'Dr. Johnson',
    syllabus: ['Mechanics', 'Thermodynamics'],
    priority: 'medium'
  },
  {
    id: 3,
    subject: 'English Literature',
    title: 'Essay Examination',
    date: '2025-09-10',
    time: '10:30 AM',
    duration: '3 hours',
    room: 'Room C-301',
    type: 'essay',
    teacher: 'Ms. Williams',
    syllabus: ['Shakespeare', 'Modern Poetry', 'Critical Analysis'],
    priority: 'medium'
  },
  {
    id: 4,
    subject: 'Chemistry',
    title: 'Unit Test - Organic Chemistry',
    date: '2025-09-12',
    time: '11:00 AM',
    duration: '1 hour',
    room: 'Room B-203',
    type: 'unit_test',
    teacher: 'Prof. Davis',
    syllabus: ['Hydrocarbons', 'Functional Groups'],
    priority: 'low'
  }
];

export const UpcomingExamsWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useUpcomingExams } = useWidgetData();
  const { data: examsData, isLoading, error } = useUpcomingExams();

  if (error) {
    return <div className="text-sm text-red-500">Failed to load upcoming exams</div>;
  }

  const exams = examsData || [];
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

  const getDaysUntilExam = (examDate: string) => {
    const today = new Date();
    const exam = new Date(examDate);
    const diffTime = exam.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExamTypeIcon = (type: string) => {
    switch (type) {
      case 'final': return <FileText className="h-4 w-4" />;
      case 'practical': return <BookOpen className="h-4 w-4" />;
      case 'essay': return <FileText className="h-4 w-4" />;
      case 'unit_test': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getExamTypeColor = (type: string) => {
    switch (type) {
      case 'final': return 'text-red-600';
      case 'practical': return 'text-blue-600';
      case 'essay': return 'text-purple-600';
      case 'unit_test': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const todayExams = mockExams.filter(exam => getDaysUntilExam(exam.date) === 0);
  const upcomingCount = mockExams.filter(exam => getDaysUntilExam(exam.date) > 0).length;
  const thisWeekCount = mockExams.filter(exam => {
    const days = getDaysUntilExam(exam.date);
    return days >= 0 && days <= 7;
  }).length;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`text-center p-2 rounded ${
          todayExams.length > 0 ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          <div className={`text-lg font-bold ${
            todayExams.length > 0 ? 'text-red-900' : 'text-gray-700'
          }`}>
            {todayExams.length}
          </div>
          <div className={`text-xs ${
            todayExams.length > 0 ? 'text-red-700' : 'text-gray-600'
          }`}>
            Today
          </div>
        </div>
        <div className="text-center p-2 bg-orange-50 rounded">
          <div className="text-lg font-bold text-orange-900">{thisWeekCount}</div>
          <div className="text-xs text-orange-700">This Week</div>
        </div>
        <div className="text-center p-2 bg-blue-50 rounded">
          <div className="text-lg font-bold text-blue-900">{upcomingCount}</div>
          <div className="text-xs text-blue-700">Upcoming</div>
        </div>
      </div>

      {/* Today's Exams Alert */}
      {todayExams.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              {todayExams.length} exam{todayExams.length !== 1 ? 's' : ''} today!
            </span>
          </div>
          {todayExams.map(exam => (
            <div key={exam.id} className="text-xs text-red-700">
              • {exam.subject} at {exam.time} in {exam.room}
            </div>
          ))}
        </div>
      )}

      {/* Upcoming Exams List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {mockExams.slice(0, 4).map((exam) => {
          const daysUntil = getDaysUntilExam(exam.date);
          const isToday = daysUntil === 0;
          const isTomorrow = daysUntil === 1;
          const isThisWeek = daysUntil >= 0 && daysUntil <= 7;
          
          return (
            <div
              key={exam.id}
              className={`p-3 rounded-lg border transition-all ${
                isToday 
                  ? 'bg-red-50 border-red-200 shadow-md' 
                  : isTomorrow
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-white border-gray-200 hover:border-blue-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={getExamTypeColor(exam.type)}>
                      {getExamTypeIcon(exam.type)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{exam.subject}</span>
                    <Badge 
                      variant="outline"
                      className={getPriorityColor(exam.priority)}
                    >
                      {exam.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-700 mb-1">{exam.title}</div>
                  <div className="text-xs text-gray-600">{exam.teacher}</div>
                </div>
                
                <div className="text-right">
                  <div className={`text-sm font-medium ${
                    isToday ? 'text-red-600' : 
                    isTomorrow ? 'text-orange-600' :
                    isThisWeek ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {isToday ? 'Today' :
                     isTomorrow ? 'Tomorrow' :
                     daysUntil > 0 ? `${daysUntil} days` :
                     `${Math.abs(daysUntil)} days ago`}
                  </div>
                  <div className="text-xs text-gray-500">{exam.time}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(exam.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{exam.duration}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{exam.room}</span>
                  </div>
                </div>
                
                {exam.syllabus && exam.syllabus.length > 0 && (
                  <div className="text-xs text-blue-600">
                    {exam.syllabus.length} topic{exam.syllabus.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Syllabus Preview */}
              {exam.syllabus && exam.syllabus.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-600">
                    Topics: {exam.syllabus.slice(0, 2).join(', ')}
                    {exam.syllabus.length > 2 && ` +${exam.syllabus.length - 2} more`}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show More */}
      {mockExams.length > 4 && (
        <div className="text-center">
          <Link 
            to="/exams"
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            View all {mockExams.length} upcoming exams
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <Link 
          to="/exams?view=calendar"
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
        >
          Exam Calendar
        </Link>
        <Link 
          to="/study-materials"
          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-center"
        >
          Study Materials
        </Link>
      </div>
    </div>
  );
};