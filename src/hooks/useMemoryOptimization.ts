import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Custom hook for memory optimization in React components
 * Prevents memory leaks and optimizes component performance
 */

interface MemoryOptimizationOptions {
  cleanupInterval?: number;
  maxCacheSize?: number;
  enableDebugMode?: boolean;
}

export const useMemoryOptimization = (options: MemoryOptimizationOptions = {}) => {
  const {
    cleanupInterval = 60000, // 1 minute
    maxCacheSize = 50,
    enableDebugMode = false,
  } = options;

  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutIdsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervalIdsRef = useRef<Set<NodeJS.Timer>>(new Set());
  const observersRef = useRef<Set<MutationObserver | IntersectionObserver>>(new Set());

  // Debug logging
  const debug = useCallback((message: string, data?: any) => {
    if (enableDebugMode) {
    }
  }, [enableDebugMode]);

  // Create abort controller for fetch requests
  const getAbortSignal = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  // Safe setTimeout wrapper that auto-cleans
  const setSafeTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      callback();
      timeoutIdsRef.current.delete(timeoutId);
    }, delay);
    timeoutIdsRef.current.add(timeoutId);
    return timeoutId;
  }, []);

  // Safe setInterval wrapper that auto-cleans
  const setSafeInterval = useCallback((callback: () => void, delay: number) => {
    const intervalId = setInterval(callback, delay);
    intervalIdsRef.current.add(intervalId);
    return intervalId;
  }, []);

  // Clear specific timeout
  const clearSafeTimeout = useCallback((timeoutId: NodeJS.Timeout) => {
    clearTimeout(timeoutId);
    timeoutIdsRef.current.delete(timeoutId);
  }, []);

  // Clear specific interval
  const clearSafeInterval = useCallback((intervalId: NodeJS.Timer) => {
    clearInterval(intervalId);
    intervalIdsRef.current.delete(intervalId);
  }, []);

  // Register observer for cleanup
  const registerObserver = useCallback((observer: MutationObserver | IntersectionObserver) => {
    observersRef.current.add(observer);
    return observer;
  }, []);

  // Cleanup React Query cache
  const cleanupQueryCache = useCallback(() => {
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    // Remove stale queries
    const staleQueries = queries.filter(query => {
      const state = query.state;
      return (
        state.dataUpdatedAt < Date.now() - 600000 && // Older than 10 minutes
        state.fetchStatus === 'idle' &&
        !query.observers.length // No active observers
      );
    });

    staleQueries.forEach(query => {
      queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
    });

    if (staleQueries.length > 0) {
      debug(`Cleaned ${staleQueries.length} stale queries from cache`);
    }

    // Limit cache size
    if (queries.length > maxCacheSize) {
      const sortedQueries = queries
        .filter(q => !q.observers.length)
        .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);

      const toRemove = sortedQueries.slice(0, queries.length - maxCacheSize);
      toRemove.forEach(query => {
        queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
      });

      debug(`Removed ${toRemove.length} queries to maintain cache size limit`);
    }
  }, [queryClient, maxCacheSize, debug]);

  // Cleanup event listeners
  const cleanupEventListeners = useCallback(() => {
    const allElements = document.querySelectorAll('*');
    let removedCount = 0;

    allElements.forEach((element) => {
      // Check for potential memory leaks from event listeners
      const listeners = (element as any)._listeners;
      if (listeners && Object.keys(listeners).length > 10) {
        debug(`Warning: Element has ${Object.keys(listeners).length} listeners`, element);
        removedCount++;
      }
    });

    if (removedCount > 0) {
      debug(`Found ${removedCount} elements with excessive listeners`);
    }
  }, [debug]);

  // Memory usage monitoring
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedJSHeapSize = memory.usedJSHeapSize / 1048576;
      const totalJSHeapSize = memory.totalJSHeapSize / 1048576;
      const limit = memory.jsHeapSizeLimit / 1048576;

      const usage = (usedJSHeapSize / limit) * 100;

      if (usage > 80) {
        console.warn(`High memory usage detected: ${usage.toFixed(2)}%`);
        console.warn(`Used: ${usedJSHeapSize.toFixed(2)}MB / Limit: ${limit.toFixed(2)}MB`);

        // Trigger aggressive cleanup
        cleanupQueryCache();
        if (global.gc) {
          global.gc();
          debug('Manual garbage collection triggered');
        }
      }

      debug(`Memory usage: ${usedJSHeapSize.toFixed(2)}MB / ${limit.toFixed(2)}MB (${usage.toFixed(2)}%)`);
    }
  }, [cleanupQueryCache, debug]);

  // Setup periodic cleanup
  useEffect(() => {
    const cleanupIntervalId = setSafeInterval(() => {
      cleanupQueryCache();
      cleanupEventListeners();
      checkMemoryUsage();
    }, cleanupInterval);

    debug('Memory optimization initialized');

    return () => {
      clearSafeInterval(cleanupIntervalId);
    };
  }, [cleanupQueryCache, cleanupEventListeners, checkMemoryUsage, cleanupInterval, setSafeInterval, clearSafeInterval, debug]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort all pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear all timeouts
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current.clear();

      // Clear all intervals
      intervalIdsRef.current.forEach(clearInterval);
      intervalIdsRef.current.clear();

      // Disconnect all observers
      observersRef.current.forEach(observer => observer.disconnect());
      observersRef.current.clear();

      debug('Component cleanup completed');
    };
  }, [debug]);

  return {
    getAbortSignal,
    setSafeTimeout,
    setSafeInterval,
    clearSafeTimeout,
    clearSafeInterval,
    registerObserver,
    cleanupQueryCache,
    checkMemoryUsage,
  };
};

/**
 * Hook for optimizing large lists with virtualization
 */
export const useVirtualizedList = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
) => {
  const scrollTopRef = useRef(0);

  const visibleRange = useCallback(() => {
    const scrollTop = scrollTopRef.current;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return {
      startIndex,
      endIndex,
      visibleItems: items.slice(startIndex, endIndex + 1),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight,
    };
  }, [items, itemHeight, containerHeight, overscan]);

  const handleScroll = useCallback((scrollTop: number) => {
    scrollTopRef.current = scrollTop;
  }, []);

  return {
    visibleRange,
    handleScroll,
  };
};

/**
 * Hook for debouncing expensive operations
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const { setSafeTimeout, clearSafeTimeout } = useMemoryOptimization();

  useEffect(() => {
    const timeoutId = setSafeTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearSafeTimeout(timeoutId);
    };
  }, [value, delay, setSafeTimeout, clearSafeTimeout]);

  return debouncedValue;
};

/**
 * Hook for throttling function calls
 */
export const useThrottle = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T => {
  const lastRun = useRef(Date.now());

  return useCallback(
    (...args: Parameters<T>) => {
      if (Date.now() - lastRun.current >= delay) {
        fn(...args);
        lastRun.current = Date.now();
      }
    },
    [fn, delay]
  ) as T;
};

// Add missing import
import { useState } from 'react';