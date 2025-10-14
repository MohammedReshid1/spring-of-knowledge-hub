import React from 'react';
import { ComprehensiveRBACManagement } from '@/components/rbac/ComprehensiveRBACManagement';
import { ErrorBoundary } from '@/components/ui/error-boundary';

/**
 * Dynamic Role Management Component
 *
 * This component now serves as a wrapper for the comprehensive RBAC management system.
 * All the original functionality has been moved to specialized components for better
 * organization and maintainability:
 *
 * - PermissionManagement: Complete CRUD operations for permissions
 * - EnhancedRoleManagement: Advanced role management with filtering and sorting
 * - UserRoleAssignment: Comprehensive user role assignment interface
 * - AuditLog: Real-time audit logging with advanced filtering
 * - ComprehensiveRBACManagement: Main component that integrates everything
 */

export const DynamicRoleManagement: React.FC = () => {
  return (
    <ErrorBoundary>
      <ComprehensiveRBACManagement />
    </ErrorBoundary>
  );
};