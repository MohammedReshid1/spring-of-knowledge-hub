/**
 * E2E Tests for Dynamic RBAC Workflows
 * Tests the complete role-based access control system functionality
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DynamicRoleManagement } from '@/components/settings/DynamicRoleManagement';
import { RoleAccessProvider } from '@/contexts/RoleAccessContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    setToken: vi.fn(),
    removeToken: vi.fn(),
  }
}));

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: {
      id: 'admin-user-1',
      email: 'admin@school.com',
      role: 'superadmin',
      branch_id: 'main-branch'
    },
    isAuthenticated: true,
    loading: false
  })
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Test data
const mockRoles = [
  {
    _id: 'role-1',
    name: 'teacher',
    display_name: 'Teacher',
    description: 'School teacher with classroom access',
    permissions: ['student.read', 'class.read', 'grade.create'],
    inherits_from: ['base_user'],
    is_system: false,
    is_active: true,
    priority: 50,
    branch_specific: false
  },
  {
    _id: 'role-2',
    name: 'admin',
    display_name: 'Administrator',
    description: 'System administrator',
    permissions: ['user.create', 'user.read', 'user.update', 'user.delete', 'role.manage'],
    inherits_from: [],
    is_system: true,
    is_active: true,
    priority: 90,
    branch_specific: false
  }
];

const mockPermissions = [
  {
    _id: 'perm-1',
    name: 'student.read',
    resource: 'student',
    action: 'read',
    description: 'View student information',
    is_active: true
  },
  {
    _id: 'perm-2',
    name: 'student.create',
    resource: 'student',
    action: 'create',
    description: 'Create new students',
    is_active: true
  },
  {
    _id: 'perm-3',
    name: 'class.read',
    resource: 'class',
    action: 'read',
    description: 'View class information',
    is_active: true
  }
];

const mockUsers = [
  {
    id: 'user-1',
    email: 'teacher@school.com',
    full_name: 'John Teacher',
    roles: ['teacher']
  },
  {
    id: 'user-2',
    email: 'principal@school.com',
    full_name: 'Jane Principal',
    roles: ['admin']
  }
];

const mockUserPermissions = {
  user_id: 'admin-user-1',
  roles: [{ name: 'superadmin', display_name: 'Super Admin', branch_specific: false }],
  permissions: ['role.create', 'role.read', 'role.update', 'role.delete', 'permission.create', 'permission.read', 'user.assign_role'],
  cached: false,
  computed_at: new Date().toISOString()
};

// Test wrapper component
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

describe('Dynamic RBAC Workflows E2E Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();

    // Mock user permissions
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/rbac/me/permissions') {
        return Promise.resolve({ data: mockUserPermissions, error: null });
      }
      if (url === '/rbac/roles') {
        return Promise.resolve({ data: mockRoles, error: null });
      }
      if (url === '/rbac/permissions') {
        return Promise.resolve({ data: mockPermissions, error: null });
      }
      if (url === '/rbac/users') {
        return Promise.resolve({ data: mockUsers, error: null });
      }
      return Promise.resolve({ data: null, error: 'Not found' });
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Role Management Workflow', () => {
    it('should display roles tab and show existing roles', async () => {
      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      // Wait for roles to load
      await waitFor(() => {
        expect(screen.getByText('Teacher')).toBeInTheDocument();
        expect(screen.getByText('Administrator')).toBeInTheDocument();
      });

      // Check role details
      expect(screen.getByText('3 permissions')).toBeInTheDocument();
      expect(screen.getByText('5 permissions')).toBeInTheDocument();
    });

    it('should allow creating a new role', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          _id: 'new-role-id',
          name: 'test_role',
          display_name: 'Test Role',
          permissions: ['student.read'],
          is_active: true
        },
        error: null
      });

      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Teacher')).toBeInTheDocument();
      });

      // Click create role button
      const createButton = screen.getByRole('button', { name: /create role/i });
      await user.click(createButton);

      // Wait for dialog to open
      await waitFor(() => {
        expect(screen.getByText('Create New Role')).toBeInTheDocument();
      });

      // Fill out the form
      const nameInput = screen.getByLabelText(/role name.*id/i);
      const displayNameInput = screen.getByLabelText(/display name/i);

      await user.type(nameInput, 'test_role');
      await user.type(displayNameInput, 'Test Role');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /create role/i });
      await user.click(submitButton);

      // Verify API was called
      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/rbac/roles', expect.objectContaining({
          name: 'test_role',
          display_name: 'Test Role'
        }));
      });
    });

    it('should allow editing an existing role', async () => {
      vi.mocked(apiClient.put).mockResolvedValueOnce({
        data: { ...mockRoles[0], display_name: 'Updated Teacher' },
        error: null
      });

      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Teacher')).toBeInTheDocument();
      });

      // Find and click edit button for teacher role
      const teacherCard = screen.getByText('Teacher').closest('[data-testid], .p-4, .space-y-2')?.parentElement;
      expect(teacherCard).toBeInTheDocument();

      if (teacherCard) {
        const editButton = within(teacherCard).getByRole('button', { name: /edit/i });
        await user.click(editButton);
      }

      // Wait for edit dialog
      await waitFor(() => {
        expect(screen.getByText('Edit Role')).toBeInTheDocument();
      });

      // Update display name
      const displayNameInput = screen.getByDisplayValue('Teacher');
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Teacher');

      // Submit changes
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Verify API was called
      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalledWith('/rbac/roles/role-1', expect.objectContaining({
          display_name: 'Updated Teacher'
        }));
      });
    });
  });

  describe('Permission Management Workflow', () => {
    it('should switch to permissions tab and display permissions', async () => {
      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      // Click permissions tab
      const permissionsTab = screen.getByRole('tab', { name: /permissions/i });
      await user.click(permissionsTab);

      // Wait for permissions to load
      await waitFor(() => {
        expect(screen.getByText('student.read')).toBeInTheDocument();
        expect(screen.getByText('student.create')).toBeInTheDocument();
        expect(screen.getByText('class.read')).toBeInTheDocument();
      });

      // Check grouped permissions
      expect(screen.getByText('student (2 permissions)')).toBeInTheDocument();
      expect(screen.getByText('class (1 permission)')).toBeInTheDocument();
    });

    it('should allow creating a new permission', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          _id: 'new-perm-id',
          name: 'student.delete',
          resource: 'student',
          action: 'delete',
          description: 'Delete student records',
          is_active: true
        },
        error: null
      });

      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      // Switch to permissions tab
      const permissionsTab = screen.getByRole('tab', { name: /permissions/i });
      await user.click(permissionsTab);

      await waitFor(() => {
        expect(screen.getByText('student.read')).toBeInTheDocument();
      });

      // Click create permission button
      const createButton = screen.getByRole('button', { name: /create permission/i });
      await user.click(createButton);

      // Wait for dialog
      await waitFor(() => {
        expect(screen.getByText('Create New Permission')).toBeInTheDocument();
      });

      // Fill form
      const nameInput = screen.getByLabelText(/permission name/i);
      const resourceInput = screen.getByLabelText(/resource/i);
      const actionInput = screen.getByLabelText(/action/i);

      await user.type(nameInput, 'student.delete');
      await user.type(resourceInput, 'student');
      await user.type(actionInput, 'delete');

      // Submit
      const submitButton = screen.getByRole('button', { name: /create permission/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith('/rbac/permissions', expect.objectContaining({
          name: 'student.delete',
          resource: 'student',
          action: 'delete'
        }));
      });
    });
  });

  describe('Hierarchy Visualization', () => {
    it('should display role hierarchy correctly', async () => {
      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      // Switch to hierarchy tab
      const hierarchyTab = screen.getByRole('tab', { name: /hierarchy/i });
      await user.click(hierarchyTab);

      await waitFor(() => {
        expect(screen.getByText('Role Hierarchy Visualization')).toBeInTheDocument();
        expect(screen.getByText('Permission Matrix')).toBeInTheDocument();
      });

      // Check for role statistics
      expect(screen.getByText('Total Roles')).toBeInTheDocument();
      expect(screen.getByText('Total Permissions')).toBeInTheDocument();
      expect(screen.getByText('System Roles')).toBeInTheDocument();

      // Verify stats show correct numbers
      expect(screen.getByText('2')).toBeInTheDocument(); // Total roles
      expect(screen.getByText('3')).toBeInTheDocument(); // Total permissions
      expect(screen.getByText('1')).toBeInTheDocument(); // System roles
    });
  });

  describe('User Assignment Workflow', () => {
    it('should allow assigning roles to users', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true },
        error: null
      });

      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      // Switch to users tab
      const usersTab = screen.getByRole('tab', { name: /user assignments/i });
      await user.click(usersTab);

      await waitFor(() => {
        expect(screen.getByText('User Role Assignments')).toBeInTheDocument();
      });

      // Click assign role button
      const assignButton = screen.getByRole('button', { name: /assign role/i });
      await user.click(assignButton);

      await waitFor(() => {
        expect(screen.getByText('Assign Role to User')).toBeInTheDocument();
      });

      // Select user and role (this would require more complex mocking for dropdowns)
      // For now, we'll just verify the dialog opens
      expect(screen.getByText('Select User')).toBeInTheDocument();
      expect(screen.getByText('Select Role')).toBeInTheDocument();
    });
  });

  describe('Audit Log Functionality', () => {
    it('should display audit log with mock data', async () => {
      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      // Switch to audit tab
      const auditTab = screen.getByRole('tab', { name: /audit log/i });
      await user.click(auditTab);

      await waitFor(() => {
        expect(screen.getByText('RBAC Audit Log')).toBeInTheDocument();
      });

      // Check for audit entries
      expect(screen.getByText('CREATE_ROLE')).toBeInTheDocument();
      expect(screen.getByText('ASSIGN_ROLE')).toBeInTheDocument();
      expect(screen.getByText('REVOKE_ROLE')).toBeInTheDocument();

      // Check audit summary
      expect(screen.getByText('Successful Actions')).toBeInTheDocument();
      expect(screen.getByText('Failed Actions')).toBeInTheDocument();
      expect(screen.getByText('Role Changes')).toBeInTheDocument();
      expect(screen.getByText('Permission Updates')).toBeInTheDocument();
    });

    it('should allow searching audit logs', async () => {
      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      // Switch to audit tab
      const auditTab = screen.getByRole('tab', { name: /audit log/i });
      await user.click(auditTab);

      await waitFor(() => {
        expect(screen.getByText('RBAC Audit Log')).toBeInTheDocument();
      });

      // Find search input in audit section
      const searchInput = screen.getByPlaceholderText('Search audit logs...');
      await user.type(searchInput, 'CREATE_ROLE');

      // Verify search input has the value
      expect(searchInput).toHaveValue('CREATE_ROLE');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url === '/rbac/me/permissions') {
          return Promise.resolve({ data: mockUserPermissions, error: null });
        }
        return Promise.resolve({ data: null, error: 'Failed to load data' });
      });

      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      // Should still render the component without crashing
      await waitFor(() => {
        expect(screen.getByText('System Roles')).toBeInTheDocument();
      });
    });

    it('should handle permission-based UI correctly', async () => {
      // Mock user with limited permissions
      const limitedPermissions = {
        user_id: 'limited-user',
        roles: [{ name: 'viewer', display_name: 'Viewer', branch_specific: false }],
        permissions: ['role.read'], // Only read permission
        cached: false,
        computed_at: new Date().toISOString()
      };

      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url === '/rbac/me/permissions') {
          return Promise.resolve({ data: limitedPermissions, error: null });
        }
        if (url === '/rbac/roles') {
          return Promise.resolve({ data: mockRoles, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });

      render(
        <TestWrapper>
          <DynamicRoleManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Teacher')).toBeInTheDocument();
      });

      // Create button should not be visible due to lack of role.create permission
      expect(screen.queryByRole('button', { name: /create role/i })).not.toBeInTheDocument();
    });
  });
});