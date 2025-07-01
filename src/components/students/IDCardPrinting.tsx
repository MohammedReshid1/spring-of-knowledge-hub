
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
import { CreditCard, Printer, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getHighlightedText } from '@/utils/searchHighlight';

export const IDCardPrinting = () => {
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
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
          }
          .photo-overlay {
            position: absolute;
            top: 52px;
            right: 16px;
            width: 96px;
            height: 96px;
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
            top: 108px;
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
          }
        </style>
      </head>
      <body>
        ${selectedStudentData.map(student => `
          <div class="id-card-container">
            <!-- Front Card -->
            <div class="id-card">
              <img src="/Green Blue Modern Student ID Card.svg" alt="ID Card Front" class="svg-background">
              <div class="photo-overlay">
                ${student.photo_url ? 
                  `<img src="${student.photo_url}" alt="${student.first_name} ${student.last_name}">` : 
                  '<div style="width:100%;height:100%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:8px;color:#6b7280;">Photo</div>'
                }
              </div>
              <div class="info-overlay">
                <div class="info-field">${student.student_id}</div>
                <div class="info-field">${student.first_name} ${student.last_name} ${student.father_name || ''}</div>
                <div class="info-field">${student.grade_level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                <div class="info-field">${student.emergency_contact_phone || 'N/A'}</div>
              </div>
            </div>
            
            <!-- Back Card -->
            <div class="id-card">
              <img src="/2.svg" alt="ID Card Back" class="svg-background">
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
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
                      <span>{getHighlightedText(`${student.first_name} ${student.last_name}`, searchTerm)}</span>
                      <div className="text-sm text-gray-500">
                        {getHighlightedText(student.student_id, searchTerm)} | {formatGradeLevel(student.grade_level)}
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
    </div>
  );
};
