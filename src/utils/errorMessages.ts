import { ErrorCategory } from '@/contexts/ErrorContext';

export interface ErrorMessage {
  title: string;
  description: string;
  action?: {
    label: string;
    handler: () => void;
  };
}

export class ErrorMessageGenerator {
  static getHttpErrorMessage(status: number, endpoint?: string): ErrorMessage {
    switch (status) {
      case 400:
        return {
          title: 'Invalid Request',
          description: 'Please check your input and try again.'
        };
      
      case 401:
        return {
          title: 'Authentication Required',
          description: 'Please log in to continue.',
          action: {
            label: 'Login',
            handler: () => window.location.href = '/login'
          }
        };
      
      case 403:
        return {
          title: 'Access Denied',
          description: 'You don\'t have permission to perform this action.'
        };
      
      case 404:
        return {
          title: 'Not Found',
          description: endpoint ? `The requested resource was not found.` : 'Page not found.'
        };
      
      case 409:
        return {
          title: 'Conflict',
          description: 'This action conflicts with existing data. Please refresh and try again.',
          action: {
            label: 'Refresh',
            handler: () => window.location.reload()
          }
        };
      
      case 422:
        return {
          title: 'Validation Error',
          description: 'Please check your input fields for errors.'
        };
      
      case 429:
        return {
          title: 'Too Many Requests',
          description: 'Please wait a moment before trying again.'
        };
      
      case 500:
        return {
          title: 'Server Error',
          description: 'Something went wrong on our end. Please try again later.',
          action: {
            label: 'Retry',
            handler: () => window.location.reload()
          }
        };
      
      case 502:
      case 503:
      case 504:
        return {
          title: 'Service Unavailable',
          description: 'The service is temporarily unavailable. Please try again in a few minutes.',
          action: {
            label: 'Retry',
            handler: () => window.location.reload()
          }
        };
      
      default:
        return {
          title: 'Unexpected Error',
          description: `An unexpected error occurred (${status}). Please try again.`
        };
    }
  }

  static getCategoryMessage(category: ErrorCategory, message?: string): ErrorMessage {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return {
          title: 'Authentication Error',
          description: message || 'Your session has expired. Please log in again.',
          action: {
            label: 'Login',
            handler: () => window.location.href = '/login'
          }
        };
      
      case ErrorCategory.AUTHORIZATION:
        return {
          title: 'Access Denied',
          description: message || 'You don\'t have permission to access this resource.'
        };
      
      case ErrorCategory.VALIDATION:
        return {
          title: 'Invalid Input',
          description: message || 'Please check your input and try again.'
        };
      
      case ErrorCategory.NETWORK:
        return {
          title: 'Connection Error',
          description: message || 'Please check your internet connection and try again.',
          action: {
            label: 'Retry',
            handler: () => window.location.reload()
          }
        };
      
      case ErrorCategory.SERVER:
        return {
          title: 'Server Error',
          description: message || 'Something went wrong on our end. Please try again later.',
          action: {
            label: 'Retry',
            handler: () => window.location.reload()
          }
        };
      
      case ErrorCategory.CLIENT:
        return {
          title: 'Application Error',
          description: message || 'An unexpected error occurred. Please refresh the page.',
          action: {
            label: 'Refresh',
            handler: () => window.location.reload()
          }
        };
      
      case ErrorCategory.BUSINESS_LOGIC:
        return {
          title: 'Business Rule Violation',
          description: message || 'This action violates a business rule. Please check the requirements.'
        };
      
      default:
        return {
          title: 'Error',
          description: message || 'An unexpected error occurred.'
        };
    }
  }

  static getOperationMessage(operation: string, error: string): ErrorMessage {
    const operationMap: Record<string, string> = {
      'create': 'creating',
      'update': 'updating',
      'delete': 'deleting',
      'fetch': 'loading',
      'save': 'saving',
      'submit': 'submitting',
      'upload': 'uploading',
      'download': 'downloading'
    };

    const verb = operationMap[operation] || operation;
    
    return {
      title: `Error ${verb}`,
      description: `Failed to ${verb}. ${error}`,
      action: {
        label: 'Try Again',
        handler: () => window.location.reload()
      }
    };
  }
}