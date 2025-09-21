import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, GraduationCap, BookOpen, UserCheck, TrendingUp, ArrowUpRight, Plus, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';
import { cn } from '@/lib/utils';

export const AdminStatsWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useAdminStats } = useWidgetData();
  const { data: dashboardStats, isLoading, error } = useAdminStats();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Premium Loading State */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/50 overflow-hidden">
              <div className="absolute inset-0 bg-shimmer bg-[length:200%_100%] animate-shimmer"></div>
              <div className="relative space-y-3">
                <div className="w-8 h-8 bg-slate-200 rounded-xl animate-pulse"></div>
                <div className="space-y-2">
                  <div className="w-12 h-6 bg-slate-200 rounded animate-pulse"></div>
                  <div className="w-16 h-3 bg-slate-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200/50">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-red-600">Failed to load stats</p>
        </div>
      </div>
    );
  }

  const stats = dashboardStats?.overview || {
    total_students: 0,
    active_students: 0,
    total_classes: 0,
    total_teachers: 0,
    enrollment_rate: 0,
    recent_registrations: 0
  };

  const enrollmentPercentage = stats.total_students > 0
    ? Math.round((stats.active_students / stats.total_students) * 100)
    : 0;

  const statCards = [
    {
      id: 'students',
      icon: Users,
      label: 'Total Students',
      value: stats.total_students,
      link: '/students',
      gradient: 'from-blue-500 to-indigo-600',
      bgGradient: 'from-blue-50 to-indigo-50',
      borderColor: 'border-blue-200/50',
      shadowColor: 'shadow-glow-blue',
      textColor: 'text-blue-700',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      id: 'teachers',
      icon: UserCheck,
      label: 'Teachers',
      value: stats.total_teachers,
      link: '/teachers',
      gradient: 'from-emerald-500 to-green-600',
      bgGradient: 'from-emerald-50 to-green-50',
      borderColor: 'border-emerald-200/50',
      shadowColor: 'shadow-glow-green',
      textColor: 'text-emerald-700',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      id: 'classes',
      icon: BookOpen,
      label: 'Active Classes',
      value: stats.total_classes,
      link: '/classes',
      gradient: 'from-purple-500 to-violet-600',
      bgGradient: 'from-purple-50 to-violet-50',
      borderColor: 'border-purple-200/50',
      shadowColor: 'shadow-glow-purple',
      textColor: 'text-purple-700',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      id: 'registrations',
      icon: TrendingUp,
      label: 'New This Month',
      value: stats.recent_registrations,
      gradient: 'from-orange-500 to-amber-600',
      bgGradient: 'from-orange-50 to-amber-50',
      borderColor: 'border-orange-200/50',
      shadowColor: 'shadow-glow-orange',
      textColor: 'text-orange-700',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Premium Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          const isHovered = hoveredCard === card.id;

          const CardWrapper = card.link ? Link : 'div';

          return (
            <CardWrapper
              key={card.id}
              to={card.link}
              className={cn(
                'group relative p-4 rounded-2xl border backdrop-blur-sm transition-all duration-normal ease-premium',
                'hover:scale-105 hover:-translate-y-1',
                card.bgGradient,
                card.borderColor,
                isHovered && card.shadowColor,
                card.link && 'cursor-pointer'
              )}
              onMouseEnter={() => setHoveredCard(card.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                animationDelay: `${index * 100}ms`,
                animationFillMode: 'both'
              }}
            >
              {/* Background gradient overlay */}
              <div className={cn(
                'absolute inset-0 bg-gradient-to-br opacity-0 rounded-2xl transition-opacity duration-normal',
                card.gradient,
                isHovered && 'opacity-5'
              )}></div>

              {/* Shimmer effect on hover */}
              <div className={cn(
                'absolute inset-0 bg-shimmer bg-[length:200%_100%] rounded-2xl transition-opacity duration-fast',
                isHovered ? 'animate-shimmer opacity-20' : 'opacity-0'
              )}></div>

              <div className="relative space-y-3">
                {/* Icon */}
                <div className={cn(
                  'inline-flex p-2.5 rounded-xl transition-all duration-normal',
                  card.iconBg,
                  isHovered && 'animate-bounce-gentle'
                )}>
                  <Icon className={cn('h-5 w-5', card.iconColor)} />
                </div>

                {/* Value */}
                <div className="space-y-1">
                  <div className={cn(
                    'text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent transition-all duration-normal',
                    card.gradient
                  )}>
                    {card.value.toLocaleString()}
                  </div>
                  <p className={cn('text-xs font-medium', card.textColor)}>
                    {card.label}
                  </p>
                </div>

                {/* Arrow icon for links */}
                {card.link && (
                  <div className={cn(
                    'absolute top-3 right-3 opacity-0 transition-all duration-normal',
                    isHovered && 'opacity-100 translate-x-0',
                    !isHovered && 'translate-x-1'
                  )}>
                    <ArrowUpRight className={cn('h-4 w-4', card.iconColor)} />
                  </div>
                )}
              </div>
            </CardWrapper>
          );
        })}
      </div>

      {/* Premium Progress Section */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200/50">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Student Engagement</span>
            <Badge className="bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-700 border-indigo-200/50 font-medium">
              {stats.active_students}/{stats.total_students}
            </Badge>
          </div>

          {/* Custom Premium Progress Bar */}
          <div className="relative">
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-slow ease-premium"
                style={{ width: `${enrollmentPercentage}%` }}
              >
                <div className="h-full bg-shimmer bg-[length:200%_100%] animate-shimmer opacity-30"></div>
              </div>
            </div>
            <div className="absolute inset-0 h-3 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"></div>
          </div>

          <p className="text-xs text-slate-600 font-medium">
            {enrollmentPercentage}% engagement rate
          </p>
        </div>
      </div>

      {/* Premium Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/students?action=new"
          className="group flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium transition-all duration-normal hover:scale-105 hover:shadow-glow-blue"
        >
          <Plus className="h-4 w-4 transition-transform duration-normal group-hover:rotate-90" />
          Add Student
        </Link>
        <Link
          to="/classes?action=new"
          className="group flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-white text-sm font-medium transition-all duration-normal hover:scale-105 hover:shadow-glow-purple"
        >
          <Settings className="h-4 w-4 transition-transform duration-normal group-hover:rotate-12" />
          Create Class
        </Link>
      </div>
    </div>
  );
};