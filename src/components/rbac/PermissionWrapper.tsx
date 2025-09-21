import React from 'react';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX } from 'lucide-react';

interface PermissionWrapperProps {
  children: React.ReactNode;
  permission?: string;
  role?: string;
  minRoleLevel?: number;
  requireAdmin?: boolean;
  requireHQ?: boolean;
  customCheck?: () => boolean;
  fallback?: React.ReactNode;
  showFallback?: boolean;
  className?: string;
}

/**
 * Wrapper component that conditionally renders children based on user permissions
 */
export const PermissionWrapper: React.FC<PermissionWrapperProps> = ({
  children,
  permission,
  role,
  minRoleLevel,
  requireAdmin = false,
  requireHQ = false,
  customCheck,
  fallback,
  showFallback = false,
  className
}) => {
  const { user } = useAuth();
  const roleAccess = useRoleAccess();

  // If user is not authenticated, don't render anything
  if (!user) {
    return showFallback ? (
      <Alert className={`border-yellow-200 bg-yellow-50 ${className}`}>
        <ShieldX className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          Authentication required to view this content.
        </AlertDescription>
      </Alert>
    ) : null;
  }

  // Check permissions based on provided criteria
  let hasAccess = true;

  // Check specific permission
  if (permission && !roleAccess.hasPermission(permission as any)) {
    hasAccess = false;
  }

  // Check specific role
  if (role && roleAccess.userRole !== role) {
    hasAccess = false;
  }

  // Check minimum role level
  if (minRoleLevel && !roleAccess.hasRoleLevel(minRoleLevel)) {
    hasAccess = false;
  }

  // Check admin requirement
  if (requireAdmin && !roleAccess.isAdminRole) {
    hasAccess = false;
  }

  // Check HQ requirement
  if (requireHQ && !roleAccess.isHQRole) {
    hasAccess = false;
  }

  // Check custom condition
  if (customCheck && !customCheck()) {
    hasAccess = false;
  }

  // If user doesn't have access
  if (!hasAccess) {
    if (showFallback) {
      return fallback || (
        <Alert className={`border-red-200 bg-red-50 ${className}`}>
          <ShieldX className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You don't have permission to view this content.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  }

  return <div className={className}>{children}</div>;
};

/**
 * Hook for checking permissions in components
 */
export const usePermissionCheck = () => {
  const { user } = useAuth();
  const roleAccess = useRoleAccess();

  const checkPermission = (
    permission?: string,
    role?: string,
    minRoleLevel?: number,
    requireAdmin = false,
    requireHQ = false,
    customCheck?: () => boolean
  ): boolean => {
    if (!user) return false;

    if (permission && !roleAccess.hasPermission(permission as any)) {
      return false;
    }

    if (role && roleAccess.userRole !== role) {
      return false;
    }

    if (minRoleLevel && !roleAccess.hasRoleLevel(minRoleLevel)) {
      return false;
    }

    if (requireAdmin && !roleAccess.isAdminRole) {
      return false;
    }

    if (requireHQ && !roleAccess.isHQRole) {
      return false;
    }

    if (customCheck && !customCheck()) {
      return false;
    }

    return true;
  };

  return { checkPermission };
};

/**
 * HOC for wrapping components with permission checks
 */
export const withPermissions = <P extends object>(
  Component: React.ComponentType<P>,
  permissionConfig: Omit<PermissionWrapperProps, 'children'>
) => {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <PermissionWrapper {...permissionConfig}>
        <Component {...props} />
      </PermissionWrapper>
    );
  };

  WrappedComponent.displayName = `withPermissions(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};