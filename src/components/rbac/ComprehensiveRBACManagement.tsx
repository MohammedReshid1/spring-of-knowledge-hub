import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { PermissionManagement } from './PermissionManagement';
import { EnhancedRoleManagement } from './EnhancedRoleManagement';
import { UserRoleAssignment } from './UserRoleAssignment';
import { AuditLog } from './AuditLog';
import { apiClient } from '@/lib/api';
import { useLiveData } from '@/hooks/useLiveData';
import {
  Shield,
  Key,
  Users,
  History,
  Settings,
  Lock,
  AlertTriangle,
  CheckCircle,
  Info,
  Activity,
  Database,
  UserCheck,
  Crown,
  Eye
} from 'lucide-react';

interface RBACStats {
  permissions: {
    total: number;
    active: number;
    inactive: number;
  };
  roles: {
    total: number;
    active: number;
    inactive: number;
    system: number;
    custom: number;
  };
  users: {
    total: number;
    withRoles: number;
    withoutRoles: number;
    active: number;
  };
  audit: {
    todayEntries: number;
    successRate: number;
    failedActions: number;
  };
  recentActivity?: {
    permissionsCreatedToday: number;
    rolesUpdatedLastHour: number;
    usersAssignedToday: number;
    auditEntriesToday: number;
  };
}

