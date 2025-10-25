import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Users,
  Database,
  Shield,
  ArrowRight,
  BarChart3,
  Globe,
  Monitor,
  HardDrive,
  Clock,
  AlertCircle,
  CheckCircle,
  Activity,
  User,
  Building,
  Key
} from 'lucide-react';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Import existing components
import { AdvancedBackupManagement } from './AdvancedBackupManagement';
import { GradeTransition } from './GradeTransition';
import { DynamicRoleManagement } from './DynamicRoleManagement';
import { AccountSettings } from './AccountSettings';
import { BranchManagement } from '@/components/branches/BranchManagement';
import { SystemMonitoring } from './SystemMonitoring';
import { UserCreation } from './UserCreation';
import { StudentPasswordManagement } from '../system-admin/student-password-management';
import { ParentPasswordManagement } from '../system-admin/parent-password-management';

type AdminTab =
  | 'overview'
  | 'branches'
  | 'account'
  | 'users'
  | 'roles'
  | 'monitoring'
  | 'grade-transition'
  | 'backup'
  | 'password-management'
  | 'parent-password-management';

interface SystemStats {
  totalUsers: number;
  totalBranches: number;
  totalStudents: number;
  totalClasses: number;
  recentBackups: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export const SystemAdministration = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const { hasRole, roles, loading } = useRoleAccess();
  const { user } = useAuth();

  // Check for admin roles (handle both underscore and non-underscore formats)
  // Also fallback to check auth user role if dynamic RBAC hasn't been set up yet
  const isAdmin = hasRole('admin') || user?.role === 'admin';
  const isSuperAdmin = hasRole('superadmin') || hasRole('superadmin') || user?.role === 'superadmin';
  const isHQAdmin = hasRole('hq_admin') || hasRole('hqadmin') || user?.role === 'hqadmin';
  const isSuperSuperAdmin = hasRole('super_superadmin') || hasRole('superadmin') || user?.role === 'superadmin';
  const canManageUsers = isAdmin || isSuperAdmin || isHQAdmin || isSuperSuperAdmin;

  // Debug: log current roles for troubleshooting

