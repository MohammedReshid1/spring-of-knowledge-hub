import { useState, useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { apiClient } from '@/lib/api';
import { config } from '@/lib/config';
import { TokenStorage } from '@/utils/tokenStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Key,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Download,
  RefreshCw,
  Search,
  X,
  Phone,
  Mail
} from 'lucide-react';

// Form schema for bulk password reset
const bulkPasswordResetSchema = z.object({
  parent_ids: z.array(z.string()).min(1, 'At least one parent must be selected'),
  reset_reason: z.string().min(1, 'Reset reason is required'),
  notify_parents: z.boolean().default(false),
  custom_message: z.string().optional(),
});

type BulkPasswordResetFormData = z.infer<typeof bulkPasswordResetSchema>;

// Type definitions
interface Parent {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  relationship: 'Father' | 'Mother' | 'Guardian';
  branch_id?: string;
  linked_students?: number;
}

interface BulkResetResponse {
  success: boolean;
  message: string;
  data?: {
    total_processed: number;
    successful_resets: number;
    failed_resets: number;
    results: Array<{
      parent_id: string;
      parent_name: string;
      success: boolean;
      new_password?: string;
      error?: string;
    }>;
    summary_csv_url?: string;
  };
}

interface BulkParentPasswordResetProps {
  onSuccess?: (data: BulkResetResponse) => void;
}