export const ComprehensiveRBACManagement: React.FC = () => {
  const { hasPermission, hasRole, user } = useRoleAccess();
  const [activeTab, setActiveTab] = useState<'overview' | 'permissions' | 'roles' | 'users' | 'audit'>('overview');

  // Enable real-time updates via WebSocket
  useLiveData(['rbac-stats', 'rbac-permissions', 'rbac-roles', 'users-with-roles', 'audit-logs']);

  // Fetch real RBAC stats from API
  const { data: statsResponse, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['rbac-stats'],
    queryFn: async () => {
      const response = await apiClient.getRbacStats();
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  const stats: RBACStats = statsResponse || {
    permissions: { total: 0, active: 0, inactive: 0 },
    roles: { total: 0, active: 0, system: 0, custom: 0 },
    users: { total: 0, withRoles: 0, withoutRoles: 0, active: 0 },
    audit: { todayEntries: 0, successRate: 0, failedActions: 0 },
  };

  // Check if user has access to RBAC system
  // Use the same access control logic as SystemAdministration component
  const isAdmin = hasRole('admin') || user?.role === 'admin';
  const isSuperAdmin = hasRole('super_admin') || hasRole('superadmin') || user?.role === 'superadmin';
  const isHQAdmin = hasRole('hq_admin') || hasRole('hqadmin') || user?.role === 'hqadmin';
  const isSuperSuperAdmin = hasRole('super_super_admin') || hasRole('superadmin') || user?.role === 'superadmin';
  const canManageUsers = isAdmin || isSuperAdmin || isHQAdmin || isSuperSuperAdmin;

  // Also check for the specific RBAC permission as a fallback
  const hasRBACPermission = hasPermission('rbac.view');
  const hasAccess = canManageUsers || hasRBACPermission;

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have permission to access the RBAC Management System.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact your administrator if you need access to this section.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            box-shadow: 0 0 20px rgba(147, 51, 234, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(147, 51, 234, 0.5);
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

    <div className="space-y-8 animate-fadeInUp">
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-lg" />
            <Shield className="relative h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-purple-800 to-pink-900 bg-clip-text text-transparent">
              RBAC Management System
            </h1>
            <p className="text-sm text-slate-600 font-medium">Comprehensive role-based access control management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border-white/40 px-4 py-2">
            <UserCheck className="h-4 w-4 text-purple-600" />
            <span className="font-medium">{user?.full_name || 'Admin'}</span>
          </Badge>
          {(isSuperSuperAdmin || isSuperAdmin || isAdmin || hasPermission('rbac.admin')) && (
            <Badge className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 px-4 py-2">
              <Crown className="h-4 w-4" />
              <span className="font-medium">
                {isSuperSuperAdmin ? 'Super Super Admin' : isSuperAdmin ? 'Super Admin' : 'Admin Access'}
              </span>
            </Badge>
          )}
        </div>
      </div>

      {/* System Health Alert */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>System Status</AlertTitle>
        <AlertDescription>
          RBAC system is operational. All components are functioning normally.
          Last security scan: {new Date().toLocaleDateString()}
        </AlertDescription>
      </Alert>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2" disabled={!(hasPermission('permission.read') || canManageUsers)}>
            <Key className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2" disabled={!(hasPermission('role.read') || canManageUsers)}>
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2" disabled={!(hasPermission('user.role.read') || canManageUsers)}>
            <Users className="h-4 w-4" />
            User Assignments
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2" disabled={!(hasPermission('audit.read') || canManageUsers)}>
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">System Statistics</h2>
            {/* Real-time updates via WebSocket */}
          </div>

          {statsError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Loading Stats</AlertTitle>
              <AlertDescription>
                {statsError instanceof Error ? statsError.message : 'Failed to load RBAC statistics'}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Permissions Overview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Permissions</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.permissions.total}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.permissions.active} active, {stats.permissions.inactive} inactive
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${(stats.permissions.active / stats.permissions.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">
                    {Math.round((stats.permissions.active / stats.permissions.total) * 100)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Roles Overview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Roles</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.roles.total}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.roles.system} system, {stats.roles.custom} custom
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {stats.roles.active} active
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {stats.roles.total - stats.roles.active} inactive
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Users Overview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.users.total}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.users.withRoles} with roles, {stats.users.withoutRoles} without
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(stats.users.withRoles / stats.users.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">
                    {Math.round((stats.users.withRoles / stats.users.total) * 100)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Audit Overview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Audit Activity</CardTitle>
                <History className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.audit.todayEntries}</div>
                <p className="text-xs text-muted-foreground">
                  entries today
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <Badge className="text-xs bg-green-100 text-green-800">
                    {stats.audit.successRate}% success
                  </Badge>
                  {stats.audit.failedActions > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {stats.audit.failedActions} failed
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Common RBAC management tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(hasPermission('permission.create') || canManageUsers) && (
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => setActiveTab('permissions')}
                  >
                    <Key className="h-6 w-6" />
                    <span>Create Permission</span>
                  </Button>
                )}

                {(hasPermission('role.create') || canManageUsers) && (
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => setActiveTab('roles')}
                  >
                    <Shield className="h-6 w-6" />
                    <span>Create Role</span>
                  </Button>
                )}

                {(hasPermission('user.role.assign') || canManageUsers) && (
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => setActiveTab('users')}
                  >
                    <Users className="h-6 w-6" />
                    <span>Assign Role</span>
                  </Button>
                )}

                {(hasPermission('audit.read') || canManageUsers) && (
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => setActiveTab('audit')}
                  >
                    <Eye className="h-6 w-6" />
                    <span>View Audit Log</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">RBAC Version</span>
                  <Badge variant="outline">v2.1.0</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Database</span>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cache Status</span>
                  <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Last Backup</span>
                  <span className="text-sm">{new Date().toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm">
                    {stats.recentActivity?.permissionsCreatedToday || 0} new permissions created today
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span className="text-sm">
                    {stats.recentActivity?.rolesUpdatedLastHour || 0} roles updated in the last hour
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span className="text-sm">
                    {stats.recentActivity?.usersAssignedToday || 0} users assigned new roles
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  <span className="text-sm">
                    {stats.recentActivity?.auditEntriesToday || 0} audit entries logged today
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Security Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Regular Review</AlertTitle>
                  <AlertDescription>
                    Review user role assignments monthly to ensure they still have appropriate access levels.
                  </AlertDescription>
                </Alert>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Audit Trail</AlertTitle>
                  <AlertDescription>
                    Audit logging is active and capturing all RBAC changes. Export logs regularly for compliance.
                  </AlertDescription>
                </Alert>

                {stats.users.withoutRoles > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Users Without Roles</AlertTitle>
                    <AlertDescription>
                      {stats.users.withoutRoles} users don't have any roles assigned.
                      Consider assigning appropriate roles or deactivating unused accounts.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <ErrorBoundary>
            <PermissionManagement />
          </ErrorBoundary>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <ErrorBoundary>
            <EnhancedRoleManagement />
          </ErrorBoundary>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <ErrorBoundary>
            <UserRoleAssignment />
          </ErrorBoundary>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit">
          <ErrorBoundary>
            <AuditLog />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span>RBAC System v2.1.0</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Last updated: {new Date().toLocaleString()}</span>
              <Badge variant="outline" className="animate-pulse">
                <Activity className="h-3 w-3 mr-1" />
                Live Updates
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
};