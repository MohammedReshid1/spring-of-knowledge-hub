import React from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Pin, Calendar, AlertCircle, Info, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';
const mockAnnouncements = [
  {
    id: 1,
    title: 'Final Exam Schedule Released',
    content: 'The final examination schedule for this semester has been published. Please check your exam dates and prepare accordingly.',
    type: 'important',
    priority: 'high',
    author: 'Academic Office',
    date: '2025-09-03',
    pinned: true,
    targetAudience: ['students', 'parents'],
    category: 'academic'
  },
  {
    id: 2,
    title: 'Library Hours Extended',
    content: 'Due to upcoming exams, library hours will be extended until 10 PM starting Monday. Additional study spaces available.',
    type: 'info',
    priority: 'medium',
    author: 'Library Services',
    date: '2025-09-02',
    pinned: false,
    targetAudience: ['students'],
    category: 'facilities'
  },
  {
    id: 3,
    title: 'Parent-Teacher Conference',
    content: 'Individual parent-teacher conferences will be held next week. Please schedule your appointment through the parent portal.',
    type: 'event',
    priority: 'medium',
    author: 'Administration',
    date: '2025-09-01',
    pinned: true,
    targetAudience: ['parents', 'students'],
    category: 'events'
  },
  {
    id: 4,
    title: 'Cafeteria Menu Update',
    content: 'New healthy meal options have been added to the cafeteria menu. Vegetarian and gluten-free options now available daily.',
    type: 'info',
    priority: 'low',
    author: 'Food Services',
    date: '2025-08-31',
    pinned: false,
    targetAudience: ['students', 'parents'],
    category: 'facilities'
  },
  {
    id: 5,
    title: 'School Closure - Public Holiday',
    content: 'School will be closed on Friday, September 8th in observance of National Day. Classes will resume on Monday.',
    type: 'alert',
    priority: 'high',
    author: 'Administration',
    date: '2025-08-30',
    pinned: false,
    targetAudience: ['students', 'parents', 'teachers'],
    category: 'general'
  }
];

export const AnnouncementsWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useAnnouncements } = useWidgetData();
  const { data: announcementsData, isLoading, error } = useAnnouncements();

  if (error) {
    return <div className="text-sm text-red-500">Failed to load announcements</div>;
  }

  const announcements = announcementsData || [];
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-3 bg-gray-100 rounded animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case 'important': return <AlertCircle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      case 'event': return <Calendar className="h-4 w-4" />;
      case 'alert': return <Bell className="h-4 w-4" />;
      default: return <Megaphone className="h-4 w-4" />;
    }
  };

  const getAnnouncementColor = (type: string, priority: string) => {
    if (priority === 'high') {
      switch (type) {
        case 'important': return 'text-red-600';
        case 'alert': return 'text-red-600';
        default: return 'text-orange-600';
      }
    }
    switch (type) {
      case 'important': return 'text-orange-600';
      case 'info': return 'text-blue-600';
      case 'event': return 'text-purple-600';
      case 'alert': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getAnnouncementBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'academic': return 'text-blue-600';
      case 'facilities': return 'text-green-600';
      case 'events': return 'text-purple-600';
      case 'general': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getDaysAgo = (date: string) => {
    const today = new Date();
    const announcementDate = new Date(date);
    const diffTime = today.getTime() - announcementDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return announcementDate.toLocaleDateString();
  };

  const pinnedAnnouncements = mockAnnouncements.filter(a => a.pinned);
  const recentAnnouncements = mockAnnouncements.filter(a => !a.pinned).slice(0, 3);
  const unreadCount = mockAnnouncements.length; // In real app, would track read status

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <Megaphone className="h-5 w-5 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-blue-900">{mockAnnouncements.length}</div>
          <div className="text-xs text-blue-700">Total</div>
        </div>
        <div className="text-center p-2 bg-orange-50 rounded-lg">
          <Pin className="h-5 w-5 text-orange-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-orange-900">{pinnedAnnouncements.length}</div>
          <div className="text-xs text-orange-700">Pinned</div>
        </div>
      </div>

      {/* Pinned Announcements */}
      {pinnedAnnouncements.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Pin className="h-3 w-3 text-orange-600" />
            <span className="text-xs font-medium text-orange-700">Pinned</span>
          </div>
          <div className="space-y-2">
            {pinnedAnnouncements.map((announcement) => (
              <div
                key={announcement.id}
                className="p-3 rounded-lg border bg-orange-50 border-orange-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2 flex-1">
                    <div className={getAnnouncementColor(announcement.type, announcement.priority)}>
                      {getAnnouncementIcon(announcement.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{announcement.title}</span>
                        <Badge 
                          variant="outline"
                          className={getAnnouncementBadgeColor(announcement.priority)}
                        >
                          {announcement.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-700 line-clamp-2">
                        {announcement.content}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <span>{announcement.author}</span>
                    <span>•</span>
                    <span className={getCategoryColor(announcement.category)}>
                      {announcement.category}
                    </span>
                  </div>
                  <span>{getDaysAgo(announcement.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Announcements */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">Recent Updates</div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {recentAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className="p-3 rounded-lg border bg-white hover:border-blue-200 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <div className={getAnnouncementColor(announcement.type, announcement.priority)}>
                    {getAnnouncementIcon(announcement.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{announcement.title}</span>
                      {announcement.priority === 'high' && (
                        <Badge className="bg-red-100 text-red-800 text-xs">Urgent</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">
                      {announcement.content}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span>{announcement.author}</span>
                  <span>•</span>
                  <span className={getCategoryColor(announcement.category)}>
                    {announcement.category}
                  </span>
                </div>
                <span>{getDaysAgo(announcement.date)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* High Priority Alert */}
      {mockAnnouncements.some(a => a.priority === 'high' && getDaysAgo(a.date) === 'Today') && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          New high priority announcements require your attention
        </div>
      )}

      {/* Show More */}
      {mockAnnouncements.length > (pinnedAnnouncements.length + recentAnnouncements.length) && (
        <div className="text-center">
          <Link 
            to="/announcements"
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            View all {mockAnnouncements.length} announcements
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <Link 
          to="/announcements?filter=important"
          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-center"
        >
          Important Only
        </Link>
        <Link 
          to="/notifications/settings"
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
        >
          Notification Settings
        </Link>
      </div>
    </div>
  );
};