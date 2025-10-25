// TypeScript/JavaScript Types and Interfaces for Frontend Integration
// Last Updated: 2025-10-09
// This file contains all permission-related types and utility functions

// ============================================================================
// PERMISSION TYPES
// ============================================================================

/**
 * All available permissions in the system
 * Total: 108 permissions
 */
export type Permission =
  // User Management (6)
  | 'user.create'
  | 'user.read'
  | 'user.update'
  | 'user.delete'
  | 'user.manage'
  | 'user.manage_superadmins'

  // Student Management (5)
  | 'student.create'
  | 'student.read'
  | 'student.update'
  | 'student.delete'
  | 'student.manage'

  // Class Management (5)
  | 'class.create'
  | 'class.read'
  | 'class.update'
  | 'class.delete'
  | 'class.manage'

  // Teacher Management (5)
  | 'teacher.create'
  | 'teacher.read'
  | 'teacher.update'
  | 'teacher.delete'
  | 'teacher.manage'

  // Attendance Management (5)
  | 'attendance.create'
  | 'attendance.read'
  | 'attendance.update'
  | 'attendance.delete'
  | 'attendance.manage'

  // Payment Management (5)
  | 'payment.create'
  | 'payment.read'
  | 'payment.update'
  | 'payment.delete'
  | 'payment.manage'

  // Grade Management (5)
  | 'grade.create'
  | 'grade.read'
  | 'grade.update'
  | 'grade.delete'
  | 'grade.manage'

  // Exam Management (5)
  | 'exam.create'
  | 'exam.read'
  | 'exam.update'
  | 'exam.delete'
  | 'exam.manage'

  // Calendar Management (5)
  | 'calendar.create'
  | 'calendar.read'
  | 'calendar.update'
  | 'calendar.delete'
  | 'calendar.manage'

  // Timetable Management (5)
  | 'timetable.create'
  | 'timetable.read'
  | 'timetable.update'
  | 'timetable.delete'
  | 'timetable.manage'

  // Subject Management (5)
  | 'subject.create'
  | 'subject.read'
  | 'subject.update'
  | 'subject.delete'
  | 'subject.manage'

  // Communication Management (5)
  | 'communication.create'
  | 'communication.read'
  | 'communication.update'
  | 'communication.delete'
  | 'communication.manage'

  // Discipline Management (5)
  | 'discipline.create'
  | 'discipline.read'
  | 'discipline.update'
  | 'discipline.delete'
  | 'discipline.manage'

  // Inventory Management (5)
  | 'inventory.create'
  | 'inventory.read'
  | 'inventory.update'
  | 'inventory.delete'
  | 'inventory.manage'

  // Fee Management (5)
  | 'fee.create'
  | 'fee.read'
  | 'fee.update'
  | 'fee.delete'
  | 'fee.manage'

  // Report Management (8)
  | 'report.create'
  | 'report.read'
  | 'report.update'
  | 'report.delete'
  | 'report.manage'
  | 'report.export'
  | 'report.financial'
  | 'report.view'

  // Branch Management (5)
  | 'branch.create'
  | 'branch.read'
  | 'branch.update'
  | 'branch.delete'
  | 'branch.manage'

  // Notification Management (5)
  | 'notification.create'
  | 'notification.read'
  | 'notification.update'
  | 'notification.delete'
  | 'notification.manage'

  // Announcement Management (5)
  | 'announcement.create'
  | 'announcement.read'
  | 'announcement.update'
  | 'announcement.delete'
  | 'announcement.manage'

  // Backup Management (5)
  | 'backup.create'
  | 'backup.read'
  | 'backup.update'
  | 'backup.delete'
  | 'backup.manage'

  // System Administration (4)
  | 'system.settings'
  | 'system.manage_permissions'
  | 'system.manage_roles'
  | 'system.cleanup';

/**
 * All available roles in the system
 */
