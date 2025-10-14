import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { apiClient } from '@/lib/api';
import {
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
} from '@/types/permissions';

interface Permission {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

interface Role {
  name: string;
  display_name: string;
  branch_specific: boolean;
  branch_id?: string;
}

interface UserPermissions {
  user_id: string;
  roles: Role[];
  permissions: string[];
  branch_id?: string;
  cached: boolean;
  computed_at: string;
}

interface RoleAccessContextType {
  permissions: string[];
  roles: Role[];
  loading: boolean;
  error: string | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  refreshPermissions: () => Promise<void>;
  isSuperSuperAdmin: boolean;
}

const RoleAccessContext = createContext<RoleAccessContextType | undefined>(undefined);

export const useRoleAccess = () => {
  const context = useContext(RoleAccessContext);
  if (context === undefined) {
    throw new Error('useRoleAccess must be used within a RoleAccessProvider');
  }
  return context;
};

interface RoleAccessProviderProps {
  children: React.ReactNode;
}

export const RoleAccessProvider: React.FC<RoleAccessProviderProps> = ({ children }) => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true); // Start as true to prevent flash on initial load
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    // Keep loading true while waiting for authentication to complete
    if (!isAuthenticated || !user) {
      setPermissions([]);
      setRoles([]);
      // Only set loading to false if auth has finished loading and user is not authenticated
      // This prevents race condition on page reload
      if (!authLoading && !isAuthenticated) {
        setLoading(false);
      }
      return;
    }

    // Now we have a user, start loading permissions
    setLoading(true);
    setError(null);

    try {
      // First, check if user already has permissions from AuthContext

      if (user.permissions && user.permissions.length > 0) {
        setPermissions(user.permissions);

        // Set role from user object
        if (user.role) {
          setRoles([{
            name: user.role,
            display_name: user.role,
            branch_specific: false,
            branch_id: user.branch_id
          }]);
        }
        setLoading(false);
        return;
      } else {
        console.warn('⚠️ No permissions found in user object from AuthContext!');
        console.warn('⚠️ Falling back to /rbac/me/permissions API call');
      }

      // If not in user object, fetch from API
      const { data, error: apiError } = await apiClient.getUserPermissions();

      if (apiError) {
        console.error('❌ Error fetching permissions from API:', apiError);
        setError('Failed to load permissions');
        setLoading(false);
        return;
      }

      if (data) {
        setPermissions(data.permissions || []);
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, authLoading]);

  // Load permissions when user changes
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Permission checking functions with .manage support
  const hasPermission = useCallback((permission: string): boolean => {
    // Use the utility function from permissions.ts that handles .manage expansion
    const result = checkPermission(permissions, permission);
    return result;
  }, [permissions]);

  const hasAnyPermission = useCallback((requiredPermissions: string[]): boolean => {
    // Use the utility function from permissions.ts that handles .manage expansion
    return checkAnyPermission(permissions, requiredPermissions);
  }, [permissions]);

  const hasAllPermissions = useCallback((requiredPermissions: string[]): boolean => {
    // Use the utility function from permissions.ts that handles .manage expansion
    return checkAllPermissions(permissions, requiredPermissions);
  }, [permissions]);

  const hasRole = useCallback((role: string): boolean => {
    return roles.some(userRole => userRole.name === role);
  }, [roles]);

  const hasAnyRole = useCallback((requiredRoles: string[]): boolean => {
    return requiredRoles.some(role => hasRole(role));
  }, [hasRole]);

  const refreshPermissions = useCallback(async () => {
    await fetchPermissions();
  }, [fetchPermissions]);

  // SuperSuperAdmin check - same logic as SystemAdministration
  const isSuperSuperAdmin = useMemo(() => {
    if (!user) return false;

    // Check role in roles array - superadmin is the god-level role
    const hasSSAdminRole = roles.some(role =>
      role.name === 'superadmin'
    );

    // Check direct user role property
    const hasSSAdminUserRole = user.role === 'superadmin';

    return hasSSAdminRole || hasSSAdminUserRole;
  }, [roles, user]);

  const contextValue: RoleAccessContextType = {
    permissions,
    roles,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    refreshPermissions,
    isSuperSuperAdmin
  };

  return (
    <RoleAccessContext.Provider value={contextValue}>
      {children}
    </RoleAccessContext.Provider>
  );
};

// Enhanced permission wrapper component
interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  requireAll?: boolean; // If true, requires all permissions/roles, otherwise requires any
  fallback?: React.ReactNode;
  showFallback?: boolean;
  onUnauthorized?: () => void;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  permissions = [],
  role,
  roles = [],
  requireAll = false,
  fallback,
  showFallback = false,
  onUnauthorized
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole, loading } = useRoleAccess();

  // Don't render anything while loading
  if (loading) {
    return null;
  }

  let hasAccess = true;

  // Check single permission
  if (permission && !hasPermission(permission)) {
    hasAccess = false;
  }

  // Check multiple permissions
  if (permissions.length > 0) {
    if (requireAll) {
      if (!hasAllPermissions(permissions)) {
        hasAccess = false;
      }
    } else {
      if (!hasAnyPermission(permissions)) {
        hasAccess = false;
      }
    }
  }

  // Check single role
  if (role && !hasRole(role)) {
    hasAccess = false;
  }

  // Check multiple roles
  if (roles.length > 0) {
    if (requireAll) {
      if (!roles.every(r => hasRole(r))) {
        hasAccess = false;
      }
    } else {
      if (!hasAnyRole(roles)) {
        hasAccess = false;
      }
    }
  }

  // Handle unauthorized access
  if (!hasAccess) {
    if (onUnauthorized) {
      onUnauthorized();
    }

    if (showFallback) {
      return <>{fallback || <div className="text-gray-500">Access denied</div>}</>;
    }

    return null;
  }

  return <>{children}</>;
};

// Hook for conditional rendering based on permissions
export const usePermissionCheck = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole } = useRoleAccess();

  const canAccess = useCallback((config: {
    permission?: string;
    permissions?: string[];
    role?: string;
    roles?: string[];
    requireAll?: boolean;
  }) => {
    const { permission, permissions = [], role, roles = [], requireAll = false } = config;

    // Check single permission
    if (permission && !hasPermission(permission)) {
      return false;
    }

    // Check multiple permissions
    if (permissions.length > 0) {
      if (requireAll) {
        if (!hasAllPermissions(permissions)) {
          return false;
        }
      } else {
        if (!hasAnyPermission(permissions)) {
          return false;
        }
      }
    }

    // Check single role
    if (role && !hasRole(role)) {
      return false;
    }

    // Check multiple roles
    if (roles.length > 0) {
      if (requireAll) {
        if (!roles.every(r => hasRole(r))) {
          return false;
        }
      } else {
        if (!hasAnyRole(roles)) {
          return false;
        }
      }
    }

    return true;
  }, [hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole]);

  return {
    canAccess,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole
  };
};