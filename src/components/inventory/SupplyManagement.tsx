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
import { Search, Plus, Package, AlertTriangle, TrendingDown, TrendingUp, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '@/contexts/BranchContext';

interface Supply {
  id: string;
  supply_code: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  quantity_in_stock: number;
  minimum_stock_level: number;
  maximum_stock_level?: number;
  reorder_point: number;
  unit_cost?: number;
  total_value?: number;
  storage_location?: string;
  supplier?: string;
  expiry_date?: string;
  is_active: boolean;
  created_at: string;
}

export const SupplyManagement: React.FC = () => {
  const { selectedBranch, isHQRole } = useBranch();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [isStockUpdateOpen, setIsStockUpdateOpen] = useState(false);
  const [isAddSupplyOpen, setIsAddSupplyOpen] = useState(false);
  const [isEditSupplyOpen, setIsEditSupplyOpen] = useState(false);
  const [isDeleteSupplyOpen, setIsDeleteSupplyOpen] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);
  const [stockUpdate, setStockUpdate] = useState({
    quantity_change: '',
    reason: '',
  });
  const [newSupply, setNewSupply] = useState({
    name: '',
    description: '',
    category: 'office_supplies',
    unit: '',
    quantity_in_stock: '',
    minimum_stock_level: '',
    maximum_stock_level: '',
    unit_cost: '',
    storage_location: '',
    supplier: '',
    expiry_date: ''
  });

  const queryClient = useQueryClient();

  const { data: supplies = [], isLoading } = useQuery<Supply[]>({
    queryKey: ['supplies', selectedBranch, selectedCategory, showLowStock, searchTerm],
    queryFn: async (): Promise<Supply[]> => {
      const params = new URLSearchParams();
      // HQ roles can view all or a specific branch; non-HQ are server-restricted
      if (isHQRole && selectedBranch && selectedBranch !== 'all') {
        params.append('branch_id', selectedBranch);
      }
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      if (showLowStock) params.append('low_stock', 'true');
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await apiClient.get(`/inventory/supplies?${params}`);
      return response.data as Supply[];
    },
    enabled: !isHQRole || !!selectedBranch
  });

  const updateStockMutation = useMutation({
    mutationFn: async (data: { supply_id: string; quantity_change: number; reason: string }) => {
      const response = await apiClient.put(`/inventory/supplies/${data.supply_id}/stock`, {
        quantity_change: data.quantity_change,
        reason: data.reason,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Stock updated successfully');
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setIsStockUpdateOpen(false);
      setSelectedSupply(null);
      setStockUpdate({ quantity_change: '', reason: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update stock');
    },
  });

  const addSupplyMutation = useMutation({
    mutationFn: async (supplyData: any) => {
      const response = await apiClient.post('/inventory/supplies', supplyData);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Supply added successfully');
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setIsAddSupplyOpen(false);
      resetSupplyForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add supply');
    },
  });

  const updateSupplyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiClient.put(`/inventory/supplies/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Supply updated successfully');
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setIsEditSupplyOpen(false);
      setSelectedSupply(null);
      resetSupplyForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update supply');
    },
  });

  const deleteSupplyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/inventory/supplies/${id}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Supply deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setIsDeleteSupplyOpen(false);
      setSelectedSupply(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete supply');
    },
  });

  const handleStockUpdate = (supply: Supply, type: 'in' | 'out') => {
    setSelectedSupply(supply);
    setStockUpdate({
      quantity_change: type === 'out' ? '-' : '',
      reason: type === 'out' ? 'Stock consumption' : 'Stock replenishment',
    });
    setIsStockUpdateOpen(true);
  };

  const handleStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSupply || !stockUpdate.quantity_change.trim() || !stockUpdate.reason.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const quantityChange = parseInt(stockUpdate.quantity_change);
    if (isNaN(quantityChange) || quantityChange === 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    updateStockMutation.mutate({
      supply_id: selectedSupply.id,
      quantity_change: quantityChange,
      reason: stockUpdate.reason,
    });
  };

  const resetSupplyForm = () => {
    setNewSupply({
      name: '',
      description: '',
      category: 'office_supplies',
      unit: '',
      quantity_in_stock: '',
      minimum_stock_level: '',
      maximum_stock_level: '',
      unit_cost: '',
      storage_location: '',
      supplier: '',
      expiry_date: ''
    });
  };

  const handleEditSupply = (supply: Supply) => {
    setSelectedSupply(supply);
    setNewSupply({
      name: supply.name,
      description: supply.description || '',
      category: supply.category,
      unit: supply.unit,
      quantity_in_stock: supply.quantity_in_stock?.toString() || '',
      minimum_stock_level: supply.minimum_stock_level?.toString() || '',
      maximum_stock_level: supply.maximum_stock_level?.toString() || '',
      unit_cost: supply.unit_cost?.toString() || '',
      storage_location: supply.storage_location || '',
      supplier: supply.supplier || '',
      expiry_date: supply.expiry_date || ''
    });
    setIsEditSupplyOpen(true);
  };

  const handleDeleteSupply = (supply: Supply) => {
    setSelectedSupply(supply);
    setIsDeleteSupplyOpen(true);
  };

  const handleAddSupply = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newSupply.name.trim() || !newSupply.unit.trim() || !newSupply.quantity_in_stock.trim() || !newSupply.minimum_stock_level.trim()) {
      toast.error('Please fill in required fields (Name, Unit, Current Stock, Minimum Stock)');
      return;
    }

    // For HQ roles creating supplies, we need to include the selected branch_id (unless it's 'all')
    if (isHQRole && (!selectedBranch || selectedBranch === 'all')) {
      toast.error('Please select a specific branch before creating a supply');
      return;
    }

    const quantityInStock = parseInt(newSupply.quantity_in_stock);
    const minimumStock = parseInt(newSupply.minimum_stock_level);
    const maximumStock = newSupply.maximum_stock_level ? parseInt(newSupply.maximum_stock_level) : null;
    const unitCost = newSupply.unit_cost ? parseFloat(newSupply.unit_cost) : null;

    if (isNaN(quantityInStock) || quantityInStock < 0) {
      toast.error('Please enter a valid quantity in stock');
      return;
    }

    if (isNaN(minimumStock) || minimumStock < 0) {
      toast.error('Please enter a valid minimum stock level');
      return;
    }

    const supplyData = {
      name: newSupply.name.trim(),
      description: newSupply.description.trim() || null,
      category: newSupply.category,
      unit: newSupply.unit.trim(),
      quantity_in_stock: quantityInStock,
      minimum_stock_level: minimumStock,
      maximum_stock_level: maximumStock,
      unit_cost: unitCost,
      storage_location: newSupply.storage_location.trim() || null,
      supplier: newSupply.supplier.trim() || null,
      expiry_date: newSupply.expiry_date || null,
      // Include branch_id for HQ users creating supplies (excluding 'all' option)
      ...(isHQRole && selectedBranch && selectedBranch !== 'all' ? { branch_id: selectedBranch } : {}),
    };

    if (selectedSupply && isEditSupplyOpen) {
      updateSupplyMutation.mutate({ id: selectedSupply.id, data: supplyData });
    } else {
      addSupplyMutation.mutate(supplyData);
    }
  };

  const getStockStatus = (supply: Supply) => {
    if (supply.quantity_in_stock <= 0) {
      return { status: 'out_of_stock', color: 'bg-red-100 text-red-800', label: 'Out of Stock' };
    } else if (supply.quantity_in_stock <= supply.minimum_stock_level) {
      return { status: 'low_stock', color: 'bg-yellow-100 text-yellow-800', label: 'Low Stock' };
    } else if (supply.maximum_stock_level && supply.quantity_in_stock >= supply.maximum_stock_level) {
      return { status: 'overstock', color: 'bg-purple-100 text-purple-800', label: 'Overstock' };
    } else {
      return { status: 'adequate', color: 'bg-green-100 text-green-800', label: 'Adequate' };
    }
  };

  const getStockPercentage = (supply: Supply) => {
    if (supply.maximum_stock_level) {
      return (supply.quantity_in_stock / supply.maximum_stock_level) * 100;
    }
    return (supply.quantity_in_stock / (supply.minimum_stock_level * 2)) * 100;
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

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading supplies...</div>;
  }

  const lowStockCount = (supplies as Supply[]).filter((supply: Supply) => supply.quantity_in_stock <= supply.minimum_stock_level).length;
  const outOfStockCount = (supplies as Supply[]).filter((supply: Supply) => supply.quantity_in_stock <= 0).length;
  const expiringSoonCount = (supplies as Supply[]).filter((supply: Supply) => isExpiringSoon(supply.expiry_date)).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Supply Management</h2>
          <p className="text-muted-foreground">Track consumable items and stock levels</p>
        </div>
        
        <Dialog open={isAddSupplyOpen} onOpenChange={setIsAddSupplyOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Supply
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
                <p className="text-sm font-medium text-muted-foreground">Total Supplies</p>
                <p className="text-2xl font-bold">{(supplies as Supply[]).length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold text-orange-600">{expiringSoonCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
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
              placeholder="Search supplies by name or code..."
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
            <SelectItem value="office_supplies">Office Supplies</SelectItem>
            <SelectItem value="cleaning_supplies">Cleaning Supplies</SelectItem>
            <SelectItem value="teaching_materials">Teaching Materials</SelectItem>
            <SelectItem value="laboratory">Laboratory</SelectItem>
            <SelectItem value="kitchen_equipment">Kitchen Equipment</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={showLowStock ? "default" : "outline"}
          onClick={() => setShowLowStock(!showLowStock)}
        >
          {showLowStock ? 'Show All' : 'Low Stock Only'}
        </Button>
      </div>

      {/* Supplies Grid */}
      {(supplies as Supply[]).length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(supplies as Supply[]).map((supply: Supply) => {
            const stockStatus = getStockStatus(supply);
            const stockPercentage = getStockPercentage(supply);
            
            return (
              <Card key={supply.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center">
                        <Package className="h-4 w-4 mr-2" />
                        <span className="truncate">{supply.name}</span>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground font-mono">
                        {supply.supply_code}
                      </p>
                    </div>
                    <Badge className={stockStatus.color}>
                      {stockStatus.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {supply.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{supply.description}</p>
                  )}

                  {/* Stock Level Visualization */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Stock Level</span>
                      <span className="font-bold">
                        {supply.quantity_in_stock} {supply.unit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          stockStatus.status === 'out_of_stock' ? 'bg-red-600' :
                          stockStatus.status === 'low_stock' ? 'bg-yellow-600' :
                          stockStatus.status === 'overstock' ? 'bg-purple-600' : 'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Min: {supply.minimum_stock_level}</span>
                      {supply.maximum_stock_level && (
                        <span>Max: {supply.maximum_stock_level}</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-medium capitalize">{supply.category.replace('_', ' ')}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unit Cost:</span>
                      <span className="font-medium">{formatCurrency(supply.unit_cost)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Value:</span>
                      <span className="font-medium">{formatCurrency(supply.total_value)}</span>
                    </div>

                    {supply.storage_location && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location:</span>
                        <span className="font-medium">{supply.storage_location}</span>
                      </div>
                    )}

                    {supply.supplier && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Supplier:</span>
                        <span className="font-medium">{supply.supplier}</span>
                      </div>
                    )}

                    {supply.expiry_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expiry:</span>
                        <span className={`font-medium ${
                          isExpired(supply.expiry_date) ? 'text-red-600' :
                          isExpiringSoon(supply.expiry_date) ? 'text-orange-600' : ''
                        }`}>
                          {formatDate(supply.expiry_date)}
                          {isExpired(supply.expiry_date) && ' (Expired)'}
                          {isExpiringSoon(supply.expiry_date) && ' (Soon)'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStockUpdate(supply, 'in')}
                        className="flex-1"
                      >
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Stock In
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStockUpdate(supply, 'out')}
                        className="flex-1"
                        disabled={supply.quantity_in_stock <= 0}
                      >
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Stock Out
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSupply(supply)}
                        className="flex-1"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSupply(supply)}
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
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No supplies found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {searchTerm || (selectedCategory && selectedCategory !== 'all') || showLowStock
                ? 'Try adjusting your filters'
                : 'Add your first supply item to get started'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stock Update Dialog */}
      <Dialog open={isStockUpdateOpen} onOpenChange={setIsStockUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Update Stock - {selectedSupply?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStockSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Stock</label>
              <p className="text-lg font-bold">
                {selectedSupply?.quantity_in_stock} {selectedSupply?.unit}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="quantity_change" className="text-sm font-medium">
                Quantity Change
              </label>
              <Input
                id="quantity_change"
                type="number"
                value={stockUpdate.quantity_change}
                onChange={(e) => setStockUpdate({ ...stockUpdate, quantity_change: e.target.value })}
                placeholder="Enter positive for stock in, negative for stock out"
              />
              <p className="text-xs text-muted-foreground">
                Use positive numbers for stock in, negative for stock out
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="reason" className="text-sm font-medium">
                Reason
              </label>
              <Input
                id="reason"
                value={stockUpdate.reason}
                onChange={(e) => setStockUpdate({ ...stockUpdate, reason: e.target.value })}
                placeholder="Reason for stock change"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStockUpdateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateStockMutation.isPending}
              >
                {updateStockMutation.isPending ? 'Updating...' : 'Update Stock'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Supply Dialog */}
      <Dialog open={isAddSupplyOpen} onOpenChange={setIsAddSupplyOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Supply Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSupply} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supply_name">Supply Name *</Label>
                <Input
                  id="supply_name"
                  value={newSupply.name}
                  onChange={(e) => setNewSupply({ ...newSupply, name: e.target.value })}
                  placeholder="Enter supply name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supply_category">Category *</Label>
                <Select value={newSupply.category} onValueChange={(value) => setNewSupply({ ...newSupply, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office_supplies">Office Supplies</SelectItem>
                    <SelectItem value="cleaning_supplies">Cleaning Supplies</SelectItem>
                    <SelectItem value="teaching_materials">Teaching Materials</SelectItem>
                    <SelectItem value="laboratory">Laboratory</SelectItem>
                    <SelectItem value="kitchen_equipment">Kitchen Equipment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supply_description">Description</Label>
              <Textarea
                id="supply_description"
                value={newSupply.description}
                onChange={(e) => setNewSupply({ ...newSupply, description: e.target.value })}
                placeholder="Describe the supply item"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supply_unit">Unit *</Label>
                <Input
                  id="supply_unit"
                  value={newSupply.unit}
                  onChange={(e) => setNewSupply({ ...newSupply, unit: e.target.value })}
                  placeholder="e.g., pieces, packs, boxes"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supply_current_stock">Current Stock *</Label>
                <Input
                  id="supply_current_stock"
                  type="number"
                  min="0"
                  value={newSupply.quantity_in_stock}
                  onChange={(e) => setNewSupply({ ...newSupply, quantity_in_stock: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supply_unit_cost">Unit Cost ($)</Label>
                <Input
                  id="supply_unit_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newSupply.unit_cost}
                  onChange={(e) => setNewSupply({ ...newSupply, unit_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supply_min_stock">Minimum Stock Level *</Label>
                <Input
                  id="supply_min_stock"
                  type="number"
                  min="0"
                  value={newSupply.minimum_stock_level}
                  onChange={(e) => setNewSupply({ ...newSupply, minimum_stock_level: e.target.value })}
                  placeholder="5"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supply_max_stock">Maximum Stock Level</Label>
                <Input
                  id="supply_max_stock"
                  type="number"
                  min="0"
                  value={newSupply.maximum_stock_level}
                  onChange={(e) => setNewSupply({ ...newSupply, maximum_stock_level: e.target.value })}
                  placeholder="50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supply_storage">Storage Location</Label>
                <Input
                  id="supply_storage"
                  value={newSupply.storage_location}
                  onChange={(e) => setNewSupply({ ...newSupply, storage_location: e.target.value })}
                  placeholder="e.g., Storage Room A, Shelf 3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supply_supplier">Supplier</Label>
                <Input
                  id="supply_supplier"
                  value={newSupply.supplier}
                  onChange={(e) => setNewSupply({ ...newSupply, supplier: e.target.value })}
                  placeholder="e.g., Office Depot, Amazon"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supply_expiry">Expiry Date</Label>
              <Input
                id="supply_expiry"
                type="date"
                value={newSupply.expiry_date}
                onChange={(e) => setNewSupply({ ...newSupply, expiry_date: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddSupplyOpen(false);
                  resetSupplyForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addSupplyMutation.isPending || updateSupplyMutation.isPending}
              >
                {(addSupplyMutation.isPending || updateSupplyMutation.isPending) 
                  ? (isEditSupplyOpen ? 'Updating...' : 'Adding...') 
                  : (isEditSupplyOpen ? 'Update Supply' : 'Add Supply')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Supply Dialog */}
      <Dialog open={isEditSupplyOpen} onOpenChange={setIsEditSupplyOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supply Item - {selectedSupply?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSupply} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_supply_name">Supply Name *</Label>
                <Input
                  id="edit_supply_name"
                  value={newSupply.name}
                  onChange={(e) => setNewSupply({ ...newSupply, name: e.target.value })}
                  placeholder="Enter supply name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_supply_category">Category *</Label>
                <Select value={newSupply.category} onValueChange={(value) => setNewSupply({ ...newSupply, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office_supplies">Office Supplies</SelectItem>
                    <SelectItem value="cleaning_supplies">Cleaning Supplies</SelectItem>
                    <SelectItem value="teaching_materials">Teaching Materials</SelectItem>
                    <SelectItem value="laboratory">Laboratory</SelectItem>
                    <SelectItem value="kitchen_equipment">Kitchen Equipment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_supply_description">Description</Label>
              <Textarea
                id="edit_supply_description"
                value={newSupply.description}
                onChange={(e) => setNewSupply({ ...newSupply, description: e.target.value })}
                placeholder="Describe the supply item"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_supply_unit">Unit *</Label>
                <Input
                  id="edit_supply_unit"
                  value={newSupply.unit}
                  onChange={(e) => setNewSupply({ ...newSupply, unit: e.target.value })}
                  placeholder="e.g., pieces, packs, boxes"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_supply_current_stock">Current Stock *</Label>
                <Input
                  id="edit_supply_current_stock"
                  type="number"
                  min="0"
                  value={newSupply.quantity_in_stock}
                  onChange={(e) => setNewSupply({ ...newSupply, quantity_in_stock: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_supply_unit_cost">Unit Cost ($)</Label>
                <Input
                  id="edit_supply_unit_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newSupply.unit_cost}
                  onChange={(e) => setNewSupply({ ...newSupply, unit_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_supply_min_stock">Minimum Stock Level *</Label>
                <Input
                  id="edit_supply_min_stock"
                  type="number"
                  min="0"
                  value={newSupply.minimum_stock_level}
                  onChange={(e) => setNewSupply({ ...newSupply, minimum_stock_level: e.target.value })}
                  placeholder="5"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_supply_max_stock">Maximum Stock Level</Label>
                <Input
                  id="edit_supply_max_stock"
                  type="number"
                  min="0"
                  value={newSupply.maximum_stock_level}
                  onChange={(e) => setNewSupply({ ...newSupply, maximum_stock_level: e.target.value })}
                  placeholder="50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_supply_storage">Storage Location</Label>
                <Input
                  id="edit_supply_storage"
                  value={newSupply.storage_location}
                  onChange={(e) => setNewSupply({ ...newSupply, storage_location: e.target.value })}
                  placeholder="e.g., Storage Room A, Shelf 3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_supply_supplier">Supplier</Label>
                <Input
                  id="edit_supply_supplier"
                  value={newSupply.supplier}
                  onChange={(e) => setNewSupply({ ...newSupply, supplier: e.target.value })}
                  placeholder="e.g., Office Depot, Amazon"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_supply_expiry">Expiry Date</Label>
              <Input
                id="edit_supply_expiry"
                type="date"
                value={newSupply.expiry_date}
                onChange={(e) => setNewSupply({ ...newSupply, expiry_date: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditSupplyOpen(false);
                  setSelectedSupply(null);
                  resetSupplyForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateSupplyMutation.isPending}
              >
                {updateSupplyMutation.isPending ? 'Updating...' : 'Update Supply'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Supply Confirmation Dialog */}
      <Dialog open={isDeleteSupplyOpen} onOpenChange={setIsDeleteSupplyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Supply Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the supply item "{selectedSupply?.name}" ({selectedSupply?.supply_code})?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDeleteSupplyOpen(false);
                  setSelectedSupply(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedSupply && deleteSupplyMutation.mutate(selectedSupply.id)}
                disabled={deleteSupplyMutation.isPending}
              >
                {deleteSupplyMutation.isPending ? 'Deleting...' : 'Delete Supply'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
