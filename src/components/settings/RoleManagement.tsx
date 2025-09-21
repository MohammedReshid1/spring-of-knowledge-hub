import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Users, 
  Plus,
  Edit,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';

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

interface RoleStats {
  role: string;
  count: number;
  permissions: string[];
}

export const RoleManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { 
    isSuperAdmin, 
    isHQAdmin, 
    canManageUsers, 
    canAccessRole, 
    Role, 
    Permission,
    hasPermission 
  } = useRoleAccess();

  // Check if user can access role management
  if (!isSuperAdmin && !isHQAdmin && !canManageUsers) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">You don't have permission to manage roles</p>
        </CardContent>
      </Card>
    );
  }

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get('/users/');
      return response.data;
    },
  });

  const { data: availableRoles } = useQuery<{ available_roles: string[] }>({
    queryKey: ['available-roles'],
    queryFn: async () => {
      const response = await apiClient.get('/users/roles/available');
      return response.data;
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiClient.put(`/users/${userId}`, { role });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "Role Updated",
        description: "User role has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.response?.data?.detail || "Failed to update user role.",
        variant: "destructive",
      });
    },
  });

  // Calculate role statistics
  const roleStats: RoleStats[] = React.useMemo(() => {
    if (!users) return [];
    
    const roleCountMap: Record<string, number> = {};
    users.forEach(user => {
      roleCountMap[user.role] = (roleCountMap[user.role] || 0) + 1;
    });

    return Object.entries(roleCountMap).map(([role, count]) => ({
      role,
      count,
      permissions: getPermissionsForRole(role)
    }));
  }, [users]);

  function getPermissionsForRole(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      [Role.SUPER_ADMIN]: [
        "Full system access",
        "User management", 
        "Branch management",
        "System settings"
      ],
      [Role.HQ_ADMIN]: [
        "Multi-branch access",
        "User management",
        "Financial reports",
        "System analytics"
      ],
      [Role.BRANCH_ADMIN]: [
        "Branch management",
        "Student management", 
        "Teacher management",
        "Branch reports"
      ],
      [Role.HQ_REGISTRAR]: [
        "Student registration",
        "Academic records",
        "Multi-branch access",
        "Data export"
      ],
      [Role.REGISTRAR]: [
        "Student registration",
        "Academic records",
        "Branch-level access"
      ],
      [Role.ADMIN]: [
        "General administration",
        "Student management",
        "Basic reports"
      ],
      [Role.TEACHER]: [
        "Class management",
        "Grade entry",
        "Student communication"
      ],
      [Role.STUDENT]: [
        "View own records",
        "Limited messaging"
      ],
      [Role.PARENT]: [
        "View children's records",
        "Teacher communication",
        "Payment management"
      ]
    };

    return rolePermissions[role] || [];
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      [Role.SUPER_ADMIN]: "bg-red-100 text-red-800",
      [Role.HQ_ADMIN]: "bg-purple-100 text-purple-800", 
      [Role.BRANCH_ADMIN]: "bg-blue-100 text-blue-800",
      [Role.HQ_REGISTRAR]: "bg-indigo-100 text-indigo-800",
      [Role.REGISTRAR]: "bg-green-100 text-green-800",
      [Role.ADMIN]: "bg-yellow-100 text-yellow-800",
      [Role.TEACHER]: "bg-orange-100 text-orange-800",
      [Role.STUDENT]: "bg-gray-100 text-gray-800",
      [Role.PARENT]: "bg-pink-100 text-pink-800"
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  const getRoleHierarchyLevel = (role: string): number => {
    const hierarchy: Record<string, number> = {
      [Role.SUPER_ADMIN]: 100,
      [Role.HQ_ADMIN]: 90,
      [Role.BRANCH_ADMIN]: 80,
      [Role.HQ_REGISTRAR]: 70,
      [Role.REGISTRAR]: 60,
      [Role.ADMIN]: 70,
      [Role.TEACHER]: 50,
      [Role.STUDENT]: 20,
      [Role.PARENT]: 30
    };
    return hierarchy[role] || 0;
  };

  const canModifyUser = (user: User): boolean => {
    // Can only modify users with lower hierarchy level
    const currentUserLevel = isSuperAdmin ? 100 : isHQAdmin ? 90 : 80;
    const targetUserLevel = getRoleHierarchyLevel(user.role);
    return currentUserLevel > targetUserLevel;
  };

  const handleRoleChange = (user: User) => {
    if (!canModifyUser(user)) {
      toast({
        title: "Permission Denied",
        description: "You cannot modify this user's role.",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedUser(user);
    setNewRole(user.role);
    setIsEditDialogOpen(true);
  };

  const handleUpdateRole = () => {
    if (!selectedUser || !newRole) return;
    
    updateUserRoleMutation.mutate({
      userId: selectedUser.id,
      role: newRole
    });
  };

  if (usersLoading) {
    return <div className="text-center py-8">Loading role management...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Role Management</h2>
        <p className="text-muted-foreground">Manage user roles and permissions across the system</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">User Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Role Statistics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roleStats.map((stat) => (
              <Card key={stat.role}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getRoleColor(stat.role)}>
                      {stat.role.replace('_', ' ')}
                    </Badge>
                    <span className="text-2xl font-bold">{stat.count}</span>
                  </div>
                  <div className="space-y-1">
                    {stat.permissions.slice(0, 3).map((permission, index) => (
                      <p key={index} className="text-xs text-muted-foreground">
                        • {permission}
                      </p>
                    ))}
                    {stat.permissions.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{stat.permissions.length - 3} more
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Security Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Admin Users</span>
                    <span className="font-medium">
                      {users?.filter(u => [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.ADMIN].includes(u.role as Role)).length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Regular Users</span>
                    <span className="font-medium">
                      {users?.filter(u => ![Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.ADMIN].includes(u.role as Role)).length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Users</span>
                    <span className="font-medium">{users?.length || 0}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Role-based access enabled</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Permission system active</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Branch isolation enforced</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                User Role Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users?.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h4 className="font-medium">{user.full_name}</h4>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          {user.branch_id && (
                            <p className="text-xs text-muted-foreground">Branch: {user.branch_id}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge className={getRoleColor(user.role)}>
                        {user.role.replace('_', ' ')}
                      </Badge>
                      
                      {canModifyUser(user) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRoleChange(user)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Role
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled>
                          <Shield className="h-4 w-4 mr-1" />
                          Protected
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {Object.values(Role).map((role) => (
              <Card key={role}>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Badge className={getRoleColor(role)}>
                      {role.replace('_', ' ')}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getPermissionsForRole(role).map((permission, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span className="text-sm">{permission}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label>User Information</Label>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="font-medium">{selectedUser.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              
              <div>
                <Label htmlFor="role">New Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles?.available_roles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateRole}
                  disabled={updateUserRoleMutation.isPending || newRole === selectedUser.role}
                >
                  Update Role
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};