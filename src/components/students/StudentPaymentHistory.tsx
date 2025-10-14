import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CreditCard, Plus, DollarSign, Calendar, Receipt, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { PaymentForm } from '../payments/PaymentForm';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { useCurrency } from '@/hooks/useSystemSettings';
import { formatCurrency } from '@/utils/currency';

interface StudentPaymentHistoryProps {
  studentId: string;
  studentName: string;
}

export const StudentPaymentHistory = ({ studentId, studentName }: StudentPaymentHistoryProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [studentDatabaseId, setStudentDatabaseId] = useState<string | null>(null);
  const { selectedBranch } = useBranch();
  const currency = useCurrency();

  // Delete mutation commented out - backend doesn't support payment deletion
  // const deletePaymentMutation = useMutation({
  //   mutationFn: async (paymentId: string) => {
  //     // Try to delete as registration payment first, then as fee
  //     try {
  //       const { error } = await apiClient.deleteRegistrationPayment(paymentId);
  //       if (error) throw new Error(error as string);
  //     } catch (error) {
  //       // If registration payment deletion fails, try fee deletion
  //       const { error: feeError } = await apiClient.deleteFee(paymentId);
  //       if (feeError) throw new Error(feeError as string);
  //     }
  //   },
  //   onSuccess: () => {
  //     toast({
  //       title: "Success",
  //       description: "Payment record deleted successfully",
  //     });
  //     // Refresh the payment data
  //     refetch();
  //   },
  //   onError: (error) => {
  //     toast({
  //       title: "Error",
  //       description: "Failed to delete payment: " + error.message,
  //       variant: "destructive",
  //     });
  //   }
  // });

  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ['student-payments', studentId, selectedBranch],
    enabled: !!selectedBranch && !!studentId,
    queryFn: async () => {
      // First get the student data to find the database ID
      const { data: students } = await apiClient.getAllStudents();
      const student = students?.find(s => s.student_id === studentId);

      if (!student) {
        console.warn(`Student not found with ID: ${studentId}`);
        return [];
      }

      // Store the database ID for use in PaymentForm
      setStudentDatabaseId(student.id);

        // Student payment query data logged for debugging

      // Get payments for this student using database ID - the API returns { payments: [...] } format
      const paymentsResp = await apiClient.getRegistrationPayments(selectedBranch!, student.id);

      if (paymentsResp.error) throw new Error(paymentsResp.error as string);

      // Handle response format - API returns { payments: [...] } structure
      const payments = paymentsResp.data?.payments || [];

      
      // Map payments to our display format
      const mappedPayments = payments.map(payment => {

        return {
          id: payment.id || payment._id,
          student_id: payment.student_id,
          // Check for 'amount' field which is the amount paid
          amount_paid: Number(payment.amount) || Number(payment.amount_paid) || 0,
          // For total, check various possible fields
          total_amount: Number(payment.total_amount) || Number(payment.amount) || 0,
          remaining_amount: Number(payment.remaining_amount) || 0,
          payment_date: payment.payment_date || payment.paid_date || payment.due_date || payment.created_at,
          // Map status correctly - check for 'status' field
          payment_status: payment.status === 'completed' ? 'Paid' :
                         payment.status === 'pending' ? 'Unpaid' :
                         payment.status === 'partial' ? 'Partial' :
                         payment.payment_status || 'Unknown',
          payment_cycle: payment.payment_cycle || payment.fee_type || 'Annual',
          payment_method: payment.payment_method || 'Cash',
          notes: payment.notes || payment.remarks || 'No notes',
          created_at: payment.created_at,
          updated_at: payment.updated_at || payment.created_at
        };
      });

      // Sort all payments by date
      const allPayments = mappedPayments
        .sort((a, b) => new Date(b.payment_date || '').getTime() - new Date(a.payment_date || '').getTime());

      // Payment summary logged for debugging

      return allPayments;
    }
  });

  const getStatusColor = (status: string) => {
    const colors = {
      'Paid': 'bg-green-100 text-green-800',
      'Unpaid': 'bg-red-100 text-red-800',
      'Partial': 'bg-yellow-100 text-yellow-800',
      'Partially Paid': 'bg-yellow-100 text-yellow-800',
      'Waived': 'bg-blue-100 text-blue-800',
      'Refunded': 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const totalPaid = payments?.reduce((sum, p) => {
    const amount = Number(p.amount_paid) || 0;
    return sum + amount;
  }, 0) || 0;

  const totalAmount = payments?.reduce((sum, p) => {
    const amount = Number(p.total_amount || p.amount_paid) || 0;
    return sum + amount;
  }, 0) || 0;

  const remainingAmount = totalAmount - totalPaid;

  const partialPayments = payments?.filter(p => p.payment_status === 'Partial').length || 0;
  const paidPayments = payments?.filter(p => p.payment_status === 'Paid').length || 0;
  const unpaidPayments = payments?.filter(p => p.payment_status === 'Unpaid').length || 0;

  if (!selectedBranch) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Please select a branch to view payment history</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Compact Payment Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/60 via-white/40 to-emerald-50/30 border border-white/30 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-md" />
              <DollarSign className="relative h-8 w-8 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-600/70 uppercase tracking-wide">Paid</p>
              <p className="text-lg font-bold bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent truncate">{formatCurrency(totalPaid, currency)}</p>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/60 via-white/40 to-blue-50/30 border border-white/30 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-md" />
              <Receipt className="relative h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-600/70 uppercase tracking-wide">Total</p>
              <p className="text-lg font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent truncate">{formatCurrency(totalAmount, currency)}</p>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/60 via-white/40 to-orange-50/30 border border-white/30 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-md" />
              <AlertCircle className="relative h-8 w-8 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-orange-600/70 uppercase tracking-wide">Due</p>
              <p className="text-lg font-bold bg-gradient-to-r from-orange-700 to-red-600 bg-clip-text text-transparent truncate">{formatCurrency(remainingAmount, currency)}</p>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/60 via-white/40 to-slate-50/30 border border-white/30 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-slate-500/20 rounded-full blur-md" />
              <CreditCard className="relative h-8 w-8 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-600/70 uppercase tracking-wide">Count</p>
              <p className="text-lg font-bold bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">{payments?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Status Badges */}
      <div className="flex items-center justify-center gap-4 py-3 backdrop-blur-glass bg-gradient-to-br from-white/60 via-white/40 to-white/30 border border-white/30 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
          <span className="text-sm font-medium text-slate-700">{paidPayments} Paid</span>
        </div>
        <div className="w-px h-4 bg-slate-300"></div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
          <span className="text-sm font-medium text-slate-700">{partialPayments} Partial</span>
        </div>
        <div className="w-px h-4 bg-slate-300"></div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-sm font-medium text-slate-700">{unpaidPayments} Unpaid</span>
        </div>
      </div>

      {/* Premium Payment History */}
      <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-lg transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-500/[0.02] via-gray-500/[0.02] to-zinc-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardHeader className="relative">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="relative">
                <div className="absolute inset-0 bg-slate-500/20 rounded-full blur-lg" />
                <Receipt className="relative h-6 w-6 text-slate-600" />
              </div>
              <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                Payment History - {studentName}
              </span>
            </CardTitle>
            <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
              <SheetTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Record Payment for {studentName}</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <PaymentForm
                    studentId={studentDatabaseId || undefined}
                    onSuccess={() => {
                      setIsFormOpen(false);
                      refetch();
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent className="relative p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="relative mx-auto w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 animate-pulse" />
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-blue-500 border-r-indigo-500"></div>
              </div>
              <p className="text-slate-600 font-medium animate-pulse">Loading payment history...</p>
            </div>
          ) : !payments || payments.length === 0 ? (
            <div className="text-center py-12">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-slate-200/50 rounded-full blur-xl" />
                <div className="relative w-20 h-20 backdrop-blur-glass bg-gradient-to-br from-white/60 via-white/40 to-slate-50/30 border border-white/30 rounded-full flex items-center justify-center shadow-lg">
                  <Receipt className="h-10 w-10 text-slate-400" />
                </div>
              </div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent mb-2">No Payment Records</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">This student doesn't have any payment history yet. Record the first payment to get started.</p>
              <Button
                onClick={() => setIsFormOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-2" />
                Record First Payment
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        {payment.payment_date
                          ? format(new Date(payment.payment_date), 'MMM dd, yyyy')
                          : 'No date'
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="font-medium text-green-600">
                          {formatCurrency(Number(payment.amount_paid) || 0, currency)}
                        </span>
                        {payment.total_amount && Number(payment.total_amount) !== Number(payment.amount_paid) && (
                          <div className="text-xs text-gray-500">
                            of {formatCurrency(Number(payment.total_amount) || 0, currency)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="font-medium text-blue-600">
                          {formatCurrency(Number(payment.total_amount) || 0, currency)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className={`font-medium ${Number(payment.remaining_amount) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(Number(payment.remaining_amount) || 0, currency)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(payment.payment_status || '')} variant="outline">
                        {payment.payment_status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600">
                        {payment.payment_method || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="text-gray-600 text-sm">
                          {payment.notes || 'No notes'}
                        </span>
                        {payment.payment_history && payment.payment_history.length > 1 && (
                          <div className="text-xs text-blue-600">
                            {payment.payment_history.length} payments
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};