  // System statistics query
  const { data: systemStats, isLoading: statsLoading } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async (): Promise<SystemStats> => {
      try {
        // Integrate with backend dashboard stats
        const [dashboardResp, backupStatsResp, usersResp] = await Promise.all([
          apiClient.getDashboardStats(),
          apiClient.getAdvancedBackupStats(),
          apiClient.getUsers(),
        ]);

        const overview = dashboardResp.data?.data?.overview || {};

        const totalUsers = usersResp.data?.length || 0;
        const totalBranches = overview.total_branches || 0;
        const totalStudents = overview.total_students || 0;
        const totalClasses = overview.total_classes || 0;

        // Get recent backups count from backup stats
        const recentBackups = backupStatsResp.data?.backups_last_7_days || 0;

        // Health check based on backups
        let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (recentBackups === 0) systemHealth = 'warning';
        if (totalUsers === 0 && totalBranches === 0) systemHealth = 'critical';

        return {
          totalUsers,
          totalBranches,
          totalStudents,
          totalClasses,
          recentBackups,
          systemHealth,
        };
      } catch (error) {
        console.error('Failed to fetch system stats:', error);
        return {
          totalUsers: 0,
          totalBranches: 0,
          totalStudents: 0,
          totalClasses: 0,
          recentBackups: 0,
          systemHealth: 'critical',
        };
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Check if user has admin access
  if (!isAdmin && !isSuperAdmin && !isHQAdmin && !isSuperSuperAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
              <p className="text-gray-600">
                You don't have permission to access system administration features.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabButtons: Array<{
    id: AdminTab;
    label: string;
    icon: any;
    adminOnly?: boolean;
    superAdminOnly?: boolean;
    superSuperAdminOnly?: boolean;
  }> = [
    { id: 'overview' as AdminTab, label: 'System Overview', icon: Activity, adminOnly: false },
    { id: 'branches' as AdminTab, label: 'Branch Management', icon: Building, adminOnly: false },
    { id: 'account' as AdminTab, label: 'Account Settings', icon: Settings, adminOnly: false },
    { id: 'users' as AdminTab, label: 'User Creation', icon: Users, adminOnly: false },
    { id: 'roles' as AdminTab, label: 'Role Management', icon: Shield, adminOnly: false },
    { id: 'monitoring' as AdminTab, label: 'System Monitoring', icon: Monitor, adminOnly: false },
    { id: 'password-management' as AdminTab, label: 'Student Passwords', icon: Key, adminOnly: false },
    { id: 'parent-password-management' as AdminTab, label: 'Parent Passwords', icon: Key, adminOnly: false },
    { id: 'grade-transition' as AdminTab, label: 'Grade Transition', icon: ArrowRight, superAdminOnly: true },
    { id: 'backup' as AdminTab, label: 'Advanced Backup', icon: Database, adminOnly: false }
  ];

  const filteredTabs = tabButtons.filter(tab => {
    if (tab.superAdminOnly && !isSuperAdmin) return false;
    if (tab.superSuperAdminOnly && !isSuperSuperAdmin) return false;
    return true;
  });

  const getHealthBadge = (health: SystemStats['systemHealth']) => {
    switch (health) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" />Warning</Badge>;
      case 'critical':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const SystemOverview = () => (
    <div className="space-y-8 relative z-50">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-300 border-0 shadow-premium">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Total Users</p>
                <p className="text-3xl font-bold text-slate-900">{systemStats?.totalUsers || 0}</p>
                <p className="text-xs text-slate-500">Registered accounts</p>
              </div>
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200/50">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300 border-0 shadow-premium">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Active Branches</p>
                <p className="text-3xl font-bold text-slate-900">{systemStats?.totalBranches || 0}</p>
                <p className="text-xs text-slate-500">School locations</p>
              </div>
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200/50">
                <Building className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300 border-0 shadow-premium">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Total Students</p>
                <p className="text-3xl font-bold text-slate-900">{systemStats?.totalStudents || 0}</p>
                <p className="text-xs text-slate-500">Enrolled students</p>
              </div>
              <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200/50">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300 border-0 shadow-premium">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Active Classes</p>
                <p className="text-3xl font-bold text-slate-900">{systemStats?.totalClasses || 0}</p>
                <p className="text-xs text-slate-500">Class sections</p>
              </div>
              <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200/50">
                <BarChart3 className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Card */}
      <Card className="border-0 shadow-premium hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200/50">
              <Activity className="h-6 w-6 text-indigo-600" />
            </div>
            System Health & Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 rounded-2xl p-6 border border-slate-200/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col space-y-3">
                <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Overall Status</span>
                <div className="flex items-center gap-3">
                  {systemStats ? getHealthBadge(systemStats.systemHealth) : <Badge variant="outline">Loading...</Badge>}
                  <span className="text-sm text-slate-600">
                    {systemStats?.systemHealth === 'healthy' && 'All systems operational'}
                    {systemStats?.systemHealth === 'warning' && 'Some issues detected'}
                    {systemStats?.systemHealth === 'critical' && 'Immediate attention required'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col space-y-3">
                <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Backup Status</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      systemStats?.recentBackups > 0 ? 'bg-emerald-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium text-slate-900">
                      {systemStats?.recentBackups || 0} backups
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">in last 7 days</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }

        .animate-pulseGlow {
          animation: pulseGlow 2s infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Premium Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          {/* Floating Shapes */}
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
                <Shield className="mr-2 h-4 w-4" />
                System Administration Hub
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                System <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Administration</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-blue-100">
                Comprehensive system management with advanced user controls, security settings, and administrative tools.
                Maintain your platform with enterprise-grade features.
              </p>
            </div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
              <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
          {/* Navigation Tabs */}
          <div className="mx-auto max-w-7xl">
            <div className="relative">
              {/* Background card with glass morphism */}
              <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/8 via-purple-500/8 to-pink-500/8 rounded-3xl pointer-events-none"></div>

              <Card className="relative bg-transparent border-0 shadow-none">
                <CardHeader className="p-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200/50">
                      <Settings className="h-5 w-5 text-indigo-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-900 bg-clip-text text-transparent">
                      Administrative Dashboard
                    </CardTitle>
                  </div>
                  <p className="text-slate-600 leading-relaxed">Manage system settings, user accounts, security configurations, and monitor platform health</p>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                  {/* Premium Tab Navigation Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {filteredTabs.map((tab, index) => {
                      const Icon = tab.icon;
                      const colorSchemes = [
                        {
                          gradient: 'from-blue-500 to-indigo-600',
                          bg: 'from-blue-50 to-indigo-50',
                          iconBg: 'from-blue-100 to-indigo-100',
                          border: 'border-blue-200/50',
                          text: 'text-blue-600',
                          glow: 'shadow-blue-200/50'
                        },
                        {
                          gradient: 'from-purple-500 to-pink-600',
                          bg: 'from-purple-50 to-pink-50',
                          iconBg: 'from-purple-100 to-pink-100',
                          border: 'border-purple-200/50',
                          text: 'text-purple-600',
                          glow: 'shadow-purple-200/50'
                        },
                        {
                          gradient: 'from-emerald-500 to-green-600',
                          bg: 'from-emerald-50 to-green-50',
                          iconBg: 'from-emerald-100 to-green-100',
                          border: 'border-emerald-200/50',
                          text: 'text-emerald-600',
                          glow: 'shadow-emerald-200/50'
                        },
                        {
                          gradient: 'from-orange-500 to-amber-600',
                          bg: 'from-orange-50 to-amber-50',
                          iconBg: 'from-orange-100 to-amber-100',
                          border: 'border-orange-200/50',
                          text: 'text-orange-600',
                          glow: 'shadow-orange-200/50'
                        },
                        {
                          gradient: 'from-pink-500 to-rose-600',
                          bg: 'from-pink-50 to-rose-50',
                          iconBg: 'from-pink-100 to-rose-100',
                          border: 'border-pink-200/50',
                          text: 'text-pink-600',
                          glow: 'shadow-pink-200/50'
                        },
                        {
                          gradient: 'from-teal-500 to-cyan-600',
                          bg: 'from-teal-50 to-cyan-50',
                          iconBg: 'from-teal-100 to-cyan-100',
                          border: 'border-teal-200/50',
                          text: 'text-teal-600',
                          glow: 'shadow-teal-200/50'
                        },
                        {
                          gradient: 'from-indigo-500 to-violet-600',
                          bg: 'from-indigo-50 to-violet-50',
                          iconBg: 'from-indigo-100 to-violet-100',
                          border: 'border-indigo-200/50',
                          text: 'text-indigo-600',
                          glow: 'shadow-indigo-200/50'
                        },
                        {
                          gradient: 'from-cyan-500 to-blue-600',
                          bg: 'from-cyan-50 to-blue-50',
                          iconBg: 'from-cyan-100 to-blue-100',
                          border: 'border-cyan-200/50',
                          text: 'text-cyan-600',
                          glow: 'shadow-cyan-200/50'
                        }
                      ];
                      const colorScheme = colorSchemes[index % colorSchemes.length];
                      const isActive = activeTab === tab.id;

                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`group relative overflow-hidden backdrop-blur-glass border transition-all duration-300 rounded-xl ${
                            isActive
                              ? `bg-gradient-to-br ${colorScheme.bg} ${colorScheme.border} shadow-md`
                              : 'bg-white/60 border-white/40 hover:bg-white/80 shadow-sm hover:shadow-md'
                          } transform hover:scale-105`}
                        >
                          {/* Gradient overlay for active state */}
                          {isActive && (
                            <div className={`absolute inset-0 bg-gradient-to-br ${colorScheme.gradient} opacity-5 pointer-events-none`} />
                          )}

                          <div className="relative p-4 flex flex-col items-start gap-3">
                            {/* Icon container */}
                            <div className={`relative p-2.5 rounded-lg bg-gradient-to-br ${
                              isActive ? colorScheme.iconBg : 'from-slate-50 to-gray-50'
                            } border ${isActive ? colorScheme.border : 'border-slate-200/50'} transition-all duration-300`}>
                              <Icon className={`h-5 w-5 ${isActive ? colorScheme.text : 'text-slate-600'} transition-colors duration-300`} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 text-left">
                              <h3 className={`text-sm font-bold mb-1 transition-colors duration-300 ${
                                isActive ? colorScheme.text : 'text-slate-700'
                              }`}>
                                {tab.label}
                              </h3>
                              <p className="text-xs text-slate-500 leading-relaxed">
                                {tab.id === 'overview' && 'Dashboard & statistics'}
                                {tab.id === 'branches' && 'Manage school locations'}
                                {tab.id === 'account' && 'System configuration'}
                                {tab.id === 'users' && 'Create user accounts'}
                                {tab.id === 'roles' && 'Access control'}
                                {tab.id === 'monitoring' && 'System health & logs'}
                                {tab.id === 'password-management' && 'Reset student passwords'}
                                {tab.id === 'parent-password-management' && 'Reset parent passwords'}
                                {tab.id === 'grade-transition' && 'Student progression'}
                                {tab.id === 'backup' && 'Data backup & restore'}
                              </p>
                            </div>

                            {/* Active indicator */}
                            {isActive && (
                              <div className={`absolute top-3 right-3 w-2 h-2 rounded-full bg-gradient-to-br ${colorScheme.gradient} animate-pulse`} />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab Content */}
                  <div className="bg-white/40 backdrop-blur-sm rounded-2xl border border-white/30 p-10 relative">
                    {activeTab === 'overview' && (
                      <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 pointer-events-auto p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                              <Activity className="h-5 w-5 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                              System Overview
                            </h3>
                          </div>
                          <SystemOverview />
                        </div>
                      </div>
                    )}
                    {activeTab === 'branches' && (
                      <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-50/80 to-pink-50/80 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 pointer-events-auto p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200/50">
                              <Building className="h-5 w-5 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-purple-800 to-pink-900 bg-clip-text text-transparent">
                              Branch Management
                            </h3>
                          </div>
                          <BranchManagement />
                        </div>
                      </div>
                    )}
                    {activeTab === 'account' && (
                      <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 to-green-50/80 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 pointer-events-auto p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200/50">
                              <Settings className="h-5 w-5 text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-emerald-800 to-green-900 bg-clip-text text-transparent">
                              Account Settings
                            </h3>
                          </div>
                          <AccountSettings />
                        </div>
                      </div>
                    )}
                    {activeTab === 'users' && (
                      <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/80 to-blue-50/80 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 pointer-events-auto p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 border border-cyan-200/50">
                              <Users className="h-5 w-5 text-cyan-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-cyan-800 to-blue-900 bg-clip-text text-transparent">
                              User Creation & Management
                            </h3>
                          </div>
                          <UserCreation />
                        </div>
                      </div>
                    )}
                    {activeTab === 'roles' && canManageUsers && (
                      <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-50/80 to-amber-50/80 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 pointer-events-auto p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200/50">
                              <Shield className="h-5 w-5 text-orange-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-orange-800 to-amber-900 bg-clip-text text-transparent">
                              Role & Permissions Management
                            </h3>
                          </div>
                          <DynamicRoleManagement />
                        </div>
                      </div>
                    )}
                    {activeTab === 'monitoring' && (
                      <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-50/80 to-rose-50/80 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 pointer-events-auto p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-100 to-rose-100 border border-pink-200/50">
                              <Monitor className="h-5 w-5 text-pink-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-pink-800 to-rose-900 bg-clip-text text-transparent">
                              System Monitoring
                            </h3>
                          </div>
                          <SystemMonitoring />
                        </div>
                      </div>
                    )}
                    {activeTab === 'password-management' && (
                      <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-50/80 to-purple-50/80 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 pointer-events-auto p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200/50">
                              <Key className="h-5 w-5 text-violet-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-violet-800 to-purple-900 bg-clip-text text-transparent">
                              Student Password Management
                            </h3>
                          </div>
                          <StudentPasswordManagement />
                        </div>
                      </div>
                    )}
                    {activeTab === 'parent-password-management' && (
                      <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-50/80 to-purple-50/80 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 pointer-events-auto p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200/50">
                              <Key className="h-5 w-5 text-violet-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-violet-800 to-purple-900 bg-clip-text text-transparent">
                              Parent Password Management
                            </h3>
                          </div>
                          <ParentPasswordManagement />
                        </div>
                      </div>
                    )}
                    {activeTab === 'grade-transition' && (isSuperAdmin || isSuperSuperAdmin) && (
                      <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 to-yellow-50/80 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 pointer-events-auto p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-100 border border-amber-200/50">
                              <ArrowRight className="h-5 w-5 text-amber-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-amber-800 to-yellow-900 bg-clip-text text-transparent">
                              Grade Transition Management
                            </h3>
                          </div>
                          <GradeTransition />
                        </div>
                      </div>
                    )}
                    {activeTab === 'backup' && (
                      <div className="relative pointer-events-auto">
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium pointer-events-none"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-teal-50/80 to-cyan-50/80 rounded-2xl pointer-events-none"></div>
                        <div className="relative z-10 pointer-events-auto p-8">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 border border-teal-200/50">
                              <Database className="h-5 w-5 text-teal-600" />
                            </div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-teal-800 to-cyan-900 bg-clip-text text-transparent">
                              Advanced Backup & Restore
                            </h3>
                          </div>
                          <AdvancedBackupManagement />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};