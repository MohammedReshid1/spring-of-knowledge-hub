
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Download, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  status: string;
}

interface PaymentRecord {
  id: string;
  student_id: string;
  amount_paid: number;
  payment_status: string;
  payment_cycle: string;
  payment_date: string;
  academic_year: string;
  payment_method: string;
  notes: string;
  students: Student;
}

interface PaymentExportDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  payments?: PaymentRecord[];
}

export const PaymentExportDialog = ({ open, onOpenChange, payments: passedPayments }: PaymentExportDialogProps = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Use passed props if available, otherwise use internal state
  const dialogOpen = open !== undefined ? open : isOpen;
  const setDialogOpen = onOpenChange || setIsOpen;

  const { data: students } = useQuery({
    queryKey: ['students-for-payment-export'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, student_id, first_name, last_name, grade_level, status')
        .eq('status', 'Active')
        .order('first_name');
      
      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  const filteredStudents = students?.filter(student =>
    student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
  };

  const handleExport = async () => {
    try {
      let paymentsToExport;

      if (passedPayments && passedPayments.length > 0) {
        // Use passed payments if available
        paymentsToExport = passedPayments;
      } else {
        // Fetch payments from database
        const studentIds = selectedStudents.length > 0 ? selectedStudents : students?.map(s => s.id) || [];
        
        if (studentIds.length === 0) {
          toast({
            title: "No students found",
            description: "There are no students to export payment records for.",
            variant: "destructive",
          });
          return;
        }

        const { data: payments, error } = await supabase
          .from('registration_payments')
          .select(`
            *,
            students:student_id (
              id,
              student_id,
              first_name,
              last_name,
              grade_level,
              status
            )
          `)
          .in('student_id', studentIds)
          .order('payment_date', { ascending: false });

        if (error) throw error;
        paymentsToExport = payments;
      }

      if (!paymentsToExport || paymentsToExport.length === 0) {
        toast({
          title: "No payment records found",
          description: "There are no payment records for the selected students.",
          variant: "destructive",
        });
        return;
      }

      const exportData = paymentsToExport.map(payment => ({
        'Student ID': payment.students?.student_id || 'N/A',
        'Student Name': payment.students ? `${payment.students.first_name} ${payment.students.last_name}` : 'Unknown',
        'Grade Level': payment.students?.grade_level?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A',
        'Amount Paid': payment.amount_paid || 0,
        'Payment Status': payment.payment_status || 'Unknown',
        'Payment Cycle': payment.payment_cycle?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A',
        'Payment Method': payment.payment_method || 'Unknown',
        'Payment Date': payment.payment_date ? format(new Date(payment.payment_date), 'yyyy-MM-dd') : 'No date',
        'Academic Year': payment.academic_year || 'Unknown',
        'Notes': payment.notes || '',
        'Student Status': payment.students?.status || 'Unknown'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Records');

      // Set column widths
      const colWidths = [
        { wch: 15 }, // Student ID
        { wch: 20 }, // Student Name
        { wch: 12 }, // Grade Level
        { wch: 12 }, // Amount Paid
        { wch: 15 }, // Payment Status
        { wch: 15 }, // Payment Cycle
        { wch: 15 }, // Payment Method
        { wch: 12 }, // Payment Date
        { wch: 12 }, // Academic Year
        { wch: 30 }, // Notes
        { wch: 12 }  // Student Status
      ];
      worksheet['!cols'] = colWidths;

      const fileName = selectedStudents.length > 0 
        ? `selected_student_payments_${new Date().toISOString().split('T')[0]}.xlsx`
        : `all_student_payments_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      XLSX.writeFile(workbook, fileName);
      
      toast({
        title: "Success",
        description: `Exported ${paymentsToExport.length} payment records successfully`,
      });

      setDialogOpen(false);
      setShowConfirmDialog(false);
      setSelectedStudents([]);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export payment records",
        variant: "destructive",
      });
    }
  };

  const initiateExport = () => {
    if (selectedStudents.length === 0 && !passedPayments) {
      setShowConfirmDialog(true);
    } else {
      handleExport();
    }
  };

  const DialogComponent = ({ children }: { children: React.ReactNode }) => {
    if (open !== undefined && onOpenChange) {
      // Controlled mode - don't render DialogTrigger
      return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          {children}
        </Dialog>
      );
    }

    // Uncontrolled mode - render with DialogTrigger
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Student Payments
          </Button>
        </DialogTrigger>
        {children}
      </Dialog>
    );
  };

  return (
    <>
      <DialogComponent>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Export Student Payment Records</DialogTitle>
            <DialogDescription>
              Select specific students or export all payment records. Leave none selected to export all students' payment records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Students ({filteredStudents.length})
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedStudents.length === filteredStudents.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <ScrollArea className="h-60 border rounded-md p-4">
              <div className="space-y-2">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={student.id}
                      checked={selectedStudents.includes(student.id)}
                      onCheckedChange={() => handleStudentToggle(student.id)}
                    />
                    <Label
                      htmlFor={student.id}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {student.first_name} {student.last_name} ({student.student_id}) - {student.grade_level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {selectedStudents.length > 0 
                  ? `${selectedStudents.length} students selected`
                  : passedPayments 
                    ? `Will export ${passedPayments.length} payment records`
                    : 'No students selected (will export all)'
                }
              </p>
              <Button onClick={initiateExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Payment Records
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogComponent>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export All Student Payment Records</AlertDialogTitle>
            <AlertDialogDescription>
              You haven't selected any specific students. This will export payment records for all {students?.length || 0} active students. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport}>
              Export All Records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