export type Role =
  | 'superadmin'          // God-level access (110) - ALL 108 permissions
  | 'superadmin'         // Full system access (100) - 106 permissions
  | 'hq_admin'            // HQ administrator (90) - 43 permissions
  | 'branch_admin'        // Branch administrator (80) - 36 permissions
  | 'hq_registrar'        // HQ registrar (70) - 22 permissions
  | 'registrar'           // Branch registrar (60) - 20 permissions
  | 'admin'               // Legacy admin (70) - 32 permissions
  | 'teacher'             // Teacher (50) - 16 permissions
  | 'student'             // Student (20) - 9 permissions
  | 'parent';             // Parent (30) - 11 permissions

/**
 * CRUD actions for resources
 */
export type CRUDAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

/**
 * Resource names
 */
export type Resource =
  | 'user' | 'student' | 'class' | 'teacher' | 'attendance' | 'payment'
  | 'grade' | 'exam' | 'calendar' | 'timetable' | 'subject' | 'communication'
  | 'discipline' | 'inventory' | 'fee' | 'report' | 'branch' | 'notification'
  | 'announcement' | 'backup' | 'system';

// ============================================================================
// USER INTERFACE
// ============================================================================

/**
 * Current user information returned from /api/auth/me
 */
export interface CurrentUser {
  user_id: string;
  email: string;
  role: Role;
  branch_id?: string;
  full_name?: string;
  permissions: Permission[];
}

// ============================================================================
// PERMISSION CHECKING UTILITIES
// ============================================================================

/**
 * Check if user has a specific permission
 * Automatically handles .manage permission expansion
 *
 * @param userPermissions - Array of user's permissions
 * @param requiredPermission - The permission to check
 * @returns true if user has the permission
 *
 * @example
 * hasPermission(user.permissions, 'student.create')
 * // Returns true if user has 'student.create' OR 'student.manage'
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  // Check exact permission
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check if user has .manage for this resource
  const parts = requiredPermission.split('.');
  if (parts.length === 2) {
    const [resource, action] = parts;

    // Only auto-expand for CRUD actions, not for special permissions like manage_superadmins
    const crudActions = ['create', 'read', 'update', 'delete'];
    if (crudActions.includes(action)) {
      const managePermission = `${resource}.manage`;
      if (userPermissions.includes(managePermission)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if user has ANY of the specified permissions
 *
 * @param userPermissions - Array of user's permissions
 * @param requiredPermissions - Array of permissions to check (OR logic)
 * @returns true if user has at least one permission
 *
 * @example
 * hasAnyPermission(user.permissions, ['student.read', 'student.manage'])
 * // Returns true if user has either permission
 */
export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some(perm => hasPermission(userPermissions, perm));
}

/**
 * Check if user has ALL of the specified permissions
 *
 * @param userPermissions - Array of user's permissions
 * @param requiredPermissions - Array of permissions to check (AND logic)
 * @returns true if user has all permissions
 *
 * @example
 * hasAllPermissions(user.permissions, ['student.read', 'class.read'])
 * // Returns true only if user has both permissions
 */
export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every(perm => hasPermission(userPermissions, perm));
}

/**
 * Check if user can perform CRUD action on resource
 *
 * @param userPermissions - Array of user's permissions
 * @param resource - Resource name (e.g., 'student')
 * @param action - CRUD action (e.g., 'create')
 * @returns true if user can perform the action
 *
 * @example
 * canCRUD(user.permissions, 'student', 'create')
 * // Returns true if user has 'student.create' OR 'student.manage'
 */
export function canCRUD(
  userPermissions: string[],
  resource: Resource,
  action: CRUDAction
): boolean {
  const permission = `${resource}.${action}`;
  return hasPermission(userPermissions, permission);
}

