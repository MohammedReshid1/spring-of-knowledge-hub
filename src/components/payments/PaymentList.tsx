import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Filter, MoreHorizontal, Eye, Edit, Receipt, Ban, RotateCcw, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import type { Payment } from '@/types/api';
import { useCurrency } from '@/hooks/useSystemSettings';
import { formatCurrency } from '@/utils/currency';

interface PaymentListProps {
  onEditPayment?: (payment: Payment) => void;
  onViewDetails?: (payment: Payment) => void;
}

const PAYMENT_STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'partial', label: 'Partial' },
];

const PAYMENT_METHODS = [
  { value: 'all', label: 'All Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' },
];

export function PaymentList({ onEditPayment, onViewDetails }: PaymentListProps) {
  const { selectedBranch } = useBranch();
  const { hasPermission, isSuperSuperAdmin } = useRoleAccess();
  const { user } = useAuth();
  const currency = useCurrency();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  // Only enable queries when a specific branch is selected; backend requires branch_id
  const enableQueries = !!selectedBranch && selectedBranch !== 'all';
  const queryClient = useQueryClient();

  // Parent detection and filtering
  const isParent = user?.role === 'parent';
  const parentId = (user as any)?.parent_id;

  // Permission checks
  const canUpdate = isSuperSuperAdmin || hasPermission('payment.update');
  const canDelete = isSuperSuperAdmin || hasPermission('payment.delete');
  const canApprove = isSuperSuperAdmin || hasPermission('payment.approve');

  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Dialog states
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; payment?: Payment }>({ open: false });
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; payment?: Payment; amount?: number; reason?: string }>({ open: false });

  // Build query parameters
  const queryParams = useMemo(() => {
    const params: any = {
      skip: (currentPage - 1) * pageSize,
      limit: pageSize,
    };

    if (isParent && parentId) params.parent_id = parentId;
    if (branchId) params.branch_id = branchId;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (methodFilter !== 'all') params.payment_method = methodFilter;
    if (dateFromFilter) params.date_from = dateFromFilter;
    if (dateToFilter) params.date_to = dateToFilter;
    if (searchTerm.trim()) {
      // Search in student names, receipt numbers, reference numbers
      params.search = searchTerm.trim();
    }

    return params;
  }, [isParent, parentId, branchId, statusFilter, methodFilter, dateFromFilter, dateToFilter, searchTerm, currentPage, pageSize]);

  // Fetch payments
  const { data: paymentsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['payments', { ...queryParams, branch_id: branchId ?? 'all' }],
    queryFn: () => apiClient.getPayments({ ...queryParams, branch_id: branchId }),
    enabled: enableQueries,
  });

  const paymentsPayload: any = paymentsResponse?.data;
  const payments: Payment[] = Array.isArray(paymentsPayload)
    ? paymentsPayload
    : (paymentsPayload?.payments || paymentsPayload?.data || paymentsPayload?.items || paymentsPayload?.results || []);
  const totalCount: number = Array.isArray(paymentsPayload)
    ? paymentsPayload.length
    : (paymentsPayload?.total ?? paymentsPayload?.count ?? payments.length);
  const totalPages = Math.ceil(totalCount / pageSize);

  // Normalize payments to ensure an id exists
  const normalizedPayments = useMemo(() => {
    return (payments as any[]).map((p) => ({
      ...p,
      id: p.id ?? p._id ?? p.receipt_number ?? Math.random().toString(36).slice(2),
    }));
  }, [payments]);

  // Cancel payment mutation
  const cancelPaymentMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      apiClient.cancelPayment(paymentId, reason),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Payment cancelled successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setCancelDialog({ open: false });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel payment',
        variant: 'destructive',
      });
    },
  });

  // Refund payment mutation
  const refundPaymentMutation = useMutation({
    mutationFn: ({ paymentId, amount, reason }: { paymentId: string; amount: number; reason: string }) =>
      apiClient.refundPayment(paymentId, { amount, reason }),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Payment refunded successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setRefundDialog({ open: false });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to refund payment',
        variant: 'destructive',
      });
    },
  });

  // Download receipt mutation
  const downloadReceiptMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      try {
        return await apiClient.generatePaymentReceipt(paymentId, 'pdf');
      } catch (e) {
        // Fallback to HTML if PDF generation not available
        return await apiClient.generatePaymentReceipt(paymentId, 'html');
      }
    },
    onSuccess: (response) => {
      if (response.data instanceof Blob) {
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        const isHtml = response.data.type?.includes('html');
        link.download = `payment-receipt.${isHtml ? 'html' : 'pdf'}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to download receipt',
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: string }> = {
      completed: { bg: 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-200', text: 'text-green-800', icon: '✓' },
      pending: { bg: 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-200', text: 'text-yellow-800', icon: '⏳' },
      cancelled: { bg: 'bg-gradient-to-r from-red-100 to-rose-100 border-red-200', text: 'text-red-800', icon: '✕' },
      refunded: { bg: 'bg-gradient-to-r from-purple-100 to-violet-100 border-purple-200', text: 'text-purple-800', icon: '↺' },
      partial: { bg: 'bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-200', text: 'text-blue-800', icon: '◐' },
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <Badge
        variant="outline"
        className={`${config.bg} ${config.text} border font-semibold px-3 py-1 text-xs flex items-center gap-1.5 w-fit`}
      >
        <span className="text-xs">{config.icon}</span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPaymentMethodBadge = (method: string) => {
    const methodConfig: Record<string, { bg: string; text: string; icon: string }> = {
      cash: { bg: 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-200', text: 'text-green-800', icon: '💵' },
      card: { bg: 'bg-gradient-to-r from-blue-100 to-cyan-100 border-blue-200', text: 'text-blue-800', icon: '💳' },
      bank_transfer: { bg: 'bg-gradient-to-r from-purple-100 to-indigo-100 border-purple-200', text: 'text-purple-800', icon: '🏦' },
      cheque: { bg: 'bg-gradient-to-r from-orange-100 to-amber-100 border-orange-200', text: 'text-orange-800', icon: '📋' },
      online: { bg: 'bg-gradient-to-r from-indigo-100 to-blue-100 border-indigo-200', text: 'text-indigo-800', icon: '🌐' },
    };

    const config = methodConfig[method] || methodConfig.online;

    return (
      <Badge
        variant="outline"
        className={`${config.bg} ${config.text} border font-medium px-3 py-1 text-xs flex items-center gap-1.5 w-fit`}
      >
        <span className="text-xs">{config.icon}</span>
        {method.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getStudentName = (payment: any) => {
    const s = payment?.student;
    if (!s) return 'Unknown';
    const parts = [s.first_name, s.last_name || s.father_name, s.grandfather_name].filter(Boolean);
    return parts.length ? parts.join(' ') : (s.student_id || 'Unknown');
  };

  const getFeeCategoryName = (payment: any) => {
    return payment?.fee_category?.name || payment?.category || 'Unknown';
  };

  const handleCancelPayment = (reason: string) => {
    if (cancelDialog.payment) {
      cancelPaymentMutation.mutate({
        paymentId: cancelDialog.payment.id,
        reason,
      });
    }
  };

  const handleRefundPayment = () => {
    if (refundDialog.payment && refundDialog.amount && refundDialog.reason) {
      refundPaymentMutation.mutate({
        paymentId: refundDialog.payment.id,
        amount: refundDialog.amount,
        reason: refundDialog.reason,
      });
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">Failed to load payments</p>
            <Button onClick={() => refetch()} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Premium Header and Filters */}
      <div className="relative">
        {/* Background card with glass morphism */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>

        <Card className="relative bg-transparent border-0 shadow-none">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                <Search className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                {isParent ? "My Children's Payments" : "Payment Management"}
              </CardTitle>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {isParent ? "View and track your children's payment records" : "Advanced payment tracking with comprehensive filtering and analytics"}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Premium Search */}
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl opacity-0 group-hover/search:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-500/60 group-hover/search:text-blue-600 transition-colors duration-300" />
                <Input
                  placeholder="Search by student name, receipt number, or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="group/search relative pl-12 h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
                />
              </div>
              {/* Real-time updates via WebSocket */}
            </div>

            {/* Premium Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/5 rounded-xl opacity-0 group-hover/filter:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-500/60" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="group/filter w-[160px] h-12 pl-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-4 transition-all duration-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[160px] h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-4 transition-all duration-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="From date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="w-[160px] h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-4 transition-all duration-300"
              />

              <Input
                type="date"
                placeholder="To date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="w-[160px] h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-4 transition-all duration-300"
              />

            {(statusFilter !== 'all' || methodFilter !== 'all' || dateFromFilter || dateToFilter || searchTerm) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setMethodFilter('all');
                  setDateFromFilter('');
                  setDateToFilter('');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="h-12 px-4 bg-white/80 backdrop-blur-sm border-white/40 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all duration-300"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>

      {/* Premium Payments Table */}
      <div className="relative">
        {/* Premium glass card background */}
        <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-3xl pointer-events-none"></div>

        <Card className="relative bg-transparent border-0 shadow-none">
          <CardContent className="p-8">
          {!selectedBranch ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Please select a branch to view payments</p>
            </div>
          ) : selectedBranch === 'all' ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Select a specific branch to view the payments list</p>
              <p className="text-xs text-muted-foreground mt-1">The backend requires a branch filter for payments</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/30 bg-white/50 backdrop-blur-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-sm">
                    <TableRow className="border-white/40 hover:bg-blue-50/30 transition-colors duration-300">
                      <TableHead className="font-semibold text-slate-700 py-4">Receipt #</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Student</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Fee Category</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Amount</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Method</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Date</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4">Status</TableHead>
                      <TableHead className="font-semibold text-slate-700 py-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: pageSize }).map((_, index) => (
                    <TableRow key={index} className="border-white/30 hover:bg-blue-50/20 transition-all duration-300">
                      <TableCell className="py-4"><Skeleton className="h-4 w-20 bg-blue-100/50" /></TableCell>
                      <TableCell className="py-4"><Skeleton className="h-4 w-32 bg-blue-100/50" /></TableCell>
                      <TableCell className="py-4"><Skeleton className="h-4 w-24 bg-blue-100/50" /></TableCell>
                      <TableCell className="py-4"><Skeleton className="h-4 w-16 bg-blue-100/50" /></TableCell>
                      <TableCell className="py-4"><Skeleton className="h-4 w-20 bg-blue-100/50" /></TableCell>
                      <TableCell className="py-4"><Skeleton className="h-4 w-24 bg-blue-100/50" /></TableCell>
                      <TableCell className="py-4"><Skeleton className="h-4 w-20 bg-blue-100/50" /></TableCell>
                      <TableCell className="py-4"><Skeleton className="h-4 w-8 bg-blue-100/50" /></TableCell>
                    </TableRow>
                  ))
                ) : payments.length === 0 ? (
                  <TableRow className="border-white/30">
                    <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                          <Search className="h-8 w-8 text-blue-400" />
                        </div>
                        <p className="font-medium">{isParent ? "No payments found for your children" : "No payments found matching your criteria"}</p>
                        <p className="text-sm text-slate-400">{isParent ? "Try adjusting your filters or search" : "Try adjusting your filters or search terms"}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  (normalizedPayments as Payment[]).map((payment: Payment) => (
                    <TableRow key={payment.id} className="border-white/30 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30 transition-all duration-300 group">
                      <TableCell className="font-mono text-sm text-slate-700 py-4 group-hover:text-blue-700 transition-colors duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400 opacity-60 group-hover:opacity-100 transition-opacity duration-300"></div>
                          <span className="font-semibold">{payment.receipt_number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-700 group-hover:text-blue-700 transition-colors duration-300">{getStudentName(payment)}</span>
                          {payment.student && (
                            <span className="text-sm text-slate-500 font-medium">
                              ID: {payment.student.student_id}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200/50">
                          {getFeeCategoryName(payment)}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-lg font-bold text-slate-700 group-hover:text-blue-700 transition-colors duration-300">
                            {formatCurrency(Number((payment as any).amount ?? 0), currency)}
                          </span>
                          {(() => {
                            const disc = Number((payment as any).discount_amount ?? 0);
                            return disc > 0 ? (
                              <span className="text-sm text-green-600 font-medium">
                                -{formatCurrency(disc, currency)} discount
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {getPaymentMethodBadge(payment.payment_method)}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-700 group-hover:text-blue-700 transition-colors duration-300">
                            {format(parseISO(payment.payment_date), 'MMM dd, yyyy')}
                          </span>
                          <span className="text-sm text-slate-500">
                            {format(parseISO(payment.payment_date), 'h:mm a')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-60 group-hover:opacity-100 hover:bg-blue-100 hover:text-blue-600 transition-all duration-300"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {onViewDetails && (
                              <DropdownMenuItem onClick={() => onViewDetails(payment)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            )}
                            {onEditPayment && canUpdate && (
                              <DropdownMenuItem
                                onClick={() => onEditPayment(payment)}
                                disabled={payment.status === 'cancelled' || payment.status === 'refunded'}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => downloadReceiptMutation.mutate(payment.id)}
                              disabled={downloadReceiptMutation.isPending}
                            >
                              <Receipt className="h-4 w-4 mr-2" />
                              Download Receipt
                            </DropdownMenuItem>
                            {(canDelete || canApprove) && <DropdownMenuSeparator />}
                            {payment.status === 'pending' && canDelete && (
                              <DropdownMenuItem
                                onClick={() => setCancelDialog({ open: true, payment })}
                                className="text-destructive"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Cancel Payment
                              </DropdownMenuItem>
                            )}
                            {payment.status === 'completed' && canApprove && (
                              <DropdownMenuItem
                                onClick={() => setRefundDialog({
                                  open: true,
                                  payment,
                                  amount: payment.amount,
                                  reason: ''
                                })}
                                className="text-destructive"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Refund Payment
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Advanced Pagination */}
          <div className="border-t border-white/30 bg-gradient-to-r from-white/50 to-blue-50/30 backdrop-blur-sm">
            <div className="flex items-center justify-between px-6 py-4">
              {/* Results Info and Page Size Selector */}
              <div className="flex items-center gap-6">
                <div className="text-sm text-slate-600 font-medium">
                  Showing <span className="font-bold text-blue-600">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
                  <span className="font-bold text-blue-600">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
                  <span className="font-bold text-slate-800">{totalCount}</span> payments
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 font-medium">Rows per page:</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setCurrentPage(1); // Reset to first page when changing page size
                    }}
                  >
                    <SelectTrigger className="w-20 h-8 bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-2 transition-all duration-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="bg-white/80 backdrop-blur-sm border-white/40 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all duration-300"
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="bg-white/80 backdrop-blur-sm border-white/40 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all duration-300"
                  >
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={
                            currentPage === pageNum
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                              : "bg-white/80 backdrop-blur-sm border-white/40 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all duration-300"
                          }
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="bg-white/80 backdrop-blur-sm border-white/40 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all duration-300"
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="bg-white/80 backdrop-blur-sm border-white/40 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all duration-300"
                  >
                    Last
                  </Button>
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>

      {/* Cancel Payment Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel payment {cancelDialog.payment?.receipt_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleCancelPayment('Cancelled by user')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelPaymentMutation.isPending}
            >
              {cancelPaymentMutation.isPending ? 'Cancelling...' : 'Cancel Payment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Refund Payment Dialog */}
      <AlertDialog open={refundDialog.open} onOpenChange={(open) => setRefundDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Processing refund for payment {refundDialog.payment?.receipt_number}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Refund Amount</label>
              <Input
                type="number"
                max={refundDialog.payment?.amount || 0}
                step="0.01"
                value={refundDialog.amount || ''}
                onChange={(e) => setRefundDialog(prev => ({ ...prev, amount: Number(e.target.value) }))}
                placeholder="Enter refund amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Input
                value={refundDialog.reason || ''}
                onChange={(e) => setRefundDialog(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Enter refund reason"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefundPayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={refundPaymentMutation.isPending || !refundDialog.amount || !refundDialog.reason}
            >
              {refundPaymentMutation.isPending ? 'Processing...' : 'Process Refund'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
