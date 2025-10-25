import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import {
  UserPlus,
  Shield,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Users,
  Mail,
  Phone,
  Building,
  Edit,
  Trash2,
  Search
} from 'lucide-react';
import { toast } from 'sonner';

interface Role {
  value: string;
  label: string;
  description: string;
  level: number;
}

interface SystemRole {
  _id: string;
  id: string;
  name: string;
  display_name: string;
  description?: string;
  is_active: boolean;
  priority: number;
}

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface UserFormData {
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  phone: string;
  role: string;
  branch_id: string;
  is_active: boolean;
}

interface EditUserFormData {
  full_name: string;
  phone: string;
  role: string;
  branch_id: string;
  is_active: boolean;
}

export const UserCreation: React.FC = () => {
  const { isSuperSuperAdmin, hasRole } = useRoleAccess();
  const queryClient = useQueryClient();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    role: '',
    branch_id: '',
    is_active: true
  });
  const [editFormData, setEditFormData] = useState<EditUserFormData>({
    full_name: '',
    phone: '',
    role: '',
    branch_id: '',
    is_active: true
  });

  // Fetch system roles from RBAC
  const { data: systemRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['system-roles'],
    queryFn: async (): Promise<SystemRole[]> => {
      const response = await apiClient.get('/rbac/roles');
      return response.data;
    }
  });

  // Fetch creatable roles based on current user's role hierarchy
  const { data: creatableRolesList } = useQuery({
    queryKey: ['creatable-roles'],
    queryFn: async (): Promise<Role[]> => {
      const response = await apiClient.get('/admin-users/creatable-roles');
      return response.data;
    }
  });

  // Check if user is superadmin (but not superadmin)
  const isSuperAdmin = hasRole('superadmin') || hasRole('superadmin');

  // Filter system roles to only show ones the user can create
  const creatableRoles = systemRoles?.filter(role => {
    const roleName = role.name.toLowerCase();

    // Supersuperadmin can see all roles except superadmin roles
    if (isSuperSuperAdmin) {
      // Exclude superadmin roles (super_superadmin, superadmin)
      const isSupersuperadminRole =
        roleName === 'superadmin' ||
        roleName === 'super_superadmin' ||
        roleName.includes('superadmin');
      return !isSupersuperadminRole;
    }

    // Superadmin can see all roles except superadmin and superadmin roles
    if (isSuperAdmin) {
      // Exclude superadmin and superadmin roles
      const isRestrictedRole =
        roleName === 'superadmin' ||
        roleName === 'super_superadmin' ||
        roleName === 'superadmin' ||
        roleName === 'superadmin' ||
        roleName.includes('superadmin');
      return !isRestrictedRole;
    }

    // For other users, check if this role is in the creatable roles list
    return creatableRolesList?.some(cr =>
      cr.value === role.name ||
      cr.value === role.name.toLowerCase()
    );
  }) || [];

  // Fetch branches for selection
  const { data: branches, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async (): Promise<Branch[]> => {
      const response = await apiClient.get('/branches');
      return response.data;
    }
  });

  // Fetch existing users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await apiClient.get('/admin-users');
      return response.data || [];
    }
  });

  // Filter users based on search term
  const filteredUsers = users?.filter((user: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.role?.toLowerCase().includes(search)
    );
  }) || [];

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/users/${userId}`);
    },
    onSuccess: () => {
      toast.success('User deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'Failed to delete user';
      toast.error(errorMessage);
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: EditUserFormData }) => {
      const response = await apiClient.put(`/users/${userId}`, data);
      return response.data;
    },
    onSuccess: async (updatedUser, variables) => {
      toast.success('User updated successfully!');

      // Update role if changed
      if (selectedUser && variables.data.role !== selectedUser.role) {
        try {
          const selectedRole = systemRoles?.find(
            r => r.name.toLowerCase() === variables.data.role.toLowerCase()
          );

          if (selectedRole) {
            // First, revoke old roles (optional - depends on your business logic)
            // Then assign new role
            await apiClient.post(`/rbac/users/${variables.userId}/roles`, {
              role_id: selectedRole._id || selectedRole.id,
              branch_id: variables.data.branch_id === 'none' ? null : variables.data.branch_id
            });

            toast.success(`Role updated to "${selectedRole.display_name}"!`);
          }
        } catch (roleError: any) {
          console.error('Failed to update role:', roleError);
          toast.warning('User updated but role assignment failed. Please assign role manually.');
        }
      }

      // Close dialog and reset
      setIsEditDialogOpen(false);
      setSelectedUser(null);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'Failed to update user';
      toast.error(errorMessage);
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: Omit<UserFormData, 'confirmPassword'>) => {
      const response = await apiClient.post('/admin-users/create-user', userData);
      return response.data;
    },
    onSuccess: async (createdUser, variables) => {
      toast.success('User created successfully!');

      // Automatically assign the selected role to the user
      if (variables.role && createdUser.id) {
        try {
          // Find the role ID from system roles
          const selectedRole = systemRoles?.find(
            r => r.name.toLowerCase() === variables.role.toLowerCase()
          );

          if (!selectedRole) {
            console.error('Role not found in systemRoles:', variables.role, 'Available roles:', systemRoles?.map(r => r.name));
            toast.warning(`User created but role "${variables.role}" not found in system. Please assign role manually.`);

            // Invalidate queries even if role not found
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
          } else {

            // Assign the role to the user
            const response = await apiClient.post(`/rbac/users/${createdUser.id}/roles`, {
              role_id: selectedRole._id || selectedRole.id,
              branch_id: variables.branch_id === 'none' ? null : variables.branch_id
            });

            toast.success(`Role "${selectedRole.display_name}" assigned successfully!`);

            // Invalidate queries AFTER successful role assignment
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
          }
        } catch (roleError: any) {
          console.error('Failed to assign role:', roleError);
          console.error('Error details:', roleError.response?.data || roleError.message);
          toast.warning('User created but role assignment failed. Please assign role manually.');

          // Invalidate queries even on error
          queryClient.invalidateQueries({ queryKey: ['admin-users'] });
          queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
        }
      } else {

        // Invalidate queries even when skipping role assignment
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      }

      // Reset form
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        phone: '',
        role: '',
        branch_id: '',
        is_active: true
      });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'Failed to create user';
      toast.error(errorMessage);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.email || !formData.password || !formData.full_name || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    // Submit
    const { confirmPassword, ...submitData } = formData;
    // Convert "none" to empty string for branch_id
    if (submitData.branch_id === 'none') {
      submitData.branch_id = '';
    }
    createUserMutation.mutate(submitData);
  };

  const handleInputChange = (field: keyof UserFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setEditFormData({
      full_name: user.full_name || '',
      phone: user.phone || '',
      role: user.role || '',
      branch_id: user.branch_id || 'none',
      is_active: user.is_active ?? true
    });
    setIsEditDialogOpen(true);
  };

  const handleEditInputChange = (field: keyof EditUserFormData, value: string | boolean) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) return;

    // Validation
    if (!editFormData.full_name || !editFormData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Convert "none" to empty string for branch_id
    const submitData = { ...editFormData };
    if (submitData.branch_id === 'none') {
      submitData.branch_id = '';
    }

    updateUserMutation.mutate({
      userId: selectedUser.id || selectedUser._id,
      data: submitData
    });
  };

  const getRoleBadgeColor = (level: number) => {
    if (level === 1) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (level === 2) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (level === 3) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    if (level === 4) return 'bg-green-100 text-green-800 border-green-200';
    if (level >= 5) return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const selectedRole = creatableRoles?.find(r => r.value === formData.role);

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
            box-shadow: 0 0 20px rgba(6, 182, 212, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(6, 182, 212, 0.5);
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

      <div className="space-y-8 animate-fadeInUp">
        {/* Premium Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-lg" />
              <UserPlus className="relative h-8 w-8 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 font-medium">Create user accounts with appropriate role assignments</p>
            </div>
          </div>
        </div>

        {/* Premium Role Hierarchy Alert */}
        <div className="bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 border border-cyan-200/50 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-lg animate-pulse" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full flex items-center justify-center border border-cyan-200/50">
                <Shield className="h-6 w-6 text-cyan-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-cyan-900 mb-2">Role Hierarchy Information</h3>
              <p className="text-cyan-800 leading-relaxed">
                <strong className="text-cyan-900">Important:</strong> You can only create users with roles at or below your permission level.
                {isSuperSuperAdmin && ' As Super Super Admin, you can create any role including other Super Super Admins.'}
              </p>
            </div>
          </div>
        </div>

            {/* Premium User Creation Form */}
        <Card className="group relative overflow-hidden backdrop-blur-glass bg-gradient-to-br from-white/95 via-white/80 to-cyan-50/50 border border-white/30 shadow-premium hover:shadow-glow-cyan transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.02] via-blue-500/[0.02] to-indigo-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="relative">
            <CardTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-lg group-hover:blur-xl transition-all duration-300" />
                <Users className="relative h-6 w-6 text-cyan-600" />
              </div>
              <span className="bg-gradient-to-r from-slate-700 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
                Create New User Account
              </span>
            </CardTitle>
            <p className="text-slate-600 leading-relaxed">Enter the details for the new user account with appropriate role assignment</p>
          </CardHeader>
          <CardContent className="relative">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 border border-cyan-200/50">
                    <UserPlus className="h-5 w-5 text-cyan-600" />
                  </div>
                  <h3 className="text-lg font-bold bg-gradient-to-r from-slate-700 to-cyan-600 bg-clip-text text-transparent">
                    Personal Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Full Name */}
                  <div className="space-y-3">
                    <Label htmlFor="full_name" className="text-sm font-semibold text-cyan-600/80 uppercase tracking-wider">
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative group/field">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <Input
                        id="full_name"
                        type="text"
                        placeholder="John Doe"
                        value={formData.full_name}
                        onChange={(e) => handleInputChange('full_name', e.target.value)}
                        required
                        className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-cyan-300/50 focus:border-cyan-500/60 focus:ring-cyan-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-sm font-semibold text-cyan-600/80 uppercase tracking-wider">
                      <Mail className="h-4 w-4 inline mr-2" />
                      Email Address <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative group/field">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <Mail className="h-5 w-5 text-cyan-500/60" />
                      </div>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john.doe@example.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        required
                        className="h-12 pl-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-cyan-300/50 focus:border-cyan-500/60 focus:ring-cyan-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-3">
                    <Label htmlFor="phone" className="text-sm font-semibold text-cyan-600/80 uppercase tracking-wider">
                      <Phone className="h-4 w-4 inline mr-2" />
                      Phone Number
                    </Label>
                    <div className="relative group/field">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <Phone className="h-5 w-5 text-cyan-500/60" />
                      </div>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="h-12 pl-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-cyan-300/50 focus:border-cyan-500/60 focus:ring-cyan-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md"
                      />
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div className="space-y-3">
                    <Label htmlFor="role" className="text-sm font-semibold text-cyan-600/80 uppercase tracking-wider">
                      <Shield className="h-4 w-4 inline mr-2" />
                      User Role <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative group/field">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <Select
                        value={formData.role}
                        onValueChange={(value) => handleInputChange('role', value)}
                      >
                        <SelectTrigger className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-cyan-300/50 focus:border-cyan-500/60 focus:ring-cyan-500/20 focus:ring-4 transition-all duration-300 text-slate-700 rounded-xl shadow-sm hover:shadow-md">
                          <SelectValue placeholder="Select a role..." />
                        </SelectTrigger>
                        <SelectContent className="backdrop-blur-xl bg-white/95 border-white/40">
                          {rolesLoading ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : (
                            creatableRoles?.map((role) => (
                              <SelectItem key={role._id || role.id} value={role.name} className="hover:bg-cyan-50/80">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{role.display_name}</span>
                                  <Badge className={`text-xs ${getRoleBadgeColor(role.priority)}`}>
                                    Priority {role.priority}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedRole && (
                      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200/50 rounded-xl p-3">
                        <p className="text-cyan-800 text-sm font-medium">{selectedRole.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Branch Selection */}
                  <div className="space-y-3">
                    <Label htmlFor="branch_id" className="text-sm font-semibold text-cyan-600/80 uppercase tracking-wider">
                      <Building className="h-4 w-4 inline mr-2" />
                      Branch Assignment (Optional)
                    </Label>
                    <div className="relative group/field">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <Select
                        value={formData.branch_id}
                        onValueChange={(value) => handleInputChange('branch_id', value)}
                      >
                        <SelectTrigger className="h-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-cyan-300/50 focus:border-cyan-500/60 focus:ring-cyan-500/20 focus:ring-4 transition-all duration-300 text-slate-700 rounded-xl shadow-sm hover:shadow-md">
                          <SelectValue placeholder="Select a branch (optional)..." />
                        </SelectTrigger>
                        <SelectContent className="backdrop-blur-xl bg-white/95 border-white/40">
                          <SelectItem value="none" className="hover:bg-cyan-50/80">No Branch</SelectItem>
                          {branchesLoading ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : (
                            branches?.map((branch) => (
                              <SelectItem key={branch._id} value={branch._id} className="hover:bg-cyan-50/80">
                                {branch.name} ({branch.code})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Security Section */}
              <div className="bg-gradient-to-r from-slate-50/80 via-white/60 to-cyan-50/50 rounded-2xl p-8 border border-white/30 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-slate-100 to-gray-100 border border-slate-200/50">
                    <Shield className="h-5 w-5 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-bold bg-gradient-to-r from-slate-700 to-slate-600 bg-clip-text text-transparent">
                    Account Security
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Password */}
                  <div className="space-y-3">
                    <Label htmlFor="password" className="text-sm font-semibold text-slate-600/80 uppercase tracking-wider">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative group/field">
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-500/5 to-gray-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter password (min 8 characters)"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        required
                        minLength={8}
                        className="h-12 pr-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-slate-300/50 focus:border-slate-500/60 focus:ring-slate-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors duration-200"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">Minimum 8 characters required</p>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-3">
                    <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-600/80 uppercase tracking-wider">
                      Confirm Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative group/field">
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-500/5 to-gray-500/5 rounded-xl opacity-0 group-hover/field:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        required
                        className="h-12 pr-12 bg-white/80 backdrop-blur-sm border-white/40 hover:border-slate-300/50 focus:border-slate-500/60 focus:ring-slate-500/20 focus:ring-4 transition-all duration-300 text-slate-700 placeholder:text-slate-400 rounded-xl shadow-sm hover:shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors duration-200"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {formData.password && formData.confirmPassword && (
                      <div className="flex items-center gap-2 text-xs">
                        {formData.password === formData.confirmPassword ? (
                          <>
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-emerald-600 font-medium">Passwords match</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-red-600 font-medium">Passwords do not match</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Premium Actions */}
              <div className="flex items-center justify-end gap-4 pt-8 border-t border-slate-200/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      email: '',
                      password: '',
                      confirmPassword: '',
                      full_name: '',
                      phone: '',
                      role: '',
                      branch_id: '',
                      is_active: true
                    });
                  }}
                  disabled={createUserMutation.isPending}
                  className="border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 text-gray-700 hover:text-gray-900 rounded-xl py-3 px-6"
                >
                  Reset Form
                </Button>
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-0 py-3 px-8"
                >
                  {createUserMutation.isPending ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating User...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      <span>Create User</span>
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

      {/* Existing Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Existing Users ({filteredUsers.length})
          </CardTitle>
          <CardDescription>
            Manage existing user accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Users Table */}
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading users...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No users found matching your search' : 'No users created yet'}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user: any) => (
                    <TableRow key={user.id || user._id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role || 'No role'}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.branch_id ? (
                          branches?.find(b => b._id === user.branch_id)?.name || user.branch_id
                        ) : (
                          <span className="text-gray-400">No branch</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800 border-gray-200">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id || user._id, user.full_name)}
                            disabled={deleteUserMutation.isPending}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Available Roles Reference */}
      {creatableRoles && creatableRoles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available System Roles ({creatableRoles.length})</CardTitle>
            <CardDescription>
              Based on your current role, you can create users with the following system roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creatableRoles.map((role) => (
                <div
                  key={role._id || role.id}
                  className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">{role.display_name}</h4>
                    <Badge className={`text-xs ${getRoleBadgeColor(role.priority)}`}>
                      P{role.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600">{role.description || `${role.name} role`}</p>
                  {!role.is_active && (
                    <Badge variant="outline" className="mt-2 text-xs">Inactive</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              Update user information and role assignment
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="edit_full_name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit_full_name"
                  type="text"
                  placeholder="John Doe"
                  value={editFormData.full_name}
                  onChange={(e) => handleEditInputChange('full_name', e.target.value)}
                  required
                />
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="edit_email">
                  <Mail className="h-4 w-4 inline mr-1" />
                  Email
                </Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={selectedUser?.email || ''}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="edit_phone">
                  <Phone className="h-4 w-4 inline mr-1" />
                  Phone Number
                </Label>
                <Input
                  id="edit_phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={editFormData.phone}
                  onChange={(e) => handleEditInputChange('phone', e.target.value)}
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <Label htmlFor="edit_role">
                  <Shield className="h-4 w-4 inline mr-1" />
                  User Role <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={editFormData.role}
                  onValueChange={(value) => handleEditInputChange('role', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {creatableRoles.map((role) => (
                      <SelectItem key={role._id || role.id} value={role.name}>
                        {role.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Branch Selection */}
              <div className="space-y-2">
                <Label htmlFor="edit_branch">
                  <Building className="h-4 w-4 inline mr-1" />
                  Branch
                </Label>
                <Select
                  value={editFormData.branch_id}
                  onValueChange={(value) => handleEditInputChange('branch_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Branch</SelectItem>
                    {branches?.map((branch) => (
                      <SelectItem key={branch._id} value={branch._id}>
                        {branch.name} ({branch.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Active Status */}
              <div className="space-y-2">
                <Label htmlFor="edit_is_active">Status</Label>
                <Select
                  value={editFormData.is_active ? 'active' : 'inactive'}
                  onValueChange={(value) => handleEditInputChange('is_active', value === 'active')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Active
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-gray-600" />
                        Inactive
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={updateUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Update User
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
};
