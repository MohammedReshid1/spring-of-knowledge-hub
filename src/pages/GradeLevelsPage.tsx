import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, GraduationCap, Users, BookOpen, TrendingUp, Award, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface GradeLevel {
  id: string;
  grade: string;
  max_capacity: number;
  current_enrollment: number;
  created_at: string;
  updated_at: string;
}

interface GradeLevelCreate {
  grade: string;
}

export default function GradeLevelsPage() {
  const { selectedBranch } = useBranch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingGradeLevel, setEditingGradeLevel] = useState<GradeLevel | null>(null);
  const [formData, setFormData] = useState<GradeLevelCreate>({
    grade: '',
  });

  // Fetch grade levels
  const { data: gradeLevels = [], isLoading } = useQuery({
    queryKey: ['grade-levels', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.get('/grade-levels');
      if (error) {
        console.error('Error fetching grade levels:', error);
        return [];
      }
      return data || [];
    },
  });

  // Fetch students to compute real enrollment counts
  const { data: allStudents = [] } = useQuery({
    queryKey: ['students', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getAllStudents(selectedBranch);
      if (error) {
        console.error('Error fetching students:', error);
        return [];
      }
      return data || [];
    },
  });

  // Fetch classes to compute capacity
  const { data: allClasses = [] } = useQuery({
    queryKey: ['classes', selectedBranch],
    queryFn: async () => {
      const { data, error } = await apiClient.getClasses();
      if (error) {
        console.error('Error fetching classes:', error);
        return [];
      }
      return data || [];
    },
  });

  // Helper function to compute real enrollment and capacity for a grade level
  const getGradeLevelStats = (gradeLevel: GradeLevel) => {
    // Filter classes for this grade level
    const gradeClasses = allClasses.filter(cls => cls.grade_level_id === gradeLevel.id);
    
    // Calculate total capacity from all classes for this grade
    const totalCapacity = gradeClasses.reduce((sum, cls) => sum + (cls.max_capacity || 0), 0);
    
    // Calculate current enrollment by counting students in classes for this grade
    const enrolledStudents = allStudents.filter(student => {
      if (!student.class_id) return false;
      return gradeClasses.some(cls => cls.id === student.class_id);
    });
    
    return {
      currentEnrollment: enrolledStudents.length,
      maxCapacity: totalCapacity || gradeLevel.max_capacity, // Fallback to grade level max if no classes
    };
  };

  // Create grade level mutation
  const createMutation = useMutation({
    mutationFn: async (data: GradeLevelCreate) => {
      const { data: result, error } = await apiClient.post('/grade-levels', data);
      if (error) throw new Error(error.message || 'Failed to create grade level');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      setIsCreateDialogOpen(false);
      setFormData({
        grade: '',
      });
      toast({
        title: 'Success',
        description: 'Grade level created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update grade level mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: GradeLevelCreate }) => {
      const { data: result, error } = await apiClient.put(`/grade-levels/${id}`, data);
      if (error) throw new Error(error.message || 'Failed to update grade level');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      setEditingGradeLevel(null);
      toast({
        title: 'Success',
        description: 'Grade level updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete grade level mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.delete(`/grade-levels/${id}`);
      if (error) throw new Error(error.message || 'Failed to delete grade level');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      toast({
        title: 'Success',
        description: 'Grade level deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGradeLevel) {
      updateMutation.mutate({ id: editingGradeLevel.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (gradeLevel: GradeLevel) => {
    setEditingGradeLevel(gradeLevel);
    setFormData({
      grade: gradeLevel.grade,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this grade level?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Premium Loading Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-100/30"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-blue-500/6 to-indigo-500/8 animate-gradient-shift bg-[length:400%_400%] pointer-events-none"></div>
        </div>

        <div className="relative z-10 flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full border-4 border-blue-200 mx-auto"></div>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 h-16 w-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-glass border border-white/30 shadow-premium inline-block">
              <p className="text-slate-700 font-semibold text-lg mb-2">Loading Grade Levels...</p>
              <p className="text-slate-500">Please wait while we fetch your data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 pb-20 pt-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-blue-700/90 to-indigo-800/90" />
        <div className="absolute inset-0 opacity-20"
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
             }} />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center rounded-full bg-white/10 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white/90 ring-1 ring-white/20">
              <Award className="mr-2 h-4 w-4" />
              Educational Structure System
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Grade <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">Levels</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              Manage academic grade levels with comprehensive enrollment tracking, capacity analytics, and class distribution.
              Optimize your educational structure with premium management tools.
            </p>
          </div>
        </div>

        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-20 fill-current text-slate-50" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z" />
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 -mt-10 space-y-8 px-6 pb-16">
        {/* Action Bar */}
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
              <p className="text-sm text-gray-600">Manage grade levels efficiently with powerful tools</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                    Add Grade Level
                  </Button>
                </DialogTrigger>
                  <DialogContent className="bg-white/95 backdrop-blur-glass border-0 shadow-2xl overflow-hidden max-w-md">
                    {/* Premium Background Effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-blue-50/60 to-indigo-50/80 pointer-events-none"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-blue-500/6 to-indigo-500/8 pointer-events-none"></div>

                    {/* Floating orbs */}
                    <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-r from-blue-200/20 to-indigo-200/20 rounded-full blur-xl animate-float pointer-events-none"></div>

                    <div className="relative">
                      <DialogHeader className="p-6 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                            <GraduationCap className="h-5 w-5 text-blue-600" />
                          </div>
                          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                            Create Grade Level
                          </DialogTitle>
                        </div>
                      </DialogHeader>

                      <form onSubmit={handleSubmit} className="space-y-6 p-6 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="grade" className="text-sm font-semibold text-slate-700">Grade Level Name</Label>
                          <Input
                            id="grade"
                            value={formData.grade}
                            onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                            placeholder="e.g., Grade 1, KG1, Pre-K, etc."
                            className="bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl focus:bg-white/80 focus:border-blue-300 transition-all duration-normal h-12"
                            required
                          />
                        </div>
                        <div className="flex justify-end space-x-3 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCreateDialogOpen(false)}
                            className="bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-white/80 hover:border-slate-300 transition-all duration-normal rounded-xl px-6"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-6 rounded-xl shadow-premium hover:shadow-xl hover:scale-105 transition-all duration-normal border-0"
                          >
                            {createMutation.isPending ? 'Creating...' : 'Create'}
                          </Button>
                        </div>
                      </form>
                    </div>
                  </DialogContent>
                </Dialog>
            </div>
          </div>
        </div>

        {gradeLevels.length === 0 ? (
          <div className="mx-auto max-w-7xl">
            <div className="relative">
              {/* Background card with glass morphism */}
              <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-blue-500/8 to-indigo-500/8 rounded-3xl pointer-events-none"></div>

              <Card className="relative bg-transparent border-0 shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="text-center space-y-6">
                  <div className="relative">
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-100/80 to-gray-100/80 border border-slate-200/50 inline-flex shadow-premium">
                      <GraduationCap className="h-16 w-16 text-slate-400" />
                    </div>
                    <div className="absolute -top-2 -right-2 p-2 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50 shadow-premium">
                      <Plus className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                      No Grade Levels Found
                    </h3>
                    <p className="text-slate-600 text-lg leading-relaxed max-w-md mx-auto">
                      Start building your academic structure by creating your first grade level
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl shadow-premium hover:shadow-xl hover:scale-105 transition-all duration-normal border-0 mt-6"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Grade Level
                  </Button>
                </div>
              </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl">
            <div className="relative">
              {/* Background card with glass morphism */}
              <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-blue-500/8 to-indigo-500/8 rounded-3xl pointer-events-none"></div>

              <Card className="relative bg-transparent border-0 shadow-none">
              <CardHeader className="p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                    Grade Level Overview ({gradeLevels.length})
                  </CardTitle>
                </div>
                <p className="text-slate-600 leading-relaxed">Academic structure with real-time enrollment tracking and capacity analytics</p>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {gradeLevels.map((gradeLevel: GradeLevel, index) => {
                    const stats = getGradeLevelStats(gradeLevel);
                    const percentage = stats.maxCapacity > 0 ? (stats.currentEnrollment / stats.maxCapacity) * 100 : 0;
                    const isNearCapacity = percentage >= 80;
                    const isFull = percentage >= 95;

                    return (
                      <div
                        key={gradeLevel.id}
                        className="group relative animate-fade-in-up"
                        style={{
                          animationDelay: `${index * 100}ms`,
                          animationFillMode: 'both'
                        }}
                      >
                        {/* Premium card with glass morphism */}
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-premium group-hover:shadow-xl group-hover:scale-105 transition-all duration-normal"></div>
                        <div className={`absolute inset-0 rounded-2xl transition-all duration-normal ${
                          isFull ? 'bg-gradient-to-br from-red-50/80 to-rose-50/80 border border-red-200/50' :
                          isNearCapacity ? 'bg-gradient-to-br from-amber-50/80 to-yellow-50/80 border border-amber-200/50' :
                          'bg-gradient-to-br from-emerald-50/80 to-green-50/80 border border-emerald-200/50'
                        }`}></div>

                        <div className="relative p-6 space-y-6">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl transition-all duration-normal ${
                                isFull ? 'bg-red-100 border border-red-200' :
                                isNearCapacity ? 'bg-amber-100 border border-amber-200' :
                                'bg-emerald-100 border border-emerald-200'
                              }`}>
                                <GraduationCap className={`h-5 w-5 ${
                                  isFull ? 'text-red-600' :
                                  isNearCapacity ? 'text-amber-600' :
                                  'text-emerald-600'
                                }`} />
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 text-lg">
                                  {gradeLevel.grade}
                                </h3>
                                <p className="text-sm text-slate-600 font-medium">
                                  Capacity: {gradeLevel.current_enrollment}/{gradeLevel.max_capacity}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(gradeLevel)}
                                className="p-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 hover:scale-110 transition-all duration-normal"
                                title="Edit Grade Level"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(gradeLevel.id)}
                                className="p-2 rounded-xl bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-red-50 hover:border-red-200 hover:text-red-600 hover:scale-110 transition-all duration-normal"
                                title="Delete Grade Level"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Enrollment Stats */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white/60 border border-white/40">
                                  <Users className="h-4 w-4 text-slate-600" />
                                </div>
                                <div>
                                  <span className={`text-2xl font-bold ${
                                    isFull ? 'text-red-600' :
                                    isNearCapacity ? 'text-amber-600' :
                                    'text-emerald-600'
                                  }`}>
                                    {stats.currentEnrollment}
                                  </span>
                                  <span className="text-sm text-slate-500 ml-1">/ {stats.maxCapacity}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isFull ? (
                                  <AlertCircle className="h-5 w-5 text-red-600" />
                                ) : isNearCapacity ? (
                                  <AlertCircle className="h-5 w-5 text-amber-600" />
                                ) : (
                                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                                )}
                                <Badge className={`font-semibold ${
                                  isFull ? 'bg-red-100 text-red-800 border-red-200' :
                                  isNearCapacity ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                  'bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`} variant="outline">
                                  {Math.round(percentage)}%
                                </Badge>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Progress value={percentage} className="h-3" />
                              <p className="text-sm text-slate-600 font-medium">
                                {stats.maxCapacity - stats.currentEnrollment} spots available
                              </p>
                            </div>
                          </div>

                          {/* Quick Stats */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-white/40 backdrop-blur-sm border border-white/30">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-slate-600" />
                                <span className="text-xs font-semibold text-slate-700">Created</span>
                              </div>
                              <p className="text-sm font-bold text-slate-900 mt-1">
                                {new Date(gradeLevel.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/40 backdrop-blur-sm border border-white/30">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-slate-600" />
                                <span className="text-xs font-semibold text-slate-700">Utilization</span>
                              </div>
                              <p className={`text-sm font-bold mt-1 ${
                                isFull ? 'text-red-600' :
                                isNearCapacity ? 'text-amber-600' :
                                'text-emerald-600'
                              }`}>
                                {percentage > 0 ? `${Math.round(percentage)}%` : '0%'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
          </div>
        )}

        {/* Edit Dialog */}
        {editingGradeLevel && (
          <Dialog open={true} onOpenChange={() => setEditingGradeLevel(null)}>
            <DialogContent className="bg-white/95 backdrop-blur-glass border-0 shadow-2xl overflow-hidden max-w-md">
              {/* Premium Background Effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-indigo-50/60 to-purple-50/80 pointer-events-none"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-indigo-500/6 to-purple-500/8 pointer-events-none"></div>

              {/* Floating orbs */}
              <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-r from-blue-200/20 to-indigo-200/20 rounded-full blur-xl animate-float pointer-events-none"></div>

              <div className="relative">
                <DialogHeader className="p-6 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50">
                      <Edit className="h-5 w-5 text-blue-600" />
                    </div>
                    <DialogTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                      Edit Grade Level
                    </DialogTitle>
                  </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 p-6 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit_grade" className="text-sm font-semibold text-slate-700">Grade Level Name</Label>
                    <Input
                      id="edit_grade"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      className="bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl focus:bg-white/80 focus:border-blue-300 transition-all duration-normal h-12"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingGradeLevel(null)}
                      className="bg-white/60 backdrop-blur-sm border border-white/40 hover:bg-white/80 hover:border-slate-300 transition-all duration-normal rounded-xl px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-6 rounded-xl shadow-premium hover:shadow-xl hover:scale-105 transition-all duration-normal border-0"
                    >
                      {updateMutation.isPending ? 'Updating...' : 'Update'}
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}