/**
 * Get all CRUD permissions user has for a resource
 *
 * @param userPermissions - Array of user's permissions
 * @param resource - Resource name
 * @returns Object with boolean flags for each CRUD action
 *
 * @example
 * getResourcePermissions(user.permissions, 'student')
 * // Returns: { create: true, read: true, update: true, delete: false, manage: true }
 */
export function getResourcePermissions(
  userPermissions: string[],
  resource: Resource
): Record<CRUDAction, boolean> {
  return {
    create: canCRUD(userPermissions, resource, 'create'),
    read: canCRUD(userPermissions, resource, 'read'),
    update: canCRUD(userPermissions, resource, 'update'),
    delete: canCRUD(userPermissions, resource, 'delete'),
    manage: hasPermission(userPermissions, `${resource}.manage`),
  };
}

/**
 * Check if user is admin (any type)
 */
export function isAdmin(role: Role): boolean {
  return ['superadmin', 'superadmin', 'hq_admin', 'branch_admin', 'admin'].includes(role);
}

/**
 * Check if user is HQ-level (can access all branches)
 */
export function isHQRole(role: Role): boolean {
  return ['superadmin', 'superadmin', 'hq_admin', 'hq_registrar'].includes(role);
}

/**
 * Check if user is superadmin
 */
export function isSuperAdmin(role: Role): boolean {
  return role === 'superadmin';
}

// ============================================================================
// PERMISSION GROUPS (for UI organization)
// ============================================================================

export const PERMISSION_GROUPS = {
  ACADEMIC: {
    label: 'Academic Management',
    resources: ['student', 'class', 'teacher', 'grade', 'exam', 'attendance'] as Resource[],
  },
  SCHEDULING: {
    label: 'Scheduling & Calendar',
    resources: ['calendar', 'timetable', 'subject'] as Resource[],
  },
  FINANCIAL: {
    label: 'Financial Management',
    resources: ['payment', 'fee', 'report'] as Resource[],
  },
  COMMUNICATION: {
    label: 'Communication',
    resources: ['communication', 'notification', 'announcement'] as Resource[],
  },
  ADMINISTRATION: {
    label: 'Administration',
    resources: ['user', 'branch', 'discipline', 'inventory'] as Resource[],
  },
  SYSTEM: {
    label: 'System Management',
    resources: ['system', 'backup'] as Resource[],
  },
} as const;

// ============================================================================
// ROLE INFORMATION
// ============================================================================

export interface RoleInfo {
  name: Role;
  displayName: string;
  level: number;
  description: string;
  totalPermissions: number;
  managePermissions: number;
  scope: 'global' | 'all_branches' | 'single_branch' | 'own_data' | 'children_data';
  keyFeatures: string[];
}

