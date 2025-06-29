import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Mail, Phone, MapPin, User, Calendar, AlertCircle, CreditCard } from 'lucide-react';
import { StudentPaymentHistory } from './StudentPaymentHistory';

interface StudentDetailsProps {
  student: any;
  onClose: () => void;
}

export const StudentDetails = ({ student, onClose }: StudentDetailsProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'inactive': return 'bg-gray-500';
      case 'withdrawn': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">Student Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Student Information</TabsTrigger>
              <TabsTrigger value="payments">Payment History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-6 mt-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Student ID</label>
                      <div className="font-mono text-lg">{student.student_id}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                      <div className="text-lg">{student.first_name} {student.last_name}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div>
                        <Badge className={getStatusColor(student.status)}>
                          {student.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(student.date_of_birth)} (Age: {calculateAge(student.date_of_birth)})
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Gender</label>
                      <div className="capitalize">{student.gender || 'Not specified'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Grade Level</label>
                      <div>
                        <Badge variant="outline">
                          {student.grade_level.replace('_', ' ').toUpperCase()}
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
                    {student.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Email</label>
                          <div>{student.email}</div>
                        </div>
                      </div>
                    )}
                    {student.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Phone</label>
                          <div>{student.phone}</div>
                        </div>
                      </div>
                    )}
                  </div>
                  {student.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-1" />
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Address</label>
                        <div>{student.address}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              {(student.emergency_contact_name || student.emergency_contact_phone) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Emergency Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {student.emergency_contact_name && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Name</label>
                          <div>{student.emergency_contact_name}</div>
                        </div>
                      )}
                      {student.emergency_contact_phone && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Phone</label>
                          <div>{student.emergency_contact_phone}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Academic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Academic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Class</label>
                      <div>{student.classes?.class_name || 'Not assigned'}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Admission Date</label>
                      <div>{student.admission_date ? formatDate(student.admission_date) : 'Not specified'}</div>
                    </div>
                  </div>
                  {student.previous_school && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Previous School</label>
                      <div>{student.previous_school}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Medical Information */}
              {student.medical_info && (
                <Card>
                  <CardHeader>
                    <CardTitle>Medical Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap">{student.medical_info}</div>
                  </CardContent>
                </Card>
              )}

              {/* Timestamps */}
              <Card>
                <CardHeader>
                  <CardTitle>Record Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      <label className="font-medium">Created</label>
                      <div>{new Date(student.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <label className="font-medium">Last Updated</label>
                      <div>{new Date(student.updated_at).toLocaleString()}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="payments" className="mt-6">
              <StudentPaymentHistory 
                studentId={student.id} 
                studentName={`${student.first_name} ${student.last_name}`}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};