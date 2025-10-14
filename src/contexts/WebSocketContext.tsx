import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

// Global WebSocket instance to prevent multiple connections
let globalWebSocketInstance: WebSocket | null = null;
let globalConnectionCount = 0;

interface WebSocketMessage {
  type: string;
  payload: any;
  message_id?: string;
  timestamp?: string;
  correlation_id?: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'authenticated';
  subscribe: (resource: string, type: string, filters?: any) => string;
  unsubscribe: (subscriptionId: string) => void;
  sendMessage: (message: WebSocketMessage) => void;
  addEventListener: (type: string, handler: (payload: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'authenticated'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const eventHandlers = useRef<Map<string, Set<(payload: any) => void>>>(new Map());
  const subscriptionsRef = useRef<Map<string, any>>(new Map());
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    // Get current auth state to avoid stale closures
    const currentAuth = localStorage.getItem('auth_token');
    if (!currentAuth) {
      console.log('WebSocket: No auth token available');
      setConnectionStatus('disconnected');
      return;
    }

    // Use global WebSocket instance to prevent multiple connections
    if (globalWebSocketInstance && globalWebSocketInstance.readyState === WebSocket.OPEN) {
      console.log('WebSocket: Global instance already connected, reusing');
      wsRef.current = globalWebSocketInstance;
      setIsConnected(true);
      setConnectionStatus('authenticated');
      return;
    }

    // Prevent multiple connection attempts
    if (isConnectingRef.current) {
      console.log('WebSocket: Connection already in progress, skipping');
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
    console.log('WebSocket: Creating new global connection to', wsUrl);

    // Set connecting flag
    isConnectingRef.current = true;
    globalConnectionCount++;
    setConnectionStatus('connecting');

    const ws = new WebSocket(wsUrl);
    globalWebSocketInstance = ws;
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket: Connection opened');
      // Reset connecting flag
      isConnectingRef.current = false;
      reconnectAttempts.current = 0;
      setConnectionStatus('connected');

      // Authenticate
      const token = localStorage.getItem('auth_token');
      if (token) {
        console.log('WebSocket: Sending authentication');
        ws.send(JSON.stringify({
          type: 'authenticate',
          payload: { token }
        }));
      } else {
        console.warn('WebSocket: No auth token found');
        setConnectionStatus('connected'); // Not authenticated but connected
      }

      // Start ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'ping',
            payload: {}
          }));
        }
      }, 30000); // Ping every 30 seconds
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        // Handle authentication success
        if (message.type === 'auth_success') {
          console.log('WebSocket: Authentication successful');
          // Only set connected to true after successful authentication
          setIsConnected(true);
          setConnectionStatus('authenticated');
          // Resubscribe to all active subscriptions
          subscriptionsRef.current.forEach((sub) => {
            ws.send(JSON.stringify({
              type: 'subscribe',
              payload: sub
            }));
          });
        }

        // Trigger event handlers
        const handlers = eventHandlers.current.get(message.type);
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(message.payload);
            } catch (error) {
              console.error('Error in event handler:', error);
            }
          });
        }

        // Handle batch messages
        if (message.type === 'data_batch') {
          const collections = message.payload.collections || {};
          Object.entries(collections).forEach(([collection, updates]: [string, any]) => {
            const handlers = eventHandlers.current.get(`data_update:${collection}`);
            if (handlers) {
              handlers.forEach(handler => {
                try {
                  handler(updates);
                } catch (error) {
                  console.error('Error in batch event handler:', error);
                }
              });
            }
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Reset connecting flag on error
      isConnectingRef.current = false;
    };

    ws.onclose = (event) => {
      console.log('WebSocket: Connection closed', { code: event.code, reason: event.reason });
      setIsConnected(false);
      setConnectionStatus('disconnected');
      // Reset connecting flag on close
      isConnectingRef.current = false;

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Don't reconnect if connection was replaced (code 1000 with "New connection established" reason)
      // or if it was a clean closure (code 1000)
      const wasReplacedByNewConnection = event.code === 1000 && event.reason === "New connection established";

      if (wasReplacedByNewConnection) {
        return;
      }

      // Attempt reconnection for other close events
      if (isAuthenticated && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    // Only close global WebSocket if this is the last component trying to disconnect
    if (globalWebSocketInstance && globalConnectionCount <= 1) {
      console.log('WebSocket: Closing global connection (last component)');
      globalWebSocketInstance.close();
      globalWebSocketInstance = null;
    }

    if (globalConnectionCount > 0) {
      globalConnectionCount--;
    }

    wsRef.current = null;
    // Reset connecting flag
    isConnectingRef.current = false;
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  const subscribe = useCallback((resource: string, type: string, filters: any = {}): string => {
    const subscription = {
      type,
      resource,
      filters
    };

    const subscriptionId = `${type}:${resource}`;
    subscriptionsRef.current.set(subscriptionId, subscription);

    sendMessage({
      type: 'subscribe',
      payload: subscription
    });

    return subscriptionId;
  }, [sendMessage]);

  const unsubscribe = useCallback((subscriptionId: string) => {
    if (subscriptionsRef.current.has(subscriptionId)) {
      sendMessage({
        type: 'unsubscribe',
        payload: { subscription_id: subscriptionId }
      });
      subscriptionsRef.current.delete(subscriptionId);
    }
  }, [sendMessage]);

  const addEventListener = useCallback((type: string, handler: (payload: any) => void) => {
    if (!eventHandlers.current.has(type)) {
      eventHandlers.current.set(type, new Set());
    }
    eventHandlers.current.get(type)!.add(handler);

    // Return cleanup function
    return () => {
      const handlers = eventHandlers.current.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          eventHandlers.current.delete(type);
        }
      }
    };
  }, []);

  useEffect(() => {
    // Only connect/disconnect when authentication state changes
    if (isAuthenticated) {
      console.log('WebSocket: User authenticated, connecting...');
      connect();
    } else {
      console.log('WebSocket: User not authenticated, disconnecting...');
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  const value = {
    isConnected,
    connectionStatus,
    subscribe,
    unsubscribe,
    sendMessage,
    addEventListener
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};
