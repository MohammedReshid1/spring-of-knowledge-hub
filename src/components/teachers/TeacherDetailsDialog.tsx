import React from 'react';
import { Teacher } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  GraduationCap, 
  Briefcase,
  Users,
  BookOpen,
  X,
  IdCard,
  Heart
} from 'lucide-react';

interface TeacherDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: Teacher | null;
}

export const TeacherDetailsDialog: React.FC<TeacherDetailsDialogProps> = ({
  isOpen,
  onClose,
  teacher
}) => {
  if (!teacher) return null;

  const formatDate = (date?: string) => {
    if (!date) return 'Not provided';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'on leave':
        return 'bg-yellow-100 text-yellow-800';
      case 'terminated':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">
              Teacher Details
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Section with Photo */}
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                {teacher.photo_url ? (
                  <img
                    src={teacher.photo_url}
                    alt={`${teacher.first_name} ${teacher.last_name}`}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-blue-600">
                    {teacher.first_name[0]}{teacher.last_name[0]}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {teacher.first_name} {teacher.last_name}
                </h2>
                <p className="text-gray-600 mt-1">
                  {teacher.specialization || 'Teacher'}
                </p>
                <div className="flex items-center space-x-4 mt-2">
                  <Badge className={getStatusColor(teacher.status)}>
                    {teacher.status}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    ID: {teacher.teacher_id}
                  </span>
                  {teacher.employee_id && (
                    <span className="text-sm text-gray-500">
                      Employee ID: {teacher.employee_id}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Personal Information */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-blue-600" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p className="text-gray-900">{teacher.email}</p>
                  </div>
                </div>
                
                {teacher.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Phone</p>
                      <p className="text-gray-900">{teacher.phone}</p>
                    </div>
                  </div>
                )}

                {teacher.date_of_birth && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                      <p className="text-gray-900">{formatDate(teacher.date_of_birth)}</p>
                    </div>
                  </div>
                )}

                {teacher.gender && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Gender</p>
                    <p className="text-gray-900">{teacher.gender}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {teacher.address && (
                  <div className="flex items-start space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Address</p>
                      <p className="text-gray-900">{teacher.address}</p>
                    </div>
                  </div>
                )}

                {teacher.nationality && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Nationality</p>
                    <p className="text-gray-900">{teacher.nationality}</p>
                  </div>
                )}

                {teacher.marital_status && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Marital Status</p>
                    <p className="text-gray-900">{teacher.marital_status}</p>
                  </div>
                )}

                {teacher.blood_group && (
                  <div className="flex items-center space-x-2">
                    <Heart className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Blood Group</p>
                      <p className="text-gray-900">{teacher.blood_group}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Emergency Contact */}
          {(teacher.emergency_contact_name || teacher.emergency_contact_phone) && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Phone className="h-5 w-5 mr-2 text-red-600" />
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teacher.emergency_contact_name && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Contact Name</p>
                    <p className="text-gray-900">{teacher.emergency_contact_name}</p>
                  </div>
                )}
                {teacher.emergency_contact_phone && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Contact Phone</p>
                    <p className="text-gray-900">{teacher.emergency_contact_phone}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Professional Information */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Briefcase className="h-5 w-5 mr-2 text-green-600" />
              Professional Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                {teacher.qualification && (
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Qualification</p>
                      <p className="text-gray-900">{teacher.qualification}</p>
                    </div>
                  </div>
                )}

                {teacher.specialization && (
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Specialization</p>
                      <p className="text-gray-900">{teacher.specialization}</p>
                    </div>
                  </div>
                )}

                {teacher.department && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Department</p>
                    <p className="text-gray-900">{teacher.department}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {teacher.experience_years !== undefined && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Experience</p>
                    <p className="text-gray-900">{teacher.experience_years} years</p>
                  </div>
                )}

                {teacher.joining_date && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Joining Date</p>
                      <p className="text-gray-900">{formatDate(teacher.joining_date)}</p>
                    </div>
                  </div>
                )}

                {teacher.salary !== undefined && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Salary</p>
                    <p className="text-gray-900">${teacher.salary.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Subjects and Classes */}
          {(teacher.subjects || teacher.classes) && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-purple-600" />
                Teaching Assignment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teacher.subjects && teacher.subjects.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Subjects</p>
                    <div className="flex flex-wrap gap-2">
                      {teacher.subjects.map((subject, index) => (
                        <Badge key={index} variant="outline">
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {teacher.classes && teacher.classes.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Classes</p>
                    <div className="flex flex-wrap gap-2">
                      {teacher.classes.map((cls, index) => (
                        <Badge key={index} variant="secondary">
                          {cls}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Notes */}
          {teacher.notes && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Notes</h3>
              <p className="text-gray-900 whitespace-pre-wrap">{teacher.notes}</p>
            </Card>
          )}

          {/* System Information */}
          <Card className="p-6 bg-gray-50">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <IdCard className="h-5 w-5 mr-2 text-gray-600" />
              System Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Created</p>
                <p className="text-gray-900">{formatDate(teacher.created_at)}</p>
              </div>
              <div>
                <p className="text-gray-500">Last Updated</p>
                <p className="text-gray-900">{formatDate(teacher.updated_at)}</p>
              </div>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};