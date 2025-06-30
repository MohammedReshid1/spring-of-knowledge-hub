
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
import { StudentIDCard } from './StudentIDCard';
import { CreditCard, Printer, Download, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export const IDCardPrinting = () => {
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [schoolName, setSchoolName] = useState('Mountain View School');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [showPreview, setShowPreview] = useState(false);

  const { data: students, isLoading } = useQuery({
    queryKey: ['students-for-id-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('status', 'Active')
        .order('grade_level')
        .order('first_name');
      
      if (error) throw error;
      return data;
    }
  });

  const filteredStudents = students?.filter(student => {
    const matchesSearch = `${student.first_name} ${student.last_name} ${student.student_id}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesGrade = selectedGrade === 'all' || student.grade_level === selectedGrade;
    return matchesSearch && matchesGrade;
  }) || [];

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
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
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

    // Create a new window for printing
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
          .id-card {
            width: 320px;
            height: 200px;
            border: 2px solid #3b82f6;
            border-radius: 8px;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            padding: 16px;
            margin: 10px;
            display: inline-block;
            vertical-align: top;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            page-break-inside: avoid;
          }
          .card-content {
            display: flex;
            height: 100%;
          }
          .photo-section {
            width: 80px;
            margin-right: 16px;
          }
          .photo {
            width: 80px;
            height: 96px;
            background: #e5e7eb;
            border: 2px solid #9ca3af;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #6b7280;
          }
          .info-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header {
            text-align: center;
            margin-bottom: 8px;
          }
          .school-name {
            font-size: 14px;
            font-weight: bold;
            color: #1e40af;
            margin: 0;
            line-height: 1.2;
          }
          .card-type {
            font-size: 10px;
            color: #2563eb;
            margin: 0;
          }
          .student-info {
            flex: 1;
          }
          .student-name {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            margin: 0 0 4px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 2px 0;
            font-size: 10px;
          }
          .label {
            color: #4b5563;
          }
          .value {
            font-weight: 500;
          }
          .grade-badge {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            padding: 1px 4px;
            border-radius: 4px;
            font-size: 9px;
          }
          .footer {
            text-align: center;
            padding-top: 8px;
            border-top: 1px solid #3b82f6;
            font-size: 10px;
            color: #2563eb;
          }
          @media print {
            body { margin: 0; padding: 10px; }
            .id-card { margin: 5px; }
          }
        </style>
      </head>
      <body>
        ${selectedStudentData.map(student => `
          <div class="id-card">
            <div class="card-content">
              <div class="photo-section">
                <div class="photo">
                  ${student.photo_url ? 
                    `<img src="${student.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="${student.first_name} ${student.last_name}">` : 
                    'No Photo'
                  }
                </div>
              </div>
              <div class="info-section">
                <div class="header">
                  <h3 class="school-name">${schoolName}</h3>
                  <p class="card-type">Student ID Card</p>
                </div>
                <div class="student-info">
                  <p class="student-name">${student.first_name} ${student.last_name}</p>
                  <div class="info-row">
                    <span class="label">ID:</span>
                    <span class="value">${student.student_id}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Grade:</span>
                    <span class="grade-badge">${student.grade_level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  </div>
                  ${student.current_class ? `
                    <div class="info-row">
                      <span class="label">Class:</span>
                      <span class="value">${student.current_class}</span>
                    </div>
                  ` : ''}
                  ${student.current_section ? `
                    <div class="info-row">
                      <span class="label">Section:</span>
                      <span class="value">${student.current_section}</span>
                    </div>
                  ` : ''}
                </div>
                <div class="footer">
                  Academic Year ${academicYear}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 500);

    toast({
      title: "Printing initiated",
      description: `Preparing to print ${selectedStudents.size} ID cards.`
    });
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const gradeOptions = [...new Set(students?.map(s => s.grade_level) || [])];

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
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Enter school name"
              />
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

      {/* Student Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Students</CardTitle>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="w-[200px]">
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={filteredStudents.length > 0 && selectedStudents.size === filteredStudents.length}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all">
                  Select All ({filteredStudents.length} students)
                </Label>
              </div>
              <Badge variant="outline">
                {selectedStudents.size} selected
              </Badge>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredStudents.map((student) => (
                <div key={student.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                  <Checkbox
                    id={student.id}
                    checked={selectedStudents.has(student.id)}
                    onCheckedChange={() => handleStudentToggle(student.id)}
                  />
                  <Label htmlFor={student.id} className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span>{student.first_name} {student.last_name}</span>
                      <div className="text-sm text-gray-500">
                        {student.student_id} | {formatGradeLevel(student.grade_level)}
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </div>
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
              {selectedStudentData.slice(0, 6).map((student) => (
                <StudentIDCard
                  key={student.id}
                  student={student}
                  schoolName={schoolName}
                  academicYear={academicYear}
                />
              ))}
            </div>
            {selectedStudentData.length > 6 && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                ... and {selectedStudentData.length - 6} more cards
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
