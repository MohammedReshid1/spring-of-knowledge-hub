import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { apiClient } from '@/lib/api';
import { config } from '@/lib/config';
import { TokenStorage } from '@/utils/tokenStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Key, Eye, EyeOff, UserCircle, AlertCircle, CheckCircle2, Loader2, Phone, Mail, Users } from 'lucide-react';

// Form schema for parent password reset
const parentPasswordResetSchema = z.object({
  parent_id: z.string().min(1, 'Parent is required'),
  reset_reason: z.string().min(1, 'Reset reason is required'),
  notify_parent: z.boolean().default(false),
  custom_message: z.string().optional(),
});

type ParentPasswordResetFormData = z.infer<typeof parentPasswordResetSchema>;

// Type definitions
interface Parent {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  relationship: 'Father' | 'Mother' | 'Guardian';
  linked_students?: number;
}

interface PasswordResetResponse {
  success: boolean;
  message: string;
  data?: {
    new_password: string;
    parent_name: string;
    reset_at: string;
  };
}

interface SingleParentPasswordResetProps {
  onSuccess?: (data: PasswordResetResponse) => void;
  preSelectedParentId?: string;
}

export function SingleParentPasswordReset({
  onSuccess,
  preSelectedParentId
}: SingleParentPasswordResetProps) {
  const { selectedBranch } = useBranch();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const enableQueries = !!selectedBranch;

  const { toast } = useToast();
  const [parentSearch, setParentSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetResult, setResetResult] = useState<PasswordResetResponse | null>(null);
  const [selectedParentData, setSelectedParentData] = useState<Parent | null>(null);

  const form = useForm<ParentPasswordResetFormData>({
    resolver: zodResolver(parentPasswordResetSchema),
    defaultValues: {
      parent_id: preSelectedParentId || '',
      reset_reason: '',
      notify_parent: false,
      custom_message: '',
    },
  });

  // Search parents query
  const { data: parentsData, isLoading: parentsLoading } = useQuery({
    queryKey: ['parents-search', parentSearch, branchId ?? 'all'],
    queryFn: () => apiClient.getParents({ branch_id: branchId, search: parentSearch }),
    enabled: parentSearch.length > 2 && enableQueries,
    select: (resp) => (resp as any).data?.items || (resp as any).items || [],
  });

  // Get all parents for pre-selected parent info
  const { data: allParentsResp } = useQuery({
    queryKey: ['all-parents', branchId ?? 'all'],
    queryFn: () => apiClient.getParents({ branch_id: branchId }),
    enabled: enableQueries && !!preSelectedParentId,
  });

  const allParents = (allParentsResp as any)?.data?.items || (allParentsResp as any)?.items || [];

  // Password reset mutation
  const passwordResetMutation = useMutation({
    mutationFn: async (data: ParentPasswordResetFormData) => {
      if (!branchId) {
        throw new Error('Please select a branch before resetting password');
      }

      // Use the stored parent data
      if (!selectedParentData) {
        throw new Error('Please select a parent first');
      }

      const response = await fetch(`${config.API_BASE_URL}/admin/parents/password-reset/single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TokenStorage.getToken()}`,
        },
        body: JSON.stringify({
          parent_id: selectedParentData.id,
          branch_id: branchId,
          reset_reason: data.reset_reason,
          notify_parent: data.notify_parent,
          custom_message: data.custom_message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reset password');
      }

      return response.json() as Promise<PasswordResetResponse>;
    },
    onSuccess: (data) => {
      setResetResult(data);
      toast({
        title: 'Password Reset Successful',
        description: data.message,
      });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast({
        title: 'Password Reset Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const getParentDisplayName = (parentId: string) => {
    let parent = parentsData?.find((p: Parent) => p.id === parentId);
    if (!parent && allParents) {
      parent = allParents.find((p: Parent) => p.id === parentId);
    }
    return parent ? `${parent.full_name} (${parent.relationship})` : parentId;
  };

  const handleSubmit = async (data: ParentPasswordResetFormData) => {
    await passwordResetMutation.mutateAsync(data);
  };

  const resetForm = () => {
    form.reset();
    setResetResult(null);
    setShowPassword(false);
    setSelectedParentData(null);
    setParentSearch('');
  };

  const selectedParentId = form.watch('parent_id');
  const selectedParent = parentsData?.find((p: Parent) => p.id === selectedParentId) ||
                        allParents?.find((p: Parent) => p.id === selectedParentId);

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.5s ease-out;
        }
      `}</style>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl animate-fadeInUp">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
              <Key className="h-6 w-6 text-blue-600" />
            </div>
            Parent Password Reset
          </h2>
          <p className="text-slate-600 font-medium">
            Reset a parent's password to the default format (firstname.fathername321)
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Parent Selection */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp">
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                    <UserCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  Parent Selection
                </CardTitle>
                <CardDescription>
                  Search and select the parent whose password needs to be reset
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <FormField
                  control={form.control}
                  name="parent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent *</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            placeholder="Search parent by name or phone..."
                            value={parentSearch}
                            onChange={(e) => setParentSearch(e.target.value)}
                            disabled={!!preSelectedParentId}
                          />
                          {parentsData && parentsData.length > 0 && (
                            <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
                              {parentsData.map((parent: Parent) => (
                                <div
                                  key={parent.id}
                                  className="p-2 hover:bg-muted rounded cursor-pointer"
                                  onClick={() => {
                                    field.onChange(parent.id);
                                    setParentSearch(parent.full_name);
                                    setSelectedParentData(parent);
                                  }}
                                >
                                  <div className="font-medium">
                                    {parent.full_name}
                                  </div>
                                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <span>{parent.relationship}</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {parent.phone}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {field.value && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-green-700 font-medium">Selected:</span>
                                <span className="text-green-800">{getParentDisplayName(field.value)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedParent && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Parent Information</h4>
                    <div className="space-y-1 text-sm">
                      <div><span className="font-medium">Name:</span> {selectedParent.full_name}</div>
                      <div><span className="font-medium">Relationship:</span> {selectedParent.relationship}</div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <span className="font-medium">Phone:</span> {selectedParent.phone}
                      </div>
                      {selectedParent.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="font-medium">Email:</span> {selectedParent.email}
                        </div>
                      )}
                      {selectedParent.linked_students !== undefined && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span className="font-medium">Linked Students:</span> {selectedParent.linked_students}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reset Configuration */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                    <Key className="h-5 w-5 text-blue-600" />
                  </div>
                  Reset Configuration
                </CardTitle>
                <CardDescription>
                  Configure the password reset settings and notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <FormField
                  control={form.control}
                  name="reset_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reset Reason *</FormLabel>
                      <FormControl>
                        <textarea
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                          rows={3}
                          placeholder="Explain why this password reset is necessary..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notify_parent"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-medium">Notify Parent via Email/SMS</FormLabel>
                    </FormItem>
                  )}
                />

                {form.watch('notify_parent') && (
                  <FormField
                    control={form.control}
                    name="custom_message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Message (Optional)</FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                            rows={2}
                            placeholder="Add a custom message to include in the notification..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Reset Result */}
          {resetResult && resetResult.success && resetResult.data && (
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-xl animate-fadeInUp">
              <CardHeader className="border-b border-green-100/50 pb-4">
                <CardTitle className="text-lg font-semibold text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Password Reset Successful
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <Alert className="bg-green-100 border-green-200">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {resetResult.message}
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Parent Name</label>
                    <p className="text-lg font-semibold text-gray-900">{resetResult.data.parent_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">New Password</label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-lg font-mono font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded">
                        {showPassword ? resetResult.data.new_password : '••••••••••••'}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Reset Time</label>
                  <p className="text-sm text-gray-900">
                    {new Date(resetResult.data.reset_at).toLocaleString()}
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Password Successfully Reset
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                    className="border-blue-300 hover:bg-blue-50 text-blue-700"
                  >
                    Reset Another Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {!resetResult && (
            <div className="flex items-center justify-end space-x-3 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="border-slate-300 hover:bg-slate-50 transition-all duration-300"
              >
                Clear Form
              </Button>
              <Button
                type="submit"
                disabled={passwordResetMutation.isPending || !selectedParentId}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
              >
                {passwordResetMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}

export type { ParentPasswordResetFormData, PasswordResetResponse, SingleParentPasswordResetProps };
