import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Users, Trash2, UserCheck, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useBranchData } from '@/hooks/useBranchData';

interface DuplicateGroup {
  duplicateKey: string;
  students: any[];
  reason: string;
}

interface DuplicateCheckerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DuplicateChecker = ({ isOpen, onClose }: DuplicateCheckerProps) => {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const { selectedBranch } = useBranchData();
  
  // Get all students for duplicate checking (without pagination)
  const { data: allStudents = [], isLoading } = useQuery({
    queryKey: ['students-all', selectedBranch],
    queryFn: async () => {
      const response = await apiClient.getAllStudents(selectedBranch);
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    enabled: !!selectedBranch && isOpen,
    staleTime: 30000
  });

  // Analyze duplicates: group students by name/DOB/phone
  function analyzeDuplicates() {
    if (!allStudents || allStudents.length === 0) return;
    setIsAnalyzing(true);
    const duplicates: DuplicateGroup[] = [];
    
    // Group by name+father+grandfather+dob (without phone) - Only level
    const nameFamilyGroups = new Map<string, any[]>();
    allStudents.forEach(student => {
      const key = `${student.first_name?.toLowerCase()}_${student.last_name?.toLowerCase()}_${student.father_name?.toLowerCase()}_${student.grandfather_name?.toLowerCase()}_${student.date_of_birth}`;
      if (!nameFamilyGroups.has(key)) nameFamilyGroups.set(key, []);
      nameFamilyGroups.get(key)?.push({ ...student, groupType: 'namefamily' });
    });
    nameFamilyGroups.forEach((students, key) => {
      if (students.length > 1) {
        duplicates.push({ duplicateKey: key, students, reason: 'Same name, father name, grandfather name and date of birth' });
      }
    });
    
    setDuplicateGroups(duplicates);
    setIsAnalyzing(false);
  }

  // Analyze duplicates when dialog opens or students update
  useEffect(() => {
    if (isOpen) analyzeDuplicates();
  }, [isOpen, allStudents]);

  // Delete selected duplicate students
  const deleteStudentsMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      // Delete students via API client
      await Promise.all(studentIds.map(id => apiClient.deleteStudent(id)));
    },
    onSuccess: () => {
      toast({ title: "Success", description: `${selectedForDeletion.size} duplicate students deleted successfully` });
      // Refresh student list for duplicates
      queryClient.invalidateQueries({ queryKey: ['students', selectedBranch] });
      setSelectedForDeletion(new Set());
      analyzeDuplicates();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete duplicate students: " + error.message,
        variant: "destructive",
      });
    }
  });

  const handleSelectForDeletion = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedForDeletion);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedForDeletion(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedForDeletion.size === 0) {
      toast({
        title: "No students selected",
        description: "Please select students to delete",
        variant: "destructive",
      });
      return;
    }

    if (confirm(`Are you sure you want to delete ${selectedForDeletion.size} duplicate students? This action cannot be undone.`)) {
      deleteStudentsMutation.mutate(Array.from(selectedForDeletion));
    }
  };

  const handleAutoDeleteDuplicates = () => {
    if (duplicateGroups.length === 0) {
      toast({
        title: "No duplicates found",
        description: "Please analyze for duplicates first",
        variant: "destructive",
      });
      return;
    }

    // For each duplicate group, select all but the first student for deletion
    const studentsToDelete = new Set<string>();
    let groupsProcessed = 0;
    let studentsToDeleteCount = 0;

    duplicateGroups.forEach(group => {
      if (group.students.length > 1) {
        // Keep the first student (oldest by creation date), delete the rest
        const sortedStudents = group.students.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        sortedStudents.slice(1).forEach(student => {
          studentsToDelete.add(student.id);
          studentsToDeleteCount++;
        });
        groupsProcessed++;
      }
    });

    if (studentsToDelete.size === 0) {
      toast({
        title: "No duplicates to delete",
        description: "All duplicate groups already have only one student",
      });
      return;
    }

    if (confirm(`Auto-delete duplicates will remove ${studentsToDeleteCount} duplicate students from ${groupsProcessed} duplicate groups, keeping the oldest record from each group. This action cannot be undone. Continue?`)) {
      setSelectedForDeletion(studentsToDelete);
      deleteStudentsMutation.mutate(Array.from(studentsToDelete));
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden bg-white/95 backdrop-blur-glass border border-white/20 shadow-2xl rounded-2xl">
        {/* Premium Header */}
        <DialogHeader className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 p-6 -mx-6 -mt-6 mb-6">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-600/90 via-orange-600/90 to-red-600/90" />
          <div className="absolute inset-0 opacity-20"
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
               }} />

          <div className="relative">
            <DialogTitle className="flex items-center gap-4 text-2xl font-bold text-white mb-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                <Search className="h-8 w-8" />
              </div>
              Duplicate Student Checker
            </DialogTitle>
            <p className="text-amber-100 text-lg">
              Find and manage duplicate student records based on name, date of birth, and contact information
            </p>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-12rem)] px-6 pb-6">

        <div className="space-y-6">
          {/* Premium Analysis Section */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <Button
                onClick={analyzeDuplicates}
                disabled={isLoading || isAnalyzing}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 px-6 py-3"
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Analyzing Students...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-3" />
                    {duplicateGroups.length > 0 ? 'Re-analyze Duplicates' : 'Find Duplicate Students'}
                  </>
                )}
              </Button>

              {selectedForDeletion.size > 0 && (
                <div className="flex items-center gap-4">
                  <div className="inline-flex items-center px-4 py-2 bg-red-50 border border-red-200 rounded-full">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-red-700 font-medium">
                      {selectedForDeletion.size} selected for deletion
                    </span>
                  </div>
                  <Button
                    onClick={handleDeleteSelected}
                    disabled={deleteStudentsMutation.isPending}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Premium Results */}
          {duplicateGroups.length === 0 && !isAnalyzing && !isLoading && (
            <Card className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="text-center py-16">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mb-6">
                  <UserCheck className="h-10 w-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No Duplicates Found</h3>
                <p className="text-gray-600 text-lg">All student records appear to be unique and properly organized.</p>
              </CardContent>
            </Card>
          )}

          {duplicateGroups.length > 0 && (
            <div className="space-y-6">
              <div className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 rounded-full">
                      <AlertTriangle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Found {duplicateGroups.length} group{duplicateGroups.length !== 1 ? 's' : ''} with potential duplicates
                      </h3>
                      <p className="text-gray-600 mt-1">Review and manage duplicate student records below</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleAutoDeleteDuplicates}
                    disabled={deleteStudentsMutation.isPending}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Auto-Delete Duplicates
                  </Button>
                </div>
              </div>

              {duplicateGroups.map((group, groupIndex) => (
                <Card key={group.duplicateKey} className="bg-white/80 backdrop-blur-sm border border-amber-200/50 shadow-xl rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300">
                  <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100/50 pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-3 text-lg font-bold">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Users className="h-5 w-5 text-amber-600" />
                        </div>
                        <span className="bg-gradient-to-r from-amber-800 to-amber-600 bg-clip-text text-transparent">
                          Duplicate Group {groupIndex + 1}
                        </span>
                      </CardTitle>
                      <div className="inline-flex items-center px-4 py-2 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                        <span className="text-sm font-medium">{group.reason}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Delete</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Father Name</TableHead>
                            <TableHead>Grandfather Name</TableHead>
                            <TableHead>Date of Birth</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Grade</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Registration Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.students.map((student) => (
                            <TableRow key={student.id} className="hover:bg-gray-50">
                              <TableCell>
                                <Checkbox
                                  checked={selectedForDeletion.has(student.id)}
                                  onCheckedChange={(checked) => 
                                    handleSelectForDeletion(student.id, checked as boolean)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                                    {getInitials(student.first_name, student.last_name)}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {student.first_name} {student.last_name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {student.mother_name && `Mother: ${student.mother_name}`}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {student.student_id}
                              </TableCell>
                              <TableCell className="text-sm">
                                {student.father_name || 'N/A'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {student.grandfather_name || 'N/A'}
                              </TableCell>
                              <TableCell>
                                {new Date(student.date_of_birth).toLocaleDateString()}
                              </TableCell>
                              <TableCell>{student.phone || 'N/A'}</TableCell>
                              <TableCell>{student.email || 'N/A'}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {student.grade_level?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Badge>
                              </TableCell>
                              <TableCell>{student.current_class || 'Unassigned'}</TableCell>
                              <TableCell>
                                {new Date(student.created_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};