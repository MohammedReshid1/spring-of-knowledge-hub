import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { StudentIDCard } from './StudentIDCard';
import { StudentDetails } from './StudentDetails';
import { CreditCard, Printer, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getHighlightedText } from '@/utils/searchHighlight';

export const IDCardPrinting = () => {
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [showPreview, setShowPreview] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 15;

  const { data: students, isLoading } = useQuery({
    queryKey: ['students-for-id-cards'],
    queryFn: async () => {
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
          )
        `)
        .order('grade_level')
        .order('first_name');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: classes } = useQuery({
    queryKey: ['classes-for-id-printing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('class_name');
      
      if (error) throw error;
      return data;
    }
  });

  const filteredStudents = students?.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    
    const matchesSearch = !searchTerm || 
      student.student_id.toLowerCase().includes(searchLower) ||
      student.first_name.toLowerCase().includes(searchLower) ||
      student.last_name.toLowerCase().includes(searchLower) ||
      (student.mother_name && student.mother_name.toLowerCase().includes(searchLower)) ||
      (student.father_name && student.father_name.toLowerCase().includes(searchLower)) ||
      (student.phone && student.phone.toLowerCase().includes(searchLower)) ||
      (student.email && student.email.toLowerCase().includes(searchLower)) ||
      (student.classes?.class_name && student.classes.class_name.toLowerCase().includes(searchLower));
    
    const matchesGrade = selectedGrade === 'all' || student.grade_level === selectedGrade;
    const matchesClass = selectedClass === 'all' || student.class_id === selectedClass;
    const matchesStatus = student.status === statusFilter;
    
    return matchesSearch && matchesGrade && matchesClass && matchesStatus;
  }) || [];

  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const startIndex = (currentPage - 1) * studentsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + studentsPerPage);

  const selectedStudentData = students?.filter(student => 
    selectedStudents.has(student.id)
  ) || [];

  const handleStudentToggle = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSelectAll = () => {
    const currentPageStudentIds = paginatedStudents.map(s => s.id);
    const newSelected = new Set(selectedStudents);
    
    const allCurrentPageSelected = currentPageStudentIds.every(id => newSelected.has(id));
    
    if (allCurrentPageSelected) {
      // Deselect all on current page
      currentPageStudentIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all on current page
      currentPageStudentIds.forEach(id => newSelected.add(id));
    }
    
    setSelectedStudents(newSelected);
  };

  const formatFullName = (student: any) => {
    const parts = [];
    
    // Add first name and last name
    if (student.first_name) {
      parts.push(student.first_name.trim());
    }
    if (student.last_name) {
      parts.push(student.last_name.trim());
    }
    
    // Add father's name if it exists and is not empty
    if (student.father_name && student.father_name.trim()) {
      parts.push(student.father_name.trim());
    }
    
    // Add grandfather's name only if it exists, is not empty, AND is different from father's name
    if (student.grandfather_name && 
        student.grandfather_name.trim() && 
        student.grandfather_name.trim() !== student.father_name?.trim()) {
      parts.push(student.grandfather_name.trim());
    }
    
    return parts.join(' ');
  };

  const handlePrint = () => {
    if (selectedStudents.size === 0) {
      toast({
        title: "No students selected",
        description: "Please select at least one student to print ID cards.",
        variant: "destructive"
      });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Student ID Cards</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px;
            background: white;
          }
          .id-card-container {
            width: 320px;
            margin: 10px;
            display: inline-block;
            vertical-align: top;
            page-break-inside: avoid;
          }
          .id-card {
            width: 320px;
            height: 200px;
            border-radius: 8px;
            position: relative;
            overflow: hidden;
            margin-bottom: 10px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .svg-background {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .photo-overlay {
            position: absolute;
            top: 60px;
            right: 24px;
            width: 104px;
            height: 104px;
            border-radius: 50%;
            background: white;
            overflow: hidden;
            z-index: 20;
            border: 2px solid white;
          }
          .photo-overlay img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .info-overlay {
            position: absolute;
            top: 116px;
            left: 112px;
            z-index: 20;
            color: white;
            max-width: 112px;
          }
          .info-field {
            font-size: 6.5px;
            margin: 4px 0;
            font-weight: 600;
            color: white;
            line-height: 1.1;
          }
          @media print {
            body { margin: 0; padding: 10px; }
            .id-card-container { margin: 5px; }
            @page { margin: 0.5in; }
            .photo-overlay {
              top: 53px !important;
              right: 26px !important;
            }
            .info-overlay {
              top: 116px !important;
              left: 112px !important;
            }
            .info-field {
              color: white !important;
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>
        ${selectedStudentData.map(student => `
          <div class="id-card-container">
            <!-- Front Card -->
            <div class="id-card">
              <img src="${window.location.origin}/Green%20Blue%20Modern%20Student%20ID%20Card.svg" alt="ID Card Front" class="svg-background">
              <div class="photo-overlay">
                ${student.photo_url ? 
                  `<img src="${student.photo_url}" alt="${student.first_name} ${student.last_name}">` : 
                  '<div style="width:100%;height:100%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:8px;color:#6b7280;">Photo</div>'
                }
              </div>
              <div class="info-overlay">
                <div class="info-field">${student.student_id}</div>
                <div class="info-field">${formatFullName(student)}</div>
                <div class="info-field">${student.grade_level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                <div class="info-field">${student.emergency_contact_phone || 'N/A'}</div>
              </div>
            </div>
            
            <!-- Back Card -->
            <div class="id-card">
              <img src="${window.location.origin}/2.svg" alt="ID Card Back" class="svg-background">
            </div>
          </div>
        `).join('')}
        
        <script>
          setTimeout(() => {
            window.print();
            window.onafterprint = () => {
              window.close();
            };
          }, 1000);
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    toast({
      title: "Printing initiated",
      description: `Preparing to print ${selectedStudents.size} ID cards.`
    });
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const gradeOptions = [...new Set(students?.map(s => s.grade_level) || [])];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedStudents(new Set()); // Clear selections when changing pages
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            ID Card Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="school-name">School Name</Label>
              <Input
                id="school-name"
                value="Spring of Knowledge Academy"
                disabled
                className="bg-gray-50 text-gray-700 cursor-not-allowed"
                readOnly
              />
              <p className="text-xs text-gray-500 mt-1">School name cannot be changed</p>
            </div>
            <div>
              <Label htmlFor="academic-year">Academic Year</Label>
              <Input
                id="academic-year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="Enter academic year"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by Student ID, Name, Phone, Email, or Class..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {gradeOptions.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {formatGradeLevel(grade)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
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
          </div>
        </CardContent>
      </Card>

      {/* Students Table with Pagination */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">
              Students ({filteredStudents.length} total, showing {paginatedStudents.length})
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={paginatedStudents.length > 0 && paginatedStudents.every(student => selectedStudents.has(student.id))}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all">
                Select All (This Page)
              </Label>
              <Badge variant="outline">
                {selectedStudents.size} selected
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedStudents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 font-medium">No students found</p>
              <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead className="font-semibold">Student</TableHead>
                      <TableHead className="font-semibold">Student ID</TableHead>
                      <TableHead className="font-semibold">Grade</TableHead>
                      <TableHead className="font-semibold">Class</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.map((student) => (
                      <TableRow key={student.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell>
                          <Checkbox
                            checked={selectedStudents.has(student.id)}
                            onCheckedChange={() => handleStudentToggle(student.id)}
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
                                {getHighlightedText(`${student.first_name} ${student.last_name}`, searchTerm)}
                              </div>
                              {student.mother_name && (
                                <div className="text-sm text-gray-500">
                                  Mother: {getHighlightedText(student.mother_name, searchTerm)}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {getHighlightedText(student.student_id, searchTerm)}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {formatGradeLevel(student.grade_level)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-600">
                            {student.classes?.class_name ? getHighlightedText(student.classes.class_name, searchTerm) : 'Not assigned'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedStudent(student)}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-700">
                      Showing {startIndex + 1} to {Math.min(startIndex + studentsPerPage, filteredStudents.length)} of {filteredStudents.length} students
                    </p>
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="gap-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                      </PaginationItem>
                      
                      {/* First page */}
                      {currentPage > 3 && (
                        <>
                          <PaginationItem>
                            <PaginationLink
                              onClick={() => handlePageChange(1)}
                              isActive={false}
                            >
                              1
                            </PaginationLink>
                          </PaginationItem>
                          {currentPage > 4 && (
                            <PaginationItem>
                              <span className="px-3 py-2">...</span>
                            </PaginationItem>
                          )}
                        </>
                      )}
                      
                      {/* Current page and neighbors */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          return page === currentPage || 
                                 page === currentPage - 1 || 
                                 page === currentPage + 1 ||
                                 (currentPage <= 2 && page <= 3) ||
                                 (currentPage >= totalPages - 1 && page >= totalPages - 2);
                        })
                        .map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => handlePageChange(page)}
                              isActive={currentPage === page}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                      
                      {/* Last page */}
                      {currentPage < totalPages - 2 && (
                        <>
                          {currentPage < totalPages - 3 && (
                            <PaginationItem>
                              <span className="px-3 py-2">...</span>
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              onClick={() => handlePageChange(totalPages)}
                              isActive={false}
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}
                      
                      <PaginationItem>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="gap-1"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          onClick={() => setShowPreview(!showPreview)}
          variant="outline"
          disabled={selectedStudents.size === 0}
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </Button>
        <Button
          onClick={handlePrint}
          disabled={selectedStudents.size === 0}
          className="flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Print ID Cards ({selectedStudents.size})
        </Button>
      </div>

      {/* Preview Section */}
      {showPreview && selectedStudentData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedStudentData.slice(0, 3).map((student) => (
                <StudentIDCard
                  key={student.id}
                  student={student}
                  academicYear={academicYear}
                />
              ))}
            </div>
            {selectedStudentData.length > 3 && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                ... and {selectedStudentData.length - 3} more cards
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Student Details Modal */}
      {selectedStudent && (
        <StudentDetails
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};
