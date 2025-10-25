import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/contexts/RoleAccessContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  permission?: string;
  role?: string;
  minRoleLevel?: number;
  requireAdmin?: boolean;
  requireHQ?: boolean;
  customCheck?: () => boolean;
  redirectTo?: string;
  showUnauthorized?: boolean;
}

/**
 * Route wrapper that enforces role-based access control at the page level
 */
export const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({
  children,
  permission,
  role,
  minRoleLevel,
  requireAdmin = false,
  requireHQ = false,
  customCheck,
  redirectTo,
  showUnauthorized = true
}) => {
  const { user, student, loading } = useAuth();
  const { hasPermission, hasRole, loading: roleLoading } = useRoleAccess();
  const location = useLocation();

  // Get current authenticated entity (either user or student)
  const currentEntity = user || student;

  // Helper function to check if user has admin privileges (dynamic RBAC + auth fallback)
  const hasAdminAccess = () => {
    const adminAccess = hasRole('admin') || hasRole('superadmin') || hasRole('superadmin') ||
           hasRole('hq_admin') || hasRole('hqadmin') ||
           hasRole('super_superadmin') || hasRole('superadmin') ||
           currentEntity?.role === 'admin' || currentEntity?.role === 'superadmin' ||
           currentEntity?.role === 'hqadmin' || currentEntity?.role === 'superadmin';

    // Admin access debug data logged for development

    return adminAccess;
  };

  // Show loading spinner while authentication is being checked
  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to auth if not authenticated (check both user and student)
  if (!currentEntity) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check permissions based on provided criteria
  let hasAccess = true;

  // Check specific permission
  if (permission) {
    // Extract resource from permission (e.g., 'announcement' from 'announcement.read')
    const resource = permission.split('.')[0];
    const managePermission = `${resource}.manage`;

    // Allow access if user has the specific permission OR the .manage permission
    if (!hasPermission(permission) && !hasPermission(managePermission)) {
      hasAccess = false;
    }
  }

  // Check specific role
  if (role && !hasRole(role)) {
    hasAccess = false;
  }

  // Check minimum role level (simplified - just check for admin-type roles)
  if (minRoleLevel && minRoleLevel >= 3 &&
      !hasRole('admin') && !hasRole('superadmin') && !hasRole('superadmin') &&
      !hasRole('super_superadmin') && !hasRole('superadmin')) {
    hasAccess = false;
  }

  // Check admin requirement - any admin-type role (using helper function with fallback)
  if (requireAdmin && !hasAdminAccess()) {
    // Admin access checks logged for debugging
    hasAccess = false;
  }

  // Check HQ requirement
  if (requireHQ &&
      !hasRole('hq_admin') && !hasRole('hqadmin') &&
      !hasRole('superadmin') && !hasRole('superadmin') &&
      !hasRole('super_superadmin') && !hasRole('superadmin')) {
    hasAccess = false;
  }

  // Check custom condition
  if (customCheck && !customCheck()) {
    hasAccess = false;
  }

  // If user doesn't have access
  if (!hasAccess) {
    // Redirect to specified route
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    // Redirect to 403 page with permission details
    return (
      <Navigate
        to="/403"
        state={{
          requiredPermission: permission,
          requiredRole: role,
          from: location
        }}
        replace
      />
    );
  }

  return <>{children}</>;
};

/**
 * Higher-order component for route-level permission checking
 */
export const withRoleBasedAccess = (
  Component: React.ComponentType,
  accessConfig: Omit<RoleBasedRouteProps, 'children'>
) => {
  const WrappedComponent: React.FC = (props) => {
    return (
      <RoleBasedRoute {...accessConfig}>
        <Component {...props} />
      </RoleBasedRoute>
    );
  };

  WrappedComponent.displayName = `withRoleBasedAccess(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};