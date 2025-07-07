
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, GraduationCap, User, Calendar } from 'lucide-react';

interface ClassDetailsDialogProps {
  classData: any;
  students: any[];
  isOpen: boolean;
  onClose: () => void;
}

export const ClassDetailsDialog = ({ classData, students, isOpen, onClose }: ClassDetailsDialogProps) => {
  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="h-6 w-6" />
            {classData?.class_name} Details
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Class Information */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="h-5 w-5" />
                Class Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Class Name</p>
                <p className="font-semibold">{classData?.class_name}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Grade Level</p>
                <Badge variant="outline" className="mt-1">
                  {classData?.grade_levels?.grade ? formatGradeLevel(classData.grade_levels.grade) : 'Not assigned'}
                </Badge>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Academic Year</p>
                <p className="font-semibold">{classData?.academic_year}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Capacity</p>
                <div className="flex items-center gap-2 mt-1">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold">
                    {classData?.current_enrollment || 0} / {classData?.max_capacity || 0}
                  </span>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Teacher</p>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold">
                    {classData?.teacher?.full_name || 'Not assigned'}
                  </span>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Created</p>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    {classData?.created_at ? new Date(classData.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Students List */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Enrolled Students ({students?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {students && students.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage 
                                  src={student.photo_url} 
                                  alt={`${student.first_name} ${student.last_name}`}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {getInitials(student.first_name, student.last_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">
                                  {student.first_name} {student.last_name}
                                </p>
                                {student.mother_name && (
                                  <p className="text-xs text-gray-500">
                                    Mother: {student.mother_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                              {student.student_id}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {formatGradeLevel(student.grade_level)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={student.status === 'Active' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {student.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No students enrolled</p>
                  <p className="text-gray-500 text-sm">Students will appear here when they are assigned to this class</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