export function BulkParentPasswordReset({ onSuccess }: BulkParentPasswordResetProps) {
  const { selectedBranch } = useBranch();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const enableQueries = !!selectedBranch;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [parentSearch, setParentSearch] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState<string>('all');
  const [selectedParents, setSelectedParents] = useState<string[]>([]);
  const [resetResult, setResetResult] = useState<BulkResetResponse | null>(null);
  const [showResults, setShowResults] = useState(false);

  const form = useForm<BulkPasswordResetFormData>({
    resolver: zodResolver(bulkPasswordResetSchema),
    defaultValues: {
      parent_ids: [],
      reset_reason: '',
      notify_parents: false,
      custom_message: '',
    },
  });

  // Fetch all parents
  const { data: parentsResp, isLoading: parentsLoading } = useQuery({
    queryKey: ['all-parents', branchId ?? 'all'],
    queryFn: () => apiClient.getParents({ branch_id: branchId }),
    enabled: enableQueries,
  });

  const parentsData = (parentsResp as any)?.data?.items || (parentsResp as any)?.items || [];

  // Bulk password reset mutation
  const bulkResetMutation = useMutation({
    mutationFn: async (data: BulkPasswordResetFormData) => {
      if (!branchId) {
        throw new Error('Please select a branch before resetting passwords');
      }

      const response = await fetch(`${config.API_BASE_URL}/admin/parents/password-reset/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TokenStorage.getToken()}`,
        },
        body: JSON.stringify({
          parent_ids: data.parent_ids,
          branch_id: branchId,
          reset_reason: data.reset_reason,
          notify_parents: data.notify_parents,
          custom_message: data.custom_message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reset passwords');
      }

      return response.json() as Promise<BulkResetResponse>;
    },
    onSuccess: (data) => {
      setResetResult(data);
      setShowResults(true);
      toast({
        title: 'Bulk Password Reset Completed',
        description: `Successfully reset ${data.data?.successful_resets || 0} passwords`,
      });
      onSuccess?.(data);
    },
    onError: (error) => {
      toast({
        title: 'Bulk Password Reset Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Filter parents based on search and filters using useMemo to prevent infinite loops
  const filteredParents = useMemo(() => {
    if (!parentsData) return [];

    return parentsData.filter((parent: Parent) => {
      const matchesSearch = !parentSearch ||
        parent.full_name.toLowerCase().includes(parentSearch.toLowerCase()) ||
        parent.phone.toLowerCase().includes(parentSearch.toLowerCase());

      const matchesRelationship = selectedRelationship === 'all' || parent.relationship === selectedRelationship;

      return matchesSearch && matchesRelationship;
    });
  }, [parentsData, parentSearch, selectedRelationship]);

  // Handle parent selection
  const handleParentToggle = (parentId: string) => {
    setSelectedParents(prev => {
      const newSelection = prev.includes(parentId)
        ? prev.filter(id => id !== parentId)
        : [...prev, parentId];

      form.setValue('parent_ids', newSelection);
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    const allIds = filteredParents.map(p => p.id);
    setSelectedParents(allIds);
    form.setValue('parent_ids', allIds);
  };

  const handleDeselectAll = () => {
    setSelectedParents([]);
    form.setValue('parent_ids', []);
  };

  const handleSubmit = async (data: BulkPasswordResetFormData) => {
    await bulkResetMutation.mutateAsync(data);
  };

  const resetForm = () => {
    form.reset();
    setSelectedParents([]);
    setResetResult(null);
    setShowResults(false);
    setParentSearch('');
    setSelectedRelationship('all');
  };

  const downloadResults = async () => {
    if (resetResult?.data?.summary_csv_url) {
      try {
        const response = await fetch(resetResult.data.summary_csv_url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `parent-password-reset-results-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        toast({
          title: 'Download Failed',
          description: 'Failed to download results file',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200/50">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            Bulk Parent Password Reset
          </h2>
          <p className="text-slate-600 font-medium">
            Reset passwords for multiple parents at once with detailed tracking and reporting
          </p>
        </div>
      </div>

      {!showResults ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Parent Selection */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200/50">
                        <Users className="h-5 w-5 text-purple-600" />
                      </div>
                      Parent Selection
                    </CardTitle>
                    <CardDescription>
                      Search, filter, and select parents for password reset
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                      {selectedParents.length} Selected
                    </Badge>
                    {selectedParents.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDeselectAll}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {/* Search and Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name or phone..."
                      value={parentSearch}
                      onChange={(e) => setParentSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={selectedRelationship} onValueChange={setSelectedRelationship}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Relationships</SelectItem>
                      <SelectItem value="Father">Father</SelectItem>
                      <SelectItem value="Mother">Mother</SelectItem>
                      <SelectItem value="Guardian">Guardian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Selection Controls */}
                <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedParents.length === filteredParents.length && filteredParents.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleSelectAll();
                        } else {
                          handleDeselectAll();
                        }
                      }}
                    />
                    <span className="text-sm font-medium text-purple-800">
                      Select all ({filteredParents.length} parents)
                    </span>
                  </div>
                  <div className="text-sm text-purple-600">
                    {selectedParents.length} of {filteredParents.length} selected
                  </div>
                </div>

                {/* Parents Table */}
                <ScrollArea className="h-96 border rounded-lg">
                  <Table>
                    <TableHeader className="bg-purple-50">
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Relationship</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Students</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredParents.map((parent: Parent) => (
                        <TableRow
                          key={parent.id}
                          className={`hover:bg-purple-50 cursor-pointer ${
                            selectedParents.includes(parent.id) ? 'bg-purple-100' : ''
                          }`}
                          onClick={() => handleParentToggle(parent.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedParents.includes(parent.id)}
                              onCheckedChange={() => handleParentToggle(parent.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{parent.full_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {parent.relationship}
                            </Badge>
                          </TableCell>
                          <TableCell className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {parent.phone}
                          </TableCell>
                          <TableCell className="text-sm">
                            {parent.email ? (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {parent.email}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {parent.linked_students !== undefined ? parent.linked_students : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredParents.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No parents found matching your criteria
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Reset Configuration */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200/50">
                    <Key className="h-5 w-5 text-purple-600" />
                  </div>
                  Reset Configuration
                </CardTitle>
                <CardDescription>
                  Configure the bulk password reset settings and notifications
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
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                          rows={3}
                          placeholder="Explain why this bulk password reset is necessary..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notify_parents"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-medium">Notify Parents via Email/SMS</FormLabel>
                    </FormItem>
                  )}
                />

                {form.watch('notify_parents') && (
                  <FormField
                    control={form.control}
                    name="custom_message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Message (Optional)</FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                            rows={2}
                            placeholder="Add a custom message to include in the notifications..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {selectedParents.length > 0 && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      You are about to reset passwords for {selectedParents.length} parent(s).
                      This action cannot be undone.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3">
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
                disabled={bulkResetMutation.isPending || selectedParents.length === 0}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
              >
                {bulkResetMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting Passwords...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset {selectedParents.length} Password{selectedParents.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        /* Results Display */
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-xl">
          <CardHeader className="border-b border-green-100/50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Bulk Password Reset Results
              </CardTitle>
              <div className="flex items-center gap-2">
                {resetResult?.data?.summary_csv_url && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadResults}
                    className="border-green-300 hover:bg-green-50 text-green-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="border-purple-300 hover:bg-purple-50 text-purple-700"
                >
                  Reset Another Batch
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-700">
                  {resetResult?.data?.total_processed || 0}
                </div>
                <div className="text-sm text-gray-600">Total Processed</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">
                  {resetResult?.data?.successful_resets || 0}
                </div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600">
                  {resetResult?.data?.failed_resets || 0}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
            </div>

            {/* Results Table */}
            <ScrollArea className="h-96 border rounded-lg">
              <Table>
                <TableHeader className="bg-green-50">
                  <TableRow>
                    <TableHead>Parent Name</TableHead>
                    <TableHead>Parent ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>New Password</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resetResult?.data?.results?.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{result.parent_name}</TableCell>
                      <TableCell>{result.parent_id}</TableCell>
                      <TableCell>
                        {result.success ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {result.success ? result.new_password : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {result.error || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export type { BulkPasswordResetFormData, BulkResetResponse, BulkParentPasswordResetProps };
