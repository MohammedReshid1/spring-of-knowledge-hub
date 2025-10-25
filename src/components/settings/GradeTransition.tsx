
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Users, ArrowRight, CheckCircle, AlertTriangle, History, Calendar, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/contexts/RoleAccessContext';

interface TransitionPreview {
  student_id: string;
  student_name: string;
  current_grade: string;
  next_grade?: string;
  action: string;
}

interface TransitionHistory {
  id: string;
  academic_year: string;
  transition_date: string;
  students_transitioned: number;
  students_graduated: number;
  performed_by: string;
  notes: string;
  created_at: string;
}

export const GradeTransition = () => {
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const queryClient = useQueryClient();
  const { isSuperAdmin, isSuperSuperAdmin } = useRoleAccess();

  // Only show to superadmin and superadmin
  if (!isSuperSuperAdmin && !isSuperAdmin) {
    return (
      <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-red-50/50 border border-white/30 shadow-premium">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.02] via-pink-500/[0.02] to-red-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardHeader className="relative">
          <CardTitle className="text-xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-100 to-pink-100 border border-red-200/50">
              <Lock className="h-5 w-5 text-red-600" />
            </div>
            <span className="bg-gradient-to-r from-slate-900 via-red-800 to-pink-900 bg-clip-text text-transparent">
              Access Denied
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/50 rounded-xl p-6">
            <p className="text-red-900 font-medium">
              Only Super Administrators can access grade transitions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { data: transitionPreview, isLoading: previewLoading } = useQuery<TransitionPreview[]>({
    queryKey: ['grade-transition-preview'],
    queryFn: async () => {
      const { data, error } = await apiClient.getGradeTransitionPreview();
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
    enabled: showPreview
  });

  const { data: transitionHistory, isLoading: historyLoading } = useQuery<TransitionHistory[]>({
    queryKey: ['grade-transition-history'],
    queryFn: async () => {
      const { data, error } = await apiClient.getGradeTransitionHistory(10);
      if (error) throw new Error(error);
      return Array.isArray(data) ? data : [];
    },
    enabled: showHistory
  });

  const transitionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.executeGradeTransition();
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: (data) => {
      const transitioned = data?.students_transitioned || 0;
      const graduated = data?.students_graduated || 0;
      const totalProcessed = data?.total_processed || 0;

      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
      queryClient.invalidateQueries({ queryKey: ['grade-transition-history'] });
      queryClient.invalidateQueries({ queryKey: ['grade-transition-preview'] });

      toast({
        title: "Grade Transition Completed",
        description: `Successfully processed ${totalProcessed} students: ${transitioned} transitioned to next grade, ${graduated} graduated.`,
      });

      setShowPreview(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || "Unknown error occurred";
      toast({
        title: "Grade Transition Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleTransition = () => {
    if (confirm('Are you sure you want to transition all students to the next grade level? This action cannot be undone.')) {
      transitionMutation.mutate();
    }
  };

  return (
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }
      `}</style>

      <div className="space-y-6 animate-fadeInUp">
        {/* Main Card */}
        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-amber-50/50 border border-white/30 shadow-premium hover:shadow-lg transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.02] via-orange-500/[0.02] to-yellow-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <CardHeader className="relative">
            <CardTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200/50">
                <ArrowRight className="h-6 w-6 text-amber-600" />
              </div>
              <span className="bg-gradient-to-r from-slate-900 via-amber-800 to-orange-900 bg-clip-text text-transparent">
                Manual Grade Transition
              </span>
            </CardTitle>
            <p className="text-slate-600 leading-relaxed mt-2">
              Manually promote all active students to the next grade level
            </p>
          </CardHeader>

          <CardContent className="relative space-y-6">
            {/* Warning Alert */}
            <div className="bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 border border-yellow-200/50 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-lg animate-pulse" />
                  <div className="relative w-12 h-12 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-full flex items-center justify-center border border-yellow-200/50">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-yellow-900 mb-2">Important Notice</h3>
                  <p className="text-yellow-800 leading-relaxed">
                    This action will move all active students to the next grade level. Grade 12 students will be marked as graduated. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 flex-wrap">
              <Button
                onClick={() => setShowPreview(!showPreview)}
                variant="outline"
                disabled={previewLoading}
                className="border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-300 text-blue-700 hover:text-blue-900 rounded-xl py-3 px-6"
              >
                <Users className="h-4 w-4 mr-2" />
                {showPreview ? 'Hide Preview' : 'Preview Changes'}
              </Button>

              <Button
                onClick={() => setShowHistory(!showHistory)}
                variant="outline"
                disabled={historyLoading}
                className="border-2 border-purple-200 hover:border-purple-300 hover:bg-purple-50 transition-all duration-300 text-purple-700 hover:text-purple-900 rounded-xl py-3 px-6"
              >
                <History className="h-4 w-4 mr-2" />
                {showHistory ? 'Hide History' : 'View History'}
              </Button>

              <Button
                onClick={handleTransition}
                disabled={transitionMutation.isPending || previewLoading}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 py-3 px-8 rounded-xl"
              >
                {transitionMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Execute Grade Transition
                  </>
                )}
              </Button>
            </div>

            {/* Preview Section */}
            {showPreview && transitionPreview && (
              <Card className="backdrop-blur-glass bg-white/60 border border-white/40 shadow-md">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Transition Preview <span className="text-blue-600">({transitionPreview.length} students)</span>
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="bg-gradient-to-r from-emerald-100 to-green-100 border-emerald-300/50 text-emerald-800 font-semibold shadow-sm">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {transitionPreview.filter(s => s.action === 'Will Transition').length} to transition
                      </Badge>
                      <Badge className="bg-gradient-to-r from-red-100 to-pink-100 border-red-300/50 text-red-800 font-semibold shadow-sm">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {transitionPreview.filter(s => s.action === 'Will Graduate').length} to graduate
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto border border-white/40 rounded-xl">
                    {transitionPreview.length === 0 ? (
                      <div className="p-8 text-center">
                        <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No active students to transition</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/40">
                        {transitionPreview.map((student, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-blue-50/30 hover:via-indigo-50/20 hover:to-purple-50/30 transition-all duration-300"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <span className="text-sm font-semibold text-slate-800">{student.student_name}</span>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="bg-white/80 border-slate-300 text-slate-700 font-medium">
                                {student.current_grade}
                              </Badge>
                              <ArrowRight className="h-4 w-4 text-slate-400" />
                              <Badge
                                variant={student.action === 'Will Graduate' ? 'destructive' : 'default'}
                                className={student.action === 'Will Graduate'
                                  ? 'bg-gradient-to-r from-red-100 to-pink-100 border-red-300/50 text-red-800 font-semibold'
                                  : 'bg-gradient-to-r from-emerald-100 to-green-100 border-emerald-300/50 text-emerald-800 font-semibold'}
                              >
                                {student.action === 'Will Graduate' ? 'Graduate' : student.next_grade}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* History Section */}
            {showHistory && transitionHistory && (
              <Card className="backdrop-blur-glass bg-white/60 border border-white/40 shadow-md">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200/50">
                      <History className="h-5 w-5 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Transition History</h3>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto border border-white/40 rounded-xl">
                    {transitionHistory.length === 0 ? (
                      <div className="p-8 text-center">
                        <History className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No transition history available</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/40">
                        {transitionHistory.map((history, index) => (
                          <div
                            key={history.id}
                            className="p-5 hover:bg-gradient-to-r hover:from-purple-50/30 hover:via-pink-50/20 hover:to-indigo-50/30 transition-all duration-300"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50">
                                    <Calendar className="h-4 w-4 text-slate-600" />
                                  </div>
                                  <span className="font-bold text-slate-900">{history.academic_year}</span>
                                  <Badge variant="outline" className="text-xs bg-white/80 border-slate-300 text-slate-700">
                                    {new Date(history.transition_date).toLocaleDateString()}
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed ml-12">{history.notes}</p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge className="bg-gradient-to-r from-emerald-100 to-green-100 border-emerald-300/50 text-emerald-800 font-semibold shadow-sm">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  {history.students_transitioned} transitioned
                                </Badge>
                                {history.students_graduated > 0 && (
                                  <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300/50 text-blue-800 font-semibold shadow-sm">
                                    <Users className="h-3 w-3 mr-1" />
                                    {history.students_graduated} graduated
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};
