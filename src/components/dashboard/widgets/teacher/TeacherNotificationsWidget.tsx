import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, MessageSquare, AlertCircle, CheckCircle, Clock, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';

export const TeacherNotificationsWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useTeacherNotifications } = useWidgetData();
  const { data: notifications, isLoading, error } = useTeacherNotifications();
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
    return <div className="text-sm text-red-500">Failed to load notifications</div>;
  }

  const notificationsData = notifications || [];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare className="h-4 w-4" />;
      case 'system': return <Bell className="h-4 w-4" />;
      case 'reminder': return <Clock className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'message': return 'text-blue-600';
      case 'system': return 'text-purple-600';
      case 'reminder': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const unreadCount = notificationsData.filter(n => !n.read).length;
  const highPriorityCount = notificationsData.filter(n => n.priority === 'high' && !n.read).length;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <Bell className="h-5 w-5 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-blue-900">{unreadCount}</div>
          <div className="text-xs text-blue-700">Unread</div>
        </div>
        <div className="text-center p-2 bg-red-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-red-900">{highPriorityCount}</div>
          <div className="text-xs text-red-700">Urgent</div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {notificationsData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No notifications available</p>
          </div>
        ) : (
          notificationsData.slice(0, 4).map((notification) => (
          <div
            key={notification.id}
            className={`p-3 rounded-lg border transition-all ${
              !notification.read 
                ? 'bg-blue-50 border-blue-200 shadow-sm' 
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start gap-2 flex-1">
                <div className={`${getTypeColor(notification.type)} mt-0.5`}>
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-medium ${
                      !notification.read ? 'text-gray-900' : 'text-gray-600'
                    }`}>
                      {notification.title}
                    </span>
                    <Badge 
                      variant="outline"
                      className={`text-xs ${getPriorityColor(notification.priority)} border-current`}
                    >
                      {notification.priority}
                    </Badge>
                  </div>
                  <p className={`text-xs ${
                    !notification.read ? 'text-gray-700' : 'text-gray-500'
                  }`}>
                    {notification.content}
                  </p>
                </div>
              </div>
              {!notification.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              )}
            </div>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{notification.from}</span>
              <span>{notification.time}</span>
            </div>
          </div>
        ))
      )}
      </div>

      {/* Show More */}
      {notificationsData.length > 4 && (
        <div className="text-center">
          <Link 
            to="/notifications"
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            View {notificationsData.length - 4} more notifications
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <Link 
          to="/notifications?filter=unread"
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
        >
          Mark All Read
        </Link>
        <Link 
          to="/messages"
          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-center"
        >
          Send Message
        </Link>
      </div>

      {/* High Priority Alert */}
      {highPriorityCount > 0 && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          {highPriorityCount} urgent notification{highPriorityCount !== 1 ? 's' : ''} require{highPriorityCount === 1 ? 's' : ''} immediate attention
        </div>
      )}
    </div>
  );
};