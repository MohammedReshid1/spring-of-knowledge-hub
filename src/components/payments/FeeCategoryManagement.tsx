import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, MoreHorizontal, Tag, DollarSign, Calendar, Users, ToggleLeft, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import type { FeeCategory, GradeLevelTier } from '@/types/api';

const feeCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  base_amount: z.number().min(0, 'Base amount must be positive'),
  use_tiers: z.boolean().default(false),
  is_active: z.boolean().default(true),
  is_mandatory: z.boolean().default(false),
  due_period: z.enum(['monthly', 'quarterly', 'annually', 'one_time'], {
    required_error: 'Due period is required'
  }),
  late_fee_amount: z.number().min(0).optional(),
  late_fee_days: z.number().min(1).optional(),
  grade_levels: z.array(z.string()).optional(),
});

type FeeCategoryFormData = z.infer<typeof feeCategorySchema>;

interface FeeCategoryFormProps {
  category?: FeeCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function FeeCategoryForm({ category, open, onOpenChange, onSuccess }: FeeCategoryFormProps) {
  const { selectedBranch } = useBranch();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const queryClient = useQueryClient();

  // Fetch grade levels for the selected branch
  const { data: gradeLevelsData = [] } = useQuery({
    queryKey: ['grade-levels', branchId],
    queryFn: () => branchId ? apiClient.getGradeLevelsByBranch(branchId) : apiClient.getGradeLevels(),
    enabled: open, // Only fetch when dialog is open
    select: (resp) => {
      const items = (resp as any).data || (resp as any) || [];
      // Extract grade names from the response
      return items.map((item: any) => item.grade || item.name || item).filter(Boolean);
    },
  });

  const GRADE_LEVELS = gradeLevelsData.length > 0 ? gradeLevelsData : [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  ];

  const form = useForm<FeeCategoryFormData>({
    resolver: zodResolver(feeCategorySchema),
    defaultValues: {
      name: category?.name || '',
      description: category?.description || '',
      base_amount: category?.base_amount || 0,
      use_tiers: category?.grade_level_tiers && category.grade_level_tiers.length > 0,
      is_active: category?.is_active ?? true,
      is_mandatory: category?.is_mandatory ?? false,
      due_period: category?.due_period || 'monthly',
      late_fee_amount: category?.late_fee_amount || 0,
      late_fee_days: category?.late_fee_days || 30,
      grade_levels: category?.grade_levels || [],
    },
  });

  const isEditing = !!category;

  // State for managing grade level tiers
  const [tiers, setTiers] = useState<GradeLevelTier[]>(
    category?.grade_level_tiers || []
  );
  const useTiers = form.watch('use_tiers');

  // Ensure form values reflect the selected category when opening edit
  useEffect(() => {
    if (!open) return;
    form.reset({
      name: category?.name || '',
      description: category?.description || '',
      base_amount: category?.base_amount || 0,
      use_tiers: category?.grade_level_tiers && category.grade_level_tiers.length > 0,
      is_active: category?.is_active ?? true,
      is_mandatory: category?.is_mandatory ?? false,
      due_period: category?.due_period || 'monthly',
      late_fee_amount: category?.late_fee_amount || 0,
      late_fee_days: category?.late_fee_days || 30,
      grade_levels: category?.grade_levels || [],
    });
    // Convert tier amounts from strings to numbers if needed
    const tiersData = category?.grade_level_tiers?.map(tier => ({
      ...tier,
      amount: typeof tier.amount === 'string' ? Number(tier.amount) : tier.amount
    })) || [];
    setTiers(tiersData);
  }, [category, open, form]);

  // Helper functions for tier management
  const addTier = () => {
    setTiers([...tiers, { grade_levels: [], amount: 0 }]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTierGrades = (index: number, grades: string[]) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], grade_levels: grades };
    setTiers(newTiers);
  };

