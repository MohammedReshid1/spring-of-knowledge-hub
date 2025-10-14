import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { RoleAccessProvider, PermissionGuard, useRoleAccess } from '@/contexts/RoleAccessContext';
import { DynamicPermissionWrapper } from '@/components/rbac/DynamicPermissionWrapper';
import { AuthProvider } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    setToken: vi.fn(),
    removeToken: vi.fn(),
  }
}));

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: {
      id: 'test-user-1',
      email: 'test@example.com',
      role: 'teacher',
      branch_id: 'branch-1'
    },
    isAuthenticated: true,
    loading: false
  })
}));

// Test component that uses permissions
const TestComponent: React.FC = () => {
  const { hasPermission, hasRole, permissions, roles } = useRoleAccess();

  return (
    <div>
      <div data-testid="permissions-count">{permissions.length}</div>
      <div data-testid="roles-count">{roles.length}</div>
      <div data-testid="has-read-student">{hasPermission('student.read') ? 'yes' : 'no'}</div>
      <div data-testid="has-teacher-role">{hasRole('teacher') ? 'yes' : 'no'}</div>
    </div>
  );
};

// Wrapper component for tests
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoleAccessProvider>
          {children}
        </RoleAccessProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('Dynamic RBAC System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RoleAccessProvider', () => {
    it('loads user permissions on mount', async () => {
      const mockPermissions = {
        user_id: 'test-user-1',
        roles: [{ name: 'teacher', display_name: 'Teacher', branch_specific: false }],
        permissions: ['student.read', 'student.update', 'class.read'],
        cached: false,
        computed_at: new Date().toISOString()
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockPermissions,
        error: null
      });

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('permissions-count')).toHaveTextContent('3');
      });

      expect(screen.getByTestId('roles-count')).toHaveTextContent('1');
      expect(screen.getByTestId('has-read-student')).toHaveTextContent('yes');
      expect(screen.getByTestId('has-teacher-role')).toHaveTextContent('yes');
    });

    it('handles API errors gracefully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: null,
        error: 'Failed to load permissions'
      });

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('permissions-count')).toHaveTextContent('0');
      });

      expect(screen.getByTestId('roles-count')).toHaveTextContent('0');
      expect(screen.getByTestId('has-read-student')).toHaveTextContent('no');
      expect(screen.getByTestId('has-teacher-role')).toHaveTextContent('no');
    });
  });

  describe('PermissionGuard', () => {
    it('renders children when user has required permission', async () => {
      const mockPermissions = {
        user_id: 'test-user-1',
        roles: [{ name: 'teacher', display_name: 'Teacher', branch_specific: false }],
        permissions: ['student.read'],
        cached: false,
        computed_at: new Date().toISOString()
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockPermissions,
        error: null
      });

      render(
        <TestWrapper>
          <PermissionGuard permission="student.read">
            <div data-testid="protected-content">Protected Content</div>
          </PermissionGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });

    it('does not render children when user lacks required permission', async () => {
      const mockPermissions = {
        user_id: 'test-user-1',
        roles: [{ name: 'student', display_name: 'Student', branch_specific: false }],
        permissions: ['student.read'],
        cached: false,
        computed_at: new Date().toISOString()
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockPermissions,
        error: null
      });

      render(
        <TestWrapper>
          <PermissionGuard permission="student.delete">
            <div data-testid="protected-content">Protected Content</div>
          </PermissionGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      });
    });

    it('renders fallback when showFallback is true', async () => {
      const mockPermissions = {
        user_id: 'test-user-1',
        roles: [{ name: 'student', display_name: 'Student', branch_specific: false }],
        permissions: ['student.read'],
        cached: false,
        computed_at: new Date().toISOString()
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockPermissions,
        error: null
      });

      render(
        <TestWrapper>
          <PermissionGuard
            permission="student.delete"
            showFallback
            fallback={<div data-testid="access-denied">Access Denied</div>}
          >
            <div data-testid="protected-content">Protected Content</div>
          </PermissionGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('access-denied')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('handles multiple permissions with requireAll=false', async () => {
      const mockPermissions = {
        user_id: 'test-user-1',
        roles: [{ name: 'teacher', display_name: 'Teacher', branch_specific: false }],
        permissions: ['student.read'],
        cached: false,
        computed_at: new Date().toISOString()
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockPermissions,
        error: null
      });

      render(
        <TestWrapper>
          <PermissionGuard permissions={['student.read', 'student.delete']}>
            <div data-testid="protected-content">Protected Content</div>
          </PermissionGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });

    it('handles multiple permissions with requireAll=true', async () => {
      const mockPermissions = {
        user_id: 'test-user-1',
        roles: [{ name: 'teacher', display_name: 'Teacher', branch_specific: false }],
        permissions: ['student.read'],
        cached: false,
        computed_at: new Date().toISOString()
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockPermissions,
        error: null
      });

      render(
        <TestWrapper>
          <PermissionGuard permissions={['student.read', 'student.delete']} requireAll>
            <div data-testid="protected-content">Protected Content</div>
          </PermissionGuard>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      });
    });
  });

  describe('DynamicPermissionWrapper', () => {
    it('renders children when user has permission', async () => {
      const mockPermissions = {
        user_id: 'test-user-1',
        roles: [{ name: 'admin', display_name: 'Admin', branch_specific: false }],
        permissions: ['user.create'],
        cached: false,
        computed_at: new Date().toISOString()
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockPermissions,
        error: null
      });

      render(
        <TestWrapper>
          <DynamicPermissionWrapper permission="user.create">
            <button data-testid="create-user-btn">Create User</button>
          </DynamicPermissionWrapper>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('create-user-btn')).toBeInTheDocument();
      });
    });

    it('shows fallback when user lacks permission', async () => {
      const mockPermissions = {
        user_id: 'test-user-1',
        roles: [{ name: 'student', display_name: 'Student', branch_specific: false }],
        permissions: ['student.read'],
        cached: false,
        computed_at: new Date().toISOString()
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockPermissions,
        error: null
      });

      render(
        <TestWrapper>
          <DynamicPermissionWrapper permission="user.create" showFallback>
            <button data-testid="create-user-btn">Create User</button>
          </DynamicPermissionWrapper>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('create-user-btn')).not.toBeInTheDocument();
        expect(screen.getByText("You don't have permission to view this content.")).toBeInTheDocument();
      });
    });
  });

  describe('Permission checking functions', () => {
    it('correctly identifies user permissions', async () => {
      const mockPermissions = {
        user_id: 'test-user-1',
        roles: [
          { name: 'teacher', display_name: 'Teacher', branch_specific: false },
          { name: 'branch_admin', display_name: 'Branch Admin', branch_specific: true }
        ],
        permissions: ['student.read', 'student.update', 'class.read', 'class.update'],
        cached: false,
        computed_at: new Date().toISOString()
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockPermissions,
        error: null
      });

      let roleAccess: ReturnType<typeof useRoleAccess>;
      const TestHook = () => {
        roleAccess = useRoleAccess();
        return null;
      };

      render(
        <TestWrapper>
          <TestHook />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(roleAccess.permissions).toHaveLength(4);
      });

      expect(roleAccess.hasPermission('student.read')).toBe(true);
      expect(roleAccess.hasPermission('student.delete')).toBe(false);
      expect(roleAccess.hasAnyPermission(['student.read', 'student.delete'])).toBe(true);
      expect(roleAccess.hasAllPermissions(['student.read', 'student.update'])).toBe(true);
      expect(roleAccess.hasAllPermissions(['student.read', 'student.delete'])).toBe(false);
      expect(roleAccess.hasRole('teacher')).toBe(true);
      expect(roleAccess.hasRole('super_admin')).toBe(false);
      expect(roleAccess.hasAnyRole(['teacher', 'super_admin'])).toBe(true);
    });
  });
});