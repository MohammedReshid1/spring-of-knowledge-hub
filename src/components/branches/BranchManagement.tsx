import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
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
import { Plus, Building, Edit, Trash2, MapPin, Phone, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRoleAccess } from '@/contexts/RoleAccessContext';

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
  admin_email?: string; // For creating branch admin
}

export const BranchManagement = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<BranchFormData>({
    name: '',
    address: '',
    contact_info: '',
    logo_url: '',
    is_active: true,
    admin_email: ''
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [branchToAssignAdmin, setBranchToAssignAdmin] = useState<Branch | null>(null);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [isAssigningAdmin, setIsAssigningAdmin] = useState(false);

  const queryClient = useQueryClient();
  const { isSuperAdmin, isAdmin } = useRoleAccess();

  // Load branches data
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await apiClient.getBranches();

      if (error) throw new Error(error);
      return data || [];
    }
  });

  // Load users to allow existing user selection/demotion
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await apiClient.getUsers();
      if (error) throw new Error(error);
      return data || [];
    }
  });

  const createBranchMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      // Only send branch fields to the API
      const payload = {
        name: data.name,
        address: data.address,
        contact_info: data.contact_info,
        logo_url: data.logo_url,
        is_active: data.is_active,
      };
      const { data: created, error } = await apiClient.createBranch(payload);
      if (error) throw new Error(error);
      return created; // Return created branch with id
    }
  });

  const updateBranchMutation = useMutation({
    mutationFn: async (data: BranchFormData & { id: string }) => {
      const { id, ...updateData } = data;
      const { error } = await apiClient.updateBranch(id, updateData);

      if (error) throw new Error(error);
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
      const { error } = await apiClient.deleteBranch(branchId);

      if (error) throw new Error(error);
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

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      contact_info: '',
      logo_url: '',
      is_active: true,
      admin_email: ''
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        // Exclude admin_email on update
        const { admin_email, ...update } = formData;
        updateBranchMutation.mutate({ ...(update as BranchFormData), id: editingBranch.id });
        return;
      }

      // Creating a new branch: require admin email
      if (!formData.admin_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
        toast({ title: 'Validation', description: 'Please enter a valid branch admin email', variant: 'destructive' });
        return;
      }

      const created = await createBranchMutation.mutateAsync(formData);
      // Create branch admin account with temp password
      const tempPassword = 'ChangeMe123!';
      const signUpResp = await apiClient.signUp({
        email: formData.admin_email,
        password: tempPassword,
        full_name: `${formData.name} Admin`,
        role: 'branch_admin',
        branch_id: created.id,
        phone: ''
      });
      if (signUpResp.error) {
        throw new Error(`Branch created, but failed to create branch admin: ${signUpResp.error}`);
      }

      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['user-branches'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });

      toast({
        title: 'Success',
        description: 'Branch and branch admin created successfully.',
      });
      setIsFormOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create branch', variant: 'destructive' });
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

  const openChangeAdmin = (branch: Branch) => {
    setBranchToAssignAdmin(branch);
    setAdminEmailInput('');
    setIsAdminDialogOpen(true);
  };

  const handleAssignAdmin = async () => {
    if (!branchToAssignAdmin) return;
    const email = adminEmailInput.trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast({ title: 'Validation', description: 'Enter a valid email address', variant: 'destructive' });
      return;
    }
    try {
      setIsAssigningAdmin(true);
      // Check if user exists
      const existing = (users as any[]).find(u => (u.email || '').toLowerCase() === email);
      let adminUserId: string | null = null;
      if (existing) {
        // Update existing user to be branch_admin for this branch
        const resp = await apiClient.updateUser(existing.id, { role: 'branch_admin', branch_id: branchToAssignAdmin.id });
        if (resp.error) throw new Error(resp.error);
        adminUserId = existing.id;
      } else {
        // Create new user with temp password
        const tempPassword = 'ChangeMe123!';
        const resp = await apiClient.signUp({
          email,
          password: tempPassword,
          full_name: `${branchToAssignAdmin.name} Admin`,
          role: 'branch_admin',
          branch_id: branchToAssignAdmin.id,
          phone: ''
        });
        if (resp.error) throw new Error(resp.error);
        adminUserId = resp.data?.id;
      }

      // Demote any other branch_admins of this branch (keep only the one just set)
      const currentAdmins = (users as any[]).filter(u => u.role === 'branch_admin' && u.branch_id === branchToAssignAdmin.id && u.email?.toLowerCase() !== email);
      for (const u of currentAdmins) {
        await apiClient.updateUser(u.id, { role: 'registrar' });
      }

      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Success', description: 'Branch admin updated successfully.' });
      setIsAdminDialogOpen(false);
      setBranchToAssignAdmin(null);
      setAdminEmailInput('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to assign branch admin', variant: 'destructive' });
    } finally {
      setIsAssigningAdmin(false);
    }
  };

  return (
    <>
      {/* Premium Animation Styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
          }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }

        .animate-pulseGlow {
          animation: pulseGlow 2s infinite;
        }
      `}</style>

      <div className="space-y-8">
        {/* Premium Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-lg" />
              <Building className="relative h-8 w-8 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium">Manage school locations and administrative settings</p>
            </div>
          </div>

          <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
            <SheetTrigger asChild>
              <Button
                onClick={() => {
                  setEditingBranch(null);
                  resetForm();
                }}
                className="group relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                Add Branch
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-white/95 backdrop-blur-glass border-l border-white/20 shadow-2xl">
              {/* Premium Header */}
              <SheetHeader className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 p-6 -mx-6 -mt-6 mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/90 via-pink-600/90 to-indigo-600/90" />
                <div className="absolute inset-0 opacity-20"
                     style={{
                       backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                     }} />

                <div className="relative">
                  <SheetTitle className="flex items-center gap-3 text-2xl font-bold text-white mb-3">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                      {editingBranch ? <Edit className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                    </div>
                    {editingBranch ? 'Edit Branch Details' : 'Create New Branch'}
                  </SheetTitle>
                  <p className="text-purple-100 text-lg">
                    {editingBranch
                      ? 'Update branch information and administrative settings'
                      : 'Add a new school location with administrative access'
                    }
                  </p>
                </div>
              </SheetHeader>

              {/* Premium Form Container */}
              <div className="bg-white/80 backdrop-blur-sm border border-white/30 shadow-xl rounded-2xl p-6 mt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Branch Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Main Campus, Jemo Branch"
                      required
                      className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-purple-300/50 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="address" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Branch address"
                      rows={3}
                      className="bg-white/80 backdrop-blur-sm border-white/40 hover:border-purple-300/50 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="contact_info" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Contact Information</Label>
                    <Textarea
                      id="contact_info"
                      value={formData.contact_info}
                      onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                      placeholder="Phone, email, etc."
                      rows={3}
                      className="bg-white/80 backdrop-blur-sm border-white/40 hover:border-purple-300/50 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="logo_url" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Logo URL (Optional)</Label>
                    <Input
                      id="logo_url"
                      type="url"
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-purple-300/50 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md"
                    />
                  </div>

                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200/50">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      className="data-[state=checked]:bg-purple-600"
                    />
                    <Label htmlFor="is_active" className="text-slate-700 font-semibold cursor-pointer">
                      Active Branch
                    </Label>
                    {formData.is_active && (
                      <Badge className="bg-gradient-to-r from-emerald-100 to-green-100 border-emerald-300/50 text-emerald-800 font-semibold shadow-sm ml-auto">
                        <div className="w-2 h-2 rounded-full mr-2 bg-emerald-500 animate-pulse" />
                        Active
                      </Badge>
                    )}
                  </div>

                  {!editingBranch && (
                    <div className="space-y-3">
                      <Label htmlFor="admin_email" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Branch Admin Email *</Label>
                      <Input
                        id="admin_email"
                        type="email"
                        value={formData.admin_email}
                        onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                        placeholder="admin@example.com"
                        required
                        className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-purple-300/50 focus:border-purple-500/60 focus:ring-purple-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md"
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-6">
                    <Button
                      type="submit"
                      disabled={createBranchMutation.isPending || updateBranchMutation.isPending}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 py-3"
                    >
                      {createBranchMutation.isPending || updateBranchMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </div>
                      ) : (
                        <>
                          {editingBranch ? 'Update Branch' : 'Create Branch'}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsFormOpen(false)}
                      className="flex-1 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 text-gray-700 hover:text-gray-900 rounded-xl py-3"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Premium Branches Table */}
        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-white/60 border border-white/30 shadow-premium hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.02] via-pink-500/[0.02] to-indigo-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="relative">
            <CardTitle className="text-2xl font-bold flex items-center gap-3">
              <span className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 bg-clip-text text-transparent">
                School Branches
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200/50">
                {branches.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            {isLoading ? (
              <div className="text-center py-16">
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-20 animate-pulse" />
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-purple-500 border-r-pink-500"></div>
                </div>
                <p className="text-slate-600 mt-6 font-medium animate-pulse">Loading branches...</p>
              </div>
            ) : branches.length === 0 ? (
              <div className="text-center py-16">
                <div className="relative mx-auto w-16 h-16 mb-6">
                  <div className="absolute inset-0 bg-slate-200 rounded-full blur-lg" />
                  <Building className="relative h-16 w-16 text-slate-400 mx-auto" />
                </div>
                <p className="text-slate-600 font-semibold text-lg">No branches found</p>
                <p className="text-slate-400 text-sm mt-2">Create your first branch to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/20">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-50/80 via-white/60 to-slate-50/80 border-b border-white/30 hover:from-purple-50/50 hover:via-pink-50/30 hover:to-indigo-50/50 transition-all duration-300">
                      <TableHead className="font-bold text-slate-700 tracking-wide">Branch Name</TableHead>
                      <TableHead className="font-bold text-slate-700 tracking-wide">Address</TableHead>
                      <TableHead className="font-bold text-slate-700 tracking-wide">Contact</TableHead>
                      <TableHead className="font-bold text-slate-700 tracking-wide">Status</TableHead>
                      <TableHead className="font-bold text-slate-700 tracking-wide">Created</TableHead>
                      <TableHead className="font-bold text-slate-700 tracking-wide text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((branch, index) => (
                      <TableRow
                        key={branch.id}
                        className="group/row border-b border-white/20 hover:bg-gradient-to-r hover:from-purple-50/30 hover:via-pink-50/20 hover:to-indigo-50/30 transition-all duration-300 animate-fadeInUp"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-lg opacity-0 group-hover/row:opacity-100 transition-opacity duration-300" />
                              <div className="relative h-10 w-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center border border-purple-200/50 group-hover/row:scale-110 transition-transform duration-300">
                                <Building className="h-5 w-5 text-purple-600" />
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800 group-hover/row:text-purple-700 transition-colors duration-300">{branch.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {branch.address ? (
                            <div className="flex items-center gap-2 text-sm group/address">
                              <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-sm opacity-0 group-hover/address:opacity-100 transition-opacity duration-300" />
                                <MapPin className="relative h-4 w-4 text-indigo-500" />
                              </div>
                              <span className="text-slate-700 font-medium">
                                {branch.address.length > 50 ? `${branch.address.substring(0, 50)}...` : branch.address}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-sm">No address</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {branch.contact_info ? (
                            <div className="flex items-center gap-2 text-sm group/phone">
                              <div className="relative">
                                <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-sm opacity-0 group-hover/phone:opacity-100 transition-opacity duration-300" />
                                <Phone className="relative h-4 w-4 text-cyan-500" />
                              </div>
                              <span className="text-slate-700 font-medium">
                                {branch.contact_info.length > 30 ? `${branch.contact_info.substring(0, 30)}...` : branch.contact_info}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-sm">No contact</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={branch.is_active
                              ? 'bg-gradient-to-r from-emerald-100 to-green-100 border-emerald-300/50 text-emerald-800 font-semibold shadow-sm'
                              : 'bg-gradient-to-r from-gray-100 to-slate-100 border-gray-300/50 text-gray-800 font-semibold shadow-sm'
                            }
                          >
                            <div className={`w-2 h-2 rounded-full mr-2 ${branch.is_active ? 'bg-emerald-500' : 'bg-gray-500'} animate-pulse`} />
                            {branch.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-700 font-medium">
                            {new Date(branch.created_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(branch)}
                              className="group/btn relative overflow-hidden h-10 w-10 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border border-purple-200/50 hover:border-purple-300/60 shadow-sm hover:shadow-glow-purple transition-all duration-300 hover:scale-110"
                            >
                              <Edit className="h-4 w-4 text-purple-600 group-hover/btn:scale-110 transition-transform duration-200" />
                            </Button>
                            {isSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(branch)}
                                className="group/btn relative overflow-hidden h-10 w-10 rounded-lg bg-gradient-to-br from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 border border-red-200/50 hover:border-red-300/60 shadow-sm hover:shadow-glow-orange transition-all duration-300 hover:scale-110"
                              >
                                <Trash2 className="h-4 w-4 text-red-600 group-hover/btn:scale-110 transition-transform duration-200" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openChangeAdmin(branch)}
                              className="group/btn relative overflow-hidden h-10 px-3 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 border border-indigo-200/50 hover:border-indigo-300/60 shadow-sm hover:shadow-glow-blue transition-all duration-300 hover:scale-110"
                            >
                              <span className="text-xs font-medium text-indigo-600">Admin</span>
                            </Button>
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

            {/* Premium Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-lg bg-white/95 backdrop-blur-glass border border-white/20 shadow-2xl rounded-2xl overflow-hidden">
            {/* Premium Header */}
            <DialogHeader className="relative overflow-hidden bg-gradient-to-r from-red-600 via-pink-600 to-orange-600 p-6 -mx-6 -mt-6 mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600/90 via-pink-600/90 to-orange-600/90" />
              <div className="absolute inset-0 opacity-20"
                   style={{
                     backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                   }} />

              <div className="relative">
                <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-white mb-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-full">
                    <Trash2 className="h-6 w-6" />
                  </div>
                  Delete Branch
                </DialogTitle>
                <DialogDescription className="text-lg leading-relaxed text-red-100">
                  Are you sure you want to delete <strong className="text-white font-bold">{branchToDelete?.name}</strong>?
                </DialogDescription>
              </div>
            </DialogHeader>

            {/* Premium Content */}
            <div className="px-6 pb-6">
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/50 rounded-xl p-4 mb-6">
                <p className="text-red-900 text-sm font-medium mb-2">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  This action cannot be undone and will affect:
                </p>
                <ul className="text-sm text-red-800 space-y-1 ml-6">
                  <li>• All student records in this branch</li>
                  <li>• Teacher assignments</li>
                  <li>• Class schedules and data</li>
                  <li>• Historical records and reports</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="flex-1 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 text-gray-700 hover:text-gray-900 rounded-xl py-3"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deleteBranchMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 py-3"
                >
                  {deleteBranchMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </div>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Branch
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Premium Change Branch Admin Dialog */}
        <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
          <DialogContent className="max-w-lg bg-white/95 backdrop-blur-glass border border-white/20 shadow-2xl rounded-2xl overflow-hidden">
            {/* Premium Header */}
            <DialogHeader className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 p-6 -mx-6 -mt-6 mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/90 via-blue-600/90 to-cyan-600/90" />
              <div className="absolute inset-0 opacity-20"
                   style={{
                     backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='10'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                   }} />

              <div className="relative">
                <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-white mb-3">
                  <div className="p-2 bg-white/20 backdrop-blur-sm rounded-full">
                    <Building className="h-6 w-6" />
                  </div>
                  Change Branch Admin
                </DialogTitle>
                <DialogDescription className="space-y-3 text-lg leading-relaxed text-indigo-100">
                  <p>Assign a branch admin for <strong className="text-white font-bold">{branchToAssignAdmin?.name}</strong>.</p>
                  <p>Enter an existing user's email or a new email to create an account.</p>
                </DialogDescription>
              </div>
            </DialogHeader>

            {/* Premium Content */}
            <div className="px-6 pb-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="adminEmail" className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Admin Email</Label>
                  <div className="relative group/email">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-lg opacity-0 group-hover/email:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <Input
                      id="adminEmail"
                      type="email"
                      value={adminEmailInput}
                      onChange={(e) => setAdminEmailInput(e.target.value)}
                      placeholder="admin@example.com"
                      className="relative pl-12 h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-indigo-300/50 focus:border-indigo-500/60 focus:ring-indigo-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md"
                    />
                    <Building className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-indigo-500/60 group-hover/email:text-indigo-600 transition-colors duration-300" />
                  </div>
                </div>

                {/* Information Card */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/50 rounded-xl p-4">
                  <p className="text-indigo-900 text-sm font-medium mb-2">
                    <Building className="h-4 w-4 inline mr-2" />
                    Branch Admin Permissions:
                  </p>
                  <ul className="text-sm text-indigo-800 space-y-1 ml-6">
                    <li>• Manage students and teachers in this branch</li>
                    <li>• Create and manage classes and schedules</li>
                    <li>• Generate reports and analytics</li>
                    <li>• Manage branch-specific settings</li>
                  </ul>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsAdminDialogOpen(false)}
                    className="flex-1 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 text-gray-700 hover:text-gray-900 rounded-xl py-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignAdmin}
                    disabled={isAssigningAdmin}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 py-3"
                  >
                    {isAssigningAdmin ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Assigning...
                      </div>
                    ) : (
                      <>
                        <Building className="h-4 w-4 mr-2" />
                        Assign Admin
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};
