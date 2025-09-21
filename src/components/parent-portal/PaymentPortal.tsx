import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  DollarSign, 
  CreditCard, 
  FileText,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Download,
  Receipt,
  TrendingUp,
  Wallet,
  Building,
  User
} from 'lucide-react';

interface StudentSummary {
  id: string;
  student_id: string;
  full_name: string;
  grade_level: string;
  class_name: string;
  overall_grade?: string;
  attendance_percentage: number;
  behavior_points: number;
  outstanding_balance: number;
  recent_activity: string[];
}

interface ParentInfo {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  relationship: string;
  children: StudentSummary[];
}

interface PaymentData {
  financial_summary: {
    total_fees_this_year: number;
    total_paid_this_year: number;
    total_outstanding: number;
    next_payment_due: string;
    next_payment_amount: number;
    payment_plan_status: string;
  };
  fee_breakdown: Array<{
    student_id: string;
    student_name: string;
    fee_type: string;
    description: string;
    amount: number;
    due_date: string;
    status: 'paid' | 'pending' | 'overdue' | 'partial';
    paid_amount: number;
    balance: number;
  }>;
  payment_history: Array<{
    id: string;
    payment_date: string;
    amount: number;
    fee_type: string;
    student_name: string;
    payment_method: string;
    transaction_id: string;
    status: 'completed' | 'pending' | 'failed';
    receipt_url?: string;
  }>;
  payment_methods: Array<{
    id: string;
    type: 'credit_card' | 'bank_account' | 'paypal';
    name: string;
    last_four?: string;
    is_default: boolean;
    expires?: string;
  }>;
  available_discounts: Array<{
    id: string;
    name: string;
    description: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    applicable_fees: string[];
    expiry_date: string;
    conditions: string[];
  }>;
}

interface Props {
  children: StudentSummary[];
  parentInfo: ParentInfo;
}

