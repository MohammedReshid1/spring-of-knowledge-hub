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
import { CalendarIcon, CreditCard, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const paymentSchema = z.object({
  student_id: z.string().min(1, 'Student is required'),
  amount_paid: z.number().min(0.01, 'Amount must be greater than 0'),
  payment_date: z.date(),
  payment_status: z.enum(['Paid', 'Unpaid', 'Partially Paid', 'Waived', 'Refunded']),
  academic_year: z.string().min(1, 'Academic year is required'),
  notes: z.string().optional(),
  payment_method: z.string().min(1, 'Payment method is required'),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentFormProps {
  payment?: any;
  studentId?: string;
  onSuccess: () => void;
}

export const PaymentForm = ({ payment, studentId, onSuccess }: PaymentFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      student_id: payment?.student_id || studentId || '',
      amount_paid: payment?.amount_paid || 0,
      payment_date: payment?.payment_date ? new Date(payment.payment_date) : new Date(),
      payment_status: payment?.payment_status || 'Unpaid',
      academic_year: payment?.academic_year || new Date().getFullYear().toString(),
      notes: payment?.notes || '',
      payment_method: payment?.payment_method || '',
    },
  });

  const { data: students } = useQuery({
    queryKey: ['students-for-payment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, student_id, grade_level')
        .eq('status', 'Active')
        .order('first_name');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: studentDetails } = useQuery({
    queryKey: ['student-details', form.watch('student_id')],
    queryFn: async () => {
      const studentId = form.watch('student_id');
      if (!studentId) return null;

      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          registration_payments (
            id,
            amount_paid,
            payment_status,
            payment_date,
            academic_year
          )
        `)
        .eq('id', studentId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!form.watch('student_id')
  });

  const submitMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      setIsSubmitting(true);

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
          notes: data.notes || null,
        };

        const { error: paymentError } = await supabase
          .from('registration_payments')
          .update(paymentData)
          .eq('id', payment.id);
        
        if (paymentError) throw paymentError;

        // Update payment mode if it exists
        if (payment.payment_id) {
          const paymentModeData = {
            name: data.payment_method,
            payment_type: data.payment_method,
            payment_data: {
              amount: data.amount_paid,
              date: data.payment_date.toISOString(),
              method: data.payment_method,
            }
          };

          const { error: paymentModeError } = await supabase
            .from('payment_mode')
            .update(paymentModeData)
            .eq('payment_id', payment.payment_id);
          
          if (paymentModeError) throw paymentModeError;
        }
      } else {
        // For new payments, create payment mode first, then payment record
        
        // Get the next available ID for payment_mode table
        const { data: maxIdData, error: maxIdError } = await supabase
          .from('payment_mode')
          .select('id')
          .order('id', { ascending: false })
          .limit(1);

        if (maxIdError) throw maxIdError;

        const nextId = (maxIdData && maxIdData.length > 0) ? maxIdData[0].id + 1 : 1;

        // Create payment mode record first
        const paymentModeData = {
          id: nextId,
          payment_id: paymentId,
          name: data.payment_method,
          payment_type: data.payment_method,
          payment_data: {
            amount: data.amount_paid,
            date: data.payment_date.toISOString(),
            method: data.payment_method,
          }
        };

        const { error: paymentModeError } = await supabase
          .from('payment_mode')
          .insert([paymentModeData]);

        if (paymentModeError) throw paymentModeError;

        // Create payment record with reference to payment mode
        const paymentData = {
          student_id: data.student_id,
          amount_paid: data.amount_paid,
          payment_date: data.payment_date.toISOString().split('T')[0],
          payment_status: data.payment_status,
          academic_year: data.academic_year,
          notes: data.notes || null,
          payment_id: paymentId,
        };

        const { error: paymentError } = await supabase
          .from('registration_payments')
          .insert([paymentData]);
        
        if (paymentError) throw paymentError;
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

  const onSubmit = (data: PaymentFormData) => {
    submitMutation.mutate(data);
  };

  const paymentMethods = [
    'Cash',
    'Bank Transfer',
    'Credit Card',
    'Debit Card',
    'Check',
    'Mobile Payment',
    'Online Payment'
  ];

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

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {payment ? 'Update Payment' : 'Record New Payment'}
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
                          <SelectItem value="Paid">Paid</SelectItem>
                          <SelectItem value="Unpaid">Unpaid</SelectItem>
                          <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                          <SelectItem value="Waived">Waived</SelectItem>
                          <SelectItem value="Refunded">Refunded</SelectItem>
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
                  name="payment_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Payment Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentMethods.map((method) => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="academic_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic Year *</FormLabel>
                    <FormControl>
                      <Input placeholder="2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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