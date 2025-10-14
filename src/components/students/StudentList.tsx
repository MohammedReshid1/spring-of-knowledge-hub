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
import { Plus, Search, Eye, Edit, Trash2, Users, GraduationCap, CreditCard, Filter, Download, Upload, FileText, FileSpreadsheet, CheckSquare, ChevronDown, UserCheck, X } from 'lucide-react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useBranch } from '@/contexts/BranchContext';
import { PermissionWrapper } from '@/components/rbac/PermissionWrapper';
import { toast } from '@/hooks/use-toast';
import { useDialogSidebarCollapse } from '@/hooks/useDialogSidebarCollapse';
import { StudentForm } from './StudentForm';
import { StudentDetails } from './StudentDetails';
import { BulkStudentImport } from './BulkStudentImport';
import { DuplicateChecker } from './DuplicateChecker';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const STUDENTS_PER_PAGE = 30;

export const StudentList = () => {

  // Premium Animation Styles (matching TeacherManagement design language)
  const animationStyles = `
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

    @keyframes pulseGlow {
      0%, 100% {
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
      }
      50% {
        box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
      }
    }

    .animate-fadeInUp {
      animation: fadeInUp 0.6s ease-out;
    }

    .animate-slideInRight {
      animation: slideInRight 0.6s ease-out;
    }

    .animate-pulseGlow {
      animation: pulseGlow 2s infinite;
    }
  `;
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

  // Auto-collapse sidebar when any dialog opens
  useDialogSidebarCollapse(!!selectedStudent);
  useDialogSidebarCollapse(isFormOpen);
  useDialogSidebarCollapse(isExportDialogOpen);

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
  const getStudentsToExport = async () => {
    if (selectedStudents.size > 0) {
      return students.filter(student => selectedStudents.has(student.id));
    }

    // If no students are selected, fetch ALL filtered students (not just current page)
    const sortMapping: Record<string, string> = {
      'name': 'name',
      'id': 'student_id',
      'grade': 'grade_level',
      'date': 'created_at'
    };

    // Backend has a max limit of 5000 per request, so we need to fetch all pages
    let allStudents: any[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await apiClient.getStudents({
        branch_id: (selectedBranch && selectedBranch !== 'all') ? selectedBranch : undefined,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        grade_level: gradeFilter !== 'all' ? gradeFilter : undefined,
        class_id: classFilter !== 'all' ? classFilter : undefined,
        sort_by: sortMapping[sortBy] || 'created_at',
        sort_order: sortOrder,
        page: currentPage,
        limit: 5000 // Maximum allowed by backend
      });

      const items = response.data?.items || [];
      allStudents = [...allStudents, ...items];

      // Check if there are more pages
      const total = response.data?.total || 0;
      hasMore = allStudents.length < total;
      currentPage++;
    }

    return allStudents;
  };

  const exportToCSV = async () => {
    const studentsToExport = await getStudentsToExport();

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

  const exportToExcel = async () => {
    const studentsToExport = await getStudentsToExport();

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

  const exportToPDF = async () => {
    const studentsToExport = await getStudentsToExport();

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
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{animationStyles}</style>

    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Enhanced Floating Shapes with Animation */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
        <div className="absolute top-20 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-1/3 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500" />
        <div className="absolute top-1/2 left-20 w-8 h-8 bg-white/8 rounded-full animate-pulse delay-300" />
        <div className="absolute top-1/3 right-1/4 w-14 h-14 bg-white/8 rounded-full animate-pulse delay-700" />
        <div className="absolute bottom-1/3 right-10 w-10 h-10 bg-white/8 rounded-full animate-pulse delay-900" />
        <div className="absolute top-1/4 left-1/2 w-6 h-6 bg-white/6 rounded-full animate-pulse delay-400" />
        <div className="absolute bottom-10 left-1/4 w-18 h-18 bg-white/8 rounded-full animate-pulse delay-800" />

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
              <PermissionWrapper permission="student.read">
                <Button
                  variant="outline"
                  onClick={() => setIsExportDialogOpen(true)}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 hover:from-emerald-600 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export ({selectedStudents.size > 0 ? selectedStudents.size : totalStudents})
                </Button>
              </PermissionWrapper>
              <PermissionWrapper permission="student.read">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDuplicateCheckerOpen(true)}
                  className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-0 hover:from-amber-500 hover:to-yellow-600 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Check Duplicates
                </Button>
              </PermissionWrapper>
              <PermissionWrapper permission="student.import">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImportCard(!showImportCard)}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-0 hover:from-purple-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {showImportCard ? 'Hide Import' : 'Bulk Import'}
                </Button>
              </PermissionWrapper>

              <PermissionWrapper permission="student.create">
                <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
                  <SheetTrigger asChild>
                    <Button
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 px-6 py-2.5"
                      onClick={() => setEditingStudent(null)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Student
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-white/95 backdrop-blur-glass border-l border-white/20 shadow-2xl">
                    {/* Premium Header */}
                    <SheetHeader className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 -mx-6 -mt-6 mb-6">
                      {/* Background Pattern */}
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-cyan-600/90" />
                      <div className="absolute inset-0 opacity-20"
                           style={{
                             backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                           }} />

                      <div className="relative">
                        <SheetTitle className="flex items-center gap-3 text-2xl font-bold text-white mb-3">
                          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                            {editingStudent ? <Edit className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                          </div>
                          {editingStudent ? 'Edit Student Record' : 'Add New Student'}
                        </SheetTitle>
                        <p className="text-emerald-100 text-lg">
                          {editingStudent
                            ? 'Update student information and documents with comprehensive details'
                            : 'Create a comprehensive student profile with all required information and documents'
                          }
                        </p>
                      </div>
                    </SheetHeader>

                    {/* Premium Form Container */}
                    <div className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl p-6 mt-6">
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
        </div>

        {/* Bulk Import Card */}
        {showImportCard && (
          <div className="mx-auto max-w-7xl animate-fade-in-up">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
              <BulkStudentImport onImportComplete={handleImportComplete} />
            </div>
          </div>
        )}

        {/* Premium Stats Cards */}
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-blue-50/50 border border-white/20 shadow-premium hover:shadow-glow-blue transition-all duration-500 hover:scale-105 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="relative p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-600/80 uppercase tracking-wider">Total Students</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent mt-1">
                  {!studentStats && selectedBranch !== null ? (
                    <div className="h-8 w-20 bg-gray-200/50 rounded animate-pulse" />
                  ) : (
                    studentStats?.totalStudents || 0
                  )}
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                <Users className="relative h-10 w-10 text-blue-500 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-emerald-50/50 border border-white/20 shadow-premium hover:shadow-glow-blue transition-all duration-500 hover:scale-105 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardContent className="relative p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-600/80 uppercase tracking-wider">Active Students</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent mt-1">
                  {!studentStats && selectedBranch !== null ? (
                    <div className="h-8 w-20 bg-gray-200/50 rounded animate-pulse" />
                  ) : (
                    studentStats?.activeStudents || 0
                  )}
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                <GraduationCap className="relative h-10 w-10 text-emerald-500 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`group relative overflow-hidden backdrop-blur-glass border border-white/20 shadow-premium hover:shadow-glow-orange transition-all duration-500 hover:scale-105 hover:-translate-y-1 ${
          selectedStudents.size > 0
            ? 'bg-gradient-to-br from-white/80 via-white/60 to-amber-50/50'
            : 'bg-gradient-to-br from-white/80 via-white/60 to-slate-50/50'
        }`}>
          <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
            selectedStudents.size > 0
              ? 'bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/5'
              : 'bg-gradient-to-br from-slate-500/10 via-transparent to-slate-500/5'
          }`} />
          <CardContent className="relative p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className={`text-sm font-semibold uppercase tracking-wider ${
                  selectedStudents.size > 0 ? 'text-amber-600/80' : 'text-slate-600/80'
                }`}>Selected</p>
                <p className={`text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent mt-1 ${
                  selectedStudents.size > 0
                    ? 'from-amber-700 to-orange-600'
                    : 'from-slate-700 to-slate-600'
                }`}>{selectedStudents.size}</p>
              </div>
              <div className="relative">
                <div className={`absolute inset-0 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500 ${
                  selectedStudents.size > 0 ? 'bg-amber-500/20' : 'bg-slate-500/20'
                }`} />
                <CheckSquare className={`relative h-10 w-10 group-hover:scale-110 transition-transform duration-300 ${
                  selectedStudents.size > 0 ? 'text-amber-500' : 'text-slate-500'
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>

        {/* Premium Search and Filters */}
        <div className="mx-auto max-w-7xl">
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/90 via-white/70 to-white/50 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.02] via-indigo-500/[0.03] to-cyan-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardHeader className="relative pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-3 bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-lg group-hover:blur-xl transition-all duration-300" />
              <Filter className="relative h-6 w-6 text-blue-600" />
            </div>
            Advanced Search & Filters
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">Search by Student ID, Name, Mother's Name, Phone Numbers, Email, or Class Name</p>
        </CardHeader>
        <CardContent className="relative">
              {selectedStudents.size > 0 && (
                <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-200/50">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                      <CheckSquare className="h-4 w-4 mr-1.5" />
                      {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''} selected
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedStudents(new Set())}
                        className="bg-white hover:bg-gray-50 border-gray-200"
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
                          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-0 shadow-lg"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Selected ({selectedStudents.size})
                        </Button>
                      </PermissionWrapper>
                    </div>
                  </div>
                </div>
              )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                  <div className="relative group/search">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-lg opacity-0 group-hover/search:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-500/60 group-hover/search:text-blue-600 transition-colors duration-300" />
                    <Input
                      placeholder="Search by Student ID, Name, Mother's Name, Phone, Email, or Class..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="relative pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md"
                    />
                    {searchTerm && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <button
                          onClick={() => setSearchTerm('')}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <X className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-white/80 backdrop-blur-sm border-white/40 hover:border-indigo-300/50 focus:border-indigo-500/60 focus:ring-indigo-500/20 focus:ring-4 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent className="backdrop-blur-xl bg-white/95 border-white/40">
                    <SelectItem value="all" className="hover:bg-blue-50/80">All Statuses</SelectItem>
                    <SelectItem value="Active" className="hover:bg-emerald-50/80">Active</SelectItem>
                    <SelectItem value="Graduated" className="hover:bg-blue-50/80">Graduated</SelectItem>
                    <SelectItem value="Transferred Out" className="hover:bg-amber-50/80">Transferred Out</SelectItem>
                    <SelectItem value="Dropped Out" className="hover:bg-red-50/80">Dropped Out</SelectItem>
                    <SelectItem value="On Leave" className="hover:bg-gray-50/80">On Leave</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={gradeFilter} onValueChange={setGradeFilter}>
                  <SelectTrigger className="bg-white/80 backdrop-blur-sm border-white/40 hover:border-indigo-300/50 focus:border-indigo-500/60 focus:ring-indigo-500/20 focus:ring-4 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md">
                    <SelectValue placeholder="Filter by grade" />
                  </SelectTrigger>
                  <SelectContent className="backdrop-blur-xl bg-white/95 border-white/40">
                    <SelectItem value="all" className="hover:bg-blue-50/80">All Grades</SelectItem>
                    <SelectItem value="pre_k" className="hover:bg-blue-50/80">Pre-K</SelectItem>
                    <SelectItem value="kg" className="hover:bg-blue-50/80">KG</SelectItem>
                    <SelectItem value="prep" className="hover:bg-blue-50/80">PREP</SelectItem>
                    <SelectItem value="kindergarten" className="hover:bg-blue-50/80">Kindergarten</SelectItem>
                    {Array.from({length: 12}, (_, i) => (
                      <SelectItem key={i} value={`grade_${i + 1}`} className="hover:bg-blue-50/80">Grade {i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-4 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md">
                    <SelectValue placeholder="Filter by class" />
                  </SelectTrigger>
                  <SelectContent className="backdrop-blur-xl bg-white/95 border-white/40">
                    <SelectItem value="all" className="hover:bg-blue-50/80">All Classes</SelectItem>
                    {classes?.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="hover:bg-blue-50/80">
                        {cls.class_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                  <SelectTrigger className="bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-4 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="backdrop-blur-xl bg-white/95 border-white/40">
                    <SelectItem value="name" className="hover:bg-blue-50/80">Sort by Name</SelectItem>
                    <SelectItem value="id" className="hover:bg-blue-50/80">Sort by Student ID</SelectItem>
                    <SelectItem value="grade" className="hover:bg-blue-50/80">Sort by Grade</SelectItem>
                    <SelectItem value="date" className="hover:bg-blue-50/80">Sort by Registration Date</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as typeof sortOrder)}>
                  <SelectTrigger className="bg-white/80 backdrop-blur-sm border-white/40 hover:border-blue-300/50 focus:border-blue-500/60 focus:ring-blue-500/20 focus:ring-4 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md">
                    <SelectValue placeholder="Sort order" />
                  </SelectTrigger>
                  <SelectContent className="backdrop-blur-xl bg-white/95 border-white/40">
                    <SelectItem value="asc" className="hover:bg-blue-50/80">Ascending (A-Z, 1-9)</SelectItem>
                    <SelectItem value="desc" className="hover:bg-blue-50/80">Descending (Z-A, 9-1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Premium Students Table */}
        <div className="mx-auto max-w-7xl">
          <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-white/60 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-indigo-500/[0.02] to-cyan-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardHeader className="relative">
          <CardTitle className="text-2xl font-bold flex items-center gap-3">
            <span className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
              Students Directory
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200/50">
              {filteredStudents.length}
            </span>
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Showing {startIndex + 1}-{endIndex} of {totalStudents} students
          </p>
        </CardHeader>
        <CardContent className="relative">
              {!selectedBranch ? (
                <div className="text-center py-20">
                  <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-6">
                    <Users className="h-12 w-12 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Branch</h3>
                  <p className="text-gray-600 max-w-md mx-auto">Please select a branch from the dropdown above to view students. Choose "All Branches" to see students from all locations.</p>
                </div>
              ) : isLoading ? (
                <div className="space-y-4">
                  {/* Premium Loading Skeleton */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50/50 rounded-xl animate-pulse">
                      <div className="w-12 h-12 bg-gray-200 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/3" />
                      </div>
                      <div className="h-8 bg-gray-200 rounded w-20" />
                      <div className="h-8 bg-gray-200 rounded w-16" />
                    </div>
                  ))}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-20">
                  <div className="mx-auto w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
                    <Users className="h-12 w-12 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Students Found</h3>
                  {showBranchSwitchMessage ? (
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 mt-6 mx-auto max-w-md">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <p className="text-blue-900 font-medium mb-1">
                          Found {totalStudents} {gradeFilter?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} students in other branches
                        </p>
                        <p className="text-blue-700 text-sm">
                          Switch to a different branch to view these students
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-600 max-w-md mx-auto">Try adjusting your search terms or filters to find students. You can search by name, ID, email, or class.</p>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden">
                  <div className="overflow-x-auto rounded-xl border border-white/20">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-slate-50/80 via-white/60 to-slate-50/80 border-b border-white/30 hover:from-blue-50/50 hover:via-indigo-50/30 hover:to-cyan-50/50 transition-all duration-300">
                          <TableHead className="w-12 py-4 font-bold text-slate-700 tracking-wide">
                            <Checkbox
                              checked={selectAll}
                              onCheckedChange={handleSelectAll}
                              className="border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                          </TableHead>
                          <TableHead className="font-bold text-slate-700 tracking-wide py-4">Student</TableHead>
                          <TableHead className="font-bold text-slate-700 tracking-wide py-4">Student ID</TableHead>
                          <TableHead className="font-bold text-slate-700 tracking-wide py-4">Mother's Name</TableHead>
                          <TableHead className="font-bold text-slate-700 tracking-wide py-4">Grade</TableHead>
                          <TableHead className="font-bold text-slate-700 tracking-wide py-4">Class</TableHead>
                          <TableHead className="font-bold text-slate-700 tracking-wide py-4">Status</TableHead>
                          <TableHead className="font-bold text-slate-700 tracking-wide py-4">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedStudents.map((student, index) => (
                          <TableRow
                            key={student.id}
                            className="group border-b border-white/20 hover:bg-gradient-to-r hover:from-blue-50/30 hover:via-indigo-50/20 hover:to-cyan-50/30 transition-all duration-300 animate-fade-in-up"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <TableCell className="py-4">
                              <Checkbox
                                checked={selectedStudents.has(student.id)}
                                onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                                className="border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center space-x-4">
                                <div className="relative">
                                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                  <Avatar className="relative h-12 w-12 ring-2 ring-white/50 group-hover:ring-blue-300/50 transition-all duration-300">
                                    <AvatarImage
                                      src={student.photo_url}
                                      alt={`${student.first_name} ${student.last_name}`}
                                      className="object-cover"
                                    />
                                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 font-bold text-sm group-hover:scale-110 transition-transform duration-300">
                                      {getInitials(student.first_name, student.father_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors duration-300">
                                    {highlightSearchTerm(
                                      [student.first_name, student.father_name, student.grandfather_name]
                                        .filter(name => name && name.trim() && name !== 'None' && name !== 'null')
                                        .join(' ') || 'No name provided',
                                      searchTerm
                                    )}
                                  </div>
                                  <div className="text-sm text-slate-500 font-medium truncate">{student.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="inline-flex items-center px-2.5 py-1.5 bg-gradient-to-r from-slate-100 to-gray-100 text-slate-700 text-sm font-mono rounded-lg border border-slate-200 shadow-sm">
                                {highlightSearchTerm(student.student_id, searchTerm)}
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <span className="text-gray-700 font-medium">
                                {(student.mother_name && student.mother_name !== 'None' && student.mother_name !== 'null')
                                  ? highlightSearchTerm(student.mother_name, searchTerm)
                                  : <span className="text-gray-400 italic">Not provided</span>}
                              </span>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge variant="outline" className="bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300/50 text-blue-800 font-semibold shadow-sm">
                                {formatGradeLevel(student.grade_level)}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4">
                              <span className="text-gray-700 font-medium">
                                {classes?.find(c => c.id === student.class_id)?.class_name
                                  ? highlightSearchTerm(
                                      classes.find(c => c.id === student.class_id)!.class_name,
                                      searchTerm
                                    )
                                  : <span className="text-gray-400 italic">Not assigned</span>}
                              </span>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge
                                variant="outline"
                                className={`font-semibold shadow-sm ${
                                  student.status === 'Active'
                                    ? 'bg-gradient-to-r from-emerald-100 to-green-100 border-emerald-300/50 text-emerald-800'
                                    : student.status === 'Graduated'
                                    ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300/50 text-blue-800'
                                    : student.status === 'Transferred Out'
                                    ? 'bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-300/50 text-amber-800'
                                    : student.status === 'Dropped Out'
                                    ? 'bg-gradient-to-r from-red-100 to-pink-100 border-red-300/50 text-red-800'
                                    : 'bg-gradient-to-r from-gray-100 to-slate-100 border-gray-300/50 text-gray-800'
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full mr-2 animate-pulse ${
                                  student.status === 'Active' ? 'bg-emerald-500' :
                                  student.status === 'Graduated' ? 'bg-blue-500' :
                                  student.status === 'Transferred Out' ? 'bg-amber-500' :
                                  student.status === 'Dropped Out' ? 'bg-red-500' : 'bg-gray-500'
                                }`} />
                                {student.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedStudent(student)}
                                  className="group/btn relative overflow-hidden h-10 w-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200/50 hover:border-blue-300/60 shadow-sm hover:shadow-glow-blue transition-all duration-300 hover:scale-110"
                                >
                                  <Eye className="h-4 w-4 text-blue-600 group-hover/btn:scale-110 transition-transform duration-200" />
                                </Button>
                                <PermissionWrapper permission="update_student">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingStudent(student);
                                      setIsFormOpen(true);
                                    }}
                                    className="group/btn relative overflow-hidden h-10 w-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200/50 hover:border-blue-300/60 shadow-sm hover:shadow-glow-green transition-all duration-300 hover:scale-110"
                                  >
                                    <Edit className="h-4 w-4 text-blue-600 group-hover/btn:scale-110 transition-transform duration-200" />
                                  </Button>
                                </PermissionWrapper>
                                <PermissionWrapper permission="delete_student">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(student.id)}
                                    disabled={!canDelete}
                                    className={`group/btn relative overflow-hidden h-10 w-10 rounded-lg bg-gradient-to-br from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 border border-red-200/50 hover:border-red-300/60 shadow-sm hover:shadow-glow-orange transition-all duration-300 hover:scale-110 ${!canDelete ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600 group-hover/btn:scale-110 transition-transform duration-200" />
                                  </Button>
                                </PermissionWrapper>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Premium Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex justify-center">
                  <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-2">
                    <Pagination>
                      <PaginationContent className="gap-1">
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                            className={`transition-all duration-200 rounded-lg ${currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-blue-100 hover:text-blue-600'}`}
                          />
                        </PaginationItem>

                        {/* Show first page */}
                        {currentPage > 3 && (
                          <>
                            <PaginationItem>
                              <PaginationLink
                                onClick={() => handlePageChange(1)}
                                className="cursor-pointer hover:bg-blue-100 hover:text-blue-600 transition-all duration-200 rounded-lg"
                              >
                                1
                              </PaginationLink>
                            </PaginationItem>
                            {currentPage > 4 && (
                              <PaginationItem>
                                <PaginationEllipsis className="text-gray-400" />
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
                                  className={`transition-all duration-200 rounded-lg ${
                                    pageNumber === currentPage
                                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                                      : 'cursor-pointer hover:bg-blue-100 hover:text-blue-600'
                                  }`}
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
                                <PaginationEllipsis className="text-gray-400" />
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink
                                onClick={() => handlePageChange(totalPages)}
                                className="cursor-pointer hover:bg-blue-100 hover:text-blue-600 transition-all duration-200 rounded-lg"
                              >
                                {totalPages}
                              </PaginationLink>
                            </PaginationItem>
                          </>
                        )}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                            className={`transition-all duration-200 rounded-lg ${currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-blue-100 hover:text-blue-600'}`}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </div>
              )}
        </CardContent>
          </Card>
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
          <DialogContent className="max-w-lg bg-white/95 backdrop-blur-glass border border-white/20 shadow-2xl rounded-2xl overflow-hidden">
            {/* Premium Header */}
            <DialogHeader className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 -mx-6 -mt-6 mb-6">
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-cyan-600/90" />
              <div className="absolute inset-0 opacity-20"
                   style={{
                     backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                   }} />

              <div className="relative">
                <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-white mb-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-full">
                    <Download className="h-6 w-6" />
                  </div>
                  Export All Students?
                </DialogTitle>
                <DialogDescription className="space-y-3 text-lg leading-relaxed text-emerald-100">
                  <p>No students are currently selected.</p>
                  <p>This will export all <strong className="text-white font-bold">{totalStudents}</strong> student records from the current filtered list.</p>
                  <p>Choose your preferred export format or cancel to select specific students first.</p>
                </DialogDescription>
              </div>
            </DialogHeader>

            {/* Premium Content */}
            <div className="px-6 pb-6">
              <div className="space-y-4">
                {/* Export Format Info */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 rounded-xl p-4">
                  <p className="text-emerald-800 text-sm font-medium mb-2">Available Export Formats:</p>
                  <div className="space-y-2 text-sm text-emerald-700">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      <span><strong>Excel (.xlsx)</strong> - Full formatting with data validation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span><strong>CSV (.csv)</strong> - Simple comma-separated format</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-600" />
                      <span><strong>PDF (.pdf)</strong> - Print-ready formatted document</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      onClick={() => {
                        exportToExcel();
                        setIsExportDialogOpen(false);
                      }}
                      className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                    <Button
                      onClick={() => {
                        exportToCSV();
                        setIsExportDialogOpen(false);
                      }}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button
                      onClick={() => {
                        exportToPDF();
                        setIsExportDialogOpen(false);
                      }}
                      className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setIsExportDialogOpen(false)}
                    className="w-full border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 text-gray-700 hover:text-gray-900 rounded-xl py-3"
                  >
                    Cancel Export
                  </Button>
                </div>
              </div>
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
    </>
  );
};