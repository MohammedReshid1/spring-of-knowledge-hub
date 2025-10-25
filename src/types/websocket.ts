/**
 * Shared WebSocket types and enums for use across the application
 */

export interface WebSocketMessage {
  type: string;
  payload: any;
  message_id?: string;
  timestamp?: string;
  correlation_id?: string;
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

export interface UserInfo {
  user_id?: string;
  role?: string;
  branch_id?: string;
}
