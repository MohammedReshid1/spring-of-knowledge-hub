import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

// Global WebSocket instance to prevent multiple connections
let globalWebSocketInstance: WebSocket | null = null;
let globalConnectionCount = 0;
// Global subscription reference counting
let globalSubscriptionCounts: Map<string, number> = new Map();
// Global connection state to survive React Strict Mode remounts
let globalIsConnecting = false;
let globalIsConnected = false;
// Connection attempt counter for debugging
let connectionAttemptId = 0;
// Global connection cooldown to prevent rapid reconnections
let lastConnectionAttempt = 0;
const CONNECTION_COOLDOWN = 2000; // 2 second cooldown for React Strict Mode
// Global provider instance tracking to prevent multiple providers from creating connections
let activeProviderCount = 0;
let providerInstanceId = 0;
// **CRITICAL: Promise-based atomic lock to prevent simultaneous WebSocket creation**
let connectionPromise: Promise<WebSocket> | null = null;
// **CRITICAL: Global flag to track if connection has been initiated for current auth session**
let globalHasInitiatedConnection = false;

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
  // Track provider instance to prevent React Strict Mode issues
  const currentProviderId = useRef(++providerInstanceId);
  const isPrimaryProvider = useRef(activeProviderCount === 0);

  // Mount/unmount tracking
  useEffect(() => {
    activeProviderCount++;
    isPrimaryProvider.current = activeProviderCount === 1;
    console.log(`WebSocket Provider [${currentProviderId.current}] mounted. Active providers: ${activeProviderCount}. Primary: ${isPrimaryProvider.current}`);

    return () => {
      activeProviderCount--;
      console.log(`WebSocket Provider [${currentProviderId.current}] unmounted. Active providers: ${activeProviderCount}`);

      // Only disconnect if this was the last provider
      if (activeProviderCount === 0) {
        console.log('WebSocket: Last provider unmounted, cleaning up connection');
        disconnect();
      }
    };
  }, []);

  const { user, isAuthenticated, isStudentAuthenticated, student, loading } = useAuth();
  const [isConnected, setIsConnected] = useState(globalIsConnected);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'authenticated'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const eventHandlers = useRef<Map<string, Set<(payload: any) => void>>>(new Map());
  const subscriptionsRef = useRef<Map<string, any>>(new Map());
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    console.log(`🔍 [CONNECT] Called - globalHasInitiatedConnection=${globalHasInitiatedConnection}, globalIsConnecting=${globalIsConnecting}, globalIsConnected=${globalIsConnected}`);

    // **ATOMIC LOCK: If a connection is already being created, wait for it instead of creating another**
    if (connectionPromise) {
      console.log('WebSocket: Connection already in progress, waiting for it to complete...');
      try {
        const existingWs = await connectionPromise;
        wsRef.current = existingWs;
        if (existingWs.readyState === WebSocket.OPEN) {
          setIsConnected(true);
          setConnectionStatus('authenticated');
        }
        return;
      } catch (error) {
        console.log('WebSocket: Existing connection attempt failed, will retry');
        // Continue to create a new connection below
      }
    }

    // Only primary provider can initiate connections
    if (!isPrimaryProvider.current) {
      console.log(`WebSocket Provider [${currentProviderId.current}]: Not primary, skipping connection`);
      return;
    }

    // Check if we already have a working global instance
    if (globalWebSocketInstance) {
      const state = globalWebSocketInstance.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        console.log('WebSocket: Reusing existing global connection');
        wsRef.current = globalWebSocketInstance;
        if (state === WebSocket.OPEN) {
          setIsConnected(true);
          setConnectionStatus('authenticated');
          globalIsConnected = true;
        } else {
          setConnectionStatus('connecting');
          globalIsConnecting = true;
        }
        return;
      }
    }

    // SECURITY: Check if user is authenticated (cookies used, not localStorage)
    // Authentication will be done via httpOnly cookies automatically
    if (!isAuthenticated && !isStudentAuthenticated) {
      console.log('WebSocket: User not authenticated');
      setConnectionStatus('disconnected');
      return;
    }

    // **CREATE THE ATOMIC LOCK PROMISE**
    connectionPromise = new Promise<WebSocket>((resolve, reject) => {
      // Set connecting flag
      globalIsConnecting = true;
      connectionAttemptId++;
      const thisConnectionId = connectionAttemptId;

      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
      console.log(`WebSocket [${thisConnectionId}]: Creating new connection to ${wsUrl}`);

      globalConnectionCount++;
      setConnectionStatus('connecting');

      const ws = new WebSocket(wsUrl);
      globalWebSocketInstance = ws;
      wsRef.current = ws;

      // Timeout to reject if connection takes too long
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('WebSocket: Connection timeout');
          reject(new Error('Connection timeout'));
          ws.close();
        }
      }, 10000); // 10 second timeout

    ws.onopen = () => {
      console.log(`WebSocket [${thisConnectionId}]: Connection opened`);
      // Don't reset connecting flag yet - wait for authentication
      reconnectAttempts.current = 0;
      setConnectionStatus('connected');

      // SECURITY: Authenticate immediately using httpOnly cookies
      // Backend requires authentication within 10 seconds
      console.log(`WebSocket [${thisConnectionId}]: Sending AUTHENTICATE message`);
      ws.send(JSON.stringify({
        type: 'AUTHENTICATE',  // Use uppercase to match backend MessageType
        payload: {}  // Token sent automatically via httpOnly cookie
      }));

      // Set authentication timeout (backend gives us 10 seconds)
      const authTimeout = setTimeout(() => {
        if (connectionStatus !== 'authenticated') {
          console.error('WebSocket: Authentication timeout - closing connection');
          ws.close(4001, 'Authentication timeout');
        }
      }, 10000); // 10 second timeout to match backend

      // Store timeout so we can clear it on auth success
      (ws as any).authTimeout = authTimeout;

      // Start ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'PING',  // Use uppercase
            payload: {}
          }));
        }
      }, 30000); // Ping every 30 seconds
    };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // SECURITY: Handle authentication responses
          if (message.type === 'AUTH_SUCCESS' || message.type === 'auth_success') {
            console.log(`WebSocket [${thisConnectionId}]: Authentication successful`);

            // Clear authentication timeout
            if ((ws as any).authTimeout) {
              clearTimeout((ws as any).authTimeout);
            }
            clearTimeout(connectionTimeout);

            // Reset connecting flag now that we're fully connected and authenticated
            globalIsConnecting = false;
            globalIsConnected = true;

            // Only set connected to true after successful authentication
            setIsConnected(true);
            setConnectionStatus('authenticated');

            // **RESOLVE THE PROMISE - Connection successful!**
            resolve(ws);
            connectionPromise = null; // Clear the lock

            // Resubscribe to all active subscriptions
            subscriptionsRef.current.forEach((sub) => {
              ws.send(JSON.stringify({
                type: 'SUBSCRIBE',  // Use uppercase
                payload: sub
              }));
            });
          }

          // SECURITY: Handle authentication failure
          if (message.type === 'AUTH_FAILED' || message.type === 'auth_failed') {
            console.error(`WebSocket [${thisConnectionId}]: Authentication failed`, message.payload);

            // Clear authentication timeout
            if ((ws as any).authTimeout) {
              clearTimeout((ws as any).authTimeout);
            }
            clearTimeout(connectionTimeout);

            // Close connection on auth failure
            ws.close(4003, 'Authentication failed');

            // **REJECT THE PROMISE - Authentication failed!**
            reject(new Error('Authentication failed: ' + (message.payload?.error || 'Unknown error')));
            connectionPromise = null;
            return;
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
        clearTimeout(connectionTimeout);
        // Reset connecting flag on error
        globalIsConnecting = false;
        // **REJECT THE PROMISE - Connection failed!**
        reject(error);
        connectionPromise = null; // Clear the lock
      };

      ws.onclose = (event) => {
        console.log(`WebSocket [${thisConnectionId}]: Connection closed`, { code: event.code, reason: event.reason });
        clearTimeout(connectionTimeout);

        // Don't process if this isn't the active connection
        if (globalWebSocketInstance !== ws) {
          console.log(`WebSocket [${thisConnectionId}]: Ignoring close - not the active connection`);
          return;
        }

        // Clear global state only for the active connection
        globalIsConnected = false;
        globalIsConnecting = false;
        globalWebSocketInstance = null;
        setIsConnected(false);
        setConnectionStatus('disconnected');

        // **REJECT THE PROMISE if not already resolved - Connection closed before auth!**
        if (connectionPromise) {
          reject(new Error('Connection closed before authentication'));
          connectionPromise = null; // Clear the lock
        }

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Don't reconnect if connection was replaced (clean closure)
        // This includes "Newer connection established" closures from backend
        if (event.code === 1000 && event.reason && event.reason.toLowerCase().includes("connection")) {
          console.log('WebSocket: Connection replaced by backend or newer instance - no reconnection needed');
          console.log(`  Reason: "${event.reason}"`);
          return;
        }

        // Attempt reconnection for unexpected closures ONLY
        if (isAuthenticated && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (!globalIsConnected && !globalIsConnecting) {
              connect();
            }
          }, delay);
        }
      };
    }); // End of Promise

    // Wait for the connection to complete
    try {
      await connectionPromise;
      console.log('WebSocket: Connection established successfully');
    } catch (error) {
      console.error('WebSocket: Connection failed:', error);
      throw error;
    }
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
      // Clear global subscription counts on disconnect
      globalSubscriptionCounts.clear();
    }

    if (globalConnectionCount > 0) {
      globalConnectionCount--;
    }

    wsRef.current = null;
    // Reset connecting flag and connected state
    globalIsConnecting = false;
    globalIsConnected = false;
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    // Try global instance first for better reliability
    const ws = globalWebSocketInstance || wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message.type);
    }
  }, []);

  const subscribe = useCallback((resource: string, type: string, filters: any = {}): string => {
    const subscription = {
      type,
      resource,
      filters
    };

    const subscriptionId = `${type}:${resource}`;

    // Use reference counting to handle multiple components subscribing to same resource
    const currentCount = globalSubscriptionCounts.get(subscriptionId) || 0;
    globalSubscriptionCounts.set(subscriptionId, currentCount + 1);

    // Only send subscribe message for the first subscriber
    if (currentCount === 0) {
      console.log(`[WebSocket] Subscribing to ${subscriptionId} (first subscriber)`);
      subscriptionsRef.current.set(subscriptionId, subscription);

      sendMessage({
        type: 'SUBSCRIBE',  // Use uppercase to match backend MessageType
        payload: subscription
      });
    } else {
      console.log(`[WebSocket] Additional subscriber to ${subscriptionId} (count: ${currentCount + 1})`);
    }

    return subscriptionId;
  }, [sendMessage]);

  const unsubscribe = useCallback((subscriptionId: string) => {
    // Use reference counting to handle multiple components subscribing to same resource
    const currentCount = globalSubscriptionCounts.get(subscriptionId) || 0;

    if (currentCount <= 0) {
      console.warn(`[WebSocket] Attempted to unsubscribe from ${subscriptionId} with no subscribers`);
      return;
    }

    const newCount = currentCount - 1;
    globalSubscriptionCounts.set(subscriptionId, newCount);

    // Only send unsubscribe message when the last subscriber unsubscribes
    if (newCount === 0) {
      console.log(`[WebSocket] Unsubscribing from ${subscriptionId} (last subscriber)`);
      globalSubscriptionCounts.delete(subscriptionId);

      if (subscriptionsRef.current.has(subscriptionId)) {
        // Check if WebSocket is connected before sending unsubscribe message
        const ws = globalWebSocketInstance || wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          sendMessage({
            type: 'UNSUBSCRIBE',  // Use uppercase to match backend MessageType
            payload: { subscription_id: subscriptionId }
          });
        } else {
          console.log(`[WebSocket] Skipping unsubscribe for ${subscriptionId} - WebSocket not connected`);
        }
        subscriptionsRef.current.delete(subscriptionId);
      }
    } else {
      console.log(`[WebSocket] Removed subscriber from ${subscriptionId} (remaining: ${newCount})`);
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
    // Check if user is authenticated (either regular user or student)
    const isUserAuthenticated = isAuthenticated || isStudentAuthenticated;
    console.log(`🔄 [USEEFFECT] Running - loading=${loading}, isAuthenticated=${isAuthenticated}, isStudentAuthenticated=${isStudentAuthenticated}, combined=${isUserAuthenticated}, hasInitiated=${globalHasInitiatedConnection}`);

    // Don't do anything while auth is still loading
    if (loading) {
      console.log('[USEEFFECT] Auth still loading, skipping...');
      return;
    }

    // Only primary provider manages connections
    if (!isPrimaryProvider.current) {
      console.log(`[USEEFFECT] Not primary provider, skipping...`);
      // Non-primary providers just sync with existing connection
      if (globalWebSocketInstance && globalWebSocketInstance.readyState === WebSocket.OPEN) {
        wsRef.current = globalWebSocketInstance;
        setIsConnected(true);
        setConnectionStatus('authenticated');
      }
      return;
    }

    // If authenticated (either user or student) and we haven't initiated a connection yet for this session
    if (isUserAuthenticated) {
      // Check if we need to connect - use connectionPromise as the authoritative lock
      if (!connectionPromise && !globalIsConnecting && !globalIsConnected && !globalWebSocketInstance && !globalHasInitiatedConnection) {
        globalHasInitiatedConnection = true;  // Mark that we've initiated
        console.log(`WebSocket Provider [${currentProviderId.current}]: User authenticated (student=${isStudentAuthenticated}), establishing connection...`);
        connect();
      } else if (connectionPromise || globalIsConnecting) {
        console.log(`WebSocket Provider [${currentProviderId.current}]: Connection already in progress, skipping...`);
      } else if (globalWebSocketInstance && globalWebSocketInstance.readyState === WebSocket.OPEN && !globalIsConnected) {
        // Sync with existing connection
        console.log(`WebSocket Provider [${currentProviderId.current}]: Syncing with existing open connection`);
        wsRef.current = globalWebSocketInstance;
        setIsConnected(true);
        setConnectionStatus('authenticated');
        globalIsConnected = true;
      }
    } else {
      // Reset the connection flag when user logs out
      globalHasInitiatedConnection = false;
      // Only disconnect if explicitly not authenticated
      if (globalIsConnected || globalIsConnecting) {
        console.log(`WebSocket Provider [${currentProviderId.current}]: User not authenticated, disconnecting...`);
        disconnect();
      }
    }

    // No cleanup needed - connection persists across effect re-runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isStudentAuthenticated, loading]); // Intentionally exclude connect/disconnect to prevent re-runs on component remount

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
