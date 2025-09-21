import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

// Define role hierarchy and permissions
enum Role {
  SUPER_ADMIN = "super_admin",
  SUPERADMIN = "superadmin", // Backend format
  HQ_ADMIN = "hq_admin", 
  BRANCH_ADMIN = "branch_admin",
  HQ_REGISTRAR = "hq_registrar",
  REGISTRAR = "registrar",
  ADMIN = "admin", // Legacy support
  TEACHER = "teacher",
  STUDENT = "student",
  PARENT = "parent"
}

enum Permission {
  // User Management
  CREATE_USER = "create_user",
  READ_USER = "read_user", 
  UPDATE_USER = "update_user",
  DELETE_USER = "delete_user",
  MANAGE_ROLES = "manage_roles",
  
  // Student Management
  CREATE_STUDENT = "create_student",
  READ_STUDENT = "read_student",
  UPDATE_STUDENT = "update_student", 
  DELETE_STUDENT = "delete_student",
  BULK_IMPORT_STUDENTS = "bulk_import_students",
  
  // Academic Management
  CREATE_CLASS = "create_class",
  READ_CLASS = "read_class",
  UPDATE_CLASS = "update_class",
  DELETE_CLASS = "delete_class",
  ASSIGN_STUDENTS = "assign_students",
  
  // Teacher Management
  CREATE_TEACHER = "create_teacher",
  READ_TEACHER = "read_teacher",
  UPDATE_TEACHER = "update_teacher",
  DELETE_TEACHER = "delete_teacher",
  ASSIGN_SUBJECTS = "assign_subjects",
  
  // Financial Management
  CREATE_PAYMENT = "create_payment",
  READ_PAYMENT = "read_payment",
  UPDATE_PAYMENT = "update_payment",
  DELETE_PAYMENT = "delete_payment",
  PROCESS_REFUNDS = "process_refunds",
  VIEW_FINANCIAL_REPORTS = "view_financial_reports",
  
  // Academic Records
  CREATE_GRADE = "create_grade",
  READ_GRADE = "read_grade",
  UPDATE_GRADE = "update_grade",
  DELETE_GRADE = "delete_grade",
  VIEW_TRANSCRIPTS = "view_transcripts",
  
  // Attendance Management
  CREATE_ATTENDANCE = "create_attendance",
  READ_ATTENDANCE = "read_attendance",
  UPDATE_ATTENDANCE = "update_attendance",
  DELETE_ATTENDANCE = "delete_attendance",
  
  // Behavior and Discipline
  CREATE_BEHAVIOR_RECORD = "create_behavior_record",
  READ_BEHAVIOR_RECORD = "read_behavior_record",
  UPDATE_BEHAVIOR_RECORD = "update_behavior_record",
  DELETE_BEHAVIOR_RECORD = "delete_behavior_record",
  
  // Reports and Analytics
  VIEW_REPORTS = "view_reports",
  CREATE_REPORTS = "create_reports",
  EXPORT_DATA = "export_data",
  VIEW_ANALYTICS = "view_analytics",
  
  // Communication
  SEND_MESSAGES = "send_messages",
  READ_MESSAGES = "read_messages",
  CREATE_ANNOUNCEMENTS = "create_announcements",
  MANAGE_NOTIFICATIONS = "manage_notifications",
  
  // System Administration
  MANAGE_BRANCHES = "manage_branches",
  SYSTEM_SETTINGS = "system_settings",
  BACKUP_RESTORE = "backup_restore",
  VIEW_LOGS = "view_logs",
  
  // Inventory Management
  CREATE_INVENTORY = "create_inventory",
  READ_INVENTORY = "read_inventory",
  UPDATE_INVENTORY = "update_inventory",
  DELETE_INVENTORY = "delete_inventory",
  
  // Transport Management
  CREATE_TRANSPORT = "create_transport",
  READ_TRANSPORT = "read_transport",
  UPDATE_TRANSPORT = "update_transport",
  DELETE_TRANSPORT = "delete_transport"
}

