import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TokenStorage } from '@/utils/tokenStorage';

interface WebSocketMessage {
  type: string;
  payload: any;
  message_id?: string;
  timestamp?: string;
  correlation_id?: string;
}

interface WebSocketOptions {
  url?: string;
  onOpen?: () => void;
  onMessage?: (message: WebSocketMessage) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  shouldReconnect?: (closeEvent?: CloseEvent) => boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoConnect?: boolean;
  enableSubscriptions?: boolean;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

export enum MessageType {
  CONNECTION_ACK = 'connection_ack',
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
  AUTHENTICATE = 'authenticate',
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILED = 'auth_failed',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SUBSCRIPTION_SUCCESS = 'subscription_success',
  SUBSCRIPTION_ERROR = 'subscription_error',
  DATA_UPDATE = 'data_update',
  DATA_DELETE = 'data_delete',
  DATA_INSERT = 'data_insert',
  DATA_BATCH = 'data_batch',
  NOTIFICATION = 'notification',
  SYSTEM_ALERT = 'system_alert',
  USER_ACTIVITY = 'user_activity',
  SYSTEM_STATUS = 'system_status',
  OPERATION_PROGRESS = 'operation_progress',
  OPERATION_COMPLETE = 'operation_complete'
}

export enum SubscriptionType {
  COLLECTION = 'collection',
  DOCUMENT = 'document',
  USER_DATA = 'user_data',
  BRANCH_DATA = 'branch_data',
  NOTIFICATIONS = 'notifications',
  SYSTEM_EVENTS = 'system_events'
}

interface WebSocketState {
  socket: WebSocket | null;
  lastMessage: WebSocketMessage | null;
  readyState: number;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isAuthenticated: boolean;
  reconnectCount: number;
  subscriptions: Set<string>;
  connectionId: string | null;
  userInfo: {
    user_id?: string;
    role?: string;
    branch_id?: string;
  } | null;
}

export const useWebSocket = (options: WebSocketOptions = {}) => {
  const {
    url = 'ws://localhost:8001/ws',
    onOpen,
    onMessage,
    onClose,
    onError,
    onConnectionStatusChange,
    shouldReconnect = () => true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    autoConnect = true,
    enableSubscriptions = true
  } = options;

  const [state, setState] = useState<WebSocketState>({
    socket: null,
    lastMessage: null,
    readyState: WebSocket.CONNECTING,
    connectionStatus: ConnectionStatus.DISCONNECTED,
    isConnected: false,
    isAuthenticated: false,
    reconnectCount: 0,
    subscriptions: new Set(),
    connectionId: null,
    userInfo: null
  });

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const reconnectCountRef = useRef(0);
  const pendingSubscriptions = useRef<Array<{ type: SubscriptionType; resource: string; filters?: any }>>([]);

  const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
    setState(prev => ({ ...prev, connectionStatus: status }));
    onConnectionStatusChange?.(status);
  }, [onConnectionStatusChange]);

  const sendMessage = useCallback((message: WebSocketMessage | object) => {
    if (state.socket?.readyState === WebSocket.OPEN) {
      let messageToSend: WebSocketMessage;
      
      if ('type' in message) {
        messageToSend = message as WebSocketMessage;
      } else {
        messageToSend = {
          type: 'custom',
          payload: message,
          message_id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        };
      }
      
      try {
        state.socket.send(JSON.stringify(messageToSend));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    }
    return false;
  }, [state.socket]);

  const authenticate = useCallback(async () => {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    updateConnectionStatus(ConnectionStatus.AUTHENTICATING);

    const token = TokenStorage.getToken();
    if (!token) {
      console.warn('No authentication token available for WebSocket');
      updateConnectionStatus(ConnectionStatus.ERROR);
      return false;
    }

    const authMessage: WebSocketMessage = {
      type: MessageType.AUTHENTICATE,
      payload: { token },
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    return sendMessage(authMessage);
  }, [state.socket, sendMessage, updateConnectionStatus]);

  const subscribe = useCallback((type: SubscriptionType, resource: string, filters: any = {}) => {
    if (!state.isAuthenticated) {
      // Store for later when authenticated
      pendingSubscriptions.current.push({ type, resource, filters });
      return false;
    }

    const subscribeMessage: WebSocketMessage = {
      type: MessageType.SUBSCRIBE,
      payload: { type, resource, filters },
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    if (sendMessage(subscribeMessage)) {
      const subscriptionKey = `${type}:${resource}`;
      setState(prev => ({
        ...prev,
        subscriptions: new Set([...prev.subscriptions, subscriptionKey])
      }));
      return true;
    }
    return false;
  }, [state.isAuthenticated, sendMessage]);

  const unsubscribe = useCallback((subscriptionId: string) => {
    if (!state.isAuthenticated) return false;

    const unsubscribeMessage: WebSocketMessage = {
      type: MessageType.UNSUBSCRIBE,
      payload: { subscription_id: subscriptionId },
      message_id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    if (sendMessage(unsubscribeMessage)) {
      setState(prev => ({
        ...prev,
        subscriptions: new Set([...prev.subscriptions].filter(s => s !== subscriptionId))
      }));
      return true;
    }
    return false;
  }, [state.isAuthenticated, sendMessage]);

  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      if (state.socket?.readyState === WebSocket.OPEN) {
        const pingMessage: WebSocketMessage = {
          type: MessageType.PING,
          payload: { timestamp: new Date().toISOString() },
          message_id: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        };
        sendMessage(pingMessage);
      }
    }, 30000); // Ping every 30 seconds
  }, [state.socket, sendMessage]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      setState(prev => ({ ...prev, lastMessage: message }));

      // Handle system messages
      switch (message.type) {
        case MessageType.CONNECTION_ACK:
          setState(prev => ({
            ...prev,
            connectionId: message.payload.connection_id,
            isConnected: true
          }));
          updateConnectionStatus(ConnectionStatus.CONNECTED);
          // Auto-authenticate if we have a token
          authenticate();
          break;

        case MessageType.AUTH_SUCCESS:
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            userInfo: {
              user_id: message.payload.user_id,
              role: message.payload.role,
              branch_id: message.payload.branch_id
            }
          }));
          updateConnectionStatus(ConnectionStatus.AUTHENTICATED);
          
          // Process pending subscriptions
          if (enableSubscriptions && pendingSubscriptions.current.length > 0) {
            pendingSubscriptions.current.forEach(({ type, resource, filters }) => {
              subscribe(type, resource, filters);
            });
            pendingSubscriptions.current = [];
          }
          
          // Start ping interval
          startPingInterval();
          break;

        case MessageType.AUTH_FAILED:
          setState(prev => ({ ...prev, isAuthenticated: false, userInfo: null }));
          updateConnectionStatus(ConnectionStatus.ERROR);
          console.error('WebSocket authentication failed:', message.payload);
          break;

        case MessageType.SUBSCRIPTION_SUCCESS:
          console.log('Subscription successful:', message.payload);
          break;

        case MessageType.SUBSCRIPTION_ERROR:
          console.error('Subscription error:', message.payload);
          break;

        case MessageType.PONG:
          // Handle pong response - connection is alive
          break;

        case MessageType.ERROR:
          console.error('WebSocket error message:', message.payload);
          updateConnectionStatus(ConnectionStatus.ERROR);
          break;
      }

      // Forward message to callback
      onMessage?.(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [onMessage, authenticate, subscribe, enableSubscriptions, updateConnectionStatus, startPingInterval]);

  const connect = useCallback(() => {
    try {
      updateConnectionStatus(ConnectionStatus.CONNECTING);
      
      const ws = new WebSocket(url);

      ws.onopen = (event) => {
        setState(prev => ({
          ...prev,
          socket: ws,
          readyState: WebSocket.OPEN,
          isConnected: true,
          reconnectCount: 0
        }));
        reconnectCountRef.current = 0;
        onOpen?.();
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        setState(prev => ({
          ...prev,
          socket: null,
          readyState: WebSocket.CLOSED,
          isConnected: false,
          isAuthenticated: false,
          connectionId: null,
          userInfo: null
        }));
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = undefined;
        }

        updateConnectionStatus(ConnectionStatus.DISCONNECTED);
        onClose?.(event);

        // Attempt to reconnect if conditions are met
        if (shouldReconnect(event) && reconnectCountRef.current < maxReconnectAttempts) {
          reconnectCountRef.current += 1;
          setState(prev => ({ ...prev, reconnectCount: reconnectCountRef.current }));
          
          updateConnectionStatus(ConnectionStatus.RECONNECTING);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval * Math.pow(1.5, reconnectCountRef.current - 1)); // Exponential backoff
        }
      };

      ws.onerror = (event) => {
        updateConnectionStatus(ConnectionStatus.ERROR);
        onError?.(event);
      };

      setState(prev => ({
        ...prev,
        socket: ws,
        readyState: ws.readyState
      }));

    } catch (error) {
      console.error('WebSocket connection error:', error);
      updateConnectionStatus(ConnectionStatus.ERROR);
    }
  }, [url, onOpen, handleMessage, onClose, onError, shouldReconnect, reconnectInterval, maxReconnectAttempts, updateConnectionStatus]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    }
    
    if (state.socket) {
      state.socket.close(1000, 'Manual disconnect');
    }

    setState(prev => ({
      ...prev,
      socket: null,
      readyState: WebSocket.CLOSED,
      connectionStatus: ConnectionStatus.DISCONNECTED,
      isConnected: false,
      isAuthenticated: false,
      connectionId: null,
      userInfo: null,
      subscriptions: new Set()
    }));
  }, [state.socket]);

  // Connect on mount if autoConnect is enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect]);

  // Handle visibility change to reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          !state.isConnected && 
          autoConnect &&
          reconnectCountRef.current < maxReconnectAttempts) {
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isConnected, connect, maxReconnectAttempts, autoConnect]);

  // Memoize subscriptions array to prevent unnecessary re-renders
  const memoizedSubscriptions = useMemo(() => Array.from(state.subscriptions), [state.subscriptions]);

  return {
    // Connection state
    socket: state.socket,
    lastMessage: state.lastMessage,
    readyState: state.readyState,
    connectionStatus: state.connectionStatus,
    isConnected: state.isConnected,
    isAuthenticated: state.isAuthenticated,
    reconnectCount: state.reconnectCount,
    connectionId: state.connectionId,
    userInfo: state.userInfo,
    
    // Subscription management
    subscriptions: memoizedSubscriptions,
    subscribe,
    unsubscribe,
    
    // Connection management
    sendMessage,
    connect,
    disconnect,
    authenticate,
    
    // Aliases for backward compatibility
    reconnect: connect
  };
};