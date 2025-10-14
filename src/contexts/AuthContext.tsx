import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { isTokenExpired, getTokenExpirationTime } from '@/utils/jwt';
import { TokenStorage } from '@/utils/tokenStorage';
import { AuthErrorHandler, AuthErrorCode } from '@/utils/authErrors';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  branch_id?: string;
  created_at: string;
  updated_at: string;
  permissions?: string[];
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData?: any) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimer, setSessionTimer] = useState<NodeJS.Timeout | null>(null);

  const startSessionTimer = () => {
    if (sessionTimer) {
      clearTimeout(sessionTimer);
    }
    
    const token = TokenStorage.getToken();
    if (!token) return;
    
    const expirationTime = getTokenExpirationTime(token);
    if (!expirationTime) return;
    
    const timeUntilExpiry = expirationTime - Date.now();
    
    // Set timer to expire 5 minutes before actual token expiration
    const timerDuration = Math.max(timeUntilExpiry - 5 * 60 * 1000, 0);
    
    const timer = setTimeout(() => {
      signOut();
    }, timerDuration);
    
    setSessionTimer(timer);
  };

  const resetSessionTimer = () => {
    if (sessionTimer) {
      clearTimeout(sessionTimer);
    }
    startSessionTimer();
  };

  // Listen for logout events from API client
  useEffect(() => {
    const handleLogoutEvent = () => {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
        setSessionTimer(null);
      }
      apiClient.removeToken();
      TokenStorage.clear();
      setUser(null);
    };

    window.addEventListener('auth:logout', handleLogoutEvent);

    return () => {
      window.removeEventListener('auth:logout', handleLogoutEvent);
    };
  }, [sessionTimer]);

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      const token = TokenStorage.getToken();
      if (token) {
        // Check if token is expired before using it
        if (isTokenExpired(token)) {
          TokenStorage.clear();
          setLoading(false);
          return;
        }

        apiClient.setToken(token);
        const { data: userData, error } = await apiClient.getCurrentUser();
        if (error) {
          console.error('Error fetching user:', error);
          apiClient.removeToken();
          setUser(null);
        } else {
          setUser(userData);
          startSessionTimer();
        }
      }
      setLoading(false);
    };

    checkSession();

    return () => {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    
    try {
      const { data, error } = await apiClient.signIn(email, password);
      
      if (error) {
        const authError = AuthErrorHandler.parseApiError(error);
        console.error('Sign in error:', authError);
        return { error: authError };
      }

      if (data?.access_token) {
        apiClient.setToken(data.access_token);
        
        // Fetch user data after successful login
        const { data: userData, error: userError } = await apiClient.getCurrentUser();
        if (userError) {
          const authError = AuthErrorHandler.parseApiError(userError);
          console.error('Error fetching user after login:', authError);
          
          // Clean up token if user fetch fails
          apiClient.removeToken();
          return { error: authError };
        }
        
        setUser(userData);
        startSessionTimer();
        
      }
      
      return { error: null };
    } catch (error) {
      const authError = AuthErrorHandler.createError(
        AuthErrorCode.NETWORK_ERROR, 
        'Network error during sign in',
        error instanceof Error ? error.message : 'Unknown error'
      );
      console.error('Unexpected sign in error:', authError);
      return { error: authError };
    }
  };

  const signUp = async (email: string, password: string, userData?: any) => {
    
    try {
      const signUpData = {
        email,
        password,
        full_name: userData?.full_name || email.split('@')[0] || 'User',
        role: userData?.role || 'student',
        phone: userData?.phone || '',
        branch_id: userData?.branch_id || '',
      };
      
      const { data, error } = await apiClient.signUp(signUpData);
      
      if (error) {
        const authError = AuthErrorHandler.parseApiError(error);
        console.error('Sign up error:', authError);
        return { error: authError };
      }

      return { error: null };
    } catch (error) {
      const authError = AuthErrorHandler.createError(
        AuthErrorCode.NETWORK_ERROR, 
        'Network error during sign up',
        error instanceof Error ? error.message : 'Unknown error'
      );
      console.error('Unexpected sign up error:', authError);
      return { error: authError };
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      const { data, error } = await apiClient.refreshToken();
      if (error || !data?.access_token) {
        await signOut();
        return false;
      }
      
      apiClient.setToken(data.access_token);
      startSessionTimer();
      return true;
    } catch (error) {
      console.error('Session refresh failed:', error);
      await signOut();
      return false;
    }
  };

  const signOut = async () => {
    if (sessionTimer) {
      clearTimeout(sessionTimer);
      setSessionTimer(null);
    }
    
    // Clear all authentication state
    apiClient.removeToken();
    TokenStorage.clear();
    setUser(null);
    
    // Clear any cached data that might contain sensitive information
    if (typeof window !== 'undefined') {
      // Clear React Query cache if available
      try {
        const event = new CustomEvent('auth:logout');
        window.dispatchEvent(event);
      } catch (error) {
        console.warn('Failed to dispatch logout event:', error);
      }
    }
  };

  // Reset session timer on user activity
  useEffect(() => {
    if (user) {
      const handleActivity = () => resetSessionTimer();
      
      window.addEventListener('mousedown', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('scroll', handleActivity);
      
      return () => {
        window.removeEventListener('mousedown', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('scroll', handleActivity);
      };
    }
  }, [user, sessionTimer]);

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshSession,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};