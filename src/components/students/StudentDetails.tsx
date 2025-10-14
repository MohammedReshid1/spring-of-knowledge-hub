import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  X,
  Mail,
  Phone,
  MapPin,
  User,
  Calendar,
  AlertCircle,
  CreditCard,
  Users,
  GraduationCap,
} from "lucide-react";
import { StudentPaymentHistory } from "./StudentPaymentHistory";
import { useLiveData } from "@/hooks/useLiveData";

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  father_name?: string;
  grandfather_name?: string;
  mother_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  date_of_birth: string;
  gender?: string;
  grade_level: string;
  status: string;
  photo_url?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  admission_date?: string;
  previous_school?: string;
  medical_info?: string;
  class_id?: string;
  classes?: {
    class_name: string;
  };
  created_at: string;
  updated_at: string;
}

interface StudentDetailsProps {
  student: Student;
  onClose: () => void;
}

export const StudentDetails = ({ student, onClose }: StudentDetailsProps) => {
  // Enable real-time updates for student details
  useLiveData(['students', 'classes', 'payments'], {
    additionalQueryKeys: ['student-payments']
  });

  // Debug logging to see what data is received
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 border-green-200";
      case "Graduated":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Transferred Out":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Dropped Out":
        return "bg-red-100 text-red-800 border-red-200";
      case "On Leave":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
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

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  };

  const getInitials = (firstName?: string, secondName?: string) => {
    const firstInitial = firstName?.charAt(0) ?? "";
    const secondInitial = secondName?.charAt(0) ?? "";
    return `${firstInitial}${secondInitial}`.toUpperCase();
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] pt-20 p-4">
      <div className="relative max-w-4xl w-full max-h-[85vh] overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/90 via-indigo-50/80 to-cyan-50/90 rounded-2xl" />
        <div className="absolute inset-0 backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium rounded-2xl" />

        <div className="relative overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <div className="flex justify-between items-center p-8 border-b border-white/20">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full blur-xl" />
                <Avatar className="relative h-20 w-20 ring-4 ring-white/50">
                  <AvatarImage
                    src={student.photo_url}
                    alt={`${student.first_name} ${student.father_name} ${student.grandfather_name}`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-blue-100 via-indigo-100 to-cyan-100 text-blue-700 text-xl font-bold">
                    {getInitials(student.first_name, student.father_name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                  {student.first_name} {student.father_name}{" "}
                  {student.grandfather_name}
                </h2>
                <p className="text-slate-600 font-medium mt-1">Student ID: {student.student_id}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="group h-10 w-10 rounded-full bg-gradient-to-br from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 border border-red-200/50 hover:border-red-300/60 shadow-sm hover:shadow-glow-orange transition-all duration-300 hover:scale-110"
            >
              <X className="h-5 w-5 text-red-600 group-hover:rotate-90 transition-transform duration-300" />
            </Button>
          </div>

          <div className="p-8 space-y-8">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/80 backdrop-blur-sm border border-white/30 shadow-lg rounded-xl p-1">
              <TabsTrigger
                value="details"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg transition-all duration-200 font-medium"
              >
                <User className="h-4 w-4 mr-2" />
                Student Information
              </TabsTrigger>
              <TabsTrigger
                value="payments"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg transition-all duration-200 font-medium"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Payment History
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="details"
              className="space-y-6 mt-6 animate-fade-in"
            >
              {/* Premium Basic Information */}
              <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] via-indigo-500/[0.02] to-cyan-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-lg" />
                      <User className="relative h-6 w-6 text-blue-600" />
                    </div>
                    <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                      Basic Information
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Full Name</label>
                      <div className="text-lg font-semibold text-slate-800">{student.first_name} {student.father_name} {student.grandfather_name}</div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Student ID</label>
                      <div className="text-lg font-mono font-semibold text-slate-800">{student.student_id}</div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Status</label>
                      <div>
                        <Badge variant="outline" className={`${getStatusColor(student.status)} font-semibold shadow-sm`}>
                          <div className="w-2 h-2 rounded-full bg-current mr-2 animate-pulse" />
                          {student.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Grade Level</label>
                      <div>
                        <Badge variant="outline" className="bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300/50 text-blue-800 font-semibold shadow-sm">
                          {formatGradeLevel(student.grade_level)}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Date of Birth</label>
                      <div className="text-slate-800 font-medium">{formatDate(student.date_of_birth)} (Age: {calculateAge(student.date_of_birth)})</div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Gender</label>
                      <div className="text-slate-800 font-medium capitalize">{student.gender || "Not specified"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Premium Family Information */}
              {(student.mother_name ||
                student.father_name ||
                student.grandfather_name) && (
                <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.02] via-pink-500/[0.02] to-indigo-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-3 text-xl font-bold">
                      <div className="relative">
                        <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-lg" />
                        <Users className="relative h-6 w-6 text-purple-600" />
                      </div>
                      <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                        Family Information
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {student.mother_name && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Mother's Name
                          </label>
                          <div>{student.mother_name}</div>
                        </div>
                      )}
                      {student.father_name && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Father's Name
                          </label>
                          <div>{student.father_name}</div>
                        </div>
                      )}
                      {student.grandfather_name && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Grandfather's Name
                          </label>
                          <div>{student.grandfather_name}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Premium Contact Information */}
              <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] via-teal-500/[0.02] to-cyan-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-lg" />
                      <Mail className="relative h-6 w-6 text-emerald-600" />
                    </div>
                    <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                      Contact Information
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {student.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Email
                          </label>
                          <div>{student.email}</div>
                        </div>
                      </div>
                    )}
                    {student.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Parent's/Guardian's Phone
                          </label>
                          <div>{student.phone}</div>
                        </div>
                      </div>
                    )}
                  </div>
                  {student.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-1" />
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Address
                        </label>
                        <div>{student.address}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Premium Emergency Contact */}
              {(student.emergency_contact_name ||
                student.emergency_contact_phone) && (
                <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.02] via-orange-500/[0.02] to-amber-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-3 text-xl font-bold">
                      <div className="relative">
                        <div className="absolute inset-0 bg-red-500/20 rounded-full blur-lg" />
                        <AlertCircle className="relative h-6 w-6 text-red-600" />
                      </div>
                      <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                        Emergency Contact
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {student.emergency_contact_name && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Name
                          </label>
                          <div>{student.emergency_contact_name}</div>
                        </div>
                      )}
                      {student.emergency_contact_phone && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Phone
                          </label>
                          <div>{student.emergency_contact_phone}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Premium Academic Information */}
              <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.02] via-yellow-500/[0.02] to-orange-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="relative">
                      <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-lg" />
                      <GraduationCap className="relative h-6 w-6 text-amber-600" />
                    </div>
                    <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                      Academic Information
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Class
                      </label>
                      <div>
                        {student.classes?.class_name || "Not assigned"}
                        {student.class_id && !student.classes && (
                          <span className="text-xs text-gray-500 ml-2">
                            (ID: {student.class_id} - No class data)
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Admission Date
                      </label>
                      <div>
                        {student.admission_date
                          ? formatDate(student.admission_date)
                          : "Not specified"}
                      </div>
                    </div>
                  </div>
                  {student.previous_school && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Previous School
                      </label>
                      <div>{student.previous_school}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Premium Medical Information */}
              {student.medical_info && (
                <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.02] via-pink-500/[0.02] to-red-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-3 text-xl font-bold">
                      <div className="relative">
                        <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-lg" />
                        <AlertCircle className="relative h-6 w-6 text-rose-600" />
                      </div>
                      <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                        Medical Information
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border">
                      {student.medical_info}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Premium Record Information */}
              <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-500/[0.02] via-gray-500/[0.02] to-zinc-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="relative">
                      <div className="absolute inset-0 bg-slate-500/20 rounded-full blur-lg" />
                      <div className="relative h-6 w-6 bg-gradient-to-br from-slate-400 to-gray-500 rounded-full" />
                    </div>
                    <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                      Record Information
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
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

            <TabsContent value="payments" className="mt-6 animate-fade-in">
              <div className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl overflow-hidden">
                <StudentPaymentHistory
                  studentId={student.student_id}
                  studentName={`${student.first_name} ${student.father_name} ${student.grandfather_name}`}
                />
              </div>
            </TabsContent>
          </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};
