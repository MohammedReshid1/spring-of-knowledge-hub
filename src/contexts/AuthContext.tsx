import React, { createContext, useContext, useEffect, useState } from 'react';

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
  signIn: (email: string, password: string) => Promise<{ error: any } | { error: null }>;
  signUp: (email: string, password: string, userData?: any) => Promise<{ error: any } | { error: null }>;
  signOut: () => void;
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

  // Helper to get token from localStorage
  const getToken = () => localStorage.getItem('token');

  // Fetch user info if token exists
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch('/api/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Not authenticated');
        const data = await res.json();
        setUser(data);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const form = new URLSearchParams();
      form.append('username', email);
      form.append('password', password);
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      if (!res.ok) {
        const err = await res.json();
        return { error: err.detail || 'Login failed' };
      }
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      // Fetch user info
      const userRes = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (!userRes.ok) throw new Error('Failed to fetch user');
      const userData = await userRes.json();
      setUser(userData);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, userData?: any) => {
    try {
      const res = await fetch('/api/users/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...userData }),
      });
      if (!res.ok) {
        const err = await res.json();
        return { error: err.detail || 'Signup failed' };
      }
      // Optionally auto-login after signup
      return await signIn(email, password);
    } catch (error) {
      return { error };
    }
  };

  const signOut = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};