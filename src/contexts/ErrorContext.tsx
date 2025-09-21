import React, { createContext, useContext, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { AuthErrorHandler, AuthErrorCode } from '@/utils/authErrors';
import { ErrorMessageGenerator } from '@/utils/errorMessages';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NETWORK = 'network',
  SERVER = 'server',
  CLIENT = 'client',
  BUSINESS_LOGIC = 'business_logic'
}

export interface AppError {
  id: string;
  message: string;
  description?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: Record<string, unknown>;
  retryable?: boolean;
  handled?: boolean;
}

interface ErrorContextType {
  handleError: (error: unknown, context?: Record<string, unknown>) => AppError;
  handleApiError: (error: unknown, endpoint?: string, context?: Record<string, unknown>) => AppError;
  showError: (message: string, description?: string, severity?: ErrorSeverity) => void;
  showSuccess: (message: string, description?: string) => void;
  showWarning: (message: string, description?: string) => void;
  showInfo: (message: string, description?: string) => void;
  retry: (fn: () => Promise<unknown>, maxAttempts?: number) => Promise<unknown>;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

export const ErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signOut } = useAuth();

  const generateErrorId = () => {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const categorizeError = (error: unknown): ErrorCategory => {
    if (typeof error === 'string') {
      if (error.includes('401') || error.includes('unauthorized') || error.includes('authentication')) {
        return ErrorCategory.AUTHENTICATION;
      }
      if (error.includes('403') || error.includes('forbidden') || error.includes('permission')) {
        return ErrorCategory.AUTHORIZATION;
      }
      if (error.includes('400') || error.includes('validation') || error.includes('invalid')) {
        return ErrorCategory.VALIDATION;
      }
      if (error.includes('network') || error.includes('fetch') || error.includes('connection')) {
        return ErrorCategory.NETWORK;
      }
      if (error.includes('500') || error.includes('internal server')) {
        return ErrorCategory.SERVER;
      }
    }
    
    if (error instanceof TypeError || error instanceof ReferenceError) {
      return ErrorCategory.CLIENT;
    }
    
    return ErrorCategory.SERVER;
  };

  const getSeverity = (category: ErrorCategory): ErrorSeverity => {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.SERVER:
        return ErrorSeverity.HIGH;
      case ErrorCategory.AUTHORIZATION:
      case ErrorCategory.NETWORK:
        return ErrorSeverity.MEDIUM;
      case ErrorCategory.VALIDATION:
      case ErrorCategory.CLIENT:
        return ErrorSeverity.LOW;
      case ErrorCategory.BUSINESS_LOGIC:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.MEDIUM;
    }
  };

  const isRetryable = (category: ErrorCategory): boolean => {
    return [ErrorCategory.NETWORK, ErrorCategory.SERVER].includes(category);
  };

  const handleError = useCallback((error: unknown, context?: Record<string, unknown>): AppError => {
    const category = categorizeError(error);
    const severity = getSeverity(category);
    const message = error instanceof Error ? error.message : String(error);
    
    const appError: AppError = {
      id: generateErrorId(),
      message,
      category,
      severity,
      timestamp: new Date(),
      context,
      retryable: isRetryable(category),
      handled: false
    };

    // Log error for debugging
    console.error('Application Error:', appError);

    return appError;
  }, []);

  const handleApiError = useCallback((error: unknown, endpoint?: string, context?: Record<string, unknown>): AppError => {
    const authError = AuthErrorHandler.parseApiError(error);
    const category = categorizeError(error);
    
    // Extract HTTP status code if available
    const status = context?.status as number;
    const errorMessage = status ? 
      ErrorMessageGenerator.getHttpErrorMessage(status, endpoint) : 
      ErrorMessageGenerator.getCategoryMessage(category, authError.message);
    
    const appError: AppError = {
      id: generateErrorId(),
      message: errorMessage.title,
      description: errorMessage.description,
      category,
      severity: getSeverity(category),
      timestamp: new Date(),
      context: { endpoint, ...context },
      retryable: isRetryable(category),
      handled: false
    };

    // Handle authentication errors automatically
    if (authError.code === AuthErrorCode.TOKEN_EXPIRED || 
        authError.code === AuthErrorCode.UNAUTHORIZED ||
        authError.code === AuthErrorCode.INVALID_TOKEN) {
      signOut();
      toast.error('Session Expired', {
        description: 'Please log in again to continue.',
        duration: 5000,
      });
      appError.handled = true;
    } else {
      // Show error toast for other API errors
      toast.error(appError.message, {
        description: appError.description,
        duration: getSeverity(category) === ErrorSeverity.HIGH ? 7000 : 5000,
        action: errorMessage.action ? {
          label: errorMessage.action.label,
          onClick: errorMessage.action.handler
        } : undefined
      });
      appError.handled = true;
    }

    // Log API error for debugging
    console.error('API Error:', appError);

    return appError;
  }, [signOut]);

  const showError = useCallback((message: string, description?: string, severity: ErrorSeverity = ErrorSeverity.MEDIUM) => {
    const duration = severity === ErrorSeverity.CRITICAL ? 10000 : 
                    severity === ErrorSeverity.HIGH ? 7000 : 5000;
    
    toast.error(message, {
      description,
      duration,
      action: severity === ErrorSeverity.CRITICAL ? {
        label: 'Refresh Page',
        onClick: () => window.location.reload()
      } : undefined
    });
  }, []);

  const showSuccess = useCallback((message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 4000,
    });
  }, []);

  const showWarning = useCallback((message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 5000,
    });
  }, []);

  const showInfo = useCallback((message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 4000,
    });
  }, []);

  const retry = useCallback(async (fn: () => Promise<unknown>, maxAttempts: number = 3): Promise<unknown> => {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        const appError = handleError(error, { attempt, maxAttempts });
        
        if (!appError.retryable || attempt === maxAttempts) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`Retrying operation (attempt ${attempt + 1}/${maxAttempts})`);
      }
    }
    
    throw lastError;
  }, [handleError]);

  const value: ErrorContextType = {
    handleError,
    handleApiError,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    retry
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};