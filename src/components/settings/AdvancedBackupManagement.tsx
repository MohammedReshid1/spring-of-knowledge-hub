import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Database,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  HardDrive,
  Shield,
  FileArchive,
  RefreshCw,
  AlertTriangle,
  Settings,
  Lock,
  Unlock,
  FileCheck,
  Calendar,
  User,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BackupItem {
  id: string;
  backup_type: string;
  backup_method: string;
  status: string;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  performed_by: string;
  collections_count: number;
  records_count: number;
  file_size: number;
  file_path: string;
  compressed: boolean;
  encrypted: boolean;
  checksum?: string;
  notes?: string;
  error_message?: string;
}

interface BackupStats {
  total_backups: number;
  by_status: {
    completed: number;
    verified: number;
    failed: number;
    in_progress: number;
  };
  by_type: {
    full: number;
    manual: number;
    automatic: number;
  };
  latest_backup: {
    id: string;
    backup_type: string;
    completed_at: string;
    file_size: number;
    records_count: number;
  } | null;
  total_storage_bytes: number;
}

export const AdvancedBackupManagement = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showRetentionDialog, setShowRetentionDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  // Create backup form state
  const [compress, setCompress] = useState(true);
  const [encrypt, setEncrypt] = useState(false);
  const [notes, setNotes] = useState('');

  // Restore form state
  const [createSafetyBackup, setCreateSafetyBackup] = useState(true);
  const [collectionsToRestore, setCollectionsToRestore] = useState('');

  // Retention policy state
  const [retentionDays, setRetentionDays] = useState(30);
  const [keepCount, setKeepCount] = useState(10);

  const queryClient = useQueryClient();
  const { isSuperAdmin, isSuperSuperAdmin } = useRoleAccess();

  // Only show to superadmin and superadmin
  if (!isSuperSuperAdmin && !isSuperAdmin) {
    return (
      <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-red-50/50 border border-white/30 shadow-premium">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.02] via-pink-500/[0.02] to-red-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardHeader className="relative">
          <CardTitle className="text-xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-100 to-pink-100 border border-red-200/50">
              <Lock className="h-5 w-5 text-red-600" />
            </div>
            <span className="bg-gradient-to-r from-slate-900 via-red-800 to-pink-900 bg-clip-text text-transparent">
              Access Denied
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/50 rounded-xl p-6">
            <p className="text-red-900 font-medium">
              Only Super Administrators can access advanced backup management.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fetch backup stats
  const { data: stats } = useQuery<BackupStats>({
    queryKey: ['advanced-backup-stats'],
    queryFn: async () => {
      const { data, error } = await apiClient.getAdvancedBackupStats();
      if (error) throw new Error(error);
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch backups list
  const { data: backupsResponse, isLoading } = useQuery({
    queryKey: ['advanced-backups', filterStatus, filterType],
    queryFn: async () => {
      const { data, error } = await apiClient.listAdvancedBackups({
        status_filter: filterStatus || undefined,
        backup_type: filterType || undefined,
        limit: 50,
        offset: 0,
      });
      if (error) throw new Error(error);
      return data;
    },
    refetchInterval: 30000,
  });

  const backups = backupsResponse?.backups || [];

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.createAdvancedBackup({
        compress,
        encrypt,
        notes: notes || undefined,
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advanced-backups'] });
      queryClient.invalidateQueries({ queryKey: ['advanced-backup-stats'] });
      setShowCreateDialog(false);
      setNotes('');
      toast({
        title: 'Backup Created',
        description: 'Database backup created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Backup Failed',
        description: error?.message || 'Failed to create backup',
        variant: 'destructive',
      });
    },
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const { data, error } = await apiClient.restoreAdvancedBackup(backupId, {
        create_safety_backup: createSafetyBackup,
        collections: collectionsToRestore || undefined,
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advanced-backups'] });
      queryClient.invalidateQueries({ queryKey: ['advanced-backup-stats'] });
      setShowRestoreDialog(false);
      setSelectedBackup(null);
      setCollectionsToRestore('');
      toast({
        title: 'Restore Completed',
        description: 'Database restored successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Restore Failed',
        description: error?.message || 'Failed to restore backup',
        variant: 'destructive',
      });
    },
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const { data, error } = await apiClient.deleteAdvancedBackup(backupId);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advanced-backups'] });
      queryClient.invalidateQueries({ queryKey: ['advanced-backup-stats'] });
      toast({
        title: 'Backup Deleted',
        description: 'Backup deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error?.message || 'Failed to delete backup',
        variant: 'destructive',
      });
    },
  });

  // Verify backup mutation
  const verifyBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const { data, error } = await apiClient.verifyAdvancedBackup(backupId);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['advanced-backups'] });
      toast({
        title: data.is_valid ? 'Backup Verified' : 'Verification Failed',
        description: data.message,
        variant: data.is_valid ? 'default' : 'destructive',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Verification Failed',
        description: error?.message || 'Failed to verify backup',
        variant: 'destructive',
      });
    },
  });

  // Apply retention policy mutation
  const retentionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.applyBackupRetentionPolicy({
        retention_days: retentionDays,
        keep_count: keepCount,
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['advanced-backups'] });
      queryClient.invalidateQueries({ queryKey: ['advanced-backup-stats'] });
      setShowRetentionDialog(false);
      toast({
        title: 'Retention Policy Applied',
        description: `Deleted ${data.deleted_count} old backups, freed ${formatBytes(data.deleted_size)}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Policy Failed',
        description: error?.message || 'Failed to apply retention policy',
        variant: 'destructive',
      });
    },
  });

  const handleDownload = async (backupId: string, filename: string) => {
    try {
      const blob = await apiClient.downloadAdvancedBackup(backupId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: 'Download Started',
        description: 'Backup file download started',
      });
    } catch (error: any) {
      toast({
        title: 'Download Failed',
        description: error?.message || 'Failed to download backup',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (backup: BackupItem) => {
    if (confirm(`Are you sure you want to delete this backup?\n\nBackup: ${backup.file_path}\nCreated: ${new Date(backup.started_at).toLocaleString()}`)) {
      deleteBackupMutation.mutate(backup.id);
    }
  };

  const handleRestore = (backup: BackupItem) => {
    setSelectedBackup(backup);
    setShowRestoreDialog(true);
  };

  const confirmRestore = () => {
    if (selectedBackup && confirm('Are you sure you want to restore this backup? This will replace the current database.')) {
      restoreBackupMutation.mutate(selectedBackup.id);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { className: string; icon: any; label: string }> = {
      completed: { className: 'bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300/50 text-blue-800 font-semibold shadow-sm', icon: CheckCircle, label: 'Completed' },
      verified: { className: 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-300/50 text-green-800 font-semibold shadow-sm', icon: FileCheck, label: 'Verified' },
      failed: { className: 'bg-gradient-to-r from-red-100 to-pink-100 border-red-300/50 text-red-800 font-semibold shadow-sm', icon: XCircle, label: 'Failed' },
      in_progress: { className: 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300/50 text-yellow-800 font-semibold shadow-sm', icon: Clock, label: 'In Progress' },
      corrupted: { className: 'bg-gradient-to-r from-red-100 to-pink-100 border-red-300/50 text-red-800 font-semibold shadow-sm', icon: AlertTriangle, label: 'Corrupted' },
    };

    const config = statusConfig[status.toLowerCase()] || { className: 'bg-white/80 border-slate-300 text-slate-700 font-medium', icon: AlertCircle, label: status };
    const Icon = config.icon;

    return (
      <Badge className={`flex items-center gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

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

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }
      `}</style>

      <div className="space-y-6 animate-fadeInUp">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-blue-50/50 border border-white/30 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-indigo-500/[0.02] to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">Total Backups</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                    {stats?.total_backups || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                  <Database className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-green-50/50 border border-white/30 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.02] via-emerald-500/[0.02] to-green-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">Verified</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">
                    {stats?.by_status.verified || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-red-50/50 border border-white/30 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.02] via-pink-500/[0.02] to-red-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">Failed</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-red-700 to-pink-700 bg-clip-text text-transparent">
                    {stats?.by_status.failed || 0}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-red-100 to-pink-100 border border-red-200/50">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-purple-50/50 border border-white/30 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.02] via-violet-500/[0.02] to-purple-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">Storage Used</p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-violet-700 bg-clip-text text-transparent">
                    {formatBytes(stats?.total_storage_bytes || 0)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200/50">
                  <HardDrive className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Backup Management Card */}
        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-slate-50/50 border border-white/30 shadow-premium hover:shadow-lg transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-500/[0.02] via-gray-500/[0.02] to-slate-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50">
                    <Database className="h-6 w-6 text-slate-600" />
                  </div>
                  <span className="bg-gradient-to-r from-slate-900 via-gray-800 to-slate-900 bg-clip-text text-transparent">
                    Advanced Backup Management
                  </span>
                </CardTitle>
                <CardDescription className="text-slate-600 font-medium mt-2 ml-14">
                  Enterprise-grade backup and restore with encryption, compression, and verification
                </CardDescription>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowRetentionDialog(true)}
                  variant="outline"
                  className="border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 text-slate-700 hover:text-slate-900 rounded-xl py-2 px-4"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Retention Policy
                </Button>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  disabled={createBackupMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 py-2 px-6 rounded-xl"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Create Backup
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative space-y-6">
            {/* Filters */}
            <div className="flex gap-4">
              <div className="flex-1">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="border-2 border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-blue-500/20 rounded-xl">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="border-2 border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-blue-500/20 rounded-xl">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Backup</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="automatic">Automatic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Backups List */}
            <div className="border border-white/40 rounded-xl overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="text-slate-600 font-medium">Loading backups...</span>
                  </div>
                </div>
              ) : backups.length === 0 ? (
                <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200/50 rounded-xl p-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50">
                      <Database className="h-12 w-12 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">No backups found</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-white/40">
                  {backups.map((backup: BackupItem, index) => (
                    <div
                      key={backup.id}
                      className="p-5 bg-gradient-to-r from-white/60 to-white/40 hover:from-blue-50/30 hover:via-indigo-50/20 hover:to-purple-50/30 transition-all duration-300"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">{backup.file_path}</span>
                            {getStatusBadge(backup.status)}
                            <Badge className="text-xs bg-gradient-to-r from-slate-100 to-gray-100 border-slate-300/50 text-slate-700 font-semibold shadow-sm">
                              {backup.backup_type}
                            </Badge>
                            {backup.compressed && (
                              <Badge className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300/50 text-blue-800 font-semibold shadow-sm flex items-center gap-1">
                                <FileArchive className="h-3 w-3" />
                                Compressed
                              </Badge>
                            )}
                            {backup.encrypted && (
                              <Badge className="text-xs bg-gradient-to-r from-purple-100 to-violet-100 border-purple-300/50 text-purple-800 font-semibold shadow-sm flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                Encrypted
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-500" />
                              <span className="font-medium">{new Date(backup.started_at).toLocaleString()}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-slate-500" />
                              <span className="font-medium">{formatDuration(backup.duration_seconds)}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                              <span className="font-medium">{formatBytes(backup.file_size)}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Database className="h-3.5 w-3.5 text-slate-500" />
                              <span className="font-medium">{backup.records_count?.toLocaleString()} records</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-slate-500" />
                              <span className="font-medium">{backup.performed_by}</span>
                            </span>
                          </div>

                          {backup.notes && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-lg p-3">
                              <p className="text-sm text-blue-900 font-medium italic">Note: {backup.notes}</p>
                            </div>
                          )}

                          {backup.error_message && (
                            <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/50 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <span className="text-sm text-red-900 font-medium">{backup.error_message}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0 ml-4">
                          {backup.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => verifyBackupMutation.mutate(backup.id)}
                              disabled={verifyBackupMutation.isPending}
                              title="Verify backup integrity"
                              className="border-2 border-green-200 hover:border-green-300 hover:bg-green-50 transition-all duration-300 text-green-700 hover:text-green-900 rounded-lg"
                            >
                              <FileCheck className="h-4 w-4" />
                            </Button>
                          )}
                          {(backup.status === 'completed' || backup.status === 'verified') && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(backup.id, backup.file_path)}
                                title="Download backup"
                                className="border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 text-blue-700 hover:text-blue-900 rounded-lg"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRestore(backup)}
                                disabled={restoreBackupMutation.isPending}
                                title="Restore from backup"
                                className="border-2 border-purple-200 hover:border-purple-300 hover:bg-purple-50 transition-all duration-300 text-purple-700 hover:text-purple-900 rounded-lg"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(backup)}
                            disabled={deleteBackupMutation.isPending}
                            title="Delete backup"
                            className="border-2 border-red-200 hover:border-red-300 hover:bg-red-50 transition-all duration-300 text-red-700 hover:text-red-900 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Create Backup Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Backup</DialogTitle>
            <DialogDescription>
              Configure backup options and create a new database backup
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="compress" className="flex items-center gap-2">
                <FileArchive className="h-4 w-4" />
                Compress Backup
              </Label>
              <Switch id="compress" checked={compress} onCheckedChange={setCompress} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="encrypt" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Encrypt Backup
              </Label>
              <Switch id="encrypt" checked={encrypt} onCheckedChange={setEncrypt} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about this backup..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Backup Options:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Compression reduces file size significantly</li>
                    <li>Encryption protects sensitive data</li>
                    <li>Both options may increase backup time</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => createBackupMutation.mutate()} disabled={createBackupMutation.isPending}>
              {createBackupMutation.isPending ? 'Creating...' : 'Create Backup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore from Backup</DialogTitle>
            <DialogDescription>
              Configure restore options and restore the database
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Selected Backup:</strong> {selectedBackup?.file_path}
                <br />
                <strong>Created:</strong> {selectedBackup && new Date(selectedBackup.started_at).toLocaleString()}
                <br />
                <strong>Size:</strong> {selectedBackup && formatBytes(selectedBackup.file_size)}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="safety" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Create Safety Backup
              </Label>
              <Switch id="safety" checked={createSafetyBackup} onCheckedChange={setCreateSafetyBackup} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="collections">Collections to Restore (Optional)</Label>
              <Input
                id="collections"
                placeholder="Leave empty to restore all, or comma-separated list: users,students,teachers"
                value={collectionsToRestore}
                onChange={(e) => setCollectionsToRestore(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Specify collection names separated by commas, or leave empty to restore all collections
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Warning:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>This will replace current database data</li>
                    <li>A safety backup will be created first (if enabled)</li>
                    <li>This operation cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmRestore}
              disabled={restoreBackupMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {restoreBackupMutation.isPending ? 'Restoring...' : 'Restore Database'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retention Policy Dialog */}
      <Dialog open={showRetentionDialog} onOpenChange={setShowRetentionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Retention Policy</DialogTitle>
            <DialogDescription>
              Configure and apply backup retention policy to manage storage
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="retentionDays">Retention Days</Label>
              <Input
                id="retentionDays"
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                min={1}
              />
              <p className="text-xs text-gray-500">
                Delete backups older than this many days
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keepCount">Keep Count</Label>
              <Input
                id="keepCount"
                type="number"
                value={keepCount}
                onChange={(e) => setKeepCount(parseInt(e.target.value))}
                min={1}
              />
              <p className="text-xs text-gray-500">
                Always keep at least this many recent backups
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Policy Rules:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Deletes backups older than {retentionDays} days</li>
                    <li>Always keeps the {keepCount} most recent backups</li>
                    <li>Never deletes backups currently in progress</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetentionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => retentionMutation.mutate()} disabled={retentionMutation.isPending}>
              {retentionMutation.isPending ? 'Applying...' : 'Apply Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
};
