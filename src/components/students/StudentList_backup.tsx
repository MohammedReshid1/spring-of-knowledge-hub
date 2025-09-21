import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge, getGradeBadgeVariant } from '@/components/ui/status-badge';
import { Loading, PageLoading, ContentLoading } from '@/components/ui/loading';
import { ErrorDisplay } from '@/components/ui/error-boundary';
import { StatCard } from '@/components/ui/data-display';
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
import { useBranch } from '@/contexts/BranchContext';
import { PermissionWrapper } from '@/components/rbac/PermissionWrapper';
import { toast } from '@/hooks/use-toast';
import { StudentForm } from './StudentForm';
import { StudentDetails } from './StudentDetails';
import { BulkStudentImport } from './BulkStudentImport';
import { DuplicateChecker } from './DuplicateChecker';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
// Removed Student type import; fetching raw student objects

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
  const { selectedBranch } = useBranch();

  // Use the enhanced students query with server-side filtering and pagination
  const { data: studentsResponse, isLoading, error } = useQuery<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }, Error>({
    queryKey: ['students', selectedBranch, searchTerm, statusFilter, gradeFilter, classFilter, sortBy, sortOrder, currentPage],
    queryFn: async () => {
      // Map frontend sort values to backend sort values
      const sortMapping: Record<string, string> = {
        'name': 'name',
        'id': 'student_id',
        'grade': 'grade_level', 
        'date': 'created_at'
      };
      
      const response = await apiClient.getStudents({
        // Only filter by branch if we have actual branches in the system
        branch_id: (selectedBranch && selectedBranch !== 'all') ? selectedBranch : undefined,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        grade_level: gradeFilter !== 'all' ? gradeFilter : undefined,
        class_id: classFilter !== 'all' ? classFilter : undefined,
        sort_by: sortMapping[sortBy] || 'created_at',
        sort_order: sortOrder,
        page: currentPage,
        limit: STUDENTS_PER_PAGE
      });
      if (response.error) throw new Error(response.error);
      return response.data || { items: [], total: 0, page: 1, limit: 30, pages: 0 };
    },
    enabled: selectedBranch !== null, // Only enabled when user has selected a branch (including 'all')
    staleTime: 30000,
    refetchOnMount: true
  });

  // Get student statistics
  const { data: studentStats } = useQuery({
    queryKey: ['student-stats', selectedBranch],
    queryFn: async () => {
      const response = await apiClient.getStudentStats(selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    enabled: selectedBranch !== null, // Only enabled when user has selected a branch (including 'all')
    staleTime: 60000
  });

  // Get classes for filtering and display
  const { data: classes } = useQuery<any[]>({
    queryKey: ['classes', selectedBranch],
    queryFn: async () => {
      const response = await apiClient.getClasses();
      if (response.error) throw new Error(response.error);
      const allClasses = response.data || [];
      // Filter classes by selected branch if one is selected
      return selectedBranch && selectedBranch !== 'all'
        ? allClasses.filter(cls => cls.branch_id === selectedBranch)
        : allClasses;
    },
    enabled: selectedBranch !== null, // Only enabled when user has selected a branch (including 'all')
    staleTime: 60000
  });

  // Extract students and pagination data from response
  const students = studentsResponse?.items || [];
  const totalStudents = studentsResponse?.total || 0;
  const totalPages = studentsResponse?.pages || 0;

  // Use students directly from backend (already paginated)
  const filteredStudents = students;
  const paginatedStudents = students;

  // Calculate display range for current page
  const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
  const endIndex = Math.min(startIndex + STUDENTS_PER_PAGE, totalStudents);

  // Delete student mutation
  const deleteStudentMutation = useMutation({
    mutationFn: (studentId: string) => apiClient.deleteStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
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
      return students.filter(student => selectedStudents.has(student.id));
    }
    // If no students are selected, export all filtered students
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
      'Student ID', 'First Name', 'Father Name', 'Grandfather Name', 'Mother Name',
      'Grade Level', 'Class', 'Email', 'Phone', 'Status', 'Date of Birth', 'Gender', 'Address',
      'Emergency Contact Name', 'Emergency Contact Phone', 'Created At'
    ];

    const csvData = studentsToExport.map(student => {
      // Find class name from classes data
      const classInfo = classes?.find(cls => cls.id === student.class_id);
      const className = classInfo?.class_name || 'Not assigned';
      
      return [
        student.student_id,
        student.first_name,
        student.father_name || '',
        student.grandfather_name || '',
        student.mother_name || '',
        student.grade_level,
        className,
        student.email || '',
        student.phone || '',
        student.status,
        student.date_of_birth,
        student.gender || '',
        student.address || '',
        student.emergency_contact_name || '',
        student.emergency_contact_phone || '',
        new Date(student.created_at).toLocaleDateString()
      ];
    });

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

    const worksheetData = studentsToExport.map(student => {
      // Find class name from classes data
      const classInfo = classes?.find(cls => cls.id === student.class_id);
      const className = classInfo?.class_name || 'Not assigned';
      
      return {
        'Student ID': student.student_id,
        'First Name': student.first_name,
        'Father Name': student.father_name || '',
        'Grandfather Name': student.grandfather_name || '',
        'Mother Name': student.mother_name || '',
        'Grade Level': student.grade_level,
        'Class': className,
        'Gender': student.gender || '',
        'Date of Birth': student.date_of_birth,
        'Email': student.email || '',
        'Phone': student.phone || '',
        'Emergency Contact Name': student.emergency_contact_name || '',
        'Emergency Contact Phone': student.emergency_contact_phone || '',
        'Status': student.status,
        'Admission Date': student.admission_date || '',
        'Created At': new Date(student.created_at).toLocaleDateString()
      };
    });

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
    const tableData = studentsToExport.map(student => {
      // Find class name from classes data
      const classInfo = classes?.find(cls => cls.id === student.class_id);
      const className = classInfo?.class_name || 'Not assigned';
      
      return [
        student.student_id,
        `${student.first_name} ${student.father_name || ''} ${student.grandfather_name || ''}`.trim(),
        student.mother_name || '',
        student.grade_level,
        className,
        student.status,
        student.phone || '',
        student.email || ''
      ];
    });

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

  // Bulk delete mutation for super admin
  const bulkDeleteMutation = useMutation({
    mutationFn: (studentIds: string[]) => apiClient.bulkDeleteStudents(studentIds),
    onSuccess: (_, studentIds) => {
      toast({
        title: "Success",
        description: `${studentIds.length} students deleted successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
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

  // Enhanced search function with highlighting
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text;
    
    const searchWords = searchTerm.trim().split(/\s+/);
    let highlightedText = text;
    
    searchWords.forEach(word => {
      if (word.length > 0) {
        const regex = new RegExp(`(${word})`, 'gi');
        highlightedText = highlightedText.replace(regex, (match) => 
          `<mark class="bg-yellow-200 px-1 rounded">${match}</mark>`
        );
      }
    });
    
    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
  };

  // Show helpful message when filter shows count but no results
  const showBranchSwitchMessage = gradeFilter && filteredStudents.length === 0 && (totalStudents || 0) > 0;

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, gradeFilter, classFilter, sortBy, sortOrder]);

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

  const getStatusVariant = (status: string) => {
    const statusMap = {
      'Active': 'success' as const,
      'Graduated': 'info' as const,
      'Transferred Out': 'warning' as const,
      'Dropped Out': 'error' as const,
      'On Leave': 'neutral' as const
    };
    return statusMap[status as keyof typeof statusMap] || 'neutral' as const;
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = (firstName?: string, fatherName?: string) => {
    // Use first_name and father_name since last_name doesn't exist
    const firstInitial = firstName?.charAt(0) ?? '';
    const fatherInitial = (fatherName && fatherName !== 'None' && fatherName !== 'null') ? fatherName.charAt(0) : '';
    return `${firstInitial}${fatherInitial}`.toUpperCase() || 'ST';
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
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    setShowImportCard(false);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (error) {
    return (
      <div className="p-6">
        <ErrorDisplay
          variant="page"
          title="Error loading students"
          error={error}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"0.03\"%3E%3Ccircle cx=\"30\" cy=\"30\" r=\"10\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
              <Users className="mr-2 h-4 w-4" />
              Student Information System
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Student <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Management</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              Comprehensive student data management with advanced search, analytics, and bulk operations.
              Streamline your educational administration with premium tools.
            </p>
          </div>
        </div>

        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
        {/* Action Bar */}
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
              <p className="text-sm text-gray-600">Manage students efficiently with powerful tools</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
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
          <PermissionWrapper permission="bulk_import_students">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportCard(!showImportCard)}
            >
              <Upload className="h-4 w-4 mr-2" />
              {showImportCard ? 'Hide Import' : 'Bulk Import'}
            </Button>
          </PermissionWrapper>
          
          <PermissionWrapper permission="create_student">
            <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
              <SheetTrigger asChild>
                <Button 
                  className="bg-primary hover:bg-primary/90 shadow-sm"
                  onClick={() => setEditingStudent(null)}
                >
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
          </PermissionWrapper>
        </div>
      </div>

      {/* Bulk Import Card */}
      {showImportCard && (
        <BulkStudentImport onImportComplete={handleImportComplete} />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Students"
          value={studentStats?.totalStudents || 0}
          icon={Users}
          variant="info"
          loading={!studentStats && selectedBranch !== null}
        />
        
        <StatCard
          title="Active Students"
          value={studentStats?.activeStudents || 0}
          icon={GraduationCap}
          variant="success"
          loading={!studentStats && selectedBranch !== null}
        />

        <StatCard
          title="Selected"
          value={selectedStudents.size}
          icon={CheckSquare}
          variant={selectedStudents.size > 0 ? "warning" : "default"}
        />
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
                <PermissionWrapper permission="delete_student" requireAdmin={true}>
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
                </PermissionWrapper>
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
              Showing {startIndex + 1}-{endIndex} of {totalStudents} students
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedBranch ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Please select a branch to view students</p>
              <p className="text-gray-500 text-sm mt-2">Use the branch selector above to choose "All Branches" or a specific branch</p>
            </div>
          ) : isLoading ? (
            <ContentLoading message="Loading students..." />
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No students found</p>
              {showBranchSwitchMessage ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 mx-auto max-w-md">
                  <p className="text-blue-800 text-sm font-medium">
                    Found {totalStudents} {gradeFilter?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} students in other branches
                  </p>
                  <p className="text-blue-600 text-xs mt-1">
                    Switch to a different branch to view these students
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
              )}
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
                                {getInitials(student.first_name, student.father_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900">
                                {highlightSearchTerm(
                                  [student.first_name, student.father_name, student.grandfather_name]
                                    .filter(name => name && name.trim() && name !== 'None' && name !== 'null')
                                    .join(' ') || 'No name provided',
                                  searchTerm
                                )}
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
                            {(student.mother_name && student.mother_name !== 'None' && student.mother_name !== 'null') 
                              ? highlightSearchTerm(student.mother_name, searchTerm) 
                              : 'Not provided'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={getGradeBadgeVariant(formatGradeLevel(student.grade_level))} size="sm">
                            {formatGradeLevel(student.grade_level)}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-600">
                            {classes?.find(c => c.id === student.class_id)?.class_name
                              ? highlightSearchTerm(
                                  classes.find(c => c.id === student.class_id)!.class_name,
                                  searchTerm
                                )
                              : 'Not assigned'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={getStatusVariant(student.status)} size="sm" withDot>
                            {student.status}
                          </StatusBadge>
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
                            <PermissionWrapper permission="update_student">
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
                            </PermissionWrapper>
                            <PermissionWrapper permission="delete_student">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(student.id)}
                                className={`hover:bg-red-50 hover:text-red-600 ${!canDelete ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={!canDelete}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PermissionWrapper>
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
                        if (pageNumber > 0 && pageNumber <= totalPages) {
                          return (
                            <PaginationItem key={pageNumber}>
                              <PaginationLink 
                                onClick={() => handlePageChange(pageNumber)} 
                                className={pageNumber === currentPage ? 'bg-primary text-white' : 'cursor-pointer'}
                              >
                                {pageNumber}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                        return null;
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
            </div>
          </div>
        </div>

        {/* Duplicate Checker Dialog */}
        {isDuplicateCheckerOpen && (
          <DuplicateChecker
            isOpen={isDuplicateCheckerOpen}
            onClose={() => setIsDuplicateCheckerOpen(false)}
          />
        )}

        {/* Export Confirmation Dialog */}
        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogContent className="max-w-lg bg-white/95 backdrop-blur-sm border border-white/20 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-900">Export All Students?</DialogTitle>
              <DialogDescription className="space-y-3 text-sm leading-relaxed text-gray-600">
                <p>No students are currently selected.</p>
                <p>This will export all <strong className="text-blue-600">{filteredStudents.length}</strong> student records from the current filtered list.</p>
                <p>Choose your preferred export format or cancel to select specific students first.</p>
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsExportDialogOpen(false)}
                className="w-full sm:w-auto border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  exportToExcel();
                  setIsExportDialogOpen(false);
                }}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white w-full sm:w-auto shadow-lg"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button
                onClick={() => {
                  exportToCSV();
                  setIsExportDialogOpen(false);
                }}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white w-full sm:w-auto shadow-lg"
              >
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                onClick={() => {
                  exportToPDF();
                  setIsExportDialogOpen(false);
                }}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white w-full sm:w-auto shadow-lg"
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Student Details Overlay */}
        {selectedStudent && (
          <StudentDetails
            student={selectedStudent}
            onClose={() => setSelectedStudent(null)}
          />
        )}
      </div>
    </div>
  );
};