export const ROLE_INFO: Record<Role, RoleInfo> = {
  superadmin: {
    name: 'superadmin',
    displayName: 'Super Administrator',
    level: 110,
    description: 'Ultimate god-level system access - ALL permissions',
    totalPermissions: 108,
    managePermissions: 23,
    scope: 'global',
    keyFeatures: [
      'Full access to all system resources',
      'Can manage other superadmins',
      'Can perform database cleanup',
      'Has ALL 108 permissions',
    ],
  },
  superadmin: {
    name: 'superadmin',
    displayName: 'Super Admin',
    level: 100,
    description: 'Full system access except superadmin exclusives',
    totalPermissions: 106,
    managePermissions: 22,
    scope: 'global',
    keyFeatures: [
      'Full access to all system resources',
      'Cannot manage superadmins',
      'Cannot perform database cleanup',
      'Has 106 of 108 permissions',
    ],
  },
  hq_admin: {
    name: 'hq_admin',
    displayName: 'HQ Administrator',
    level: 90,
    description: 'Full administration access across all branches',
    totalPermissions: 43,
    managePermissions: 20,
    scope: 'all_branches',
    keyFeatures: [
      'Full .manage access to all resources',
      'Can access all branches',
      'Can create branches',
      'Can manage system permissions and roles',
    ],
  },
  branch_admin: {
    name: 'branch_admin',
    displayName: 'Branch Administrator',
    level: 80,
    description: 'Full administration within their branch only',
    totalPermissions: 36,
    managePermissions: 15,
    scope: 'single_branch',
    keyFeatures: [
      'Full .manage access within branch',
      'Cannot create branches',
      'Cannot access other branches',
      'Can manage branch users',
    ],
  },
  hq_registrar: {
    name: 'hq_registrar',
    displayName: 'HQ Registrar',
    level: 70,
    description: 'HQ-level registrar permissions',
    totalPermissions: 22,
    managePermissions: 0,
    scope: 'all_branches',
    keyFeatures: [
      'Read access to all resources',
      'Can create/update students and grades',
      'Can access all branches',
      'Cannot delete most resources',
    ],
  },
  registrar: {
    name: 'registrar',
    displayName: 'Registrar',
    level: 60,
    description: 'Branch-level registrar permissions',
    totalPermissions: 20,
    managePermissions: 0,
    scope: 'single_branch',
    keyFeatures: [
      'Read access to branch resources',
      'Can create/update students and grades',
      'Limited to their branch',
      'Cannot delete most resources',
    ],
  },
  admin: {
    name: 'admin',
    displayName: 'Admin (Legacy)',
    level: 70,
    description: 'Legacy admin role - similar to branch admin',
    totalPermissions: 32,
    managePermissions: 13,
    scope: 'single_branch',
    keyFeatures: [
      'Legacy support role',
      'Similar to branch admin',
      'Comprehensive .manage permissions',
    ],
  },
  teacher: {
    name: 'teacher',
    displayName: 'Teacher',
    level: 50,
    description: 'Teacher permissions for academic tasks',
    totalPermissions: 16,
    managePermissions: 0,
    scope: 'single_branch',
    keyFeatures: [
      'Read access to teaching resources',
      'Can create/update grades',
      'Can update student information',
      'Cannot delete anything',
    ],
  },
  student: {
    name: 'student',
    displayName: 'Student',
    level: 20,
    description: 'Student read-only access',
    totalPermissions: 9,
    managePermissions: 0,
    scope: 'own_data',
    keyFeatures: [
      'Read-only access to own data',
      'Can view calendar and timetable',
      'Can view grades and attendance',
      'Cannot modify anything',
    ],
  },
  parent: {
    name: 'parent',
    displayName: 'Parent',
    level: 30,
    description: 'Parent portal access',
    totalPermissions: 11,
    managePermissions: 0,
    scope: 'children_data',
    keyFeatures: [
      "Read-only access to children's data",
      'Can view fees and payments',
      'Can view calendar and communications',
      'Cannot modify anything',
    ],
  },
};

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Response from GET /api/auth/me
 */
export interface AuthMeResponse {
  user_id: string;
  email: string;
  role: Role;
  branch_id?: string;
  full_name?: string;
  permissions: Permission[];
}

/**
 * Login response
 */
export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  user: AuthMeResponse;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * All .manage permissions (23 total)
 */
export const MANAGE_PERMISSIONS: Permission[] = [
  'user.manage',
  'user.manage_superadmins',
  'student.manage',
  'class.manage',
  'teacher.manage',
  'attendance.manage',
  'payment.manage',
  'grade.manage',
  'exam.manage',
  'calendar.manage',
  'timetable.manage',
  'subject.manage',
  'communication.manage',
  'discipline.manage',
  'inventory.manage',
  'fee.manage',
  'report.manage',
  'branch.manage',
  'notification.manage',
  'announcement.manage',
  'backup.manage',
  'system.manage_permissions',
  'system.manage_roles',
];

/**
 * Superadmin exclusive permissions (2 total)
 */
export const SUPERADMIN_EXCLUSIVE: Permission[] = [
  'user.manage_superadmins',
  'system.cleanup',
];
