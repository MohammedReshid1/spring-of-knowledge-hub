import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Wrench, Calendar, Clock, CheckCircle, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';

interface MaintenanceRecord {
  id: string;
  maintenance_code: string;
  asset_id: string;
  asset_name: string;
  maintenance_type: string;
  title: string;
  description?: string;
  scheduled_date: string;
  started_at?: string;
  completed_at?: string;
  status: string;
  assigned_to_name?: string;
  performed_by_name?: string;
  total_cost?: number;
  work_performed?: string;
  next_maintenance_date?: string;
  created_at: string;
}

export const MaintenanceManagement: React.FC = () => {
  const { selectedBranch, isHQRole } = useBranch();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [isScheduleMaintenanceOpen, setIsScheduleMaintenanceOpen] = useState(false);
  const [isEditMaintenanceOpen, setIsEditMaintenanceOpen] = useState(false);
  const [isDeleteMaintenanceOpen, setIsDeleteMaintenanceOpen] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState<MaintenanceRecord | null>(null);
  const [newMaintenance, setNewMaintenance] = useState({
    asset_id: '',
    maintenance_type: 'preventive',
    title: '',
    description: '',
    scheduled_date: '',
    assigned_to: '',
    estimated_cost: ''
  });

  const queryClient = useQueryClient();

  const { data: maintenanceRecords = [], isLoading } = useQuery<MaintenanceRecord[]>({
    queryKey: ['maintenance-records', selectedBranch, selectedStatus, selectedType, searchTerm],
    queryFn: async (): Promise<MaintenanceRecord[]> => {
      const params = new URLSearchParams();
      if (isHQRole && selectedBranch && selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      }
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedType && selectedType !== 'all') params.append('maintenance_type', selectedType);
      
      const response = await apiClient.get(`/inventory/maintenance?${params}`);
      return response.data as MaintenanceRecord[];
    },
    enabled: !isHQRole || !!selectedBranch
  });

  const { data: upcomingSchedule } = useQuery({
    queryKey: ['maintenance-schedule', selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isHQRole && selectedBranch && selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      }
      const qs = params.toString();
      const response = await apiClient.get(`/inventory/analytics/maintenance-schedule?days_ahead=30${qs ? `&${qs}` : ''}`);
      return response.data;
    },
    enabled: !isHQRole || !!selectedBranch
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets-for-maintenance', selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isHQRole && selectedBranch && selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      }
      params.append('status', 'active');
      const response = await apiClient.get(`/inventory/assets?${params}`);
      return response.data as any[];
    },
  });

  const scheduleMaintenance = useMutation({
    mutationFn: async (maintenanceData: any) => {
      const response = await apiClient.post('/inventory/maintenance', maintenanceData);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Maintenance scheduled successfully');
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedule'] });
      setIsScheduleMaintenanceOpen(false);
      resetMaintenanceForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to schedule maintenance');
    },
  });

  const updateMaintenanceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.put(`/inventory/maintenance/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Maintenance updated successfully');
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedule'] });
      setIsEditMaintenanceOpen(false);
      setSelectedMaintenance(null);
      resetMaintenanceForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update maintenance');
    },
  });

  const deleteMaintenanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/inventory/maintenance/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Maintenance record deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedule'] });
      setIsDeleteMaintenanceOpen(false);
      setSelectedMaintenance(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete maintenance record');
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'preventive': return 'bg-green-100 text-green-800';
      case 'corrective': return 'bg-yellow-100 text-yellow-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'routine': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Calendar className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      default: return <Wrench className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const isOverdue = (scheduledDate: string, status: string) => {
    if (status === 'completed' || status === 'cancelled') return false;
    return new Date(scheduledDate) < new Date();
  };

  const resetMaintenanceForm = () => {
    setNewMaintenance({
      asset_id: '',
      maintenance_type: 'preventive',
      title: '',
      description: '',
      scheduled_date: '',
      assigned_to: '',
      estimated_cost: ''
    });
  };

  const handleEditMaintenance = (record: MaintenanceRecord) => {
    setSelectedMaintenance(record);
    setNewMaintenance({
      asset_id: record.asset_id,
      maintenance_type: record.maintenance_type,
      title: record.title,
      description: record.description || '',
      scheduled_date: record.scheduled_date,
      assigned_to: record.assigned_to_name || '',
      estimated_cost: record.total_cost?.toString() || ''
    });
    setIsEditMaintenanceOpen(true);
  };

  const handleDeleteMaintenance = (record: MaintenanceRecord) => {
    setSelectedMaintenance(record);
    setIsDeleteMaintenanceOpen(true);
  };

  const startWorkMutation = useMutation({
    mutationFn: async (maintenanceId: string) => {
      const response = await apiClient.put(`/inventory/maintenance/${maintenanceId}/start`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Maintenance work started successfully');
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to start maintenance work');
    },
  });

  const handleStartWork = (record: MaintenanceRecord) => {
    startWorkMutation.mutate(record.id);
  };

  const completeWorkMutation = useMutation({
    mutationFn: async (maintenanceId: string) => {
      const response = await apiClient.put(`/inventory/maintenance/${maintenanceId}/complete`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Maintenance work completed successfully');
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to complete maintenance work');
    },
  });

  const handleCompleteWork = (record: MaintenanceRecord) => {
    completeWorkMutation.mutate(record.id);
  };

  const handleScheduleMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMaintenance.asset_id || !newMaintenance.title.trim() || !newMaintenance.scheduled_date) {
      toast.error('Please fill in required fields (Asset, Title, Scheduled Date)');
      return;
    }

    // For HQ roles creating maintenance, we need to include the selected branch_id (unless it's 'all')
    if (isHQRole && (!selectedBranch || selectedBranch === 'all')) {
      toast.error('Please select a specific branch before scheduling maintenance');
      return;
    }

    const maintenanceData = {
      asset_id: newMaintenance.asset_id,
      maintenance_type: newMaintenance.maintenance_type,
      title: newMaintenance.title.trim(),
      description: newMaintenance.description.trim() || null,
      scheduled_date: newMaintenance.scheduled_date ? newMaintenance.scheduled_date.split('T')[0] : null,
      assigned_to: newMaintenance.assigned_to || null,
      total_cost: (() => {
        const cost = newMaintenance.estimated_cost;
        if (!cost || cost.toString().trim() === "") return null;
        const parsed = parseFloat(cost);
        return isNaN(parsed) ? null : parsed;
      })(),
      // Include branch_id for HQ users creating maintenance (excluding 'all' option)
      ...(isHQRole && selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
    };

    if (selectedMaintenance && isEditMaintenanceOpen) {
      updateMaintenanceMutation.mutate({ id: selectedMaintenance.id, data: maintenanceData });
    } else {
      scheduleMaintenance.mutate(maintenanceData);
    }
  };

  const filteredRecords = (maintenanceRecords as MaintenanceRecord[]).filter((record: MaintenanceRecord) => {
    const matchesSearch = searchTerm === '' || 
      record.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.maintenance_code.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading maintenance records...</div>;
  }

  const scheduledCount = (maintenanceRecords as MaintenanceRecord[]).filter((r: MaintenanceRecord) => r.status === 'scheduled').length;
  const inProgressCount = (maintenanceRecords as MaintenanceRecord[]).filter((r: MaintenanceRecord) => r.status === 'in_progress').length;
  const overdueCount = (maintenanceRecords as MaintenanceRecord[]).filter((r: MaintenanceRecord) => isOverdue(r.scheduled_date, r.status)).length;
  const completedThisMonth = (maintenanceRecords as MaintenanceRecord[]).filter((r: MaintenanceRecord) => {
    if (r.status !== 'completed' || !r.completed_at) return false;
    const completed = new Date(r.completed_at);
    const now = new Date();
    return completed.getMonth() === now.getMonth() && completed.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Maintenance Management</h2>
          <p className="text-muted-foreground">Schedule and track asset maintenance activities</p>
        </div>
        
        <Dialog open={isScheduleMaintenanceOpen} onOpenChange={setIsScheduleMaintenanceOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Maintenance
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold text-blue-600">{scheduledCount}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-yellow-600">{inProgressCount}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed This Month</p>
                <p className="text-2xl font-bold text-green-600">{completedThisMonth}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by asset name, title, or maintenance code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="preventive">Preventive</SelectItem>
            <SelectItem value="corrective">Corrective</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
            <SelectItem value="routine">Routine</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Upcoming Maintenance Schedule */}
      {upcomingSchedule && (upcomingSchedule as any)?.upcoming_maintenance && (upcomingSchedule as any).upcoming_maintenance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Upcoming Maintenance (Next 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(upcomingSchedule as any).upcoming_maintenance.slice(0, 5).map((record: MaintenanceRecord) => (
                <div key={record.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-3">
                    <Badge className={getTypeColor(record.maintenance_type)}>
                      {record.maintenance_type}
                    </Badge>
                    <span className="font-medium">{record.asset_name}</span>
                    <span className="text-sm text-muted-foreground">- {record.title}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{formatDate(record.scheduled_date)}</span>
                  </div>
                </div>
              ))}
              {(upcomingSchedule as any).upcoming_maintenance.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  And {(upcomingSchedule as any).upcoming_maintenance.length - 5} more...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Records */}
      {filteredRecords.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecords.map((record: MaintenanceRecord) => {
            const isRecordOverdue = isOverdue(record.scheduled_date, record.status);
            
            return (
              <Card key={record.id} className={`hover:shadow-md transition-shadow ${isRecordOverdue ? 'border-red-200' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center">
                        {getStatusIcon(isRecordOverdue ? 'overdue' : record.status)}
                        <span className="ml-2 truncate">{record.title}</span>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground font-mono">
                        {record.maintenance_code}
                      </p>
                      <p className="text-sm font-medium text-blue-600">
                        {record.asset_name}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Badge className={getStatusColor(isRecordOverdue ? 'overdue' : record.status)}>
                        {isRecordOverdue ? 'Overdue' : record.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline" className={getTypeColor(record.maintenance_type)}>
                        {record.maintenance_type}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {record.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{record.description}</p>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Scheduled:</span>
                      <span className={`font-medium ${isRecordOverdue ? 'text-red-600' : ''}`}>
                        {formatDate(record.scheduled_date)}
                        {isRecordOverdue && ' (Overdue)'}
                      </span>
                    </div>

                    {record.assigned_to_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Assigned to:</span>
                        <span className="font-medium">{record.assigned_to_name}</span>
                      </div>
                    )}

                    {record.performed_by_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Performed by:</span>
                        <span className="font-medium">{record.performed_by_name}</span>
                      </div>
                    )}

                    {record.started_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Started:</span>
                        <span className="font-medium">{formatDateTime(record.started_at)}</span>
                      </div>
                    )}

                    {record.completed_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Completed:</span>
                        <span className="font-medium">{formatDateTime(record.completed_at)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="font-medium">{formatCurrency(record.total_cost)}</span>
                    </div>

                    {record.next_maintenance_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Next Maintenance:</span>
                        <span className="font-medium">{formatDate(record.next_maintenance_date)}</span>
                      </div>
                    )}
                  </div>

                  {record.work_performed && (
                    <div className="p-2 bg-gray-50 rounded text-sm">
                      <span className="font-medium">Work Performed:</span>
                      <p className="mt-1 text-gray-600 line-clamp-2">{record.work_performed}</p>
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    {record.status === 'scheduled' && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 text-blue-600 hover:text-blue-700"
                          onClick={() => handleStartWork(record)}
                          disabled={startWorkMutation.isPending}
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          {startWorkMutation.isPending ? 'Starting...' : 'Start Work'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    
                    {record.status === 'in_progress' && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 text-green-600 hover:text-green-700"
                          onClick={() => handleCompleteWork(record)}
                          disabled={completeWorkMutation.isPending}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {completeWorkMutation.isPending ? 'Completing...' : 'Complete Work'}
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleEditMaintenance(record)}
                        disabled={record.status === 'completed'}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteMaintenance(record)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No maintenance records found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {searchTerm || (selectedStatus && selectedStatus !== 'all') || (selectedType && selectedType !== 'all')
                ? 'Try adjusting your filters'
                : 'Schedule your first maintenance to get started'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schedule Maintenance Dialog */}
      <Dialog open={isScheduleMaintenanceOpen} onOpenChange={setIsScheduleMaintenanceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule Maintenance</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleScheduleMaintenance} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="asset_id">Asset *</Label>
                <Select value={newMaintenance.asset_id} onValueChange={(value) => setNewMaintenance({ ...newMaintenance, asset_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {(assets as any[]).map((asset: any) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name} ({asset.asset_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance_type">Maintenance Type *</Label>
                <Select value={newMaintenance.maintenance_type} onValueChange={(value) => setNewMaintenance({ ...newMaintenance, maintenance_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventive</SelectItem>
                    <SelectItem value="corrective">Corrective</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance_title">Title *</Label>
              <Input
                id="maintenance_title"
                value={newMaintenance.title}
                onChange={(e) => setNewMaintenance({ ...newMaintenance, title: e.target.value })}
                placeholder="Enter maintenance title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance_description">Description</Label>
              <Textarea
                id="maintenance_description"
                value={newMaintenance.description}
                onChange={(e) => setNewMaintenance({ ...newMaintenance, description: e.target.value })}
                placeholder="Describe the maintenance work to be performed"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled_date">Scheduled Date *</Label>
                <Input
                  id="scheduled_date"
                  type="datetime-local"
                  value={newMaintenance.scheduled_date}
                  onChange={(e) => setNewMaintenance({ ...newMaintenance, scheduled_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated_cost">Estimated Cost ($)</Label>
                <Input
                  id="estimated_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newMaintenance.estimated_cost}
                  onChange={(e) => setNewMaintenance({ ...newMaintenance, estimated_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To (User ID)</Label>
              <Input
                id="assigned_to"
                value={newMaintenance.assigned_to}
                onChange={(e) => setNewMaintenance({ ...newMaintenance, assigned_to: e.target.value })}
                placeholder="Optional: User ID of assigned technician"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsScheduleMaintenanceOpen(false);
                  resetMaintenanceForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={scheduleMaintenance.isPending || updateMaintenanceMutation.isPending}
              >
                {(scheduleMaintenance.isPending || updateMaintenanceMutation.isPending) ? 'Saving...' : 'Schedule Maintenance'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Maintenance Dialog */}
      <Dialog open={isEditMaintenanceOpen} onOpenChange={setIsEditMaintenanceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Maintenance - {selectedMaintenance?.title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleScheduleMaintenance} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_asset_id">Asset *</Label>
                <Select value={newMaintenance.asset_id} onValueChange={(value) => setNewMaintenance({ ...newMaintenance, asset_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {(assets as any[]).map((asset: any) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name} ({asset.asset_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_maintenance_type">Maintenance Type *</Label>
                <Select value={newMaintenance.maintenance_type} onValueChange={(value) => setNewMaintenance({ ...newMaintenance, maintenance_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Preventive</SelectItem>
                    <SelectItem value="corrective">Corrective</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_maintenance_title">Title *</Label>
              <Input
                id="edit_maintenance_title"
                value={newMaintenance.title}
                onChange={(e) => setNewMaintenance({ ...newMaintenance, title: e.target.value })}
                placeholder="Enter maintenance title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_maintenance_description">Description</Label>
              <Textarea
                id="edit_maintenance_description"
                value={newMaintenance.description}
                onChange={(e) => setNewMaintenance({ ...newMaintenance, description: e.target.value })}
                placeholder="Describe the maintenance work to be performed"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_scheduled_date">Scheduled Date *</Label>
                <Input
                  id="edit_scheduled_date"
                  type="datetime-local"
                  value={newMaintenance.scheduled_date}
                  onChange={(e) => setNewMaintenance({ ...newMaintenance, scheduled_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_estimated_cost">Estimated Cost ($)</Label>
                <Input
                  id="edit_estimated_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newMaintenance.estimated_cost}
                  onChange={(e) => setNewMaintenance({ ...newMaintenance, estimated_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_assigned_to">Assign To (User ID)</Label>
              <Input
                id="edit_assigned_to"
                value={newMaintenance.assigned_to}
                onChange={(e) => setNewMaintenance({ ...newMaintenance, assigned_to: e.target.value })}
                placeholder="Optional: User ID of assigned technician"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditMaintenanceOpen(false);
                  setSelectedMaintenance(null);
                  resetMaintenanceForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMaintenanceMutation.isPending}
              >
                {updateMaintenanceMutation.isPending ? 'Updating...' : 'Update Maintenance'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Maintenance Confirmation Dialog */}
      <Dialog open={isDeleteMaintenanceOpen} onOpenChange={setIsDeleteMaintenanceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Maintenance Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the maintenance record "{selectedMaintenance?.title}" ({selectedMaintenance?.maintenance_code})?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDeleteMaintenanceOpen(false);
                  setSelectedMaintenance(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedMaintenance && deleteMaintenanceMutation.mutate(selectedMaintenance.id)}
                disabled={deleteMaintenanceMutation.isPending}
              >
                {deleteMaintenanceMutation.isPending ? 'Deleting...' : 'Delete Record'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