export const PaymentPortal: React.FC<Props> = ({ children, parentInfo }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedChild, setSelectedChild] = useState<string>(children[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  // Check for payment status from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentResult = urlParams.get('payment');
    if (paymentResult) {
      setPaymentStatus(paymentResult);
      // Clear URL parameter after processing
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Auto-hide status after 5 seconds
      setTimeout(() => setPaymentStatus(null), 5000);
    }
  }, []);

  const { data: paymentData, isLoading } = useQuery<PaymentData>({
    queryKey: ['payment-data', parentInfo.id],
    queryFn: async () => {
      const response = await apiClient.get(`/communication/parent-dashboard/payments/${parentInfo.id}`);
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading payment information...</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed': 
        return 'bg-green-100 text-green-800';
      case 'pending': 
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
      case 'failed': 
        return 'bg-red-100 text-red-800';
      case 'partial': 
        return 'bg-blue-100 text-blue-800';
      default: 
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleMakePayment = async () => {
    try {
      setIsProcessingPayment(true);
      
      if (!paymentAmount || !selectedPaymentMethod) {
        alert('Please enter payment amount and select payment method');
        return;
      }

      const amount = parseFloat(paymentAmount);
      if (amount <= 0) {
        alert('Please enter a valid payment amount');
        return;
      }

      // Get outstanding fees for selected child or all children
      const relevantFees = paymentData?.fee_breakdown?.filter(fee => 
        selectedChild === 'all' || fee.student_id === selectedChild
      ) || [];

      if (relevantFees.length === 0) {
        alert('No outstanding fees found for selected student');
        return;
      }

      // Create payment link for online payment
      const feeIds = relevantFees.map(fee => fee.student_id + '_' + fee.fee_type);
      const studentId = selectedChild === 'all' ? relevantFees[0].student_id : selectedChild;

      const response = await apiClient.createPaymentLink({
        fee_ids: feeIds,
        student_id: studentId,
        success_url: window.location.origin + '/parent-portal?payment=success',
        cancel_url: window.location.origin + '/parent-portal?payment=cancelled'
      });

      if (response.data && response.data.payment_url) {
        // Redirect to payment gateway
        window.open(response.data.payment_url, '_blank');
        setPaymentStatus('processing');
      } else {
        alert('Failed to create payment link. Please try again.');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.response?.data?.detail || 'Payment processing failed. Please try again.');
      setPaymentStatus('error');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSchedulePayment = async () => {
    try {
      // TODO: Implement scheduled payment functionality
      alert('Scheduled payment functionality will be available soon!');
    } catch (error) {
      console.error('Schedule payment error:', error);
    }
  };

  const totalOutstanding = children.reduce((sum, child) => sum + child.outstanding_balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Payment Portal</h2>
          <p className="text-muted-foreground">Manage fees, payments, and financial information</p>
        </div>
      </div>

      {/* Payment Status Alert */}
      {paymentStatus && (
        <Card className={`border-l-4 ${
          paymentStatus === 'success' ? 'border-l-green-500 bg-green-50' :
          paymentStatus === 'cancelled' ? 'border-l-yellow-500 bg-yellow-50' :
          paymentStatus === 'error' ? 'border-l-red-500 bg-red-50' :
          'border-l-blue-500 bg-blue-50'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              {paymentStatus === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : paymentStatus === 'cancelled' ? (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              ) : paymentStatus === 'error' ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <CreditCard className="h-5 w-5 text-blue-600" />
              )}
              <p className={`font-medium ${
                paymentStatus === 'success' ? 'text-green-800' :
                paymentStatus === 'cancelled' ? 'text-yellow-800' :
                paymentStatus === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {paymentStatus === 'success' && 'Payment completed successfully!'}
                {paymentStatus === 'cancelled' && 'Payment was cancelled'}
                {paymentStatus === 'error' && 'Payment failed - please try again'}
                {paymentStatus === 'processing' && 'Payment is being processed...'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Overview Header */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50">
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Outstanding</p>
              <p className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(paymentData?.financial_summary.total_outstanding || totalOutstanding)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Paid This Year</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(paymentData?.financial_summary.total_paid_this_year || 0)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Next Payment Due</p>
              <p className="text-lg font-bold">
                {paymentData?.financial_summary.next_payment_due 
                  ? formatDate(paymentData.financial_summary.next_payment_due)
                  : 'N/A'
                }
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Payment Plan</p>
              <Badge variant="outline" className="text-sm">
                {paymentData?.financial_summary.payment_plan_status || 'Standard'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="make-payment">Make Payment</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Outstanding Fees by Child */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Outstanding Fees
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentData?.fee_breakdown ? (
                <div className="space-y-4">
                  {paymentData.fee_breakdown
                    .filter(fee => fee.balance > 0)
                    .map((fee, index) => (
                      <Card key={index} className="border-l-4 border-l-orange-500">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{fee.description}</h4>
                              <p className="text-sm text-muted-foreground">
                                {fee.student_name} • {fee.fee_type}
                              </p>
                              <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  Due: {formatDate(fee.due_date)}
                                </div>
                                <div>
                                  Paid: {formatCurrency(fee.paid_amount)} / {formatCurrency(fee.amount)}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <Badge className={getStatusColor(fee.status)}>
                                {fee.status}
                              </Badge>
                              <p className="text-lg font-bold mt-1 text-red-600">
                                {formatCurrency(fee.balance)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  
                  {paymentData.fee_breakdown.filter(fee => fee.balance > 0).length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
                      <p className="text-green-600 font-medium">All fees are up to date!</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No fee information available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Discounts */}
          {paymentData?.available_discounts && paymentData.available_discounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-600">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Available Discounts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {paymentData.available_discounts.map((discount) => (
                    <Card key={discount.id} className="border-green-200 bg-green-50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-green-800">{discount.name}</h4>
                          <Badge className="bg-green-100 text-green-800">
                            {discount.discount_type === 'percentage' 
                              ? `${discount.discount_value}%` 
                              : formatCurrency(discount.discount_value)
                            }
                          </Badge>
                        </div>
                        <p className="text-sm text-green-700 mb-2">{discount.description}</p>
                        <p className="text-xs text-green-600">
                          Expires: {formatDate(discount.expiry_date)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="make-payment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Make a Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Payment Amount */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="payment-amount">Payment Amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="payment-amount"
                        type="number"
                        placeholder="0.00"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="child-select">For Child</Label>
                    <Select value={selectedChild} onValueChange={setSelectedChild}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select child" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Children</SelectItem>
                        {children.map((child) => (
                          <SelectItem key={child.id} value={child.id}>
                            {child.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentData?.payment_methods?.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.name} {method.last_four && `****${method.last_four}`}
                          {method.is_default && ' (Default)'}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">Add New Payment Method</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Notes */}
                <div>
                  <Label htmlFor="payment-notes">Payment Notes (Optional)</Label>
                  <Textarea
                    id="payment-notes"
                    placeholder="Add any notes about this payment..."
                    rows={3}
                  />
                </div>

                {/* Quick Payment Buttons */}
                <div>
                  <Label>Quick Payment Options</Label>
                  <div className="grid gap-2 md:grid-cols-3 mt-2">
                    {totalOutstanding > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setPaymentAmount(totalOutstanding.toString())}
                      >
                        Pay Total Outstanding
                        <br />
                        {formatCurrency(totalOutstanding)}
                      </Button>
                    )}
                    {paymentData?.financial_summary.next_payment_amount && (
                      <Button
                        variant="outline"
                        onClick={() => setPaymentAmount(paymentData.financial_summary.next_payment_amount.toString())}
                      >
                        Next Payment Due
                        <br />
                        {formatCurrency(paymentData.financial_summary.next_payment_amount)}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setPaymentAmount('500')}
                    >
                      Custom Amount
                      <br />
                      Enter manually
                    </Button>
                  </div>
                </div>

                {/* Payment Actions */}
                <div className="flex space-x-4">
                  <Button 
                    onClick={handleMakePayment} 
                    disabled={!paymentAmount || !selectedPaymentMethod || isProcessingPayment}
                    className="flex-1"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {isProcessingPayment ? 'Processing...' : 'Process Payment'}
                  </Button>
                  <Button variant="outline" onClick={handleSchedulePayment}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Payment
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {paymentData?.payment_history ? (
            <div className="space-y-4">
              {paymentData.payment_history.map((payment) => (
                <Card key={payment.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                          payment.status === 'completed' ? 'bg-green-100' :
                          payment.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                        }`}>
                          {payment.status === 'completed' ? 
                            <CheckCircle className="h-4 w-4 text-green-600" /> :
                            payment.status === 'pending' ?
                            <CreditCard className="h-4 w-4 text-yellow-600" /> :
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          }
                        </div>
                        
                        <div>
                          <p className="font-medium">{formatCurrency(payment.amount)}</p>
                          <p className="text-sm text-muted-foreground">
                            {payment.student_name} • {payment.fee_type}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>{formatDate(payment.payment_date)}</span>
                            <span>{payment.payment_method}</span>
                            <span>#{payment.transaction_id}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                        {payment.receipt_url && (
                          <Button variant="outline" size="sm" className="mt-2">
                            <Download className="h-4 w-4 mr-1" />
                            Receipt
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No payment history available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="methods" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="h-5 w-5 mr-2" />
                Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentData?.payment_methods ? (
                <div className="space-y-4">
                  {paymentData.payment_methods.map((method) => (
                    <Card key={method.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-100 rounded-full">
                              {method.type === 'credit_card' ? <CreditCard className="h-4 w-4 text-blue-600" /> :
                               method.type === 'bank_account' ? <Building className="h-4 w-4 text-blue-600" /> :
                               <Wallet className="h-4 w-4 text-blue-600" />}
                            </div>
                            <div>
                              <p className="font-medium">{method.name}</p>
                              {method.last_four && (
                                <p className="text-sm text-muted-foreground">****{method.last_four}</p>
                              )}
                              {method.expires && (
                                <p className="text-sm text-muted-foreground">Expires: {method.expires}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {method.is_default && (
                              <Badge variant="outline">Default</Badge>
                            )}
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  <Button variant="outline" className="w-full">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add New Payment Method
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No payment methods configured</p>
                  <Button className="mt-4">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add Payment Method
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};