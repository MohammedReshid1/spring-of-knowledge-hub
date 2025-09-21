import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { useWebSocket, ConnectionStatus, MessageType, SubscriptionType, WebSocketMessage } from '@/hooks/useWebSocket';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { config } from '@/lib/config';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  timestamp: string;
  read: boolean;
  clicked: boolean;
  action_url?: string;
  action_text?: string;
  sender_name?: string;
  sender_role?: string;
  data?: any;
  expires_at?: string;
}

export interface SystemAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  dismissed: boolean;
  auto_dismiss?: boolean;
  dismiss_after?: number;
}

interface NotificationState {
  notifications: Notification[];
  systemAlerts: SystemAlert[];
  unreadCount: number;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isAuthenticated: boolean;
  soundEnabled: boolean;
  subscriptions: string[];
  stats: {
    total: number;
    unread: number;
    today: number;
    highPriority: number;
  };
}

type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'ADD_SYSTEM_ALERT'; payload: SystemAlert }
  | { type: 'MARK_READ'; payload: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'MARK_CLICKED'; payload: string }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'DISMISS_ALERT'; payload: string }
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionStatus }
  | { type: 'SET_SOUND_ENABLED'; payload: boolean }
  | { type: 'UPDATE_SUBSCRIPTIONS'; payload: string[] }
  | { type: 'CLEAR_EXPIRED' }
  | { type: 'LOAD_NOTIFICATIONS'; payload: Notification[] };

const initialState: NotificationState = {
  notifications: [],
  systemAlerts: [],
  unreadCount: 0,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  isConnected: false,
  isAuthenticated: false,
  soundEnabled: true,
  subscriptions: [],
  stats: {
    total: 0,
    unread: 0,
    today: 0,
    highPriority: 0
  }
};

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION': {
      const newNotification = action.payload;
      const updatedNotifications = [newNotification, ...state.notifications];
      const unreadCount = updatedNotifications.filter(n => !n.read).length;
      const today = new Date().toDateString();
      const todayCount = updatedNotifications.filter(n => 
        new Date(n.timestamp).toDateString() === today
      ).length;
      const highPriorityCount = updatedNotifications.filter(n => 
        n.priority === 'high' || n.priority === 'urgent'
      ).length;

      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount,
        stats: {
          total: updatedNotifications.length,
          unread: unreadCount,
          today: todayCount,
          highPriority: highPriorityCount
        }
      };
    }

    case 'ADD_SYSTEM_ALERT': {
      const newAlert = action.payload;
      return {
        ...state,
        systemAlerts: [newAlert, ...state.systemAlerts.filter(a => a.id !== newAlert.id)]
      };
    }

    case 'MARK_READ': {
      const updatedNotifications = state.notifications.map(n =>
        n.id === action.payload ? { ...n, read: true } : n
      );
      const unreadCount = updatedNotifications.filter(n => !n.read).length;

      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount,
        stats: { ...state.stats, unread: unreadCount }
      };
    }

    case 'MARK_ALL_READ': {
      const updatedNotifications = state.notifications.map(n => ({ ...n, read: true }));
      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: 0,
        stats: { ...state.stats, unread: 0 }
      };
    }

    case 'MARK_CLICKED': {
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, clicked: true } : n
        )
      };
    }

    case 'REMOVE_NOTIFICATION': {
      const updatedNotifications = state.notifications.filter(n => n.id !== action.payload);
      const unreadCount = updatedNotifications.filter(n => !n.read).length;
      
      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount,
        stats: {
          total: updatedNotifications.length,
          unread: unreadCount,
          today: state.stats.today - 1,
          highPriority: state.stats.highPriority
        }
      };
    }

    case 'DISMISS_ALERT': {
      return {
        ...state,
        systemAlerts: state.systemAlerts.map(a =>
          a.id === action.payload ? { ...a, dismissed: true } : a
        )
      };
    }

    case 'SET_CONNECTION_STATUS': {
      return {
        ...state,
        connectionStatus: action.payload,
        isConnected: action.payload === ConnectionStatus.CONNECTED || 
                     action.payload === ConnectionStatus.AUTHENTICATED,
        isAuthenticated: action.payload === ConnectionStatus.AUTHENTICATED
      };
    }

    case 'SET_SOUND_ENABLED': {
      return { ...state, soundEnabled: action.payload };
    }

    case 'UPDATE_SUBSCRIPTIONS': {
      return { ...state, subscriptions: action.payload };
    }

    case 'CLEAR_EXPIRED': {
      const now = new Date();
      const updatedNotifications = state.notifications.filter(n => 
        !n.expires_at || new Date(n.expires_at) > now
      );
      const updatedAlerts = state.systemAlerts.filter(a => 
        !a.dismissed || (a.auto_dismiss && a.dismiss_after && 
        (now.getTime() - new Date(a.timestamp).getTime()) < a.dismiss_after * 1000)
      );

      return {
        ...state,
        notifications: updatedNotifications,
        systemAlerts: updatedAlerts
      };
    }

    case 'LOAD_NOTIFICATIONS': {
      const notifications = action.payload;
      const unreadCount = notifications.filter(n => !n.read).length;
      const today = new Date().toDateString();
      const todayCount = notifications.filter(n => 
        new Date(n.timestamp).toDateString() === today
      ).length;
      const highPriorityCount = notifications.filter(n => 
        n.priority === 'high' || n.priority === 'urgent'
      ).length;

      return {
        ...state,
        notifications,
        unreadCount,
        stats: {
          total: notifications.length,
          unread: unreadCount,
          today: todayCount,
          highPriority: highPriorityCount
        }
      };
    }

    default:
      return state;
  }
}

