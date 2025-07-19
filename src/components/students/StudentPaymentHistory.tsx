import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CreditCard, Plus, DollarSign, Calendar, Receipt, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { EnhancedPaymentForm } from '../payments/EnhancedPaymentForm';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

interface StudentPaymentHistoryProps {
  studentId: string;
  studentName: string;
}

export const StudentPaymentHistory = ({ studentId, studentName }: StudentPaymentHistoryProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('registration_payments')
        .delete()
        .eq('id', paymentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment record deleted successfully",
      });
      // Refresh the payment data
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete payment: " + error.message,
        variant: "destructive",
      });
    }
  });

  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ['student-payments', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registration_payments')
        .select(`
          *,
          payment_mode:payment_id (
            name,
            payment_type,
            payment_data
          )
        `)
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const getStatusColor = (status: string) => {
    const colors = {
      'Paid': 'bg-green-100 text-green-800',
      'Unpaid': 'bg-red-100 text-red-800',
      'Partially Paid': 'bg-yellow-100 text-yellow-800',
      'Waived': 'bg-blue-100 text-blue-800',
      'Refunded': 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const totalPaid = payments?.filter(p => p.payment_status === 'Paid')
    .reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;

  const totalAmount = payments?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;

  return (
    <div className="space-y-4">
      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-green-600">Total Paid</p>
                <p className="text-xl font-bold text-green-900">${totalPaid.toFixed(2)}</p>
              </div>
              <DollarSign className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-600">Total Amount</p>
                <p className="text-xl font-bold text-blue-900">${totalAmount.toFixed(2)}</p>
              </div>
              <Receipt className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-600">Payment Records</p>
                <p className="text-xl font-bold text-purple-900">{payments?.length || 0}</p>
              </div>
              <CreditCard className="h-6 w-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Payment History - {studentName}</CardTitle>
          <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
            <SheetTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Record Payment for {studentName}</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <EnhancedPaymentForm
                  studentId={studentId}
                  payment={editingPayment}
                  onSuccess={() => {
                    setIsFormOpen(false);
                    setEditingPayment(null);
                    refetch();
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </CardHeader>
        <CardContent>
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
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
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
                      <span className="font-medium text-green-600">
                        ${payment.amount_paid?.toFixed(2) || '0.00'}
                      </span>
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
                        {payment.payment_mode?.name || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600">{payment.academic_year || 'Unknown'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600 text-sm">
                        {payment.notes || 'No notes'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingPayment(payment);
                            setIsFormOpen(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this payment record?')) {
                              deletePaymentMutation.mutate(payment.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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