/**
 * API Optimization Utilities
 * Implements request batching, caching, and network optimization
 */

import { QueryClient } from '@tanstack/react-query';

interface BatchRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
  resolver: (data: any) => void;
  rejecter: (error: any) => void;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  etag?: string;
}

/**
 * API Request Batcher
 * Batches multiple API requests into a single network call
 */
class APIBatcher {
  private queue: BatchRequest[] = [];
  private timeout: NodeJS.Timeout | null = null;
  private batchDelay: number;
  private maxBatchSize: number;

  constructor(batchDelay = 50, maxBatchSize = 10) {
    this.batchDelay = batchDelay;
    this.maxBatchSize = maxBatchSize;
  }

  add(request: Omit<BatchRequest, 'resolver' | 'rejecter'>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        ...request,
        resolver: resolve,
        rejecter: reject,
      });

      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timeout) {
        this.timeout = setTimeout(() => this.flush(), this.batchDelay);
      }
    });
  }

  private async flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.maxBatchSize);

    try {
      // For same endpoint GET requests, combine into single request
      const groupedRequests = this.groupRequests(batch);

      for (const group of groupedRequests) {
        if (group.length === 1) {
          // Single request, execute normally
          const result = await this.executeSingle(group[0]);
          group[0].resolver(result);
        } else {
          // Multiple requests to same endpoint, execute batch
          const results = await this.executeBatch(group);
          group.forEach((req, index) => {
            req.resolver(results[index]);
          });
        }
      }
    } catch (error) {
      batch.forEach(req => req.rejecter(error));
    }
  }

  private groupRequests(requests: BatchRequest[]): BatchRequest[][] {
    const groups: Record<string, BatchRequest[]> = {};

    requests.forEach(req => {
      const key = `${req.method}:${req.url}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(req);
    });

    return Object.values(groups);
  }

  private async executeSingle(request: BatchRequest) {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.data ? JSON.stringify(request.data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private async executeBatch(requests: BatchRequest[]) {
    // For batch GET requests, we can potentially combine query params
    if (requests[0].method === 'GET') {
      // Implement batch GET logic here
      // For now, execute in parallel
      return Promise.all(requests.map(req => this.executeSingle(req)));
    } else {
      // For other methods, execute in parallel
      return Promise.all(requests.map(req => this.executeSingle(req)));
    }
  }
}

/**
 * Response Cache Manager
 * Implements HTTP caching with ETags and conditional requests
 */
class ResponseCacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize: number;
  private defaultTTL: number;

  constructor(maxCacheSize = 100, defaultTTL = 300000) {
    this.maxCacheSize = maxCacheSize;
    this.defaultTTL = defaultTTL;
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if cache is expired
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set(key: string, data: any, etag?: string) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag,
    });
  }

  getETag(key: string): string | undefined {
    const entry = this.cache.get(key);
    return entry?.etag;
  }

  invalidate(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
    } else {
      const keys = Array.from(this.cache.keys());
      keys.forEach(key => {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      });
    }
  }
}

/**
 * Optimized API Client
 * Combines batching, caching, and retry logic
 */
export class OptimizedAPIClient {
  private batcher: APIBatcher;
  private cacheManager: ResponseCacheManager;
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private retryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
  };

  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    this.batcher = new APIBatcher();
    this.cacheManager = new ResponseCacheManager();
    this.baseURL = baseURL;
    this.defaultHeaders = defaultHeaders;
  }

  async get<T>(
    endpoint: string,
    options: {
      cache?: boolean;
      batch?: boolean;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const cacheKey = url;

    // Check cache first
    if (options.cache !== false) {
      const cached = this.cacheManager.get(cacheKey);
      if (cached) {
        return cached.data as T;
      }
    }

    // Prepare headers with conditional request
    const headers = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    const etag = this.cacheManager.getETag(cacheKey);
    if (etag) {
      headers['If-None-Match'] = etag;
    }

    // Execute request (batched or direct)
    let response;
    if (options.batch !== false) {
      response = await this.batcher.add({
        url,
        method: 'GET',
        headers,
      });
    } else {
      response = await this.fetchWithRetry(url, {
        method: 'GET',
        headers,
      });
    }

    // Cache successful response
    if (options.cache !== false && response) {
      this.cacheManager.set(cacheKey, response, response.etag);
    }

    return response as T;
  }

  async post<T>(
    endpoint: string,
    data: any,
    options: {
      headers?: Record<string, string>;
      invalidateCache?: string;
    } = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
        ...options.headers,
      },
      body: JSON.stringify(data),
    });

    // Invalidate related cache
    if (options.invalidateCache) {
      this.cacheManager.invalidate(options.invalidateCache);
    }

    return response as T;
  }

  async put<T>(
    endpoint: string,
    data: any,
    options: {
      headers?: Record<string, string>;
      invalidateCache?: string;
    } = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await this.fetchWithRetry(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
        ...options.headers,
      },
      body: JSON.stringify(data),
    });

    // Invalidate related cache
    if (options.invalidateCache) {
      this.cacheManager.invalidate(options.invalidateCache);
    }

    return response as T;
  }

  async delete(
    endpoint: string,
    options: {
      headers?: Record<string, string>;
      invalidateCache?: string;
    } = {}
  ): Promise<void> {
    const url = `${this.baseURL}${endpoint}`;

    await this.fetchWithRetry(url, {
      method: 'DELETE',
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    });

    // Invalidate related cache
    if (options.invalidateCache) {
      this.cacheManager.invalidate(options.invalidateCache);
    }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<any> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      // Handle 304 Not Modified
      if (response.status === 304) {
        const cached = this.cacheManager.get(url);
        if (cached) {
          return cached.data;
        }
      }

      if (!response.ok) {
        if (response.status >= 500 && retryCount < this.retryConfig.maxRetries) {
          // Server error, retry with exponential backoff
          const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount);
          await this.sleep(delay);
          return this.fetchWithRetry(url, options, retryCount + 1);
        }

        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const etag = response.headers.get('ETag');
      const data = await response.json();

      return { ...data, etag };
    } catch (error) {
      if (retryCount < this.retryConfig.maxRetries) {
        const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount);
        await this.sleep(delay);
        return this.fetchWithRetry(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  invalidateCache(pattern?: string) {
    this.cacheManager.invalidate(pattern);
  }
}

/**
 * Query Client Configuration for React Query
 * Optimized for performance
 */
export const createOptimizedQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cache and stale time settings
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes

        // Retry configuration
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          return failureCount < 3;
        },
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Performance optimizations
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: 'always',

        // Network mode
        networkMode: 'offlineFirst',
      },
      mutations: {
        // Retry configuration for mutations
        retry: 2,
        retryDelay: 1000,

        // Network mode
        networkMode: 'offlineFirst',
      },
    },
  });
};

/**
 * Request Deduplication
 * Prevents duplicate concurrent requests
 */
class RequestDeduplicator {
  private pendingRequests: Map<string, Promise<any>> = new Map();

  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Check if request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending;
    }

    // Create new request
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}

// Export singleton instances
export const apiClient = new OptimizedAPIClient(
  process.env.REACT_APP_API_URL || 'http://localhost:8000'
);

export const requestDeduplicator = new RequestDeduplicator();