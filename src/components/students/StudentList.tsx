
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Search, 
  Filter, 
  UserPlus, 
  Eye, 
  Edit, 
  Trash2, 
  Download,
  Upload,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  AlertTriangle,
  GraduationCap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { DuplicateDetection } from './DuplicateDetection';
import { useNavigate } from 'react-router-dom';

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  grade_level: string;
  status: string;
  current_class?: string;
  phone?: string;
  email?: string;
  date_of_birth: string;
  created_at: string;
  photo_url?: string;
  father_name?: string;
  mother_name?: string;
  address?: string;
  class_id?: string;
  classes?: {
    class_name: string;
  };
}

export const StudentList = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'student_id' | 'grade' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const studentsPerPage = 30;
  const queryClient = useQueryClient();

  const { data: students, isLoading, error, refetch } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          classes:class_id (
            class_name
          )
        `)
        .order('first_name', { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, class_name');
      if (error) throw error;
      return data;
    },
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
      toast({
        title: "Success",
        description: "Student record deleted successfully.",
      });
      refetch();
      setShowDeleteDialog(false);
      setStudentToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete student record.",
        variant: "destructive",
      });
    }
  });

  const gradeLevels = useMemo(() => {
    const uniqueGradeLevels = new Set<string>();
    students?.forEach(student => uniqueGradeLevels.add(student.grade_level));
    return Array.from(uniqueGradeLevels);
  }, [students]);

  const classNames = useMemo(() => {
    const uniqueClassNames = new Set<string>();
    classes?.forEach(cls => uniqueClassNames.add(cls.class_name));
    return Array.from(uniqueClassNames);
  }, [classes]);

  const filteredStudents = useMemo(() => {
    let filtered = students || [];

    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (gradeFilter !== 'all') {
      filtered = filtered.filter(student => student.grade_level === gradeFilter);
    }

    if (classFilter !== 'all') {
      filtered = filtered.filter(student => student.classes?.class_name === classFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(student => student.status === statusFilter);
    }

    return filtered;
  }, [students, searchTerm, gradeFilter, classFilter, statusFilter]);

  const sortedStudents = useMemo(() => {
    if (!filteredStudents) return [];

    const sorted = [...filteredStudents];

    if (sortBy === 'name') {
      sorted.sort((a, b) => {
        const nameA = a.first_name.toLowerCase();
        const nameB = b.first_name.toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    } else if (sortBy === 'student_id') {
      sorted.sort((a, b) => {
        const idA = a.student_id.toLowerCase();
        const idB = b.student_id.toLowerCase();
        return sortOrder === 'asc' ? idA.localeCompare(idB) : idB.localeCompare(idA);
      });
    } else if (sortBy === 'grade') {
      sorted.sort((a, b) => {
        const gradeA = a.grade_level.toLowerCase();
        const gradeB = b.grade_level.toLowerCase();
        return sortOrder === 'asc' ? gradeA.localeCompare(gradeB) : gradeB.localeCompare(gradeA);
      });
    } else if (sortBy === 'date') {
      sorted.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }

    return sorted;
  }, [filteredStudents, sortBy, sortOrder]);

  const paginatedStudents = useMemo(() => {
    if (!sortedStudents) return [];
    const startIndex = (currentPage - 1) * studentsPerPage;
    const endIndex = startIndex + studentsPerPage;
    return sortedStudents.slice(startIndex, endIndex);
  }, [sortedStudents, currentPage, studentsPerPage]);

  const totalPages = useMemo(() => {
    if (!sortedStudents) return 0;
    return Math.ceil(sortedStudents.length / studentsPerPage);
  }, [sortedStudents, studentsPerPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const toggleSelectStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const isAllSelected = useMemo(() => {
    return paginatedStudents.every(student => selectedStudents.includes(student.id));
  }, [paginatedStudents, selectedStudents]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedStudents(prev => prev.filter(id => !paginatedStudents.map(s => s.id).includes(id)));
    } else {
      setSelectedStudents(prev => [...prev, ...paginatedStudents.map(s => s.id)].filter((value, index, array) => array.indexOf(value) === index));
    }
  };

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

  const exportToExcel = (studentsToExport?: Student[]) => {
    const dataToExport = studentsToExport || students || [];
    
    if (dataToExport.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no students to export.",
        variant: "destructive",
      });
      return;
    }

    const exportData = dataToExport.map(student => ({
      'Student ID': student.student_id,
      'First Name': student.first_name,
      'Last Name': student.last_name,
      'Father Name': student.father_name || '',
      'Mother Name': student.mother_name || '',
      'Grade Level': formatGradeLevel(student.grade_level),
      'Status': student.status,
      'Class': student.classes?.class_name || '',
      'Phone': student.phone || '',
      'Email': student.email || '',
      'Date of Birth': student.date_of_birth ? format(new Date(student.date_of_birth), 'yyyy-MM-dd') : '',
      'Address': student.address || '',
      'Registration Date': format(new Date(student.created_at), 'yyyy-MM-dd')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Student ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 15 }, // Father Name
      { wch: 15 }, // Mother Name
      { wch: 12 }, // Grade Level
      { wch: 10 }, // Status
      { wch: 15 }, // Class
      { wch: 15 }, // Phone
      { wch: 20 }, // Email
      { wch: 12 }, // Date of Birth
      { wch: 30 }, // Address
      { wch: 15 }  // Registration Date
    ];
    worksheet['!cols'] = colWidths;

    const fileName = selectedStudents.length > 0 
      ? `selected_students_${new Date().toISOString().split('T')[0]}.xlsx`
      : `all_students_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
    
    toast({
      title: "Success",
      description: `Exported ${dataToExport.length} student records successfully`,
    });
  };

  const handleExportSelected = () => {
    if (selectedStudents.length === 0) {
      toast({
        title: "No students selected",
        description: "Please select students to export.",
        variant: "destructive",
      });
      return;
    }

    const selectedStudentData = students?.filter(student => 
      selectedStudents.includes(student.id)
    ) || [];
    
    exportToExcel(selectedStudentData);
  };

  const handleViewStudent = (student: any) => {
    navigate(`/students/${student.id}`);
  };

  const handleEditStudent = (student: any) => {
    navigate(`/students/${student.id}/edit`);
  };

  const handleDeleteStudent = (student: Student) => {
    setStudentToDelete(student);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (studentToDelete) {
      deleteStudentMutation.mutate(studentToDelete.id);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Logo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img 
            src="/SPRING_LOGO-removebg-preview.png" 
            alt="School Logo" 
            className="h-16 w-16 object-contain"
          />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Students</h2>
            <p className="text-gray-600">
              Manage student records and information
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <DuplicateDetection />
          <Button variant="outline" onClick={() => exportToExcel()}>
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
          {selectedStudents.length > 0 && (
            <Button variant="outline" onClick={handleExportSelected}>
              <Download className="h-4 w-4 mr-2" />
              Export Selected ({selectedStudents.length})
            </Button>
          )}
          <Link to="/students/import">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </Link>
          <Link to="/students/new">
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Student
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-600">Total Students</p>
                <p className="text-2xl font-bold text-blue-900">{students?.length || 0}</p>
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
                <p className="text-2xl font-bold text-green-900">
                  {students?.filter(s => s.status === 'Active').length || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-600">Grade Levels</p>
                <p className="text-2xl font-bold text-purple-900">{gradeLevels?.length || 0}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-600">Classes</p>
                <p className="text-2xl font-bold text-orange-900">{classNames?.length || 0}</p>
              </div>
              <Users className="h-8 w-8 text-orange-500" />
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
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {gradeLevels.map(grade => (
                    <SelectItem key={grade} value={grade}>{formatGradeLevel(grade)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classNames.map(className => (
                    <SelectItem key={className} value={className}>{className}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                  <SelectItem value="Graduated">Graduated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student List ({sortedStudents.length} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading students...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-600 font-medium">Error loading students</p>
              <p className="text-red-500 text-sm">{error.message}</p>
            </div>
          ) : paginatedStudents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No students found</p>
              <p className="text-gray-500 text-sm">Add a new student or adjust the filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSortBy('name');
                        setSortOrder(sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc');
                      }}>
                        Name
                        {sortBy === 'name' && (sortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />)}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSortBy('student_id');
                        setSortOrder(sortBy === 'student_id' && sortOrder === 'asc' ? 'desc' : 'asc');
                      }}>
                        Student ID
                        {sortBy === 'student_id' && (sortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />)}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSortBy('grade');
                        setSortOrder(sortBy === 'grade' && sortOrder === 'asc' ? 'desc' : 'asc');
                      }}>
                        Grade
                        {sortBy === 'grade' && (sortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />)}
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Registration Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="w-[50px]">
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={() => toggleSelectStudent(student.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Avatar>
                            {student.photo_url ? (
                              <AvatarImage src={student.photo_url} alt={student.first_name} />
                            ) : (
                              <AvatarFallback>{student.first_name[0]}{student.last_name[0]}</AvatarFallback>
                            )}
                          </Avatar>
                          <span className="font-medium">{student.first_name} {student.last_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{student.student_id}</TableCell>
                      <TableCell>{formatGradeLevel(student.grade_level)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{student.status}</Badge>
                      </TableCell>
                      <TableCell>{student.classes?.class_name || 'Not Assigned'}</TableCell>
                      <TableCell>{format(new Date(student.created_at), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewStudent(student)}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStudent(student)}
                            className="hover:bg-gray-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStudent(student)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <span>{currentPage} of {totalPages}</span>
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the student record for {studentToDelete?.first_name} {studentToDelete?.last_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
