# Timetable Testing Guide

## Testing the Timetable Components

### Prerequisites
1. Backend running at http://127.0.0.1:8000
2. Frontend running at http://localhost:8080
3. Logged in with a user that has `timetable.create`, `timetable.update`, `timetable.delete`, or `timetable.manage` permissions
4. A branch selected in the system

### Test 1: Time Slot Management

**Location**: Timetable page → "Time Slots" tab

#### Test Single Time Slot Creation:
1. Click the **"Time Slots"** tab
2. Fill in the form:
   - Period Number: 1
   - Start Time: 08:00
   - End Time: 09:00
   - Period Type: Regular Class
   - Is Break: No
3. Click **"Create Time Slot"** button
4. **Expected**: Success toast message, time slot appears in the list

#### Test Bulk Time Slot Creation:
1. Click **"Bulk Create Time Slots"** button
2. Fill in the wizard:
   - Start Period: 1
   - End Period: 8
   - Start Time: 08:00
   - Period Duration: 45 minutes
   - Break Duration: 10 minutes
   - Include Breaks: Yes
   - Lunch After Period: 4
   - Lunch Duration: 30 minutes
3. Click **"Create All Time Slots"**
4. **Expected**: Multiple time slots created with sequential integer period numbers (1, 2, 3... not 1.5, 2.5)

### Test 2: Room Management

**Location**: Timetable page → "Rooms" tab

#### Test Room Creation:
1. Click the **"Rooms"** tab
2. Click **"Add New Room"** button (+ icon)
3. Fill in the form:
   - Room Number: 101
   - Room Name: Science Lab
   - Room Type: Laboratory
   - Capacity: 30
   - Equipment: Microscopes, Lab Benches
   - Floor: 1
   - Building: Main Building
4. Click **"Create"** or **"Save"**
5. **Expected**: Room created and appears in the list

#### Test Room Editing:
1. Find a room in the list
2. Click the **Edit** button (pencil icon)
3. Modify any field (e.g., change capacity)
4. Click **"Update"** or **"Save"**
5. **Expected**: Room updated successfully

#### Test Room Deletion:
1. Find a room in the list
2. Click the **Delete** button (trash icon)
3. Confirm deletion
4. **Expected**: Room deleted from the list

### Test 3: Timetable Templates

**Location**: Timetable page → "Templates" tab

#### Test Template Creation:
1. Click the **"Templates"** tab
2. Click **"Create Template"** button
3. Fill in the form:
   - Template Name: Grade 9 Standard Schedule
   - Description: Standard weekly schedule for Grade 9
   - Source Class: (select any class with existing timetable)
   - Grade Level: Grade 9
4. Click **"Create Template"**
5. **Expected**: Template created (currently mock data, but button should work)

## Troubleshooting

### If buttons don't work:

#### Check 1: Browser Console Errors
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors when clicking buttons
4. Common errors:
   - `branch_id is required` → No branch selected
   - `academic_year is required` → Academic year not loaded
   - `Permission denied` → User lacks required permissions
   - Network errors → Backend not running

#### Check 2: Network Tab
1. Open DevTools → Network tab
2. Click a button
3. Look for API requests:
   - POST `/api/timetable/time-slots` for time slot creation
   - POST `/api/timetable/rooms` for room creation
   - Check response status:
     - 200/201 = Success
     - 401 = Not authenticated
     - 403 = No permission
     - 422 = Validation error (check response body)
     - 500 = Server error

#### Check 3: User Permissions
1. Open browser console
2. Type: `localStorage.getItem('auth_token')`
3. Copy the token
4. Go to https://jwt.io and paste the token
5. Check the `role` field in the decoded token
6. Verify user has one of these permissions:
   - `timetable.create`
   - `timetable.update`
   - `timetable.delete`
   - `timetable.manage`

#### Check 4: Branch Selection
1. Look at the top of the page
2. Ensure a branch is selected in the branch dropdown
3. If "All Branches" is selected, try selecting a specific branch

#### Check 5: Academic Year
1. Open browser console
2. Type: `fetch('http://127.0.0.1:8000/academic-calendar/academic-years/current').then(r=>r.json()).then(console.log)`
3. Check if an academic year is returned
4. If not, you need to create an academic year in the system

## Backend API Testing

### Test Time Slot API directly:
```bash
# Get current academic year
curl http://127.0.0.1:8000/academic-calendar/academic-years/current

# Create time slot (replace TOKEN and BRANCH_ID)
curl -X POST http://127.0.0.1:8000/api/timetable/time-slots \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "period_number": 1,
    "start_time": "08:00:00",
    "end_time": "09:00:00",
    "period_type": "regular",
    "is_break": false,
    "branch_id": "YOUR_BRANCH_ID",
    "academic_year": "2024-2025"
  }'
```

### Test Room API directly:
```bash
# Create room (replace TOKEN and BRANCH_ID)
curl -X POST http://127.0.0.1:8000/api/timetable/rooms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "room_number": "101",
    "room_name": "Science Lab",
    "room_type": "laboratory",
    "capacity": 30,
    "equipment": ["Microscopes"],
    "is_available": true,
    "branch_id": "YOUR_BRANCH_ID"
  }'
```

## Expected Behavior

### All buttons should:
1. Be visually clickable (not grayed out) if user has permissions
2. Show loading state when clicked
3. Display success/error toast message after operation
4. Refresh the data list after successful creation/update/deletion
5. Close any open dialogs after successful operation

### Common Issues Fixed:
✅ Period numbers are now integers (not 7.5, 8.5, etc.)
✅ Room creation includes `branch_id`
✅ Time slot creation includes `branch_id` and `academic_year`
✅ TypeScript types match backend requirements
✅ All validation checks are in place

## Next Steps if Issues Persist

1. Share the exact error message from browser console
2. Share the network request/response from DevTools
3. Verify the user's role and permissions
4. Check if branch and academic year are properly set
