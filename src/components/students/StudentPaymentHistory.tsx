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

interface StudentPaymentHistoryProps {
  studentId: string;
  studentName: string;
}

export const StudentPaymentHistory = ({ studentId, studentName }: StudentPaymentHistoryProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [studentDatabaseId, setStudentDatabaseId] = useState<string | null>(null);
  const { selectedBranch } = useBranch();

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

      console.log('Fetching payments for student:', {
        studentId,
        databaseId: student.id,
        selectedBranch
      });

      // Get payments filtered by student's database ID - only call once
      const paymentsResp = await apiClient.getRegistrationPayments(selectedBranch!, student.id);

      if (paymentsResp.error) throw new Error(paymentsResp.error as string);

      console.log('API response:', paymentsResp.data);

      // Handle paginated response format
      // The API returns { payments: [...], total: X, page: Y, ... }
      const payments = Array.isArray(paymentsResp.data) ? paymentsResp.data : (paymentsResp.data?.payments || []);

      console.log('Extracted payments:', payments);
      
      // Map payments to our display format
      const mappedPayments = payments.map(payment => {
        console.log('Processing payment:', payment);

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
          academic_year: payment.academic_year || 'Unknown',
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

      console.log('Final payments:', {
        count: allPayments.length,
        payments: allPayments
      });

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
    <div className="space-y-6 p-6">
      {/* Premium Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Paid</p>
                <p className="text-3xl font-bold mt-1">${totalPaid.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-full">
                <DollarSign className="h-8 w-8" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-300 to-emerald-400" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Amount</p>
                <p className="text-3xl font-bold mt-1">${totalAmount.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-full">
                <Receipt className="h-8 w-8" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-300 to-blue-400" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Remaining</p>
                <p className="text-3xl font-bold mt-1">${remainingAmount.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-full">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-300 to-orange-400" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Payment Records</p>
                <p className="text-3xl font-bold mt-1">{payments?.length || 0}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-full">
                <CreditCard className="h-8 w-8" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-300 to-purple-400" />
          </CardContent>
        </Card>
      </div>

      {/* Premium Payment Status Overview */}
      <Card className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100/50">
          <CardTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-indigo-600" />
            </div>
            <span className="bg-gradient-to-r from-indigo-800 to-indigo-600 bg-clip-text text-transparent">
              Payment Status Overview
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold text-lg">✓</span>
              </div>
              <p className="text-sm font-medium text-emerald-600 mb-1">Paid</p>
              <p className="text-3xl font-bold text-emerald-900">{paidPayments}</p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold text-lg">◐</span>
              </div>
              <p className="text-sm font-medium text-amber-600 mb-1">Partial</p>
              <p className="text-3xl font-bold text-amber-900">{partialPayments}</p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold text-lg">✗</span>
              </div>
              <p className="text-sm font-medium text-red-600 mb-1">Unpaid</p>
              <p className="text-3xl font-bold text-red-900">{unpaidPayments}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Premium Payment History */}
      <Card className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-100/50">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Receipt className="h-6 w-6 text-slate-600" />
              </div>
              <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
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
        <CardContent className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading payment history...</p>
            </div>
          ) : !payments || payments.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No payment records found</p>
              <p className="text-gray-500 text-sm mb-4">Start by recording the first payment</p>
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
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
                  <TableHead>Cycle</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Academic Year</TableHead>
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
                          ${(Number(payment.amount_paid) || 0).toFixed(2)}
                        </span>
                        {payment.total_amount && Number(payment.total_amount) !== Number(payment.amount_paid) && (
                          <div className="text-xs text-gray-500">
                            of ${(Number(payment.total_amount) || 0).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="font-medium text-blue-600">
                          ${(Number(payment.total_amount) || 0).toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className={`font-medium ${Number(payment.remaining_amount) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${(Number(payment.remaining_amount) || 0).toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(payment.payment_status || '')} variant="outline">
                        {payment.payment_status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {payment.payment_cycle ? payment.payment_cycle.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Annual'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600">
                        {payment.payment_method || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600">{payment.academic_year || 'Unknown'}</span>
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