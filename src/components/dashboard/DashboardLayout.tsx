
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Footer } from '@/components/layout/Footer';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  BarChart3, 
  LogOut,
  Home,
  CreditCard,
  DollarSign,
  UserCheck,
  Settings,
  IdCard
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  // Fetch user profile to get full name
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Students', href: '/students', icon: Users },
    { name: 'Classes', href: '/classes', icon: BookOpen },
    { name: 'Teachers', href: '/teachers', icon: UserCheck },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Payment Dashboard', href: '/payment-dashboard', icon: DollarSign },
    { name: 'Student ID Cards', href: '/student-id-cards', icon: IdCard },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  const displayName = userProfile?.full_name || user?.email || 'User';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <img 
                src="/SPRING_LOGO-removebg-preview.png" 
                alt="School Logo" 
                className="h-12 w-12 object-contain mr-3"
              />
              <h1 className="text-xl font-semibold text-gray-900">
                Spring of Knowledge Academy
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {displayName}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSignOut}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-sm">
          <div className="p-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Main content area with footer */}
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
};