// Define role permissions mapping
const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  [Role.SUPER_ADMIN]: new Set(Object.values(Permission)),
  [Role.SUPERADMIN]: new Set(Object.values(Permission)), // Backend format
  
  [Role.HQ_ADMIN]: new Set([
    Permission.CREATE_USER, Permission.READ_USER, Permission.UPDATE_USER, Permission.DELETE_USER,
    Permission.CREATE_STUDENT, Permission.READ_STUDENT, Permission.UPDATE_STUDENT, Permission.DELETE_STUDENT,
    Permission.BULK_IMPORT_STUDENTS,
    Permission.CREATE_CLASS, Permission.READ_CLASS, Permission.UPDATE_CLASS, Permission.DELETE_CLASS,
    Permission.ASSIGN_STUDENTS,
    Permission.CREATE_TEACHER, Permission.READ_TEACHER, Permission.UPDATE_TEACHER, Permission.DELETE_TEACHER,
    Permission.ASSIGN_SUBJECTS,
    Permission.CREATE_PAYMENT, Permission.READ_PAYMENT, Permission.UPDATE_PAYMENT, Permission.DELETE_PAYMENT,
    Permission.PROCESS_REFUNDS, Permission.VIEW_FINANCIAL_REPORTS,
    Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE, Permission.DELETE_GRADE,
    Permission.VIEW_TRANSCRIPTS,
    Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE, Permission.DELETE_ATTENDANCE,
    Permission.CREATE_BEHAVIOR_RECORD, Permission.READ_BEHAVIOR_RECORD, Permission.UPDATE_BEHAVIOR_RECORD, Permission.DELETE_BEHAVIOR_RECORD,
    Permission.VIEW_REPORTS, Permission.CREATE_REPORTS, Permission.EXPORT_DATA, Permission.VIEW_ANALYTICS,
    Permission.SEND_MESSAGES, Permission.READ_MESSAGES, Permission.CREATE_ANNOUNCEMENTS, Permission.MANAGE_NOTIFICATIONS,
    Permission.MANAGE_BRANCHES, Permission.SYSTEM_SETTINGS, Permission.BACKUP_RESTORE, Permission.VIEW_LOGS,
    Permission.CREATE_INVENTORY, Permission.READ_INVENTORY, Permission.UPDATE_INVENTORY, Permission.DELETE_INVENTORY,
    Permission.CREATE_TRANSPORT, Permission.READ_TRANSPORT, Permission.UPDATE_TRANSPORT, Permission.DELETE_TRANSPORT
  ]),
  
  [Role.BRANCH_ADMIN]: new Set([
    Permission.CREATE_USER, Permission.READ_USER, Permission.UPDATE_USER,
    Permission.CREATE_STUDENT, Permission.READ_STUDENT, Permission.UPDATE_STUDENT, Permission.DELETE_STUDENT,
    Permission.BULK_IMPORT_STUDENTS,
    Permission.CREATE_CLASS, Permission.READ_CLASS, Permission.UPDATE_CLASS, Permission.DELETE_CLASS,
    Permission.ASSIGN_STUDENTS,
    Permission.CREATE_TEACHER, Permission.READ_TEACHER, Permission.UPDATE_TEACHER, Permission.DELETE_TEACHER,
    Permission.ASSIGN_SUBJECTS,
    Permission.CREATE_PAYMENT, Permission.READ_PAYMENT, Permission.UPDATE_PAYMENT, Permission.DELETE_PAYMENT,
    Permission.VIEW_FINANCIAL_REPORTS,
    Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE, Permission.DELETE_GRADE,
    Permission.VIEW_TRANSCRIPTS,
    Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE, Permission.DELETE_ATTENDANCE,
    Permission.CREATE_BEHAVIOR_RECORD, Permission.READ_BEHAVIOR_RECORD, Permission.UPDATE_BEHAVIOR_RECORD, Permission.DELETE_BEHAVIOR_RECORD,
    Permission.VIEW_REPORTS, Permission.CREATE_REPORTS, Permission.EXPORT_DATA, Permission.VIEW_ANALYTICS,
    Permission.SEND_MESSAGES, Permission.READ_MESSAGES, Permission.CREATE_ANNOUNCEMENTS, Permission.MANAGE_NOTIFICATIONS,
    Permission.CREATE_INVENTORY, Permission.READ_INVENTORY, Permission.UPDATE_INVENTORY, Permission.DELETE_INVENTORY,
    Permission.CREATE_TRANSPORT, Permission.READ_TRANSPORT, Permission.UPDATE_TRANSPORT, Permission.DELETE_TRANSPORT
  ]),
  
  [Role.HQ_REGISTRAR]: new Set([
    Permission.CREATE_STUDENT, Permission.READ_STUDENT, Permission.UPDATE_STUDENT,
    Permission.BULK_IMPORT_STUDENTS,
    Permission.READ_CLASS, Permission.ASSIGN_STUDENTS,
    Permission.READ_TEACHER,
    Permission.READ_PAYMENT, Permission.VIEW_FINANCIAL_REPORTS,
    Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE,
    Permission.VIEW_TRANSCRIPTS,
    Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE,
    Permission.READ_BEHAVIOR_RECORD,
    Permission.VIEW_REPORTS, Permission.EXPORT_DATA,
    Permission.SEND_MESSAGES, Permission.READ_MESSAGES,
    Permission.READ_INVENTORY,
    Permission.READ_TRANSPORT
  ]),
  
  [Role.REGISTRAR]: new Set([
    Permission.CREATE_STUDENT, Permission.READ_STUDENT, Permission.UPDATE_STUDENT,
    Permission.BULK_IMPORT_STUDENTS,
    Permission.READ_CLASS, Permission.ASSIGN_STUDENTS,
    Permission.READ_TEACHER,
    Permission.READ_PAYMENT,
    Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE,
    Permission.VIEW_TRANSCRIPTS,
    Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE,
    Permission.READ_BEHAVIOR_RECORD,
    Permission.VIEW_REPORTS,
    Permission.SEND_MESSAGES, Permission.READ_MESSAGES,
    Permission.READ_INVENTORY,
    Permission.READ_TRANSPORT
  ]),
  
  [Role.ADMIN]: new Set([
    Permission.CREATE_USER, Permission.READ_USER, Permission.UPDATE_USER,
    Permission.CREATE_STUDENT, Permission.READ_STUDENT, Permission.UPDATE_STUDENT, Permission.DELETE_STUDENT,
    Permission.CREATE_CLASS, Permission.READ_CLASS, Permission.UPDATE_CLASS, Permission.DELETE_CLASS,
    Permission.ASSIGN_STUDENTS,
    Permission.CREATE_TEACHER, Permission.READ_TEACHER, Permission.UPDATE_TEACHER, Permission.DELETE_TEACHER,
    Permission.ASSIGN_SUBJECTS,
    Permission.CREATE_PAYMENT, Permission.READ_PAYMENT, Permission.UPDATE_PAYMENT,
    Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE,
    Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE,
    Permission.CREATE_BEHAVIOR_RECORD, Permission.READ_BEHAVIOR_RECORD, Permission.UPDATE_BEHAVIOR_RECORD,
    Permission.VIEW_REPORTS, Permission.CREATE_REPORTS,
    Permission.SEND_MESSAGES, Permission.READ_MESSAGES, Permission.CREATE_ANNOUNCEMENTS,
    Permission.CREATE_INVENTORY, Permission.READ_INVENTORY, Permission.UPDATE_INVENTORY,
    Permission.CREATE_TRANSPORT, Permission.READ_TRANSPORT, Permission.UPDATE_TRANSPORT
  ]),
  
  [Role.TEACHER]: new Set([
    Permission.READ_STUDENT, Permission.UPDATE_STUDENT,
    Permission.READ_CLASS,
    Permission.READ_TEACHER,
    Permission.READ_PAYMENT,
    Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE,
    Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE,
    Permission.CREATE_BEHAVIOR_RECORD, Permission.READ_BEHAVIOR_RECORD, Permission.UPDATE_BEHAVIOR_RECORD,
    Permission.VIEW_REPORTS,
    Permission.SEND_MESSAGES, Permission.READ_MESSAGES,
    Permission.READ_INVENTORY,
    Permission.READ_TRANSPORT
  ]),
  
  [Role.STUDENT]: new Set([
    Permission.READ_STUDENT, // Only their own data
    Permission.READ_CLASS,   // Only their classes
    Permission.READ_GRADE,   // Only their grades
    Permission.READ_ATTENDANCE, // Only their attendance
    Permission.READ_BEHAVIOR_RECORD, // Only their records
    Permission.SEND_MESSAGES, Permission.READ_MESSAGES // Limited messaging
  ]),
  
  [Role.PARENT]: new Set([
    Permission.READ_STUDENT, // Only their children's data
    Permission.READ_CLASS,   // Only their children's classes
    Permission.READ_PAYMENT, // Only their payment records
    Permission.READ_GRADE,   // Only their children's grades
    Permission.READ_ATTENDANCE, // Only their children's attendance
    Permission.READ_BEHAVIOR_RECORD, // Only their children's records
    Permission.SEND_MESSAGES, Permission.READ_MESSAGES // Communication with teachers
  ])
};

