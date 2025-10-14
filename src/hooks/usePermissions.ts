/**
 * Custom hooks for permission checking
 * Integrates with RoleAccessContext to provide easy-to-use permission checks
 */

import { useCallback, useMemo } from 'react';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import {
  Permission,
  Resource,
  CRUDAction,
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
  getResourcePermissions as getPerms,
} from '@/types/permissions';

/**
 * Hook to check a single permission
 *
 * @param requiredPermission - The permission to check
 * @returns true if user has the permission (including .manage expansion)
 *
 * @example
 * const canCreateStudent = usePermission('student.create');
 * if (canCreateStudent) {
 *   return <CreateStudentButton />;
 * }
 */
export function usePermission(requiredPermission: Permission | string): boolean {
  const { permissions } = useRoleAccess();

  return useMemo(() => {
    return checkPermission(permissions, requiredPermission);
  }, [permissions, requiredPermission]);
}

/**
 * Hook to check multiple permissions with OR logic
 *
 * @param requiredPermissions - Array of permissions to check
 * @returns true if user has ANY of the permissions
 *
 * @example
 * const canViewStudents = useAnyPermission(['student.read', 'student.manage']);
 */
export function useAnyPermission(requiredPermissions: (Permission | string)[]): boolean {
  const { permissions } = useRoleAccess();

  return useMemo(() => {
    return checkAnyPermission(permissions, requiredPermissions);
  }, [permissions, requiredPermissions]);
}

/**
 * Hook to check multiple permissions with AND logic
 *
 * @param requiredPermissions - Array of permissions to check
 * @returns true if user has ALL of the permissions
 *
 * @example
 * const canManageAll = useAllPermissions(['student.read', 'class.read']);
 */
export function useAllPermissions(requiredPermissions: (Permission | string)[]): boolean {
  const { permissions } = useRoleAccess();

  return useMemo(() => {
    return checkAllPermissions(permissions, requiredPermissions);
  }, [permissions, requiredPermissions]);
}

/**
 * Hook to get all CRUD permissions for a resource
 *
 * @param resource - Resource name (e.g., 'student', 'teacher')
 * @returns Object with boolean flags for each CRUD action
 *
 * @example
 * const studentPerms = useResourcePermissions('student');
 * // Returns: { create: true, read: true, update: true, delete: false, manage: true }
 *
 * if (studentPerms.create) {
 *   return <CreateButton />;
 * }
 */
export function useResourcePermissions(resource: Resource): Record<CRUDAction, boolean> {
  const { permissions } = useRoleAccess();

  return useMemo(() => {
    return getPerms(permissions, resource);
  }, [permissions, resource]);
}

/**
 * Hook to check CRUD action on a resource
 *
 * @param resource - Resource name
 * @param action - CRUD action
 * @returns true if user can perform the action
 *
 * @example
 * const canCreateStudent = useCRUD('student', 'create');
 * const canDeleteTeacher = useCRUD('teacher', 'delete');
 */
export function useCRUD(resource: Resource, action: CRUDAction): boolean {
  const { permissions } = useRoleAccess();

  return useMemo(() => {
    const permission = `${resource}.${action}`;
    return checkPermission(permissions, permission);
  }, [permissions, resource, action]);
}

/**
 * Advanced hook for complex permission checks
 * Provides flexible permission checking with multiple criteria
 *
 * @example
 * const { canAccess, canCreate, canEdit, canDelete } = usePermissionCheck({
 *   resource: 'student',
 *   requireCreate: true,
 *   requireEdit: true
 * });
 */
interface UsePermissionCheckOptions {
  resource?: Resource;
  permission?: Permission | string;
  permissions?: (Permission | string)[];
  requireAll?: boolean;
  requireCreate?: boolean;
  requireRead?: boolean;
  requireUpdate?: boolean;
  requireDelete?: boolean;
}

export function usePermissionCheck(options: UsePermissionCheckOptions = {}) {
  const { permissions: userPermissions } = useRoleAccess();

  const {
    resource,
    permission,
    permissions: requiredPermissions = [],
    requireAll = false,
    requireCreate = false,
    requireRead = false,
    requireUpdate = false,
    requireDelete = false,
  } = options;

  // Check single permission
  const hasSinglePermission = useMemo(() => {
    if (!permission) return true;
    return checkPermission(userPermissions, permission);
  }, [userPermissions, permission]);

  // Check multiple permissions
  const hasMultiplePermissions = useMemo(() => {
    if (requiredPermissions.length === 0) return true;

    if (requireAll) {
      return checkAllPermissions(userPermissions, requiredPermissions);
    } else {
      return checkAnyPermission(userPermissions, requiredPermissions);
    }
  }, [userPermissions, requiredPermissions, requireAll]);

  // Check resource permissions
  const resourcePerms = useMemo(() => {
    if (!resource) {
      return { create: true, read: true, update: true, delete: true, manage: true };
    }
    return getPerms(userPermissions, resource);
  }, [userPermissions, resource]);

  // Check required CRUD actions
  const hasRequiredCRUD = useMemo(() => {
    if (!resource) return true;

    const checks: boolean[] = [];
    if (requireCreate) checks.push(resourcePerms.create);
    if (requireRead) checks.push(resourcePerms.read);
    if (requireUpdate) checks.push(resourcePerms.update);
    if (requireDelete) checks.push(resourcePerms.delete);

    if (checks.length === 0) return true;
    return checks.every(check => check);
  }, [resource, resourcePerms, requireCreate, requireRead, requireUpdate, requireDelete]);

  // Overall access check
  const canAccess = useMemo(() => {
    return hasSinglePermission && hasMultiplePermissions && hasRequiredCRUD;
  }, [hasSinglePermission, hasMultiplePermissions, hasRequiredCRUD]);

  return {
    canAccess,
    canCreate: resourcePerms.create,
    canRead: resourcePerms.read,
    canEdit: resourcePerms.update,
    canUpdate: resourcePerms.update,
    canDelete: resourcePerms.delete,
    canManage: resourcePerms.manage,
    hasPermission: hasSinglePermission,
    hasAllPermissions: hasMultiplePermissions,
    resourcePermissions: resourcePerms,
  };
}

/**
 * Hook to check if user has admin access
 */
export function useIsAdmin(): boolean {
  const { hasRole } = useRoleAccess();

  return useMemo(() => {
    return (
      hasRole('superadmin') ||
      hasRole('super_admin') ||
      hasRole('hq_admin') ||
      hasRole('branch_admin') ||
      hasRole('admin')
    );
  }, [hasRole]);
}

/**
 * Hook to check if user has HQ-level access
 */
export function useIsHQ(): boolean {
  const { hasRole } = useRoleAccess();

  return useMemo(() => {
    return (
      hasRole('superadmin') ||
      hasRole('super_admin') ||
      hasRole('hq_admin') ||
      hasRole('hq_registrar')
    );
  }, [hasRole]);
}

/**
 * Hook to check if user is superadmin
 */
export function useIsSuperAdmin(): boolean {
  const { hasRole } = useRoleAccess();

  return useMemo(() => {
    return hasRole('superadmin');
  }, [hasRole]);
}
