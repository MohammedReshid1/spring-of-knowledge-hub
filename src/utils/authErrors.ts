export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
  REFRESH_FAILED = 'REFRESH_FAILED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED'
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: string;
}

export class AuthErrorHandler {
  static createError(code: AuthErrorCode, message: string, details?: string): AuthError {
    return { code, message, details };
  }

  static parseApiError(error: unknown): AuthError {
    if (typeof error === 'string') {
      // Handle different error message patterns
      if (error.toLowerCase().includes('invalid credentials') || 
          error.toLowerCase().includes('incorrect email or password')) {
        return this.createError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
      }
      
      if (error.toLowerCase().includes('token expired')) {
        return this.createError(AuthErrorCode.TOKEN_EXPIRED, 'Your session has expired. Please log in again.');
      }
      
      if (error.toLowerCase().includes('unauthorized') || error.includes('401')) {
        return this.createError(AuthErrorCode.UNAUTHORIZED, 'You are not authorized to perform this action');
      }
      
      if (error.toLowerCase().includes('user not found')) {
        return this.createError(AuthErrorCode.USER_NOT_FOUND, 'User account not found');
      }
      
      if (error.toLowerCase().includes('account disabled') || 
          error.toLowerCase().includes('account suspended')) {
        return this.createError(AuthErrorCode.ACCOUNT_DISABLED, 'Your account has been disabled');
      }
      
      if (error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch')) {
        return this.createError(AuthErrorCode.NETWORK_ERROR, 'Network connection error. Please check your internet connection.');
      }
      
      // Default server error
      return this.createError(AuthErrorCode.SERVER_ERROR, 'Server error occurred', error);
    }
    
    // Handle structured error objects
    if (error?.detail) {
      return this.parseApiError(error.detail);
    }
    
    if (error?.message) {
      return this.parseApiError(error.message);
    }
    
    // Fallback for unknown errors
    return this.createError(AuthErrorCode.SERVER_ERROR, 'An unexpected error occurred', JSON.stringify(error));
  }

  static getDisplayMessage(error: AuthError): string {
    switch (error.code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
        return 'Invalid email or password. Please try again.';
      case AuthErrorCode.TOKEN_EXPIRED:
      case AuthErrorCode.SESSION_EXPIRED:
        return 'Your session has expired. Please log in again.';
      case AuthErrorCode.UNAUTHORIZED:
        return 'You are not authorized to access this resource.';
      case AuthErrorCode.NETWORK_ERROR:
        return 'Connection error. Please check your internet connection and try again.';
      case AuthErrorCode.USER_NOT_FOUND:
        return 'User account not found. Please check your credentials.';
      case AuthErrorCode.ACCOUNT_DISABLED:
        return 'Your account has been disabled. Please contact support.';
      case AuthErrorCode.REFRESH_FAILED:
        return 'Session refresh failed. Please log in again.';
      case AuthErrorCode.INVALID_TOKEN:
        return 'Invalid authentication token. Please log in again.';
      case AuthErrorCode.SERVER_ERROR:
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }
}