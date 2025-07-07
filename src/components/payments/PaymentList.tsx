
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Search, 
  Filter, 
  Download,
  CreditCard,
  Calendar,
  DollarSign,
  AlertTriangle,
  Users
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { PaymentExportDialog } from './PaymentExportDialog';

interface Payment {
  id: string;
  student_id: string;
  payment_status: string;
  payment_method: string;
  amount_paid: number;
  total_amount: number;
  payment_date: string;
  academic_year: string;
  payment_cycle: string;
  created_at: string;
  students?: {
    first_name: string;
    last_name: string;
    student_id: string;
    grade_level: string;
  };
}

export const PaymentList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['payments', searchTerm, statusFilter, methodFilter, yearFilter],
    queryFn: async () => {
      let query = supabase
        .from('registration_payments')
        .select(`
          *,
          students (
            first_name,
            last_name,
            student_id,
            grade_level
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('payment_status', statusFilter);
      }

      if (methodFilter !== 'all') {
        query = query.eq('payment_method', methodFilter);
      }

      if (yearFilter !== 'all') {
        query = query.eq('academic_year', yearFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    
    return payments.filter(payment => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      const studentName = payment.students 
        ? `${payment.students.first_name} ${payment.students.last_name}`.toLowerCase()
        : '';
      const studentId = payment.students?.student_id?.toLowerCase() || '';
      
      return (
        studentName.includes(searchLower) ||
        studentId.includes(searchLower) ||
        payment.payment_method?.toLowerCase().includes(searchLower)
      );
    });
  }, [payments, searchTerm]);

  const formatGradeLevel = (grade: string) => {
    const gradeMap: Record<string, string> = {
      'pre_k': 'Pre KG',
      'kg': 'KG',
      'prep': 'Prep',
      'kindergarten': 'KG',
      'grade_1': 'Grade 1',
      'grade_2': 'Grade 2',
      'grade_3': 'Grade 3',
      'grade_4': 'Grade 4',
      'grade_5': 'Grade 5',
      'grade_6': 'Grade 6',
      'grade_7': 'Grade 7',
      'grade_8': 'Grade 8',
      'grade_9': 'Grade 9',
      'grade_10': 'Grade 10',
      'grade_11': 'Grade 11',
      'grade_12': 'Grade 12',
    };

    return gradeMap[grade] || grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const toggleSelectPayment = (paymentId: string) => {
    setSelectedPayments(prev =>
      prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPayments.length === filteredPayments.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(filteredPayments.map(p => p.id));
    }
  };

  const exportToExcel = (paymentsToExport?: Payment[]) => {
    const dataToExport = paymentsToExport || filteredPayments;
    
    if (dataToExport.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no payment records to export.",
        variant: "destructive",
      });
      return;
    }

    const exportData = dataToExport.map(payment => ({
      'Student ID': payment.students?.student_id || 'N/A',
      'Student Name': payment.students 
        ? `${payment.students.first_name} ${payment.students.last_name}`
        : 'N/A',
      'Grade Level': payment.students?.grade_level 
        ? formatGradeLevel(payment.students.grade_level)
        : 'N/A',
      'Payment Status': payment.payment_status,
      'Payment Method': payment.payment_method || 'N/A',
      'Amount Paid': payment.amount_paid || 0,
      'Total Amount': payment.total_amount || 0,
      'Payment Date': payment.payment_date 
        ? format(new Date(payment.payment_date), 'yyyy-MM-dd')
        : 'N/A',
      'Academic Year': payment.academic_year,
      'Payment Cycle': payment.payment_cycle,
      'Created Date': format(new Date(payment.created_at), 'yyyy-MM-dd')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Records');

    const colWidths = [
      { wch: 15 }, // Student ID
      { wch: 20 }, // Student Name
      { wch: 12 }, // Grade Level
      { wch: 15 }, // Payment Status
      { wch: 15 }, // Payment Method
      { wch: 12 }, // Amount Paid
      { wch: 12 }, // Total Amount
      { wch: 12 }, // Payment Date
      { wch: 12 }, // Academic Year
      { wch: 15 }, // Payment Cycle
      { wch: 12 }  // Created Date
    ];
    worksheet['!cols'] = colWidths;

    const fileName = selectedPayments.length > 0 
      ? `selected_payment_records_${new Date().toISOString().split('T')[0]}.xlsx`
      : `all_payment_records_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
    
    toast({
      title: "Success",
      description: `Exported ${dataToExport.length} payment records successfully`,
    });
  };

  const handleExportSelected = () => {
    if (selectedPayments.length === 0) {
      toast({
        title: "No payments selected",
        description: "Please select payment records to export.",
        variant: "destructive",
      });
      return;
    }

    const selectedPaymentData = filteredPayments.filter(payment => 
      selectedPayments.includes(payment.id)
    );
    
    exportToExcel(selectedPaymentData);
  };

  const uniqueYears = useMemo(() => {
    if (!payments) return [];
    const years = [...new Set(payments.map(p => p.academic_year))];
    return years.sort().reverse();
  }, [payments]);

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header with Logo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img 
            src="/SPRING_LOGO-removebg-preview.png" 
            alt="School Logo" 
            className="h-20 w-20 object-contain"
          />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Payment Records</h2>
            <p className="text-gray-600">
              Manage and track student payment information
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => exportToExcel()}>
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
          {selectedPayments.length > 0 && (
            <Button variant="outline" onClick={handleExportSelected}>
              <Download className="h-4 w-4 mr-2" />
              Export Selected ({selectedPayments.length})
            </Button>
          )}
          <PaymentExportDialog />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-600">Total Records</p>
                <p className="text-2xl font-bold text-blue-900">{payments?.length || 0}</p>
              </div>
              <CreditCard className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-green-600">Paid</p>
                <p className="text-2xl font-bold text-green-900">
                  {payments?.filter(p => p.payment_status === 'Paid').length || 0}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-red-600">Unpaid</p>
                <p className="text-2xl font-bold text-red-900">
                  {payments?.filter(p => p.payment_status === 'Unpaid').length || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-600">Partial</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {payments?.filter(p => p.payment_status === 'Partial').length || 0}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Input
                type="text"
                placeholder="Search by student name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {uniqueYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Records ({filteredPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading payment records...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-600 font-medium">Error loading payment records</p>
              <p className="text-red-500 text-sm">{error.message}</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No payment records found</p>
              <p className="text-gray-500 text-sm">Adjust the filters or add new payment records</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedPayments.length === filteredPayments.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Academic Year</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="w-[50px]">
                        <Checkbox
                          checked={selectedPayments.includes(payment.id)}
                          onCheckedChange={() => toggleSelectPayment(payment.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {payment.students 
                              ? `${payment.students.first_name} ${payment.students.last_name}`
                              : 'N/A'
                            }
                          </p>
                          <p className="text-sm text-gray-500">
                            {payment.students?.student_id || 'N/A'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.students?.grade_level 
                          ? formatGradeLevel(payment.students.grade_level)
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(payment.payment_status)} variant="outline">
                          {payment.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{payment.payment_method || 'N/A'}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">${payment.amount_paid || 0}</p>
                          <p className="text-sm text-gray-500">
                            of ${payment.total_amount || 0}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.payment_date 
                          ? format(new Date(payment.payment_date), 'MMM dd, yyyy')
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell>{payment.academic_year}</TableCell>
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
