# 🚨 URGENT: Frontend Must Stop Batch Permission Checking

**Date:** October 9, 2025
**Priority:** CRITICAL
**Status:** ⚠️ FRONTEND ACTION REQUIRED

---

## 🐛 Current Problem

The frontend is STILL calling `/rbac/me/check-permission` with 700+ permissions in a single request:

```
GET /rbac/me/check-permission?permission=subject.schedule.delete,class.analytics.create,...[700+ more]
```

**This is causing 520 errors on these endpoints:**
- `/grade-levels/` → 520
- `/students/all` → 520
- Other endpoints → 520

---

## ❌ What Frontend is Doing WRONG

```javascript
// ❌ WRONG - Don't do this!
const permissions = [
  'subject.schedule.delete',
  'class.analytics.create',
  'report.analytics.create',
  ... // 700+ permissions
];

// Joining all permissions with commas and sending in one request
const permissionString = permissions.join(',');
const response = await fetch(`/rbac/me/check-permission?permission=${permissionString}`);
```

**Why this is wrong:**
1. Creates an extremely long URL (thousands of characters)
2. Crashes the server with 520 error
3. Slow and inefficient
4. Unnecessary API call

---

## ✅ What Frontend SHOULD Do Instead

### Solution: Use `/auth/me` and Check Locally

```javascript
// ✅ CORRECT - Do this instead!

// Step 1: Get ALL permissions from /auth/me (once on login)
async function login(email, password) {
  const loginResponse = await fetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: email, password }),
  });

  const { access_token } = await loginResponse.json();

  // Store token
  localStorage.setItem('token', access_token);

  // Step 2: Get user info with ALL permissions
  const userResponse = await fetch('/auth/me', {
    headers: {
      'Authorization': `Bearer ${access_token}`
    }
  });

  const userData = await userResponse.json();

  // userData now contains:
  // {
  //   user_id: "123",
  //   email: "admin@example.com",
  //   role: "superadmin",
  //   branch_id: "branch-123",
  //   permissions: [
  //     "student.create",
  //     "student.read",
  //     "student.update",
  //     ... // ALL permissions (100+ items)
  //   ]
  // }

  // Step 3: Store in global state (Context/Redux/Zustand)
  setUser(userData);

  return userData;
}

// Step 4: Check permissions locally (in memory)
function hasPermission(userPermissions, requiredPermission) {
  // Check exact permission
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check if user has .manage for this resource
  const [resource] = requiredPermission.split('.');
  if (userPermissions.includes(`${resource}.manage`)) {
    return true;
  }

  return false;
}

// Step 5: Use it in your components
function StudentPage() {
  const { user } = useAuth(); // Get from context/store

  return (
    <div>
      {/* Show create button if user can create students */}
      {hasPermission(user.permissions, 'student.create') && (
        <CreateStudentButton />
      )}

      {/* Show delete button if user can delete students */}
      {hasPermission(user.permissions, 'student.delete') && (
        <DeleteStudentButton />
      )}
    </div>
  );
}
```

---

## 🔍 Where to Find and Fix the Problem

### Search your frontend codebase for:

```javascript
// Pattern 1: Batch permission checking
"/rbac/me/check-permission"

// Pattern 2: Joining permissions
permissions.join(',')
permissions.join('&')

// Pattern 3: Large permission arrays being sent to API
fetch(`/rbac/me/check-permission?permission=${longString}`)
```

### Common locations to check:

1. **Auth/Permission Service:**
   - `services/auth.ts` or `services/permissions.ts`
   - `hooks/usePermissions.ts` or `hooks/useAuth.ts`
   - `context/AuthContext.tsx` or `context/PermissionContext.tsx`

2. **API Client:**
   - `api/client.ts` or `api/permissions.ts`
   - `utils/api.ts`

3. **Permission Checking Logic:**
   - Any file that imports or uses permission checking
   - Look for code that runs on app initialization

---

## 🛠️ Step-by-Step Fix

### Step 1: Remove Batch Permission Checking

**Find this code and DELETE it:**

```javascript
// ❌ DELETE THIS CODE
async function checkAllPermissions(permissions) {
  const permissionString = permissions.join(',');
  const response = await fetch(
    `/rbac/me/check-permission?permission=${permissionString}`
  );
  return response.json();
}
```

### Step 2: Update Auth Service to Get Permissions from /auth/me

```javascript
// ✅ ADD THIS CODE
async function getCurrentUser() {
  const token = localStorage.getItem('token');

  const response = await fetch('/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const user = await response.json();

  // user.permissions is now an array of ALL user permissions
  return user;
}
```

### Step 3: Create Local Permission Check Function

```javascript
// ✅ ADD THIS FUNCTION
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  // Check exact permission
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check .manage permission
  const [resource] = requiredPermission.split('.');
  const managePermission = `${resource}.manage`;

  if (userPermissions.includes(managePermission)) {
    return true;
  }

  return false;
}
```

### Step 4: Update Components to Use Local Checking

