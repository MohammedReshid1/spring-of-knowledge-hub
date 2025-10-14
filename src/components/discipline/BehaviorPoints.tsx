import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useStudentNames } from '@/hooks/useStudentName';
import { useUserNames } from '@/hooks/useUserNames';
import { StudentSearchInput } from '@/components/ui/student-search-input';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, Plus, Award, Minus, Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';

export const BehaviorPoints: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<'award' | 'deduct'>('award');
  const [viewPoint, setViewPoint] = useState<any>(null);
  const [editPoint, setEditPoint] = useState<any>(null);
  const [formData, setFormData] = useState({
    student_id: '',
    point_type: 'positive',
    points: 0,
    category: '',
    reason: '',
    description: '',
    date_awarded: new Date().toISOString().slice(0, 10),
  });
  const { getStudentName } = useStudentNames();
  const { getUserName } = useUserNames();

  const { selectedBranch, isHQRole } = useBranch();

  const { data: points = [], isLoading } = useQuery({
    queryKey: ['behavior-points', selectedBranch],
    queryFn: async () => {
      const response = await apiClient.getBehaviorPoints({
        branch_id: isHQRole && selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
      });
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data || [];
    },
    enabled: !isHQRole || !!selectedBranch,
  });

  const deletePointMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteBehaviorPoint(id);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Behavior point deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['behavior-points'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete behavior point');
    },
  });

  const updatePointMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.updateBehaviorPoint(id, data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Behavior point updated successfully');
      queryClient.invalidateQueries({ queryKey: ['behavior-points'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
      handleCloseEditForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update behavior point');
    },
  });

  const createPointMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.createBehaviorPoint(data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Behavior point created successfully');
      queryClient.invalidateQueries({ queryKey: ['behavior-points'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
      handleCloseCreateForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create behavior point');
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this behavior point record?')) {
      deletePointMutation.mutate(id);
    }
  };

  const handleView = (point: any) => {
    setViewPoint(point);
    setShowViewModal(true);
  };

  const handleEdit = (point: any) => {
    setEditPoint(point);
    setFormData({
      student_id: point.student_id,
      point_type: point.point_type,
      points: point.points,
      category: point.category,
      reason: point.reason,
      description: point.description || '',
      date_awarded: point.date_awarded ? new Date(point.date_awarded).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setShowEditModal(true);
  };

  const handleCloseEditForm = () => {
    setShowEditModal(false);
    setEditPoint(null);
    setFormData({
      student_id: '',
      point_type: 'positive',
      points: 0,
      category: '',
      reason: '',
      description: '',
      date_awarded: new Date().toISOString().slice(0, 10),
    });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editPoint) {
      const dataWithUser = {
        ...formData,
        awarded_by: user?.id || user?.email || 'admin',
      };
      updatePointMutation.mutate({ id: editPoint.id, data: dataWithUser });
    }
  };

  const handleOpenCreateForm = (mode: 'award' | 'deduct') => {
    setCreateMode(mode);
    setFormData({
      student_id: '',
      point_type: mode === 'award' ? 'positive' : 'negative',
      points: 0,
      category: '',
      reason: '',
      description: '',
      date_awarded: new Date().toISOString().slice(0, 10), // Date only format
    });
    setShowCreateModal(true);
  };

  const handleCloseCreateForm = () => {
    setShowCreateModal(false);
    setFormData({
      student_id: '',
      point_type: 'positive',
      points: 0,
      category: '',
      reason: '',
      description: '',
      date_awarded: new Date().toISOString().slice(0, 10),
    });
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithUser = {
      ...formData,
      awarded_by: user?.id || user?.email || 'admin',
      ...(isHQRole && selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
    };
    if (isHQRole && (!selectedBranch || selectedBranch === 'all')) {
      toast.error('Please select a specific branch before creating a record');
      return;
    }
    createPointMutation.mutate(dataWithUser);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading behavior points...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Behavior Points</h2>
        <div className="flex gap-2">
          <Button onClick={() => handleOpenCreateForm('award')}>
            <Plus className="h-4 w-4 mr-2" />
            <Award className="h-4 w-4 mr-1" />
            Award Points
          </Button>
          <Button variant="outline" onClick={() => handleOpenCreateForm('deduct')}>
            <Minus className="h-4 w-4 mr-2" />
            Deduct Points
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search behavior points..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {points.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No behavior points recorded yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Award positive points for good behavior, deduct for violations
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {points.filter((point: any) => 
            point.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            point.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            point.category?.toLowerCase().includes(searchTerm.toLowerCase())
          ).map((point: any) => (
            <Card key={point.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {getStudentName(point.student_id)}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      ID: {point.student_id}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {point.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={point.point_type === 'positive' ? 'default' : 'destructive'}>
                      {point.point_type === 'positive' ? '+' : '-'}{point.points} points
                    </Badge>
                    <Badge variant="outline">{point.category}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm text-muted-foreground mb-3">
                  <span>Awarded by: {getUserName(point.awarded_by)}</span>
                  <span>{new Date(point.date_awarded).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleView(point)}
                    className="flex-1"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(point)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(point.id)}
                    className="flex-1"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && viewPoint && (
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Behavior Point Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">
                    {getStudentName(viewPoint.student_id)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    ID: {viewPoint.student_id}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={viewPoint.point_type === 'positive' ? 'default' : 'destructive'}>
                    {viewPoint.point_type === 'positive' ? '+' : '-'}{viewPoint.points} points
                  </Badge>
                  <Badge variant="outline">{viewPoint.category}</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Reason</Label>
                  <p className="mt-1">{viewPoint.reason}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <p className="capitalize">{viewPoint.point_type}</p>
                  </div>
                  <div>
                    <Label>Points</Label>
                    <p>{viewPoint.points}</p>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <p>{viewPoint.category}</p>
                  </div>
                  <div>
                    <Label>Date Awarded</Label>
                    <p>{new Date(viewPoint.date_awarded).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label>Awarded By</Label>
                    <p>{getUserName(viewPoint.awarded_by)}</p>
                  </div>
                  <div>
                    <Label>Created At</Label>
                    <p>{new Date(viewPoint.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {viewPoint.description && (
                  <div>
                    <Label>Description</Label>
                    <p className="mt-1">{viewPoint.description}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(viewPoint);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowViewModal(false);
                    handleDelete(viewPoint.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Form Modal */}
      {showEditModal && editPoint && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Behavior Point</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <StudentSearchInput
                  value={formData.student_id}
                  onChange={(studentId) => setFormData(prev => ({ ...prev, student_id: studentId }))}
                  label="Student"
                  placeholder="Type student name or ID"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-type">Point Type *</Label>
                <select
                  id="edit-type"
                  value={formData.point_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, point_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="positive">Positive</option>
                  <option value="negative">Negative</option>
                </select>
              </div>

              <div>
                <Label htmlFor="edit-points">Points *</Label>
                <Input
                  id="edit-points"
                  type="number"
                  value={formData.points}
                  onChange={(e) => setFormData(prev => ({ ...prev, points: parseInt(e.target.value) }))}
                  min="1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-category">Category *</Label>
                <select
                  id="edit-category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="">Select category...</option>
                  <option value="academic">Academic</option>
                  <option value="behavioral">Behavioral</option>
                  <option value="attendance">Attendance</option>
                  <option value="participation">Participation</option>
                  <option value="leadership">Leadership</option>
                  <option value="respect">Respect</option>
                  <option value="responsibility">Responsibility</option>
                  <option value="safety">Safety</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="edit-reason">Reason *</Label>
                <Input
                  id="edit-reason"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Brief reason for points"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description (optional)"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="edit-date">Date Awarded *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={formData.date_awarded}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_awarded: e.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseEditForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updatePointMutation.isPending}>
                  {updatePointMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Form Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {createMode === 'award' ? 'Award Behavior Points' : 'Deduct Behavior Points'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div>
                <StudentSearchInput
                  value={formData.student_id}
                  onChange={(studentId) => setFormData(prev => ({ ...prev, student_id: studentId }))}
                  label="Student"
                  placeholder="Type student name or ID"
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-points">Points *</Label>
                <Input
                  id="create-points"
                  type="number"
                  value={formData.points}
                  onChange={(e) => setFormData(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                  min="1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-category">Category *</Label>
                <select
                  id="create-category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="">Select category...</option>
                  <option value="academic">Academic</option>
                  <option value="behavioral">Behavioral</option>
                  <option value="attendance">Attendance</option>
                  <option value="participation">Participation</option>
                  <option value="leadership">Leadership</option>
                  <option value="respect">Respect</option>
                  <option value="responsibility">Responsibility</option>
                  <option value="safety">Safety</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="create-reason">Reason *</Label>
                <Input
                  id="create-reason"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder={createMode === 'award' ? 'Reason for awarding points' : 'Reason for deducting points'}
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-description">Description</Label>
                <Textarea
                  id="create-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description (optional)"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="create-date">Date *</Label>
                <Input
                  id="create-date"
                  type="date"
                  value={formData.date_awarded}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_awarded: e.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseCreateForm}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPointMutation.isPending}
                  variant={createMode === 'award' ? 'default' : 'destructive'}
                >
                  {createPointMutation.isPending ? 'Saving...' : (createMode === 'award' ? 'Award Points' : 'Deduct Points')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
