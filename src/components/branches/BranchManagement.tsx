import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Building, Edit, Trash2, MapPin, Phone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/hooks/useRoleAccess';

interface Branch {
  id: string;
  name: string;
  address?: string;
  contact_info?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BranchFormData {
  name: string;
  address: string;
  contact_info: string;
  logo_url: string;
  is_active: boolean;
}

export const BranchManagement = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<BranchFormData>({
    name: '',
    address: '',
    contact_info: '',
    logo_url: '',
    is_active: true
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

  const queryClient = useQueryClient();
  const { isSuperAdmin, isAdmin } = useRoleAccess();

  // Only admins and super admins can access this component
  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to manage branches.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const createBranchMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      const { error } = await supabase
        .from('branches')
        .insert([data]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['user-branches'] });
      toast({
        title: "Success",
        description: "Branch created successfully",
      });
      setIsFormOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create branch: " + error.message,
        variant: "destructive",
      });
    }
  });

  const updateBranchMutation = useMutation({
    mutationFn: async (data: BranchFormData & { id: string }) => {
      const { id, ...updateData } = data;
      const { error } = await supabase
        .from('branches')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['user-branches'] });
      toast({
        title: "Success",
        description: "Branch updated successfully",
      });
      setIsFormOpen(false);
      setEditingBranch(null);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update branch: " + error.message,
        variant: "destructive",
      });
    }
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['user-branches'] });
      toast({
        title: "Success",
        description: "Branch deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setBranchToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete branch: " + error.message,
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      contact_info: '',
      logo_url: '',
      is_active: true
    });
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || '',
      contact_info: branch.contact_info || '',
      logo_url: branch.logo_url || '',
      is_active: branch.is_active
    });
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingBranch) {
      updateBranchMutation.mutate({ ...formData, id: editingBranch.id });
    } else {
      createBranchMutation.mutate(formData);
    }
  };

  const handleDelete = (branch: Branch) => {
    setBranchToDelete(branch);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (branchToDelete) {
      deleteBranchMutation.mutate(branchToDelete.id);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Building className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Branch Management</h1>
        </div>
        
        <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
          <SheetTrigger asChild>
            <Button onClick={() => {
              setEditingBranch(null);
              resetForm();
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Branch
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                {editingBranch ? 'Edit Branch' : 'Create New Branch'}
              </SheetTitle>
            </SheetHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="name">Branch Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Campus, Jemo Branch"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Branch address"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_info">Contact Information</Label>
                <Textarea
                  id="contact_info"
                  value={formData.contact_info}
                  onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                  placeholder="Phone, email, etc."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL (Optional)</Label>
                <Input
                  id="logo_url"
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active Branch</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={createBranchMutation.isPending || updateBranchMutation.isPending}
                  className="flex-1"
                >
                  {editingBranch ? 'Update Branch' : 'Create Branch'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branches ({branches.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading branches...</div>
          ) : branches.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No branches found. Create your first branch to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          {branch.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {branch.address ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {branch.address.substring(0, 50)}
                            {branch.address.length > 50 ? '...' : ''}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No address</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {branch.contact_info ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {branch.contact_info.substring(0, 30)}
                            {branch.contact_info.length > 30 ? '...' : ''}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No contact</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={branch.is_active ? "default" : "secondary"}>
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(branch.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(branch)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(branch)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Branch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{branchToDelete?.name}"? This action cannot be undone and will affect all associated records.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteBranchMutation.isPending}
            >
              Delete Branch
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};