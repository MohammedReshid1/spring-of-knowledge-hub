/**
 * PERMISSION USAGE EXAMPLES
 *
 * This file contains practical examples of how to use the new RBAC permission system
 * in your components. Copy and adapt these examples as needed.
 */

import { usePermission, useResourcePermissions, usePermissionCheck } from '@/hooks/usePermissions';
import { PermissionGuard } from '@/contexts/RoleAccessContext';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';

// ============================================================================
// EXAMPLE 1: Simple Permission Check in Component
// ============================================================================

export function Example1_SimplePermissionCheck() {
  // Check individual permissions
  const canCreateStudent = usePermission('student.create');
  const canEditStudent = usePermission('student.update');
  const canDeleteStudent = usePermission('student.delete');

  return (
    <div className="flex gap-2">
      {/* Only show CREATE button if user has permission */}
      {canCreateStudent && (
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Student
        </Button>
      )}

      {/* Only show EDIT button if user has permission */}
      {canEditStudent && (
        <Button>
          <Edit className="h-4 w-4 mr-2" />
          Edit Student
        </Button>
      )}

      {/* Only show DELETE button if user has permission */}
      {canDeleteStudent && (
        <Button variant="destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Student
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: Resource Permissions (Get All CRUD at Once)
// ============================================================================

export function Example2_ResourcePermissions() {
  // Get all CRUD permissions for a resource
  const studentPerms = useResourcePermissions('student');
  // Returns: { create: boolean, read: boolean, update: boolean, delete: boolean, manage: boolean }

  return (
    <div className="space-y-4">
      <div>
        <h3>Student Permissions:</h3>
        <ul>
          <li>Can Create: {studentPerms.create ? '✅' : '❌'}</li>
          <li>Can Read: {studentPerms.read ? '✅' : '❌'}</li>
          <li>Can Update: {studentPerms.update ? '✅' : '❌'}</li>
          <li>Can Delete: {studentPerms.delete ? '✅' : '❌'}</li>
          <li>Has Manage: {studentPerms.manage ? '✅' : '❌'}</li>
        </ul>
      </div>

      <div className="flex gap-2">
        {studentPerms.create && <Button>Create</Button>}
        {studentPerms.update && <Button>Edit</Button>}
        {studentPerms.delete && <Button variant="destructive">Delete</Button>}
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: Table with Row-Level Actions
// ============================================================================

interface Student {
  id: string;
  name: string;
  email: string;
}

export function Example3_TableWithPermissions({ students }: { students: Student[] }) {
  const studentPerms = useResourcePermissions('student');

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.id}>
            <td>{student.name}</td>
            <td>{student.email}</td>
            <td className="flex gap-2">
              {/* Show EDIT button only if user has update permission */}
              {studentPerms.update && (
                <Button size="sm" variant="outline">
                  <Edit className="h-4 w-4" />
                </Button>
              )}

              {/* Show DELETE button only if user has delete permission */}
              {studentPerms.delete && (
                <Button size="sm" variant="destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================================
// EXAMPLE 4: PermissionGuard Component (Declarative Approach)
// ============================================================================

export function Example4_PermissionGuard() {
  return (
    <div className="space-y-4">
      {/* Show content only if user has student.create permission */}
      <PermissionGuard permission="student.create">
        <div className="p-4 bg-blue-50 rounded">
          This content is only visible to users with student.create permission
        </div>
      </PermissionGuard>

      {/* Show content if user has ANY of the permissions (OR logic) */}
      <PermissionGuard
        permissions={['student.read', 'student.manage']}
        requireAll={false}
      >
        <div className="p-4 bg-green-50 rounded">
          This content is visible if user has student.read OR student.manage
        </div>
      </PermissionGuard>

      {/* Show content if user has ALL permissions (AND logic) */}
      <PermissionGuard
        permissions={['student.create', 'student.delete']}
        requireAll={true}
      >
        <div className="p-4 bg-red-50 rounded">
          This content requires BOTH student.create AND student.delete
        </div>
      </PermissionGuard>

      {/* With fallback content */}
      <PermissionGuard
        permission="student.manage"
        fallback={<div className="text-gray-500">You need student.manage permission</div>}
        showFallback={true}
      >
        <div className="p-4 bg-purple-50 rounded">
          Admin-only content (requires student.manage)
        </div>
      </PermissionGuard>
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: Advanced Permission Check
// ============================================================================

export function Example5_AdvancedPermissionCheck() {
  const {
    canAccess,
    canCreate,
    canEdit,
    canDelete,
    resourcePermissions
  } = usePermissionCheck({
    resource: 'student',
    requireCreate: true,  // User MUST have create permission
    requireEdit: true     // User MUST have edit permission
  });

  if (!canAccess) {
    return (
      <div className="p-4 bg-red-50 text-red-800 rounded">
        Access Denied: You need both student.create and student.update permissions
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-green-50 rounded">
        You have the required permissions!
      </div>

      <div className="flex gap-2">
        {canCreate && <Button>Create</Button>}
        {canEdit && <Button>Edit</Button>}
        {canDelete && <Button variant="destructive">Delete</Button>}
      </div>

      <div>
        <h4>All Student Permissions:</h4>
        <pre>{JSON.stringify(resourcePermissions, null, 2)}</pre>
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 6: Multiple Resources
// ============================================================================

export function Example6_MultipleResources() {
  const studentPerms = useResourcePermissions('student');
  const teacherPerms = useResourcePermissions('teacher');
  const classPerms = useResourcePermissions('class');

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Student Management */}
      <div className="p-4 border rounded">
        <h3 className="font-bold mb-2">Student Management</h3>
        {studentPerms.read && <div>✅ Can view students</div>}
        {studentPerms.create && <div>✅ Can create students</div>}
        {studentPerms.update && <div>✅ Can edit students</div>}
        {studentPerms.delete && <div>✅ Can delete students</div>}
      </div>

      {/* Teacher Management */}
      <div className="p-4 border rounded">
        <h3 className="font-bold mb-2">Teacher Management</h3>
        {teacherPerms.read && <div>✅ Can view teachers</div>}
        {teacherPerms.create && <div>✅ Can create teachers</div>}
        {teacherPerms.update && <div>✅ Can edit teachers</div>}
        {teacherPerms.delete && <div>✅ Can delete teachers</div>}
      </div>

      {/* Class Management */}
      <div className="p-4 border rounded">
        <h3 className="font-bold mb-2">Class Management</h3>
        {classPerms.read && <div>✅ Can view classes</div>}
        {classPerms.create && <div>✅ Can create classes</div>}
        {classPerms.update && <div>✅ Can edit classes</div>}
        {classPerms.delete && <div>✅ Can delete classes</div>}
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 7: Form with Permission Checks
// ============================================================================

export function Example7_FormWithPermissions() {
  const canCreate = usePermission('student.create');
  const canUpdate = usePermission('student.update');

  const handleSubmit = async (formData: any) => {
    // Check permission before submitting
    if (formData.id) {
      // Editing existing student
      if (!canUpdate) {
        alert('You do not have permission to update students');
        return;
      }
    } else {
      // Creating new student
      if (!canCreate) {
        alert('You do not have permission to create students');
        return;
      }
    }

    // Proceed with API call...
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Student Name" />
      <input name="email" placeholder="Email" />

      {/* Show submit button based on permission */}
      {(canCreate || canUpdate) && (
        <Button type="submit">
          {canUpdate ? 'Update Student' : 'Create Student'}
        </Button>
      )}

      {!canCreate && !canUpdate && (
        <div className="text-red-600">
          You need student.create or student.update permission to use this form
        </div>
      )}
    </form>
  );
}

// ============================================================================
// EXAMPLE 8: Conditional Navigation Menu
// ============================================================================

export function Example8_ConditionalMenu() {
  const studentPerms = useResourcePermissions('student');
  const teacherPerms = useResourcePermissions('teacher');
  const paymentPerms = useResourcePermissions('payment');
  const reportPerms = useResourcePermissions('report');

  const menuItems = [
    { label: 'Students', show: studentPerms.read, path: '/students' },
    { label: 'Teachers', show: teacherPerms.read, path: '/teachers' },
    { label: 'Payments', show: paymentPerms.read, path: '/payments' },
    { label: 'Reports', show: reportPerms.read, path: '/reports' },
  ];

  return (
    <nav className="flex gap-4">
      {menuItems
        .filter(item => item.show)
        .map(item => (
          <a key={item.path} href={item.path} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
            {item.label}
          </a>
        ))}
    </nav>
  );
}

// ============================================================================
// EXAMPLE 9: Error Handling with Permissions
// ============================================================================

export function Example9_ErrorHandling() {
  const canDelete = usePermission('student.delete');

  const handleDelete = async (studentId: string) => {
    // Check permission before API call
    if (!canDelete) {
      alert('You do not have permission to delete students');
      return;
    }

    try {
      // Make API call
      await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
      alert('Student deleted successfully');
    } catch (error: any) {
      // Handle 403 errors
      if (error.status === 403) {
        alert('Permission denied: You cannot delete this student');
        // Optionally redirect to 403 page
        // window.location.href = '/403';
      } else {
        alert('An error occurred');
      }
    }
  };

  return (
    <Button
      onClick={() => handleDelete('student-123')}
      disabled={!canDelete}
      variant="destructive"
    >
      {canDelete ? 'Delete Student' : 'No Permission to Delete'}
    </Button>
  );
}

// ============================================================================
// EXAMPLE 10: Dashboard with Role-Based Content
// ============================================================================

export function Example10_RoleBasedDashboard() {
  const studentPerms = useResourcePermissions('student');
  const teacherPerms = useResourcePermissions('teacher');
  const paymentPerms = useResourcePermissions('payment');
  const reportPerms = useResourcePermissions('report');

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Show Student card if user can read students */}
      {studentPerms.read && (
        <div className="p-4 border rounded">
          <h3 className="font-bold">Students</h3>
          <p>Total: 150</p>
          {studentPerms.create && <Button>Add New Student</Button>}
        </div>
      )}

      {/* Show Teacher card if user can read teachers */}
      {teacherPerms.read && (
        <div className="p-4 border rounded">
          <h3 className="font-bold">Teachers</h3>
          <p>Total: 25</p>
          {teacherPerms.create && <Button>Add New Teacher</Button>}
        </div>
      )}

      {/* Show Payment card if user can read payments */}
      {paymentPerms.read && (
        <div className="p-4 border rounded">
          <h3 className="font-bold">Payments</h3>
          <p>Total: $50,000</p>
          {paymentPerms.create && <Button>Record Payment</Button>}
        </div>
      )}

      {/* Show Reports card if user can read reports */}
      {reportPerms.read && (
        <div className="p-4 border rounded">
          <h3 className="font-bold">Reports</h3>
          <p>Available: 10</p>
          {reportPerms.export && <Button>Export Report</Button>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// USAGE NOTES
// ============================================================================

/**
 * KEY POINTS:
 *
 * 1. ✅ `.manage` permissions automatically grant all CRUD
 *    - If user has "student.manage", they get create, read, update, delete
 *
 * 2. ✅ Use hooks in function components
 *    - usePermission() for single permission
 *    - useResourcePermissions() for all CRUD permissions
 *    - usePermissionCheck() for advanced checks
 *
 * 3. ✅ Use PermissionGuard for declarative approach
 *    - Cleaner JSX
 *    - Good for wrapping large sections
 *
 * 4. ✅ Always check permissions before sensitive operations
 *    - Before API calls
 *    - Before showing forms
 *    - Before navigation
 *
 * 5. ✅ Handle 403 errors gracefully
 *    - Show user-friendly messages
 *    - Redirect to /403 page if needed
 *
 * 6. ⚠️ Frontend checks are for UX only
 *    - Backend ALWAYS validates permissions
 *    - Never rely on frontend checks for security
 */
