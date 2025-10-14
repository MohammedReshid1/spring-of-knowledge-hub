import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SubjectAPI, SubjectCreate } from '@/services/subjectApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { usePermissionCheck } from '@/contexts/RoleAccessContext';
import {
  Plus,
  Edit3,
  Trash2,
  Search,
  BookOpen,
  AlertTriangle,
  GraduationCap,
  FileText
} from 'lucide-react';
import SubjectForm from './SubjectForm';
import type { Subject } from '@/types/api';
import { useLiveData } from '@/hooks/useLiveData';
import { LiveUpdatesIndicator } from '@/components/common/LiveUpdatesIndicator';

export const SubjectManagement: React.FC = () => {
  const { hasPermission } = usePermissionCheck();
  const queryClient = useQueryClient();

  // Enable real-time updates for subject management
  useLiveData(['subjects', 'classes', 'grade-levels'], {
    additionalQueryKeys: ['subject-assignments', 'subject-stats']
  });

  // Permissions
  const canCreate = hasPermission('subject.create') || hasPermission('subject.manage');
  const canUpdate = hasPermission('subject.update') || hasPermission('subject.manage');
  const canDelete = hasPermission('subject.delete') || hasPermission('subject.manage');
  const canView = hasPermission('subject.read') || hasPermission('subject.manage');

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  // Fetch subjects
  const { data: subjects = [], isLoading, error } = useQuery({
    queryKey: ['subjects'],
    queryFn: SubjectAPI.getAll,
    enabled: canView
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: SubjectAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setShowForm(false);
      toast({
        title: 'Success',
        description: 'Subject created successfully'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create subject',
        variant: 'destructive'
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubjectCreate }) =>
      SubjectAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setShowForm(false);
      setEditingSubject(undefined);
      toast({
        title: 'Success',
        description: 'Subject updated successfully'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update subject',
        variant: 'destructive'
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: SubjectAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setDeleteDialogOpen(false);
      setSubjectToDelete(null);
      toast({
        title: 'Success',
        description: 'Subject deleted successfully'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete subject. It may be in use.',
        variant: 'destructive'
      });
    }
  });

  // Handlers
  const handleCreate = () => {
    setEditingSubject(undefined);
    setShowForm(true);
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setShowForm(true);
  };

  const handleDelete = (subject: Subject) => {
    setSubjectToDelete(subject);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (subjectToDelete) {
      deleteMutation.mutate(subjectToDelete.id);
    }
  };

  const handleSubmit = (data: SubjectCreate) => {
    if (editingSubject) {
      updateMutation.mutate({ id: editingSubject.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filter subjects based on search
  const filteredSubjects = subjects.filter((subject) => {
    const query = searchQuery.toLowerCase();
    return (
      subject.subject_name.toLowerCase().includes(query) ||
      subject.subject_code.toLowerCase().includes(query) ||
      subject.description?.toLowerCase().includes(query) ||
      subject.grade_levels.some((grade) => grade.toLowerCase().includes(query))
    );
  });

  // Permission check
  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">
              You don't have permission to view subjects.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative bg-gradient-to-r from-purple-600 to-indigo-800 rounded-xl p-8 text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full animate-pulse"></div>
          <div className="absolute top-20 -right-16 w-64 h-64 bg-white/5 rounded-full animate-bounce"></div>
          <div className="absolute -bottom-8 left-1/3 w-32 h-32 bg-white/10 rounded-full animate-pulse"></div>
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Subject Management</h1>
          <p className="text-purple-100 text-lg">
            Manage subjects, codes, and grade level assignments
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, or grade level..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <LiveUpdatesIndicator />
          {canCreate && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Subject
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookOpen className="h-5 w-5 mr-2" />
            Subjects ({filteredSubjects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading subjects...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <p className="text-red-600 font-semibold mb-2">Failed to load subjects</p>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'No subjects found' : 'No subjects yet'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Get started by creating your first subject'}
              </p>
              {canCreate && !searchQuery && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Subject
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Code</TableHead>
                    <TableHead className="min-w-[200px]">Subject Name</TableHead>
                    <TableHead className="min-w-[250px]">Description</TableHead>
                    <TableHead className="min-w-[200px]">Grade Levels</TableHead>
                    {(canUpdate || canDelete) && (
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {subject.subject_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {subject.subject_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {subject.description || (
                          <span className="italic text-gray-400">No description</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {subject.grade_levels.map((grade) => (
                            <Badge key={grade} variant="outline" className="text-xs">
                              <GraduationCap className="h-3 w-3 mr-1" />
                              {grade}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      {(canUpdate || canDelete) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(subject)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(subject)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subject Form Dialog */}
      <SubjectForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) {
            setEditingSubject(undefined);
          }
        }}
        onSubmit={handleSubmit}
        initialData={editingSubject}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">
                {subjectToDelete?.subject_name}
              </span>{' '}
              ({subjectToDelete?.subject_code})?
              <br />
              <br />
              This action cannot be undone. This subject may be assigned to classes
              and students.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SubjectManagement;
