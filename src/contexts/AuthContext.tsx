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
  profile_picture?: string;
  created_at: string;
  updated_at: string;
  permissions?: string[];
  last_login?: string;
}

interface StudentUser {
  id: string;
  student_id: string;
  full_name: string;
  email?: string;
  role: 'student';
  grade_level?: string;
  section?: string;
  branch_id?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  requires_password_change?: boolean;
  is_default_password?: boolean;
}

interface AuthContextType {
  user: User | null;
  student: StudentUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInStudent: (studentId: string, password: string) => Promise<{ data?: any; error?: any }>;
  signUp: (email: string, password: string, userData?: any) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isStudentAuthenticated: boolean;
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
  const [student, setStudent] = useState<StudentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimer, setSessionTimer] = useState<NodeJS.Timeout | null>(null);
  const [tokenExpiryCheckInterval, setTokenExpiryCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // SECURITY: Session management now handled by httpOnly cookies on backend
  // Client-side timers removed - backend manages token expiry

  // Listen for logout events from API client
  useEffect(() => {
    const handleLogoutEvent = () => {
      // SECURITY: Clear state only - cookies cleared by backend
      setUser(null);
      setStudent(null);
      setSessionStartTime(null);
    };

    window.addEventListener('auth:logout', handleLogoutEvent);

    return () => {
      window.removeEventListener('auth:logout', handleLogoutEvent);
    };
  }, []);

  useEffect(() => {
    // SECURITY: Check for existing session using httpOnly cookies
    const checkSession = async () => {
      try {
        // Try to get current user - if successful, we have a valid session
        const { data: userData, error } = await apiClient.getCurrentUser();

        if (error || !userData) {
          // No valid session
          console.info('No active session found');
          setUser(null);
          setStudent(null);
          setLoading(false);
          return;
        }

        // Valid session found - check if student or regular user
        if (userData.role === 'student') {
          setStudent(userData as StudentUser);
          setUser(null);
        } else {
          setUser(userData);
          setStudent(null);
        }
        setSessionStartTime(Date.now());
      } catch (error) {
        console.error('Error checking session:', error);
        setUser(null);
        setStudent(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // SECURITY: Login now sets httpOnly cookie automatically
      const { data, error } = await apiClient.signIn(email, password);

      if (error) {
        const authError = AuthErrorHandler.parseApiError(error);
        console.error('Sign in error:', authError);
        return { error: authError };
      }

      // SECURITY: No access_token in response - cookie set by backend
      // Fetch user data to confirm login and get user details
      const { data: userData, error: userError } = await apiClient.getCurrentUser();
      if (userError || !userData) {
        const authError = AuthErrorHandler.parseApiError(userError || 'Failed to fetch user data');
        console.error('Error fetching user after login:', authError);
        return { error: authError };
      }

      // Set user or student based on role
      if (userData.role === 'student') {
        setStudent(userData as StudentUser);
        setUser(null);
      } else {
        setUser(userData);
        setStudent(null);
      }

      setSessionStartTime(Date.now());
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

  const signInStudent = async (studentId: string, password: string) => {
    try {
      // SECURITY: Student login now uses httpOnly cookies
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/student/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',  // ✅ SECURITY: Enable cookie-based authentication
        body: JSON.stringify({
          student_id: studentId,
          password: password
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const authError = AuthErrorHandler.createError(
          AuthErrorCode.INVALID_CREDENTIALS,
          data.message || 'Student authentication failed'
        );
        console.error('Student sign in error:', authError);
        return { error: authError };
      }

      // SECURITY: No access_token in response - cookie set by backend
      // Store student data in state (without token)
      const studentData = {
        ...data.student,
        token_type: data.token_type,
        requires_password_change: data.requires_password_change,
        is_default_password: data.is_default_password
      };

      // Set student state ONLY if password change is not required
      if (!data.requires_password_change && !data.is_default_password) {
        setStudent(studentData);
        setUser(null);
        setSessionStartTime(Date.now());
      }

      // Return student data including password change flags
      return {
        data: studentData,
        error: null
      };
    } catch (error) {
      const authError = AuthErrorHandler.createError(
        AuthErrorCode.NETWORK_ERROR,
        'Network error during student sign in',
        error instanceof Error ? error.message : 'Unknown error'
      );
      console.error('Unexpected student sign in error:', authError);
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

  const refreshUser = async (): Promise<void> => {
    try {
      const token = TokenStorage.getToken();
      if (!token) return;

      // Decode token to check if this is a student
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));

          // If this is a student, fetch from student dashboard endpoint
          if (payload.student_id || payload.role === 'student') {
            const response = await fetch(
              `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/auth/student/dashboard/${payload.student_id}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`
                },
                credentials: 'include'  // ✅ SECURITY: Enable cookie-based authentication
              }
            );

            if (!response.ok) {
              console.error('Error refreshing student data:', response.statusText);
              return;
            }

            const dashboardData = await response.json();

            // Merge basic_info into student object
            const studentData = {
              ...dashboardData.basic_info,
              id: payload.sub,
              role: 'student' as const,
              created_at: dashboardData.basic_info?.enrollment_date || '',
              updated_at: '',
            };

            setStudent(studentData);
            setUser(null);
            return;
          }
        }
      } catch (e) {
        console.error('Error decoding token for refresh:', e);
      }

      // For non-student users, fetch from regular endpoint
      const { data: userData, error } = await apiClient.getCurrentUser();
      if (error) {
        console.error('Error refreshing user data:', error);
        return;
      }

      // Update the appropriate state based on user type
      if (userData?.role === 'student') {
        setStudent(userData as StudentUser);
        setUser(null);
      } else {
        setUser(userData);
        setStudent(null);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const signOut = async () => {
    // SECURITY: Call backend to clear httpOnly cookies
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }

    // Clear session state
    setSessionStartTime(null);
    setUser(null);
    setStudent(null);

    // Dispatch logout event for other components
    if (typeof window !== 'undefined') {
      try {
        const event = new CustomEvent('auth:logout');
        window.dispatchEvent(event);
      } catch (error) {
        console.warn('Failed to dispatch logout event:', error);
      }
    }
  };

  // SECURITY: Activity-based session refresh no longer needed
  // Backend handles token expiry via httpOnly cookies

  const value = {
    user,
    student,
    loading,
    signIn,
    signInStudent,
    signUp,
    signOut,
    refreshSession,
    refreshUser,
    isAuthenticated: !!user,
    isStudentAuthenticated: !!student,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};