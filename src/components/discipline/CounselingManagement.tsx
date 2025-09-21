import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useStudentNames } from '@/hooks/useStudentName';
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
import { Search, Plus, Heart, Calendar, Users, Trash2, Eye, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';

export const CounselingManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewSession, setViewSession] = useState<any>(null);
  const [editSession, setEditSession] = useState<any>(null);
  const [formData, setFormData] = useState({
    student_id: '',
    title: '',
    reason: 'behavioral',
    session_type: 'individual',
    counselor_id: '',
    location: '',
    duration_minutes: 30,
    goals: [''] as string[],
    risk_level: 'low',
    confidentiality_level: 'standard',
    parent_involvement_required: false,
    follow_up_required: true,
    session_date: new Date().toISOString(),
  });
  const { getStudentName } = useStudentNames();

  const { selectedBranch, isHQRole } = useBranch();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['counseling-sessions', selectedBranch],
    queryFn: async () => {
      const response = await apiClient.getCounselingSessions({
        branch_id: isHQRole && selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
      });
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data || [];
    },
    enabled: !isHQRole || !!selectedBranch,
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteCounselingSession(id);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Counseling session deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['counseling-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete counseling session');
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.updateCounselingSession(id, data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Counseling session updated successfully');
      queryClient.invalidateQueries({ queryKey: ['counseling-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
      handleCloseEditForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update counseling session');
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.createCounselingSession(data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Counseling session scheduled successfully');
      queryClient.invalidateQueries({ queryKey: ['counseling-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
      handleCloseCreateForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to schedule counseling session');
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this counseling session?')) {
      deleteSessionMutation.mutate(id);
    }
  };

  const handleView = (session: any) => {
    setViewSession(session);
    setShowViewModal(true);
  };

  const handleEdit = (session: any) => {
    setEditSession(session);
    setFormData({
      student_id: session.student_id,
      title: session.title || '',
      reason: session.reason || 'behavioral',
      session_type: session.session_type,
      counselor_id: session.counselor_id,
      location: session.location,
      duration_minutes: session.duration_minutes,
      goals: session.goals || [''],
      risk_level: session.risk_level || 'low',
      confidentiality_level: session.confidentiality_level || 'standard',
      parent_involvement_required: session.parent_involvement_required || false,
      follow_up_required: session.follow_up_required !== undefined ? session.follow_up_required : true,
      session_date: session.session_date || new Date().toISOString(),
    });
    setShowEditModal(true);
  };

  const handleCloseEditForm = () => {
    setShowEditModal(false);
    setEditSession(null);
    setFormData({
      student_id: '',
      title: '',
      reason: 'behavioral',
      session_type: 'individual',
      counselor_id: '',
      location: '',
      duration_minutes: 30,
      goals: [''],
      risk_level: 'low',
      confidentiality_level: 'standard',
      parent_involvement_required: false,
      follow_up_required: true,
      session_date: new Date().toISOString(),
    });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editSession) {
    const dataWithUser = {
      ...formData,
      counselor_id: formData.counselor_id || user?.id || user?.email || 'admin',
      goals: formData.goals.filter(g => g.trim() !== ''),
      ...(isHQRole && selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
    };
    if (isHQRole && (!selectedBranch || selectedBranch === 'all')) {
      toast.error('Please select a specific branch before scheduling a session');
      return;
    }
    updateSessionMutation.mutate({ id: editSession.id, data: dataWithUser });
    }
  };

  const handleOpenCreateForm = () => {
    setFormData({
      student_id: '',
      title: '',
      reason: 'behavioral',
      session_type: 'individual',
      counselor_id: '',
      location: '',
      duration_minutes: 30,
      goals: [''],
      risk_level: 'low',
      confidentiality_level: 'standard',
      parent_involvement_required: false,
      follow_up_required: true,
      session_date: new Date().toISOString(),
    });
    setShowCreateModal(true);
  };

  const handleCloseCreateForm = () => {
    setShowCreateModal(false);
    setFormData({
      student_id: '',
      title: '',
      reason: 'behavioral',
      session_type: 'individual',
      counselor_id: '',
      location: '',
      duration_minutes: 30,
      goals: [''],
      risk_level: 'low',
      confidentiality_level: 'standard',
      parent_involvement_required: false,
      follow_up_required: true,
      session_date: new Date().toISOString(),
    });
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithUser = {
      ...formData,
      counselor_id: formData.counselor_id || user?.id || user?.email || 'admin',
      goals: formData.goals.filter(g => g.trim() !== ''),
      ...(isHQRole && selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
    };
    if (isHQRole && (!selectedBranch || selectedBranch === 'all')) {
      toast.error('Please select a specific branch before scheduling a session');
      return;
    }
    if (dataWithUser.goals.length === 0) {
      dataWithUser.goals = ['General counseling session'];
    }
    createSessionMutation.mutate(dataWithUser);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading counseling sessions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Counseling Management</h2>
        <Button onClick={handleOpenCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Session
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search counseling sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No counseling sessions scheduled</p>
            <p className="text-sm text-muted-foreground mt-2">
              Schedule individual, group, and family counseling sessions
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.filter((session: any) => 
            session.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            session.reason?.toLowerCase().includes(searchTerm.toLowerCase())
          ).map((session: any) => (
            <Card key={session.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {session.title || `Session: ${session.session_type}`}
                    </CardTitle>
                    <p className="text-sm font-medium mt-1">
                      {getStudentName(session.student_id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {session.student_id}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Reason: {session.reason}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge variant={session.status === 'completed' ? 'default' : 'outline'}>
                      {session.status}
                    </Badge>
                    <Badge variant="secondary">
                      {session.session_type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Counselor: </span>
                    <span>{session.counselor_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration: </span>
                    <span>{session.duration_minutes} min</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location: </span>
                    <span>{session.location}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date: </span>
                    <span>{new Date(session.session_date).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleView(session)}
                    className="flex-1"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(session)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(session.id)}
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
      {showViewModal && viewSession && (
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Counseling Session Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">
                    {viewSession.title || `Session: ${viewSession.session_type}`}
                  </h3>
                  <p className="text-sm font-medium mt-1">
                    {getStudentName(viewSession.student_id)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ID: {viewSession.student_id}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Badge variant={viewSession.status === 'completed' ? 'default' : 'outline'}>
                    {viewSession.status}
                  </Badge>
                  <Badge variant="secondary">{viewSession.session_type}</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Reason</Label>
                  <p className="mt-1">{viewSession.reason}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Session Code</Label>
                    <p>{viewSession.session_code}</p>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <p>{viewSession.session_type}</p>
                  </div>
                  <div>
                    <Label>Counselor</Label>
                    <p>{viewSession.counselor_id}</p>
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <p>{viewSession.duration_minutes} minutes</p>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <p>{viewSession.location}</p>
                  </div>
                  <div>
                    <Label>Session Date</Label>
                    <p>{new Date(viewSession.session_date).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <p className="capitalize">{viewSession.status}</p>
                  </div>
                  <div>
                    <Label>Created At</Label>
                    <p>{new Date(viewSession.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(viewSession);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowViewModal(false);
                    handleDelete(viewSession.id);
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
      {showEditModal && editSession && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Counseling Session</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <Label htmlFor="edit-student">Student *</Label>
                <Input
                  id="edit-student"
                  value={formData.student_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
                  placeholder="Student ID"
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Current: {getStudentName(formData.student_id)}
                </p>
              </div>

              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Session title (optional)"
                />
              </div>

              <div>
                <Label htmlFor="edit-reason">Reason *</Label>
                <Input
                  id="edit-reason"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Reason for counseling"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-type">Session Type *</Label>
                <select
                  id="edit-type"
                  value={formData.session_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, session_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                  <option value="family">Family</option>
                  <option value="peer">Peer</option>
                </select>
              </div>

              <div>
                <Label htmlFor="edit-counselor">Counselor *</Label>
                <Input
                  id="edit-counselor"
                  value={formData.counselor_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, counselor_id: e.target.value }))}
                  placeholder="Counselor ID or name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-location">Location *</Label>
                <Input
                  id="edit-location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Session location"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-duration">Duration (minutes) *</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 30 }))}
                  min="15"
                  step="15"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-status">Status *</Label>
                <select
                  id="edit-status"
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>

              <div>
                <Label htmlFor="edit-date">Session Date *</Label>
                <Input
                  id="edit-date"
                  type="datetime-local"
                  value={formData.session_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, session_date: e.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseEditForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateSessionMutation.isPending}>
                  {updateSessionMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Form Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule Counseling Session</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div>
                <Label htmlFor="create-student">Student *</Label>
                <Input
                  id="create-student"
                  value={formData.student_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
                  placeholder="Student ID"
                  required
                />
                {formData.student_id && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {getStudentName(formData.student_id)}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="create-title">Title</Label>
                <Input
                  id="create-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Session title (optional)"
                />
              </div>

              <div>
                <Label htmlFor="create-reason">Reason *</Label>
                <Input
                  id="create-reason"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Reason for counseling"
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-type">Session Type *</Label>
                <select
                  id="create-type"
                  value={formData.session_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, session_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                  <option value="family">Family</option>
                  <option value="peer">Peer</option>
                </select>
              </div>

              <div>
                <Label htmlFor="create-counselor">Counselor *</Label>
                <Input
                  id="create-counselor"
                  value={formData.counselor_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, counselor_id: e.target.value }))}
                  placeholder="Counselor ID or name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-location">Location *</Label>
                <Input
                  id="create-location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Session location"
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-duration">Duration (minutes) *</Label>
                <Input
                  id="create-duration"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 30 }))}
                  min="15"
                  step="15"
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-date">Session Date *</Label>
                <Input
                  id="create-date"
                  type="datetime-local"
                  value={formData.session_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, session_date: e.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseCreateForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSessionMutation.isPending}>
                  {createSessionMutation.isPending ? 'Scheduling...' : 'Schedule Session'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