const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 100,
  [Role.SUPERADMIN]: 100, // Backend format
  [Role.HQ_ADMIN]: 90,
  [Role.BRANCH_ADMIN]: 80,
  [Role.HQ_REGISTRAR]: 70,
  [Role.REGISTRAR]: 60,
  [Role.ADMIN]: 70, // Legacy admin similar to registrar
  [Role.TEACHER]: 50,
  [Role.STUDENT]: 20,
  [Role.PARENT]: 30
};

export const useRoleAccess = () => {
  const { user } = useAuth();
  const userRole = user?.role as Role;

  // Fetch user permissions from backend
  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['userPermissions', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await apiClient.getUserPermissions();
      if (error) {
        console.warn('Failed to fetch user permissions from backend:', error);
        return null;
      }
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1
  });

  // Permission checking function - use backend permissions if available, fallback to local
  const hasPermission = (permission: Permission): boolean => {
    if (!userRole) return false;
    
    // Super admin always has all permissions - check using helper function
    if (isSuperAdmin()) return true;
    
    // Normalize role format for consistency
    const normalizedRole = userRole === 'superadmin' ? Role.SUPER_ADMIN : userRole as Role;
    
    // Use backend permissions if available
    if (userPermissions?.permissions && !permissionsLoading) {
      return userPermissions.permissions.includes(permission);
    }
    
    // If backend permissions are loading but we have a super admin, allow access
    if (permissionsLoading && isSuperAdmin()) {
      return true;
    }
    
    // Fallback to local role permissions with normalized role
    const permissions = ROLE_PERMISSIONS[normalizedRole];
    return permissions ? permissions.has(permission) : false;
  };

  // Role hierarchy checking
  const hasRoleLevel = (minLevel: number): boolean => {
    if (!userRole) return false;
    return (ROLE_HIERARCHY[userRole] || 0) >= minLevel;
  };

  // Check if user can access another role
  const canAccessRole = (targetRole: Role): boolean => {
    if (!userRole) return false;
    return (ROLE_HIERARCHY[userRole] || 0) > (ROLE_HIERARCHY[targetRole] || 0);
  };

  // Role detection methods  
  const isSuperAdmin = () => userRole === Role.SUPER_ADMIN || userRole === Role.SUPERADMIN;
  const isHQAdmin = () => userRole === Role.HQ_ADMIN;
  const isBranchAdmin = () => userRole === Role.BRANCH_ADMIN;
  const isHQRegistrar = () => userRole === Role.HQ_REGISTRAR;
  const isRegistrar = () => userRole === Role.REGISTRAR;
  const isAdmin = () => userRole === Role.ADMIN; // Legacy support
  const isTeacher = () => userRole === Role.TEACHER;
  const isStudent = () => userRole === Role.STUDENT;
  const isParent = () => userRole === Role.PARENT;
  
  // Role group detection
  const isHQRole = () => isSuperAdmin() || isHQAdmin() || isHQRegistrar();
  const isBranchRole = () => isBranchAdmin() || isRegistrar() || isAdmin();
  const isAdminRole = () => isSuperAdmin() || isHQAdmin() || isBranchAdmin() || isAdmin();
  const isRegistrarRole = () => isHQRegistrar() || isRegistrar();
  
  // Permission methods
  const canEdit = () => hasPermission(Permission.UPDATE_USER) || hasPermission(Permission.UPDATE_STUDENT);
  const canDelete = () => hasPermission(Permission.DELETE_USER) || hasPermission(Permission.DELETE_STUDENT);
  const canCreate = () => hasPermission(Permission.CREATE_USER) || hasPermission(Permission.CREATE_STUDENT);
  const canView = () => hasPermission(Permission.READ_USER) || hasPermission(Permission.READ_STUDENT);
  const canManageUsers = () => hasPermission(Permission.CREATE_USER);
  const canManageAdmins = () => isSuperAdmin();
  const canSwitchBranches = () => isHQRole();
  const canManageBranches = () => hasPermission(Permission.MANAGE_BRANCHES);
  
  // Branch access permissions
  const canAccessAllBranches = () => isHQRole();
  const isRestrictedToBranch = () => isBranchRole();

  // Specific feature permissions
  const canViewFinancialData = () => {
    if (!userRole) return false;
    
    // Super admin always has access to financial data - check all variants
    if (isSuperAdmin()) {
      return true;
    }
    
    // Check if backend permissions are still loading - grant temporary access for super admin
    if (permissionsLoading && isSuperAdmin()) {
      return true;
    }
    
    // Use permission-based check for other roles
    return hasPermission(Permission.VIEW_FINANCIAL_REPORTS);
  };
  
  const canProcessPayments = () => {
    if (!userRole) return false;
    
    // Super admin always has access to process payments - check all variants
    if (isSuperAdmin()) {
      return true;
    }
    
    // Check if backend permissions are still loading - grant temporary access for super admin
    if (permissionsLoading && isSuperAdmin()) {
      return true;
    }
    
    // Use permission-based check for other roles
    return hasPermission(Permission.CREATE_PAYMENT);
  };
  const canViewReports = () => hasPermission(Permission.VIEW_REPORTS);
  const canExportData = () => hasPermission(Permission.EXPORT_DATA);
  const canSendAnnouncements = () => hasPermission(Permission.CREATE_ANNOUNCEMENTS);
  const canManageClasses = () => hasPermission(Permission.CREATE_CLASS);
  const canBulkImportStudents = () => hasPermission(Permission.BULK_IMPORT_STUDENTS);
  
  // Granular CRUD permissions
  const canCreateStudent = () => hasPermission(Permission.CREATE_STUDENT);
  const canReadStudent = () => hasPermission(Permission.READ_STUDENT);
  const canUpdateStudent = () => hasPermission(Permission.UPDATE_STUDENT);
  const canDeleteStudent = () => hasPermission(Permission.DELETE_STUDENT);
  
  const canCreateTeacher = () => hasPermission(Permission.CREATE_TEACHER);
  const canReadTeacher = () => hasPermission(Permission.READ_TEACHER);
  const canUpdateTeacher = () => hasPermission(Permission.UPDATE_TEACHER);
  const canDeleteTeacher = () => hasPermission(Permission.DELETE_TEACHER);
  
  const canCreateGrade = () => hasPermission(Permission.CREATE_GRADE);
  const canReadGrade = () => hasPermission(Permission.READ_GRADE);
  const canUpdateGrade = () => hasPermission(Permission.UPDATE_GRADE);
  const canDeleteGrade = () => hasPermission(Permission.DELETE_GRADE);
  
  const canCreateAttendance = () => hasPermission(Permission.CREATE_ATTENDANCE);
  const canReadAttendance = () => hasPermission(Permission.READ_ATTENDANCE);
  const canUpdateAttendance = () => hasPermission(Permission.UPDATE_ATTENDANCE);
  const canDeleteAttendance = () => hasPermission(Permission.DELETE_ATTENDANCE);
  
  const canManageInventory = () => hasPermission(Permission.CREATE_INVENTORY) || hasPermission(Permission.UPDATE_INVENTORY);
  const canManageTransport = () => hasPermission(Permission.CREATE_TRANSPORT) || hasPermission(Permission.UPDATE_TRANSPORT);
  const canManageBehavior = () => hasPermission(Permission.CREATE_BEHAVIOR_RECORD) || hasPermission(Permission.UPDATE_BEHAVIOR_RECORD);

  // Route access control
  const canAccessRoute = (routePath: string): boolean => {
    // Define route permissions
    const routePermissions: Record<string, Permission[]> = {
      '/students': [Permission.READ_STUDENT],
      '/classes': [Permission.READ_CLASS],
      '/teachers': [Permission.READ_USER],
      '/attendance': [Permission.READ_ATTENDANCE],
      '/payments': [Permission.READ_PAYMENT],
      '/branches': [Permission.MANAGE_BRANCHES],
      '/settings': [], // All authenticated users
      '/inventory': [Permission.READ_USER], // General access for now
      '/discipline': [Permission.READ_STUDENT],
      '/notifications': [Permission.READ_MESSAGES],
      '/parent-portal': [Permission.READ_STUDENT],
      '/grade-levels': [Permission.READ_CLASS], // Grade levels need class management access
      '/exams': [Permission.READ_CLASS],
      '/assignments': [Permission.READ_CLASS],
      '/calendar': [Permission.READ_CLASS],
    };

    const requiredPermissions = routePermissions[routePath];
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No specific permissions required
    }

    return requiredPermissions.some(permission => hasPermission(permission));
  };

  // Navigation filtering
  const getAccessibleNavigation = (navigationItems: Array<{href: string, adminOnly?: boolean}>) => {
    return navigationItems.filter(item => {
      if (item.adminOnly && !isAdminRole()) {
        return false;
      }
      return canAccessRoute(item.href);
    });
  };

  // Enhanced permission checking with backend validation
  const checkPermissionAsync = async (permission: Permission): Promise<boolean> => {
    if (!userRole) return false;
    
    // Super admin always has permission - no need to check backend
    if (isSuperAdmin()) return true;
    
    try {
      const { data, error } = await apiClient.checkUserPermission(permission);
      if (error) {
        console.warn('Failed to check permission with backend:', error);
        // Fallback to local check
        return hasPermission(permission);
      }
      // Handle both response formats for backward compatibility
      return data?.has_permission || data?.hasPermission || false;
    } catch (error) {
      console.warn('Error checking permission:', error);
      // For super admin, always fallback to true even on error
      if (isSuperAdmin()) return true;
      return hasPermission(permission);
    }
  };

  return {
    // Role checking
    userRole,
    isSuperAdmin: isSuperAdmin(),
    isHQAdmin: isHQAdmin(),
    isBranchAdmin: isBranchAdmin(),
    isHQRegistrar: isHQRegistrar(),
    isRegistrar: isRegistrar(),
    isAdmin: isAdmin(),
    isTeacher: isTeacher(),
    isStudent: isStudent(),
    isParent: isParent(),
    
    // Role group checks
    isHQRole: isHQRole(),
    isBranchRole: isBranchRole(),
    isAdminRole: isAdminRole(),
    isRegistrarRole: isRegistrarRole(),
    
    // General permissions
    canEdit: canEdit(),
    canDelete: canDelete(),
    canCreate: canCreate(),
    canView: canView(),
    canManageUsers: canManageUsers(),
    canManageAdmins: canManageAdmins(),
    canSwitchBranches: canSwitchBranches(),
    canManageBranches: canManageBranches(),
    
    // Branch access
    canAccessAllBranches: canAccessAllBranches(),
    isRestrictedToBranch: isRestrictedToBranch(),
    
    // Feature permissions
    canViewFinancialData: canViewFinancialData(),
    canProcessPayments: canProcessPayments(),
    canViewFinances: canViewFinancialData(), // Alias for compatibility
    canViewReports: canViewReports(),
    canExportData: canExportData(),
    canSendAnnouncements: canSendAnnouncements(),
    canManageClasses: canManageClasses(),
    canBulkImportStudents: canBulkImportStudents(),
    
    // Granular CRUD permissions
    canCreateStudent: canCreateStudent(),
    canReadStudent: canReadStudent(),
    canUpdateStudent: canUpdateStudent(),
    canDeleteStudent: canDeleteStudent(),
    canCreateTeacher: canCreateTeacher(),
    canReadTeacher: canReadTeacher(),
    canUpdateTeacher: canUpdateTeacher(),
    canDeleteTeacher: canDeleteTeacher(),
    canCreateGrade: canCreateGrade(),
    canReadGrade: canReadGrade(),
    canUpdateGrade: canUpdateGrade(),
    canDeleteGrade: canDeleteGrade(),
    canCreateAttendance: canCreateAttendance(),
    canReadAttendance: canReadAttendance(),
    canUpdateAttendance: canUpdateAttendance(),
    canDeleteAttendance: canDeleteAttendance(),
    canManageInventory: canManageInventory(),
    canManageTransport: canManageTransport(),
    canManageBehavior: canManageBehavior(),
    
    // Utility functions
    hasPermission,
    hasRoleLevel,
    canAccessRole,
    canAccessRoute,
    getAccessibleNavigation,
    checkPermissionAsync,
    
    // Backend state
    permissionsLoading,
    userPermissions,
    
    // Enums for external use
    Role,
    Permission
  };
};
