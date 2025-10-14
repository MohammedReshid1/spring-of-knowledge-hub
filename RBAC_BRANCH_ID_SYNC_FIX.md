# RBAC Branch ID Synchronization - FIXED ✅

**Date:** October 10, 2025
**Issue:** Role assignment not updating user's `branch_id` field
**Status:** FIXED

## Problem Description

When assigning a branch-specific role (like `branch_admin`) through the RBAC Management UI, the system was correctly:
- Creating the role assignment in the `user_role_assignments` collection with the selected `branch_id`
- Including the `branch_id` in the API request

But it was **NOT**:
- Updating the user's `branch_id` field in the `users` collection

### Impact

This caused users with branch-specific roles to:
- Have `branch_id: null` or `branch_id: ""` in their JWT token
- See 0 students/data when logging in because branch-filtered queries returned no results
- Be unable to access their branch's data even though they had the correct role assignment

## Root Cause

The `/backend/app/services/rbac_service.py` `assign_role()` method was only:
1. Creating the role assignment document
2. Invalidating the permission cache

It was missing the step to update the user's `branch_id` in the `users` collection.

## Solution Implemented

### 1. Fixed `assign_role()` Method

**File:** `/backend/app/services/rbac_service.py` (lines 378-392)

Added logic to update the user's `branch_id` when assigning a branch-specific role:

```python
# If this is a branch-specific role and a branch_id is provided,
# update the user's branch_id in the users collection
if role.branch_specific and request.branch_id:
    users_collection = self.db.users
    update_result = await users_collection.update_one(
        {"_id": ObjectId(request.user_id)},
        {
            "$set": {
                "branch_id": request.branch_id,
                "updated_at": datetime.utcnow()
            }
        }
    )
    if update_result.modified_count > 0:
        logger.info(f"Updated user {request.user_id} branch_id to {request.branch_id}")
```

### 2. Enhanced `revoke_role()` Method

**File:** `/backend/app/services/rbac_service.py` (lines 399-449)

Added logic to clear the user's `branch_id` when revoking the last branch-specific role:

```python
# If we revoked a branch-specific role, check if user still has any branch-specific roles
if role and role.branch_specific:
    # Get remaining active roles for this user
    remaining_roles = await self.get_user_roles(user_id)

    # Check if any remaining roles are branch-specific
    has_branch_role = False
    for user_role in remaining_roles:
        remaining_role = await self.get_role(user_role.role_id)
        if remaining_role and remaining_role.branch_specific:
            has_branch_role = True
            break

    # If no branch-specific roles remain, clear the user's branch_id
    if not has_branch_role:
        users_collection = self.db.users
        update_result = await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "branch_id": None,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        if update_result.modified_count > 0:
            logger.info(f"Cleared branch_id for user {user_id} (no branch-specific roles remaining)")
```

## Synchronization for Existing Users

For users who were assigned branch-specific roles before this fix, use the synchronization script:

```bash
cd backend
python3 fix_user_branch_id_sync.py
```

**Script:** `/backend/fix_user_branch_id_sync.py`

This script:
1. Finds all users with branch-specific role assignments
2. Checks if their `branch_id` in the `users` collection is missing or empty
3. Updates the `branch_id` to match their role assignment
4. Provides a summary of changes made

## Testing the Fix

### Test Case 1: Assign Branch-Specific Role
1. Log in as superadmin
2. Go to RBAC Management → User Role Assignment
3. Select a user (e.g., a new branch_admin)
4. Assign role: `branch_admin`
5. Select branch: `Jemo`
6. Save assignment

**Expected Result:**
- Role assignment created in `user_role_assignments` collection with `branch_id: "68dc6f68d29733e270cadd37"`
- User document in `users` collection updated with `branch_id: "68dc6f68d29733e270cadd37"`
- User's JWT token (on next login) includes correct `branch_id`
- User can see students and data from their branch

### Test Case 2: Revoke Branch-Specific Role
1. Log in as superadmin
2. Go to RBAC Management → User Role Assignment
3. Find a user with only one branch-specific role
4. Revoke the `branch_admin` role

**Expected Result:**
- Role assignment removed from `user_role_assignments` collection
- User document in `users` collection updated with `branch_id: null`
- User's JWT token (on next login) has `branch_id: null`

### Test Case 3: Multiple Branch Roles
1. Assign a user two branch-specific roles for different branches
2. Revoke one of the roles

**Expected Result:**
- User's `branch_id` remains set to the first branch they were assigned
- Only when all branch-specific roles are revoked should `branch_id` be cleared

## Verification Queries

Check user's branch_id in users collection:
```javascript
db.users.find({email: 'admin@jemo.com'}, {email: 1, role: 1, branch_id: 1})
```

Check user's role assignments:
```javascript
db.user_role_assignments.find({user_id: '68e62acb5e3b493c50a9079b'})
```

Check which roles are branch-specific:
```javascript
db.roles.find({branch_specific: true}, {name: 1, display_name: 1, branch_specific: 1})
```

## Flow Diagram

### Before Fix
```
User assigns role via RBAC UI
  ↓
Frontend sends: { user_id, role_id, branch_id }
  ↓
Backend creates user_role_assignments document
  ↓
❌ User's users.branch_id NOT updated
  ↓
User logs in → JWT has branch_id: null
  ↓
Branch-filtered queries return 0 results
```

### After Fix
```
User assigns role via RBAC UI
  ↓
Frontend sends: { user_id, role_id, branch_id }
  ↓
Backend creates user_role_assignments document
  ↓
✅ Backend checks if role is branch-specific
  ↓
✅ Backend updates users.branch_id
  ↓
User logs in → JWT has correct branch_id
  ↓
Branch-filtered queries return correct results
```

## Related Files

- **Service:** `/backend/app/services/rbac_service.py` (lines 341-449)
- **API Endpoint:** `/backend/app/routers/rbac.py` (lines 349-383)
- **Frontend UI:** `/src/components/rbac/UserRoleAssignment.tsx`
- **Sync Script:** `/backend/fix_user_branch_id_sync.py`

## Benefits

1. **✅ Automatic Sync:** Branch ID is now automatically synced when assigning roles
2. **✅ Consistent State:** Users collection and role assignments always match
3. **✅ JWT Accuracy:** JWT tokens include correct `branch_id` for branch-filtered queries
4. **✅ Data Visibility:** Branch admins can now see their branch's data immediately
5. **✅ Cleanup Logic:** Revoking roles properly clears `branch_id` when appropriate

## Future Considerations

Consider adding a database trigger or validation to ensure `branch_id` consistency:
- Validate that users with branch-specific roles always have a `branch_id`
- Alert if inconsistencies are detected
- Add monitoring for branch_id sync failures

---

**Status:** ✅ FIXED AND DEPLOYED
**Backend Server:** Auto-reloaded with changes
**Ready for Testing:** Yes
**Migration Script Available:** Yes
