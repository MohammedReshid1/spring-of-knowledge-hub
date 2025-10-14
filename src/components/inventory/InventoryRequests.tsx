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
import { Search, Plus, ClipboardList, CheckCircle, XCircle, Clock, User, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';

interface InventoryRequest {
  id: string;
  request_code: string;
  request_type: string;
  title: string;
  description?: string;
  requested_by: string;
  requested_by_name: string;
  department?: string;
  items: Array<{
    item_type: string;
    item_id: string;
    quantity: number;
    justification?: string;
  }>;
  requested_date: string;
  required_by_date?: string;
  status: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  priority: string;
  justification?: string;
  estimated_cost?: number;
  created_at: string;
}

export const InventoryRequests: React.FC = () => {
  const { selectedBranch, isHQRole } = useBranch();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [isCreateRequestOpen, setIsCreateRequestOpen] = useState(false);
  const [isEditRequestOpen, setIsEditRequestOpen] = useState(false);
  const [isDeleteRequestOpen, setIsDeleteRequestOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null);
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    request_type: 'asset_request',
    priority: 'medium',
    required_by_date: '',
    justification: ''
  });

  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery<InventoryRequest[]>({
    queryKey: ['inventory-requests', selectedBranch, selectedStatus, selectedType, searchTerm],
    queryFn: async (): Promise<InventoryRequest[]> => {
      const params = new URLSearchParams();
      if (isHQRole && selectedBranch && selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      }
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedType && selectedType !== 'all') params.append('request_type', selectedType);
      
      const response = await apiClient.get(`/inventory/requests?${params}`);
      return response.data as InventoryRequest[];
    },
    enabled: !isHQRole || !!selectedBranch
  });

  const createRequestMutation = useMutation({
    mutationFn: async (requestData: any) => {
      const response = await apiClient.post('/inventory/requests', requestData);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Request created successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
      setIsCreateRequestOpen(false);
      resetRequestForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create request');
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.put(`/inventory/requests/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Request updated successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
      setIsEditRequestOpen(false);
      setSelectedRequest(null);
      resetRequestForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update request');
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/inventory/requests/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Request deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
      setIsDeleteRequestOpen(false);
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete request');
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.put(`/inventory/requests/${id}/approve`, {});
      return response.data;
    },
    onSuccess: () => {
      toast.success('Request approved successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to approve request');
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.put(`/inventory/requests/${id}/reject`, { rejection_reason: reason });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Request rejected successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reject request');
    },
  });

  const fulfillRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.put(`/inventory/requests/${id}/fulfill`, {});
      return response.data;
    },
    onSuccess: () => {
      toast.success('Request fulfilled successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to fulfill request');
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'fulfilled': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'fulfilled': return <CheckCircle className="h-4 w-4" />;
      default: return <ClipboardList className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const resetRequestForm = () => {
    setNewRequest({
      title: '',
      description: '',
      request_type: 'asset_request',
      priority: 'medium',
      required_by_date: '',
      justification: ''
    });
  };

  const handleEditRequest = (request: InventoryRequest) => {
    setSelectedRequest(request);
    setNewRequest({
      title: request.title,
      description: request.description || '',
      request_type: request.request_type,
      priority: request.priority,
      required_by_date: request.required_by_date || '',
      justification: request.justification || ''
    });
    setIsEditRequestOpen(true);
  };

  const handleDeleteRequest = (request: InventoryRequest) => {
    setSelectedRequest(request);
    setIsDeleteRequestOpen(true);
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newRequest.title.trim() || !newRequest.request_type || !newRequest.priority) {
      toast.error('Please fill in required fields');
      return;
    }

    // For HQ roles creating requests, we need to include the selected branch_id (unless it's 'all')
    if (isHQRole && (!selectedBranch || selectedBranch === 'all')) {
      toast.error('Please select a specific branch before creating a request');
      return;
    }

    const requestData = {
      ...newRequest,
      items: [], // For now, create empty request - can be populated later
      required_by_date: newRequest.required_by_date || null,
      // Include branch_id for HQ users creating requests (excluding 'all' option)
      ...(isHQRole && selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
    };

    if (selectedRequest && isEditRequestOpen) {
      updateRequestMutation.mutate({ id: selectedRequest.id, data: requestData });
    } else {
      createRequestMutation.mutate(requestData);
    }
  };

  const filteredRequests = (requests as InventoryRequest[]).filter((request: InventoryRequest) => {
    const matchesSearch = searchTerm === '' || 
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.request_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requested_by_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading inventory requests...</div>;
  }

  const pendingCount = (requests as InventoryRequest[]).filter((r: InventoryRequest) => r.status === 'pending').length;
  const approvedCount = (requests as InventoryRequest[]).filter((r: InventoryRequest) => r.status === 'approved').length;
  const rejectedCount = (requests as InventoryRequest[]).filter((r: InventoryRequest) => r.status === 'rejected').length;
  const fulfilledCount = (requests as InventoryRequest[]).filter((r: InventoryRequest) => r.status === 'fulfilled').length;

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200/50">
                  <ClipboardList className="h-5 w-5 text-emerald-600" />
                </div>
                Inventory Requests
              </h2>
              <p className="text-slate-600 font-medium mt-1">Manage asset and supply requests from staff</p>
            </div>

            <Dialog open={isCreateRequestOpen} onOpenChange={setIsCreateRequestOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Request
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Premium Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-100 to-yellow-50 border border-yellow-200/50">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-100 to-green-50 border border-green-200/50">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-100 to-red-50 border border-red-200/50">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Fulfilled</p>
                <p className="text-2xl font-bold text-blue-600">{fulfilledCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200/50">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium Filters Card */}
      <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
        <CardContent className="p-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by title, code, or requester..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 border-emerald-200/50 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-300"
                />
              </div>
            </div>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48 border-emerald-200/50 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-300">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-48 border-emerald-200/50 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-300">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="asset_request">Asset Request</SelectItem>
                <SelectItem value="supply_request">Supply Request</SelectItem>
                <SelectItem value="maintenance_request">Maintenance Request</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Premium Requests Grid */}
      {filteredRequests.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRequests.map((request: InventoryRequest) => (
            <Card key={request.id} className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center">
                      {getStatusIcon(request.status)}
                      <span className="ml-2 truncate">{request.title}</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground font-mono">
                      {request.request_code}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge className={getStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                    <Badge variant="outline" className={getPriorityColor(request.priority)}>
                      {request.priority}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {request.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">{request.description}</p>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium capitalize">{request.request_type.replace('_', ' ')}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requested by:</span>
                    <span className="font-medium">{request.requested_by_name}</span>
                  </div>

                  {request.department && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Department:</span>
                      <span className="font-medium">{request.department}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requested Date:</span>
                    <span className="font-medium">{formatDate(request.requested_date)}</span>
                  </div>

                  {request.required_by_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Required by:</span>
                      <span className="font-medium">{formatDate(request.required_by_date)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span className="font-medium">{request.items.length} item(s)</span>
                  </div>

                  {request.approved_by_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved by:</span>
                      <span className="font-medium">{request.approved_by_name}</span>
                    </div>
                  )}

                  {request.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved at:</span>
                      <span className="font-medium">{formatDateTime(request.approved_at)}</span>
                    </div>
                  )}
                </div>

                {/* Items List */}
                {request.items.length > 0 && (
                  <div className="p-2 bg-gray-50 rounded">
                    <h4 className="text-sm font-medium mb-2">Requested Items:</h4>
                    <div className="space-y-1">
                      {request.items.slice(0, 3).map((item: any, index: number) => (
                        <div key={index} className="text-xs flex justify-between">
                          <span>{item.item_type}: {item.item_id}</span>
                          <span>Qty: {item.quantity}</span>
                        </div>
                      ))}
                      {request.items.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{request.items.length - 3} more items...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {request.justification && (
                  <div className="p-2 bg-blue-50 rounded text-sm">
                    <span className="font-medium">Justification:</span>
                    <p className="mt-1 text-gray-600 line-clamp-2">{request.justification}</p>
                  </div>
                )}

                {request.rejection_reason && (
                  <div className="p-2 bg-red-50 rounded text-sm">
                    <span className="font-medium text-red-800">Rejection Reason:</span>
                    <p className="mt-1 text-red-600 line-clamp-2">{request.rejection_reason}</p>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-emerald-200/50 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all duration-300"
                        onClick={() => approveRequestMutation.mutate(request.id)}
                        disabled={approveRequestMutation.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-red-600 hover:text-red-700 border-red-200/50 hover:bg-red-50 hover:border-red-400 transition-all duration-300"
                        onClick={() => rejectRequestMutation.mutate({ id: request.id, reason: 'Rejected by admin' })}
                        disabled={rejectRequestMutation.isPending}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {request.status === 'approved' && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-emerald-200/50 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all duration-300"
                        onClick={() => fulfillRequestMutation.mutate(request.id)}
                        disabled={fulfillRequestMutation.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {fulfillRequestMutation.isPending ? 'Fulfilling...' : 'Fulfill Request'}
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-emerald-200/50 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all duration-300"
                      onClick={() => handleEditRequest(request)}
                      disabled={request.status === 'fulfilled'}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRequest(request)}
                      className="text-red-600 hover:text-red-700 border-red-200/50 hover:bg-red-50 hover:border-red-400 transition-all duration-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
          <CardContent className="text-center py-12">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200/50 w-fit mx-auto mb-4">
              <ClipboardList className="h-12 w-12 text-emerald-600" />
            </div>
            <p className="text-slate-600 font-medium text-lg">No inventory requests found</p>
            <p className="text-sm text-slate-500 mt-2">
              {searchTerm || (selectedStatus && selectedStatus !== 'all') || (selectedType && selectedType !== 'all')
                ? 'Try adjusting your filters'
                : 'Create your first inventory request to get started'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Premium Create Request Dialog */}
      <Dialog open={isCreateRequestOpen} onOpenChange={setIsCreateRequestOpen}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-sm border-emerald-200/50">
          <DialogHeader>
            <DialogTitle className="text-xl bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
              Create New Inventory Request
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-700 font-medium">Request Title *</Label>
                <Input
                  id="title"
                  value={newRequest.title}
                  onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                  placeholder="Enter request title"
                  className="border-emerald-200/50 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-300"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="request_type" className="text-slate-700 font-medium">Request Type *</Label>
                <Select value={newRequest.request_type} onValueChange={(value) => setNewRequest({ ...newRequest, request_type: value })}>
                  <SelectTrigger className="border-emerald-200/50 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-300">
                    <SelectValue placeholder="Select request type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset_request">Asset Request</SelectItem>
                    <SelectItem value="supply_request">Supply Request</SelectItem>
                    <SelectItem value="maintenance_request">Maintenance Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-slate-700 font-medium">Priority *</Label>
                <Select value={newRequest.priority} onValueChange={(value) => setNewRequest({ ...newRequest, priority: value })}>
                  <SelectTrigger className="border-emerald-200/50 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-300">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="required_by_date" className="text-slate-700 font-medium">Required By Date</Label>
                <Input
                  id="required_by_date"
                  type="date"
                  value={newRequest.required_by_date}
                  onChange={(e) => setNewRequest({ ...newRequest, required_by_date: e.target.value })}
                  className="border-emerald-200/50 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-700 font-medium">Description</Label>
              <Textarea
                id="description"
                value={newRequest.description}
                onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                placeholder="Provide details about what you're requesting"
                className="border-emerald-200/50 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-300"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification" className="text-slate-700 font-medium">Justification</Label>
              <Textarea
                id="justification"
                value={newRequest.justification}
                onChange={(e) => setNewRequest({ ...newRequest, justification: e.target.value })}
                placeholder="Explain why this request is needed"
                className="border-emerald-200/50 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all duration-300"
                rows={3}
              />
            </div>

            <div className="p-3 bg-gray-50 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Items:</span>
                <span className="text-sm font-medium">0 item(s)</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Items can be added after creating the request
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateRequestOpen(false);
                  resetRequestForm();
                }}
                className="border-emerald-200/50 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all duration-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRequestMutation.isPending || updateRequestMutation.isPending}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {(createRequestMutation.isPending || updateRequestMutation.isPending) ? 'Saving...' : 'Create Request'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Premium Edit Request Dialog */}
      <Dialog open={isEditRequestOpen} onOpenChange={setIsEditRequestOpen}>
        <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-sm border-emerald-200/50">
          <DialogHeader>
            <DialogTitle className="text-xl bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
              Edit Request - {selectedRequest?.title}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_title">Request Title *</Label>
                <Input
                  id="edit_title"
                  value={newRequest.title}
                  onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                  placeholder="Enter request title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_request_type">Request Type *</Label>
                <Select value={newRequest.request_type} onValueChange={(value) => setNewRequest({ ...newRequest, request_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select request type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset_request">Asset Request</SelectItem>
                    <SelectItem value="supply_request">Supply Request</SelectItem>
                    <SelectItem value="maintenance_request">Maintenance Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_priority">Priority *</Label>
                <Select value={newRequest.priority} onValueChange={(value) => setNewRequest({ ...newRequest, priority: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_required_by_date">Required By Date</Label>
                <Input
                  id="edit_required_by_date"
                  type="date"
                  value={newRequest.required_by_date}
                  onChange={(e) => setNewRequest({ ...newRequest, required_by_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={newRequest.description}
                onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                placeholder="Provide details about what you're requesting"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_justification">Justification</Label>
              <Textarea
                id="edit_justification"
                value={newRequest.justification}
                onChange={(e) => setNewRequest({ ...newRequest, justification: e.target.value })}
                placeholder="Explain why this request is needed"
                rows={3}
              />
            </div>

            <div className="p-3 bg-gray-50 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Items:</span>
                <span className="text-sm font-medium">{selectedRequest?.items.length || 0} item(s)</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Items can be managed after updating the request
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditRequestOpen(false);
                  setSelectedRequest(null);
                  resetRequestForm();
                }}
                className="border-emerald-200/50 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all duration-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateRequestMutation.isPending}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {updateRequestMutation.isPending ? 'Updating...' : 'Update Request'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Premium Delete Request Confirmation Dialog */}
      <Dialog open={isDeleteRequestOpen} onOpenChange={setIsDeleteRequestOpen}>
        <DialogContent className="max-w-md bg-white/95 backdrop-blur-sm border-red-200/50">
          <DialogHeader>
            <DialogTitle className="text-xl text-red-700">Delete Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete the request "{selectedRequest?.title}" ({selectedRequest?.request_code})?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDeleteRequestOpen(false);
                  setSelectedRequest(null);
                }}
                className="border-emerald-200/50 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 transition-all duration-300"
              >
                Cancel
              </Button>
              <Button
                onClick={() => selectedRequest && deleteRequestMutation.mutate(selectedRequest.id)}
                disabled={deleteRequestMutation.isPending}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {deleteRequestMutation.isPending ? 'Deleting...' : 'Delete Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