interface NotificationContextType {
  // State
  notifications: Notification[];
  systemAlerts: SystemAlert[];
  unreadCount: number;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isAuthenticated: boolean;
  soundEnabled: boolean;
  subscriptions: string[];
  stats: NotificationState['stats'];

  // Actions
  addNotification: (notification: Notification) => void;
  addSystemAlert: (alert: SystemAlert) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  markAsClicked: (id: string) => void;
  removeNotification: (id: string) => void;
  dismissAlert: (id: string) => void;
  toggleSound: () => void;
  subscribe: (type: SubscriptionType, resource: string, filters?: any) => boolean;
  unsubscribe: (subscriptionId: string) => boolean;
  
  // WebSocket
  connectionId: string | null;
  reconnect: () => void;
  disconnect: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { user, isAuthenticated: authIsAuthenticated } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout>();

  // Initialize notification sound
  useEffect(() => {
    if (state.soundEnabled) {
      audioRef.current = new Audio('/sounds/notification.mp3');
      audioRef.current.volume = 0.5;
    }
  }, [state.soundEnabled]);

  const playNotificationSound = (priority: string) => {
    if (state.soundEnabled && audioRef.current) {
      // Different volumes for different priorities
      switch (priority) {
        case 'urgent':
          audioRef.current.volume = 0.8;
          break;
        case 'high':
          audioRef.current.volume = 0.6;
          break;
        default:
          audioRef.current.volume = 0.4;
      }
      
      audioRef.current.play().catch(error => {
        console.warn('Could not play notification sound:', error);
      });
    }
  };

  const showToastNotification = (notification: Notification) => {
    const toastOptions = {
      description: notification.message,
      action: notification.action_url ? {
        label: notification.action_text || 'View',
        onClick: () => {
          markAsClicked(notification.id);
          if (notification.action_url) {
            window.open(notification.action_url, '_blank');
          }
        }
      } : undefined
    };

    switch (notification.priority) {
      case 'urgent':
        toast.error(notification.title, toastOptions);
        break;
      case 'high':
        toast.warning(notification.title, toastOptions);
        break;
      case 'medium':
        toast.info(notification.title, toastOptions);
        break;
      default:
        toast.success(notification.title, toastOptions);
    }
  };

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case MessageType.NOTIFICATION: {
        const notificationData = message.payload;
        const notification: Notification = {
          id: message.message_id || crypto.randomUUID(),
          type: notificationData.type || 'general',
          title: notificationData.title || 'New Notification',
          message: notificationData.message || '',
          priority: notificationData.priority || 'medium',
          category: notificationData.category || 'general',
          timestamp: message.timestamp || new Date().toISOString(),
          read: false,
          clicked: false,
          action_url: notificationData.action_url,
          action_text: notificationData.action_text,
          sender_name: notificationData.sender_name,
          sender_role: notificationData.sender_role,
          data: notificationData.data,
          expires_at: notificationData.expires_at
        };

        dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
        playNotificationSound(notification.priority);
        showToastNotification(notification);
        break;
      }

      case MessageType.SYSTEM_ALERT: {
        const alertData = message.payload;
        const systemAlert: SystemAlert = {
          id: message.message_id || crypto.randomUUID(),
          type: alertData.type || 'info',
          title: alertData.title || 'System Alert',
          message: alertData.message || '',
          timestamp: message.timestamp || new Date().toISOString(),
          dismissed: false,
          auto_dismiss: alertData.auto_dismiss,
          dismiss_after: alertData.dismiss_after
        };

        dispatch({ type: 'ADD_SYSTEM_ALERT', payload: systemAlert });
        
        // Show system alert as toast
        switch (systemAlert.type) {
          case 'error':
            toast.error(systemAlert.title, { description: systemAlert.message });
            break;
          case 'warning':
            toast.warning(systemAlert.title, { description: systemAlert.message });
            break;
          case 'success':
            toast.success(systemAlert.title, { description: systemAlert.message });
            break;
          default:
            toast.info(systemAlert.title, { description: systemAlert.message });
        }
        break;
      }

