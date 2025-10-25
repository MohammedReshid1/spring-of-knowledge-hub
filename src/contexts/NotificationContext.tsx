import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { ConnectionStatus, MessageType, SubscriptionType, WebSocketMessage } from '@/types/websocket';
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
  dismissed?: boolean;  // For hiding from bell dropdown but keeping in full list
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
  | { type: 'DISMISS_NOTIFICATION'; payload: string }
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

    case 'DISMISS_NOTIFICATION': {
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, dismissed: true } : n
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
  dismissNotification: (id: string) => void;
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

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.info('Browser notifications enabled');
        }
      });
    }
  }, []);

  const playNotificationSound = async (priority: string) => {
    if (!state.soundEnabled) {
      return;
    }

    try {
      // Try to play custom audio file first
      const audio = new Audio('/sounds/notification.mp3');

      // Adjust volume based on priority
      switch (priority) {
        case 'urgent':
          audio.volume = 0.8;
          break;
        case 'high':
          audio.volume = 0.6;
          break;
        case 'medium':
          audio.volume = 0.5;
          break;
        default:
          audio.volume = 0.4;
      }

      await audio.play();
    } catch (error) {
      console.warn('Could not play audio file, falling back to Web Audio API:', error);

      // Fallback to Web Audio API if file doesn't exist
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContext();

        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        // Telegram-style notification sound (accurate tri-tone)
        const notes: { freq: number; start: number; duration: number }[] = [
          { freq: 1318.51, start: 0, duration: 0.07 },
          { freq: 1046.50, start: 0.075, duration: 0.07 },
          { freq: 880.00, start: 0.15, duration: 0.1 }
        ];

        let volume = 0.4;
        switch (priority) {
          case 'urgent':
            volume = 0.5;
            break;
          case 'high':
            volume = 0.45;
            break;
          case 'medium':
            volume = 0.4;
            break;
          default:
            volume = 0.35;
        }

        const now = audioContext.currentTime;

        notes.forEach(note => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.value = note.freq;
          oscillator.type = 'sine';

          const startTime = now + note.start;
          const endTime = startTime + note.duration;

          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
          gainNode.gain.setValueAtTime(volume, endTime - 0.02);
          gainNode.gain.linearRampToValueAtTime(0, endTime);

          oscillator.start(startTime);
          oscillator.stop(endTime);
        });

        setTimeout(() => {
          audioContext.close();
        }, 500);
      } catch (fallbackError) {
        console.error('Could not play any notification sound:', fallbackError);
      }
    }
  };

  const showToastNotification = (notification: Notification) => {
    const toastOptions = {
      description: notification.message,
      action: notification.action_url ? {
        label: notification.action_text || 'View',
        onClick: () => {
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
          id: notificationData.id || message.message_id || crypto.randomUUID(),  // Use recipient ID from payload
          type: notificationData.notification_type || notificationData.type || 'general',
          title: notificationData.title || 'New Notification',
          message: notificationData.message || '',
          priority: notificationData.priority || 'medium',
          category: notificationData.category || notificationData.notification_type || 'general',
          timestamp: notificationData.created_at || notificationData.timestamp || message.timestamp || new Date().toISOString(),
          read: notificationData.recipient_status === 'read' || false,
          clicked: notificationData.clicked || false,
          action_url: notificationData.action_url,
          action_text: notificationData.action_text || (notificationData.type === 'message' ? 'View Message' : undefined),
          sender_name: notificationData.sender_name,
          sender_role: notificationData.sender_role,
          data: notificationData.data || notificationData.metadata,
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

  // Use WebSocketContext (replaces old useWebSocket hook)
  const {
    isConnected,
    connectionStatus: wsConnectionStatus,
    subscribe: wsSubscribe,
    unsubscribe: wsUnsubscribe,
    addEventListener
  } = useWebSocket();

  // Map connection status to ConnectionStatus enum and update local state
  const wsIsAuthenticated = wsConnectionStatus === 'authenticated';
  const connectionId = null; // WebSocketContext doesn't expose connectionId, but it's not critical
  const reconnectCount = useRef(0); // Track reconnection attempts locally if needed

  // Monitor connection status changes and dispatch to reducer
  useEffect(() => {
    const statusMap: Record<typeof wsConnectionStatus, ConnectionStatus> = {
      'disconnected': ConnectionStatus.DISCONNECTED,
      'connecting': ConnectionStatus.CONNECTING,
      'connected': ConnectionStatus.CONNECTED,
      'authenticated': ConnectionStatus.AUTHENTICATED
    };

    const mappedStatus = statusMap[wsConnectionStatus] || ConnectionStatus.DISCONNECTED;
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: mappedStatus });
  }, [wsConnectionStatus]);

  // Set up WebSocket message listeners
  useEffect(() => {
    if (!isConnected) return;

    // Listen for notification messages
    const unsubNotification = addEventListener(MessageType.NOTIFICATION, (payload) => {
      const message: WebSocketMessage = { type: MessageType.NOTIFICATION, payload };
      handleWebSocketMessage(message);
    });

    // Listen for system alerts
    const unsubSystemAlert = addEventListener(MessageType.SYSTEM_ALERT, (payload) => {
      const message: WebSocketMessage = { type: MessageType.SYSTEM_ALERT, payload };
      handleWebSocketMessage(message);
    });

    // Listen for data updates
    const unsubDataUpdate = addEventListener(MessageType.DATA_UPDATE, (payload) => {
      const message: WebSocketMessage = { type: MessageType.DATA_UPDATE, payload };
      handleWebSocketMessage(message);
    });

    const unsubDataInsert = addEventListener(MessageType.DATA_INSERT, (payload) => {
      const message: WebSocketMessage = { type: MessageType.DATA_INSERT, payload };
      handleWebSocketMessage(message);
    });

    const unsubDataDelete = addEventListener(MessageType.DATA_DELETE, (payload) => {
      const message: WebSocketMessage = { type: MessageType.DATA_DELETE, payload };
      handleWebSocketMessage(message);
    });

    // Cleanup listeners on unmount or when connection changes
    return () => {
      unsubNotification();
      unsubSystemAlert();
      unsubDataUpdate();
      unsubDataInsert();
      unsubDataDelete();
    };
  }, [isConnected, addEventListener]);

  // Auto-subscribe to notifications when authenticated
  useEffect(() => {
    if (wsIsAuthenticated && user) {
      // Subscribe to user-specific notifications
      // New signature: subscribe(resource, type, filters)
      wsSubscribe(user.id, SubscriptionType.USER_DATA);
      wsSubscribe('user_notifications', SubscriptionType.NOTIFICATIONS);

      // Subscribe to branch-specific data if user has branch
      if (user.branch_id) {
        wsSubscribe(user.branch_id, SubscriptionType.BRANCH_DATA);
      }

      // Subscribe to system events
      wsSubscribe('system_notifications', SubscriptionType.SYSTEM_EVENTS);

      // Subscribe to relevant collections based on user role
      const roleSubscriptions = {
        student: ['grades', 'attendance', 'exams'],
        parent: ['grades', 'attendance', 'fees', 'exams'],
        teacher: ['students', 'classes', 'attendance', 'grades', 'exams'],
        admin: ['students', 'teachers', 'classes', 'grades', 'attendance', 'fees', 'exams'],
        superadmin: ['students', 'teachers', 'classes', 'grades', 'attendance', 'fees', 'exams']
      };

      const collections = roleSubscriptions[user.role as keyof typeof roleSubscriptions] || [];
      collections.forEach(collection => {
        wsSubscribe(collection, SubscriptionType.COLLECTION);
      });
    }
  }, [wsIsAuthenticated, user, wsSubscribe]);

  // Fetch existing notifications from API when user is authenticated
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!authIsAuthenticated || !user) {
        return;
      }

      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          return;
        }

        const url = `${config.API_BASE_URL}/api/notifications/me`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const apiNotifications: Notification[] = data.notifications.map((n: any) => ({
            id: n.id || n._id,  // Use n.id first, fallback to n._id
            type: n.notification_type || n.type || 'system',
            title: n.title,
            message: n.message,
            priority: n.priority || 'medium',
            category: n.notification_type || n.category || 'general',
            timestamp: n.created_at || n.timestamp,
            read: n.recipient_status === 'read',
            clicked: n.clicked || false,
            dismissed: n.dismissed || false,
            action_url: n.action_url,
            action_text: n.action_text,
            sender_name: n.sender_name,
            sender_role: n.sender_role,
            data: n.metadata || n.data
          }));

          dispatch({ type: 'LOAD_NOTIFICATIONS', payload: apiNotifications });
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
  }, [authIsAuthenticated, user]);

  // Note: WebSocketContext doesn't expose subscriptions array
  // We can't track active subscriptions in state anymore, but the context handles it internally

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

  // API-backed actions
  const markAsRead = async (id: string) => {
    dispatch({ type: 'MARK_READ', payload: id });
    // Auto-dismiss from bell when marking as read
    dispatch({ type: 'DISMISS_NOTIFICATION', payload: id });

    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(`${config.API_BASE_URL}/api/notifications/mark-read/${id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAsClicked = async (id: string) => {
    dispatch({ type: 'MARK_CLICKED', payload: id });

    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(`${config.API_BASE_URL}/api/notifications/mark-clicked/${id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Failed to mark notification as clicked:', error);
    }
  };

  const removeNotification = async (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });

    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(`${config.API_BASE_URL}/api/notifications/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const markAllAsRead = async () => {
    // Get all unread notifications before marking them
    const unreadNotifications = state.notifications.filter(n => !n.read);

    dispatch({ type: 'MARK_ALL_READ' });

    // Auto-dismiss all from bell when marking all as read
    unreadNotifications.forEach(n => {
      dispatch({ type: 'DISMISS_NOTIFICATION', payload: n.id });
    });

    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        // Use the mark-all-read endpoint
        await fetch(`${config.API_BASE_URL}/api/notifications/mark-all-read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Dismiss notification function
  const dismissNotification = async (id: string) => {

    // Optimistically update UI
    dispatch({ type: 'DISMISS_NOTIFICATION', payload: id });
    // Also mark as read when dismissing
    dispatch({ type: 'MARK_READ', payload: id });

    // Update backend
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const url = `${config.API_BASE_URL}/api/notifications/dismiss/${id}`;

        await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
      // Could revert optimistic update here if needed
    }
  };

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
    subscriptions: state.subscriptions, // Empty array now - WebSocketContext manages internally
    stats: state.stats,

    // Actions
    addNotification: (notification) => dispatch({ type: 'ADD_NOTIFICATION', payload: notification }),
    addSystemAlert: (alert) => dispatch({ type: 'ADD_SYSTEM_ALERT', payload: alert }),
    markAsRead,
    markAllAsRead,
    markAsClicked,
    dismissNotification,
    removeNotification,
    dismissAlert: (id) => dispatch({ type: 'DISMISS_ALERT', payload: id }),
    toggleSound: () => {
      const newSoundState = !state.soundEnabled;
      dispatch({ type: 'SET_SOUND_ENABLED', payload: newSoundState });

      // Play a test sound when enabling to allow browser audio and let user hear it
      if (newSoundState) {
        setTimeout(() => playNotificationSound('medium'), 100);
      }
    },
    // Wrap subscribe to match old signature: (type, resource, filters) => boolean
    subscribe: (type: SubscriptionType, resource: string, filters?: any) => {
      wsSubscribe(resource, type, filters);
      return true; // WebSocketContext returns string, but old signature expects boolean
    },
    // Wrap unsubscribe to match old signature
    unsubscribe: (subscriptionId: string) => {
      wsUnsubscribe(subscriptionId);
      return true;
    },

    // WebSocket
    connectionId,
    // WebSocketContext manages connection automatically - these are no-ops for backward compatibility
    reconnect: () => {
      console.warn('reconnect() called but WebSocketContext manages connections automatically');
    },
    disconnect: () => {
      console.warn('disconnect() called but WebSocketContext manages connections automatically');
    }
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};