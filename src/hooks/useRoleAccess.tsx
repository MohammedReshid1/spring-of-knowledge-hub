
import { useAuth } from '@/hooks/useAuth';

export const useRoleAccess = () => {
  const { userRole } = useAuth();

  // Role detection methods
  const isSuperAdmin = () => userRole === 'super_admin';
  const isHQAdmin = () => userRole === 'hq_admin';
  const isBranchAdmin = () => userRole === 'branch_admin';
  const isHQRegistrar = () => userRole === 'hq_registrar';
  const isRegistrar = () => userRole === 'registrar';
  const isAdmin = () => userRole === 'admin'; // Legacy support
  
  // Role group detection
  const isHQRole = () => isSuperAdmin() || isHQAdmin() || isHQRegistrar();
  const isBranchRole = () => isBranchAdmin() || isRegistrar() || isAdmin();
  const isAdminRole = () => isSuperAdmin() || isHQAdmin() || isBranchAdmin() || isAdmin();
  const isRegistrarRole = () => isHQRegistrar() || isRegistrar();
  
  // Permission methods
  const canEdit = () => isAdminRole();
  const canDelete = () => isAdminRole();
  const canCreate = () => isAdminRole() || isRegistrarRole();
  const canView = () => isAdminRole() || isRegistrarRole();
  const canManageUsers = () => isSuperAdmin() || isHQAdmin();
  const canManageAdmins = () => isSuperAdmin();
  const canSwitchBranches = () => isHQRole();
  const canManageBranches = () => isSuperAdmin() || isHQAdmin();
  
  // Branch access permissions
  const canAccessAllBranches = () => isHQRole();
  const isRestrictedToBranch = () => isBranchRole();

  return {
    // Individual role checks
    isSuperAdmin: isSuperAdmin(),
    isHQAdmin: isHQAdmin(),
    isBranchAdmin: isBranchAdmin(),
    isHQRegistrar: isHQRegistrar(),
    isRegistrar: isRegistrar(),
    isAdmin: isAdmin(), // Legacy support
    
    // Role group checks
    isHQRole: isHQRole(),
    isBranchRole: isBranchRole(),
    isAdminRole: isAdminRole(),
    isRegistrarRole: isRegistrarRole(),
    
    // Permissions
    canEdit: canEdit(),
    canDelete: canDelete(),
    canCreate: canCreate(),
    canView: canView(),
    canManageUsers: canManageUsers(),
    canManageAdmins: canManageAdmins(),
    canSwitchBranches: canSwitchBranches(),
    canManageBranches: canManageBranches(),
    
    // Branch access
    canAccessAllBranches: canAccessAllBranches(),
    isRestrictedToBranch: isRestrictedToBranch(),
    
    userRole,
  };
};
