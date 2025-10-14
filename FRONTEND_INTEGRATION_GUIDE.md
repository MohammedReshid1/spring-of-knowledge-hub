# Frontend Integration Guide - Permission System

**Last Updated:** October 9, 2025
**Backend Version:** 1.0
**Total Permissions:** 108

---

## 📋 Quick Summary

The backend has been updated with **complete CRUD permissions** for all resources. All 20 main resources now have:
- ✅ `{resource}.create`
- ✅ `{resource}.read`
- ✅ `{resource}.update`
- ✅ `{resource}.delete`
- ✅ `{resource}.manage` (grants all 4 above)

---

## 📦 Files for Frontend Team

### 1. **FRONTEND_PERMISSION_REFERENCE.json**
Complete permission reference with all 108 permissions, 10 roles, and UI guidelines.

### 2. **FRONTEND_TYPES.ts**
TypeScript definitions with utility functions for permission checking.

### 3. **FRONTEND_INTEGRATION_GUIDE.md** (this file)
Integration guide with examples and best practices.

---

## 🔑 Key Concepts

### Permission Format
```
{resource}.{action}
```

Examples:
- `student.create` - Create students
- `student.read` - View students
- `student.manage` - Full student management (grants all CRUD)

### .manage Permissions

**IMPORTANT:** `.manage` permissions automatically grant all CRUD permissions.

```javascript
// If user has "student.manage", they can:
- student.create ✅
- student.read ✅
- student.update ✅
- student.delete ✅
```

---

## 🚀 Quick Start

### 1. Get User Permissions

```javascript
// GET /api/auth/me
const response = await fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const user = await response.json();
// {
//   user_id: "123",
//   email: "admin@example.com",
//   role: "hq_admin",
//   branch_id: "branch-123",
//   permissions: ["student.manage", "class.manage", "teacher.read", ...]
// }
```

### 2. Check Permission

```javascript
// Import the utility function from FRONTEND_TYPES.ts
import { hasPermission } from './types/permissions';

// Check if user can create students
if (hasPermission(user.permissions, 'student.create')) {
  // Show create button
  return <CreateStudentButton />;
}
```

### 3. Handle .manage Permissions

```javascript
function hasPermission(userPermissions, requiredPermission) {
  // Check exact permission
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check if user has .manage for this resource
  const [resource, action] = requiredPermission.split('.');
  if (userPermissions.includes(`${resource}.manage`)) {
    return true;
  }

  return false;
}

// Examples:
hasPermission(['student.manage'], 'student.create')  // ✅ true
hasPermission(['student.manage'], 'student.delete')  // ✅ true
hasPermission(['student.read'], 'student.create')    // ❌ false
```

---

## 📊 All Resources with Complete CRUD

| Resource | Permissions | .manage |
|----------|-------------|---------|
| **user** | create, read, update, delete | ✅ user.manage |
| **student** | create, read, update, delete | ✅ student.manage |
| **class** | create, read, update, delete | ✅ class.manage |
| **teacher** | create, read, update, delete | ✅ teacher.manage |
| **attendance** | create, read, update, delete | ✅ attendance.manage |
| **payment** | create, read, update, delete | ✅ payment.manage |
| **grade** | create, read, update, delete | ✅ grade.manage |
| **exam** | create, read, update, delete | ✅ exam.manage |
| **calendar** | create, read, update, delete | ✅ calendar.manage |
| **timetable** | create, read, update, delete | ✅ timetable.manage |
| **subject** | create, read, update, delete | ✅ subject.manage |
| **communication** | create, read, update, delete | ✅ communication.manage |
| **discipline** | create, read, update, delete | ✅ discipline.manage |
| **inventory** | create, read, update, delete | ✅ inventory.manage |
| **fee** | create, read, update, delete | ✅ fee.manage |
| **report** | create, read, update, delete | ✅ report.manage |
| **branch** | create, read, update, delete | ✅ branch.manage |
| **notification** | create, read, update, delete | ✅ notification.manage |
| **announcement** | create, read, update, delete | ✅ announcement.manage |
| **backup** | create, read, update, delete | ✅ backup.manage |

---

## 👥 Role Summary

