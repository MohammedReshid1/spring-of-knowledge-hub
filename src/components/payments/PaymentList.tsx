import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Eye, Edit, Trash2, DollarSign, Users, CreditCard, Filter, Calendar, Receipt } from 'lucide-react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { toast } from '@/hooks/use-toast';
import { EnhancedPaymentForm } from './EnhancedPaymentForm';
import { Link } from 'react-router-dom';
import { getHighlightedText } from '@/utils/searchHighlight';

export const PaymentList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [cycleFilter, setCycleFilter] = useState('all');
  const queryClient = useQueryClient();
  const { isRegistrar, canDelete } = useRoleAccess();

  // Get currency from system settings
  const getCurrency = () => {
    const settings = localStorage.getItem('systemSettings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.currency || 'ETB';
    }
    return 'ETB';
  };

  const formatCurrency = (amount: number) => {
    const currency = getCurrency();
    const symbols = {
      'ETB': 'ETB',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    const symbol = symbols[currency as keyof typeof symbols] || currency;
    
    // For ETB, show the symbol after the amount
    if (currency === 'ETB') {
      return `${amount.toFixed(2)} ${symbol}`;
    }
    
    return `${symbol} ${amount.toFixed(2)}`;
  };

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
            student_id,
            first_name,
            last_name,
            mother_name,
            grade_level,
            photo_url
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
        .select('payment_status, amount_paid');
      
      if (error) throw error;
      
      const totalPayments = data.length;
      const totalRevenue = data.reduce((sum, payment) => sum + (payment.amount_paid || 0), 0);
      const paidPayments = data.filter(p => p.payment_status === 'Paid').length;
      const pendingPayments = data.filter(p => p.payment_status === 'Unpaid' || p.payment_status === 'Partially Paid').length;
      
      return {
        totalPayments,
        totalRevenue,
        paidPayments,
        pendingPayments
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

  const filteredPayments = payments?.filter(payment => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      payment.students?.first_name?.toLowerCase().includes(searchLower) ||
      payment.students?.last_name?.toLowerCase().includes(searchLower) ||
      payment.students?.student_id?.toLowerCase().includes(searchLower) ||
      payment.students?.mother_name?.toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || payment.payment_status === statusFilter;
    const matchesCycle = cycleFilter === 'all' || payment.payment_cycle === cycleFilter;
    
    return matchesSearch && matchesStatus && matchesCycle;
  }) || [];

  const getStatusColor = (status: string) => {
    const colors = {
      'Paid': 'bg-green-100 text-green-800 border-green-200',
      'Unpaid': 'bg-red-100 text-red-800 border-red-200',
      'Partially Paid': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Waived': 'bg-blue-100 text-blue-800 border-blue-200',
      'Refunded': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCycleColor = (cycle: string) => {
    const colors = {
      'registration_fee': 'bg-indigo-100 text-indigo-800',
      '1st_quarter': 'bg-green-100 text-green-800',
      '2nd_quarter': 'bg-blue-100 text-blue-800',
      '3rd_quarter': 'bg-orange-100 text-orange-800',
      '4th_quarter': 'bg-red-100 text-red-800',
      '1st_semester': 'bg-teal-100 text-teal-800',
      '2nd_semester': 'bg-pink-100 text-pink-800',
      'annual': 'bg-gray-100 text-gray-800'
    };
    return colors[cycle as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatCycle = (cycle: string) => {
    const cycleLabels = {
      'registration_fee': 'Registration Fee',
      '1st_quarter': '1st Quarter',
      '2nd_quarter': '2nd Quarter',
      '3rd_quarter': '3rd Quarter',
      '4th_quarter': '4th Quarter',
      '1st_semester': '1st Semester',
      '2nd_semester': '2nd Semester',
      'annual': 'Annual'
    };
    return cycleLabels[cycle as keyof typeof cycleLabels] || cycle;
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const formatPaymentDetails = (paymentDetails: any) => {
    if (!paymentDetails || typeof paymentDetails !== 'object') {
      return { bank_name: 'N/A', transaction_number: 'N/A' };
    }
    
    const details = typeof paymentDetails === 'string' ? JSON.parse(paymentDetails) : paymentDetails;
    
    return {
      bank_name: details?.bank_name || 'N/A',
      transaction_number: details?.transaction_number || 'N/A'
    };
  };

  const handleDelete = (paymentId: string) => {
    if (!canDelete) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to delete payments.",
        variant: "destructive",
      });
      return;
    }
    if (confirm('Are you sure you want to delete this payment? This action cannot be undone.')) {
      deletePaymentMutation.mutate(paymentId);
    }
  };

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
          <Link to="/dashboard">
            <Button variant="outline">
              <Receipt className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
            <SheetTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-xl">
                  {editingPayment ? 'Edit Payment' : 'Record New Payment'}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <EnhancedPaymentForm
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
                  {formatCurrency(stats?.totalRevenue || 0)}
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
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-600">Paid</p>
                <p className="text-2xl font-bold text-purple-900">{stats?.paidPayments || 0}</p>
              </div>
              <CreditCard className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-600">Pending</p>
                <p className="text-2xl font-bold text-orange-900">{stats?.pendingPayments || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
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
                  placeholder="Search by student name, ID, or mother's name..."
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
            <Select value={cycleFilter} onValueChange={setCycleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cycles</SelectItem>
                <SelectItem value="registration_fee">Registration Fee</SelectItem>
                <SelectItem value="1st_quarter">1st Quarter</SelectItem>
                <SelectItem value="2nd_quarter">2nd Quarter</SelectItem>
                <SelectItem value="3rd_quarter">3rd Quarter</SelectItem>
                <SelectItem value="4th_quarter">4th Quarter</SelectItem>
                <SelectItem value="1st_semester">1st Semester</SelectItem>
                <SelectItem value="2nd_semester">2nd Semester</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            Payments ({filteredPayments.length})
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
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No payments found</p>
              <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Student</TableHead>
                    <TableHead className="font-semibold">Payment Cycle</TableHead>
                    <TableHead className="font-semibold">Amount</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Payment Method</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => {
                    const paymentDetails = formatPaymentDetails((payment as any).payment_details || (payment as any).transaction_data);
                    return (
                      <TableRow key={payment.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage 
                                src={payment.students?.photo_url} 
                                alt={`${payment.students?.first_name} ${payment.students?.last_name}`}
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {getInitials(payment.students?.first_name || '', payment.students?.last_name || '')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900">
                                {getHighlightedText(`${payment.students?.first_name} ${payment.students?.last_name}`, searchTerm)}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {getHighlightedText(payment.students?.student_id || '', searchTerm)}
                              </div>
                              {payment.students?.mother_name && (
                                <div className="text-xs text-gray-400">
                                  Mother: {getHighlightedText(payment.students.mother_name, searchTerm)}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCycleColor(payment.payment_cycle)} variant="outline">
                            {formatCycle(payment.payment_cycle)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-green-600">
                            {formatCurrency(payment.amount_paid || 0)}
                          </div>
                          {(payment as any).total_amount && (payment as any).total_amount !== payment.amount_paid && (
                            <div className="text-xs text-gray-500">
                              of {formatCurrency((payment as any).total_amount)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(payment.payment_status)} variant="outline">
                            {payment.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{(payment as any).payment_method || 'Cash'}</div>
                            {(payment as any).payment_method === 'Bank Transfer' && (
                              <div className="text-xs text-gray-500">
                                <div>Bank: {paymentDetails.bank_name}</div>
                                <div>Ref: {paymentDetails.transaction_number}</div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {payment.payment_date 
                              ? new Date(payment.payment_date).toLocaleDateString()
                              : 'Not recorded'
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Payment Details</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <h3 className="font-semibold text-gray-900">Student Information</h3>
                                      <div className="mt-2 space-y-1">
                                        <p><span className="font-medium">Name:</span> {payment.students?.first_name} {payment.students?.last_name}</p>
                                        <p><span className="font-medium">Student ID:</span> {payment.students?.student_id}</p>
                                        <p><span className="font-medium">Grade:</span> {payment.students?.grade_level}</p>
                                        {payment.students?.mother_name && (
                                          <p><span className="font-medium">Mother:</span> {payment.students.mother_name}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <h3 className="font-semibold text-gray-900">Payment Information</h3>
                                      <div className="mt-2 space-y-1">
                                        <p><span className="font-medium">Cycle:</span> {formatCycle(payment.payment_cycle)}</p>
                                        <p><span className="font-medium">Amount:</span> {formatCurrency(payment.amount_paid || 0)}</p>
                                        <p><span className="font-medium">Status:</span> {payment.payment_status}</p>
                                        <p><span className="font-medium">Method:</span> {(payment as any).payment_method || 'Cash'}</p>
                                        <p><span className="font-medium">Date:</span> {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'Not recorded'}</p>
                                      </div>
                                    </div>
                                  </div>
                                  {(payment as any).payment_method === 'Bank Transfer' && (
                                    <div>
                                      <h3 className="font-semibold text-gray-900">Bank Transfer Details</h3>
                                      <div className="mt-2 space-y-1">
                                        <p><span className="font-medium">Bank:</span> {paymentDetails.bank_name}</p>
                                        <p><span className="font-medium">Transaction:</span> {paymentDetails.transaction_number}</p>
                                      </div>
                                    </div>
                                  )}
                                  {payment.notes && (
                                    <div>
                                      <h3 className="font-semibold text-gray-900">Notes</h3>
                                      <p className="mt-2 text-gray-600">{payment.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingPayment(payment);
                                setIsFormOpen(true);
                              }}
                              className="hover:bg-green-50 hover:text-green-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(payment.id)}
                              className={`hover:bg-red-50 hover:text-red-600 ${!canDelete ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={!canDelete}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
