
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Users, User, Database, Shield, ArrowRight } from 'lucide-react';
import { UserManagement } from './UserManagement';
import { AccountManagement } from './AccountManagement';
import { DatabaseCleanup } from './DatabaseCleanup';
import { BackupManagement } from './BackupManagement';
import { GradeTransition } from './GradeTransition';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRoleAccess } from '@/hooks/useRoleAccess';

export const AccountSettings = () => {
  const [activeTab, setActiveTab] = useState<'account' | 'users' | 'cleanup' | 'backup' | 'grade-transition'>('account');
  const { isRegistrar, isSuperAdmin, isAdmin } = useRoleAccess();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Simple Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
        <Button
          variant={activeTab === 'account' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('account')}
          className="flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          Account Management
        </Button>
        {!isRegistrar && (
          <Button
            variant={activeTab === 'users' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('users')}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            User Management
          </Button>
        )}
        {(isSuperAdmin || isAdmin) && (
          <Button
            variant={activeTab === 'grade-transition' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('grade-transition')}
            className="flex items-center gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            Grade Transition
          </Button>
        )}
        {!isRegistrar && (
          <Button
            variant={activeTab === 'backup' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('backup')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <Shield className="h-4 w-4" />
            Backup Management
          </Button>
        )}
        {isSuperAdmin && (
          <Button
            variant={activeTab === 'cleanup' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('cleanup')}
            className="flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <Database className="h-4 w-4" />
            Database Cleanup
          </Button>
        )}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'account' && <AccountManagement />}
        {activeTab === 'users' && !isRegistrar && <UserManagement />}
        {activeTab === 'grade-transition' && (isSuperAdmin || isAdmin) && <GradeTransition />}
        {activeTab === 'backup' && !isRegistrar && <BackupManagement />}
        {activeTab === 'cleanup' && isSuperAdmin && <DatabaseCleanup />}
      </div>
    </div>
  );
};