**Before (Wrong):**
```javascript
// ❌ WRONG - Don't do this
const [canCreate, setCanCreate] = useState(false);

useEffect(() => {
  // Making API call to check permission
  checkPermission('student.create').then(result => {
    setCanCreate(result.has_permission);
  });
}, []);

return canCreate ? <CreateButton /> : null;
```

**After (Correct):**
```javascript
// ✅ CORRECT - Do this
const { user } = useAuth(); // Get from context
const canCreate = hasPermission(user.permissions, 'student.create');

return canCreate ? <CreateButton /> : null;
```

---

## 📋 Checklist

- [ ] Remove all calls to `/rbac/me/check-permission` with multiple permissions
- [ ] Update auth service to call `/auth/me` on login
- [ ] Store `user.permissions` in global state (Context/Redux/Zustand)
- [ ] Implement `hasPermission()` function for local checks
- [ ] Update all components to use `hasPermission()` instead of API calls
- [ ] Test that no 520 errors occur
- [ ] Verify permissions work correctly in UI

---

## 🧪 Testing

### Test 1: Verify No Batch Permission Calls

Open browser DevTools → Network tab:

1. Login to the application
2. Navigate to different pages
3. **Check:** Should see ZERO calls to `/rbac/me/check-permission` with long URLs
4. **Should see:** One call to `/auth/me` that returns permissions array

### Test 2: Verify Permissions Work

1. Login as different roles (admin, teacher, student)
2. Check that correct buttons/features show/hide
3. Verify UI responds instantly (no loading spinners for permission checks)

### Test 3: Verify No 520 Errors

1. Navigate to:
   - `/grade-levels/`
   - `/students/all`
   - Other pages that were showing 520

2. **Expected:** All pages load without 520 errors

---

## 💡 Why This Fix is Important

### Performance:

**Before (Wrong):**
- 1 API call with 700+ permissions → Server crashes → 520 error
- Even if it worked, extremely slow

**After (Correct):**
- 1 API call on login gets ALL permissions
- All checks done in memory (instant)
- No network delay

### Scalability:

**Before (Wrong):**
- URL length limits (usually 2048 characters)
- Server timeout on large requests
- Not scalable beyond ~50 permissions

**After (Correct):**
- Works with 100, 1000, or 10,000 permissions
- No URL length issues
- Scales infinitely

---

## 🚨 CRITICAL: Do NOT Use These Patterns

```javascript
// ❌ WRONG - Do NOT do any of these:

// 1. Batch checking permissions
const perms = permissions.join(',');
fetch(`/rbac/me/check-permission?permission=${perms}`);

// 2. Checking permissions one by one in a loop
for (const perm of permissions) {
  await fetch(`/rbac/me/check-permission?permission=${perm}`);
}

// 3. Checking permissions on every render
useEffect(() => {
  checkPermission('student.create');
}, []); // This makes an API call!

// 4. Checking permissions on every page load
await api.checkAllPermissions(allPermissions);
```

---

## ✅ CORRECT Patterns to Use

```javascript
// ✅ CORRECT - Do these instead:

// 1. Get permissions ONCE on login
const user = await getCurrentUser(); // Calls /auth/me
setUser(user); // Store in state

// 2. Check permissions locally (in memory)
const canCreate = hasPermission(user.permissions, 'student.create');

// 3. Use React context/hooks for permissions
const { user } = useAuth();
const canDelete = hasPermission(user.permissions, 'student.delete');

// 4. No API calls for permission checking after login
// All checks are done in memory using the permissions array
```

---

## 📞 Need Help?

### If you're unsure where the issue is:

1. **Search for these strings in your frontend:**
   ```
   "rbac/me/check-permission"
   "permissions.join"
   "checkPermission"
   "checkAllPermissions"
   ```

2. **Look for files that:**
   - Make API calls for permission checking
   - Join multiple permissions together
   - Call permission endpoints in loops

3. **Common file names to check:**
   ```
   services/permissions.ts
   services/auth.ts
   hooks/usePermissions.ts
   hooks/useAuth.ts
   context/AuthContext.tsx
   utils/permissions.ts
   api/permissions.ts
   ```

---

## 🎯 Expected Result After Fix

1. ✅ No calls to `/rbac/me/check-permission` with multiple permissions
2. ✅ One call to `/auth/me` on login returns all permissions
3. ✅ All permission checks done locally (instant, no API calls)
4. ✅ No 520 errors
5. ✅ Fast, responsive UI

---

## 📝 Summary

**The Problem:**
- Frontend sends 700+ permissions in one URL → Server crashes → 520 error

**The Solution:**
1. Call `/auth/me` once on login → Get ALL permissions
2. Store permissions in global state
3. Check permissions locally using `hasPermission()`
4. Never call `/rbac/me/check-permission` with multiple permissions

**The Result:**
- ✅ No more 520 errors
- ✅ Fast, instant permission checks
- ✅ Scalable to any number of permissions

---

**URGENT:** This must be fixed before the application can work properly!

**Timeline:** Fix immediately - this is blocking the entire application

**Contact:** Backend team has already fixed their side. Frontend needs to update.
