import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DuplicateClass {
  class_name: string;
  duplicate_count: number;
  class_ids: string[];
}

export const DuplicateClassCleaner = () => {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const queryClient = useQueryClient();

  const { data: duplicateClasses, isLoading } = useQuery({
    queryKey: ['duplicate-classes'],
    queryFn: async () => {
      // Get all classes
      const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('id, class_name');
        
      if (classError) throw classError;
      
      // Group by class name
      const grouped = classes?.reduce((acc: Record<string, string[]>, cls) => {
        if (!acc[cls.class_name]) acc[cls.class_name] = [];
        acc[cls.class_name].push(cls.id);
        return acc;
      }, {}) || {};
      
      // Filter duplicates
      const duplicates: DuplicateClass[] = [];
      for (const [className, ids] of Object.entries(grouped)) {
        if (ids.length > 1) {
          duplicates.push({
            class_name: className,
            duplicate_count: ids.length,
            class_ids: ids
          });
        }
      }
      
      return duplicates.sort((a, b) => b.duplicate_count - a.duplicate_count);
    }
  });

  const cleanupMutation = useMutation({
    mutationFn: async (duplicates: DuplicateClass[]) => {
      let totalCleaned = 0;
      
      for (const duplicate of duplicates) {
        const { class_name, class_ids } = duplicate;
        
        // Keep the first class as the main one
        const mainClassId = class_ids[0];
        const duplicateIds = class_ids.slice(1);
        
        // Move all students from duplicate classes to the main class
        for (const duplicateId of duplicateIds) {
          // Get students in this duplicate class
          const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('id')
            .eq('class_id', duplicateId);
            
          if (studentsError) {
            console.error(`Error fetching students for class ${duplicateId}:`, studentsError);
            continue;
          }
          
          // Move students to main class
          if (students && students.length > 0) {
            const { error: updateError } = await supabase
              .from('students')
              .update({ class_id: mainClassId })
              .in('id', students.map(s => s.id));
              
            if (updateError) {
              console.error(`Error moving students from ${duplicateId} to ${mainClassId}:`, updateError);
              continue;
            }
          }
          
          // Delete the duplicate class
          const { error: deleteError } = await supabase
            .from('classes')
            .delete()
            .eq('id', duplicateId);
            
          if (deleteError) {
            console.error(`Error deleting duplicate class ${duplicateId}:`, deleteError);
          } else {
            totalCleaned++;
          }
        }
      }
      
      return totalCleaned;
    },
    onSuccess: (cleanedCount) => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['grade-stats'] });
      
      toast({
        title: "Cleanup Complete",
        description: `Removed ${cleanedCount} duplicate classes and consolidated students`,
      });
    },
    onError: (error) => {
      toast({
        title: "Cleanup Error",
        description: "Failed to clean up duplicate classes: " + error.message,
        variant: "destructive",
      });
    }
  });

  const handleCleanup = async () => {
    if (!duplicateClasses || duplicateClasses.length === 0) return;
    
    setIsCleaningUp(true);
    await cleanupMutation.mutateAsync(duplicateClasses);
    setIsCleaningUp(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">Checking for duplicate classes...</div>
        </CardContent>
      </Card>
    );
  }

  if (!duplicateClasses || duplicateClasses.length === 0) {
    return null; // Don't show if no duplicates
  }

  const totalDuplicates = duplicateClasses.reduce((sum, dup) => sum + dup.duplicate_count - 1, 0);

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Duplicate Classes Detected
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Found {totalDuplicates} duplicate classes that need to be consolidated
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="max-h-48 overflow-y-auto space-y-2">
            {duplicateClasses.slice(0, 10).map((duplicate) => (
              <div key={duplicate.class_name} className="flex items-center justify-between p-2 bg-white rounded border">
                <div>
                  <p className="font-medium">{duplicate.class_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {duplicate.duplicate_count} duplicate classes
                  </p>
                </div>
                <Badge variant="destructive">
                  {duplicate.duplicate_count - 1} extras
                </Badge>
              </div>
            ))}
            {duplicateClasses.length > 10 && (
              <p className="text-sm text-muted-foreground text-center">
                ...and {duplicateClasses.length - 10} more
              </p>
            )}
          </div>
          
          <div className="flex items-center justify-between p-4 bg-orange-100 rounded-lg">
            <div>
              <p className="font-medium">Consolidate Duplicate Classes</p>
              <p className="text-sm text-muted-foreground">
                This will merge students from duplicate classes and remove empty duplicates
              </p>
            </div>
            <Button
              onClick={handleCleanup}
              disabled={isCleaningUp}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isCleaningUp ? 'Cleaning...' : `Clean Up (${totalDuplicates})`}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
