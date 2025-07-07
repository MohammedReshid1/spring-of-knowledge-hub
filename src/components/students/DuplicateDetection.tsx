
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone?: string;
  email?: string;
  grade_level: string;
  status: string;
  created_at: string;
}

interface DuplicateGroup {
  key: string;
  students: Student[];
  count: number;
  matchType: string;
}

export const DuplicateDetection = () => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: duplicates, isLoading } = useQuery({
    queryKey: ['duplicate-students'],
    queryFn: async () => {
      const { data: students, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at');
      
      if (error) throw error;

      // Group students by potential duplicate criteria
      const duplicateGroups: DuplicateGroup[] = [];
      const processedStudents = new Set<string>();

      students?.forEach((student, index) => {
        if (processedStudents.has(student.id)) return;

        const potentialDuplicates = students.filter((other, otherIndex) => {
          if (otherIndex <= index || processedStudents.has(other.id)) return false;
          
          // Check for exact name and DOB match
          const exactMatch = 
            student.first_name.toLowerCase() === other.first_name.toLowerCase() &&
            student.last_name.toLowerCase() === other.last_name.toLowerCase() &&
            student.date_of_birth === other.date_of_birth;

          // Check for name and phone match
          const phoneMatch = student.phone && other.phone &&
            student.first_name.toLowerCase() === other.first_name.toLowerCase() &&
            student.last_name.toLowerCase() === other.last_name.toLowerCase() &&
            student.phone === other.phone;

          // Check for email match
          const emailMatch = student.email && other.email &&
            student.email.toLowerCase() === other.email.toLowerCase();

          return exactMatch || phoneMatch || emailMatch;
        });

        if (potentialDuplicates.length > 0) {
          const allDuplicates = [student, ...potentialDuplicates];
          
          // Determine match type
          let matchType = 'Unknown';
          if (allDuplicates.every(s => s.first_name.toLowerCase() === student.first_name.toLowerCase() && 
                                       s.last_name.toLowerCase() === student.last_name.toLowerCase() && 
                                       s.date_of_birth === student.date_of_birth)) {
            matchType = 'Name + Date of Birth';
          } else if (allDuplicates.every(s => s.phone === student.phone && student.phone)) {
            matchType = 'Name + Phone Number';
          } else if (allDuplicates.every(s => s.email?.toLowerCase() === student.email?.toLowerCase() && student.email)) {
            matchType = 'Email Address';
          }

          duplicateGroups.push({
            key: `${student.first_name}_${student.last_name}_${student.date_of_birth}`,
            students: allDuplicates,
            count: allDuplicates.length,
            matchType
          });

          // Mark all as processed
          allDuplicates.forEach(s => processedStudents.add(s.id));
        }
      });

      return duplicateGroups;
    },
    enabled: isOpen,
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
        description: "Duplicate student record deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['duplicate-students'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete student record.",
        variant: "destructive",
      });
    }
  });

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Check Duplicates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Duplicate Student Detection</DialogTitle>
          <DialogDescription>
            Review potential duplicate student records and take action to maintain data integrity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-gray-600 mt-2">Scanning for duplicates...</p>
            </div>
          ) : !duplicates || duplicates.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-green-500 mx-auto mb-4 opacity-50" />
              <p className="text-gray-600 font-medium">No duplicate records found</p>
              <p className="text-gray-500 text-sm">Your student database appears to be clean</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <h3 className="font-medium text-yellow-800">
                    Found {duplicates.length} duplicate group(s)
                  </h3>
                </div>
                <p className="text-yellow-700 text-sm mt-1">
                  Please review these potential duplicates and decide which records to keep.
                </p>
              </div>

              {duplicates.map((group, groupIndex) => (
                <Card key={group.key} className="border-orange-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Duplicate Group #{groupIndex + 1}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-orange-600">
                          {group.matchType}
                        </Badge>
                        <Badge variant="destructive">
                          {group.count} records
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {group.students.map((student, index) => (
                        <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="font-medium">{student.first_name} {student.last_name}</p>
                              <p className="text-sm text-gray-600">ID: {student.student_id}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">DOB: {format(new Date(student.date_of_birth), 'MMM dd, yyyy')}</p>
                              <p className="text-sm text-gray-600">Grade: {formatGradeLevel(student.grade_level)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Phone: {student.phone || 'N/A'}</p>
                              <p className="text-sm text-gray-600">Email: {student.email || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Status: {student.status}</p>
                              <p className="text-sm text-gray-600">Created: {format(new Date(student.created_at), 'MMM dd, yyyy')}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`/students/${student.id}`} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Duplicate Record</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the record for {student.first_name} {student.last_name} (ID: {student.student_id})? 
                                    This action cannot be undone and will also delete associated payment records.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteStudentMutation.mutate(student.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete Record
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
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