  const updateTierAmount = (index: number, amount: number) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], amount };
    setTiers(newTiers);
  };

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: (data: FeeCategoryFormData) => {
      const payload: any = {
        ...data,
        branch_id: branchId,
        academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      };

      // Remove use_tiers from payload as it's not a backend field
      delete payload.use_tiers;
      delete payload.base_amount;

      // If using tiers, include grade_level_tiers and don't send amount
      if (data.use_tiers && tiers.length > 0) {
        payload.grade_level_tiers = tiers;
        // Don't include amount field at all when using tiers
        delete payload.amount;
      } else {
        payload.grade_level_tiers = null;
        payload.amount = data.base_amount;
      }

      if (isEditing) {
        return apiClient.updateFeeCategory(category.id, payload);
      } else {
        return apiClient.createFeeCategory(payload);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: `Fee category ${isEditing ? 'updated' : 'created'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['fee-categories'] });
      onOpenChange(false);
      onSuccess?.();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} fee category`,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: FeeCategoryFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-white/95 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-xl">
        {/* Premium Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

        <DialogHeader className="relative pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
              <Tag className="h-5 w-5 text-blue-600" />
            </div>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
              {isEditing ? 'Edit Fee Category' : 'Create Fee Category'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-600 leading-relaxed">
            {isEditing ? 'Update fee category details and settings' : 'Create a new fee category for your school with advanced configuration options'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="relative space-y-8">
            {/* Premium Form Container */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

              <div className="relative p-6 space-y-6">
                <h3 className="text-lg font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">Basic Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Tuition Fee, Lab Fee" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="base_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Amount *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                        disabled={useTiers}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Optional description of the fee category"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Toggle for using tiers */}
                <FormField
                  control={form.control}
                  name="use_tiers"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-4 rounded-xl bg-blue-50/50 border border-blue-200/50">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-semibold">Use Grade Level Tiers</FormLabel>
                        <div className="text-sm text-slate-600">
                          Enable different amounts for different grade levels
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              setTiers([]);
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Grade Level Tiers Section */}
                {useTiers && (
                  <div className="space-y-4 p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border border-blue-200/50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-semibold text-slate-700">Grade Level Tiers</h4>
                      <Button
                        type="button"
                        onClick={addTier}
                        variant="outline"
                        size="sm"
                        className="bg-white hover:bg-blue-50 border-blue-200"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Tier
                      </Button>
                    </div>

                    {tiers.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No tiers added yet. Click "Add Tier" to create your first tier.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tiers.map((tier, index) => (
                          <div
                            key={index}
                            className="p-4 rounded-lg bg-white border border-slate-200 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-700">
                                Tier {index + 1}
                              </span>
                              <Button
                                type="button"
                                onClick={() => removeTier(index)}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Grade Levels Selection */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                  Grade Levels *
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                  {GRADE_LEVELS.map((grade) => (
                                    <label
                                      key={grade}
                                      className="flex items-center space-x-2 p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={tier.grade_levels.includes(grade)}
                                        onChange={(e) => {
                                          const currentGrades = tier.grade_levels || [];
                                          const newGrades = e.target.checked
                                            ? [...currentGrades, grade]
                                            : currentGrades.filter(g => g !== grade);
                                          updateTierGrades(index, newGrades);
                                        }}
                                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                      />
                                      <span className="text-sm font-medium text-slate-700">
                                        {grade}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Amount Input */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                  Amount *
                                </label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={tier.amount || ''}
                                  onChange={(e) =>
                                    updateTierAmount(index, Number(e.target.value) || 0)
                                  }
                                  className="bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Premium Configuration Section */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

              <div className="relative p-6 space-y-6">
                <h3 className="text-lg font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">Payment Configuration</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="due_period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Period *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select due period" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                        <SelectItem value="one_time">One Time</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Active</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_mandatory"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Mandatory</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                </div>
              </div>
              </div>
            </div>

            {/* Premium Late Fee Section */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

              <div className="relative p-6 space-y-6">
                <h3 className="text-lg font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">Late Fee Configuration</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="late_fee_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Late Fee Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="late_fee_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Late Fee After (Days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="30"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
              </div>
            </div>

            {/* Premium Grade Levels Section */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

              <div className="relative p-6 space-y-6">
                <h3 className="text-lg font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">Grade Level Settings</h3>

                <FormField
                  control={form.control}
                  name="grade_levels"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Applicable Grade Levels (Optional)</FormLabel>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                        {GRADE_LEVELS.map((grade) => (
                          <label key={grade} className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.value?.includes(grade) || false}
                              onChange={(e) => {
                                const current = field.value || [];
                                if (e.target.checked) {
                                  field.onChange([...current, grade]);
                                } else {
                                  field.onChange(current.filter(g => g !== grade));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-slate-700">{grade}</span>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="relative pt-6 border-t border-slate-200/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="bg-white/80 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 shadow-sm hover:shadow-md transition-all duration-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {mutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Tag className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
                    {isEditing ? 'Update Category' : 'Create Category'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function FeeCategoryManagement() {
  const { selectedBranch, isSuperAdmin } = useBranch();
  const { hasPermission, isSuperSuperAdmin } = useRoleAccess();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const queryClient = useQueryClient();

  // Permission check
  const canManage = isSuperSuperAdmin || hasPermission('payment.manage');

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FeeCategory | undefined>();
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; category?: FeeCategory }>({ open: false });

  // Fetch fee categories
  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ['fee-categories', branchId ?? 'all'],
    queryFn: () => apiClient.getFeeCategories({
      branch_id: branchId,
    }),
    enabled: !!selectedBranch,
    select: (resp) => (resp as any).data || (resp as any).items || [],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => apiClient.deleteFeeCategory(categoryId),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Fee category deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['fee-categories'] });
      setDeleteDialog({ open: false });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete fee category',
        variant: 'destructive',
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) =>
      apiClient.updateFeeCategory(categoryId, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-categories'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update category status',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (category: FeeCategory) => {
    setEditingCategory(category);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingCategory(undefined);
    setFormOpen(true);
  };

  const handleDelete = (category: FeeCategory) => {
    setDeleteDialog({ open: true, category });
  };

  const confirmDelete = () => {
    if (deleteDialog.category) {
      deleteMutation.mutate(deleteDialog.category.id);
    }
  };

  const toggleActive = (category: FeeCategory) => {
    toggleActiveMutation.mutate({
      categoryId: category.id,
      isActive: !category.is_active,
    });
  };

  const getDuePeriodBadge = (period: string) => {
    const periodConfig: Record<string, { bg: string; text: string; icon: string }> = {
      monthly: { bg: 'bg-gradient-to-r from-blue-100 to-cyan-100 border-blue-200', text: 'text-blue-800', icon: '📅' },
      quarterly: { bg: 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-200', text: 'text-green-800', icon: '📊' },
      annually: { bg: 'bg-gradient-to-r from-purple-100 to-violet-100 border-purple-200', text: 'text-purple-800', icon: '🗓️' },
      one_time: { bg: 'bg-gradient-to-r from-orange-100 to-amber-100 border-orange-200', text: 'text-orange-800', icon: '⚡' },
    };

    const config = periodConfig[period] || periodConfig.monthly;

    return (
      <Badge
        variant="outline"
        className={`${config.bg} ${config.text} border font-medium px-3 py-1 text-xs flex items-center gap-1.5 w-fit`}
      >
        <span className="text-xs">{config.icon}</span>
        {period.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Failed to load fee categories</p>
        </CardContent>
      </Card>
    );
  }

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

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }

        .animate-pulseGlow {
          animation: pulseGlow 2s infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Main Content */}
        <div className="relative z-10 space-y-8 px-6 py-16">
          <div className="mx-auto max-w-7xl space-y-8">
            {/* Premium Header */}
            <div className="relative">
              {/* Background card with glass morphism */}
              <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>

              <Card className="relative bg-transparent border-0 shadow-none">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                  <Tag className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                    Fee Category Management
                  </CardTitle>
                  <p className="text-slate-600 leading-relaxed">Configure and manage fee categories with advanced pricing settings</p>
                </div>
              </div>
              {canManage && (
                <Button
                  onClick={handleCreate}
                  className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                  Add Category
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Premium Categories Table */}
      <div className="relative">
          {/* Premium glass card background */}
          <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

          <Card className="relative bg-transparent border-0 shadow-none">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent flex items-center gap-3">
                  Fee Categories
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200/50">
                    {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    {categories.filter(c => c.is_active).length} Active
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    {categories.filter(c => c.is_mandatory).length} Mandatory
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              {isLoading ? (
                <div className="text-center py-16">
                  <div className="relative mx-auto w-16 h-16">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 opacity-20 animate-pulse" />
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-blue-500 border-r-indigo-500"></div>
                  </div>
                  <p className="text-slate-600 mt-6 font-medium animate-pulse">Loading categories...</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-16">
                  <div className="relative mx-auto w-16 h-16 mb-6">
                    <div className="absolute inset-0 bg-slate-200 rounded-full blur-lg" />
                    <Tag className="relative h-16 w-16 text-slate-400 mx-auto" />
                  </div>
                  <p className="text-slate-600 font-semibold text-lg">No fee categories found</p>
                  <p className="text-slate-400 text-sm mt-2">Create your first category to get started</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/30 bg-white/50 backdrop-blur-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-sm">
                      <TableRow className="border-white/40 hover:bg-blue-50/30 transition-colors duration-300">
                        <TableHead className="font-semibold text-slate-700 py-4">Category Name</TableHead>
                        <TableHead className="font-semibold text-slate-700 py-4">Base Amount</TableHead>
                        <TableHead className="font-semibold text-slate-700 py-4">Due Period</TableHead>
                        <TableHead className="font-semibold text-slate-700 py-4">Grade Levels</TableHead>
                        <TableHead className="font-semibold text-slate-700 py-4">Status</TableHead>
                        <TableHead className="font-semibold text-slate-700 py-4">Properties</TableHead>
                        <TableHead className="font-semibold text-slate-700 py-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category: FeeCategory, index) => (
                        <TableRow
                          key={category.id}
                          className="border-white/30 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30 transition-all duration-300 group"
                        >
                          <TableCell className="py-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-400 opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <span className="font-semibold text-slate-700 group-hover:text-blue-700 transition-colors duration-300">{category.name}</span>
                              </div>
                              {category.description && (
                                <span className="text-sm text-slate-500 ml-4">
                                  {category.description}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono py-4">
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <div className="absolute inset-0 bg-green-500/20 rounded-lg blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="relative p-1 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50">
                                  <DollarSign className="h-4 w-4 text-green-600" />
                                </div>
                              </div>
                              <div className="flex flex-col">
                                {category.grade_level_tiers && category.grade_level_tiers.length > 0 ? (
                                  <>
                                    <span className="text-sm font-semibold text-blue-600">
                                      Tiered Pricing
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {category.grade_level_tiers.length} tiers
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-lg font-bold text-slate-700 group-hover:text-blue-700 transition-colors duration-300">
                                    ${category.base_amount.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            {getDuePeriodBadge(category.due_period)}
                          </TableCell>
                          <TableCell className="py-4">
                            {category.grade_levels && category.grade_levels.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {category.grade_levels.slice(0, 2).map((grade) => (
                                  <Badge key={grade} variant="outline" className="text-xs bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200/50 text-blue-700 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300">
                                    {grade}
                                  </Badge>
                                ))}
                                {category.grade_levels.length > 2 && (
                                  <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 text-slate-600">
                                    +{category.grade_levels.length - 2}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm font-medium italic">All grades</span>
                            )}
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge
                              variant="outline"
                              className={category.is_active
                                ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-200 text-green-800 font-medium px-3 py-1 flex items-center gap-1.5 w-fit'
                                : 'bg-gradient-to-r from-gray-100 to-slate-100 border-gray-200 text-gray-600 font-medium px-3 py-1 flex items-center gap-1.5 w-fit'
                              }
                            >
                              <div className={`w-2 h-2 rounded-full ${category.is_active ? 'bg-green-500' : 'bg-gray-500'} animate-pulse`} />
                              {category.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-wrap gap-2 min-h-[28px]">
                              {category.is_mandatory ? (
                                <Badge variant="outline" className="bg-gradient-to-r from-red-100 to-rose-100 border-red-200 text-red-800 font-medium px-2 py-1 text-xs flex items-center gap-1">
                                  <span>🔒</span>
                                  Mandatory
                                </Badge>
                              ) : null}
                              {category.late_fee_amount && category.late_fee_amount > 0 ? (
                                <Badge variant="outline" className="bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-200 text-yellow-800 font-medium px-2 py-1 text-xs flex items-center gap-1">
                                  <span>⏰</span>
                                  Late Fee
                                </Badge>
                              ) : null}
                              {!category.is_mandatory && (!category.late_fee_amount || category.late_fee_amount <= 0) ? (
                                <span className="text-sm text-slate-400">—</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-4">
                            <div className="flex items-center justify-end space-x-2">
                              {canManage && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(category)}
                                    className="opacity-60 group-hover:opacity-100 hover:bg-blue-100 hover:text-blue-600 transition-all duration-300 h-10 w-10 rounded-lg"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(category)}
                                    className="opacity-60 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all duration-300 h-10 w-10 rounded-lg"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      {/* Create/Edit Form */}
      <FeeCategoryForm
        category={editingCategory}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => setEditingCategory(undefined)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fee Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.category?.name}"?
              This will affect any existing payments using this category.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Category'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
          </div>
        </div>
      </div>
    </>
  );
}
