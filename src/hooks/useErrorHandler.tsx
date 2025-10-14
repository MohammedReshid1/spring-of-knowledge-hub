import { useEffect } from 'react';
import { useError } from '@/contexts/ErrorContext';
import { apiClient } from '@/lib/api';

export const useErrorHandler = () => {
  const { handleApiError } = useError();

  useEffect(() => {
    // Set the error handler for the API client
    apiClient.setErrorHandler((error: unknown, endpoint?: string, context?: Record<string, unknown>) => {
      handleApiError(error, endpoint, context);
    });

    // Cleanup function
    return () => {
      apiClient.setErrorHandler(() => {});
    };
  }, [handleApiError]);
};