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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Plus, Search, Eye, Edit, Trash2, Users, GraduationCap, CreditCard, Filter, Download, Upload, FileText, FileSpreadsheet, CheckSquare, ChevronDown, UserCheck } from 'lucide-react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { toast } from '@/hooks/use-toast';
import { StudentForm } from './StudentForm';
import { StudentDetails } from './StudentDetails';
import { BulkStudentImport } from './BulkStudentImport';
import { DuplicateChecker } from './DuplicateChecker';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const STUDENTS_PER_PAGE = 30;

export const StudentList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showImportCard, setShowImportCard] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'id' | 'grade' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isDuplicateCheckerOpen, setIsDuplicateCheckerOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { canDelete, isSuperAdmin } = useRoleAccess();

  // Bulk delete mutation for super admin
  const bulkDeleteMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', studentIds);
      
      if (error) throw error;
    },
    onSuccess: (_, studentIds) => {
      toast({
        title: "Success",
        description: `${studentIds.length} students deleted successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSelectedStudents(new Set());
      setSelectAll(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete students: " + error.message,
        variant: "destructive",
      });
    }
  });

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
    return `${symbols[currency as keyof typeof symbols] || currency} ${amount.toFixed(2)}`;
  };

  // Real-time subscription for students
  useEffect(() => {
    const channel = supabase
      .channel('students-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students'
        },
        () => {
          console.log('Students table changed, refetching...');
          queryClient.invalidateQueries({ queryKey: ['students'] });
          queryClient.invalidateQueries({ queryKey: ['student-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: students, isLoading, error } = useQuery({
    queryKey: ['students', searchTerm, statusFilter, gradeFilter, classFilter],
    queryFn: async () => {
      console.log('Fetching students with filters...');
      
      let query = supabase
        .from('students')
        .select(`
          *,
          classes:class_id (
            id,
            class_name,
            grade_levels:grade_level_id (
              grade
            )
          ),
          registration_payments (
            payment_status,
            amount_paid,
            payment_date
          )
        `);

      // Apply server-side filtering for better performance
      if (searchTerm) {
        query = query.or(`student_id.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,mother_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }
      
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }
      
      if (gradeFilter && gradeFilter !== 'all') {
        query = query.eq('grade_level', gradeFilter as any);
      }
      
      if (classFilter && classFilter !== 'all') {
        query = query.eq('class_id', classFilter);
      }

      // Remove any limits to fetch all matching students
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching students:', error);
        throw error;
      }
      console.log('Students fetched successfully:', data?.length);
      return data;
    },
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 60000 // Refetch every minute
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('class_name');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['student-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('status, grade_level');
      
      if (error) throw error;
      
      const totalStudents = data.length;
      const activeStudents = data.filter(s => s.status === 'Active').length;
      const statusCounts: Record<string, number> = data.reduce((acc, student) => {
        const status = student.status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        totalStudents,
        activeStudents,
        statusCounts
      };
    }
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      console.log('Attempting to delete student:', studentId);
      const { data: session } = await supabase.auth.getSession();
      console.log('Current session:', session);
      
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);
      
      if (error) {
        console.error('Delete error:', error);
        throw error;
      }
      console.log('Student deleted successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      toast({
        title: "Success",
        description: "Student deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete student: " + error.message,
        variant: "destructive",
      });
    }
  });

  // Enhanced export functions with selection support
  const getStudentsToExport = () => {
    if (selectedStudents.size > 0) {
      return filteredStudents.filter(student => selectedStudents.has(student.id));
    }
    return filteredStudents;
  };

  const exportToCSV = () => {
    const studentsToExport = getStudentsToExport();
    
    if (!studentsToExport || studentsToExport.length === 0) {
      toast({
        title: "No Data",
        description: "No students selected for export",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = [
      'Student ID', 'First Name', 'Last Name', 'Mother Name', 'Father Name', 'Grandfather Name',
      'Grade Level', 'Class', 'Email', 'Phone', 'Status', 'Date of Birth', 'Gender', 'Address',
      'Emergency Contact Name', 'Emergency Contact Phone', 'Created At'
    ];

    const csvData = studentsToExport.map(student => [
      student.student_id,
      student.first_name,
      student.last_name,
      student.mother_name || '',
      student.father_name || '',
      student.grandfather_name || '',
      student.grade_level,
      student.classes?.class_name || '',
      student.email || '',
      student.phone || '',
      student.status,
      student.date_of_birth,
      student.gender || '',
      student.address || '',
      student.emergency_contact_name || '',
      student.emergency_contact_phone || '',
      new Date(student.created_at).toLocaleDateString()
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: `${studentsToExport.length} students exported to CSV successfully`,
    });
  };

  const handleExport = (format: 'excel' | 'csv' | 'pdf') => {
    if (selectedStudents.size === 0) {
      setIsExportDialogOpen(true);
    } else {
      if (format === 'excel') exportToExcel();
      else if (format === 'csv') exportToCSV();
      else exportToPDF();
    }
  };

  const exportToExcel = () => {
    const studentsToExport = getStudentsToExport();
    
    if (!studentsToExport || studentsToExport.length === 0) {
      toast({
        title: "No Data",
        description: "No students selected for export",
        variant: "destructive",
      });
      return;
    }

    const worksheetData = studentsToExport.map(student => ({
      'Student ID': student.student_id,
      'First Name': student.first_name,
      'Last Name': student.last_name,
      'Mother Name': student.mother_name || '',
      'Grade Level': student.grade_level,
      'Class': student.classes?.class_name || '',
      'Gender': student.gender || '',
      'Date of Birth': student.date_of_birth,
      'Emergency Contact Name': student.emergency_contact_name || '',
      'Emergency Contact Phone': student.emergency_contact_phone || '',
      'Status': student.status,
      'Admission Date': student.admission_date || '',
      'Created At': new Date(student.created_at).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    const fileName = selectedStudents.size > 0 
      ? `students_selected_${new Date().toISOString().split('T')[0]}.xlsx`
      : `students_all_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Success",
      description: `${studentsToExport.length} students exported to Excel successfully`,
    });

    setIsExportDialogOpen(false);
  };

  const exportToPDF = () => {
    const studentsToExport = getStudentsToExport();
    
    if (!studentsToExport || studentsToExport.length === 0) {
      toast({
        title: "No Data",
        description: "No students selected for export",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Student List Report', 14, 22);
    
    // Add date and count
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.text(`Total Students: ${studentsToExport.length}`, 14, 40);
    
    // Prepare table data
    const tableData = studentsToExport.map(student => [
      student.student_id,
      `${student.first_name} ${student.last_name}`,
      student.mother_name || '',
      student.grade_level,
      student.classes?.class_name || '',
      student.status,
      student.phone || '',
      student.email || ''
    ]);

    // Add table using type assertion
    (doc as any).autoTable({
      head: [['Student ID', 'Full Name', 'Mother Name', 'Grade', 'Class', 'Status', 'Phone', 'Email']],
      body: tableData,
      startY: 48,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save(`students_report_${new Date().toISOString().split('T')[0]}.pdf`);

    toast({
      title: "Success",
      description: `${studentsToExport.length} students exported to PDF successfully`,
    });
  };

  // Enhanced search function with highlighting
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  // Since we're now filtering at the database level, we just need to sort the results
  const filteredStudents = students?.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        break;
      case 'id':
        comparison = a.student_id.localeCompare(b.student_id);
        break;
      case 'grade':
        const gradeOrder = ['pre_k', 'kg', 'prep', 'kindergarten', 'grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12'];
        comparison = gradeOrder.indexOf(a.grade_level) - gradeOrder.indexOf(b.grade_level);
        break;
      case 'date':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  }) || [];

  // Pagination calculations
  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
  const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
  const endIndex = startIndex + STUDENTS_PER_PAGE;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, gradeFilter, classFilter]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedStudents(new Set(paginatedStudents.map(s => s.id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedStudents(newSelected);
    setSelectAll(newSelected.size === paginatedStudents.length);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'Active': 'bg-green-100 text-green-800 border-green-200',
      'Graduated': 'bg-blue-100 text-blue-800 border-blue-200',
      'Transferred Out': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Dropped Out': 'bg-red-100 text-red-800 border-red-200',
      'On Leave': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      'Paid': 'bg-green-100 text-green-800',
      'Unpaid': 'bg-red-100 text-red-800',
      'Partially Paid': 'bg-yellow-100 text-yellow-800',
      'Waived': 'bg-blue-100 text-blue-800',
      'Refunded': 'bg-purple-100 text-purple-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const handleDelete = (studentId: string) => {
    if (!canDelete) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to delete students.",
        variant: "destructive",
      });
      return;
    }
    if (confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      deleteStudentMutation.mutate(studentId);
    }
  };

  const handleImportComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['student-stats'] });
    setShowImportCard(false);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading students</p>
              <p className="text-sm mt-1">{error.message}</p>
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
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
          <h1 className="text-3xl font-bold text-gray-900">Student Management</h1>
          <p className="text-gray-600 mt-1">Manage student registrations and information</p>
        </div>
        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export ({selectedStudents.size > 0 ? selectedStudents.size : filteredStudents.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-background border shadow-md">
              <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDuplicateCheckerOpen(true)}
            className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Check Duplicates
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportCard(!showImportCard)}
          >
            <Upload className="h-4 w-4 mr-2" />
            {showImportCard ? 'Hide Import' : 'Bulk Import'}
          </Button>
          
          <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
            <SheetTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Student
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-xl">
                  {editingStudent ? 'Edit Student' : 'Add New Student'}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <StudentForm
                  student={editingStudent}
                  onSuccess={() => {
                    setIsFormOpen(false);
                    setEditingStudent(null);
                    queryClient.invalidateQueries({ queryKey: ['students'] });
                    queryClient.invalidateQueries({ queryKey: ['student-stats'] });
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Bulk Import Card */}
      {showImportCard && (
        <BulkStudentImport onImportComplete={handleImportComplete} />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-600">Total Students</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.totalStudents || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-green-600">Active Students</p>
                <p className="text-2xl font-bold text-green-900">{stats?.activeStudents || 0}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-600">Selected</p>
                <p className="text-2xl font-bold text-purple-900">{selectedStudents.size}</p>
              </div>
              <CheckSquare className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-600">Pending Payments</p>
                <p className="text-2xl font-bold text-orange-900">
                  {students?.filter(s => s.registration_payments?.some(p => p.payment_status === 'Unpaid')).length || 0}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Search and Filters with Sorting */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Real-time Search, Filter & Sort Students
          </CardTitle>
          <p className="text-sm text-gray-600">Search by Student ID, Name, Mother's Name, Phone Numbers, Email, or Class Name</p>
          {selectedStudents.size > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''} selected
              </Badge>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedStudents(new Set())}
                >
                  Clear Selection
                </Button>
                {isSuperAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete ${selectedStudents.size} selected students? This action cannot be undone.`)) {
                        bulkDeleteMutation.mutate(Array.from(selectedStudents));
                      }
                    }}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedStudents.size})
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by Student ID, Name, Mother's Name, Phone, Email, or Class..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Graduated">Graduated</SelectItem>
                <SelectItem value="Transferred Out">Transferred Out</SelectItem>
                <SelectItem value="Dropped Out">Dropped Out</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                <SelectItem value="pre_k">Pre-K</SelectItem>
                <SelectItem value="kg">KG</SelectItem>
                <SelectItem value="prep">PREP</SelectItem>
                <SelectItem value="kindergarten">Kindergarten</SelectItem>
                {Array.from({length: 12}, (_, i) => (
                  <SelectItem key={i} value={`grade_${i + 1}`}>Grade {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes?.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.class_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="id">Sort by Student ID</SelectItem>
                <SelectItem value="grade">Sort by Grade</SelectItem>
                <SelectItem value="date">Sort by Registration Date</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as typeof sortOrder)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending (A-Z, 1-9)</SelectItem>
                <SelectItem value="desc">Descending (Z-A, 9-1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">
              Students ({filteredStudents.length})
            </CardTitle>
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredStudents.length)} of {filteredStudents.length} students
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No students found</p>
              <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="font-semibold">Student</TableHead>
                      <TableHead className="font-semibold">Student ID</TableHead>
                      <TableHead className="font-semibold">Mother's Name</TableHead>
                      <TableHead className="font-semibold">Grade</TableHead>
                      <TableHead className="font-semibold">Class</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Payment</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.map((student) => (
                      <TableRow key={student.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell>
                          <Checkbox
                            checked={selectedStudents.has(student.id)}
                            onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage 
                                src={student.photo_url} 
                                alt={`${student.first_name} ${student.last_name}`}
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {getInitials(student.first_name, student.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900">
                                {highlightSearchTerm(`${student.first_name} ${student.last_name}`, searchTerm)}
                              </div>
                              <div className="text-sm text-gray-500">{student.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {highlightSearchTerm(student.student_id, searchTerm)}
                          </code>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-600">
                            {student.mother_name ? highlightSearchTerm(student.mother_name, searchTerm) : 'Not provided'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {formatGradeLevel(student.grade_level)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-600">
                            {student.classes?.class_name ? highlightSearchTerm(student.classes.class_name, searchTerm) : 'Not assigned'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(student.status)} variant="outline">
                            {student.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {student.registration_payments?.[0] ? (
                            <Badge className={getPaymentStatusColor(student.registration_payments[0].payment_status)} variant="outline">
                              {student.registration_payments[0].payment_status}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100 text-gray-600">
                              No Record
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedStudent(student)}
                              className="hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingStudent(student);
                                setIsFormOpen(true);
                              }}
                              className="hover:bg-green-50 hover:text-green-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(student.id)}
                              className={`hover:bg-red-50 hover:text-red-600 ${!canDelete ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={!canDelete}
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {/* Show first page */}
                      {currentPage > 3 && (
                        <>
                          <PaginationItem>
                            <PaginationLink onClick={() => handlePageChange(1)} className="cursor-pointer">
                              1
                            </PaginationLink>
                          </PaginationItem>
                          {currentPage > 4 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                        </>
                      )}
                      
                      {/* Show pages around current page */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                        if (pageNumber > totalPages) return null;
                        
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink
                              onClick={() => handlePageChange(pageNumber)}
                              isActive={currentPage === pageNumber}
                              className="cursor-pointer"
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      {/* Show last page */}
                      {currentPage < totalPages - 2 && (
                        <>
                          {currentPage < totalPages - 3 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink onClick={() => handlePageChange(totalPages)} className="cursor-pointer">
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedStudent && (
        <StudentDetails
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {/* Duplicate Checker Modal */}
      <DuplicateChecker
        isOpen={isDuplicateCheckerOpen}
        onClose={() => setIsDuplicateCheckerOpen(false)}
      />

      {/* Export Confirmation Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Export All Students?</DialogTitle>
            <DialogDescription className="space-y-3 text-sm leading-relaxed">
              <p>No students are currently selected.</p>
              <p>This will export all <strong>{filteredStudents.length}</strong> student records from the current filtered list.</p>
              <p>Choose your preferred export format or cancel to select specific students first.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setIsExportDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => { exportToExcel(); setIsExportDialogOpen(false); }}
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button 
              onClick={() => { exportToCSV(); setIsExportDialogOpen(false); }}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
