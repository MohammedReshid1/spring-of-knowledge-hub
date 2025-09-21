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
  Building
} from 'lucide-react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Import existing components
import { BackupManagement } from './BackupManagement';
import { DatabaseCleanup } from './DatabaseCleanup';
import { GradeTransition } from './GradeTransition';
import { RoleManagement } from './RoleManagement';
import { AccountManagement } from './AccountManagement';
import { BranchManagement } from '@/components/branches/BranchManagement';
import { SystemMonitoring } from './SystemMonitoring';

type AdminTab =
  | 'overview'
  | 'branches'
  | 'account'
  | 'roles'
  | 'monitoring'
  | 'grade-transition'
  | 'backup'
  | 'cleanup';

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
  const { isSuperAdmin, isAdmin, isHQAdmin, canManageUsers } = useRoleAccess();

  // System statistics query
  const { data: systemStats, isLoading: statsLoading } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async (): Promise<SystemStats> => {
      try {
        // Integrate with backend dashboard stats
        const [dashboardResp, backupsResp, usersResp] = await Promise.all([
          apiClient.getDashboardStats(),
          apiClient.getBackupLogs(),
          apiClient.getUsers(),
        ]);

        const overview = dashboardResp.data?.data?.overview || {};
        const system = dashboardResp.data?.data?.system || {};

        const totalUsers = usersResp.data?.length || 0;
        const totalBranches = overview.total_branches || 0;
        const totalStudents = overview.total_students || 0;
        const totalClasses = overview.total_classes || 0;

        const recentBackups = (backupsResp.data || []).filter((backup: any) => {
          const backupDate = new Date(backup.started_at);
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return backupDate >= oneWeekAgo;
        }).length || 0;

        // Health check based on backend status + backups
        let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
        const dbHealthy = system.database_status === 'connected';
        if (!dbHealthy) systemHealth = 'critical';
        else if (recentBackups === 0) systemHealth = 'warning';

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
  if (!isAdmin && !isSuperAdmin && !isHQAdmin) {
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

  const tabButtons = [
    { id: 'overview' as AdminTab, label: 'System Overview', icon: Activity, adminOnly: false },
    { id: 'branches' as AdminTab, label: 'Branch Management', icon: Building, adminOnly: false },
    { id: 'account' as AdminTab, label: 'Account Management', icon: User, adminOnly: false },
    { id: 'roles' as AdminTab, label: 'Role Management', icon: Shield, adminOnly: false },
    { id: 'monitoring' as AdminTab, label: 'System Monitoring', icon: Monitor, adminOnly: false },
    { id: 'grade-transition' as AdminTab, label: 'Grade Transition', icon: ArrowRight, adminOnly: false },
    { id: 'backup' as AdminTab, label: 'Backup Management', icon: Database, adminOnly: false },
    { id: 'cleanup' as AdminTab, label: 'Database Cleanup', icon: HardDrive, superAdminOnly: true }
  ];

  const filteredTabs = tabButtons.filter(tab => {
    if (tab.superAdminOnly && !isSuperAdmin) return false;
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold">{systemStats?.totalUsers || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Branches</p>
                <p className="text-2xl font-bold">{systemStats?.totalBranches || 0}</p>
              </div>
              <Building className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl font-bold">{systemStats?.totalStudents || 0}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Classes</p>
                <p className="text-2xl font-bold">{systemStats?.totalClasses || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Overall Status:</span>
              {systemStats ? getHealthBadge(systemStats.systemHealth) : <Badge variant="outline">Loading...</Badge>}
            </div>
            <div className="text-sm text-gray-600">
              Recent backups: {systemStats?.recentBackups || 0} (last 7 days)
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Common administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            <Button
              variant="outline"
              onClick={() => setActiveTab('branches')}
              className="flex items-center gap-2 h-auto p-4"
            >
              <Building className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Manage Branches</div>
                <div className="text-xs text-gray-600">Create and configure branches</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => setActiveTab('account')}
              className="flex items-center gap-2 h-auto p-4"
            >
              <User className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Account Management</div>
                <div className="text-xs text-gray-600">Update account credentials & preferences</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => setActiveTab('backup')}
              className="flex items-center gap-2 h-auto p-4"
            >
              <Database className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Backup Data</div>
                <div className="text-xs text-gray-600">Create and manage backups</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => setActiveTab('roles')}
              className="flex items-center gap-2 h-auto p-4"
            >
              <Shield className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Role Management</div>
                <div className="text-xs text-gray-600">Manage user permissions</div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => setActiveTab('monitoring')}
              className="flex items-center gap-2 h-auto p-4"
            >
              <Monitor className="h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">System Monitor</div>
                <div className="text-xs text-gray-600">View system performance</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-6 w-6" />
        <h1 className="text-2xl font-bold">System Administration</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
        {filteredTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 whitespace-nowrap"
              size="sm"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      <Separator />

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && <SystemOverview />}
        {activeTab === 'account' && <AccountManagement />}
        {activeTab === 'branches' && <BranchManagement />}
        {activeTab === 'roles' && canManageUsers && <RoleManagement />}
        {activeTab === 'monitoring' && <SystemMonitoring />}
        {activeTab === 'grade-transition' && <GradeTransition />}
        {activeTab === 'backup' && <BackupManagement />}
        {activeTab === 'cleanup' && isSuperAdmin && <DatabaseCleanup />}
      </div>
    </div>
  );
};
