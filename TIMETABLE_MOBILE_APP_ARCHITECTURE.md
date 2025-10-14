# Timetable Mobile App Architecture

## Overview
The timetable system has been designed with a separation between web and mobile access for security and user experience optimization.

## Access Control Architecture

### Web Frontend (Admin Only)
- **Users**: Superadmin, Admin staff
- **Permissions Required**:
  - `timetable.read` - View timetables
  - `timetable.create` - Create timetable entries
  - `timetable.update` - Edit timetable entries
  - `timetable.delete` - Delete timetable entries
  - `timetable.manage` - Full management access

- **Features**:
  - Full timetable management (CRUD operations)
  - Time slot management
  - Room management
  - Conflict detection and resolution
  - Bulk operations
  - Analytics and statistics
  - Export capabilities (PDF, Excel, iCal, etc.)
  - Template management

### Mobile App (Read-Only for Students, Parents, Teachers)
- **Users**: Students, Parents, Teachers
- **Access Mode**: Read-only via mobile app
- **Security**: Separate authentication flow, no web frontend access

## API Endpoints for Mobile App

### Recommended Read-Only Endpoints

#### For Teachers
```
GET /api/timetable/teacher/{teacher_id}
- Returns teacher's personal timetable
- Includes class schedules, room assignments
- Shows upcoming classes

GET /api/timetable/teacher/{teacher_id}/today
- Today's schedule only
- Optimized for mobile viewing

GET /api/timetable/teacher/{teacher_id}/week
- Current week schedule
```

#### For Students
```
GET /api/timetable/class/{class_id}
- Returns class timetable
- Student accesses via their class_id

GET /api/timetable/student/{student_id}
- Personal timetable for student
- Includes class schedule, room locations

GET /api/timetable/student/{student_id}/today
- Today's classes only
```

#### For Parents
```
GET /api/timetable/student/{student_id}
- Parent views their child's timetable
- Requires parent-student relationship validation

GET /api/timetable/student/{student_id}/week
- Weekly view for parents
```

## Backend Validation (Already Implemented)

### Teacher-Class Assignment Validation
Located in: `/backend/app/routers/timetable.py`

The backend validates:
1. **Teacher Assignment**: Checks if teacher is assigned to the class via:
   - Main class teacher (`class.teacher_id`)
   - Subject-specific teacher (`class.subject_teachers[]`)
   - Teacher's assigned classes list (`teacher.classes[]`)

2. **Subject Qualification**: Validates teacher is qualified to teach the subject via:
   - Teacher's subjects list (`teacher.subjects[]`)

### Error Responses
```json
{
  "detail": "Teacher 'John Doe' is not assigned to teach class 'Grade 5A'. Please assign the teacher to this class first."
}

{
  "detail": "Teacher 'Jane Smith' is not qualified to teach subject 'Advanced Mathematics'. Please assign this subject to the teacher first."
}
```

## Frontend Filtering (Already Implemented)

### Location
`/src/components/timetable/TimetableManagement.tsx`

### Implementation
Uses `useMemo` hooks to compute:
- `availableTeachers`: Filters teachers based on current class assignment
- `availableSubjects`: Filters subjects based on selected teacher's qualifications

### User Experience
- Dropdowns show only valid options
- Warning messages display when no valid options available
- Guides users to Teacher Management page for assignments

## Mobile App Integration Requirements

### Authentication
- Separate JWT token flow for mobile users
- Tokens should include role-specific claims
- Limited scope: read-only access to timetable data

### API Security
- Validate user role (student/parent/teacher)
- Enforce read-only operations
- Rate limiting for mobile endpoints
- Cache responses for performance

### Recommended Mobile Features
1. **Offline Support**: Cache timetables locally
2. **Push Notifications**: Class reminders, schedule changes
3. **Calendar Sync**: Export to device calendar
4. **Room Finder**: Interactive campus map
5. **Teacher Contact**: Quick access to teacher information

## Data Synchronization

### Real-Time Updates (Optional)
If implementing WebSocket sync for mobile:
```
Backend: FastAPI WebSocket endpoint
Mobile: Subscribe to timetable changes
Events: schedule_updated, class_cancelled, room_changed
```

### Polling Strategy (Recommended)
```
- Poll every 15 minutes for schedule changes
- Push notification on critical changes
- Full sync once per day (overnight)
```

## Security Considerations

### Web Frontend
- ✅ RBAC enforced with dynamic permission checks
- ✅ Only admin users can modify timetables
- ✅ Audit logging for all changes
- ✅ Branch isolation for multi-branch schools

### Mobile App (To Implement)
- [ ] Separate API endpoints with read-only permissions
- [ ] Role-based data filtering
- [ ] Session management with shorter token expiry
- [ ] Device registration and tracking
- [ ] Encrypted local storage

## Implementation Checklist

### Backend (Partially Complete)
- [x] Teacher-class assignment validation
- [x] Subject-teacher qualification validation
- [x] Error messages with helpful feedback
- [x] Read API endpoints exist
- [ ] Create mobile-specific read-only endpoints
- [ ] Add rate limiting for mobile
- [ ] Implement caching for mobile responses

### Web Frontend (Complete)
- [x] Admin-only access with RBAC
- [x] Filtered dropdowns based on assignments
- [x] User feedback for validation errors
- [x] Full CRUD operations
- [x] Analytics and reporting

### Mobile App (To Be Developed)
- [ ] Authentication flow
- [ ] Timetable viewing screens
- [ ] Offline caching
- [ ] Push notifications
- [ ] Calendar integration
- [ ] User-specific filtering

## API Response Format for Mobile

### Optimized Timetable Response
```json
{
  "date": "2025-10-10",
  "schedule": [
    {
      "period": 1,
      "time": "08:00 - 08:45",
      "subject": "Mathematics",
      "teacher": "Mr. John Doe",
      "room": "101",
      "type": "regular"
    },
    {
      "period": 2,
      "time": "08:45 - 09:30",
      "subject": "Physics",
      "teacher": "Dr. Jane Smith",
      "room": "Lab-A",
      "type": "lab"
    }
  ],
  "conflicts": [],
  "notes": "No changes scheduled"
}
```

## Future Enhancements

1. **Smart Notifications**: ML-based reminder timing
2. **Attendance Integration**: Check-in via mobile
3. **Homework Integration**: Link assignments to timetable
4. **Exam Schedule**: Unified view of classes and exams
5. **Parent-Teacher Meetings**: Book slots via app

## Notes

- This architecture ensures secure separation of administrative functions (web) from user-facing features (mobile)
- The validation implemented prevents data integrity issues at both frontend and backend levels
- Mobile app should be developed using React Native or Flutter for cross-platform compatibility
- Consider implementing GraphQL for mobile API to reduce over-fetching
