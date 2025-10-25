import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { BankTransferDetails } from './BankTransferDetails';
import { MobilePaymentDetails } from './MobilePaymentDetails';
import { toast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { CreditCard, Loader2, Receipt, Calculator } from 'lucide-react';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Form schema with method-specific details
const basePaymentSchema = z.object({
  student_id: z.string().min(1, 'Student is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  currency: z.string().default('ETB'),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'check', 'online_payment', 'mobile_payment'], {
    required_error: 'Payment method is required'
  }),
  category: z.string().optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  payer_name: z.string().optional(),
  payer_phone: z.string().optional(),
  payer_email: z.string().email().optional().or(z.literal('')),
  branch_id: z.string().min(1, 'Branch is required'),
});

const bankTransferDetailsSchema = z.object({
  bank_name: z.string().min(2, 'Bank name is required'),
  bank_code: z.string().optional(),
  transaction_number: z.string().min(3, 'Transaction number is required'),
  transaction_screenshot_url: z.string().url().optional().or(z.literal('')),
});

const mobilePaymentDetailsSchema = z.object({
  transaction_id: z.string().min(3, 'Transaction ID is required'),
  transaction_screenshot_url: z.string().url().optional().or(z.literal('')),
});

const extendedPaymentSchema = basePaymentSchema
  .and(
    z.discriminatedUnion('payment_method', [
      z.object({
        payment_method: z.literal('bank_transfer'),
        bank_transfer_details: bankTransferDetailsSchema,
        mobile_payment_details: z.undefined().optional(),
      }),
      z.object({
        payment_method: z.literal('online_payment'),
        bank_transfer_details: z.undefined().optional(),
        mobile_payment_details: mobilePaymentDetailsSchema,
      }),
      z.object({
        payment_method: z.literal('mobile_payment'),
        bank_transfer_details: z.undefined().optional(),
        mobile_payment_details: mobilePaymentDetailsSchema,
      }),
      z.object({
        payment_method: z.literal('cash'),
        bank_transfer_details: z.undefined().optional(),
        mobile_payment_details: z.undefined().optional(),
      }),
      z.object({
        payment_method: z.literal('card'),
        bank_transfer_details: z.undefined().optional(),
        mobile_payment_details: z.undefined().optional(),
      }),
      z.object({
        payment_method: z.literal('check'),
        bank_transfer_details: z.undefined().optional(),
        mobile_payment_details: z.undefined().optional(),
      }),
    ])
  );

type ExtendedPaymentFormData = z.infer<typeof extendedPaymentSchema>;

interface PaymentFormExtendedProps {
  onSuccess?: (payment: any) => void;
  onCancel?: () => void;
  initialData?: Partial<ExtendedPaymentFormData>;
}

