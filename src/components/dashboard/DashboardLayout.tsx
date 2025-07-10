import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/layout/Footer';
import { BranchSelector } from '@/components/branches/BranchSelector';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  Building,
  LogOut,
  Home,
  CreditCard,
  DollarSign,
  UserCheck,
  Settings,
  IdCard,
  Menu,
  X
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const { isAdmin, isSuperAdmin } = useRoleAccess();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    { name: 'Dashboard', href: '/dashboard', icon: Home, adminOnly: false },
    { name: 'Students', href: '/students', icon: Users, adminOnly: false },
    { name: 'Classes', href: '/classes', icon: BookOpen, adminOnly: false },
    { name: 'Teachers', href: '/teachers', icon: UserCheck, adminOnly: false },
    { name: 'Payments', href: '/payments', icon: CreditCard, adminOnly: false },
    { name: 'Payment Dashboard', href: '/payment-dashboard', icon: DollarSign, adminOnly: false },
    { name: 'Student ID Cards', href: '/student-id-cards', icon: IdCard, adminOnly: false },
    { name: 'Branches', href: '/branches', icon: Building, adminOnly: true },
    { name: 'Settings', href: '/settings', icon: Settings, adminOnly: false },
  ];

  // Filter navigation items based on user role
  const filteredNavigation = navigation.filter(item => 
    !item.adminOnly || isAdmin || isSuperAdmin
  );

  const handleSignOut = async () => {
    await signOut();
  };

  const displayName = userProfile?.full_name || user?.email || 'User';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow relative z-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden mr-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
              
              <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 text-primary mr-2 sm:mr-3" />
              <h1 className="text-sm sm:text-xl font-semibold text-gray-900 truncate">
                <span className="hidden sm:inline">Spring of Knowledge Academy</span>
                <span className="sm:hidden">SOKA</span>
              </h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <BranchSelector />
              <span className="text-xs sm:text-sm text-gray-700 hidden sm:block">
                Welcome, {displayName}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSignOut}
                className="flex items-center space-x-1 sm:space-x-2"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 right-0 bg-white shadow-lg border-t z-40">
            <div className="px-4 py-2 space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <nav className="hidden lg:block w-64 bg-white shadow-sm">
          <div className="p-4">
            <ul className="space-y-2">
              {filteredNavigation.map((item) => {
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
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 p-3 sm:p-6">
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