
import { useAuth } from '@/hooks/useAuth';

export const useRoleAccess = () => {
  const { userRole } = useAuth();

  const isAdmin = () => userRole === 'admin';
  const isSuperAdmin = () => userRole === 'super_admin';
  const isRegistrar = () => userRole === 'registrar';
  
  const canEdit = () => isAdmin() || isSuperAdmin();
  const canDelete = () => isAdmin() || isSuperAdmin();
  const canCreate = () => isAdmin() || isSuperAdmin() || isRegistrar();
  const canView = () => isAdmin() || isSuperAdmin() || isRegistrar();

  return {
    isAdmin: isAdmin(),
    isSuperAdmin: isSuperAdmin(),
    isRegistrar: isRegistrar(),
    canEdit: canEdit(),
    canDelete: canDelete(),
    canCreate: canCreate(),
    canView: canView(),
    userRole,
  };
};
