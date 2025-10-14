import { useEffect, useCallback } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Unified hook for real-time data updates across all pages
 *
 * This hook:
 * - Subscribes to WebSocket updates for specified collections
 * - Automatically invalidates React Query cache when data changes
 * - Handles all message types (insert, update, delete, batch)
 * - Provides custom callbacks for additional handling
 *
 * @example
 * ```tsx
 * // Basic usage - auto-refresh students data
 * useLiveData(['students']);
 *
 * // Multiple collections
 * useLiveData(['students', 'classes', 'attendance']);
 *
 * // With custom callback
 * useLiveData(['payments'], {
 *   onUpdate: (collection, payload) => {
 *     console.log(`${collection} updated:`, payload);
 *   }
 * });
 *
 * // With filters
 * useLiveData(['students'], {
 *   filters: { class_id: selectedClass, branch_id: selectedBranch }
 * });
 * ```
 */

interface UseLiveDataOptions {
  /**
   * Whether to enable live updates (default: true)
   */
  enabled?: boolean;

  /**
   * Filters to apply to subscriptions
   */
  filters?: Record<string, any>;

  /**
   * Custom callback when data is updated
   */
  onUpdate?: (collection: string, payload: any) => void;

  /**
   * Custom callback when data is inserted
   */
  onInsert?: (collection: string, payload: any) => void;

  /**
   * Custom callback when data is deleted
   */
  onDelete?: (collection: string, payload: any) => void;

  /**
   * Additional query keys to invalidate beyond the collection name
   * Useful for related data that should be refreshed
   */
  additionalQueryKeys?: string[];
}

export function useLiveData(
  collections: string[],
  options: UseLiveDataOptions = {}
) {
  const {
    enabled = true,
    filters = {},
    onUpdate,
    onInsert,
    onDelete,
    additionalQueryKeys = []
  } = options;

  const { isConnected, subscribe, unsubscribe, addEventListener } = useWebSocket();
  const queryClient = useQueryClient();

  // Handle data updates from WebSocket
  const handleDataChange = useCallback((collection: string, payload: any, action: 'update' | 'insert' | 'delete') => {
    console.log(`[useLiveData] ${action} for ${collection}:`, payload);

    // Invalidate React Query cache for this collection
    queryClient.invalidateQueries({ queryKey: [collection] });

    // Invalidate additional related queries
    additionalQueryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });

    // Call custom callbacks
    switch (action) {
      case 'update':
        onUpdate?.(collection, payload);
        break;
      case 'insert':
        onInsert?.(collection, payload);
        break;
      case 'delete':
        onDelete?.(collection, payload);
        break;
    }
  }, [queryClient, onUpdate, onInsert, onDelete, additionalQueryKeys]);

  useEffect(() => {
    if (!enabled || !isConnected || collections.length === 0) {
      return;
    }

    const subscriptionIds: string[] = [];
    const cleanupFunctions: (() => void)[] = [];

    // Subscribe to each collection
    collections.forEach(collection => {
      console.log(`[useLiveData] Subscribing to ${collection}`, filters);

      // Subscribe to collection updates
      const subId = subscribe(collection, 'collection', filters);
      subscriptionIds.push(subId);

      // Listen for different types of data changes
      const unsubUpdate = addEventListener(`data_update:${collection}`, (payload) => {
        handleDataChange(collection, payload, 'update');
      });

      const unsubInsert = addEventListener(`data_insert:${collection}`, (payload) => {
        handleDataChange(collection, payload, 'insert');
      });

      const unsubDelete = addEventListener(`data_delete:${collection}`, (payload) => {
        handleDataChange(collection, payload, 'delete');
      });

      cleanupFunctions.push(unsubUpdate, unsubInsert, unsubDelete);
    });

    // Cleanup on unmount or when dependencies change
    return () => {
      console.log('[useLiveData] Cleaning up subscriptions');
      subscriptionIds.forEach(id => unsubscribe(id));
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [enabled, isConnected, collections, filters, subscribe, unsubscribe, addEventListener, handleDataChange]);

  return {
    isConnected,
    enabled: enabled && isConnected
  };
}

/**
 * Specialized hook for single collection with simpler API
 *
 * @example
 * ```tsx
 * useLiveCollection('students', {
 *   filters: { class_id: selectedClass }
 * });
 * ```
 */
export function useLiveCollection(
  collection: string,
  options: UseLiveDataOptions = {}
) {
  return useLiveData([collection], options);
}

/**
 * Hook for pages that need multiple related collections
 *
 * @example
 * ```tsx
 * // In AttendancePage
 * useLiveDataForPage('attendance', {
 *   relatedCollections: ['students', 'classes'],
 *   filters: { branch_id: selectedBranch }
 * });
 * ```
 */
export function useLiveDataForPage(
  mainCollection: string,
  options: UseLiveDataOptions & { relatedCollections?: string[] } = {}
) {
  const { relatedCollections = [], ...restOptions } = options;
  const collections = [mainCollection, ...relatedCollections];

  return useLiveData(collections, {
    ...restOptions,
    additionalQueryKeys: [
      ...(restOptions.additionalQueryKeys || []),
      `${mainCollection}-analytics`,
      `${mainCollection}-summary`,
      `${mainCollection}-report`
    ]
  });
}
