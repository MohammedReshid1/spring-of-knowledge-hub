import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useLiveData } from '@/hooks/useLiveData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Key,
  Settings,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Crown,
  Layers
} from 'lucide-react';

interface Permission {
  _id?: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  is_active: boolean;
}

interface Role {
  _id?: string;
  name: string;
  display_name: string;
  description?: string;
  permissions: (string | Permission)[]; // Can be either IDs/names or full Permission objects
  inherits_from: string[];
  is_system: boolean;
  is_active: boolean;
  priority: number;
  branch_specific: boolean;
  created_at?: string;
  updated_at?: string;
}

type SortField = 'display_name' | 'name' | 'priority' | 'permissions_count' | 'is_active' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface RoleFilters {
  search: string;
  type: 'all' | 'system' | 'custom';
  status: 'all' | 'active' | 'inactive';
  branch_specific: 'all' | 'yes' | 'no';
  has_inheritance: 'all' | 'yes' | 'no';
}

export const EnhancedRoleManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission, isSuperSuperAdmin } = useRoleAccess();

  // Enable real-time updates via WebSocket
  useLiveData(['rbac-roles', 'roles', 'rbac-permissions']);

  // State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [sortField, setSortField] = useState<SortField>('display_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filters, setFilters] = useState<RoleFilters>({
    search: '',
    type: 'all',
    status: 'all',
    branch_specific: 'all',
    has_inheritance: 'all'
  });

  // Fetch roles
  const {
    data: roles = [],
    isLoading: loadingRoles,
    refetch: refetchRoles
  } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: async () => {
      const response = await apiClient.get<Role[]>('/rbac/roles');
      return response.data || [];
    }
  });

  // Fetch permissions
  const { data: permissions = [] } = useQuery({
    queryKey: ['rbac-permissions'],
    queryFn: async () => {
      const response = await apiClient.get<Permission[]>('/rbac/permissions');
      return response.data || [];
    }
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (roleData: Omit<Role, '_id' | 'created_at' | 'updated_at'>) => {
      const response = await apiClient.post('/rbac/roles', roleData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      toast({
        title: 'Role Created',
        description: 'The new role has been created successfully.',
      });
      setIsCreateOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create role',
        variant: 'destructive',
      });
    }
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Role> }) => {
      const response = await apiClient.put(`/rbac/roles/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      toast({
        title: 'Role Updated',
        description: 'The role has been updated successfully.',
      });
      setIsEditOpen(false);
      setSelectedRole(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    }
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const response = await apiClient.delete(`/rbac/roles/${roleId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      toast({
        title: 'Role Deleted',
        description: 'The role has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete role',
        variant: 'destructive',
      });
    }
  });

  // Toggle role status mutation
  const toggleRoleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const response = await apiClient.patch(`/rbac/roles/${id}`, { is_active });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      toast({
        title: 'Role Status Updated',
        description: 'The role status has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role status',
        variant: 'destructive',
      });
    }
  });

  // Duplicate role mutation
  const duplicateRoleMutation = useMutation({
    mutationFn: async (sourceRole: Role) => {
      const duplicatedRole = {
        name: `${sourceRole.name}_copy`,
        display_name: `${sourceRole.display_name} (Copy)`,
        description: sourceRole.description,
        permissions: [...sourceRole.permissions],
        inherits_from: [...sourceRole.inherits_from],
        is_system: false,
        is_active: true,
        priority: sourceRole.priority,
        branch_specific: sourceRole.branch_specific,
      };
      const response = await apiClient.post('/rbac/roles', duplicatedRole);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      toast({
        title: 'Role Duplicated',
        description: 'The role has been duplicated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate role',
        variant: 'destructive',
      });
    }
  });

  // Group permissions by resource
  const groupedPermissions = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach(perm => {
      if (!grouped[perm.resource]) {
        grouped[perm.resource] = [];
      }
      grouped[perm.resource].push(perm);
    });
    return grouped;
  }, [permissions]);

  // Filter and sort roles
  const filteredAndSortedRoles = useMemo(() => {
    const filtered = roles.filter(role => {
      const matchesSearch = !filters.search ||
        role.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        role.display_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        role.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
        role.permissions.some(p => p.toLowerCase().includes(filters.search.toLowerCase()));

      const matchesType = filters.type === 'all' ||
        (filters.type === 'system' && role.is_system) ||
        (filters.type === 'custom' && !role.is_system);

      const matchesStatus = filters.status === 'all' ||
        (filters.status === 'active' && role.is_active) ||
        (filters.status === 'inactive' && !role.is_active);

      const matchesBranchSpecific = filters.branch_specific === 'all' ||
        (filters.branch_specific === 'yes' && role.branch_specific) ||
        (filters.branch_specific === 'no' && !role.branch_specific);

      const matchesInheritance = filters.has_inheritance === 'all' ||
        (filters.has_inheritance === 'yes' && role.inherits_from.length > 0) ||
        (filters.has_inheritance === 'no' && role.inherits_from.length === 0);

      return matchesSearch && matchesType && matchesStatus && matchesBranchSpecific && matchesInheritance;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | number | boolean | Date;
      let bValue: string | number | boolean | Date;

      switch (sortField) {
        case 'display_name':
          aValue = a.display_name;
          bValue = b.display_name;
          break;
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'priority':
          aValue = a.priority;
          bValue = b.priority;
          break;
        case 'permissions_count':
          aValue = a.permissions.length;
          bValue = b.permissions.length;
          break;
        case 'is_active':
          aValue = a.is_active;
          bValue = b.is_active;
          break;
        case 'created_at':
          aValue = new Date(a.created_at || '');
          bValue = new Date(b.created_at || '');
          break;
        default:
          aValue = a.display_name;
          bValue = b.display_name;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [roles, filters, sortField, sortDirection]);

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
      type: 'all',
      status: 'all',
      branch_specific: 'all',
      has_inheritance: 'all'
    });
  };

  // Get role stats
  const roleStats = useMemo(() => {
    return {
      total: roles.length,
      active: roles.filter(r => r.is_active).length,
      system: roles.filter(r => r.is_system).length,
      custom: roles.filter(r => !r.is_system).length,
      branchSpecific: roles.filter(r => r.branch_specific).length,
      withInheritance: roles.filter(r => r.inherits_from.length > 0).length,
    };
  }, [roles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Role Management
          </h2>
          <p className="text-muted-foreground">
            Create, modify, and manage system roles and their permissions
          </p>
        </div>
        <div className="flex gap-2">
          {/* Real-time updates via WebSocket */}
          {(hasPermission('role.create') || isSuperSuperAdmin) && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Role</DialogTitle>
                  <DialogDescription>
                    Define a new role with specific permissions and inheritance
                  </DialogDescription>
                </DialogHeader>
                <RoleForm
                  permissions={groupedPermissions}
                  existingRoles={roles}
                  onSubmit={(data) => createRoleMutation.mutate(data)}
                  onCancel={() => setIsCreateOpen(false)}
                  isLoading={createRoleMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Role Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{roleStats.total}</div>
            <div className="text-sm text-muted-foreground">Total Roles</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{roleStats.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{roleStats.system}</div>
            <div className="text-sm text-muted-foreground">System</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{roleStats.custom}</div>
            <div className="text-sm text-muted-foreground">Custom</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{roleStats.branchSpecific}</div>
            <div className="text-sm text-muted-foreground">Branch Specific</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-indigo-600">{roleStats.withInheritance}</div>
            <div className="text-sm text-muted-foreground">With Inheritance</div>
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
                  placeholder="Search roles..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={filters.type}
                onValueChange={(value: 'all' | 'system' | 'custom') =>
                  setFilters(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="system">System Roles</SelectItem>
                  <SelectItem value="custom">Custom Roles</SelectItem>
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
              <Label>Branch Specific</Label>
              <Select
                value={filters.branch_specific}
                onValueChange={(value: 'all' | 'yes' | 'no') =>
                  setFilters(prev => ({ ...prev, branch_specific: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Branch Specific</SelectItem>
                  <SelectItem value="no">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Inheritance</Label>
              <Select
                value={filters.has_inheritance}
                onValueChange={(value: 'all' | 'yes' | 'no') =>
                  setFilters(prev => ({ ...prev, has_inheritance: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">With Inheritance</SelectItem>
                  <SelectItem value="no">Root Roles</SelectItem>
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

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>System Roles ({filteredAndSortedRoles.length})</span>
            <div className="flex gap-2">
              <Badge variant="outline">
                {filteredAndSortedRoles.filter(r => r.is_active).length} Active
              </Badge>
              <Badge variant="secondary">
                {filteredAndSortedRoles.filter(r => r.is_system).length} System
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            All system roles with their permissions and inheritance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('display_name')}
                  >
                    <div className="flex items-center gap-2">
                      Role Name
                      {getSortIcon('display_name')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Identifier
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center gap-2">
                      Priority
                      {getSortIcon('priority')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('permissions_count')}
                  >
                    <div className="flex items-center gap-2">
                      Permissions
                      {getSortIcon('permissions_count')}
                    </div>
                  </TableHead>
                  <TableHead>Inheritance</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('is_active')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('is_active')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingRoles ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading roles...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No roles found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedRoles.map((role) => (
                    <TableRow key={role._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <div>
                            <div className="font-medium">{role.display_name}</div>
                            {role.description && (
                              <div className="text-xs text-muted-foreground max-w-xs truncate">
                                {role.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {role.name}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {role.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{role.permissions.length}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRole(role);
                              setIsViewOpen(true);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {role.inherits_from.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <Layers className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">{role.inherits_from.length}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Crown className="h-4 w-4" />
                            <span className="text-sm">Root</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {role.is_system && (
                            <Badge variant="secondary" className="text-xs">System</Badge>
                          )}
                          {role.branch_specific && (
                            <Badge variant="outline" className="text-xs">Branch</Badge>
                          )}
                          {!role.is_system && !role.branch_specific && (
                            <Badge variant="default" className="text-xs">Global</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {role.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <Badge variant={role.is_active ? "default" : "secondary"}>
                            {role.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRole(role);
                              setIsViewOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {(hasPermission('role.create') || isSuperSuperAdmin) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => duplicateRoleMutation.mutate(role)}
                              disabled={duplicateRoleMutation.isPending}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}

                          {(hasPermission('role.update') || isSuperSuperAdmin) && (!role.is_system || isSuperSuperAdmin) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedRole(role);
                                setIsEditOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}

                          {(hasPermission('role.update') || isSuperSuperAdmin) && (!role.is_system || isSuperSuperAdmin) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRoleMutation.mutate({
                                id: role._id!,
                                is_active: !role.is_active
                              })}
                              disabled={toggleRoleMutation.isPending}
                            >
                              {role.is_active ? (
                                <Lock className="h-4 w-4" />
                              ) : (
                                <Unlock className="h-4 w-4" />
                              )}
                            </Button>
                          )}

                          {(hasPermission('role.delete') || isSuperSuperAdmin) && (!role.is_system || isSuperSuperAdmin) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the role "{role.display_name}"?
                                    This action cannot be undone and may affect users assigned to this role.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteRoleMutation.mutate(role._id!)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Role
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

      {/* Edit Role Dialog */}
      {selectedRole && isEditOpen && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Role</DialogTitle>
              <DialogDescription>
                Modify role permissions and settings
              </DialogDescription>
            </DialogHeader>
            <RoleForm
              role={selectedRole}
              permissions={groupedPermissions}
              existingRoles={roles}
              onSubmit={(data) => updateRoleMutation.mutate({ id: selectedRole._id!, data })}
              onCancel={() => {
                setIsEditOpen(false);
                setSelectedRole(null);
              }}
              isLoading={updateRoleMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* View Role Dialog */}
      {selectedRole && isViewOpen && (
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {selectedRole.display_name}
              </DialogTitle>
              <DialogDescription>
                Role details and permissions
              </DialogDescription>
            </DialogHeader>
            <RoleDetails
              role={selectedRole}
              permissions={permissions}
              onClose={() => {
                setIsViewOpen(false);
                setSelectedRole(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Role Form Component (Same as in DynamicRoleManagement but enhanced)
const RoleForm: React.FC<{
  role?: Role;
  permissions: Record<string, Permission[]>;
  existingRoles: Role[];
  onSubmit: (data: Omit<Role, '_id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  isLoading: boolean;
}> = ({ role, permissions, existingRoles, onSubmit, onCancel, isLoading }) => {
  // Normalize permissions to names (handles both string[] and Permission[] formats)
  const normalizePermissions = (perms: (string | Permission)[] | undefined): string[] => {
    if (!perms) return [];
    return perms.map(p => typeof p === 'string' ? p : p.name);
  };

  const [formData, setFormData] = useState({
    name: role?.name || '',
    display_name: role?.display_name || '',
    description: role?.description || '',
    permissions: normalizePermissions(role?.permissions),
    inherits_from: role?.inherits_from || [],
    priority: role?.priority || 50,
    branch_specific: role?.branch_specific || false,
    is_active: role?.is_active ?? true,
    is_system: role?.is_system || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Role name is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.name)) {
      newErrors.name = 'Role name must be lowercase and can contain letters, numbers, and underscores';
    }

    if (!formData.display_name.trim()) {
      newErrors.display_name = 'Display name is required';
    }

    if (formData.priority < 1 || formData.priority > 100) {
      newErrors.priority = 'Priority must be between 1 and 100';
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
      name: formData.name.trim(),
      display_name: formData.display_name.trim(),
      description: formData.description.trim() || undefined,
      permissions: formData.permissions,
      inherits_from: formData.inherits_from,
      priority: formData.priority,
      branch_specific: formData.branch_specific,
      is_active: formData.is_active,
      is_system: formData.is_system,
    });
  };

  const togglePermission = (permName: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permName)
        ? prev.permissions.filter(p => p !== permName)
        : [...prev.permissions, permName]
    }));
  };

  const toggleInheritance = (roleName: string) => {
    setFormData(prev => ({
      ...prev,
      inherits_from: prev.inherits_from.includes(roleName)
        ? prev.inherits_from.filter(r => r !== roleName)
        : [...prev.inherits_from, roleName]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Role Name (ID) *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., branch_admin"
            disabled={!!role}
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name *</Label>
          <Input
            id="display_name"
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="e.g., Branch Administrator"
            className={errors.display_name ? 'border-destructive' : ''}
          />
          {errors.display_name && (
            <p className="text-sm text-destructive">{errors.display_name}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the role's purpose and responsibilities"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority (1-100) *</Label>
          <Input
            id="priority"
            type="number"
            min="1"
            max="100"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })}
            className={errors.priority ? 'border-destructive' : ''}
          />
          {errors.priority && (
            <p className="text-sm text-destructive">{errors.priority}</p>
          )}
        </div>
        <div className="flex items-center space-x-2 pt-8">
          <Switch
            id="branch_specific"
            checked={formData.branch_specific}
            onCheckedChange={(checked) => setFormData({ ...formData, branch_specific: checked })}
          />
          <Label htmlFor="branch_specific">Branch Specific</Label>
        </div>
        <div className="flex items-center space-x-2 pt-8">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>
      </div>

      {/* Role Inheritance */}
      <div className="space-y-2">
        <Label>Inherit From Roles</Label>
        <div className="border rounded-md p-4 max-h-32 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {existingRoles
              .filter(r => r.name !== formData.name)
              .map(r => (
                <div key={r.name} className="flex items-center space-x-2">
                  <Checkbox
                    id={`inherit_${r.name}`}
                    checked={formData.inherits_from.includes(r.name)}
                    onCheckedChange={() => toggleInheritance(r.name)}
                  />
                  <Label
                    htmlFor={`inherit_${r.name}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {r.display_name}
                  </Label>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div className="space-y-2">
        <Label>Permissions</Label>
        <ScrollArea className="h-80 border rounded-md p-4">
          <div className="space-y-6">
            {Object.entries(permissions).map(([resource, perms]) => (
              <div key={resource} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm capitalize flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    {resource.replace(/_/g, ' ')}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {perms.filter(p => formData.permissions.includes(p.name)).length}/{perms.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 pl-6">
                  {perms.map((perm) => (
                    <div key={perm.name} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.name}
                        checked={formData.permissions.includes(perm.name)}
                        onCheckedChange={() => togglePermission(perm.name)}
                        disabled={!perm.is_active}
                      />
                      <Label
                        htmlFor={perm.name}
                        className={`text-sm font-normal cursor-pointer ${
                          !perm.is_active ? 'text-muted-foreground line-through' : ''
                        }`}
                      >
                        {perm.name}
                      </Label>
                      {perm.description && (
                        <div className="text-xs text-muted-foreground">
                          {perm.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Separator />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : role ? 'Update Role' : 'Create Role'}
        </Button>
      </DialogFooter>
    </form>
  );
};

// Role Details Component
const RoleDetails: React.FC<{
  role: Role;
  permissions: Permission[];
  onClose: () => void;
}> = ({ role, permissions, onClose }) => {
  // Handle both expanded permissions (objects) and permission IDs/names (strings)
  const rolePermissions = role.permissions
    .map(p => {
      // If it's already a Permission object, return it
      if (typeof p === 'object' && p !== null) return p as Permission;
      // If it's a string (ID or name), find the matching permission
      return permissions.find(perm => perm._id === p || perm.name === p);
    })
    .filter((p): p is Permission => p !== undefined);

  const groupedPerms = rolePermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="space-y-6">
      {/* Role Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Role Name</Label>
          <p className="text-sm">{role.display_name}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Identifier</Label>
          <code className="text-sm bg-muted px-2 py-1 rounded">{role.name}</code>
        </div>
        <div>
          <Label className="text-sm font-medium">Priority</Label>
          <p className="text-sm">{role.priority}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Status</Label>
          <Badge variant={role.is_active ? "default" : "secondary"}>
            {role.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {role.description && (
        <div>
          <Label className="text-sm font-medium">Description</Label>
          <p className="text-sm text-muted-foreground">{role.description}</p>
        </div>
      )}

      {/* Role Properties */}
      <div className="flex gap-2">
        {role.is_system && (
          <Badge variant="secondary">System Role</Badge>
        )}
        {role.branch_specific && (
          <Badge variant="outline">Branch Specific</Badge>
        )}
        {role.inherits_from.length > 0 && (
          <Badge variant="default">Has Inheritance</Badge>
        )}
      </div>

      {/* Inheritance */}
      {role.inherits_from.length > 0 && (
        <div>
          <Label className="text-sm font-medium">Inherits From</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {role.inherits_from.map(parentRole => (
              <Badge key={parentRole} variant="secondary">
                {parentRole}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Permissions */}
      <div>
        <Label className="text-sm font-medium">
          Permissions ({rolePermissions.length})
        </Label>
        <ScrollArea className="h-60 border rounded-md p-4 mt-2">
          <div className="space-y-4">
            {Object.entries(groupedPerms).map(([resource, perms]) => (
              <div key={resource} className="space-y-2">
                <h4 className="font-medium text-sm capitalize flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {resource.replace(/_/g, ' ')}
                  <Badge variant="outline" className="text-xs">
                    {perms.length}
                  </Badge>
                </h4>
                <div className="grid grid-cols-2 gap-2 pl-6">
                  {perms.map((perm) => (
                    <div key={perm.name} className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-sm">{perm.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </div>
  );
};