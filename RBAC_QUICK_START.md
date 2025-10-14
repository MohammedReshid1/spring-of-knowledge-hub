# RBAC Permission System - Quick Start Guide

## ✅ Implementation Complete!

The complete RBAC permission system with **`.manage` permission auto-expansion** has been successfully integrated into your frontend application.

---

## 🚀 What You Got

### 1. **Core Infrastructure** ✅
- Complete TypeScript types for all 108 permissions
- Permission checking utilities with `.manage` auto-expansion
- Custom React hooks for easy permission checks
- Updated RoleAccessContext with proper permission handling
- 403 Forbidden page for unauthorized access
- Updated routing with permission-based protection

### 2. **Key Feature: `.manage` Permission Support** 🔑

**This is the most important feature:**

```typescript
// If user has "student.manage", they automatically get:
✅ student.create
✅ student.read
✅ student.update
✅ student.delete

// Example:
const userPermissions = ['student.manage'];

hasPermission(userPermissions, 'student.create')  // ✅ true
hasPermission(userPermissions, 'student.delete')  // ✅ true
```

---

## 📖 How to Use (3 Easy Steps)

### Step 1: Import the Hook

```tsx
import { usePermission, useResourcePermissions } from '@/hooks/usePermissions';
```

### Step 2: Check Permissions

```tsx
function MyComponent() {
  // Option A: Check individual permission
  const canCreate = usePermission('student.create');

  // Option B: Get all CRUD permissions at once
  const studentPerms = useResourcePermissions('student');

  return (
    <div>
      {canCreate && <Button>Create Student</Button>}
      {studentPerms.update && <Button>Edit</Button>}
      {studentPerms.delete && <Button>Delete</Button>}
    </div>
  );
}
```

### Step 3: That's It!

The system automatically handles `.manage` permissions. If a user has `student.manage`, they'll have all CRUD permissions for students.

---

## 📚 Quick Reference

### Available Hooks

```tsx
// 1. Check single permission
const canCreate = usePermission('student.create');

// 2. Check multiple permissions (OR logic)
const canView = useAnyPermission(['student.read', 'student.manage']);

// 3. Check multiple permissions (AND logic)
const canManage = useAllPermissions(['student.create', 'student.delete']);

// 4. Get all CRUD permissions for a resource
const studentPerms = useResourcePermissions('student');
// Returns: { create: boolean, read: boolean, update: boolean, delete: boolean, manage: boolean }

// 5. Check specific CRUD action
const canCreateStudent = useCRUD('student', 'create');

// 6. Advanced permission check
const { canAccess, canCreate, canEdit, canDelete } = usePermissionCheck({
  resource: 'student',
  requireCreate: true,
  requireEdit: true
});
```

### Available Resources

All 20 resources have complete CRUD + `.manage`:

```
student, teacher, class, attendance, payment, grade, exam,
calendar, timetable, subject, communication, discipline,
inventory, fee, report, branch, notification, announcement,
backup, user
```

### Permission Format

```
{resource}.{action}

Examples:
- student.create
- teacher.update
- payment.delete
- student.manage  ← Grants ALL CRUD for students
```

---

## 📝 Common Use Cases

### Use Case 1: Button Visibility

```tsx
const canCreate = usePermission('student.create');

return (
  <>
    {canCreate && (
      <Button onClick={handleCreate}>
        <Plus /> Create Student
      </Button>
    )}
  </>
);
```

### Use Case 2: Table Actions

```tsx
const studentPerms = useResourcePermissions('student');

return (
  <Table>
    {students.map(student => (
      <TableRow key={student.id}>
        <TableCell>{student.name}</TableCell>
        <TableCell>
          {studentPerms.update && <EditButton />}
          {studentPerms.delete && <DeleteButton />}
        </TableCell>
      </TableRow>
    ))}
  </Table>
);
```

### Use Case 3: Conditional Rendering

```tsx
import { PermissionGuard } from '@/contexts/RoleAccessContext';

return (
  <>
    <PermissionGuard permission="student.create">
      <CreateStudentForm />
    </PermissionGuard>

    <PermissionGuard permissions={['student.read', 'student.manage']} requireAll={false}>
      <StudentList />
    </PermissionGuard>
  </>
);
```

---

## 🎯 Next Steps

### For Your Existing Components:

1. **Find components with CRUD operations** (Create, Edit, Delete buttons)

2. **Add permission checks** using the hooks:
   ```tsx
   import { useResourcePermissions } from '@/hooks/usePermissions';

   function MyComponent() {
     const perms = useResourcePermissions('student');

     return (
       <>
         {perms.create && <CreateButton />}
         {perms.update && <EditButton />}
         {perms.delete && <DeleteButton />}
       </>
     );
   }
   ```

3. **Test with different roles** to verify permissions work correctly

---

## 📂 Important Files

| File | Purpose |
|------|---------|
| `src/types/permissions.ts` | All permission types and utilities |
| `src/hooks/usePermissions.ts` | Custom hooks for permission checks |
| `src/contexts/RoleAccessContext.tsx` | Updated context with `.manage` support |
| `src/pages/ForbiddenPage.tsx` | 403 error page |
| `RBAC_IMPLEMENTATION_COMPLETE.md` | Full technical documentation |
| `PERMISSION_USAGE_EXAMPLES.tsx` | 10+ code examples |
| `FRONTEND_PERMISSION_REFERENCE.json` | Complete permission reference |

---

## ⚠️ Important Notes

1. **Frontend checks are for UX only**
   - The backend ALWAYS validates permissions
   - Frontend checks just hide/show UI elements
   - Never rely on frontend for security

2. **`.manage` is automatic**
   - If user has `{resource}.manage`, they get all CRUD
   - You don't need to check both `.manage` and `.create`
   - The system handles this automatically

3. **Test thoroughly**
   - Login as different roles
   - Verify UI elements show/hide correctly
   - Check that 403 page appears when needed

---

## 🆘 Troubleshooting

### Q: User has `.manage` but UI doesn't show they can create?
**A:** Make sure you're using the hooks from `@/hooks/usePermissions`, not checking permissions manually.

### Q: How do I know what permissions a role has?
**A:** Check `FRONTEND_PERMISSION_REFERENCE.json` or login and check the permissions array from `/api/auth/me`.

### Q: Can I check multiple permissions?
**A:** Yes! Use `useAnyPermission([...])` for OR logic or `useAllPermissions([...])` for AND logic.

### Q: Do I need to update the backend?
**A:** No! The backend already supports this. You're just using it properly now in the frontend.

---

## 📞 Need Help?

1. **Check the examples**: See `PERMISSION_USAGE_EXAMPLES.tsx` for 10+ real-world examples
2. **Read full docs**: See `RBAC_IMPLEMENTATION_COMPLETE.md` for complete technical details
3. **Check backend reference**: See `FRONTEND_PERMISSION_REFERENCE.json` for all 108 permissions

---

## ✨ Summary

You now have a complete, production-ready RBAC permission system with:

- ✅ Full `.manage` permission auto-expansion
- ✅ Easy-to-use React hooks
- ✅ Type-safe permission checking
- ✅ 403 error handling
- ✅ Comprehensive documentation
- ✅ Real-world examples

**Start using it by importing the hooks and checking permissions before showing UI elements!**

```tsx
import { useResourcePermissions } from '@/hooks/usePermissions';

function YourComponent() {
  const perms = useResourcePermissions('student');

  return (
    <>
      {perms.create && <CreateButton />}
      {perms.update && <EditButton />}
      {perms.delete && <DeleteButton />}
    </>
  );
}
```

🎉 **You're all set! Happy coding!**
