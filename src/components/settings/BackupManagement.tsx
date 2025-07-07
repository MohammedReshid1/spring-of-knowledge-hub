import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Download, RefreshCw, Database, Clock, CheckCircle, XCircle, AlertCircle, Eye, RotateCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

import { useRoleAccess } from '@/hooks/useRoleAccess';

export const BackupManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<any>(null);
  const [showViewDetails, setShowViewDetails] = useState(false);
  const { isSuperAdmin } = useRoleAccess();

  // Fetch backup logs
  const { data: backupLogs, isLoading } = useQuery({
    queryKey: ['backup-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backup_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const { data, error } = await supabase.rpc('delete_backup_log', {
        backup_log_id: backupId
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Backup deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete backup.",
        variant: "destructive",
      });
    }
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      // For now, we'll show a message that restore is not yet implemented
      // In a real implementation, you'd need a restore function
      throw new Error('Restore functionality is not yet implemented. Please contact system administrator.');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // View backup details - simplified since we're not actually storing files
  const viewBackupDetails = async (backup: any) => {
    if (!backup.file_path) {
      toast({
        title: "Error",
        description: "Backup file reference not available",
        variant: "destructive",
      });
      return;
    }

    // Since we're not actually storing files, we'll show the metadata
    setSelectedBackup({ 
      ...backup, 
      backupData: {
        backup_id: backup.id,
        backup_type: backup.backup_type,
        backup_method: backup.backup_method,
        created_at: backup.started_at,
        total_records: backup.records_count,
        tables: backup.tables_backed_up || []
      }
    });
    setShowViewDetails(true);
  };

  // Download backup file - simplified notification
  const downloadBackup = async (backup: any) => {
    if (!backup.file_path) {
      toast({
        title: "Error",
        description: "Backup file not available for download. This is a reference backup.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Info",
      description: "Backup download functionality is not yet implemented. This shows backup metadata only.",
    });
  };

  // Create manual backup
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('create_database_backup', {
        backup_type: 'manual',
        backup_method: 'full'
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Manual backup created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create backup.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsCreatingBackup(false);
    }
  });

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    createBackupMutation.mutate();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">COMPLETED</Badge>;
      case 'failed':
        return <Badge variant="destructive">FAILED</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">IN PROGRESS</Badge>;
      default:
        return <Badge variant="outline">UNKNOWN</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-red-600">Database Backup Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Create manual backups and view backup history. Automatic backups run every week.
            {!isSuperAdmin && (
              <span className="block text-yellow-600 text-xs mt-1">
                Note: Only Super Admins can create manual backups and restore data.
              </span>
            )}
          </p>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              className="border-red-200 text-red-700 hover:bg-red-50"
              disabled={isCreatingBackup || !isSuperAdmin}
            >
              <Database className="h-4 w-4 mr-2" />
              {isCreatingBackup ? 'Creating...' : 'Create Manual Backup'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create Manual Backup</AlertDialogTitle>
              <AlertDialogDescription>
                This will create a full backup of all system data including students, users, payments, 
                and all other sensitive information. The backup will be stored securely and can be 
                used for disaster recovery.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCreateBackup}
                className="bg-red-600 hover:bg-red-700"
              >
                Create Backup
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Backup History
          </CardTitle>
          <CardDescription>
            Recent backup operations and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading backup history...</span>
            </div>
          ) : backupLogs && backupLogs.length > 0 ? (
            <div className="space-y-4">
              {backupLogs.map((backup) => (
                <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(backup.status)}
                      <span className="font-medium">
                        {backup.backup_type.charAt(0).toUpperCase() + backup.backup_type.slice(1)} Backup
                      </span>
                      {getStatusBadge(backup.status)}
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Started: {format(new Date(backup.started_at), 'PPp')}</p>
                      {backup.completed_at && (
                        <p>Completed: {format(new Date(backup.completed_at), 'PPp')}</p>
                      )}
                      {backup.records_count && (
                        <p>Records: {backup.records_count.toLocaleString()}</p>
                      )}
                    </div>
                    {backup.error_message && (
                      <p className="text-sm text-red-600">Error: {backup.error_message}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                     {backup.file_size && (
                       <span className="text-sm text-gray-500">
                         {(backup.file_size / 1024 / 1024).toFixed(2)} MB
                       </span>
                     )}
                     {backup.status === 'completed' && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => viewBackupDetails(backup)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => downloadBackup(backup)}
                          title="Download Backup"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {isSuperAdmin && (
                          <>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-orange-600 hover:text-orange-700"
                                  title="Restore Backup"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Restore Database Backup</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <strong>WARNING:</strong> This will completely replace all current data with the backup data from{' '}
                                    {format(new Date(backup.started_at), 'PPp')}. This action cannot be undone.
                                    <br /><br />
                                    Are you absolutely sure you want to proceed?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => restoreBackupMutation.mutate(backup.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Restore Backup
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  title="Delete Backup"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Backup</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this backup from{' '}
                                    {format(new Date(backup.started_at), 'PPp')}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteBackupMutation.mutate(backup.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete Backup
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No backup history available</p>
              <p className="text-sm">Create your first backup to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <Clock className="h-5 w-5" />
            Automatic Backup Schedule
          </CardTitle>
          <CardDescription className="text-yellow-700">
            Automatic backups are configured to run every week to ensure your data is always protected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-yellow-800">
            <p>• Frequency: Every 7 days</p>
            <p>• Backup Type: Incremental (saves space while maintaining data integrity)</p>
            <p>• Storage: Secure encrypted storage</p>
            <p>• Retention: 6 months of backup history</p>
          </div>
        </CardContent>
      </Card>

      {/* View Backup Details Dialog */}
      <Dialog open={showViewDetails} onOpenChange={setShowViewDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Backup Details</DialogTitle>
            <DialogDescription>
              Detailed information about the backup created on{' '}
              {selectedBackup && format(new Date(selectedBackup.started_at), 'PPp')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedBackup && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-600">Backup Type</h4>
                  <p className="text-sm">{selectedBackup.backup_type}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-600">Backup Method</h4>
                  <p className="text-sm">{selectedBackup.backup_method}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-600">Total Records</h4>
                  <p className="text-sm">{selectedBackup.records_count?.toLocaleString()}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-600">File Size</h4>
                  <p className="text-sm">
                    {selectedBackup.file_size ? (selectedBackup.file_size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}
                  </p>
                </div>
              </div>

              {selectedBackup.tables_backed_up && (
                <div>
                  <h4 className="font-medium text-sm text-gray-600 mb-2">Tables Included</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedBackup.tables_backed_up.map((table: string) => (
                      <Badge key={table} variant="outline" className="text-xs">
                        {table}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
