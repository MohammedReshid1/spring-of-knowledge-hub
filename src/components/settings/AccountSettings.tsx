
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Users, User } from 'lucide-react';
import { UserManagement } from './UserManagement';
import { AccountManagement } from './AccountManagement';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRoleAccess } from '@/hooks/useRoleAccess';

export const AccountSettings = () => {
  const [activeTab, setActiveTab] = useState<'account' | 'users'>('account');
  const { isRegistrar } = useRoleAccess();

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
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'account' && <AccountManagement />}
        {activeTab === 'users' && !isRegistrar && <UserManagement />}
      </div>
    </div>
  );
};