| Role | Permissions | .manage Count | Scope |
|------|-------------|---------------|-------|
| **superadmin** | 108 (ALL) | 23 | Global |
| **super_admin** | 106 | 22 | Global |
| **hq_admin** | 43 | 20 | All branches |
| **branch_admin** | 36 | 15 | Single branch |
| **hq_registrar** | 22 | 0 | All branches |
| **registrar** | 20 | 0 | Single branch |
| **admin** (legacy) | 32 | 13 | Single branch |
| **teacher** | 16 | 0 | Single branch |
| **student** | 9 | 0 | Own data |
| **parent** | 11 | 0 | Children data |

---

## 💡 UI Implementation Examples

### Example 1: Conditional Button Rendering

```jsx
// React/Vue/Angular example
function StudentManagement({ user }) {
  return (
    <div>
      <h1>Students</h1>

      {/* Show create button if user can create */}
      {hasPermission(user.permissions, 'student.create') && (
        <button onClick={handleCreate}>Create Student</button>
      )}

      {/* Show student list if user can read */}
      {hasPermission(user.permissions, 'student.read') && (
        <StudentList />
      )}
    </div>
  );
}
```

### Example 2: Action Buttons in Table

```jsx
function StudentRow({ student, user }) {
  const canEdit = hasPermission(user.permissions, 'student.update');
  const canDelete = hasPermission(user.permissions, 'student.delete');

  return (
    <tr>
      <td>{student.name}</td>
      <td>{student.email}</td>
      <td>
        {canEdit && (
          <button onClick={() => handleEdit(student)}>Edit</button>
        )}
        {canDelete && (
          <button onClick={() => handleDelete(student)}>Delete</button>
        )}
      </td>
    </tr>
  );
}
```

### Example 3: Route Protection

```jsx
// React Router example
function ProtectedRoute({ children, requiredPermission }) {
  const { user } = useAuth();

  if (!hasPermission(user.permissions, requiredPermission)) {
    return <Navigate to="/403" />;
  }

  return children;
}

// Usage:
<Route path="/students/create" element={
  <ProtectedRoute requiredPermission="student.create">
    <CreateStudentPage />
  </ProtectedRoute>
} />
```

### Example 4: Menu Items

```jsx
function Navigation({ user }) {
  const menuItems = [
    {
      label: 'Students',
      path: '/students',
      permission: 'student.read',
    },
    {
      label: 'Teachers',
      path: '/teachers',
      permission: 'teacher.read',
    },
    {
      label: 'Payments',
      path: '/payments',
      permission: 'payment.read',
    },
    {
      label: 'Reports',
      path: '/reports',
      permission: 'report.read',
    },
  ];

  return (
    <nav>
      {menuItems
        .filter(item => hasPermission(user.permissions, item.permission))
        .map(item => (
          <Link key={item.path} to={item.path}>
            {item.label}
          </Link>
        ))}
    </nav>
  );
}
```

### Example 5: Multiple Permission Check

```jsx
// Check if user has ANY of the permissions (OR logic)
function hasAnyPermission(userPermissions, requiredPermissions) {
  return requiredPermissions.some(perm =>
    hasPermission(userPermissions, perm)
  );
}

// Check if user has ALL permissions (AND logic)
function hasAllPermissions(userPermissions, requiredPermissions) {
  return requiredPermissions.every(perm =>
    hasPermission(userPermissions, perm)
  );
}

// Usage:
if (hasAnyPermission(user.permissions, ['student.read', 'student.manage'])) {
  // User can view students
}

if (hasAllPermissions(user.permissions, ['student.read', 'payment.read'])) {
  // User can view both students and payments
}
```

### Example 6: Get All Permissions for Resource

```javascript
function getResourcePermissions(userPermissions, resource) {
  return {
    create: hasPermission(userPermissions, `${resource}.create`),
    read: hasPermission(userPermissions, `${resource}.read`),
    update: hasPermission(userPermissions, `${resource}.update`),
    delete: hasPermission(userPermissions, `${resource}.delete`),
    manage: hasPermission(userPermissions, `${resource}.manage`),
  };
}

// Usage:
const studentPerms = getResourcePermissions(user.permissions, 'student');
// { create: true, read: true, update: true, delete: false, manage: true }

if (studentPerms.create) {
  // Show create button
}
```

---

## 🔐 Security Best Practices

### 1. Always Check Permissions in Frontend
```javascript
// ❌ Bad - No permission check
<button onClick={deleteStudent}>Delete</button>

// ✅ Good - Check permission
{hasPermission(user.permissions, 'student.delete') && (
  <button onClick={deleteStudent}>Delete</button>
)}
```

### 2. Backend Always Validates
```
⚠️ IMPORTANT: Frontend permission checks are for UX only.
The backend ALWAYS validates permissions on every request.
```

