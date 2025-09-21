import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Monitor, Settings, AlertTriangle, CheckCircle, Calendar, DollarSign, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';

interface Asset {
  id: string;
  asset_code: string;
  name: string;
  description?: string;
  category: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  purchase_price?: number;
  purchase_date?: string;
  status: string;
  condition: string;
  location?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  warranty_expiry?: string;
  next_maintenance?: string;
  created_at: string;
}

export const AssetManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetForm, setAssetForm] = useState({
    name: '',
    description: '',
    category: 'electronics',
    brand: '',
    model: '',
    serial_number: '',
    purchase_price: '',
    purchase_date: '',
    status: 'active',
    condition: 'good',
    location: '',
    warranty_expiry: '',
  });

  const queryClient = useQueryClient();
  const { selectedBranch, isHQRole } = useBranch();

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ['assets', selectedCategory, selectedStatus, searchTerm, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchTerm) params.append('search', searchTerm);
      
      // Add branch filtering for HQ users
      if (isHQRole && selectedBranch && selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      }
      
      const response = await apiClient.get(`/inventory/assets?${params}`);
      return response.data as Asset[];
    },
    enabled: !isHQRole || !!selectedBranch, // For HQ users, only fetch when a branch is selected
  });

  const createAssetMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/inventory/assets', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Asset created successfully');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create asset');
    },
  });

  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.put(`/inventory/assets/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Asset updated successfully');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setIsEditDialogOpen(false);
      setSelectedAsset(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update asset');
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/inventory/assets/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Asset deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setIsDeleteDialogOpen(false);
      setSelectedAsset(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete asset');
    },
  });

  const resetForm = () => {
    setAssetForm({
      name: '',
      description: '',
      category: 'electronics',
      brand: '',
      model: '',
      serial_number: '',
      purchase_price: '',
      purchase_date: '',
      status: 'active',
      condition: 'good',
      location: '',
      warranty_expiry: '',
    });
  };

  const handleEdit = (asset: Asset) => {
    setSelectedAsset(asset);
    setAssetForm({
      name: asset.name,
      description: asset.description || '',
      category: asset.category,
      brand: asset.brand || '',
      model: asset.model || '',
      serial_number: asset.serial_number || '',
      purchase_price: asset.purchase_price?.toString() || '',
      purchase_date: asset.purchase_date || '',
      status: asset.status,
      condition: asset.condition,
      location: asset.location || '',
      warranty_expiry: asset.warranty_expiry || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assetForm.name.trim()) {
      toast.error('Asset name is required');
      return;
    }

    // For HQ roles creating assets, we need to include the selected branch_id
    if (isHQRole && !selectedBranch) {
      toast.error('Please select a branch first');
      return;
    }

    const assetData = {
      ...assetForm,
      purchase_price: assetForm.purchase_price ? parseFloat(assetForm.purchase_price) : undefined,
      purchase_date: assetForm.purchase_date || undefined,
      warranty_expiry: assetForm.warranty_expiry || undefined,
      // Include branch_id for HQ users creating assets
      ...(isHQRole && selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
    };

    if (selectedAsset && isEditDialogOpen) {
      updateAssetMutation.mutate({ id: selectedAsset.id, data: assetData });
    } else {
      createAssetMutation.mutate(assetData);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'under_maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'damaged': return 'bg-red-100 text-red-800';
      case 'lost': return 'bg-purple-100 text-purple-800';
      case 'disposed': return 'bg-black text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-orange-100 text-orange-800';
      case 'broken': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'under_maintenance': return <Settings className="h-4 w-4" />;
      case 'damaged': return <AlertTriangle className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading assets...</div>;
  }

  // Show branch selection message for HQ users who haven't selected a branch
  if (isHQRole && !selectedBranch) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Asset Management</h2>
            <p className="text-muted-foreground">Track and manage school equipment and property</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="text-center py-12">
            <Monitor className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a Branch</h3>
            <p className="text-muted-foreground mb-4">
              Please select a branch using the branch selector in the top navigation to view and manage assets.
            </p>
            <p className="text-sm text-muted-foreground">
              As a superadmin, you can switch between branches to manage their respective inventories.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Asset Management</h2>
          <p className="text-muted-foreground">Track and manage school equipment and property</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Asset</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Asset Name *</Label>
                  <Input
                    id="name"
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                    placeholder="Enter asset name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={assetForm.category}
                    onValueChange={(value) => setAssetForm({ ...assetForm, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                      <SelectItem value="books">Books</SelectItem>
                      <SelectItem value="sports_equipment">Sports Equipment</SelectItem>
                      <SelectItem value="laboratory">Laboratory</SelectItem>
                      <SelectItem value="vehicles">Vehicles</SelectItem>
                      <SelectItem value="office_supplies">Office Supplies</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="teaching_materials">Teaching Materials</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={assetForm.description}
                  onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
                  placeholder="Asset description"
                  rows={2}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={assetForm.brand}
                    onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })}
                    placeholder="Brand name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={assetForm.model}
                    onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                    placeholder="Model number"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    value={assetForm.serial_number}
                    onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
                    placeholder="Serial number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={assetForm.location}
                    onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                    placeholder="Room, building, etc."
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Purchase Price</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    value={assetForm.purchase_price}
                    onChange={(e) => setAssetForm({ ...assetForm, purchase_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={assetForm.purchase_date}
                    onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={assetForm.status}
                    onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="disposed">Disposed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="condition">Condition</Label>
                  <Select
                    value={assetForm.condition}
                    onValueChange={(value) => setAssetForm({ ...assetForm, condition: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                      <SelectItem value="broken">Broken</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
                  <Input
                    id="warranty_expiry"
                    type="date"
                    value={assetForm.warranty_expiry}
                    onChange={(e) => setAssetForm({ ...assetForm, warranty_expiry: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAssetMutation.isPending}
                >
                  {createAssetMutation.isPending ? 'Creating...' : 'Create Asset'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Asset Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Asset - {selectedAsset?.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_name">Asset Name *</Label>
                  <Input
                    id="edit_name"
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_category">Category *</Label>
                  <Select value={assetForm.category} onValueChange={(value) => setAssetForm({ ...assetForm, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                      <SelectItem value="vehicles">Vehicles</SelectItem>
                      <SelectItem value="machinery">Machinery</SelectItem>
                      <SelectItem value="office_supplies">Office Supplies</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  value={assetForm.description}
                  onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_brand">Brand</Label>
                  <Input
                    id="edit_brand"
                    value={assetForm.brand}
                    onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_model">Model</Label>
                  <Input
                    id="edit_model"
                    value={assetForm.model}
                    onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_serial">Serial Number</Label>
                  <Input
                    id="edit_serial"
                    value={assetForm.serial_number}
                    onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_location">Location</Label>
                  <Input
                    id="edit_location"
                    value={assetForm.location}
                    onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_price">Purchase Price</Label>
                  <Input
                    id="edit_price"
                    type="number"
                    step="0.01"
                    value={assetForm.purchase_price}
                    onChange={(e) => setAssetForm({ ...assetForm, purchase_price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_purchase_date">Purchase Date</Label>
                  <Input
                    id="edit_purchase_date"
                    type="date"
                    value={assetForm.purchase_date}
                    onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_status">Status</Label>
                  <Select value={assetForm.status} onValueChange={(value) => setAssetForm({ ...assetForm, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                      <SelectItem value="disposed">Disposed</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_condition">Condition</Label>
                  <Select value={assetForm.condition} onValueChange={(value) => setAssetForm({ ...assetForm, condition: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                      <SelectItem value="broken">Broken</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_warranty">Warranty Expiry</Label>
                  <Input
                    id="edit_warranty"
                    type="date"
                    value={assetForm.warranty_expiry}
                    onChange={(e) => setAssetForm({ ...assetForm, warranty_expiry: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedAsset(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateAssetMutation.isPending}>
                  {updateAssetMutation.isPending ? 'Updating...' : 'Update Asset'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Asset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the asset "{selectedAsset?.name}" ({selectedAsset?.asset_code})?
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDeleteDialogOpen(false);
                    setSelectedAsset(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => selectedAsset && deleteAssetMutation.mutate(selectedAsset.id)}
                  disabled={deleteAssetMutation.isPending}
                >
                  {deleteAssetMutation.isPending ? 'Deleting...' : 'Delete Asset'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets by name, code, brand, or model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="electronics">Electronics</SelectItem>
            <SelectItem value="furniture">Furniture</SelectItem>
            <SelectItem value="books">Books</SelectItem>
            <SelectItem value="sports_equipment">Sports Equipment</SelectItem>
            <SelectItem value="laboratory">Laboratory</SelectItem>
            <SelectItem value="vehicles">Vehicles</SelectItem>
            <SelectItem value="office_supplies">Office Supplies</SelectItem>
            <SelectItem value="technology">Technology</SelectItem>
            <SelectItem value="teaching_materials">Teaching Materials</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
            <SelectItem value="damaged">Damaged</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="disposed">Disposed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assets Grid */}
      {(assets as Asset[]).length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(assets as Asset[]).map((asset: Asset) => (
            <Card key={asset.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center">
                      {getStatusIcon(asset.status)}
                      <span className="ml-2 truncate">{asset.name}</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground font-mono">
                      {asset.asset_code}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge className={getStatusColor(asset.status)}>
                      {asset.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className={getConditionColor(asset.condition)}>
                      {asset.condition}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {asset.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">{asset.description}</p>
                )}

                <div className="space-y-2 text-sm">
                  {asset.brand && asset.model && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Brand/Model:</span>
                      <span className="font-medium">{asset.brand} {asset.model}</span>
                    </div>
                  )}

                  {asset.category && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-medium capitalize">{asset.category.replace('_', ' ')}</span>
                    </div>
                  )}

                  {asset.location && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium">{asset.location}</span>
                    </div>
                  )}

                  {asset.assigned_to_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigned to:</span>
                      <span className="font-medium">{asset.assigned_to_name}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Purchase Price:</span>
                    <span className="font-medium">{formatCurrency(asset.purchase_price)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Purchase Date:</span>
                    <span className="font-medium">{formatDate(asset.purchase_date)}</span>
                  </div>

                  {asset.warranty_expiry && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Warranty:</span>
                      <span className="font-medium flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(asset.warranty_expiry)}
                      </span>
                    </div>
                  )}

                  {asset.next_maintenance && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Next Maintenance:</span>
                      <span className="font-medium flex items-center">
                        <Settings className="h-3 w-3 mr-1" />
                        {formatDate(asset.next_maintenance)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleEdit(asset)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDelete(asset)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No assets found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {searchTerm || selectedCategory || selectedStatus
                ? 'Try adjusting your filters'
                : 'Add your first asset to get started'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};