import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useLiveData } from '@/hooks/useLiveData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import {
  History,
  Search,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  User,
  Shield,
  Key,
  Users,
  Settings,
  Info,
  Download,
  Eye,
  Clock,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Activity,
  Database,
  Lock,
  Unlock,
  UserPlus,
  UserX,
  Edit,
  Trash2,
  Plus
} from 'lucide-react';

interface AuditEntry {
  id: string;
  timestamp: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  action: string;
  resource?: string | null;
  resource_id?: string | null;
  resource_name?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string | null;
  session_id?: string;
  request_id?: string;
}

interface AuditStats {
  total_entries: number;
  success_count: number;
  failed_count: number;
  partial_count: number;
  unique_users: number;
  unique_actions: number;
  recent_24h: number;
  recent_7d: number;
}

type SortField = 'timestamp' | 'user_name' | 'action' | 'resource_type' | 'status';
type SortDirection = 'asc' | 'desc';

interface AuditFilters {
  search: string;
  user: string;
  action: string;
  resource: string;
  date_from: string;
  date_to: string;
}

export const AuditLog: React.FC = () => {
  const { toast } = useToast();
  const { hasPermission, isSuperSuperAdmin } = useRoleAccess();

  // Enable real-time updates via WebSocket
  useLiveData(['audit-logs', 'audit-stats'], {
    enabled: true,
    refetchInterval: 30000 // Auto-refresh every 30 seconds
  });

  // State
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState<AuditFilters>({
    search: '',
    user: '__all__',
    action: '__all__',
    resource: '__all__',
    date_from: '',
    date_to: '',
  });

  // Fetch audit statistics
  const { data: auditStats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      const response = await apiClient.get<AuditStats>('/rbac/audit/stats');
      return response.data;
    },
  });

  // Fetch audit entries with infinite scroll
  const {
    data: auditData,
    isLoading: loadingAudit,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchAudit
  } = useInfiniteQuery({
    queryKey: ['audit-entries', filters, sortField, sortDirection],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        offset: pageParam.toString(),
        limit: '50',
        sort_field: sortField,
        sort_direction: sortDirection,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value && value !== 'all' && value !== '__all__')
        )
      });

      const response = await apiClient.get<{
        entries: AuditEntry[];
        total: number;
        has_more: boolean;
      }>(`/rbac/audit?${params}`);
      return response.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !lastPage.has_more) return undefined;
      return allPages.length * 50;
    },
  });

  // Get unique values for filters
  const { data: filterOptions } = useQuery({
    queryKey: ['audit-filter-options'],
    queryFn: async () => {
      const response = await apiClient.get<{
        users: Array<{ id: string; name: string; email: string }>;
        actions: string[];
        resource_types: string[];
      }>('/rbac/audit/filter-options');
      return response.data;
    },
  });

  // Flatten audit entries
  const auditEntries = useMemo(() => {
    return auditData?.pages?.flatMap(page => page.entries) || [];
  }, [auditData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
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
      user: '__all__',
      action: '__all__',
      resource_type: '__all__',
      status: 'all',
      date_from: '',
      date_to: '',
    });
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create_role':
      case 'create_permission':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'update_role':
      case 'update_permission':
        return <Edit className="h-4 w-4 text-blue-500" />;
      case 'delete_role':
      case 'delete_permission':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'assign_role':
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'revoke_role':
        return <UserX className="h-4 w-4 text-red-500" />;
      case 'login':
        return <Lock className="h-4 w-4 text-blue-500" />;
      case 'logout':
        return <Unlock className="h-4 w-4 text-gray-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (success: boolean) => {
    if (success) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-800">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    // Add 'Z' to timestamp if it doesn't have timezone info (backend returns UTC)
    const time = new Date(timestamp.endsWith('Z') ? timestamp : timestamp + 'Z');
    const diff = now.getTime() - time.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return time.toLocaleDateString();
  };

  const exportAuditLog = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value && value !== 'all' && value !== '__all__')
        )
      });

      // Use direct fetch for blob download since apiClient doesn't handle blobs properly
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/rbac/audit/export?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: 'Audit log has been exported successfully.',
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error?.message || 'Failed to export audit log. Please check your permissions.',
        variant: 'destructive',
      });
    }
  };

  if (!hasPermission('audit.read') && !isSuperSuperAdmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view the audit log.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            RBAC Audit Log
          </h2>
          <p className="text-muted-foreground">
            Track all role and permission changes across the system
          </p>
        </div>
        <div className="flex gap-2">
          {/* Real-time updates via WebSocket (auto-updates every 30s) */}
          {(hasPermission('audit.export') || isSuperSuperAdmin) && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportAuditLog}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Audit Statistics */}
      {auditStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{auditStats?.total_entries?.toLocaleString() || '0'}</div>
              <div className="text-sm text-muted-foreground">Total Entries</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {auditStats?.success_count?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-muted-foreground">Successful</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {auditStats?.failed_count?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {auditStats?.partial_count?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-muted-foreground">Partial</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {auditStats?.unique_users || 0}
              </div>
              <div className="text-sm text-muted-foreground">Unique Users</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">
                {auditStats?.unique_actions || 0}
              </div>
              <div className="text-sm text-muted-foreground">Unique Actions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-indigo-600">
                {auditStats?.recent_24h?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-muted-foreground">Last 24h</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-teal-600">
                {auditStats?.recent_7d?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-muted-foreground">Last 7 days</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search entries..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>User</Label>
              <Select
                value={filters.user}
                onValueChange={(value) => setFilters(prev => ({ ...prev, user: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Users</SelectItem>
                  {filterOptions?.users?.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
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
                  {filterOptions?.actions?.map(action => (
                    <SelectItem key={action} value={action}>
                      {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {filterOptions?.resource_types?.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={resetFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Audit Entries</span>
            <Badge variant="outline" className="animate-pulse">
              <Activity className="h-3 w-3 mr-1" />
              Live (30s auto-update)
            </Badge>
          </CardTitle>
          <CardDescription>
            Complete log of all RBAC system activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('timestamp')}
                  >
                    <div className="flex items-center gap-2">
                      Timestamp
                      {getSortIcon('timestamp')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('user_name')}
                  >
                    <div className="flex items-center gap-2">
                      User
                      {getSortIcon('user_name')}
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
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('resource_type')}
                  >
                    <div className="flex items-center gap-2">
                      Resource
                      {getSortIcon('resource_type')}
                    </div>
                  </TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAudit ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading audit entries...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : auditEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No audit entries found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  auditEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">
                              {new Date(entry.timestamp).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatTimeAgo(entry.timestamp)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.user_name ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {entry.user_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">{entry.user_name}</div>
                              <div className="text-xs text-muted-foreground">{entry.user_email}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">System</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(entry.action)}
                          <span className="text-sm">
                            {entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="text-xs">
                            {entry.resource || 'N/A'}
                          </Badge>
                          {entry.resource_name && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {entry.resource_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {entry.details && Object.keys(entry.details).length > 0 ? (
                            <div className="text-xs">
                              <div className="font-medium">
                                {Object.keys(entry.details).length} detail(s)
                              </div>
                              <div className="text-muted-foreground truncate">
                                {Object.keys(entry.details).join(', ')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No details</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(entry.success)}
                        {entry.error_message && (
                          <div className="text-xs text-red-500 mt-1 truncate max-w-xs">
                            {entry.error_message}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedEntry(entry);
                            setIsDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Load More Button */}
          {hasNextPage && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Entry Details Dialog */}
      {selectedEntry && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Entry Details
              </DialogTitle>
              <DialogDescription>
                Complete information about this audit entry
              </DialogDescription>
            </DialogHeader>
            <AuditEntryDetails
              entry={selectedEntry}
              onClose={() => {
                setIsDetailsOpen(false);
                setSelectedEntry(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Audit Entry Details Component
const AuditEntryDetails: React.FC<{
  entry: AuditEntry;
  onClose: () => void;
}> = ({ entry, onClose }) => {
  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Timestamp</Label>
              <p className="text-sm">{new Date(entry.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Action</Label>
              <p className="text-sm">{entry.action.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Resource Type</Label>
              <p className="text-sm">{entry.resource || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <div className="flex items-center gap-2">
                {entry.success ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                <span className="text-sm capitalize">{entry.success ? 'Success' : 'Failed'}</span>
              </div>
            </div>
            {entry.resource_name && (
              <div>
                <Label className="text-sm font-medium">Resource Name</Label>
                <p className="text-sm">{entry.resource_name}</p>
              </div>
            )}
            {entry.resource_id && (
              <div>
                <Label className="text-sm font-medium">Resource ID</Label>
                <code className="text-sm bg-muted px-2 py-1 rounded">{entry.resource_id}</code>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Information */}
      {entry.user_name && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Name</Label>
                <p className="text-sm">{entry.user_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <p className="text-sm">{entry.user_email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">User ID</Label>
                <code className="text-sm bg-muted px-2 py-1 rounded">{entry.user_id}</code>
              </div>
              {entry.session_id && (
                <div>
                  <Label className="text-sm font-medium">Session ID</Label>
                  <code className="text-sm bg-muted px-2 py-1 rounded">{entry.session_id}</code>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details */}
      {entry.details && Object.keys(entry.details).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              <pre className="text-sm bg-muted p-4 rounded-md overflow-x-auto">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Technical Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            {entry.ip_address && (
              <div>
                <Label className="text-sm font-medium">IP Address</Label>
                <code className="text-sm bg-muted px-2 py-1 rounded">{entry.ip_address}</code>
              </div>
            )}
            {entry.user_agent && (
              <div>
                <Label className="text-sm font-medium">User Agent</Label>
                <p className="text-sm break-all">{entry.user_agent}</p>
              </div>
            )}
            {entry.request_id && (
              <div>
                <Label className="text-sm font-medium">Request ID</Label>
                <code className="text-sm bg-muted px-2 py-1 rounded">{entry.request_id}</code>
              </div>
            )}
            {entry.error_message && (
              <div>
                <Label className="text-sm font-medium">Error Message</Label>
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {entry.error_message}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
};