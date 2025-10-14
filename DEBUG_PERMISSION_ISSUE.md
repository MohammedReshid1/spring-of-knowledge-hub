# 🐛 Debug Permission Issue - branch_admin Cannot Access Calendar

## Problem

User with role `branch_admin` is seeing "Access Denied" when trying to access the Calendar page, which requires `class.read` permission.

## Debugging Steps

I've added extensive logging to help identify the issue. Please follow these steps:

### Step 1: Open Browser Console

1. Open the application at http://localhost:8080/
2. Open Browser DevTools (F12)
3. Go to the **Console** tab
4. Clear the console

### Step 2: Login as branch_admin

1. Login with your `branch_admin` account
2. **Look for these log messages** in the console:

```
🔍 RoleAccessContext - User object: {... }
🔍 User permissions array: [...]
🔍 Permissions length: X
```

### Step 3: Check What You See

#### ✅ SCENARIO A: Permissions are in the user object
If you see:
```
✅ Using permissions from AuthContext: ["permission1", "permission2", ...]
```

**This means**: Backend IS returning permissions from `/auth/me`
**Next**: Scroll down to see which permissions you have

#### ⚠️ SCENARIO B: No permissions in user object
If you see:
```
⚠️ No permissions found in user object from AuthContext!
⚠️ Falling back to /rbac/me/permissions API call
📡 Calling /rbac/me/permissions API...
✅ Fetched permissions from /rbac/me/permissions API: {...}
📋 Permissions array: [...]
```

**This means**: Backend is NOT returning permissions from `/auth/me`, but the fallback API works
**Next**: We need to fix the backend `/auth/me` endpoint

#### ❌ SCENARIO C: No permissions at all
If you see:
```
⚠️ No permissions found in user object from AuthContext!
❌ Error fetching permissions from API: ...
```

**This means**: Backend is not returning permissions at all
**Next**: Backend needs to be configured to return permissions for `branch_admin` role

### Step 4: Try to Access Calendar

1. Click on the Calendar menu item
2. **Look for this log message**:

```
🔐 Permission check: "class.read" = ❌ DENIED
   Available permissions: [...]
```

This will show you:
- Whether you have the `class.read` permission
- What permissions you actually have

### Step 5: Report Back

**Please copy and paste the ENTIRE console output** and share it with me. I need to see:

1. What the user object contains
2. What permissions array looks like
3. What the permission check shows

## Expected Permissions for branch_admin

According to the RBAC reference, `branch_admin` should have permissions like:
- `class.read`
- `class.create`
- `class.update`
- `class.delete`
- `student.read`
- `student.create`
- `teacher.read`
- And many more...

If the console shows **empty permissions array `[]`**, then the backend is not configured properly for the `branch_admin` role.

## Quick Test

You can also test this manually in the browser console:

```javascript
// Check what permissions you have
console.log('My permissions:', window.__PERMISSIONS__);

// Or check the React state
// (This requires React DevTools)
```

## Possible Issues

### Issue 1: Backend not returning permissions in `/auth/me`
**Solution**: Backend needs to update `/auth/me` endpoint to include permissions array

### Issue 2: `branch_admin` role has no permissions assigned
**Solution**: Backend needs to assign permissions to the `branch_admin` role

### Issue 3: Permissions exist but `class.read` is missing
**Solution**: Backend needs to add `class.read` permission to `branch_admin` role

## Next Steps

Once you provide the console output, I can:
1. Identify exactly where the problem is (frontend or backend)
2. Provide the exact fix needed
3. Update the backend configuration if needed

---

**Please check the console now and let me know what you see!** 🔍
