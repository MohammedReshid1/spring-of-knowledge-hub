import React, { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useStudentNames } from '@/hooks/useStudentName';
import { useUserNames } from '@/hooks/useUserNames';
import { StudentSearchInput } from '@/components/ui/student-search-input';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  Edit,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Trash2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { debounce } from 'lodash';

interface IncidentData {
  id: string;
  incident_code: string;
  student_id: string;
  reported_by: string;
  incident_type: string;
  severity: string;
  title: string;
  description: string;
  location: string;
  incident_date: string;
  status: string;
  parent_contacted: boolean;
  is_resolved: boolean;
  created_at: string;
}

export const IncidentManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getStudentName } = useStudentNames();
  const { getUserName } = useUserNames();
  const [showForm, setShowForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentData | null>(null);
  const [viewIncident, setViewIncident] = useState<IncidentData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formData, setFormData] = useState({
    student_id: '',
    incident_type: 'behavioral',
    severity: 'minor',
    status: 'open',
    title: '',
    description: '',
    location: '',
    incident_date: new Date().toISOString(),
    witnesses: [] as string[],
    immediate_action_taken: '',
    parent_contacted: false,
    parent_contact_method: '',
    follow_up_required: false,
  });

  const incidentTypes = [
    'behavioral', 'academic', 'attendance', 'safety', 'property_damage', 
    'bullying', 'violence', 'substance', 'other'
  ];

  const severityLevels = ['minor', 'moderate', 'major', 'severe'];
  const statusOptions = ['open', 'under_investigation', 'resolved', 'closed'];

  const { selectedBranch, isHQRole } = useBranch();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents', debouncedSearchTerm, typeFilter, severityFilter, statusFilter, selectedBranch],
    queryFn: async () => {
      const response = await apiClient.getIncidents({
        search: debouncedSearchTerm || undefined,
        incident_type: typeFilter || undefined,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        branch_id: isHQRole && selectedBranch && selectedBranch !== 'all' ? selectedBranch : undefined,
      });
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data || [];
    },
    enabled: !isHQRole || !!selectedBranch,
  });

  const debouncedUpdate = useCallback(
    debounce((term: string) => setDebouncedSearchTerm(term), 300),
    []
  );

  const createIncidentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.createIncident(data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Incident reported successfully');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
      handleCloseForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create incident');
    },
  });

  const updateIncidentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.updateIncident(id, data);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Incident updated successfully');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      handleCloseForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update incident');
    },
  });

  const deleteIncidentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteIncident(id);
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success('Incident deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['disciplinary-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete incident');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.student_id.trim() || !formData.title.trim() || !formData.description.trim()) {
      toast.error('Student ID, title, and description are required');
      return;
    }

    const submitData: any = {
      student_id: formData.student_id.trim(),
      reported_by: user?.id || user?.email || 'admin',
      incident_type: formData.incident_type,
      severity: formData.severity,
      status: formData.status,
      title: formData.title.trim(),
      description: formData.description.trim(),
      location: formData.location.trim(),
      incident_date: formData.incident_date,
      witnesses: formData.witnesses,
      immediate_action_taken: formData.immediate_action_taken.trim() || null,
      parent_contacted: formData.parent_contacted,
      parent_contact_method: formData.parent_contact_method.trim() || null,
      follow_up_required: formData.follow_up_required,
      is_resolved: false,
      ...(isHQRole && selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
    };

    if (isHQRole && (!selectedBranch || selectedBranch === 'all')) {
      toast.error('Please select a specific branch before creating an incident');
      return;
    }

    if (selectedIncident) {
      updateIncidentMutation.mutate({ id: selectedIncident.id, data: submitData });
    } else {
      createIncidentMutation.mutate(submitData);
    }
  };

  const handleEdit = (incident: IncidentData) => {
    setSelectedIncident(incident);
    setFormData({
      student_id: incident.student_id,
      incident_type: incident.incident_type,
      severity: incident.severity,
      status: incident.status || 'open',
      title: incident.title,
      description: incident.description,
      location: incident.location,
      incident_date: incident.incident_date,
      witnesses: [],
      immediate_action_taken: '',
      parent_contacted: incident.parent_contacted,
      parent_contact_method: '',
      follow_up_required: false,
    });
    setShowForm(true);
  };

  const handleView = (incident: IncidentData) => {
    setViewIncident(incident);
    setShowViewModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this incident?')) {
      deleteIncidentMutation.mutate(id);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedIncident(null);
    setFormData({
      student_id: '',
      incident_type: 'behavioral',
      severity: 'minor',
      status: 'open',
      title: '',
      description: '',
      location: '',
      incident_date: new Date().toISOString(),
      witnesses: [],
      immediate_action_taken: '',
      parent_contacted: false,
      parent_contact_method: '',
      follow_up_required: false,
    });
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      minor: 'default',
      moderate: 'secondary',
      major: 'destructive',
      severe: 'destructive'
    };
    return <Badge variant={colors[severity as keyof typeof colors] as any}>{severity}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      open: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100', variant: 'secondary' as const },
      under_investigation: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100', variant: 'outline' as const },
      resolved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', variant: 'default' as const },
      closed: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-100', variant: 'outline' as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={`${config.bg} ${config.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeColors = {
      behavioral: 'bg-blue-100 text-blue-800',
      academic: 'bg-green-100 text-green-800',
      attendance: 'bg-yellow-100 text-yellow-800',
      safety: 'bg-red-100 text-red-800',
      bullying: 'bg-purple-100 text-purple-800',
      violence: 'bg-red-100 text-red-800',
      substance: 'bg-orange-100 text-orange-800',
      other: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[type as keyof typeof typeColors] || typeColors.other}`}>
        {type.replace('_', ' ')}
      </span>
    );
  };

  // Use server-filtered incidents; no extra client filtering to avoid flicker
  const filteredIncidents = incidents;

  if (isLoading) {
    return <div className="text-center py-8">Loading incidents...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Incident Management</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Report Incident
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); debouncedUpdate(e.target.value); }}
              className="pl-8"
            />
          </div>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md"
        >
          <option value="">All Types</option>
          {incidentTypes.map((type) => (
            <option key={type} value={type}>
              {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md"
        >
          <option value="">All Severities</option>
          {severityLevels.map((severity) => (
            <option key={severity} value={severity}>
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-input bg-background rounded-md"
        >
          <option value="">All Statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {/* Incidents Grid */}
      {filteredIncidents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No incidents found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((incident: IncidentData) => (
            <Card key={incident.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {incident.title}
                      <span className="text-sm font-mono text-muted-foreground">
                        #{incident.incident_code}
                      </span>
                    </CardTitle>
                    <p className="text-sm font-medium">
                      {getStudentName(incident.student_id)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ID: {incident.student_id} • Location: {incident.location}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {getStatusBadge(incident.status)}
                    {getSeverityBadge(incident.severity)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4">
                  {getTypeBadge(incident.incident_type)}
                  <span className="text-sm text-muted-foreground">
                    {format(parseISO(incident.incident_date), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>

                <p className="text-sm line-clamp-2">{incident.description}</p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Reported by:</span>
                    <span>{getUserName(incident.reported_by)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Parent contacted:</span>
                    <span className={incident.parent_contacted ? 'text-green-600' : 'text-red-600'}>
                      {incident.parent_contacted ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleView(incident)}
                    className="flex-1"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(incident)}
                    className="flex-1"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(incident.id)}
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

      {/* Incident Form Modal */}
      {showForm && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedIncident ? 'Edit Incident' : 'Report New Incident'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <StudentSearchInput
                    value={formData.student_id}
                    onChange={(studentId) => setFormData(prev => ({ ...prev, student_id: studentId }))}
                    label="Student"
                    placeholder="Type student name or ID"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="incident_type">Incident Type *</Label>
                  <select
                    id="incident_type"
                    value={formData.incident_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, incident_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    required
                  >
                    {incidentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="severity">Severity *</Label>
                  <select
                    id="severity"
                    value={formData.severity}
                    onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    required
                  >
                    {severityLevels.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Where did this occur?"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="title">Incident Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Brief title for the incident"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="incident_date">Date & Time *</Label>
                  <Input
                    id="incident_date"
                    type="datetime-local"
                    value={formData.incident_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, incident_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed description of what happened"
                  rows={4}
                  required
                />
              </div>

              <div>
                <Label htmlFor="immediate_action_taken">Immediate Action Taken</Label>
                <Textarea
                  id="immediate_action_taken"
                  value={formData.immediate_action_taken}
                  onChange={(e) => setFormData(prev => ({ ...prev, immediate_action_taken: e.target.value }))}
                  placeholder="What action was taken immediately after the incident?"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="parent_contacted"
                    checked={formData.parent_contacted}
                    onChange={(e) => setFormData(prev => ({ ...prev, parent_contacted: e.target.checked }))}
                  />
                  <Label htmlFor="parent_contacted">Parent/Guardian contacted</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="follow_up_required"
                    checked={formData.follow_up_required}
                    onChange={(e) => setFormData(prev => ({ ...prev, follow_up_required: e.target.checked }))}
                  />
                  <Label htmlFor="follow_up_required">Follow-up required</Label>
                </div>
              </div>

              {formData.parent_contacted && (
                <div>
                  <Label htmlFor="parent_contact_method">Contact Method</Label>
                  <select
                    id="parent_contact_method"
                    value={formData.parent_contact_method}
                    onChange={(e) => setFormData(prev => ({ ...prev, parent_contact_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  >
                    <option value="">Select method</option>
                    <option value="phone">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="meeting">In-Person Meeting</option>
                    <option value="letter">Written Letter</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseForm}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createIncidentMutation.isPending || updateIncidentMutation.isPending}
                >
                  {createIncidentMutation.isPending || updateIncidentMutation.isPending 
                    ? 'Saving...' 
                    : selectedIncident ? 'Update Incident' : 'Report Incident'
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* View Details Modal */}
      {showViewModal && viewIncident && (
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Incident Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{viewIncident.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Incident Code: {viewIncident.incident_code}
                  </p>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(viewIncident.status)}
                  {getSeverityBadge(viewIncident.severity)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Student</Label>
                  <p className="font-medium">{getStudentName(viewIncident.student_id)}</p>
                  <p className="text-sm text-muted-foreground">ID: {viewIncident.student_id}</p>
                </div>
                <div>
                  <Label>Type</Label>
                  <div className="mt-1">{getTypeBadge(viewIncident.incident_type)}</div>
                </div>
                <div>
                  <Label>Location</Label>
                  <p>{viewIncident.location}</p>
                </div>
                <div>
                  <Label>Date & Time</Label>
                  <p>{format(parseISO(viewIncident.incident_date), 'PPpp')}</p>
                </div>
                <div>
                  <Label>Reported By</Label>
                  <p>{viewIncident.reported_by}</p>
                </div>
                <div>
                  <Label>Parent Contacted</Label>
                  <p className={viewIncident.parent_contacted ? 'text-green-600' : 'text-red-600'}>
                    {viewIncident.parent_contacted ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <Label>Resolved</Label>
                  <p className={viewIncident.is_resolved ? 'text-green-600' : 'text-orange-600'}>
                    {viewIncident.is_resolved ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <Label>Created</Label>
                  <p>{format(parseISO(viewIncident.created_at), 'PPp')}</p>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <p className="mt-1 whitespace-pre-wrap">{viewIncident.description}</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(viewIncident);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowViewModal(false);
                    handleDelete(viewIncident.id);
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
    </div>
  );
};
