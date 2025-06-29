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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, Eye, Edit, Trash2, Users, GraduationCap, CreditCard, Filter, Download, Upload, FileText, FileSpreadsheet, CheckSquare, ChevronDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { StudentForm } from './StudentForm';
import { StudentDetails } from './StudentDetails';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const StudentList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const queryClient = useQueryClient();

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
    queryKey: ['students'],
    queryFn: async () => {
      console.log('Fetching students...');
      const { data, error } = await supabase
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
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching students:', error);
        throw error;
      }
      console.log('Students fetched successfully:', data?.length);
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
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);
      
      if (error) throw error;
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
      'Father Name': student.father_name || '',
      'Grandfather Name': student.grandfather_name || '',
      'Grade Level': student.grade_level,
      'Class': student.classes?.class_name || '',
      'Email': student.email || '',
      'Phone': student.phone || '',
      'Status': student.status,
      'Date of Birth': student.date_of_birth,
      'Gender': student.gender || '',
      'Address': student.address || '',
      'Emergency Contact Name': student.emergency_contact_name || '',
      'Emergency Contact Phone': student.emergency_contact_phone || '',
      'Created At': new Date(student.created_at).toLocaleDateString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    XLSX.writeFile(workbook, `students_export_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: "Success",
      description: `${studentsToExport.length} students exported to Excel successfully`,
    });
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

    // Add table
    doc.autoTable({
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

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        console.log('Imported Excel data:', jsonData);
        toast({
          title: "Import Started",
          description: `Processing ${jsonData.length} records from Excel file`,
        });
      } catch (error) {
        toast({
          title: "Import Error",
          description: "Failed to process Excel file",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset the input
    event.target.value = '';
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
        
        const jsonData = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',').map(v => v.replace(/"/g, ''));
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        });
        
        console.log('Imported CSV data:', jsonData);
        toast({
          title: "Import Started",
          description: `Processing ${jsonData.length} records from CSV file`,
        });
      } catch (error) {
        toast({
          title: "Import Error",
          description: "Failed to process CSV file",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    // Reset the input
    event.target.value = '';
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

  const filteredStudents = students?.filter(student => {
    if (!searchTerm && statusFilter === 'all' && gradeFilter === 'all') {
      return true;
    }

    const searchLower = searchTerm.toLowerCase();
    
    // Enhanced search: ID, First Name, Mother's Name
    const matchesSearch = !searchTerm || 
      student.student_id.toLowerCase().includes(searchLower) ||
      student.first_name.toLowerCase().includes(searchLower) ||
      (student.mother_name && student.mother_name.toLowerCase().includes(searchLower));
    
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
    const matchesGrade = gradeFilter === 'all' || student.grade_level === gradeFilter;
    
    return matchesSearch && matchesStatus && matchesGrade;
  }) || [];

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
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
    setSelectAll(newSelected.size === filteredStudents.length);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'Active': 'bg-green-100 text-green-800 border-green-200',
      'Graduated': 'bg-blue-100 text-blue-800 border-blue-200',
      'Transferred Out': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Dropped Out': 'bg-red-100 text-red-800 border-red-200',
      'On Leave': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
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

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const handleDelete = (studentId: string) => {
    if (confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      deleteStudentMutation.mutate(studentId);
    }
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
          {/* Import/Export Dropdown */}
          <div className="flex items-center space-x-2">
            {/* Import Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportExcel}
                      className="hidden"
                    />
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Import Excel
                  </label>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportCSV}
                      className="hidden"
                    />
                    <FileText className="h-4 w-4 mr-2" />
                    Import CSV
                  </label>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
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

      {/* Enhanced Search and Filters */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Real-time Search & Filter Students
          </CardTitle>
          <p className="text-sm text-gray-600">Search by Student ID, First Name, or Mother's Name</p>
          {selectedStudents.size > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''} selected
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedStudents(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by Student ID, First Name, or Mother's Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
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
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                <SelectItem value="pre_k">Pre-K</SelectItem>
                <SelectItem value="kindergarten">Kindergarten</SelectItem>
                {Array.from({length: 12}, (_, i) => (
                  <SelectItem key={i} value={`grade_${i + 1}`}>Grade {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            Students ({filteredStudents.length})
          </CardTitle>
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
                  {filteredStudents.map((student) => (
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
                          {student.classes?.class_name || 'Not assigned'}
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
                            className="hover:bg-red-50 hover:text-red-600"
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
          )}
        </CardContent>
      </Card>

      {selectedStudent && (
        <StudentDetails
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};