      case MessageType.DATA_UPDATE:
      case MessageType.DATA_INSERT:
      case MessageType.DATA_DELETE: {
        // Handle real-time data updates
        const updateData = message.payload;
        if (updateData.collection && updateData.event_type) {
          // Create a lightweight notification for data changes
          const dataNotification: Notification = {
            id: message.message_id || crypto.randomUUID(),
            type: 'data_update',
            title: `${updateData.collection} Updated`,
            message: `${updateData.event_type} operation completed`,
            priority: 'low',
            category: 'system',
            timestamp: message.timestamp || new Date().toISOString(),
            read: true, // Mark as read by default for data updates
            clicked: false,
            data: updateData
          };

          // Only add to notifications if it's significant
          if (['students', 'teachers', 'classes', 'grades', 'exams'].includes(updateData.collection)) {
            dispatch({ type: 'ADD_NOTIFICATION', payload: dataNotification });
          }
        }
        break;
      }
    }
  };

  const handleConnectionStatusChange = (status: ConnectionStatus) => {
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: status });
  };

  // Configure WebSocket
  const wsBaseUrl = config.API_BASE_URL.replace(/^http/, 'ws');
  const wsUrl = `${wsBaseUrl}/ws`;

  const {
    isConnected,
    isAuthenticated: wsIsAuthenticated,
    connectionId,
    subscribe: wsSubscribe,
    unsubscribe: wsUnsubscribe,
    subscriptions: wsSubscriptions,
    connect: wsConnect,
    disconnect: wsDisconnect
  } = useWebSocket({
    url: wsUrl,
    onMessage: handleWebSocketMessage,
    onConnectionStatusChange: handleConnectionStatusChange,
    autoConnect: authIsAuthenticated,
    enableSubscriptions: true,
    shouldReconnect: (closeEvent) => {
      // Don't reconnect on authentication failures
      return closeEvent?.code !== 1011 && authIsAuthenticated;
    }
  });

  // Auto-subscribe to notifications when authenticated
  useEffect(() => {
    if (wsIsAuthenticated && user) {
      // Subscribe to user-specific notifications
      wsSubscribe(SubscriptionType.USER_DATA, user.id);
      wsSubscribe(SubscriptionType.NOTIFICATIONS, 'user_notifications');
      
      // Subscribe to branch-specific data if user has branch
      if (user.branch_id) {
        wsSubscribe(SubscriptionType.BRANCH_DATA, user.branch_id);
      }

      // Subscribe to system events
      wsSubscribe(SubscriptionType.SYSTEM_EVENTS, 'system_notifications');

      // Subscribe to relevant collections based on user role
      const roleSubscriptions = {
        student: ['grades', 'attendance', 'assignments', 'exams'],
        parent: ['grades', 'attendance', 'assignments', 'fees', 'exams'],
        teacher: ['students', 'classes', 'attendance', 'grades', 'assignments', 'exams'],
        admin: ['students', 'teachers', 'classes', 'grades', 'attendance', 'fees', 'assignments', 'exams'],
        superadmin: ['students', 'teachers', 'classes', 'grades', 'attendance', 'fees', 'assignments', 'exams']
      };

      const collections = roleSubscriptions[user.role as keyof typeof roleSubscriptions] || [];
      collections.forEach(collection => {
        wsSubscribe(SubscriptionType.COLLECTION, collection);
      });
    }
  }, [wsIsAuthenticated, user, wsSubscribe]);

  // Update subscriptions in state
  useEffect(() => {
    dispatch({ type: 'UPDATE_SUBSCRIPTIONS', payload: wsSubscriptions });
  }, [wsSubscriptions]);

  // Periodic cleanup of expired notifications and alerts
  useEffect(() => {
    cleanupIntervalRef.current = setInterval(() => {
      dispatch({ type: 'CLEAR_EXPIRED' });
    }, 60000); // Run every minute

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, []);

  // Context value
  const contextValue: NotificationContextType = {
    // State
    notifications: state.notifications,
    systemAlerts: state.systemAlerts.filter(a => !a.dismissed),
    unreadCount: state.unreadCount,
    connectionStatus: state.connectionStatus,
    isConnected: state.isConnected,
    isAuthenticated: state.isAuthenticated,
    soundEnabled: state.soundEnabled,
    subscriptions: state.subscriptions,
    stats: state.stats,

    // Actions
    addNotification: (notification) => dispatch({ type: 'ADD_NOTIFICATION', payload: notification }),
    addSystemAlert: (alert) => dispatch({ type: 'ADD_SYSTEM_ALERT', payload: alert }),
    markAsRead: (id) => dispatch({ type: 'MARK_READ', payload: id }),
    markAllAsRead: () => dispatch({ type: 'MARK_ALL_READ' }),
    markAsClicked: (id) => dispatch({ type: 'MARK_CLICKED', payload: id }),
    removeNotification: (id) => dispatch({ type: 'REMOVE_NOTIFICATION', payload: id }),
    dismissAlert: (id) => dispatch({ type: 'DISMISS_ALERT', payload: id }),
    toggleSound: () => dispatch({ type: 'SET_SOUND_ENABLED', payload: !state.soundEnabled }),
    subscribe: wsSubscribe,
    unsubscribe: wsUnsubscribe,

    // WebSocket
    connectionId,
    reconnect: wsConnect,
    disconnect: wsDisconnect
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};