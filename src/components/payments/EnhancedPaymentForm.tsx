import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, CreditCard, DollarSign, Upload, Building2, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { validatePaymentData } from './PaymentValidation';

const paymentSchema = z.object({
  student_id: z.string().min(1, 'Student is required'),
  amount_paid: z.number().min(0.01, 'Amount must be greater than 0'),
  payment_date: z.date(),
  payment_status: z.enum(['Paid', 'Unpaid', 'Partially Paid', 'Waived', 'Refunded']),
  academic_year: z.string().min(1, 'Academic year is required'),
  payment_cycle: z.enum(['1st_quarter', '2nd_quarter', '3rd_quarter', '4th_quarter', '1st_semester', '2nd_semester', 'registration_fee']),
  notes: z.string().optional(),
  payment_method: z.enum(['Cash', 'Bank Transfer', 'Mobile Payment']),
  bank_name: z.string().optional(),
  transaction_number: z.string().optional(),
  payment_screenshot: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface EnhancedPaymentFormProps {
  payment?: any;
  studentId?: string;
  onSuccess: () => void;
}

export const EnhancedPaymentForm = ({ payment, studentId, onSuccess }: EnhancedPaymentFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      student_id: payment?.student_id || studentId || '',
      amount_paid: payment?.amount_paid || 0,
      payment_date: payment?.payment_date ? new Date(payment.payment_date) : new Date(),
      payment_status: payment?.payment_status || 'Unpaid',
      academic_year: payment?.academic_year || new Date().getFullYear().toString(),
      payment_cycle: payment?.payment_cycle || 'registration_fee',
      notes: payment?.notes || '',
      payment_method: payment?.payment_method || 'Cash',
      bank_name: payment?.bank_name || '',
      transaction_number: payment?.transaction_number || '',
      payment_screenshot: payment?.payment_screenshot || '',
    },
  });

  const watchPaymentMethod = form.watch('payment_method');

  // Supabase usage is deprecated. Use /api endpoints for all payment form data fetching with the FastAPI backend.
  const { data: students } = useQuery({
    queryKey: ['students-for-payment'],
    queryFn: async () => {
      const response = await fetch('/api/students');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    }
  });

  const { data: studentDetails } = useQuery({
    queryKey: ['student-details', form.watch('student_id')],
    queryFn: async () => {
      const studentId = form.watch('student_id');
      if (!studentId) return null;

      const response = await fetch(`/api/students/${studentId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!form.watch('student_id')
  });

  const { data: userRole } = useQuery({
    queryKey: ['user-role'],
    queryFn: async () => {
      const response = await fetch('/api/user/role');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    }
  });

  const handleScreenshotChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setScreenshotFile(file);
    }
  };

  const uploadScreenshot = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `payment_${Date.now()}.${fileExt}`;

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload/payment-screenshot', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.url;
  };

  const submitMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      setIsSubmitting(true);

      let screenshotUrl = data.payment_screenshot;
      if (screenshotFile) {
        screenshotUrl = await uploadScreenshot(screenshotFile);
      }

      // Generate a unique payment ID
      const paymentId = crypto.randomUUID();

      if (payment) {
        // Update existing payment
        const paymentData = {
          student_id: data.student_id,
          amount_paid: data.amount_paid,
          payment_date: data.payment_date.toISOString().split('T')[0],
          payment_status: data.payment_status,
          academic_year: data.academic_year,
          payment_cycle: data.payment_cycle,
          notes: data.notes || null,
        };

        const response = await fetch(`/api/payments/${payment.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paymentData),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Update payment mode if it exists
        if (payment.payment_id) {
          const paymentModeData = {
            name: data.payment_method,
            payment_type: data.payment_method,
            payment_data: {
              amount: data.amount_paid,
              date: data.payment_date.toISOString(),
              method: data.payment_method,
              bank_name: data.bank_name || null,
              transaction_number: data.transaction_number || null,
              payment_screenshot: screenshotUrl || null,
              payment_cycle: data.payment_cycle,
            }
          };

          const paymentModeResponse = await fetch(`/api/payment-modes/${payment.payment_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(paymentModeData),
          });
          
          if (!paymentModeResponse.ok) {
            throw new Error(`HTTP error! status: ${paymentModeResponse.status}`);
          }
        }
      } else {
        // For new payments, create payment mode first, then payment record
        
        // Get the next available ID for payment_mode table
        const response = await fetch('/api/payment-modes/next-id');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const { next_id } = await response.json();

        // Create payment mode record first
        const paymentModeData = {
          id: next_id,
          payment_id: paymentId,
          name: data.payment_method,
          payment_type: data.payment_method,
          payment_data: {
            amount: data.amount_paid,
            date: data.payment_date.toISOString(),
            method: data.payment_method,
            bank_name: data.bank_name || null,
            transaction_number: data.transaction_number || null,
            payment_screenshot: screenshotUrl || null,
            payment_cycle: data.payment_cycle,
          }
        };

        const paymentModeResponse = await fetch('/api/payment-modes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([paymentModeData]),
        });

        if (!paymentModeResponse.ok) {
          throw new Error(`HTTP error! status: ${paymentModeResponse.status}`);
        }

        // Create payment record with reference to payment mode
        const paymentData = {
          student_id: data.student_id,
          amount_paid: data.amount_paid,
          payment_date: data.payment_date.toISOString().split('T')[0],
          payment_status: data.payment_status,
          academic_year: data.academic_year,
          payment_cycle: data.payment_cycle,
          notes: data.notes || null,
          payment_id: paymentId,
        };

        const paymentResponse = await fetch('/api/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([paymentData]),
        });
        
        if (!paymentResponse.ok) {
          throw new Error(`HTTP error! status: ${paymentResponse.status}`);
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Payment ${payment ? 'updated' : 'recorded'} successfully`,
      });
      onSuccess();
    },
    onError: (error) => {
      console.error('Payment submission error:', error);
      toast({
        title: "Error",
        description: `Failed to ${payment ? 'update' : 'record'} payment: ${error.message}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  const onSubmit = async (data: PaymentFormData) => {
    // Validate bank transfer requirements
    if (data.payment_method === 'Bank Transfer' && !data.transaction_number) {
      toast({
        title: "Validation Error",
        description: "Transaction number is required for bank transfers",
        variant: "destructive",
      });
      return;
    }

    // Role-based validation for registrars
    if (userRole === 'registrar' && payment) {
      // Registrars can only change status from unpaid to paid, not vice versa
      if (payment.payment_status === 'Paid' && data.payment_status !== 'Paid') {
        toast({
          title: "Access Denied",
          description: "Registrars cannot change payment status from paid to unpaid",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate for duplicate payments (only for new payments)
    if (!payment) {
      const validationResult = await validatePaymentData({
        student_id: data.student_id,
        payment_cycle: data.payment_cycle,
        academic_year: data.academic_year,
        amount_paid: data.amount_paid,
      });

      if (!validationResult.isValid) {
        toast({
          title: "Validation Error",
          description: validationResult.error,
          variant: "destructive",
        });
        return;
      }
    }

    submitMutation.mutate(data);
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const calculateTotalPaid = () => {
    if (!studentDetails?.registration_payments) return 0;
    return studentDetails.registration_payments
      .filter(p => p.payment_status === 'Paid')
      .reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  };

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      'Paid': 'bg-green-100 text-green-800',
      'Unpaid': 'bg-red-100 text-red-800',
      'Partially Paid': 'bg-yellow-100 text-yellow-800',
      'Waived': 'bg-blue-100 text-blue-800',
      'Refunded': 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const ethiopianBanks = [
    'Commercial Bank of Ethiopia',
    'Awash Bank',
    'Dashen Bank',
    'Bank of Abyssinia',
    'Wegagen Bank',
    'United Bank',
    'Nib International Bank',
    'Cooperative Bank of Oromia',
    'Lion International Bank',
    'Oromia International Bank',
    'Zemen Bank',
    'Bunna International Bank',
    'Berhan International Bank',
    'Abay Bank',
    'Addis International Bank',
    'Debub Global Bank',
    'Enat Bank',
    'Goh Betoch Bank',
    'Hijra Bank',
    'Shabelle Bank',
    'Siinqee Bank',
    'Tsehay Bank'
  ];

  const paymentCycles = [
    { value: '1st_quarter', label: '1st Quarter' },
    { value: '2nd_quarter', label: '2nd Quarter' },
    { value: '3rd_quarter', label: '3rd Quarter' },
    { value: '4th_quarter', label: '4th Quarter' },
    { value: '1st_semester', label: '1st Semester' },
    { value: '2nd_semester', label: '2nd Semester' },
    { value: 'registration_fee', label: 'Registration Fee' },
  ];

  // Filter payment status options for registrars
  const getPaymentStatusOptions = () => {
    if (userRole === 'registrar' && payment?.payment_status === 'Paid') {
      // Registrars cannot change from paid to unpaid
      return [{ value: 'Paid', label: 'Paid' }];
    }
    
    if (userRole === 'registrar') {
      // Registrars can only set to paid or partially paid
      return [
        { value: 'Unpaid', label: 'Unpaid' },
        { value: 'Partially Paid', label: 'Partially Paid' },
        { value: 'Paid', label: 'Paid' }
      ];
    }

    // Admins have full access
    return [
      { value: 'Paid', label: 'Paid' },
      { value: 'Unpaid', label: 'Unpaid' },
      { value: 'Partially Paid', label: 'Partially Paid' },
      { value: 'Waived', label: 'Waived' },
      { value: 'Refunded', label: 'Refunded' }
    ];
  };

  return (
    <div className="space-y-6">
      {/* Student Payment Summary */}
      {studentDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Summary - {studentDetails.first_name} {studentDetails.last_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Student ID</p>
                <p className="font-mono font-medium">{studentDetails.student_id}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Grade Level</p>
                <Badge variant="outline">{formatGradeLevel(studentDetails.grade_level)}</Badge>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Total Paid</p>
                <p className="font-bold text-green-600">${calculateTotalPaid().toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Payment Records</p>
                <p className="font-medium">{studentDetails.registration_payments?.length || 0}</p>
              </div>
            </div>

            {studentDetails.registration_payments && studentDetails.registration_payments.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Recent Payments</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {studentDetails.registration_payments
                    .sort((a, b) => new Date(b.payment_date || '').getTime() - new Date(a.payment_date || '').getTime())
                    .slice(0, 3)
                    .map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                        <span>${payment.amount_paid?.toFixed(2)}</span>
                        <Badge className={getPaymentStatusColor(payment.payment_status || '')} variant="outline">
                          {payment.payment_status}
                        </Badge>
                        <span className="text-gray-500">
                          {payment.payment_date ? format(new Date(payment.payment_date), 'MMM dd, yyyy') : 'No date'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enhanced Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {payment ? 'Update Payment' : 'Record New Payment'}
            {userRole === 'registrar' && (
              <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800">
                Registrar Access
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="student_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!studentId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select student" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {students?.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.first_name} {student.last_name} ({student.student_id}) - {formatGradeLevel(student.grade_level)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount_paid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={userRole === 'registrar' && !!payment}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getPaymentStatusOptions().map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="payment_cycle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Cycle *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={userRole === 'registrar' && !!payment}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select cycle" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentCycles.map((cycle) => (
                            <SelectItem key={cycle.value} value={cycle.value}>
                              {cycle.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="academic_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Academic Year *</FormLabel>
                      <FormControl>
                        <Input placeholder="2024" {...field} disabled={userRole === 'registrar' && !!payment} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="payment_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Payment Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              disabled={userRole === 'registrar' && !!payment}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={userRole === 'registrar' && !!payment}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="Mobile Payment">Mobile Payment</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Bank Transfer Details */}
              {watchPaymentMethod === 'Bank Transfer' && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Bank Transfer Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="bank_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select bank" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ethiopianBanks.map((bank) => (
                                <SelectItem key={bank} value={bank}>
                                  {bank}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="transaction_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transaction Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter transaction number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Payment Screenshot (Optional)</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotChange}
                          className="hidden"
                          id="screenshot-upload"
                        />
                        <label htmlFor="screenshot-upload">
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span className="cursor-pointer">
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Screenshot
                            </span>
                          </Button>
                        </label>
                        {screenshotFile && (
                          <span className="text-sm text-green-600">
                            {screenshotFile.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Mobile Payment Details */}
              {watchPaymentMethod === 'Mobile Payment' && (
                <Card className="bg-green-50 border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Mobile Payment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="transaction_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transaction ID *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter mobile payment transaction ID" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Payment Screenshot (Optional)</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotChange}
                          className="hidden"
                          id="mobile-screenshot-upload"
                        />
                        <label htmlFor="mobile-screenshot-upload">
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span className="cursor-pointer">
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Screenshot
                            </span>
                          </Button>
                        </label>
                        {screenshotFile && (
                          <span className="text-sm text-green-600">
                            {screenshotFile.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional payment notes..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? 'Processing...' : (payment ? 'Update Payment' : 'Record Payment')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};