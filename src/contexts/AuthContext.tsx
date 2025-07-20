import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  branch_id?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, userData?: any) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
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
    
    const timer = setTimeout(() => {
      console.log('Session expired, logging out');
      signOut();
    }, 30 * 60 * 1000); // 30 minutes
    
    setSessionTimer(timer);
  };

  const resetSessionTimer = () => {
    if (sessionTimer) {
      clearTimeout(sessionTimer);
    }
    startSessionTimer();
  };

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        apiClient.setToken(token);
        const { data: userData, error } = await apiClient.getCurrentUser();
        if (error) {
          console.error('Error fetching user:', error);
          apiClient.removeToken();
          setUser(null);
          // Auto-login with admin credentials for demo
          await autoLogin();
        } else {
          setUser(userData);
          startSessionTimer();
        }
      } else {
        // Auto-login with admin credentials for demo purposes
        await autoLogin();
      }
      setLoading(false);
    };

    const autoLogin = async () => {
      console.log('Attempting auto-login with admin credentials...');
      const result = await signIn('admin@school.edu', 'admin123');
      if (result.error) {
        console.error('Auto-login failed:', result.error);
      } else {
        console.log('Auto-login successful!');
      }
    };

    checkSession();

    return () => {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in for:', email);
    const { data, error } = await apiClient.signIn(email, password);
    
    if (error) {
      console.error('Sign in error:', error);
      return { error };
    }

    if (data?.access_token) {
      apiClient.setToken(data.access_token);
      
      // Fetch user data after successful login
      const { data: userData, error: userError } = await apiClient.getCurrentUser();
      if (userError) {
        console.error('Error fetching user after login:', userError);
        return { error: userError };
      }
      
      setUser(userData);
      startSessionTimer();
    }
    
    return { error: null };
  };

  const signUp = async (email: string, password: string, userData?: any) => {
    console.log('Attempting sign up for:', email);
    
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
      console.error('Sign up error:', error);
      return { error };
    }

    console.log('Sign up successful:', email);
    return { error: null };
  };

  const signOut = async () => {
    console.log('Signing out');
    if (sessionTimer) {
      clearTimeout(sessionTimer);
      setSessionTimer(null);
    }
    apiClient.removeToken();
    setUser(null);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};