import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Download, RefreshCw, Database, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export const BackupManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

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
            Create manual backups and view backup history. Automatic backups run every 2 weeks.
          </p>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              className="border-red-200 text-red-700 hover:bg-red-50"
              disabled={isCreatingBackup}
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
                    {backup.status === 'completed' && backup.file_path && (
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
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
            Automatic backups are configured to run every 2 weeks to ensure your data is always protected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-yellow-800">
            <p>• Frequency: Every 14 days</p>
            <p>• Backup Type: Incremental (saves space while maintaining data integrity)</p>
            <p>• Storage: Secure encrypted storage</p>
            <p>• Retention: 6 months of backup history</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};