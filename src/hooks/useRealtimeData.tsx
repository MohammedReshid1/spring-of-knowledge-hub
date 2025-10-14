import { useEffect, useCallback } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useQueryClient } from '@tanstack/react-query';

interface UseRealtimeDataOptions {
  /**
   * Resource type to subscribe to (e.g., 'students', 'teachers', 'payments')
   */
  resource: string;

  /**
   * Query keys to invalidate on updates
   */
  queryKeys: string[];

  /**
   * Additional filters for the subscription
   */
  filters?: Record<string, any>;

  /**
   * Whether to enable real-time updates (default: true)
   */
  enabled?: boolean;

  /**
   * Custom callback when data is updated
   */
  onUpdate?: (data: any) => void;
}

/**
 * Hook for automatic real-time data synchronization via WebSocket
 * Automatically invalidates React Query cache when data changes
 *
 * @example
 * ```tsx
 * // In a component
 * useRealtimeData({
 *   resource: 'students',
 *   queryKeys: ['students', 'student-stats'],
 *   filters: { branch_id: '123' }
 * });
 * ```
 */
export function useRealtimeData({
  resource,
  queryKeys,
  filters = {},
  enabled = true,
  onUpdate
}: UseRealtimeDataOptions) {
  const { isConnected, subscribe, addEventListener } = useWebSocket();
  const queryClient = useQueryClient();

  // Handle data updates
  const handleDataUpdate = useCallback((payload: any) => {

    // Invalidate all related query keys
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });

    // Call custom callback if provided
    if (onUpdate) {
      onUpdate(payload);
    }
  }, [resource, queryKeys, queryClient, onUpdate]);

  useEffect(() => {
    if (!enabled || !isConnected) {
      return;
    }

    // Subscribe to collection updates
    subscribe(resource, 'collection', filters);

    // Listen for data updates
    const unsubscribeUpdate = addEventListener(`data_update:${resource}`, handleDataUpdate);
    const unsubscribeInsert = addEventListener(`data_insert:${resource}`, handleDataUpdate);
    const unsubscribeDelete = addEventListener(`data_delete:${resource}`, handleDataUpdate);

    // Cleanup
    return () => {
      unsubscribeUpdate();
      unsubscribeInsert();
      unsubscribeDelete();
    };
  }, [enabled, isConnected, resource, filters, subscribe, addEventListener, handleDataUpdate]);
}

/**
 * Hook for subscribing to multiple resources at once
 */
export function useRealtimeDataMultiple(configs: UseRealtimeDataOptions[]) {
  configs.forEach(config => {
    useRealtimeData(config);
  });
}