export const PaymentFormExtended: React.FC<PaymentFormExtendedProps> = ({
  onSuccess,
  onCancel,
  initialData
}) => {
  const { selectedBranch } = useBranch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const form = useForm<ExtendedPaymentFormData>({
    resolver: zodResolver(extendedPaymentSchema),
    defaultValues: {
      student_id: initialData?.student_id || '',
      amount: initialData?.amount || 0,
      currency: initialData?.currency || 'ETB',
      payment_method: initialData?.payment_method || 'cash',
      category: initialData?.category || '',
      description: initialData?.description || '',
      due_date: initialData?.due_date || new Date().toISOString().split('T')[0],
      payer_name: initialData?.payer_name || '',
      payer_phone: initialData?.payer_phone || '',
      payer_email: initialData?.payer_email || '',
      branch_id: selectedBranch === 'all' ? '' : selectedBranch || '',
      bank_transfer_details: {
        bank_name: '',
        bank_code: '',
        transaction_number: '',
        transaction_screenshot_url: '',
      },
      mobile_payment_details: {
        transaction_id: '',
        transaction_screenshot_url: '',
      },
    },
  });

  const paymentMethod = form.watch('payment_method');

  // Fetch students for search
  const { data: studentsData = [] } = useQuery({
    queryKey: ['students-search', studentSearch, selectedBranch],
    queryFn: async () => {
      if (studentSearch.length < 2) return [];
      // SECURITY FIX: Use httpOnly cookies instead of localStorage (HIGH severity - Phase 2)
      const response = await fetch(`${API_BASE_URL}/students/search?q=${encodeURIComponent(studentSearch)}&branch_id=${selectedBranch}`, {
        credentials: 'include',  // Send httpOnly cookies automatically
      });
      if (!response.ok) throw new Error('Failed to search students');
      return response.json();
    },
    enabled: studentSearch.length > 2,
  });

  // File upload function
  const handleFileUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('Authentication required');

    const response = await fetch(`${API_BASE_URL}/payments/upload-screenshot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'File upload failed');
    }

    const result = await response.json();
    return result.url;
  };

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (data: ExtendedPaymentFormData) => {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Authentication required');

      const payload = {
        ...data,
        bank_transfer_details: data.payment_method === 'bank_transfer' ? data.bank_transfer_details : null,
        mobile_payment_details: (data.payment_method === 'online_payment' || data.payment_method === 'mobile_payment') ? data.mobile_payment_details : null,
      };

      const response = await fetch(`${API_BASE_URL}/payments/extended`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create payment');
      }

      return response.json();
    },
    onSuccess: (response) => {
      toast({
        title: 'Success!',
        description: 'Payment created successfully with method-specific details',
      });
      onSuccess?.(response);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create payment',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (data: ExtendedPaymentFormData) => {
    setIsSubmitting(true);
    try {
      await createPaymentMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onStudentSelect = (student: any) => {
    form.setValue('student_id', student.id);
    setStudentSearch(`${student.first_name} ${student.father_name || ''} (${student.student_id})`);
  };

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

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden p-6">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          {/* Header */}
          <div className="text-center mb-8 animate-fadeInUp">
            <div className="flex justify-center mb-6">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-teal-600 rounded-2xl animate-pulse opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
                <div className="relative h-16 w-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-white/20 transition-all duration-300 group-hover:scale-110">
                  <CreditCard className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
              Create Payment with Method Details
            </h1>
            <p className="text-slate-600 mt-2">
              Enhanced payment form with conditional fields for different payment methods
            </p>
          </div>

          {/* Form */}
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Student Selection */}
              <Card className="relative bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium animate-fadeInUp">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/8 via-purple-500/8 to-pink-500/8 rounded-3xl pointer-events-none"></div>
                <CardHeader className="relative border-b border-slate-100/50 pb-4">
                  <CardTitle className="text-lg font-semibold text-slate-800">Student Information</CardTitle>
                </CardHeader>
                <CardContent className="relative space-y-4 pt-6">
                  <div>
                    <Label htmlFor="student_search" className="text-slate-700 font-medium">Search Student *</Label>
                    <Input
                      id="student_search"
                      placeholder="Search by name or student ID..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                    />
                    {studentsData && studentsData.length > 0 && (
                      <div className="border border-slate-200 rounded-md p-2 max-h-48 overflow-y-auto mt-2 bg-white/60 backdrop-blur-sm">
                        {studentsData.map((student: any) => (
                          <div
                            key={student.id}
                            className="p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors"
                            onClick={() => onStudentSelect(student)}
                          >
                            <div className="font-medium text-slate-800">
                              {student.first_name} {student.father_name || ''}
                            </div>
                            <div className="text-sm text-slate-600">
                              ID: {student.student_id} | Grade: {student.grade_level}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="student_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selected Student</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            readOnly
                            className="bg-slate-50 border-slate-200"
                            placeholder="Search and select a student above"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Basic Payment Details */}
              <Card className="relative bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-purple-500/8 to-pink-500/8 rounded-3xl pointer-events-none"></div>
                <CardHeader className="relative border-b border-slate-100/50 pb-4">
                  <CardTitle className="text-lg font-semibold text-slate-800">Payment Details</CardTitle>
                </CardHeader>
                <CardContent className="relative space-y-4 pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              className="border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ETB">ETB</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="check">Check</SelectItem>
                            <SelectItem value="online_payment">Online Payment</SelectItem>
                            <SelectItem value="mobile_payment">Mobile Payment</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            className="border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Payment description or notes..."
                            {...field}
                            className="border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="payer_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payer Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Name of person paying"
                              {...field}
                              className="border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payer_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payer Phone</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Contact number"
                              {...field}
                              className="border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="payer_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payer Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Email address"
                            {...field}
                            className="border-slate-200 bg-white/60 backdrop-blur-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Method-Specific Details */}
            {(paymentMethod === 'bank_transfer' ||
              paymentMethod === 'online_payment' ||
              paymentMethod === 'mobile_payment') && (
              <div className="animate-slideInUp" style={{ animationDelay: '0.2s' }}>
                {paymentMethod === 'bank_transfer' && (
                  <FormField
                    control={form.control}
                    name="bank_transfer_details"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <BankTransferDetails
                            value={field.value || {
                              bank_name: '',
                              bank_code: '',
                              transaction_number: '',
                              transaction_screenshot_url: '',
                            }}
                            onChange={(details) => field.onChange(details)}
                            onFileUpload={handleFileUpload}
                            errors={form.formState.errors.bank_transfer_details || {}}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {(paymentMethod === 'online_payment' || paymentMethod === 'mobile_payment') && (
                  <FormField
                    control={form.control}
                    name="mobile_payment_details"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <MobilePaymentDetails
                            value={field.value || {
                              transaction_id: '',
                              transaction_screenshot_url: '',
                            }}
                            onChange={(details) => field.onChange(details)}
                            onFileUpload={handleFileUpload}
                            errors={form.formState.errors.mobile_payment_details || {}}
                            paymentMethod={paymentMethod}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end space-x-4 animate-slideInUp" style={{ animationDelay: '0.3s' }}>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="border-slate-300 hover:bg-slate-50 transition-all duration-300"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Payment...
                  </>
                ) : (
                  <>
                    <Receipt className="mr-2 h-4 w-4" />
                    Create Payment
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};