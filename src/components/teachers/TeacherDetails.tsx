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
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatGradeLevel = (grade: string) => {
    return grade.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const totalStudents = teacher.classes?.reduce((sum, cls) => sum + (cls.current_enrollment || 0), 0) || 0;
  const totalCapacity = teacher.classes?.reduce((sum, cls) => sum + (cls.max_capacity || 0), 0) || 0;

  const fullName = `${teacher.first_name} ${teacher.last_name}`;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/90 via-teal-50/80 to-cyan-50/90 rounded-2xl" />
        <div className="absolute inset-0 backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium rounded-2xl" />

        <div className="relative overflow-y-auto max-h-[90vh] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <div className="flex justify-between items-center p-8 border-b border-white/20">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-xl" />
                <Avatar className="relative h-20 w-20 ring-4 ring-white/50">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-100 via-teal-100 to-cyan-100 text-emerald-700 text-xl font-bold">
                    {getInitials(teacher.first_name, teacher.last_name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                  {fullName}
                </h2>
                <p className="text-slate-600 font-medium mt-1">Professional Educator</p>
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
            {/* Premium Basic Information */}
            <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-card-hover transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] via-teal-500/[0.02] to-cyan-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-lg" />
                    <User className="relative h-6 w-6 text-emerald-600" />
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
                    <div className="text-lg font-semibold text-slate-800">{fullName}</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Role</label>
                    <div>
                      <Badge variant="outline" className="bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300/50 text-blue-800 font-semibold shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse" />
                        Professional Teacher
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Premium Contact Information */}
            <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-card-hover transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/[0.02] via-cyan-500/[0.02] to-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="relative">
                    <div className="absolute inset-0 bg-teal-500/20 rounded-full blur-lg" />
                    <Mail className="relative h-6 w-6 text-teal-600" />
                  </div>
                  <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                    Contact Information
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group/email flex items-start gap-4 p-4 rounded-lg bg-gradient-to-r from-white/50 to-white/30 hover:from-teal-50/80 hover:to-cyan-50/60 border border-white/30 hover:border-teal-200/50 transition-all duration-300">
                    <div className="relative mt-1">
                      <div className="absolute inset-0 bg-teal-500/20 rounded-full blur-sm opacity-0 group-hover/email:opacity-100 transition-opacity duration-300" />
                      <Mail className="relative h-5 w-5 text-teal-500" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Email</label>
                      <div className="text-slate-800 font-medium mt-1">{teacher.email}</div>
                    </div>
                  </div>
                  {teacher.phone && (
                    <div className="group/phone flex items-start gap-4 p-4 rounded-lg bg-gradient-to-r from-white/50 to-white/30 hover:from-cyan-50/80 hover:to-blue-50/60 border border-white/30 hover:border-cyan-200/50 transition-all duration-300">
                      <div className="relative mt-1">
                        <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-sm opacity-0 group-hover/phone:opacity-100 transition-opacity duration-300" />
                        <Phone className="relative h-5 w-5 text-cyan-500" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Phone</label>
                        <div className="text-slate-800 font-medium mt-1">{teacher.phone}</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Premium Teaching Summary */}
            <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-card-hover transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.02] via-blue-500/[0.02] to-indigo-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-lg" />
                    <GraduationCap className="relative h-6 w-6 text-purple-600" />
                  </div>
                  <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                    Teaching Summary
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="group/stat text-center p-6 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 rounded-xl border border-blue-200/50 hover:border-blue-300/60 hover:shadow-glow-blue transition-all duration-300 hover:scale-105">
                    <div className="relative mx-auto w-12 h-12 mb-4">
                      <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-lg group-hover/stat:blur-xl transition-all duration-300" />
                      <BookOpen className="relative h-12 w-12 text-blue-600 mx-auto group-hover/stat:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
                      {teacher.classes?.length || 0}
                    </div>
                    <div className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Classes Assigned</div>
                  </div>
                  <div className="group/stat text-center p-6 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 rounded-xl border border-emerald-200/50 hover:border-emerald-300/60 hover:shadow-glow-green transition-all duration-300 hover:scale-105">
                    <div className="relative mx-auto w-12 h-12 mb-4">
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-lg group-hover/stat:blur-xl transition-all duration-300" />
                      <Users className="relative h-12 w-12 text-emerald-600 mx-auto group-hover/stat:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">
                      {totalStudents}
                    </div>
                    <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Total Students</div>
                  </div>
                  <div className="group/stat text-center p-6 bg-gradient-to-br from-purple-50/80 to-pink-50/60 rounded-xl border border-purple-200/50 hover:border-purple-300/60 hover:shadow-glow-purple transition-all duration-300 hover:scale-105">
                    <div className="relative mx-auto w-12 h-12 mb-4">
                      <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-lg group-hover/stat:blur-xl transition-all duration-300" />
                      <GraduationCap className="relative h-12 w-12 text-purple-600 mx-auto group-hover/stat:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent">
                      {totalCapacity}
                    </div>
                    <div className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Total Capacity</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Premium Class Assignments */}
            <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-card-hover transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.02] via-amber-500/[0.02] to-yellow-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="relative">
                    <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-lg" />
                    <BookOpen className="relative h-6 w-6 text-orange-600" />
                  </div>
                  <span className="bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                    Class Assignments
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                {teacher.classes && teacher.classes.length > 0 ? (
                  <div className="space-y-6">
                    {teacher.classes.map((cls, index) => (
                      <div
                        key={cls.id}
                        className="group/class p-6 border border-white/30 rounded-xl bg-gradient-to-r from-white/60 to-white/40 hover:from-orange-50/80 hover:to-amber-50/60 hover:border-orange-200/50 transition-all duration-300 hover:scale-102 animate-fade-in-up"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-bold text-lg text-slate-800 group-hover/class:text-orange-700 transition-colors duration-300">
                              {cls.class_name}
                            </h4>
                            {cls.grade_levels && (
                              <Badge variant="outline" className="mt-2 bg-gradient-to-r from-orange-100 to-amber-100 border-orange-300/50 text-orange-700 font-semibold">
                                {formatGradeLevel(cls.grade_levels.grade)}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Enrollment</div>
                            <div className="font-bold text-xl bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                              {cls.current_enrollment || 0} / {cls.max_capacity || 0}
                            </div>
                          </div>
                        </div>
                        <div className="relative">
                          <div className="bg-gradient-to-r from-slate-200 to-slate-100 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-orange-500 to-amber-500 h-3 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                              style={{
                                width: `${cls.max_capacity > 0 ? ((cls.current_enrollment || 0) / cls.max_capacity) * 100 : 0}%`
                              }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-transparent animate-shimmer" />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs font-medium text-slate-500 mt-2">
                            <span>0</span>
                            <span>{cls.max_capacity || 0}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="relative mx-auto w-16 h-16 mb-6">
                      <div className="absolute inset-0 bg-slate-200 rounded-full blur-lg" />
                      <BookOpen className="relative h-16 w-16 text-slate-400 mx-auto" />
                    </div>
                    <p className="text-slate-600 font-semibold text-lg">No classes assigned</p>
                    <p className="text-slate-400 text-sm mt-2">This teacher is not currently assigned to any classes</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Premium Record Information */}
            <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/80 via-white/60 to-white/40 border border-white/30 shadow-premium hover:shadow-card-hover transition-all duration-500">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-lg bg-gradient-to-r from-white/50 to-white/30 border border-white/30">
                    <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Created</label>
                    <div className="text-slate-800 font-medium mt-1">{new Date(teacher.created_at).toLocaleString()}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-r from-white/50 to-white/30 border border-white/30">
                    <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Last Updated</label>
                    <div className="text-slate-800 font-medium mt-1">{new Date(teacher.updated_at).toLocaleString()}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};