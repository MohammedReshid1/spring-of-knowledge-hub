import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { X, Mail, Phone, User, Users, BookOpen, GraduationCap } from 'lucide-react';

interface TeacherDetailsProps {
  teacher: any;
  onClose: () => void;
}

export const TeacherDetails = ({ teacher, onClose }: TeacherDetailsProps) => {
  const getInitials = (fullName: string) => {
    return fullName.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const totalStudents = teacher.classes?.reduce((sum, cls) => sum + (cls.current_enrollment || 0), 0) || 0;
  const totalCapacity = teacher.classes?.reduce((sum, cls) => sum + (cls.max_capacity || 0), 0) || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {getInitials(teacher.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold">{teacher.full_name}</h2>
              <p className="text-gray-600">Teacher</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <div className="text-lg">{teacher.full_name}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <div>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                      Teacher
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <div>{teacher.email}</div>
                  </div>
                </div>
                {teacher.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Phone</label>
                      <div>{teacher.phone}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Teaching Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Teaching Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <BookOpen className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-900">{teacher.classes?.length || 0}</div>
                  <div className="text-sm text-blue-600">Classes Assigned</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-900">{totalStudents}</div>
                  <div className="text-sm text-green-600">Total Students</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <GraduationCap className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-900">{totalCapacity}</div>
                  <div className="text-sm text-purple-600">Total Capacity</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Class Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Class Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teacher.classes && teacher.classes.length > 0 ? (
                <div className="space-y-4">
                  {teacher.classes.map((cls) => (
                    <div key={cls.id} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-lg">{cls.class_name}</h4>
                          {cls.grade_levels && (
                            <Badge variant="outline" className="mt-1">
                              {formatGradeLevel(cls.grade_levels.grade)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Enrollment</div>
                          <div className="font-medium">
                            {cls.current_enrollment || 0} / {cls.max_capacity || 0}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ 
                            width: `${cls.max_capacity > 0 ? ((cls.current_enrollment || 0) / cls.max_capacity) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No classes assigned</p>
                  <p className="text-gray-500 text-sm">This teacher is not currently assigned to any classes</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Record Information */}
          <Card>
            <CardHeader>
              <CardTitle>Record Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <label className="font-medium">Created</label>
                  <div>{new Date(teacher.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <label className="font-medium">Last Updated</label>
                  <div>{new Date(teacher.updated_at).toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};