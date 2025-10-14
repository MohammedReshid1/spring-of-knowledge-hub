import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useBranch } from '@/contexts/BranchContext';
import { useNavigate } from 'react-router-dom';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { WidgetContainer } from './widgets/WidgetContainer';
import { Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import { useLiveData } from '@/hooks/useLiveData';
import { LiveUpdatesIndicator } from '@/components/common/LiveUpdatesIndicator';

export const Overview = () => {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, isTeacher } = useRoleAccess();
  const { selectedBranch, userBranches } = useBranch();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Enable real-time updates for dashboard overview
  useLiveData(['students', 'teachers', 'classes', 'attendance', 'payments', 'exams', 'notifications']);

  // Update time every minute for dynamic feel
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Redirect teachers to their specialized dashboard
  useEffect(() => {
    if (isTeacher && user) {
      navigate('/teacher-dashboard', { replace: true });
    }
  }, [isTeacher, user, navigate]);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <BranchLoadingWrapper loadingMessage="Loading dashboard data...">
      <div className="min-h-screen relative overflow-hidden">
        {/* Consistent off-white background */}
        <div className="absolute inset-0 bg-slate-50"></div>

        {/* Premium Hero Section */}
        <div className="relative z-10">
          <div className="px-6 pt-12 pb-8">
            <div className="max-w-7xl mx-auto">
              <div className="text-center space-y-8">
                {/* Premium Greeting Section */}
                <div className="space-y-6 animate-fade-in">
                  {/* Main Title with Spectacular Gradient */}
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/80 backdrop-blur-glass border border-white/30 shadow-premium animate-scale-in">
                      <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse-glow" />
                      <span className="text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        Welcome to Excellence
                      </span>
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold leading-none animate-fade-in-up" style={{animationDelay: '200ms', animationFillMode: 'both'}}>
                      <span className="bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent tracking-tight">
                        Dashboard
                      </span>
                    </h1>

                    <div className="space-y-3 animate-fade-in-up" style={{animationDelay: '400ms', animationFillMode: 'both'}}>
                      <p className="text-xl md:text-2xl font-medium bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                        {getGreeting()}, {user?.full_name?.split(' ')[0] || 'Administrator'}
                      </p>
                      <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
                        Spring of Knowledge Academy Management System
                      </p>
                      <p className="text-sm font-medium text-slate-500">
                        {formatDate()}
                      </p>
                    </div>
                  </div>

                  {/* Premium Stats Bar */}
                  <div className="flex flex-wrap justify-center gap-4 animate-fade-in-up" style={{animationDelay: '600ms', animationFillMode: 'both'}}>
                    <LiveUpdatesIndicator />
                    <div className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/60 backdrop-blur-glass border border-white/40 shadow-premium hover:bg-white/80 hover:scale-105 transition-all duration-normal">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 group-hover:shadow-glow-blue transition-all duration-normal">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <div className="text-lg font-bold text-slate-800">Active</div>
                        <div className="text-xs font-medium text-slate-600">Management</div>
                      </div>
                    </div>

                    <div className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/60 backdrop-blur-glass border border-white/40 shadow-premium hover:bg-white/80 hover:scale-105 transition-all duration-normal">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 group-hover:shadow-glow-green transition-all duration-normal">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="text-left">
                        <div className="text-lg font-bold text-slate-800">Growing</div>
                        <div className="text-xs font-medium text-slate-600">Excellence</div>
                      </div>
                    </div>

                    <div className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/60 backdrop-blur-glass border border-white/40 shadow-premium hover:bg-white/80 hover:scale-105 transition-all duration-normal">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 group-hover:shadow-md transition-all duration-normal">
                        <Zap className="h-5 w-5 text-slate-600" />
                      </div>
                      <div className="text-left">
                        <div className="text-lg font-bold text-slate-800">Premium</div>
                        <div className="text-xs font-medium text-slate-600">Experience</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branch Information with Enhanced Styling */}
                <div className="flex flex-wrap justify-center gap-4 animate-fade-in-up" style={{animationDelay: '800ms', animationFillMode: 'both'}}>
                  {selectedBranch && selectedBranch !== 'all' && userBranches.length > 1 && (
                    <div className="group inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-glass border border-blue-200/60 shadow-premium hover:shadow-glow-blue hover:scale-105 transition-all duration-normal">
                      <div className="relative">
                        <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse-glow"></div>
                        <div className="absolute inset-0 h-3 w-3 bg-blue-400 rounded-full animate-ping"></div>
                      </div>
                      <span className="text-sm font-semibold text-blue-700">
                        Currently viewing: {userBranches.find(b => b.id === selectedBranch)?.name || 'Selected Branch'}
                      </span>
                    </div>
                  )}

                  {selectedBranch === 'all' && (
                    <div className="group inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-50/80 to-green-50/80 backdrop-blur-glass border border-emerald-200/60 shadow-premium hover:shadow-glow-green hover:scale-105 transition-all duration-normal">
                      <div className="relative">
                        <div className="h-3 w-3 bg-emerald-500 rounded-full animate-pulse-glow"></div>
                        <div className="absolute inset-0 h-3 w-3 bg-emerald-400 rounded-full animate-ping"></div>
                      </div>
                      <span className="text-sm font-semibold text-emerald-700">
                        Currently viewing: All Branches Combined
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Widget Dashboard with Premium Container */}
        <div className="relative z-10 px-6 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="animate-fade-in-up" style={{ animationDelay: '1000ms', animationFillMode: 'both' }}>
              <WidgetContainer />
            </div>
          </div>
        </div>

      </div>
    </BranchLoadingWrapper>
  );
};
