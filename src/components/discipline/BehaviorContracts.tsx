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
import { Search, Plus, FileText, Target, CheckCircle, Trash2, Eye, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';

export const BehaviorContracts: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewContract, setViewContract] = useState<any>(null);
  const [editContract, setEditContract] = useState<any>(null);
  const [formData, setFormData] = useState({
    student_id: '',
    title: '',
    description: '',
    goals: [] as string[],
    expectations: [] as string[],
    consequences: [] as string[],
    rewards: [] as string[],
    success_criteria: [] as string[],
    contract_type: 'behavioral',
    review_frequency: 'weekly',
    monitoring_method: 'teacher_observation',
    parent_signature_required: true,
    student_signature_required: true,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0, 10),
    is_active: true,
  });
  const [goalInput, setGoalInput] = useState('');
  const { getStudentName } = useStudentNames();

  const { selectedBranch, isHQRole } = useBranch();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['behavior-contracts', selectedBranch],
    queryFn: async () => {
      const response = await apiClient.getBehaviorContracts({
        branch_id: isHQRole && selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
      });
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data || [];
    },
    enabled: !isHQRole || !!selectedBranch,
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteBehaviorContract(id);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Behavior contract deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['behavior-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete behavior contract');
    },
  });

  const updateContractMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.updateBehaviorContract(id, data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Behavior contract updated successfully');
      queryClient.invalidateQueries({ queryKey: ['behavior-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
      handleCloseEditForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update behavior contract');
    },
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.createBehaviorContract(data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Behavior contract created successfully');
      queryClient.invalidateQueries({ queryKey: ['behavior-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
      handleCloseCreateForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create behavior contract');
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this behavior contract?')) {
      deleteContractMutation.mutate(id);
    }
  };

  const handleView = (contract: any) => {
    setViewContract(contract);
    setShowViewModal(true);
  };

  const handleEdit = (contract: any) => {
    setEditContract(contract);
    setFormData({
      student_id: contract.student_id,
      title: contract.title,
      description: contract.description || '',
      goals: contract.goals || [],
      expectations: contract.expectations || [],
      consequences: contract.consequences || [],
      rewards: contract.rewards || [],
      success_criteria: contract.success_criteria || [],
      contract_type: contract.contract_type || 'behavioral',
      review_frequency: contract.review_frequency || 'weekly',
      monitoring_method: contract.monitoring_method || 'teacher_observation',
      parent_signature_required: contract.parent_signature_required !== undefined ? contract.parent_signature_required : true,
      student_signature_required: contract.student_signature_required !== undefined ? contract.student_signature_required : true,
      start_date: contract.start_date ? new Date(contract.start_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      end_date: contract.end_date ? new Date(contract.end_date).toISOString().slice(0, 10) : new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0, 10),
      is_active: contract.is_active,
    });
    setGoalInput('');
    setShowEditModal(true);
  };

  const handleCloseEditForm = () => {
    setShowEditModal(false);
    setEditContract(null);
    setFormData({
      student_id: '',
      title: '',
      description: '',
      goals: [],
      expectations: [],
      consequences: [],
      rewards: [],
      success_criteria: [],
      contract_type: 'behavioral',
      review_frequency: 'weekly',
      monitoring_method: 'teacher_observation',
      parent_signature_required: true,
      student_signature_required: true,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0, 10),
      is_active: true,
    });
    setGoalInput('');
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editContract) {
      const dataWithUser = {
        ...formData,
        created_by: user?.id || user?.email || 'admin',
        goals: formData.goals.length > 0 ? formData.goals : ['General behavior improvement'],
        expectations: formData.expectations.length > 0 ? formData.expectations : ['Follow classroom rules'],
        consequences: formData.consequences.length > 0 ? formData.consequences : ['Loss of privileges'],
        rewards: formData.rewards.length > 0 ? formData.rewards : ['Extra recess time'],
        success_criteria: formData.success_criteria.length > 0 ? formData.success_criteria : ['80% compliance rate'],
        ...(isHQRole && selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
      };
      if (isHQRole && (!selectedBranch || selectedBranch === 'all')) {
        toast.error('Please select a specific branch before updating a contract');
        return;
      }
      updateContractMutation.mutate({ id: editContract.id, data: dataWithUser });
    }
  };

  const handleAddGoal = () => {
    if (goalInput.trim()) {
      setFormData(prev => ({
        ...prev,
        goals: [...prev.goals, goalInput.trim()]
      }));
      setGoalInput('');
    }
  };

  const handleRemoveGoal = (index: number) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index)
    }));
  };

  const handleOpenCreateForm = () => {
    setFormData({
      student_id: '',
      title: '',
      description: '',
      goals: [],
      expectations: [],
      consequences: [],
      rewards: [],
      success_criteria: [],
      contract_type: 'behavioral',
      review_frequency: 'weekly',
      monitoring_method: 'teacher_observation',
      parent_signature_required: true,
      student_signature_required: true,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0, 10),
      is_active: true,
    });
    setGoalInput('');
    setShowCreateModal(true);
  };

  const handleCloseCreateForm = () => {
    setShowCreateModal(false);
    setFormData({
      student_id: '',
      title: '',
      description: '',
      goals: [],
      expectations: [],
      consequences: [],
      rewards: [],
      success_criteria: [],
      contract_type: 'behavioral',
      review_frequency: 'weekly',
      monitoring_method: 'teacher_observation',
      parent_signature_required: true,
      student_signature_required: true,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0, 10),
      is_active: true,
    });
    setGoalInput('');
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithUser = {
      ...formData,
      created_by: user?.id || user?.email || 'admin',
      goals: formData.goals.length > 0 ? formData.goals : ['General behavior improvement'],
      expectations: formData.expectations.length > 0 ? formData.expectations : ['Follow classroom rules'],
      consequences: formData.consequences.length > 0 ? formData.consequences : ['Loss of privileges'],
      rewards: formData.rewards.length > 0 ? formData.rewards : ['Extra recess time'],
      success_criteria: formData.success_criteria.length > 0 ? formData.success_criteria : ['80% compliance rate'],
      ...(isHQRole && selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
    };
    if (isHQRole && (!selectedBranch || selectedBranch === 'all')) {
      toast.error('Please select a specific branch before creating a contract');
      return;
    }
    createContractMutation.mutate(dataWithUser);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading behavior contracts...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Behavior Contracts</h2>
        <Button onClick={handleOpenCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Create Contract
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search behavior contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No behavior contracts created</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create and monitor behavior improvement plans with goals and expectations
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contracts.filter((contract: any) => 
            contract.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contract.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contract.description?.toLowerCase().includes(searchTerm.toLowerCase())
          ).map((contract: any) => (
            <Card key={contract.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {contract.title}
                      <Target className="h-4 w-4 text-blue-500" />
                    </CardTitle>
                    <p className="text-sm font-medium mt-1">
                      {getStudentName(contract.student_id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID: {contract.student_id}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {contract.description}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge variant={contract.is_active ? 'default' : 'secondary'}>
                      {contract.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">
                      {contract.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {contract.goals && contract.goals.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Goals:</p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {contract.goals.slice(0, 3).map((goal: string, index: number) => (
                          <li key={index}>{goal}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-muted-foreground">Progress: </span>
                      <span className="font-medium">{Math.round(contract.completion_percentage || 0)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type: </span>
                      <span>{contract.contract_type}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Start: {new Date(contract.start_date).toLocaleDateString()}</span>
                    <span>End: {new Date(contract.end_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2 mt-3 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleView(contract)}
                      className="flex-1"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(contract)}
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(contract.id)}
                      className="flex-1"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && viewContract && (
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Behavior Contract Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {viewContract.title}
                    <Target className="h-4 w-4 text-blue-500" />
                  </h3>
                  <p className="text-sm font-medium mt-1">
                    {getStudentName(viewContract.student_id)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ID: {viewContract.student_id}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Badge variant={viewContract.is_active ? 'default' : 'secondary'}>
                    {viewContract.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">{viewContract.status}</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Description</Label>
                  <p className="mt-1">{viewContract.description}</p>
                </div>

                {viewContract.goals && viewContract.goals.length > 0 && (
                  <div>
                    <Label>Goals</Label>
                    <ul className="mt-1 list-disc list-inside text-sm">
                      {viewContract.goals.map((goal: string, index: number) => (
                        <li key={index}>{goal}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Contract Code</Label>
                    <p>{viewContract.contract_code}</p>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <p>{viewContract.contract_type}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <p className="capitalize">{viewContract.status}</p>
                  </div>
                  <div>
                    <Label>Progress</Label>
                    <p>{Math.round(viewContract.completion_percentage || 0)}%</p>
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <p>{new Date(viewContract.start_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <p>{new Date(viewContract.end_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label>Created By</Label>
                    <p>{viewContract.created_by}</p>
                  </div>
                  <div>
                    <Label>Created At</Label>
                    <p>{new Date(viewContract.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(viewContract);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowViewModal(false);
                    handleDelete(viewContract.id);
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
      {showEditModal && editContract && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Behavior Contract</DialogTitle>
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
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Contract title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description *</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Contract description"
                  rows={3}
                  required
                />
              </div>

              <div>
                <Label>Goals</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      placeholder="Add a goal"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGoal();
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddGoal}>Add</Button>
                  </div>
                  {formData.goals.length > 0 && (
                    <ul className="space-y-1">
                      {formData.goals.map((goal, index) => (
                        <li key={index} className="flex items-center justify-between text-sm p-2 bg-secondary rounded">
                          <span>{goal}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveGoal(index)}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="edit-type">Contract Type *</Label>
                <select
                  id="edit-type"
                  value={formData.contract_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, contract_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="behavior">Behavior</option>
                  <option value="academic">Academic</option>
                  <option value="attendance">Attendance</option>
                  <option value="comprehensive">Comprehensive</option>
                </select>
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
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              <div>
                <Label htmlFor="edit-progress">Completion Percentage</Label>
                <Input
                  id="edit-progress"
                  type="number"
                  value={formData.completion_percentage}
                  onChange={(e) => setFormData(prev => ({ ...prev, completion_percentage: parseInt(e.target.value) || 0 }))}
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <Label htmlFor="edit-start">Start Date *</Label>
                <Input
                  id="edit-start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-end">End Date *</Label>
                <Input
                  id="edit-end"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-input"
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseEditForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateContractMutation.isPending}>
                  {updateContractMutation.isPending ? 'Updating...' : 'Update'}
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
              <DialogTitle>Create Behavior Contract</DialogTitle>
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
                <Label htmlFor="create-title">Title *</Label>
                <Input
                  id="create-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Contract title"
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-description">Description *</Label>
                <Textarea
                  id="create-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Contract description"
                  rows={3}
                  required
                />
              </div>

              <div>
                <Label>Goals</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      placeholder="Add a goal"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGoal();
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddGoal}>Add</Button>
                  </div>
                  {formData.goals.length > 0 && (
                    <ul className="space-y-1">
                      {formData.goals.map((goal, index) => (
                        <li key={index} className="flex items-center justify-between text-sm p-2 bg-secondary rounded">
                          <span>{goal}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveGoal(index)}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="create-type">Contract Type *</Label>
                <select
                  id="create-type"
                  value={formData.contract_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, contract_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  required
                >
                  <option value="behavior">Behavior</option>
                  <option value="academic">Academic</option>
                  <option value="attendance">Attendance</option>
                  <option value="comprehensive">Comprehensive</option>
                </select>
              </div>

              <div>
                <Label htmlFor="create-start">Start Date *</Label>
                <Input
                  id="create-start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="create-end">End Date *</Label>
                <Input
                  id="create-end"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseCreateForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createContractMutation.isPending}>
                  {createContractMutation.isPending ? 'Creating...' : 'Create Contract'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
