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
import { useToast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { useRoleAccess as useRoleAccessHook } from '@/contexts/RoleAccessContext';
import {
  Key,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Shield,
  Settings,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Loader2
} from 'lucide-react';

interface Permission {
  _id?: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

type SortField = 'name' | 'resource' | 'action' | 'is_active' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface PermissionFilters {
  search: string;
  resource: string;
  action: string;
  status: 'all' | 'active' | 'inactive';
}

export const PermissionManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission } = useRoleAccess();
  const { isSuperSuperAdmin } = useRoleAccessHook();

  // Enable real-time updates via WebSocket
  useLiveData(['rbac-permissions', 'permissions']);

  // Check for permission management capabilities
  const canManagePermissions = hasPermission('system.manage_permissions') || isSuperSuperAdmin;
  const canViewPermissions = hasPermission('system.view_permissions') || canManagePermissions;

  // Permission checks logged for debugging

  // State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filters, setFilters] = useState<PermissionFilters>({
    search: '',
    resource: '__all__',
    action: '__all__',
    status: 'all'
  });

  // Fetch permissions
  const {
    data: permissions = [],
    isLoading: loadingPermissions,
    refetch: refetchPermissions
  } = useQuery({
    queryKey: ['rbac-permissions'],
    queryFn: async () => {
      const response = await apiClient.get<Permission[]>('/rbac/permissions');
      return response.data || [];
    }
  });

  // Create permission mutation
  const createPermissionMutation = useMutation({
    mutationFn: async (permissionData: Omit<Permission, '_id' | 'created_at' | 'updated_at'>) => {
      const response = await apiClient.post('/rbac/permissions', permissionData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
      toast({
        title: 'Permission Created',
        description: 'The new permission has been created successfully.',
      });
      setIsCreateOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create permission',
        variant: 'destructive',
      });
    }
  });

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Permission> }) => {
      const response = await apiClient.put(`/rbac/permissions/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
      toast({
        title: 'Permission Updated',
        description: 'The permission has been updated successfully.',
      });
      setIsEditOpen(false);
      setSelectedPermission(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update permission',
        variant: 'destructive',
      });
    }
  });

  // Delete permission mutation
  const deletePermissionMutation = useMutation({
    mutationFn: async (permissionId: string) => {
      const response = await apiClient.delete(`/rbac/permissions/${permissionId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
      toast({
        title: 'Permission Deleted',
        description: 'The permission has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete permission',
        variant: 'destructive',
      });
    }
  });

  // Toggle permission status mutation
  const togglePermissionMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const response = await apiClient.patch(`/rbac/permissions/${id}`, { is_active });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
      toast({
        title: 'Permission Status Updated',
        description: 'The permission status has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update permission status',
        variant: 'destructive',
      });
    }
  });

  // Get unique values for filters
  const uniqueResources = useMemo(() => {
    const resources = [...new Set(permissions.map(p => p.resource))];
    return resources.sort();
  }, [permissions]);

  const uniqueActions = useMemo(() => {
    const actions = [...new Set(permissions.map(p => p.action))];
    return actions.sort();
  }, [permissions]);

  // Filter and sort permissions
  const filteredAndSortedPermissions = useMemo(() => {
    const filtered = permissions.filter(permission => {
      const matchesSearch = !filters.search ||
        permission.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        permission.resource.toLowerCase().includes(filters.search.toLowerCase()) ||
        permission.action.toLowerCase().includes(filters.search.toLowerCase()) ||
        permission.description?.toLowerCase().includes(filters.search.toLowerCase());

      const matchesResource = !filters.resource || filters.resource === '__all__' || permission.resource === filters.resource;
      const matchesAction = !filters.action || filters.action === '__all__' || permission.action === filters.action;

      const matchesStatus = filters.status === 'all' ||
        (filters.status === 'active' && permission.is_active) ||
        (filters.status === 'inactive' && !permission.is_active);

      return matchesSearch && matchesResource && matchesAction && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | boolean | Date;
      let bValue: string | boolean | Date;

      switch (sortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'resource':
          aValue = a.resource;
          bValue = b.resource;
          break;
        case 'action':
          aValue = a.action;
          bValue = b.action;
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
          aValue = a.name;
          bValue = b.name;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [permissions, filters, sortField, sortDirection]);

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
      resource: '__all__',
      action: '__all__',
      status: 'all'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6" />
            Permission Management
          </h2>
          <p className="text-muted-foreground">
            Create, modify, and manage system permissions
          </p>
        </div>
        <div className="flex gap-2">
          {/* Real-time updates via WebSocket */}
          {canManagePermissions && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Permission
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Permission</DialogTitle>
                  <DialogDescription>
                    Define a new permission for the system
                  </DialogDescription>
                </DialogHeader>
                <PermissionForm
                  onSubmit={(data) => createPermissionMutation.mutate(data)}
                  onCancel={() => setIsCreateOpen(false)}
                  isLoading={createPermissionMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search permissions..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Resource</Label>
              <Select
                value={filters.resource}
                onValueChange={(value) => setFilters(prev => ({ ...prev, resource: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Resources</SelectItem>
                  {uniqueResources.map(resource => (
                    <SelectItem key={resource} value={resource}>
                      {resource.charAt(0).toUpperCase() + resource.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={filters.action}
                onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Actions</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action}>
                      {action.charAt(0).toUpperCase() + action.slice(1)}
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

            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permissions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>System Permissions ({filteredAndSortedPermissions.length})</span>
            <Badge variant="outline">
              {filteredAndSortedPermissions.filter(p => p.is_active).length} Active
            </Badge>
          </CardTitle>
          <CardDescription>
            All system permissions with their resources and actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Permission Name
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('resource')}
                  >
                    <div className="flex items-center gap-2">
                      Resource
                      {getSortIcon('resource')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('action')}
                  >
                    <div className="flex items-center gap-2">
                      Action
                      {getSortIcon('action')}
                    </div>
                  </TableHead>
                  <TableHead>Description</TableHead>
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
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-2">
                      Created
                      {getSortIcon('created_at')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPermissions ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading permissions...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedPermissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No permissions found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedPermissions.map((permission) => (
                    <TableRow key={permission._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-primary" />
                          {permission.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {permission.resource}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {permission.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-muted-foreground truncate">
                          {permission.description || 'No description'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {permission.is_active ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <Badge variant={permission.is_active ? "default" : "secondary"}>
                            {permission.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {permission.created_at
                          ? new Date(permission.created_at).toLocaleDateString()
                          : 'Unknown'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {canManagePermissions && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPermission(permission);
                                setIsEditOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}

                          {canManagePermissions && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePermissionMutation.mutate({
                                id: permission._id!,
                                is_active: !permission.is_active
                              })}
                              disabled={togglePermissionMutation.isPending}
                            >
                              {permission.is_active ? (
                                <Lock className="h-4 w-4" />
                              ) : (
                                <Unlock className="h-4 w-4" />
                              )}
                            </Button>
                          )}

                          {canManagePermissions && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Permission</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the permission "{permission.name}"?
                                    This action cannot be undone and may affect roles that use this permission.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deletePermissionMutation.mutate(permission._id!)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Permission
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

      {/* Edit Permission Dialog */}
      {selectedPermission && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Permission</DialogTitle>
              <DialogDescription>
                Modify the permission details
              </DialogDescription>
            </DialogHeader>
            <PermissionForm
              permission={selectedPermission}
              onSubmit={(data) => updatePermissionMutation.mutate({
                id: selectedPermission._id!,
                data
              })}
              onCancel={() => {
                setIsEditOpen(false);
                setSelectedPermission(null);
              }}
              isLoading={updatePermissionMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Permission Form Component
const PermissionForm: React.FC<{
  permission?: Permission;
  onSubmit: (data: Omit<Permission, '_id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  isLoading: boolean;
}> = ({ permission, onSubmit, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    name: permission?.name || '',
    resource: permission?.resource || '',
    action: permission?.action || '',
    description: permission?.description || '',
    is_active: permission?.is_active ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Permission name is required';
    } else if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(formData.name)) {
      newErrors.name = 'Permission name must be lowercase, start with a letter, and can contain letters, numbers, underscores, and dots';
    }

    if (!formData.resource.trim()) {
      newErrors.resource = 'Resource is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.resource)) {
      newErrors.resource = 'Resource must be lowercase and can contain letters, numbers, and underscores';
    }

    if (!formData.action.trim()) {
      newErrors.action = 'Action is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.action)) {
      newErrors.action = 'Action must be lowercase and can contain letters, numbers, and underscores';
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
      resource: formData.resource.trim(),
      action: formData.action.trim(),
      description: formData.description.trim() || undefined,
      is_active: formData.is_active,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Permission Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., user.create, role.update"
          disabled={!!permission}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Use dot notation (e.g., user.create, role.update)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resource">Resource *</Label>
        <Input
          id="resource"
          value={formData.resource}
          onChange={(e) => setFormData({ ...formData, resource: e.target.value })}
          placeholder="e.g., user, role, student, class"
          className={errors.resource ? 'border-destructive' : ''}
        />
        {errors.resource && (
          <p className="text-sm text-destructive">{errors.resource}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="action">Action *</Label>
        <Input
          id="action"
          value={formData.action}
          onChange={(e) => setFormData({ ...formData, action: e.target.value })}
          placeholder="e.g., create, read, update, delete"
          className={errors.action ? 'border-destructive' : ''}
        />
        {errors.action && (
          <p className="text-sm text-destructive">{errors.action}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe what this permission allows..."
          rows={3}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : permission ? 'Update Permission' : 'Create Permission'}
        </Button>
      </DialogFooter>
    </form>
  );
};