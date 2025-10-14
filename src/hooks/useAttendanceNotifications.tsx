import { useEffect, useState, useCallback } from 'react';
import { useWebSocket, MessageType, SubscriptionType } from './useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

interface AttendanceNotification {
  id: string;
  type: 'attendance_marked' | 'attendance_alert' | 'pattern_detected' | 'absence_alert' | 'late_alert';
  student_id: string;
  student_name: string;
  class_id?: string;
  class_name?: string;
  date: string;
  status?: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
  timestamp: string;
}

interface AttendanceStats {
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_rate: number;
  date: string;
  class_id?: string;
}

interface UseAttendanceNotificationsOptions {
  classId?: string;
  studentId?: string;
  enableToastNotifications?: boolean;
  onNotificationReceived?: (notification: AttendanceNotification) => void;
  onStatsUpdate?: (stats: AttendanceStats) => void;
}

export const useAttendanceNotifications = (options: UseAttendanceNotificationsOptions = {}) => {
  const {
    classId,
    studentId,
    enableToastNotifications = true,
    onNotificationReceived,
    onStatsUpdate
  } = options;

  const [notifications, setNotifications] = useState<AttendanceNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const queryClient = useQueryClient();

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'attendance_notification':
        const notification = message.payload as AttendanceNotification;
        
        // Add to notifications list
        setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep only latest 50
        setUnreadCount(prev => prev + 1);
        
        // Call callback
        onNotificationReceived?.(notification);
        
        // Show toast notification if enabled
        if (enableToastNotifications) {
          const toastConfig = getToastConfig(notification);
          toast(toastConfig);
        }
        
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        queryClient.invalidateQueries({ queryKey: ['attendance-alerts'] });
        queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
        
        break;

      case 'attendance_stats_update':
        const stats = message.payload as AttendanceStats;
        onStatsUpdate?.(stats);
        
        // Invalidate analytics queries
        queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
        break;

      case 'attendance_bulk_complete':
        // Bulk attendance marking completed
        if (enableToastNotifications) {
          toast({
            title: "Attendance Saved",
            description: `Attendance has been successfully recorded for ${message.payload.total_students} students.`,
          });
        }
        
        // Invalidate all attendance-related queries
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        queryClient.invalidateQueries({ queryKey: ['attendance-alerts'] });
        queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
        break;
    }
  }, [onNotificationReceived, onStatsUpdate, enableToastNotifications, queryClient]);

  const {
    isConnected,
    isAuthenticated,
    subscribe,
    unsubscribe,
    sendMessage,
    userInfo
  } = useWebSocket({
    onMessage: handleWebSocketMessage,
    enableSubscriptions: true
  });

  // Subscribe to attendance notifications when authenticated
  useEffect(() => {
    if (isAuthenticated && !isSubscribed) {
      // Subscribe to general attendance notifications
      subscribe(SubscriptionType.NOTIFICATIONS, 'attendance_notifications');
      
      // Subscribe to class-specific notifications if classId is provided
      if (classId) {
        subscribe(SubscriptionType.COLLECTION, `attendance_class_${classId}`);
      }
      
      // Subscribe to student-specific notifications if studentId is provided
      if (studentId) {
        subscribe(SubscriptionType.DOCUMENT, `attendance_student_${studentId}`);
      }
      
      // Subscribe to branch-level attendance updates if user has branch_id
      if (userInfo?.branch_id) {
        subscribe(SubscriptionType.BRANCH_DATA, `attendance_branch_${userInfo.branch_id}`);
      }
      
      setIsSubscribed(true);
    }
  }, [isAuthenticated, isSubscribed, subscribe, classId, studentId, userInfo?.branch_id]);

  // Cleanup subscriptions on unmount or option changes
  useEffect(() => {
    return () => {
      if (isSubscribed) {
        unsubscribe('attendance_notifications');
        if (classId) {
          unsubscribe(`attendance_class_${classId}`);
        }
        if (studentId) {
          unsubscribe(`attendance_student_${studentId}`);
        }
        if (userInfo?.branch_id) {
          unsubscribe(`attendance_branch_${userInfo.branch_id}`);
        }
      }
    };
  }, [classId, studentId, userInfo?.branch_id]);

  const getToastConfig = (notification: AttendanceNotification) => {
    const baseConfig = {
      title: getNotificationTitle(notification.type),
      description: notification.message,
    };

    switch (notification.severity) {
      case 'critical':
        return {
          ...baseConfig,
          variant: 'destructive' as const,
          duration: 10000, // Keep critical alerts longer
        };
      case 'high':
        return {
          ...baseConfig,
          variant: 'destructive' as const,
          duration: 7000,
        };
      case 'medium':
        return {
          ...baseConfig,
          duration: 5000,
        };
      case 'low':
      default:
        return {
          ...baseConfig,
          duration: 3000,
        };
    }
  };

  const getNotificationTitle = (type: AttendanceNotification['type']) => {
    switch (type) {
      case 'attendance_marked':
        return 'Attendance Updated';
      case 'attendance_alert':
        return 'Attendance Alert';
      case 'pattern_detected':
        return 'Pattern Detected';
      case 'absence_alert':
        return 'Absence Alert';
      case 'late_alert':
        return 'Late Arrival';
      default:
        return 'Attendance Notification';
    }
  };

  const markAsRead = useCallback((notificationId?: string) => {
    if (notificationId) {
      // Mark specific notification as read
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } as any : n)
      );
    } else {
      // Mark all as read
      setNotifications(prev => prev.map(n => ({ ...n, read: true } as any)));
      setUnreadCount(0);
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const sendAttendanceUpdate = useCallback((attendanceData: any) => {
    if (isConnected) {
      return sendMessage({
        type: 'attendance_update',
        payload: attendanceData,
        timestamp: new Date().toISOString()
      });
    }
    return false;
  }, [isConnected, sendMessage]);

  const requestAttendanceStats = useCallback((date: string, classId?: string) => {
    if (isConnected) {
      return sendMessage({
        type: 'request_attendance_stats',
        payload: { date, class_id: classId },
        timestamp: new Date().toISOString()
      });
    }
    return false;
  }, [isConnected, sendMessage]);

  return {
    // Connection status
    isConnected,
    isAuthenticated,
    isSubscribed,

    // Notifications
    notifications,
    unreadCount,
    markAsRead,
    clearNotifications,

    // Actions
    sendAttendanceUpdate,
    requestAttendanceStats,

    // User info
    userInfo
  };
};