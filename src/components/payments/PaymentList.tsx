import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Eye, Edit, Trash2, DollarSign, CreditCard, Download, Filter, Receipt } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PaymentForm } from './PaymentForm';
import { format } from 'date-fns';

export const PaymentList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const queryClient = useQueryClient();

  // Real-time subscription for payments
  useEffect(() => {
    const channel = supabase
      .channel('payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registration_payments'
        },
        () => {
          console.log('Payments table changed, refetching...');
          queryClient.invalidateQueries({ queryKey: ['payments'] });
          queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      console.log('Fetching payments...');
      const { data, error } = await supabase
        .from('registration_payments')
        .select(`
          *,
          students:student_id (
            id,
            first_name,
            last_name,
            student_id,
            grade_level
          ),
          payment_mode:payment_id (
            name,
            payment_type,
            payment_data
          )
        `)
        .order('payment_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching payments:', error);
        throw error;
      }
      console.log('Payments fetched successfully:', data?.length);
      return data;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['payment-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registration_payments')
        .select('payment_status, amount_paid, academic_year');
      
      if (error) throw error;
      
      const totalPayments = data.length;
      const totalAmount = data.reduce((sum, payment) => sum + (payment.amount_paid || 0), 0);
      const paidPayments = data.filter(p => p.payment_status === 'Paid').length;
      const unpaidPayments = data.filter(p => p.payment_status === 'Unpaid').length;
      
      const statusCounts = data.reduce((acc, payment) => {
        const status = payment.payment_status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const yearlyStats = data.reduce((acc, payment) => {
        const year = payment.academic_year || 'Unknown';
        if (!acc[year]) {
          acc[year] = { count: 0, amount: 0 };
        }
        acc[year].count += 1;
        acc[year].amount += payment.amount_paid || 0;
        return acc;
      }, {} as Record<string, { count: number; amount: number }>);
      
      return {
        totalPayments,
        totalAmount,
        paidPayments,
        unpaidPayments,
        statusCounts,
        yearlyStats
      };
    }
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('registration_payments')
        .delete()
        .eq('id', paymentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      toast({
        title: "Success",
        description: "Payment deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete payment: " + error.message,
        variant: "destructive",
      });
    }
  });

  const exportToCSV = () => {
    if (!payments || payments.length === 0) {
      toast({
        title: "No Data",
        description: "No payments to export",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = [
      'Payment ID', 'Student Name', 'Student ID', 'Amount', 'Payment Date', 
      'Status', 'Academic Year', 'Payment Method', 'Notes'
    ];

    const csvData = payments.map(payment => [
      payment.id,
      payment.students ? `${payment.students.first_name} ${payment.students.last_name}` : 'Unknown',
      payment.students?.student_id || 'Unknown',
      payment.amount_paid || 0,
      payment.payment_date || '',
      payment.payment_status || '',
      payment.academic_year || '',
      payment.payment_mode?.name || 'Unknown',
      payment.notes || ''
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Payments exported successfully",
    });
  };

  const filteredPayments = payments?.filter(payment => {
    const studentName = payment.students 
      ? `${payment.students.first_name} ${payment.students.last_name}`.toLowerCase()
      : '';
    const studentId = payment.students?.student_id?.toLowerCase() || '';
    
    const matchesSearch = 
      studentName.includes(searchTerm.toLowerCase()) ||
      studentId.includes(searchTerm.toLowerCase()) ||
      payment.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || payment.payment_status === statusFilter;
    const matchesYear = yearFilter === 'all' || payment.academic_year === yearFilter;
    
    return matchesSearch && matchesStatus && matchesYear;
  }) || [];

  const getStatusColor = (status: string) => {
    const colors = {
      'Paid': 'bg-green-100 text-green-800 border-green-200',
      'Unpaid': 'bg-red-100 text-red-800 border-red-200',
      'Partially Paid': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Waived': 'bg-blue-100 text-blue-800 border-blue-200',
      'Refunded': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleDelete = (paymentId: string) => {
    if (confirm('Are you sure you want to delete this payment record? This action cannot be undone.')) {
      deletePaymentMutation.mutate(paymentId);
    }
  };

  const uniqueYears = [...new Set(payments?.map(p => p.academic_year).filter(Boolean))].sort();

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading payments</p>
              <p className="text-sm mt-1">{error.message}</p>
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['payments'] })}
                className="mt-4"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
          <p className="text-gray-600 mt-1">Track and manage student payment records</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
            <SheetTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-xl">
                  {editingPayment ? 'Edit Payment' : 'Record New Payment'}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <PaymentForm
                  payment={editingPayment}
                  onSuccess={() => {
                    setIsFormOpen(false);
                    setEditingPayment(null);
                    queryClient.invalidateQueries({ queryKey: ['payments'] });
                    queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-green-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-900">
                  ${stats?.totalAmount?.toFixed(2) || '0.00'}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-600">Total Payments</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.totalPayments || 0}</p>
              </div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-600">Paid</p>
                <p className="text-2xl font-bold text-emerald-900">{stats?.paidPayments || 0}</p>
              </div>
              <CreditCard className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-red-600">Unpaid</p>
                <p className="text-2xl font-bold text-red-900">{stats?.unpaidPayments || 0}</p>
              </div>
              <CreditCard className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filter Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by student name, ID, or payment ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
                <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                <SelectItem value="Waived">Waived</SelectItem>
                <SelectItem value="Refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {uniqueYears.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            Payment Records ({filteredPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading payments...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No payments found</p>
              <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Student</TableHead>
                    <TableHead className="font-semibold">Amount</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Method</TableHead>
                    <TableHead className="font-semibold">Academic Year</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">
                            {payment.students 
                              ? `${payment.students.first_name} ${payment.students.last_name}`
                              : 'Unknown Student'
                            }
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {payment.students?.student_id || 'Unknown'}
                          </div>
                          {payment.students?.grade_level && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {formatGradeLevel(payment.students.grade_level)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-green-600">
                          ${payment.amount_paid?.toFixed(2) || '0.00'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">
                          {payment.payment_date 
                            ? format(new Date(payment.payment_date), 'MMM dd, yyyy')
                            : 'No date'
                          }
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(payment.payment_status || '')} variant="outline">
                          {payment.payment_status || 'Unknown'}
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
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingPayment(payment);
                              setIsFormOpen(true);
                            }}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(payment.id)}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
  );
};