### 3. Handle 403 Errors Gracefully
```javascript
try {
  await api.deleteStudent(studentId);
} catch (error) {
  if (error.status === 403) {
    // Show permission denied message
    toast.error('You do not have permission to delete students');
  }
}
```

### 4. Refresh Permissions After Login
```javascript
async function login(email, password) {
  const { access_token } = await api.login(email, password);

  // Store token
  localStorage.setItem('token', access_token);

  // Fetch user permissions
  const user = await api.getCurrentUser();

  // Store in state/context
  setCurrentUser(user);
}
```

---

## 📱 API Endpoints

### Get Current User
```
GET /api/auth/me
Authorization: Bearer {token}

Response:
{
  "user_id": "123",
  "email": "admin@example.com",
  "role": "hq_admin",
  "branch_id": "branch-123",
  "full_name": "Admin User",
  "permissions": [
    "student.manage",
    "class.manage",
    "teacher.read",
    ...
  ]
}
```

### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123"
}

Response:
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

---

## 🆕 Recent Changes (October 9, 2025)

### Added 25 New Permissions:

**Announcement (4 new):**
- ✅ announcement.create
- ✅ announcement.read
- ✅ announcement.update
- ✅ announcement.delete

**Attendance (4 new):**
- ✅ attendance.create
- ✅ attendance.update
- ✅ attendance.delete
- ✅ attendance.manage

**Backup (4 new):**
- ✅ backup.create
- ✅ backup.read
- ✅ backup.update
- ✅ backup.delete

**Class (2 new):**
- ✅ class.create
- ✅ class.delete

**Exam (4 new):**
- ✅ exam.create
- ✅ exam.update
- ✅ exam.delete
- ✅ exam.manage

**Grade (1 new):**
- ✅ grade.delete

**Notification (4 new):**
- ✅ notification.create
- ✅ notification.read
- ✅ notification.update
- ✅ notification.delete

**Report (2 new):**
- ✅ report.update
- ✅ report.delete

### Before & After:
- **Total Permissions:** 83 → 108 (+25)
- **.manage Permissions:** 21 → 23 (+2)
- **Complete CRUD Resources:** 7 → 20 (+13)

---

## 🧪 Testing Checklist

### For Each Resource, Test:
- [ ] Create button shows only if user has `{resource}.create` OR `{resource}.manage`
- [ ] Edit button shows only if user has `{resource}.update` OR `{resource}.manage`
- [ ] Delete button shows only if user has `{resource}.delete` OR `{resource}.manage`
- [ ] List view shows only if user has `{resource}.read` OR `{resource}.manage`
- [ ] 403 error handled gracefully when user lacks permission

### Test Different Roles:
- [ ] **Teacher** can read but not delete students
- [ ] **Registrar** can create/update but not delete students
- [ ] **Branch Admin** has full CRUD within their branch
- [ ] **HQ Admin** has full CRUD across all branches
- [ ] **Student** has read-only access to own data
- [ ] **Parent** has read-only access to children's data

---

## 🤝 Support

### Questions?
- Check **FRONTEND_PERMISSION_REFERENCE.json** for complete permission list
- Check **FRONTEND_TYPES.ts** for TypeScript definitions
- Check backend logs for permission validation errors

### Common Issues:

**Q: User has .manage but UI shows they can't create?**
A: Make sure your permission check handles .manage permissions:
```javascript
// ❌ Wrong - only checks exact permission
if (user.permissions.includes('student.create'))

// ✅ Correct - also checks .manage
if (hasPermission(user.permissions, 'student.create'))
```

**Q: Permission works in frontend but fails in backend?**
A: Backend validates permissions independently. Check backend logs for the exact permission being checked.

**Q: How to know what permissions a role has?**
A: Check the `permissions` array in `/api/auth/me` response or refer to FRONTEND_PERMISSION_REFERENCE.json roles section.

---

## 📚 Additional Resources

1. **FRONTEND_PERMISSION_REFERENCE.json** - Complete permission catalog
2. **FRONTEND_TYPES.ts** - TypeScript definitions and utilities
3. **COMPLETE_CRUD_PERMISSIONS_ADDED.md** - Technical implementation details
4. **RBAC_QUICK_REFERENCE.md** - Backend developer reference

---

**Last Updated:** October 9, 2025
**Total Permissions:** 108
**Total Resources:** 20
**Total Roles:** 10
**Status:** ✅ Production Ready
