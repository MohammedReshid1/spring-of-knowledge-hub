import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Calculator, Receipt } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import type { Payment, FeeCategory, Student } from '@/types/api';

const paymentItemSchema = z.object({
  fee_category_id: z.string().min(1, 'Fee category is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1').default(1),
  unit_amount: z.number().min(0, 'Amount must be positive'),
  discount_amount: z.number().min(0).optional().default(0),
  late_fee_amount: z.number().min(0).optional().default(0),
  notes: z.string().optional(),
});

const paymentSchema = z.object({
  student_id: z.string().min(1, 'Student is required'),
  payment_method: z.enum(['cash', 'card', 'bank_transfer', 'cheque', 'online'], {
    required_error: 'Payment method is required'
  }),
  payment_date: z.string().min(1, 'Payment date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  discount_amount: z.number().min(0).optional().default(0),
  items: z.array(paymentItemSchema).min(1, 'At least one payment item is required'),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentFormProps {
  payment?: Payment;
  studentId?: string; // Pre-selected student ID
  onSuccess?: (payment: Payment) => void;
  onCancel?: () => void;
}

export function PaymentForm({ payment, studentId, onSuccess, onCancel }: PaymentFormProps) {
  const { selectedBranch } = useBranch();
  const branchId = selectedBranch === 'all' ? undefined : selectedBranch || undefined;
  const enableQueries = !!selectedBranch;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);

  // Format: First Father Grandfather
  const formatStudentName = (s: Student) => {
    const parts = [s.first_name, (s as any).father_name, (s as any).grandfather_name].filter(Boolean);
    return parts.join(' ');
  };

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      student_id: studentId || (payment as any)?.student_id || '',
      payment_method: (payment as any)?.payment_method || 'cash',
      payment_date: (payment as any)?.payment_date || new Date().toISOString().split('T')[0],
      due_date: (payment as any)?.due_date || new Date().toISOString().split('T')[0],
      reference_number: (payment as any)?.reference_number || (payment as any)?.payment_reference || '',
      notes: (payment as any)?.notes || '',
      discount_amount: Number((payment as any)?.discount_amount ?? 0),
      items: payment ? [
        {
          fee_category_id: (payment as any)?.fee_category_id || (payment as any)?.fee_category?.id || '',
          quantity: Number((payment as any)?.quantity ?? 1) || 1,
          unit_amount: Number((payment as any)?.unit_amount ?? (payment as any)?.amount ?? 0) || 0,
          discount_amount: Number((payment as any)?.discount_amount ?? 0) || 0,
          late_fee_amount: Number((payment as any)?.late_fee_amount ?? 0) || 0,
          notes: (payment as any)?.notes || '',
        }
      ] : [
        {
          fee_category_id: '',
          quantity: 1,
          unit_amount: 0,
          discount_amount: 0,
          late_fee_amount: 0,
          notes: '',
        }
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Fetch fee categories
  const { data: feeCategories = [] } = useQuery({
    queryKey: ['fee-categories', branchId ?? 'all'],
    queryFn: () => apiClient.getFeeCategories({
      branch_id: branchId,
      is_active: true,
    }),
    enabled: enableQueries,
    select: (resp) => (resp as any).data || (resp as any).items || [],
  });

  // Search students
  const { data: studentsData } = useQuery({
    queryKey: ['students-search', studentSearch, branchId ?? 'all'],
    queryFn: () => apiClient.searchStudentsForPayments(studentSearch, branchId),
    enabled: studentSearch.length > 2,
    select: (resp) => (resp as any).data || (resp as any).items || [],
  });

  // Fetch all students to find pre-selected student info
  const { data: allStudents } = useQuery({
    queryKey: ['all-students', branchId ?? 'all'],
    queryFn: () => apiClient.getAllStudents(),
    enabled: enableQueries && !!studentId,
    select: (resp) => (resp as any).data || (resp as any).items || [],
  });

  // Effect to auto-populate student search when studentId is provided
  useEffect(() => {
    if (studentId && allStudents) {
      const preSelectedStudent = allStudents.find((s: Student) => s.id === studentId);
      if (preSelectedStudent && !studentSearch) {
        setStudentSearch(formatStudentName(preSelectedStudent));
      }
    }
  }, [studentId, allStudents, studentSearch, formatStudentName]);

  // Calculate total amount when items change
  const watchedItems = form.watch('items');
  const watchedDiscount = form.watch('discount_amount');

  // Function to recalculate total amount
  const recalculateTotal = useCallback(() => {
    const currentItems = form.getValues('items') || [];
    const currentDiscount = form.getValues('discount_amount') || 0;

    const itemsTotal = currentItems.reduce((sum: number, item: any) => {
      const ua = Number(item?.unit_amount ?? 0);
      const qty = Number(item?.quantity ?? 1);
      const disc = Number(item?.discount_amount ?? 0);
      const late = Number(item?.late_fee_amount ?? 0);
      const itemTotal = ua * qty - disc + late;
      return sum + (Number.isFinite(itemTotal) ? itemTotal : 0);
    }, 0);
    const finalTotal = itemsTotal - Number(currentDiscount);
    setTotalAmount(Math.max(0, Number.isFinite(finalTotal) ? finalTotal : 0));
  }, [form]);

  useEffect(() => {
    const itemsTotal = (watchedItems || []).reduce((sum: number, item: any) => {
      const ua = Number(item?.unit_amount ?? 0);
      const qty = Number(item?.quantity ?? 1);
      const disc = Number(item?.discount_amount ?? 0);
      const late = Number(item?.late_fee_amount ?? 0);
      const itemTotal = ua * qty - disc + late;
      return sum + (Number.isFinite(itemTotal) ? itemTotal : 0);
    }, 0);
    const finalTotal = itemsTotal - Number(watchedDiscount ?? 0);
    setTotalAmount(Math.max(0, Number.isFinite(finalTotal) ? finalTotal : 0));
  }, [watchedItems, watchedDiscount]);

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: (data: PaymentFormData) => {
      if (!branchId) {
        throw new Error('Please select a branch before creating a payment');
      }

      return apiClient.createPayment({
        student_id: data.student_id,
        branch_id: branchId,
        payment_method: data.payment_method as any,
        payment_date: data.payment_date,
        reference_number: data.reference_number,
        notes: data.notes,
        discount_amount: data.discount_amount,
        items: data.items.map((i) => ({
          fee_category_id: i.fee_category_id,
          quantity: i.quantity,
          unit_amount: i.unit_amount,
          discount_amount: i.discount_amount,
          notes: i.notes,
        })),
      });
    },
    onSuccess: (response) => {
      if (response.data) {
        toast({
          title: 'Success',
          description: 'Payment created successfully',
        });
        onSuccess?.(response.data);
        form.reset();
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create payment',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (data: PaymentFormData) => {
    setIsSubmitting(true);
    try {
      await createPaymentMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPaymentItem = () => {
    append({
      fee_category_id: '',
      quantity: 1,
      unit_amount: 0,
      discount_amount: 0,
      late_fee_amount: 0,
      notes: '',
    });
  };

  const getStudentDisplayName = (studentId: string) => {
    // First check in search results
    let student = studentsData?.find((s: Student) => s.id === studentId);
    // If not found in search results, check in all students (for pre-selected)
    if (!student && allStudents) {
      student = allStudents.find((s: Student) => s.id === studentId);
    }
    return student ? `${formatStudentName(student)} (${student.student_id})` : studentId;
  };

  return (
    <div className="space-y-6">
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
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }
      `}</style>

      {/* Premium Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl animate-fadeInUp">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-700 via-green-700 to-teal-700 bg-clip-text text-transparent">
            {payment ? 'Edit Payment' : 'Create Payment'}
          </h2>
          <p className="text-slate-600 font-medium">
            {payment ? 'Update payment details' : 'Create a new payment with multiple fee categories'}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Student Selection */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp">
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200/50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  Student Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <FormField
                  control={form.control}
                  name="student_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student *</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            placeholder="Search student by name or ID..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                          />
                          {studentsData && studentsData.length > 0 && (
                            <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
                              {studentsData.map((student: Student) => (
                                <div
                                  key={student.id}
                                  className="p-2 hover:bg-muted rounded cursor-pointer"
                                  onClick={() => {
                                    field.onChange(student.id);
                                    setStudentSearch(formatStudentName(student));
                                  }}
                                >
                                  <div className="font-medium">
                                    {formatStudentName(student)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    ID: {student.student_id} | Grade: {student.grade_level}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {field.value && (
                            <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                              <span className="text-green-700 font-medium">Selected: </span>
                              <span className="text-green-800">{getStudentDisplayName(field.value)}</span>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Payment Details */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="border-b border-slate-100/50 pb-4">
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200/50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="payment_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
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
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="online">Online Payment</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reference_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Transaction/Reference number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Payment Items */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="border-b border-slate-100/50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200/50">
                    <Receipt className="h-5 w-5 text-emerald-600" />
                  </div>
                  Payment Items
                </CardTitle>
                <Button type="button" onClick={addPaymentItem} size="sm" className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {fields.map((field, index) => (
                <div key={field.id} className="border border-emerald-100/50 rounded-xl p-5 space-y-4 bg-gradient-to-br from-emerald-50/30 to-green-50/30 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-emerald-900 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-emerald-600 to-green-600 text-white text-xs font-bold">
                        {index + 1}
                      </span>
                      Payment Item
                    </h4>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => remove(index)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.fee_category_id`}
                      render={({ field: itemField }) => (
                        <FormItem>
                          <FormLabel>Fee Category *</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              itemField.onChange(value);
                              const selected = feeCategories.find((c: FeeCategory) => c.id === value);
                              if (selected) {
                                // Auto-fill with the full amount, but user can now edit it
                                const currentAmount = form.getValues(`items.${index}.unit_amount`) || 0;
                                // Only auto-fill if current amount is 0 or exceeds the new category amount
                                const newBaseAmount = Number(selected.base_amount) || 0;
                                if (currentAmount === 0 || currentAmount > newBaseAmount) {
                                  form.setValue(`items.${index}.unit_amount`, newBaseAmount, { shouldValidate: true, shouldDirty: true });
                                  // Trigger form recalculation
                                  form.trigger(`items.${index}.unit_amount`);
                                }
                                if (!form.getValues(`items.${index}.quantity`)) {
                                  form.setValue(`items.${index}.quantity`, 1, { shouldValidate: true });
                                  form.trigger(`items.${index}.quantity`);
                                }
                                // Recalculate total amount after auto-fill
                                setTimeout(() => recalculateTotal(), 0);
                              }
                            }}
                            value={itemField.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {feeCategories.map((category: FeeCategory) => (
                                <SelectItem key={category.id} value={category.id}>
                                  <div className="flex flex-col">
                                    <span>{category.name}</span>
                                    <span className="text-sm text-muted-foreground">
                                      ${category.base_amount}
                                    </span>
                                  </div>
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
                      name={`items.${index}.quantity`}
                      render={({ field: itemField }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...itemField}
                              onChange={(e) => itemField.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_amount`}
                      render={({ field: itemField }) => {
                        const feeCategoryId = form.watch(`items.${index}.fee_category_id`);
                        const selectedCategory = feeCategories.find((c: FeeCategory) => c.id === feeCategoryId);
                        const maxAmount = Number(selectedCategory?.base_amount) || 0;

                        return (
                          <FormItem>
                            <FormLabel>Unit Amount (Max: ${maxAmount.toFixed(2)})</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max={maxAmount}
                                step="0.01"
                                placeholder="Enter amount"
                                {...itemField}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  if (value <= maxAmount || maxAmount === 0) {
                                    itemField.onChange(value);
                                  } else {
                                    // Prevent exceeding max amount
                                    itemField.onChange(maxAmount);
                                    toast({
                                      title: "Amount Limited",
                                      description: `Amount cannot exceed the fee category limit of $${maxAmount.toFixed(2)}`,
                                      variant: "destructive"
                                    });
                                  }
                                  // Trigger form recalculation
                                  form.trigger(`items.${index}.unit_amount`);
                                  // Recalculate total amount after manual change
                                  setTimeout(() => recalculateTotal(), 0);
                                }}
                              />
                            </FormControl>
                            {selectedCategory && (
                              <div className="text-xs text-muted-foreground">
                                Fee category base amount: ${maxAmount.toFixed(2)}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.discount_amount`}
                      render={({ field: itemField }) => (
                        <FormItem>
                          <FormLabel>Item Discount</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              {...itemField}
                              onChange={(e) => {
                                itemField.onChange(Number(e.target.value) || 0);
                                // Recalculate total amount after Item Discount change
                                setTimeout(() => recalculateTotal(), 0);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.late_fee_amount`}
                      render={({ field: itemField }) => (
                        <FormItem>
                          <FormLabel>Late Fee</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              {...itemField}
                              onChange={(e) => {
                                itemField.onChange(Number(e.target.value) || 0);
                                // Recalculate total amount after Late Fee change
                                setTimeout(() => recalculateTotal(), 0);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.notes`}
                      render={({ field: itemField }) => (
                        <FormItem>
                          <FormLabel>Item Notes</FormLabel>
                          <FormControl>
                            <Input placeholder="Additional notes for this item" {...itemField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Item total display */}
                  <div className="flex items-center justify-end space-x-2">
                    {(() => {
                      const feeCategoryId = form.watch(`items.${index}.fee_category_id`);
                      const selectedCategory = feeCategories.find((c: FeeCategory) => c.id === feeCategoryId);
                      const ua = Number(form.watch(`items.${index}.unit_amount`) ?? 0);
                      const qty = Number(form.watch(`items.${index}.quantity`) ?? 1);
                      const disc = Number(form.watch(`items.${index}.discount_amount`) ?? 0);
                      const late = Number(form.watch(`items.${index}.late_fee_amount`) ?? 0);
                      const total = ua * qty - disc + late;
                      const categoryBaseAmount = Number(selectedCategory?.base_amount) || 0;
                      const isPartialPayment = selectedCategory && ua < categoryBaseAmount;

                      return (
                        <>
                          {isPartialPayment && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              Partial Payment
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-sm">
                            Item Total: ${(Number.isFinite(total) ? total : 0).toFixed(2)}
                          </Badge>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Total Calculation and Additional Fields */}
          <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
            <CardHeader className="border-b border-slate-100/50 pb-4">
              <CardTitle className="text-lg font-semibold bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200/50">
                  <Calculator className="h-5 w-5 text-emerald-600" />
                </div>
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discount_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Discount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => {
                            field.onChange(Number(e.target.value) || 0);
                            // Recalculate total amount after Additional Discount change
                            setTimeout(() => recalculateTotal(), 0);
                          }}
                        />
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
                      <FormLabel>Payment Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes about this payment" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200/50">
                <span className="text-lg font-bold text-emerald-900">Total Amount:</span>
                <Badge className="text-xl px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg">
                  ${totalAmount.toFixed(2)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="border-slate-300 hover:bg-slate-50 transition-all duration-300"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <Receipt className="h-4 w-4 mr-2" />
                  {payment ? 'Update Payment' : 'Create Payment'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
