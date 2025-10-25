import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Save, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
}

interface Exam {
  id: string;
  name: string;
  total_marks: number;
  passing_marks: number;
  exam_date: string;
  subject_id: string;
  class_id: string;
}

interface GradeEntry {
  student_id: string;
  marks_obtained: string;
  attendance_status: 'present' | 'absent' | 'late';
  submission_status: 'submitted' | 'not_submitted' | 'partial';
  feedback?: string;
  remarks?: string;
}

interface BulkResultResponse {
  student_id: string;
  student_name?: string;
  success: boolean;
  result_id?: string;
  grade?: string;
  percentage?: number;
  status?: string;
  error?: string;
  action: string;
}

interface GradeEntryGridProps {
  examId: string;
  onSaveComplete?: (response: any) => void;
}

export const GradeEntryGrid = ({ examId, onSaveComplete }: GradeEntryGridProps) => {
  const [grades, setGrades] = useState<Record<string, GradeEntry>>({});
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [notifyParents, setNotifyParents] = useState(false);
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [saveResults, setSaveResults] = useState<BulkResultResponse[]>([]);
  const [showResults, setShowResults] = useState(false);

  const queryClient = useQueryClient();

  // Fetch exam details
  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: async () => {
      const { data, error } = await apiClient.getExam(examId);
      if (error) throw new Error(error);
      return data as Exam;
    }
  });

  // Fetch students for the class
  const { data: studentsResponse, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', exam?.class_id],
    queryFn: async () => {
      if (!exam?.class_id) return { items: [] };
      const params = new URLSearchParams();
      params.append('class_id', exam.class_id);
      params.append('limit', '1000');
      const { data, error } = await apiClient.request(`/students/?${params.toString()}`);
      if (error) throw new Error(error);
      return data;
    },
    enabled: !!exam?.class_id
  });

  const students = studentsResponse?.items || [];

  // Fetch existing results
  const { data: existingResults = [] } = useQuery({
    queryKey: ['exam-results', examId],
    queryFn: async () => {
      const { data, error } = await apiClient.getExamResults({ exam_id: examId });
      if (error) throw new Error(error);
      return data;
    }
  });

  // Initialize grades with existing results
  useEffect(() => {
    if (existingResults.length > 0) {
      const initialGrades: Record<string, GradeEntry> = {};
      existingResults.forEach((result: any) => {
        initialGrades[result.student_id] = {
          student_id: result.student_id,
          marks_obtained: result.marks_obtained?.toString() || '',
          attendance_status: result.attendance_status || 'present',
          submission_status: result.submission_status || 'submitted',
          feedback: result.feedback || '',
          remarks: result.remarks || ''
        };
      });
      setGrades(initialGrades);
    }
  }, [existingResults]);

  // Bulk save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: response, error } = await apiClient.bulkCreateUpdateExamResults(data);
      if (error) throw new Error(error);
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['exam-results', examId] });
      queryClient.invalidateQueries({ queryKey: ['exam-statistics', examId] });
      setSaveResults(response.results || []);
      setShowResults(true);
      toast({
        title: 'Grades Saved',
        description: `Successfully saved ${response.successful} out of ${response.total_processed} grades`,
        variant: response.failed > 0 ? 'default' : 'default'
      });
      if (onSaveComplete) {
        onSaveComplete(response);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Saving Grades',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleGradeChange = (studentId: string, field: keyof GradeEntry, value: string) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        [field]: value,
        attendance_status: prev[studentId]?.attendance_status || 'present',
        submission_status: prev[studentId]?.submission_status || 'submitted',
        marks_obtained: prev[studentId]?.marks_obtained || ''
      }
    }));

    // Auto-select student when entering marks
    if (field === 'marks_obtained' && value) {
      setSelectedStudents(prev => new Set(prev).add(studentId));
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(studentId);
      } else {
        newSet.delete(studentId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(students.map((s: Student) => s.id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  const handleSaveGrades = () => {
    const selectedGrades = Array.from(selectedStudents)
      .map(studentId => grades[studentId])
      .filter(grade => grade && grade.marks_obtained);

    if (selectedGrades.length === 0) {
      toast({
        title: 'No Grades to Save',
        description: 'Please enter marks for at least one selected student',
        variant: 'destructive'
      });
      return;
    }

    // Convert marks to numbers
    const results = selectedGrades.map(grade => ({
      ...grade,
      marks_obtained: parseFloat(grade.marks_obtained)
    }));

    saveMutation.mutate({
      exam_id: examId,
      results,
      notify_parents: notifyParents,
      publish_immediately: publishImmediately
    });
  };

  const getMarksValidation = (marks: string) => {
    if (!marks || !exam) return null;
    const marksNum = parseFloat(marks);
    if (isNaN(marksNum)) return 'error';
    if (marksNum < 0) return 'error';
    if (marksNum > exam.total_marks) return 'error';
    return 'success';
  };

  if (examLoading || studentsLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading grade entry form...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!exam) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertCircle className="h-6 w-6 mx-auto mb-2" />
            <p>Exam not found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Grade Entry - {exam.name}</CardTitle>
              <CardDescription>
                Total Marks: {exam.total_marks} | Passing Marks: {exam.passing_marks}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline">
                {selectedStudents.size} of {students.length} selected
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Options */}
            <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="notify-parents"
                  checked={notifyParents}
                  onCheckedChange={(checked) => setNotifyParents(checked as boolean)}
                />
                <label htmlFor="notify-parents" className="text-sm font-medium cursor-pointer">
                  Notify Parents
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="publish-immediately"
                  checked={publishImmediately}
                  onCheckedChange={(checked) => setPublishImmediately(checked as boolean)}
                />
                <label htmlFor="publish-immediately" className="text-sm font-medium cursor-pointer">
                  Publish Immediately
                </label>
              </div>
            </div>

            {/* Grade Entry Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedStudents.size === students.length && students.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="w-32">Marks</TableHead>
                    <TableHead className="w-32">Attendance</TableHead>
                    <TableHead className="w-32">Submission</TableHead>
                    <TableHead className="w-48">Remarks</TableHead>
                    <TableHead className="w-16">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student: Student) => {
                    const grade = grades[student.id];
                    const validation = grade?.marks_obtained ? getMarksValidation(grade.marks_obtained) : null;
                    const isSelected = selectedStudents.has(student.id);

                    return (
                      <TableRow
                        key={student.id}
                        className={cn(
                          'hover:bg-slate-50',
                          isSelected && 'bg-blue-50'
                        )}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectStudent(student.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {student.student_id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.first_name} {student.last_name}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max={exam.total_marks}
                            value={grade?.marks_obtained || ''}
                            onChange={(e) => handleGradeChange(student.id, 'marks_obtained', e.target.value)}
                            placeholder="0"
                            className={cn(
                              'h-8',
                              validation === 'error' && 'border-red-500',
                              validation === 'success' && 'border-green-500'
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={grade?.attendance_status || 'present'}
                            onValueChange={(value) => handleGradeChange(student.id, 'attendance_status', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                              <SelectItem value="late">Late</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={grade?.submission_status || 'submitted'}
                            onValueChange={(value) => handleGradeChange(student.id, 'submission_status', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="submitted">Submitted</SelectItem>
                              <SelectItem value="not_submitted">Not Submitted</SelectItem>
                              <SelectItem value="partial">Partial</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={grade?.remarks || ''}
                            onChange={(e) => handleGradeChange(student.id, 'remarks', e.target.value)}
                            placeholder="Optional remarks"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          {validation === 'success' && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          {validation === 'error' && (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
              <Button
                onClick={handleSaveGrades}
                disabled={saveMutation.isPending || selectedStudents.size === 0}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Grades ({selectedStudents.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Results */}
      {showResults && saveResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Save Results</CardTitle>
            <CardDescription>Detailed results of the bulk save operation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {saveResults.map((result, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium">{result.student_name || result.student_id}</p>
                      {result.success && (
                        <p className="text-sm text-gray-600">
                          Grade: {result.grade} | {result.percentage}% | {result.action}
                        </p>
                      )}
                      {!result.success && (
                        <p className="text-sm text-red-600">{result.error}</p>
                      )}
                    </div>
                  </div>
                  {result.success && (
                    <Badge variant={result.status === 'pass' ? 'default' : 'destructive'}>
                      {result.status?.toUpperCase()}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
