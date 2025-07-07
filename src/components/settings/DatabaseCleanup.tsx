import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle, Database } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/hooks/useRoleAccess';

interface CleanupOption {
  id: string;
  label: string;
  description: string;
  confirmText: string;
  icon: React.ReactNode;
}

const cleanupOptions: CleanupOption[] = [
  {
    id: 'students',
    label: 'Delete All Students',
    description: 'Permanently delete all student records and related data (payments, attendance, etc.)',
    confirmText: 'DELETE STUDENTS',
    icon: <Trash2 className="h-4 w-4" />
  },
  {
    id: 'users',
    label: 'Delete All Users',
    description: 'Delete all user accounts except super admin accounts',
    confirmText: 'DELETE USERS',
    icon: <Trash2 className="h-4 w-4" />
  },
  {
    id: 'classes',
    label: 'Delete All Classes',
    description: 'Remove all class records from the system',
    confirmText: 'DELETE CLASSES',
    icon: <Trash2 className="h-4 w-4" />
  },
  {
    id: 'payment_records',
    label: 'Delete Payment Records',
    description: 'Clear all payment and transaction records',
    confirmText: 'DELETE PAYMENTS',
    icon: <Trash2 className="h-4 w-4" />
  },
  {
    id: 'attendance',
    label: 'Delete Attendance Records',
    description: 'Remove all attendance tracking data',
    confirmText: 'DELETE ATTENDANCE',
    icon: <Trash2 className="h-4 w-4" />
  },
  {
    id: 'all_data',
    label: 'Nuclear Option - Delete Everything',
    description: 'Delete ALL data from the system (except super admin accounts). This cannot be undone!',
    confirmText: 'NUCLEAR DELETE',
    icon: <AlertTriangle className="h-4 w-4 text-red-600" />
  }
];

export const DatabaseCleanup = () => {
  const [confirmationText, setConfirmationText] = useState('');
  const [selectedOption, setSelectedOption] = useState<CleanupOption | null>(null);
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useRoleAccess();

  const cleanupMutation = useMutation({
    mutationFn: async (tableName: string) => {
      const { data, error } = await supabase.rpc('admin_cleanup_table', {
        table_name: tableName
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (deletedCount, tableName) => {
      toast({
        title: "Cleanup Completed",
        description: `Successfully deleted ${deletedCount} records from ${tableName}`,
      });
      queryClient.invalidateQueries();
      setConfirmationText('');
      setSelectedOption(null);
    },
    onError: (error: any) => {
      toast({
        title: "Cleanup Failed",
        description: `Failed to cleanup database: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleConfirmCleanup = () => {
    if (selectedOption && confirmationText === selectedOption.confirmText) {
      cleanupMutation.mutate(selectedOption.id);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800">
          <Database className="h-5 w-5" />
          Database Cleanup (Super Admin Only)
        </CardTitle>
        <p className="text-sm text-red-600">
          These operations permanently delete data and cannot be undone. Use with extreme caution.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {cleanupOptions.map((option) => (
            <div key={option.id} className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-white">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {option.icon}
                  <h3 className="font-semibold text-red-800">{option.label}</h3>
                </div>
                <p className="text-sm text-gray-600">{option.description}</p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setSelectedOption(option)}
                    disabled={cleanupMutation.isPending}
                  >
                    {option.id === 'all_data' ? 'Nuclear Delete' : 'Delete'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      Confirm Dangerous Operation
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4">
                      <p className="text-red-600 font-semibold">
                        You are about to: {option.label}
                      </p>
                      <p>{option.description}</p>
                      <p className="text-sm font-medium">
                        This action is PERMANENT and cannot be reversed. All data will be lost forever.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-text" className="text-sm font-medium">
                          Type "{option.confirmText}" to confirm:
                        </Label>
                        <Input
                          id="confirm-text"
                          value={confirmationText}
                          onChange={(e) => setConfirmationText(e.target.value)}
                          placeholder={`Type ${option.confirmText} here`}
                          className="font-mono"
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => {
                      setConfirmationText('');
                      setSelectedOption(null);
                    }}>
                      Cancel - Keep Data Safe
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleConfirmCleanup}
                      disabled={confirmationText !== option.confirmText || cleanupMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {cleanupMutation.isPending ? 'Deleting...' : 'Yes, Delete Forever'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};