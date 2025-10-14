/**
 * @deprecated Use useLiveData or useLiveCollection from '@/hooks/useLiveData' instead
 *
 * This hook is kept for backward compatibility but uses the new useLiveData implementation.
 * The old polling-based approach has been replaced with real WebSocket event handling.
 *
 * Migration guide:
 * ```tsx
 * // Old way:
 * useWebSocketQuerySync(['students', 'classes', 'attendance']);
 *
 * // New way (recommended):
 * useLiveData(['students', 'classes', 'attendance']);
 * ```
 */

import { useLiveData, useLiveCollection } from './useLiveData';

/**
 * @deprecated Use useLiveData instead
 */
export const useWebSocketQuerySync = (
  collections: string[],
  options?: {
    enabled?: boolean;
    refetchInterval?: number; // Ignored in new implementation
  }
) => {
  return useLiveData(collections, {
    enabled: options?.enabled
  });
};

/**
 * @deprecated Use useLiveCollection instead
 */
export const useCollectionUpdates = (
  collection: string,
  enabled = true
) => {
  return useLiveCollection(collection, { enabled });
};
