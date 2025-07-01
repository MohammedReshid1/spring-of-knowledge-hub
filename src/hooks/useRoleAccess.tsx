
import { useAuth } from '@/hooks/useAuth';

export const useRoleAccess = () => {
  const { userRole } = useAuth();

  const isAdmin = () => userRole === 'admin' || userRole === 'super_admin';
  const isRegistrar = () => userRole === 'registrar';
  const canEdit = () => isAdmin();
  const canDelete = () => isAdmin();
  const canCreate = () => isAdmin() || isRegistrar();
  const canView = () => isAdmin() || isRegistrar();

  return {
    isAdmin: isAdmin(),
    isRegistrar: isRegistrar(),
    canEdit: canEdit(),
    canDelete: canDelete(),
    canCreate: canCreate(),
    canView: canView(),
  };
};
