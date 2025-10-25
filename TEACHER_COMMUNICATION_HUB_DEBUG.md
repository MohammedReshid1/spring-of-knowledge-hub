# Teacher Communication Hub - Debug Summary

## Issue

The Parent Communication Hub page (`/teacher-communication`) is not loading teacher classes, showing all zeros for stats (parents, classes, students).

## Root Cause Analysis

### Frontend API Call
**File:** `/src/pages/TeacherCommunicationPage.tsx` (lines 50-60)

**Current Implementation:**
```typescript
const { data: teacherClassesResponse } = useQuery({
  queryKey: ['teacher-classes', user?.id],
  queryFn: async () => {
    const { data, error } = await apiClient.getMyTeacherClasses();
    if (error) throw new Error(error);
    return data;
  },
  enabled: isTeacher && !!user?.id,
});

const teacherClasses = teacherClassesResponse?.classes || [];
```

**API Endpoint:** `GET /teachers/enhanced/me/classes`

### Backend Endpoint
**File:** `/backend/app/routers/teachers_enhanced.py` (lines 277-307)

**Implementation:**
```python
@router.get("/me/classes")
async def get_my_classes(
    teachers: Any = Depends(get_teacher_collection),
    classes: Any = Depends(get_classes_collection),
    students: Any = Depends(get_student_collection),
    users: Any = Depends(get_user_collection),
    current_user: dict = Depends(get_current_user_permissions),
):
    try:
        if current_user.get("role") != "teacher":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                              detail="Only teachers can access this endpoint")

        teacher_id, teacher_doc = await _resolve_current_teacher(users, teachers, current_user)
        if not teacher_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                              detail="Teacher not found for current user")

        teacher_classes = await TeacherClassService.get_teacher_classes(
            teacher_id=teacher_id,
            classes_collection=classes,
            students_collection=students
        )

        return {
            "teacher_id": teacher_id,
            "teacher_name": teacher_doc.get("name", "") if teacher_doc else "",
            "classes": teacher_classes,
            "total_classes": len(teacher_classes),
            "total_students": sum(c.get("current_enrollment", 0) for c in teacher_classes)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                          detail=f"me/classes resolution error: {str(e)}")
```

### Backend Logs Analysis

From `uvicorn` logs:
```
INFO:     127.0.0.1:51519 - "GET /teachers/enhanced/me/classes HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:51517 - "GET /teachers/enhanced/me/classes HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:51550 - "GET /teachers/enhanced/me/classes HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:51590 - "GET /teachers/enhanced/me/classes HTTP/1.1" 500 Internal Server Error
INFO:     127.0.0.1:51733 - "GET /teachers/enhanced/me/classes HTTP/1.1" 401 Unauthorized
```

**Findings:**
1. ✅ Endpoint is registered and accessible
2. ✅ CORS headers are configured correctly
3. ❌ Initial requests return **500 Internal Server Error** (backend crash)
4. ❌ Most recent request returns **401 Unauthorized** (authentication failure)

### Error Patterns

#### Pattern 1: 500 Internal Server Error
**Possible Causes:**
- `_resolve_current_teacher()` function failing
- Teacher record not found in database
- Database connection issues
- Exception in `TeacherClassService.get_teacher_classes()`

#### Pattern 2: 401 Unauthorized
**Possible Causes:**
- User not authenticated (no JWT token)
- JWT token expired
- Token missing required fields (`user_id`, `sub`, or `id`)
- Token doesn't have `role: "teacher"`

## Current Status

### ✅ Completed
1. Fixed endpoint path from `/teachers/{id}/classes` to `/teachers/enhanced/me/classes`
2. Updated frontend to use `getMyTeacherClasses()` method
3. CORS configuration is correct

### ❌ Remaining Issues
1. **Backend 500 Error:** Something is crashing in the endpoint logic
2. **Authentication:** Most recent call shows 401 Unauthorized

## Debugging Steps

### Step 1: Verify User Authentication
Check if the logged-in user has:
- Valid JWT token
- `role: "teacher"` in token payload
- Proper `user_id` field in token

### Step 2: Check Teacher Record
Verify if the teacher record exists in the database:
```javascript
// Check in MongoDB or via API:
db.teachers.findOne({ email: "teacher@email.com" })
```

### Step 3: Check User-Teacher Mapping
Verify if the user record has a `teacher_id` field:
```javascript
db.users.findOne({ _id: ObjectId("user_id") })
// Should have: { teacher_id: "teacher_record_id" }
```

### Step 4: Enable Detailed Logging
Add detailed error logging to the endpoint to capture the exact exception:

```python
@router.get("/me/classes")
async def get_my_classes(...):
    try:
        logger.info(f"Current user: {current_user}")
        logger.info(f"User role: {current_user.get('role')}")

        if current_user.get("role") != "teacher":
            raise HTTPException(...)

        logger.info("Resolving teacher...")
        teacher_id, teacher_doc = await _resolve_current_teacher(users, teachers, current_user)
        logger.info(f"Teacher ID: {teacher_id}, Teacher Doc: {teacher_doc}")

        # ... rest of code
    except Exception as e:
        logger.error(f"Error in get_my_classes: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise
```

## Next Steps

1. **Immediate Action:** Check if user is logged in and has teacher role
2. **Database Check:** Verify teacher record exists and is linked to user
3. **Add Logging:** Enable detailed error logging to capture exact failure point
4. **Test Authentication:** Ensure JWT token is valid and contains required fields

## Related Files

### Frontend
- `/src/pages/TeacherCommunicationPage.tsx` - Main communication hub page
- `/src/lib/api.ts` - API client with `getMyTeacherClasses()` method
- `/src/hooks/useAuth.tsx` - Authentication context

### Backend
- `/backend/app/routers/teachers_enhanced.py` - Teacher endpoints
- `/backend/app/utils/dynamic_rbac.py` - Authentication dependencies
- `/backend/app/services/teacher_class_service.py` - Teacher class service

## Expected Behavior

When working correctly:
1. User logs in as teacher
2. JWT token contains `role: "teacher"` and `user_id`
3. Endpoint resolves teacher record from `users.teacher_id` or `teachers.email`
4. Returns list of classes with student counts
5. Frontend displays parents, classes, and students stats

## Test Credentials

To test, ensure you're logged in with a user that has:
- Role: `teacher`
- Email matching a record in `teachers` collection
- OR `teacher_id` field in `users` collection linking to `teachers` collection
