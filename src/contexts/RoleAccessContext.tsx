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
  // Role checks
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  isParent: boolean;
  isAdminRole: boolean; // Added for widget visibility
  userRole: string | null; // Added for widget filtering
  currentUser: any;
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
  const { user, student, isAuthenticated, isStudentAuthenticated, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true); // Start as true to prevent flash on initial load
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    // Get the current authenticated entity (either user or student)
    const currentEntity = user || student;
    const isAuth = isAuthenticated || isStudentAuthenticated;

    // Keep loading true while waiting for authentication to complete
    if (!isAuth || !currentEntity) {
      setPermissions([]);
      setRoles([]);
      // Only set loading to false if auth has finished loading and no entity is authenticated
      // This prevents race condition on page reload
      if (!authLoading && !isAuth) {
        setLoading(false);
      }
      return;
    }

    // Now we have an authenticated entity, start loading permissions
    setLoading(true);
    setError(null);

    try {
      // First, check if entity already has permissions from AuthContext
      const entityPermissions = (currentEntity as any).permissions;

      if (entityPermissions && entityPermissions.length > 0) {
        console.log('✅ Loaded permissions from auth context:', entityPermissions);
        setPermissions(entityPermissions);

        // Set role from entity object
        const entityRole = (currentEntity as any).role;
        if (entityRole) {
          setRoles([{
            name: entityRole,
            display_name: entityRole,
            branch_specific: false,
            branch_id: (currentEntity as any).branch_id
          }]);
        }
        setLoading(false);
        return;
      } else {
        console.warn('⚠️ No permissions found in entity object from AuthContext!');
        console.warn('⚠️ Falling back to /rbac/me/permissions API call');
      }

      // If not in entity object, fetch from API
      const { data, error: apiError } = await apiClient.getUserPermissions();

      if (apiError) {
        console.error('❌ Error fetching permissions from API:', apiError);
        setError('Failed to load permissions');
        setLoading(false);
        return;
      }

      if (data) {
        console.log('✅ Loaded permissions from API:', data.permissions);
        setPermissions(data.permissions || []);
        setRoles(data.roles || []);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isStudentAuthenticated, user, student, authLoading]);

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

  // Role checks
  const isAdmin = useMemo(() => {
    return roles.some(role =>
      ['admin', 'hq_admin', 'branch_admin', 'superadmin', 'superadmin'].includes(role.name)
    );
  }, [roles]);

  const isSuperAdmin = useMemo(() => {
    return roles.some(role =>
      ['superadmin', 'superadmin'].includes(role.name)
    );
  }, [roles]);

  const isTeacher = useMemo(() => {
    return roles.some(role => role.name === 'teacher');
  }, [roles]);

  const isStudent = useMemo(() => {
    return roles.some(role => role.name === 'student');
  }, [roles]);

  const isParent = useMemo(() => {
    return roles.some(role => role.name === 'parent');
  }, [roles]);

  // Derived role for widget compatibility
  const userRole = useMemo(() => {
    // Get the first role name, or use the current user's role property
    if (roles.length > 0) {
      return roles[0].name;
    }
    const currentEntity = user || student;
    return currentEntity?.role || null;
  }, [roles, user, student]);

  // isAdminRole combines all admin-type roles
  const isAdminRole = useMemo(() => {
    return roles.some(role =>
      ['admin', 'hq_admin', 'branch_admin', 'superadmin', 'superadmin'].includes(role.name)
    );
  }, [roles]);

  // Current user entity (either user or student)
  const currentUser = user || student;

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
    isSuperSuperAdmin,
    isAdmin,
    isSuperAdmin,
    isTeacher,
    isStudent,
    isParent,
    isAdminRole,
    userRole,
    currentUser
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
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole, isStudent, isTeacher, isAdmin, isSuperAdmin, isParent } = useRoleAccess();

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
    hasAnyRole,
    isStudent,
    isTeacher,
    isAdmin,
    isSuperAdmin,
    isParent
  };
};