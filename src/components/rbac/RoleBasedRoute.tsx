import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
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
  const { user, loading } = useAuth();
  const roleAccess = useRoleAccess();
  const location = useLocation();

  // Show loading spinner while authentication is being checked
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
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
    // Redirect to specified route
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    // Show unauthorized page
    if (showUnauthorized) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full">
            <Alert className="border-red-200 bg-red-50">
              <ShieldX className="h-6 w-6 text-red-600" />
              <AlertDescription className="text-red-800 mt-2">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Access Denied</h3>
                    <p>You don't have permission to access this page.</p>
                    <p className="text-sm mt-2">
                      Your current role: <span className="font-medium">{roleAccess.userRole}</span>
                    </p>
                    {permission && (
                      <p className="text-sm">
                        Required permission: <span className="font-medium">{permission}</span>
                      </p>
                    )}
                    {role && (
                      <p className="text-sm">
                        Required role: <span className="font-medium">{role}</span>
                      </p>
                    )}
                    {minRoleLevel && (
                      <p className="text-sm">
                        Minimum role level required: <span className="font-medium">{minRoleLevel}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.history.back()}
                      className="flex items-center space-x-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Go Back</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => window.location.href = '/dashboard'}
                    >
                      Dashboard
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    // Default redirect to dashboard
    return <Navigate to="/dashboard" replace />;
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