import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Users, Trash2, UserCheck, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

  // Fetch all students for duplicate analysis
  const { data: allStudents, isLoading } = useQuery({
    queryKey: ['all-students-for-duplicates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('status', 'Active')
        .order('first_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  // Delete selected duplicate students
  const deleteStudentsMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', studentIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${selectedForDeletion.size} duplicate students deleted successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['all-students-for-duplicates'] });
      setSelectedForDeletion(new Set());
      analyzeDuplicates(); // Re-analyze after deletion
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete duplicate students: " + error.message,
        variant: "destructive",
      });
    }
  });

  const analyzeDuplicates = () => {
    if (!allStudents) return;
    
    setIsAnalyzing(true);
    
    const duplicates: DuplicateGroup[] = [];
    const studentGroups = new Map<string, any[]>();
    
    // Group students by various criteria
    allStudents.forEach(student => {
      // Exact match duplicates (same name, DOB, and phone)
      const exactKey = `${student.first_name?.toLowerCase()}_${student.last_name?.toLowerCase()}_${student.date_of_birth}_${student.phone}`;
      if (!studentGroups.has(exactKey)) {
        studentGroups.set(exactKey, []);
      }
      studentGroups.get(exactKey)?.push({ ...student, groupType: 'exact' });
    });

    // Find groups with more than one student
    studentGroups.forEach((students, key) => {
      if (students.length > 1) {
        duplicates.push({
          duplicateKey: key,
          students,
          reason: 'Exact match (Name, Date of Birth, Phone)'
        });
      }
    });

    // Additional check for name and DOB only (different phone)
    const namedobGroups = new Map<string, any[]>();
    allStudents.forEach(student => {
      const namedobKey = `${student.first_name?.toLowerCase()}_${student.last_name?.toLowerCase()}_${student.date_of_birth}`;
      if (!namedobGroups.has(namedobKey)) {
        namedobGroups.set(namedobKey, []);
      }
      namedobGroups.get(namedobKey)?.push({ ...student, groupType: 'namedob' });
    });

    namedobGroups.forEach((students, key) => {
      if (students.length > 1) {
        // Only add if not already found in exact matches
        const alreadyFoundExact = duplicates.some(dup => 
          dup.students.some(s1 => students.some(s2 => s1.id === s2.id))
        );
        
        if (!alreadyFoundExact) {
          duplicates.push({
            duplicateKey: key,
            students,
            reason: 'Same name and date of birth (different phone)'
          });
        }
      }
    });

    setDuplicateGroups(duplicates);
    setIsAnalyzing(false);
  };

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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Search className="h-6 w-6" />
            Duplicate Student Checker
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Find and manage duplicate student records based on name, date of birth, and contact information
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Analysis Button */}
          <div className="flex items-center justify-between">
            <Button
              onClick={analyzeDuplicates}
              disabled={isLoading || isAnalyzing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  {duplicateGroups.length > 0 ? 'Re-analyze' : 'Find Duplicates'}
                </>
              )}
            </Button>

            {selectedForDeletion.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="px-3 py-1">
                  {selectedForDeletion.size} selected for deletion
                </Badge>
                <Button
                  onClick={handleDeleteSelected}
                  disabled={deleteStudentsMutation.isPending}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            )}
          </div>

          {/* Results */}
          {duplicateGroups.length === 0 && !isAnalyzing && !isLoading && (
            <Card>
              <CardContent className="text-center py-12">
                <UserCheck className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Duplicates Found</h3>
                <p className="text-gray-600">All student records appear to be unique.</p>
              </CardContent>
            </Card>
          )}

          {duplicateGroups.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <h3 className="text-lg font-medium">
                    Found {duplicateGroups.length} group(s) with potential duplicates
                  </h3>
                </div>
                <Button
                  onClick={handleAutoDeleteDuplicates}
                  disabled={deleteStudentsMutation.isPending}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Auto-Delete Duplicates
                </Button>
              </div>

              {duplicateGroups.map((group, groupIndex) => (
                <Card key={group.duplicateKey} className="border-yellow-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Duplicate Group {groupIndex + 1}
                      </CardTitle>
                      <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                        {group.reason}
                      </Badge>
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
      </DialogContent>
    </Dialog>
  );
};