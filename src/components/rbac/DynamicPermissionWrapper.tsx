import React from 'react';
import { PermissionGuard, usePermissionCheck } from '@/contexts/RoleAccessContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX, Loader2 } from 'lucide-react';

interface DynamicPermissionWrapperProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  showFallback?: boolean;
  className?: string;
  loading?: boolean;
}

/**
 * Dynamic permission wrapper component that conditionally renders children based on user permissions
 * This replaces the old static PermissionWrapper component
 */
export const DynamicPermissionWrapper: React.FC<DynamicPermissionWrapperProps> = ({
  children,
  permission,
  permissions,
  role,
  roles,
  requireAll = false,
  fallback,
  showFallback = false,
  className,
  loading = false
}) => {
  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading permissions...</span>
      </div>
    );
  }

  const defaultFallback = (
    <Alert className={`border-red-200 bg-red-50 ${className}`}>
      <ShieldX className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800">
        You don't have permission to view this content.
      </AlertDescription>
    </Alert>
  );

  return (
    <PermissionGuard
      permission={permission}
      permissions={permissions}
      role={role}
      roles={roles}
      requireAll={requireAll}
      fallback={fallback || defaultFallback}
      showFallback={showFallback}
    >
      <div className={className}>{children}</div>
    </PermissionGuard>
  );
};

/**
 * HOC for wrapping components with permission checks
 */
export const withDynamicPermissions = <P extends object>(
  Component: React.ComponentType<P>,
  permissionConfig: Omit<DynamicPermissionWrapperProps, 'children'>
) => {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <DynamicPermissionWrapper {...permissionConfig}>
        <Component {...props} />
      </DynamicPermissionWrapper>
    );
  };

  WrappedComponent.displayName = `withDynamicPermissions(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

/**
 * Component for conditional rendering based on permissions without wrapping
 */
interface ConditionalRenderProps {
  permission?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  requireAll?: boolean;
  children: (hasAccess: boolean) => React.ReactNode;
}

export const ConditionalRender: React.FC<ConditionalRenderProps> = ({
  permission,
  permissions,
  role,
  roles,
  requireAll = false,
  children
}) => {
  const { canAccess } = usePermissionCheck();

  const hasAccess = canAccess({
    permission,
    permissions,
    role,
    roles,
    requireAll
  });

  return <>{children(hasAccess)}</>;
};

/**
 * Button component that shows/hides based on permissions
 */
interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  permission?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  requireAll?: boolean;
  fallbackText?: string;
  showDisabled?: boolean;
}

export const PermissionButton: React.FC<PermissionButtonProps> = ({
  permission,
  permissions,
  role,
  roles,
  requireAll = false,
  fallbackText = "Not authorized",
  showDisabled = false,
  children,
  className = "",
  ...buttonProps
}) => {
  const { canAccess } = usePermissionCheck();

  const hasAccess = canAccess({
    permission,
    permissions,
    role,
    roles,
    requireAll
  });

  if (!hasAccess) {
    if (showDisabled) {
      return (
        <button
          {...buttonProps}
          disabled={true}
          className={`${className} opacity-50 cursor-not-allowed`}
          title={fallbackText}
        >
          {children}
        </button>
      );
    }
    return null;
  }

  return (
    <button {...buttonProps} className={className}>
      {children}
    </button>
  );
};

/**
 * Link component that shows/hides based on permissions
 */
interface PermissionLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  permission?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  requireAll?: boolean;
  fallbackText?: string;
  showDisabled?: boolean;
}

export const PermissionLink: React.FC<PermissionLinkProps> = ({
  permission,
  permissions,
  role,
  roles,
  requireAll = false,
  fallbackText = "Not authorized",
  showDisabled = false,
  children,
  className = "",
  ...linkProps
}) => {
  const { canAccess } = usePermissionCheck();

  const hasAccess = canAccess({
    permission,
    permissions,
    role,
    roles,
    requireAll
  });

  if (!hasAccess) {
    if (showDisabled) {
      return (
        <span
          className={`${className} opacity-50 cursor-not-allowed`}
          title={fallbackText}
        >
          {children}
        </span>
      );
    }
    return null;
  }

  return (
    <a {...linkProps} className={className}>
      {children}
    </a>
  );
};

// Utility components for common use cases

export const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DynamicPermissionWrapper roles={['superadmin', 'superadmin', 'branch_admin']}>
    {children}
  </DynamicPermissionWrapper>
);

export const SuperAdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DynamicPermissionWrapper roles={['superadmin', 'superadmin']}>
    {children}
  </DynamicPermissionWrapper>
);

export const TeacherOrAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DynamicPermissionWrapper roles={['teacher', 'branch_admin', 'superadmin', 'superadmin']}>
    {children}
  </DynamicPermissionWrapper>
);

export const StudentOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DynamicPermissionWrapper role="student">
    {children}
  </DynamicPermissionWrapper>
);

export const ParentOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DynamicPermissionWrapper role="parent">
    {children}
  </DynamicPermissionWrapper>
);