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
import { Search, Plus, Award, Gift, Trophy, Trash2, Eye, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';

export const RewardManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewReward, setViewReward] = useState<any>(null);
  const [editReward, setEditReward] = useState<any>(null);
  const [formData, setFormData] = useState({
    student_id: '',
    title: '',
    description: '',
    reward_type: 'certificate',
    category: 'academic_excellence',
    criteria_met: '',
    points_required: 0,
    date_awarded: new Date().toISOString().slice(0, 10),
    is_public: true,
  });
  const { getStudentName } = useStudentNames();
  const { getUserName } = useUserNames();

  const { selectedBranch, isHQRole } = useBranch();

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ['rewards', selectedBranch],
    queryFn: async () => {
      const response = await apiClient.getRewards({
        branch_id: isHQRole && selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
      });
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data || [];
    },
    enabled: !isHQRole || !!selectedBranch,
  });

  const deleteRewardMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteReward(id);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Reward deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete reward');
    },
  });

  const updateRewardMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.updateReward(id, data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Reward updated successfully');
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
      handleCloseEditForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update reward');
    },
  });

  const createRewardMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.createReward(data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Reward given successfully');
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
      handleCloseCreateForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to give reward');
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this reward?')) {
      deleteRewardMutation.mutate(id);
    }
  };

  const handleView = (reward: any) => {
    setViewReward(reward);
    setShowViewModal(true);
  };

  const handleEdit = (reward: any) => {
    setEditReward(reward);
    setFormData({
      student_id: reward.student_id,
      title: reward.title,
      description: reward.description || '',
      reward_type: reward.reward_type || 'certificate',
      category: reward.category || 'academic_excellence',
      criteria_met: reward.criteria_met || '',
      points_required: reward.points_required || 0,
      date_awarded: reward.date_awarded ? new Date(reward.date_awarded).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      is_public: reward.is_public !== undefined ? reward.is_public : true,
    });
    setShowEditModal(true);
  };

  const handleCloseEditForm = () => {
    setShowEditModal(false);
    setEditReward(null);
    setFormData({
      student_id: '',
      title: '',
      description: '',
      reward_type: 'certificate',
      category: 'academic_excellence',
      criteria_met: '',
      points_required: 0,
      date_awarded: new Date().toISOString().slice(0, 10),
      is_public: true,
    });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editReward) {
      const dataWithUser = {
        ...formData,
        awarded_by: user?.id || user?.email || 'admin',
      };
      updateRewardMutation.mutate({ id: editReward.id, data: dataWithUser });
    }
  };

  const handleOpenCreateForm = () => {
    setFormData({
      student_id: '',
      title: '',
      description: '',
      reward_type: 'certificate',
      category: 'academic_excellence',
      criteria_met: '',
      points_required: 0,
      date_awarded: new Date().toISOString().slice(0, 10),
      is_public: true,
    });
    setShowCreateModal(true);
  };

  const handleCloseCreateForm = () => {
    setShowCreateModal(false);
    setFormData({
      student_id: '',
      title: '',
      description: '',
      reward_type: 'certificate',
      category: 'academic_excellence',
      criteria_met: '',
      points_required: 0,
      date_awarded: new Date().toISOString().slice(0, 10),
      is_public: true,
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
      toast.error('Please select a specific branch before giving a reward');
      return;
    }
    createRewardMutation.mutate(dataWithUser);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading rewards...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Reward Management</h2>
        <Button onClick={handleOpenCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Give Reward
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rewards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {rewards.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No rewards recorded yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Track certificates, badges, prizes, and achievements
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rewards.filter((reward: any) => 
            reward.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reward.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reward.description?.toLowerCase().includes(searchTerm.toLowerCase())
          ).map((reward: any) => (
            <Card key={reward.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {reward.title}
                      <Trophy className="h-4 w-4 text-yellow-500" />
                    </CardTitle>
                    <p className="text-sm font-medium mt-1">
                      {getStudentName(reward.student_id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {reward.student_id}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge variant="default">
                      {reward.reward_type}
                    </Badge>
                    {reward.points_awarded > 0 && (
                      <Badge variant="outline">
                        +{reward.points_awarded} points
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-3">{reward.description}</p>
                <div className="flex justify-between items-center text-sm text-muted-foreground mb-3">
                  <span>Awarded by: {getUserName(reward.awarded_by)}</span>
                  <span>{new Date(reward.date_awarded).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleView(reward)}
                    className="flex-1"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(reward)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(reward.id)}
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
      {showViewModal && viewReward && (
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Reward Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {viewReward.title}
                    <Trophy className="h-4 w-4 text-yellow-500" />
                  </h3>
                  <p className="text-sm font-medium mt-1">
                    {getStudentName(viewReward.student_id)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ID: {viewReward.student_id}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Badge variant="default">{viewReward.reward_type}</Badge>
                  {viewReward.points_awarded > 0 && (
                    <Badge variant="outline">+{viewReward.points_awarded} points</Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Description</Label>
                  <p className="mt-1">{viewReward.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Reward Code</Label>
                    <p>{viewReward.reward_code}</p>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <p>{viewReward.reward_type}</p>
                  </div>
                  <div>
                    <Label>Points Awarded</Label>
                    <p>{viewReward.points_awarded || 0}</p>
                  </div>
                  <div>
                    <Label>Date Awarded</Label>
                    <p>{new Date(viewReward.date_awarded).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label>Awarded By</Label>
                    <p>{getUserName(viewReward.awarded_by)}</p>
                  </div>
                  <div>
                    <Label>Created At</Label>
                    <p>{new Date(viewReward.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(viewReward);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowViewModal(false);
                    handleDelete(viewReward.id);
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
      {showEditModal && editReward && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Reward</DialogTitle>
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
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Reward title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-type">Reward Type *</Label>
                <select
                  id="edit-type"
                  value={formData.reward_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, reward_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="certificate">Certificate</option>
                  <option value="badge">Badge</option>
                  <option value="prize">Prize</option>
                  <option value="privilege">Privilege</option>
                  <option value="recognition">Recognition</option>
                  <option value="points">Points</option>
                  <option value="gift">Gift</option>
                  <option value="trip">Trip</option>
                  <option value="other">Other</option>
                </select>
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
                  <option value="academic_excellence">Academic Excellence</option>
                  <option value="perfect_attendance">Perfect Attendance</option>
                  <option value="good_behavior">Good Behavior</option>
                  <option value="leadership">Leadership</option>
                  <option value="community_service">Community Service</option>
                  <option value="sports">Sports</option>
                  <option value="arts">Arts</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="edit-criteria">Criteria Met *</Label>
                <Input
                  id="edit-criteria"
                  value={formData.criteria_met}
                  onChange={(e) => setFormData(prev => ({ ...prev, criteria_met: e.target.value }))}
                  placeholder="What the student did to earn this reward"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-points">Points Required</Label>
                <Input
                  id="edit-points"
                  type="number"
                  value={formData.points_required}
                  onChange={(e) => setFormData(prev => ({ ...prev, points_required: parseInt(e.target.value) || 0 }))}
                  min="0"
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

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-public"
                  checked={formData.is_public}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="edit-public" className="text-sm font-normal cursor-pointer">
                  Make this reward public
                </Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseEditForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateRewardMutation.isPending}>
                  {updateRewardMutation.isPending ? 'Updating...' : 'Update'}
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
              <DialogTitle>Give Reward</DialogTitle>
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
                <Label htmlFor="create-title">Title *</Label>
                <Input
                  id="create-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Reward title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-type">Reward Type *</Label>
                <select
                  id="create-type"
                  value={formData.reward_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, reward_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="certificate">Certificate</option>
                  <option value="badge">Badge</option>
                  <option value="prize">Prize</option>
                  <option value="privilege">Privilege</option>
                  <option value="recognition">Recognition</option>
                  <option value="points">Points</option>
                  <option value="gift">Gift</option>
                  <option value="trip">Trip</option>
                  <option value="other">Other</option>
                </select>
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
                  <option value="academic_excellence">Academic Excellence</option>
                  <option value="perfect_attendance">Perfect Attendance</option>
                  <option value="good_behavior">Good Behavior</option>
                  <option value="leadership">Leadership</option>
                  <option value="community_service">Community Service</option>
                  <option value="sports">Sports</option>
                  <option value="arts">Arts</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="create-criteria">Criteria Met *</Label>
                <Input
                  id="create-criteria"
                  value={formData.criteria_met}
                  onChange={(e) => setFormData(prev => ({ ...prev, criteria_met: e.target.value }))}
                  placeholder="What the student did to earn this reward"
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-points">Points Required</Label>
                <Input
                  id="create-points"
                  type="number"
                  value={formData.points_required}
                  onChange={(e) => setFormData(prev => ({ ...prev, points_required: parseInt(e.target.value) || 0 }))}
                  min="0"
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
                <Label htmlFor="create-date">Date Awarded *</Label>
                <Input
                  id="create-date"
                  type="date"
                  value={formData.date_awarded}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_awarded: e.target.value }))}
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="create-public"
                  checked={formData.is_public}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="create-public" className="text-sm font-normal cursor-pointer">
                  Make this reward public
                </Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseCreateForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRewardMutation.isPending}>
                  {createRewardMutation.isPending ? 'Giving Reward...' : 'Give Reward'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
