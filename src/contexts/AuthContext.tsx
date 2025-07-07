import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
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
  const [session, setSession] = useState<Session | null>(null);
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
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (session?.user) {
          startSessionTimer();
        } else if (sessionTimer) {
          clearTimeout(sessionTimer);
          setSessionTimer(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in for:', email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, userData?: any) => {
    console.log('Attempting sign up for:', email);
    // Sign up without email confirmation
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    
    if (error) {
      console.error('Sign up error:', error);
      return { error };
    }

    // If signup was successful and we have a user, create a profile record
    if (data.user) {
      console.log('Creating user profile for:', data.user.email);
      
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email,
          full_name: userData?.full_name || data.user.email?.split('@')[0] || 'User',
          role: userData?.role || 'student',
          phone: userData?.phone || null,
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Don't return the profile error as the auth signup was successful
        // The user can still sign in, they just might need to update their profile
      } else {
        console.log('User profile created successfully');
      }
    }

    console.log('Sign up successful:', data.user?.email);
    return { error: null };
  };

  const signOut = async () => {
    console.log('Signing out');
    if (sessionTimer) {
      clearTimeout(sessionTimer);
      setSessionTimer(null);
    }
    await supabase.auth.signOut();
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
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};