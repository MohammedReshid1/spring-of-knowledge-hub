import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Search, Plus, Download, FileText, Calendar, User, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

interface StudentReport {
  id: string;
  report_code: string;
  student_id: string;
  student_name: string;
  class_id: string;
  overall_grade: string;
  overall_percentage: number;
  attendance_percentage: number;
  behavior_balance: number;
  report_period: string;
  academic_year: string;
  generated_at: string;
  format: string;
  file_path?: string;
}

export const StudentReports: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    student_id: '',
    academic_year: new Date().getFullYear().toString(),
    term: 'Term 1'
  });

  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery<StudentReport[]>({
    queryKey: ['student-reports', selectedClass, selectedYear],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedClass && selectedClass !== 'all') params.append('class_id', selectedClass);
      if (selectedYear && selectedYear !== 'all') params.append('academic_year', selectedYear);
      
      const response = await apiClient.get(`/reports/student-reports?${params}`);
      return response.data;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-list'],
    queryFn: async () => {
      const response = await apiClient.get('/students/all');
      return response.data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-list'],
    queryFn: async () => {
      const response = await apiClient.get('/classes');
      return response.data;
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: { student_id: string; academic_year: string; term: string }) => {
      const response = await apiClient.get(
        `/reports/student-reports/generate/${data.student_id}?academic_year=${data.academic_year}&term=${data.term}`
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success('Student report generated successfully');
      queryClient.invalidateQueries({ queryKey: ['student-reports'] });
      setIsGenerateDialogOpen(false);
      setGenerateForm({
        student_id: '',
        academic_year: new Date().getFullYear().toString(),
        term: 'Term 1'
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to generate report');
    },
  });

  const filteredReports = reports.filter(report =>
    report.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.report_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGradeColor = (grade: string) => {
    const gradeColors = {
      'A+': 'bg-green-100 text-green-800',
      'A': 'bg-green-100 text-green-800',
      'B+': 'bg-blue-100 text-blue-800',
      'B': 'bg-blue-100 text-blue-800',
      'C+': 'bg-yellow-100 text-yellow-800',
      'C': 'bg-yellow-100 text-yellow-800',
      'D': 'bg-orange-100 text-orange-800',
      'F': 'bg-red-100 text-red-800'
    };
    return gradeColors[grade as keyof typeof gradeColors] || 'bg-gray-100 text-gray-800';
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 95) return 'text-green-600';
    if (percentage >= 90) return 'text-blue-600';
    if (percentage >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading student reports...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Student Reports</h2>
          <p className="text-muted-foreground">Generate and manage individual student report cards</p>
        </div>
        
        <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Student Report Card</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="student_id">Student</Label>
                <Select
                  value={generateForm.student_id}
                  onValueChange={(value) => setGenerateForm({ ...generateForm, student_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student: any) => (
                      <SelectItem key={student.student_id} value={student.student_id}>
                        {student.full_name} ({student.student_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="academic_year">Academic Year</Label>
                <Input
                  id="academic_year"
                  value={generateForm.academic_year}
                  onChange={(e) => setGenerateForm({ ...generateForm, academic_year: e.target.value })}
                  placeholder="2024"
                />
              </div>

              <div>
                <Label htmlFor="term">Term</Label>
                <Select
                  value={generateForm.term}
                  onValueChange={(value) => setGenerateForm({ ...generateForm, term: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Term 1">Term 1</SelectItem>
                    <SelectItem value="Term 2">Term 2</SelectItem>
                    <SelectItem value="Term 3">Term 3</SelectItem>
                    <SelectItem value="Annual">Annual Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={() => generateReportMutation.mutate(generateForm)}
                disabled={!generateForm.student_id || generateReportMutation.isPending}
                className="w-full"
              >
                {generateReportMutation.isPending ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student name, ID, or report code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((cls: any) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2023">2023</SelectItem>
            <SelectItem value="2022">2022</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reports Grid */}
      {filteredReports.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      {report.student_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      ID: {report.student_id}
                    </p>
                  </div>
                  <Badge variant="outline">{report.report_code}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Academic Performance */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Overall Grade:</span>
                  <Badge className={getGradeColor(report.overall_grade)}>
                    {report.overall_grade} ({report.overall_percentage}%)
                  </Badge>
                </div>

                {/* Attendance */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Attendance:</span>
                  <span className={`text-sm font-bold ${getAttendanceColor(report.attendance_percentage)}`}>
                    {report.attendance_percentage}%
                  </span>
                </div>

                {/* Behavior */}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Behavior Points:</span>
                  <span className={`text-sm font-bold ${report.behavior_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {report.behavior_balance > 0 ? '+' : ''}{report.behavior_balance}
                  </span>
                </div>

                {/* Report Details */}
                <div className="pt-2 border-t">
                  <div className="flex items-center text-sm text-muted-foreground mb-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    {report.report_period} - {report.academic_year}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <FileText className="h-3 w-3 mr-1" />
                    Generated: {new Date(report.generated_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No student reports found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Generate report cards for individual students to track their academic progress
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};