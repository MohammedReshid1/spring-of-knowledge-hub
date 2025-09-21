import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { useBranchData } from '@/hooks/useBranchData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, UserMinus, Search, School } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/hooks/useRoleAccess';

interface ClassStudentsPopupProps {
  classData: any;
  isOpen: boolean;
  onClose: () => void;
}

export const ClassStudentsPopup = ({ classData, isOpen, onClose }: ClassStudentsPopupProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const { selectedBranch } = useBranch();
  const queryClient = useQueryClient();
  const { isTeacher } = useRoleAccess();
  // Refetch students when popup opens
  useEffect(() => {
    if (isOpen) {
      queryClient.invalidateQueries({ queryKey: ['all-students'] });
    }
  }, [isOpen, queryClient]);
  const { useGradeLevels } = useBranchData();
  
  // Fetch ALL students directly (not paginated) for proper filtering
  const { data: allStudentsRaw = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['all-students'],
    queryFn: async () => {
      const resp = await apiClient.getAllStudents(); // Fetch all students without branch filter
      if (resp.error) {
        console.error('Error fetching all students:', resp.error);
        return [];
      }
      console.log('Fetched students:', resp.data?.length, 'students total');
      return resp.data || [];
    },
    enabled: true
  });

  // Filter students by branch on frontend (consistent with ClassManagement)
  const allStudents = useMemo(
    () => allStudentsRaw?.filter(s => selectedBranch === 'all' || s.branch_id === selectedBranch) || [],
    [allStudentsRaw, selectedBranch]
  );
  const { data: gradeLevels = [] } = useGradeLevels();

  // Compute students assigned to this class
  const classStudents = useMemo(
    () => allStudents.filter(s => s.class_id === classData?.id),
    [allStudents, classData]
  );
  const loadingClassStudents = isLoadingStudents;

  // Determine grade enum from classData.grade_level_id
  const gradeEnum = useMemo(() => {
    return gradeLevels.find(gl => gl.id === classData?.grade_level_id)?.grade;
  }, [gradeLevels, classData]);

  // Map between student grade format and grade level enum format
  const mapStudentGradeToEnum = (studentGrade: string): string => {
    const gradeMapping: Record<string, string> = {
      'KG': 'kg',
      'G1': 'grade_1',
      'G2': 'grade_2', 
      'G3': 'grade_3',
      'G4': 'grade_4',
      'G5': 'grade_5',
      'G6': 'grade_6',
      'G7': 'grade_7',
      'G8': 'grade_8',
      'G9': 'grade_9',
      'G10': 'grade_10',
      'G11': 'grade_11',
      'G12': 'grade_12',
      // Handle both formats
      'kg': 'kg',
      'grade_1': 'grade_1',
      'grade_2': 'grade_2',
      'grade_3': 'grade_3',
      'grade_4': 'grade_4',
      'grade_5': 'grade_5',
      'grade_6': 'grade_6',
      'grade_7': 'grade_7',
      'grade_8': 'grade_8',
      'grade_9': 'grade_9',
      'grade_10': 'grade_10',
      'grade_11': 'grade_11',
      'grade_12': 'grade_12'
    };
    return gradeMapping[studentGrade] || studentGrade;
  };

  // Available students: unassigned students of the same grade level
  const availableStudents = useMemo(() => {
    if (!allStudents) return [];
    
    // Determine target grade - try gradeEnum first, then infer from class name
    let targetGrade = gradeEnum;
    
    // Convert formatted gradeEnum back to database format to match student records
    if (targetGrade) {
      const gradeToDbFormat: Record<string, string> = {
        'Pre KG': 'pre_k',
        'KG': 'kg',
        'PREP': 'prep',
        'Grade 1': 'grade_1',
        'Grade 2': 'grade_2',
        'Grade 3': 'grade_3',
        'Grade 4': 'grade_4',
        'Grade 5': 'grade_5',
        'Grade 6': 'grade_6',
        'Grade 7': 'grade_7',
        'Grade 8': 'grade_8',
        'Grade 9': 'grade_9',
        'Grade 10': 'grade_10',
        'Grade 11': 'grade_11',
        'Grade 12': 'grade_12',
      };
      targetGrade = gradeToDbFormat[targetGrade] || targetGrade;
    }
    
    // Fallback: infer from class name if gradeEnum conversion failed
    if (!targetGrade && classData?.class_name) {
      const className = classData.class_name;
      if (className.includes('GRADE 5')) targetGrade = 'grade_5';
      else if (className.includes('GRADE 1')) targetGrade = 'grade_1';
      else if (className.includes('GRADE 2')) targetGrade = 'grade_2';
      else if (className.includes('GRADE 3')) targetGrade = 'grade_3';
      else if (className.includes('GRADE 4')) targetGrade = 'grade_4';
      else if (className.includes('GRADE 6')) targetGrade = 'grade_6';
      else if (className.includes('GRADE 7')) targetGrade = 'grade_7';
      else if (className.includes('GRADE 8')) targetGrade = 'grade_8';
      else if (className.includes('GRADE 9')) targetGrade = 'grade_9';
      else if (className.includes('GRADE 10')) targetGrade = 'grade_10';
      else if (className.includes('GRADE 11')) targetGrade = 'grade_11';
      else if (className.includes('GRADE 12')) targetGrade = 'grade_12';
      else if (className.includes('KG')) targetGrade = 'kg';
    }
    
    if (!targetGrade) return [];
    
    return allStudents.filter((s: any) => {
      if (s.class_id) return false; // Skip students already assigned to classes
      
      // Try multiple comparison methods for robust matching
      return (
        s.grade_level === targetGrade || 
        mapStudentGradeToEnum(s.grade_level) === targetGrade ||
        mapStudentGradeToEnum(targetGrade) === s.grade_level
      );
    });
  }, [allStudents, gradeEnum, classData]);

  // Update student's class assignment
  const addStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      await apiClient.updateStudent(studentId, { class_id: classData.id });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student added to class successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['all-students'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
      setSelectedStudentId('');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add student to class: " + error.message,
        variant: "destructive",
      });
    }
  });

  // Remove student from class
  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      await apiClient.updateStudent(studentId, { class_id: null });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student removed from class successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['all-students'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove student from class: " + error.message,
        variant: "destructive",
      });
    }
  });

  const formatGradeLevel = (grade: string) => {
    const gradeMap: Record<string, string> = {
      'pre_k': 'Pre KG',
      'kg': 'KG',
      'prep': 'PREP',
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

  // Filter students based on search term
  const filteredClassStudents = classStudents?.filter(student => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (student.first_name || '').toLowerCase().includes(searchLower) ||
      (student.last_name || '').toLowerCase().includes(searchLower) ||
      (student.student_id || '').toLowerCase().includes(searchLower)
    );
  }) || [];

  const filteredAvailableStudents = availableStudents.filter(student => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (student.first_name || '').toLowerCase().includes(searchLower) ||
      (student.last_name || '').toLowerCase().includes(searchLower) ||
      (student.student_id || '').toLowerCase().includes(searchLower)
    );
  }) || [];

  // Don't render if popup is not open or if we don't have class data AND popup is closed
  if (!isOpen) return null;
  if (!classData) {
    // If popup is open but no class data yet, show loading state
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <School className="h-6 w-6" />
              Loading Class Information...
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden bg-white/95 backdrop-blur-glass border-0 shadow-2xl rounded-3xl">
        {/* Premium Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-indigo-50/60 to-purple-50/80 rounded-3xl pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/6 to-purple-500/8 rounded-3xl pointer-events-none"></div>

        {/* Floating orbs */}
        <div className="absolute top-10 right-20 w-32 h-32 bg-gradient-to-r from-blue-200/20 to-indigo-200/20 rounded-full blur-2xl animate-float pointer-events-none"></div>
        <div className="absolute bottom-10 left-20 w-24 h-24 bg-gradient-to-r from-indigo-200/20 to-purple-200/20 rounded-full blur-2xl animate-float pointer-events-none" style={{animationDelay: '1s'}}></div>

        <div className="relative overflow-y-auto max-h-[90vh] p-1">
          <DialogHeader className="p-8 pb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50 shadow-premium">
                <School className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                  {classData.class_name}
                </DialogTitle>
                <p className="text-lg text-slate-600 font-medium mt-1">Students Management</p>
              </div>
            </div>

            {/* Premium Info Cards */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl shadow-premium">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse-glow"></div>
                <span className="text-sm font-semibold text-slate-700">
                  Grade: {gradeEnum ? formatGradeLevel(gradeEnum) : 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl shadow-premium">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-glow"></div>
                <span className="text-sm font-semibold text-slate-700">
                  Students: {classStudents.length} / {classData.max_capacity}
                </span>
              </div>
            </div>
          </DialogHeader>

          <div className="px-8 space-y-8">
            {/* Premium Search Section */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium"></div>
              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200/50">
                    <Search className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Search Students</h3>
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 p-1 rounded-lg bg-purple-100 border border-purple-200/50">
                    <Search className="h-4 w-4 text-purple-600" />
                  </div>
                  <Input
                    placeholder="Search students by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-14 h-12 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl focus:bg-white/80 focus:border-purple-300 transition-all duration-normal"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Current Students */}
              <div className="relative">
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 to-green-50/80 rounded-2xl pointer-events-none"></div>

                <Card className="relative bg-transparent border-0 shadow-none">
                  <CardHeader className="p-6">
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 border border-emerald-200/50">
                        <Users className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <span className="text-xl font-bold bg-gradient-to-r from-slate-900 via-emerald-800 to-green-900 bg-clip-text text-transparent">
                          Current Students
                        </span>
                        <p className="text-sm text-slate-600 font-medium">({filteredClassStudents.length})</p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    {loadingClassStudents ? (
                      <div className="text-center py-12">
                        <div className="relative mb-4">
                          <div className="h-8 w-8 rounded-full border-4 border-emerald-200 mx-auto"></div>
                          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-8 w-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin"></div>
                        </div>
                        <p className="text-slate-600 font-medium">Loading students...</p>
                      </div>
                    ) : filteredClassStudents.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50 inline-flex mb-4">
                          <Users className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-semibold mb-2">
                          {searchTerm ? 'No students found matching search' : 'No students in this class'}
                        </p>
                        <p className="text-slate-500 text-sm">
                          {searchTerm ? 'Try adjusting your search terms' : 'Students will appear here once assigned'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {filteredClassStudents.map((student, index) => (
                          <div
                            key={student.id}
                            className="group flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl hover:bg-white/80 hover:scale-105 transition-all duration-normal animate-fade-in-up"
                            style={{
                              animationDelay: `${index * 50}ms`,
                              animationFillMode: 'both'
                            }}
                          >
                            <div>
                              <p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p>
                              <p className="text-sm text-slate-600 font-medium">{student.student_id}</p>
                            </div>
                            {!isTeacher && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeStudentMutation.mutate(student.id)}
                                disabled={removeStudentMutation.isPending}
                                className="p-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-red-50 hover:border-red-200 hover:text-red-600 hover:scale-105 transition-all duration-normal"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Available Students (admins/registrars) */}
              {!isTeacher && (
                <div className="relative">
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 rounded-2xl pointer-events-none"></div>

                  <Card className="relative bg-transparent border-0 shadow-none">
                    <CardHeader className="p-6">
                      <CardTitle className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                          <UserPlus className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <span className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                            Available Students
                          </span>
                          <p className="text-sm text-slate-600 font-medium">({filteredAvailableStudents.length})</p>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                      <div className="space-y-6">
                        {/* Add Student Dropdown */}
                        <div className="relative">
                          <div className="absolute inset-0 bg-white/40 backdrop-blur-sm border border-white/30 rounded-xl shadow-premium"></div>
                          <div className="relative p-4">
                            <h4 className="text-sm font-bold text-slate-900 mb-3">Quick Add Student</h4>
                            <div className="flex gap-3">
                              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                <SelectTrigger className="flex-1 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl">
                                  <SelectValue placeholder="Select student to add..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {filteredAvailableStudents.map((student) => (
                                    <SelectItem key={student.id} value={student.id}>
                                      {student.first_name} {student.last_name} ({student.student_id})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                onClick={() => selectedStudentId && addStudentMutation.mutate(selectedStudentId)}
                                disabled={!selectedStudentId || addStudentMutation.isPending || (classStudents.length >= classData.max_capacity)}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-6 rounded-xl shadow-premium hover:shadow-glow-blue hover:scale-105 transition-all duration-normal border-0"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        </div>

                        {(classStudents.length >= classData.max_capacity) && (
                          <Badge variant="destructive" className="w-full justify-center py-2 bg-gradient-to-r from-red-500 to-rose-500 font-semibold">
                            Class is at full capacity
                          </Badge>
                        )}

                        {isLoadingStudents ? (
                          <div className="text-center py-12">
                            <div className="relative mb-4">
                              <div className="h-8 w-8 rounded-full border-4 border-blue-200 mx-auto"></div>
                              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-slate-600 font-medium">Loading available students...</p>
                          </div>
                        ) : filteredAvailableStudents.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50 inline-flex mb-4">
                              <UserPlus className="h-8 w-8 text-slate-400" />
                            </div>
                            <p className="text-slate-600 font-semibold mb-2">
                              {searchTerm ? 'No available students found matching search' : 'No available students for this grade level'}
                            </p>
                            <p className="text-slate-500 text-sm">
                              {searchTerm ? 'Try adjusting your search terms' : 'All students of this grade are already assigned'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-80 overflow-y-auto">
                            {filteredAvailableStudents.map((student, index) => (
                              <div
                                key={student.id}
                                className="group flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl hover:bg-white/80 hover:scale-105 transition-all duration-normal animate-fade-in-up"
                                style={{
                                  animationDelay: `${index * 50}ms`,
                                  animationFillMode: 'both'
                                }}
                              >
                                <div>
                                  <p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p>
                                  <p className="text-sm text-slate-600 font-medium">{student.student_id}</p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addStudentMutation.mutate(student.id)}
                                  disabled={addStudentMutation.isPending || (classStudents.length >= classData.max_capacity)}
                                  className="p-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 hover:scale-105 transition-all duration-normal"
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
