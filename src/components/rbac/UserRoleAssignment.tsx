import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useLiveData } from '@/hooks/useLiveData';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import {
  Users,
  UserPlus,
  UserX,
  Search,
  Filter,
  Loader2,
  Shield,
  Crown,
  Calendar,
  MapPin,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Eye,
  Settings
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_active: boolean;
  created_at?: string;
  last_login?: string;
}

interface Role {
  _id?: string;
  name: string;
  display_name: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  priority: number;
  branch_specific: boolean;
}

interface UserRole {
  _id?: string;
  user_id: string;
  role_id: string;
  branch_id?: string;
  granted_by?: string;
  granted_at?: string;
  expires_at?: string;
  is_active: boolean;
}

interface UserRoleFromAPI {
  id: string;
  name: string;
  display_name?: string;
  branch_id?: string;
  granted_at: string;
  granted_by: string;
  is_active: boolean;
  expires_at?: string;
}

interface UserWithRoles {
  user_id: string;
  email: string;
  full_name: string;
  branch_id?: string;
  is_active: boolean;
  roles: UserRoleFromAPI[];
}

interface Branch {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

type SortField = 'full_name' | 'email' | 'roles_count' | 'is_active' | 'last_login' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface UserFilters {
  search: string;
  role: string;
  branch: string;
  status: 'all' | 'active' | 'inactive';
  has_roles: 'all' | 'yes' | 'no';
}

export const UserRoleAssignment: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission, isSuperSuperAdmin } = useRoleAccess();

  // Enable real-time updates via WebSocket
  useLiveData(['users-with-roles', 'roles', 'users', 'user_role_assignments'], {
    enabled: true,
    refetchInterval: 15000 // Refetch every 15 seconds
  });

  // State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    role: '__all__',
    branch: '__all__',
    status: 'all',
    has_roles: 'all'
  });

  // Fetch users with roles
  const {
    data: users = [],
    isLoading: loadingUsers,
    refetch: refetchUsers
  } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const response = await apiClient.get<{users: UserWithRoles[], total: number, skip: number, limit: number}>('/rbac/users-with-roles');
      return response.data?.users || [];
    }
  });

  // Fetch roles
  const { data: roles = [] } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: async () => {
      const response = await apiClient.get<Role[]>('/rbac/roles');
      return response.data || [];
    }
  });

  // Get live user data for modal (updates with WebSocket)
  const liveSelectedUser = useMemo(() => {
    if (!selectedUser) return null;
    return users.find(u => u.user_id === selectedUser.user_id) || selectedUser;
  }, [users, selectedUser]);

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiClient.get<Branch[]>('/branches');
      return response.data || [];
    }
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      roleId: string;
      branchId?: string;
      expiresAt?: string;
    }) => {
      const response = await apiClient.post(`/rbac/users/${data.userId}/roles`, {
        role_id: data.roleId,
        branch_id: data.branchId,
        expires_at: data.expiresAt
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Role Assigned',
        description: 'The role has been assigned to the user successfully.',
      });
      setIsAssignOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign role',
        variant: 'destructive',
      });
    }
  });

  // Revoke role mutation
  const revokeRoleMutation = useMutation({
    mutationFn: async (data: { userId: string; roleId: string; branchId?: string }) => {
      const response = await apiClient.delete(`/rbac/users/${data.userId}/roles/${data.roleId}`, {
        data: { branch_id: data.branchId }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Role Revoked',
        description: 'The role has been revoked from the user successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke role',
        variant: 'destructive',
      });
    }
  });

  // Update role assignment mutation
  const updateRoleAssignmentMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      roleId: string;
      branchId?: string;
      expiresAt?: string;
      isActive: boolean;
    }) => {
      const response = await apiClient.patch(`/rbac/users/${data.userId}/roles/${data.roleId}`, {
        branch_id: data.branchId,
        expires_at: data.expiresAt,
        is_active: data.isActive
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Role Assignment Updated',
        description: 'The role assignment has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role assignment',
        variant: 'destructive',
      });
    }
  });

  // Get unique roles for filtering
  const uniqueRoles = useMemo(() => {
    const roleSet = new Set<string>();
    users.forEach(user => {
      user.roles?.forEach(role => roleSet.add(role.name));
    });
    return Array.from(roleSet).sort();
  }, [users]);

  // Get unique branches for filtering
  const activeBranches = useMemo(() => {
    return branches.filter(b => b.is_active);
  }, [branches]);

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    const filtered = users.filter(user => {
      const matchesSearch = !filters.search ||
        user.full_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.email.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.roles?.some(role => role.name.toLowerCase().includes(filters.search.toLowerCase()));

      const matchesRole = !filters.role || filters.role === '__all__' ||
        user.roles?.some(role => role.name === filters.role);

      const matchesBranch = !filters.branch || filters.branch === '__all__' ||
        user.roles?.some(ur => ur.branch_id === filters.branch);

      const matchesStatus = filters.status === 'all' ||
        (filters.status === 'active' && user.is_active) ||
        (filters.status === 'inactive' && !user.is_active);

      const matchesHasRoles = filters.has_roles === 'all' ||
        (filters.has_roles === 'yes' && user.roles?.length > 0) ||
        (filters.has_roles === 'no' && (!user.roles || user.roles.length === 0));

      return matchesSearch && matchesRole && matchesBranch && matchesStatus && matchesHasRoles;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | number | boolean | Date;
      let bValue: string | number | boolean | Date;

      switch (sortField) {
        case 'full_name':
          aValue = a.full_name;
          bValue = b.full_name;
          break;
        case 'email':
          aValue = a.email;
          bValue = b.email;
          break;
        case 'roles_count':
          aValue = a.roles?.length || 0;
          bValue = b.roles?.length || 0;
          break;
        case 'is_active':
          aValue = a.is_active;
          bValue = b.is_active;
          break;
        case 'last_login':
          aValue = new Date(a.last_login || '1970-01-01');
          bValue = new Date(b.last_login || '1970-01-01');
          break;
        case 'created_at':
          aValue = new Date(a.created_at || '1970-01-01');
          bValue = new Date(b.created_at || '1970-01-01');
          break;
        default:
          aValue = a.full_name;
          bValue = b.full_name;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [users, filters, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      role: '__all__',
      branch: '__all__',
      status: 'all',
      has_roles: 'all'
    });
  };

  // Get user stats
  const userStats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.is_active).length,
      withRoles: users.filter(u => u.roles && u.roles.length > 0).length,
      withoutRoles: users.filter(u => !u.roles || u.roles.length === 0).length,
      systemRoles: users.filter(u => u.roles?.some(userRole => {
        const roleObj = roles.find(r => r.name === userRole.name);
        return roleObj?.is_system;
      })).length,
    };
  }, [users, roles]);

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleInfo = (roleName: string) => {
    return roles.find(r => r.name === roleName);
  };

  const getBranchInfo = (branchId: string) => {
    return branches.find(b => b.id === branchId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            User Role Assignment
          </h2>
          <p className="text-muted-foreground">
            Manage role assignments for system users
          </p>
        </div>
        <div className="flex gap-2">
          {/* Real-time updates via WebSocket */}
          {(hasPermission('user.role.assign') || isSuperSuperAdmin) && (
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setSelectedUser(null)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Assign Role to User</DialogTitle>
                  <DialogDescription>
                    Select a user and assign them a role
                  </DialogDescription>
                </DialogHeader>
                <RoleAssignmentForm
                  users={users}
                  roles={roles.filter(r => r.is_active)}
                  branches={activeBranches}
                  preSelectedUserId={selectedUser?.user_id}
                  onSubmit={(data) => assignRoleMutation.mutate(data)}
                  onCancel={() => {
                    setIsAssignOpen(false);
                    setSelectedUser(null);
                  }}
                  isLoading={assignRoleMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* User Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{userStats.total}</div>
            <div className="text-sm text-muted-foreground">Total Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{userStats.active}</div>
            <div className="text-sm text-muted-foreground">Active Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{userStats.withRoles}</div>
            <div className="text-sm text-muted-foreground">With Roles</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{userStats.withoutRoles}</div>
            <div className="text-sm text-muted-foreground">Without Roles</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{userStats.systemRoles}</div>
            <div className="text-sm text-muted-foreground">System Roles</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search users..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={filters.role}
                onValueChange={(value) => setFilters(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Roles</SelectItem>
                  {uniqueRoles.map(role => (
                    <SelectItem key={role} value={role}>
                      {getRoleInfo(role)?.display_name || role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Branch</Label>
              <Select
                value={filters.branch}
                onValueChange={(value) => setFilters(prev => ({ ...prev, branch: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Branches</SelectItem>
                  {activeBranches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value: 'all' | 'active' | 'inactive') =>
                  setFilters(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Has Roles</Label>
              <Select
                value={filters.has_roles}
                onValueChange={(value: 'all' | 'yes' | 'no') =>
                  setFilters(prev => ({ ...prev, has_roles: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">With Roles</SelectItem>
                  <SelectItem value="no">Without Roles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Users & Role Assignments ({filteredAndSortedUsers.length})</span>
            <Badge variant="outline">
              {filteredAndSortedUsers.filter(u => u.is_active).length} Active
            </Badge>
          </CardTitle>
          <CardDescription>
            Manage role assignments for all system users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('full_name')}
                  >
                    <div className="flex items-center gap-2">
                      User
                      {getSortIcon('full_name')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-2">
                      Email
                      {getSortIcon('email')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('roles_count')}
                  >
                    <div className="flex items-center gap-2">
                      Roles
                      {getSortIcon('roles_count')}
                    </div>
                  </TableHead>
                  <TableHead>Branches</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('is_active')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('is_active')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('last_login')}
                  >
                    <div className="flex items-center gap-2">
                      Last Login
                      {getSortIcon('last_login')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading users...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No users found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url} alt={user.full_name} />
                            <AvatarFallback>
                              {getUserInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.full_name}</div>
                            <div className="text-xs text-muted-foreground">
                              ID: {user.user_id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{user.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {user.roles && user.roles.length > 0 ? (
                            user.roles.slice(0, 3).map((userRole) => {
                              const roleInfo = getRoleInfo(userRole.name);
                              return (
                                <Badge
                                  key={userRole.name}
                                  variant={roleInfo?.is_system ? "secondary" : "default"}
                                  className="text-xs"
                                >
                                  {roleInfo?.display_name || userRole.name}
                                  {roleInfo?.is_system && (
                                    <Crown className="h-3 w-3 ml-1" />
                                  )}
                                </Badge>
                              );
                            })
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              No roles
                            </Badge>
                          )}
                          {user.roles && user.roles.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{user.roles.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles && user.roles.length > 0 ? (
                            [...new Set(user.roles.map(ur => ur.branch_id).filter(Boolean))]
                              .slice(0, 2)
                              .map((branchId) => {
                                const branchInfo = getBranchInfo(branchId!);
                                return (
                                  <Badge key={branchId} variant="outline" className="text-xs">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {branchInfo?.name || branchId}
                                  </Badge>
                                );
                              })
                          ) : null}
                          {user.roles?.some(ur => !ur.branch_id) && (
                            <Badge variant="secondary" className="text-xs">
                              Global
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <Badge variant={user.is_active ? "default" : "secondary"}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_login ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(user.last_login).toLocaleDateString()}
                          </div>
                        ) : (
                          'Never'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsViewOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {(hasPermission('user.role.assign') || isSuperSuperAdmin) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsAssignOpen(true);
                              }}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          )}

                          {(hasPermission('user.role.revoke') || isSuperSuperAdmin) && user.roles && user.roles.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setIsViewOpen(true);
                              }}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Role Details Dialog */}
      {liveSelectedUser && isViewOpen && (
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {liveSelectedUser.full_name} - Role Assignments
              </DialogTitle>
              <DialogDescription>
                Manage role assignments for this user
              </DialogDescription>
            </DialogHeader>
            <UserRoleDetails
              user={liveSelectedUser}
              roles={roles}
              branches={branches}
              onRevokeRole={(roleId, branchId) =>
                revokeRoleMutation.mutate({ userId: liveSelectedUser.user_id, roleId, branchId })
              }
              onUpdateRole={(roleId, data) =>
                updateRoleAssignmentMutation.mutate({ userId: liveSelectedUser.user_id, roleId, ...data })
              }
              onClose={() => {
                setIsViewOpen(false);
                setSelectedUser(null);
              }}
              canRevoke={hasPermission('user.role.revoke') || isSuperSuperAdmin}
              canUpdate={hasPermission('user.role.update') || isSuperSuperAdmin}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Role Assignment Form Component
const RoleAssignmentForm: React.FC<{
  users: UserWithRoles[];
  roles: Role[];
  branches: Branch[];
  preSelectedUserId?: string;
  onSubmit: (data: {
    userId: string;
    roleId: string;
    branchId?: string;
    expiresAt?: string;
  }) => void;
  onCancel: () => void;
  isLoading: boolean;
}> = ({ users, roles, branches, preSelectedUserId, onSubmit, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    userId: preSelectedUserId || '',
    roleId: '',
    branchId: '',
    expiresAt: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update userId when preSelectedUserId changes
  React.useEffect(() => {
    if (preSelectedUserId) {
      setFormData(prev => ({ ...prev, userId: preSelectedUserId }));
    }
  }, [preSelectedUserId]);

  const selectedRole = roles.find(r => r._id === formData.roleId);
  const showBranchSelection = selectedRole?.branch_specific;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.userId) {
      newErrors.userId = 'Please select a user';
    }

    if (!formData.roleId) {
      newErrors.roleId = 'Please select a role';
    }

    if (showBranchSelection && !formData.branchId) {
      newErrors.branchId = 'Please select a branch for this branch-specific role';
    }

    if (formData.expiresAt) {
      const expiryDate = new Date(formData.expiresAt);
      const now = new Date();
      if (expiryDate <= now) {
        newErrors.expiresAt = 'Expiry date must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    onSubmit({
      userId: formData.userId,
      roleId: formData.roleId,
      branchId: formData.branchId || undefined,
      expiresAt: formData.expiresAt || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="userId">Select User *</Label>
        <Select
          value={formData.userId}
          onValueChange={(value) => setFormData({ ...formData, userId: value })}
        >
          <SelectTrigger className={errors.userId ? 'border-destructive' : ''}>
            <SelectValue placeholder="Choose a user..." />
          </SelectTrigger>
          <SelectContent>
            {users.map(user => (
              <SelectItem key={user.user_id} value={user.user_id}>
                <div className="flex items-center gap-2">
                  <span>{user.full_name}</span>
                  <span className="text-muted-foreground">({user.email})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.userId && (
          <p className="text-sm text-destructive">{errors.userId}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="roleId">Select Role *</Label>
        <Select
          value={formData.roleId}
          onValueChange={(value) => setFormData({ ...formData, roleId: value, branchId: '' })}
        >
          <SelectTrigger className={errors.roleId ? 'border-destructive' : ''}>
            <SelectValue placeholder="Choose a role..." />
          </SelectTrigger>
          <SelectContent>
            {roles.map(role => (
              <SelectItem key={role._id} value={role._id!}>
                <div className="flex items-center gap-2">
                  <span>{role.display_name}</span>
                  {role.is_system && <Crown className="h-3 w-3" />}
                  {role.branch_specific && <MapPin className="h-3 w-3" />}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.roleId && (
          <p className="text-sm text-destructive">{errors.roleId}</p>
        )}
      </div>

      {showBranchSelection && (
        <div className="space-y-2">
          <Label htmlFor="branchId">Select Branch *</Label>
          <Select
            value={formData.branchId}
            onValueChange={(value) => setFormData({ ...formData, branchId: value })}
          >
            <SelectTrigger className={errors.branchId ? 'border-destructive' : ''}>
              <SelectValue placeholder="Choose a branch..." />
            </SelectTrigger>
            <SelectContent>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.branchId && (
            <p className="text-sm text-destructive">{errors.branchId}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="expiresAt">Expiry Date (Optional)</Label>
        <Input
          id="expiresAt"
          type="datetime-local"
          value={formData.expiresAt}
          onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
          className={errors.expiresAt ? 'border-destructive' : ''}
        />
        {errors.expiresAt && (
          <p className="text-sm text-destructive">{errors.expiresAt}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Leave empty for permanent assignment
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Assigning...' : 'Assign Role'}
        </Button>
      </DialogFooter>
    </form>
  );
};

// User Role Details Component
const UserRoleDetails: React.FC<{
  user: UserWithRoles;
  roles: Role[];
  branches: Branch[];
  onRevokeRole: (roleId: string, branchId?: string) => void;
  onUpdateRole: (roleId: string, data: {
    branchId?: string;
    expiresAt?: string;
    isActive: boolean;
  }) => void;
  onClose: () => void;
  canRevoke: boolean;
  canUpdate: boolean;
}> = ({ user, roles, branches, onRevokeRole, onUpdateRole, onClose, canRevoke, canUpdate }) => {
  const getRoleInfo = (roleId: string) => {
    return roles.find(r => r._id === roleId);
  };

  const getBranchInfo = (branchId: string) => {
    return branches.find(b => b.id === branchId);
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) <= new Date();
  };

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.avatar_url} alt={user.full_name} />
          <AvatarFallback>
            {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold">{user.full_name}</h3>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="flex items-center gap-2 mt-1">
            {user.is_active ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">{user.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      </div>

      {/* Role Assignments */}
      <div>
        <Label className="text-sm font-medium">
          Role Assignments ({user.roles?.length || 0})
        </Label>
        {user.roles && user.roles.length > 0 ? (
          <ScrollArea className="h-80 border rounded-md p-4 mt-2">
            <div className="space-y-4">
              {user.roles.map((userRole) => {
                const roleInfo = getRoleInfo(userRole.id);
                const branchInfo = userRole.branch_id ? getBranchInfo(userRole.branch_id) : null;
                const expired = isExpired(userRole.expires_at);

                return (
                  <div
                    key={`${userRole.id}-${userRole.branch_id || 'global'}`}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {roleInfo?.display_name || userRole.id}
                        </span>
                        {roleInfo?.is_system && (
                          <Crown className="h-4 w-4 text-amber-500" />
                        )}
                        {!userRole.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {expired && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground mt-1">
                        {branchInfo ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {branchInfo.name}
                          </div>
                        ) : (
                          'Global assignment'
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground mt-1">
                        {userRole.granted_at && (
                          <div>
                            Granted: {new Date(userRole.granted_at).toLocaleDateString()}
                          </div>
                        )}
                        {userRole.expires_at && (
                          <div>
                            Expires: {new Date(userRole.expires_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title={userRole.is_active ? "Deactivate role" : "Activate role"}
                          onClick={() => {
                            // Toggle active status
                            onUpdateRole(userRole.id, {
                              branchId: userRole.branch_id,
                              expiresAt: userRole.expires_at,
                              isActive: !userRole.is_active
                            });
                          }}
                        >
                          {userRole.is_active ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                      )}

                      {canRevoke && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke Role</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to revoke the role "{roleInfo?.display_name}"
                                from {user.full_name}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onRevokeRole(userRole.id, userRole.branch_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Revoke Role
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-md mt-2">
            No roles assigned to this user
          </div>
        )}
      </div>

      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </div>
  );
};