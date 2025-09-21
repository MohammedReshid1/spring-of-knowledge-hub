
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Users, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/hooks/useRoleAccess';

export const GradeTransition = () => {
  const [showPreview, setShowPreview] = useState(false);
  const queryClient = useQueryClient();
  const { isSuperAdmin, isAdmin } = useRoleAccess();

  // Only show to admin and super admin
  if (!isSuperAdmin && !isAdmin) {
    return null;
  }

  const { data: transitionPreview, isLoading: previewLoading } = useQuery({
    queryKey: ['grade-transition-preview'],
    queryFn: async () => {
      const { data, error } = await apiClient.getGradeTransitionPreview();
      if (error) throw new Error(error);
      // Ensure we return an array even if data is not an array
      return Array.isArray(data) ? data : [];
    },
    enabled: showPreview
  });

  const transitionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.executeGradeTransition();
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: (data) => {
      // The backend returns an object with results array, not just the array
      const results = data?.results || [];
      const transitioned = results.filter(item => item.status === 'Transitioned').length || 0;
      const graduated = results.filter(item => item.status === 'Graduated').length || 0;
      
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
      
      toast({
        title: "Grade Transition Completed",
        description: `${transitioned} students transitioned to next grade, ${graduated} students graduated.`,
      });
      
      setShowPreview(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to perform grade transition: " + error.message,
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
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ArrowRight className="h-5 w-5" />
          Manual Grade Transition
        </CardTitle>
        <p className="text-sm text-gray-600">
          Manually promote all active students to the next grade level
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            This action will move all active students to the next grade level. Grade 12 students will be marked as graduated.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => setShowPreview(!showPreview)}
            variant="outline"
            disabled={previewLoading}
          >
            {showPreview ? 'Hide Preview' : 'Preview Changes'}
          </Button>
          
          <Button
            onClick={handleTransition}
            disabled={transitionMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {transitionMutation.isPending ? 'Processing...' : 'Execute Grade Transition'}
          </Button>
        </div>

        {showPreview && transitionPreview && (
          <div className="mt-4 space-y-3">
            <h3 className="font-medium">Transition Preview:</h3>
            <div className="max-h-60 overflow-y-auto border rounded-lg p-3">
              {transitionPreview.map((student, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <span className="text-sm">{student.student_name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{student.current_grade}</Badge>
                    <ArrowRight className="h-3 w-3" />
                    <Badge variant={student.action === 'Will Graduate' ? 'destructive' : 'default'}>
                      {student.action === 'Will Graduate' ? 'Graduate' : student.next_grade}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
