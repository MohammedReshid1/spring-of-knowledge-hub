# Timetable Backend API - Deployment Requirements

**Status**: ❌ **Backend API endpoints are NOT deployed**
**Impact**: Timetable features are not functional - 404 errors on all API calls
**Server**: https://school.dablietech.club

---

## ⚠️ Critical Issue

The frontend Timetable Management system is **fully implemented** with all UI components, permission controls, and API integration ready. However, the backend API endpoints are **missing/not deployed** on the production server.

### Current Errors
```
GET https://school.dablietech.club/api/timetable/time-slots → 404 Not Found
GET https://school.dablietech.club/api/timetable/rooms → 404 Not Found
GET https://school.dablietech.club/api/timetable/conflicts → 404 Not Found
GET https://school.dablietech.club/api/timetable/stats → 404 Not Found
GET https://school.dablietech.club/api/timetable/entries → 404 Not Found
```

---

## 📋 Required Backend Endpoints

All endpoints must be deployed at `/api/timetable/*`:

### 1. Time Slots Management
```
GET    /api/timetable/time-slots              # List time slots (with pagination)
POST   /api/timetable/time-slots              # Create time slot
PATCH  /api/timetable/time-slots/{id}         # Update time slot
DELETE /api/timetable/time-slots/{id}         # Delete time slot
```

**Request/Response Examples**:
```typescript
// POST /api/timetable/time-slots
{
  "period_number": 1,
  "start_time": "08:00:00",
  "end_time": "08:45:00",
  "period_type": "regular",
  "is_break": false
}

// Response
{
  "id": "slot_123",
  "period_number": 1,
  "start_time": "08:00:00",
  "end_time": "08:45:00",
  "period_type": "regular",
  "is_break": false,
  "branch_id": "branch_456",
  "academic_year": "2024-2025",
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

### 2. Timetable Entries
```
GET    /api/timetable/entries                 # List entries (with filters)
POST   /api/timetable/entries                 # Create entry
POST   /api/timetable/entries/bulk            # Bulk create entries
PATCH  /api/timetable/entries/{id}            # Update entry
DELETE /api/timetable/entries/{id}            # Delete entry
```

**Filters supported**:
- `class_id` - Filter by class
- `teacher_id` - Filter by teacher
- `day_of_week` - Filter by day (monday, tuesday, etc.)
- `academic_year` - Filter by academic year
- `skip` - Pagination offset (default: 0)
- `limit` - Pagination limit (default: 100, max: 500)

### 3. Timetable Views
```
GET    /api/timetable/class/{class_id}        # Get class timetable view
GET    /api/timetable/teacher/{teacher_id}    # Get teacher timetable view
```

### 4. Conflict Management
```
GET    /api/timetable/conflicts               # List conflicts
PATCH  /api/timetable/conflicts/{id}/resolve  # Resolve conflict
```

**Query Parameters**:
- `severity` - Filter by severity (critical, high, medium, low)
- `resolved` - Filter by resolution status (true/false)

### 5. Room Management
```
GET    /api/timetable/rooms                   # List rooms
POST   /api/timetable/rooms                   # Create room
```

**Query Parameters**:
- `room_type` - Filter by type (classroom, laboratory, auditorium, gym, library)
- `is_available` - Filter by availability (true/false)
- `skip`, `limit` - Pagination

### 6. Substitution Management
```
GET    /api/timetable/substitutions           # List substitutions
POST   /api/timetable/substitutions           # Create substitution request
PATCH  /api/timetable/substitutions/{id}/approve  # Approve substitution
```

**Query Parameters**:
- `status` - Filter by status (pending, approved, rejected, completed)
- `skip`, `limit` - Pagination

### 7. Statistics & Analytics
```
GET    /api/timetable/stats                   # Get timetable statistics
```

**Response Example**:
```json
{
  "total_periods_scheduled": 450,
  "total_free_periods": 50,
  "utilization_rate": 85.5,
  "teacher_workload_stats": {
    "teacher_123": {
      "total_periods": 25,
      "classes": ["Class A", "Class B"],
      "utilization": 90.0
    }
  },
  "room_utilization_stats": {
    "Room 101": {
      "total_periods_used": 30,
      "utilization": 75.0
    }
  },
  "conflict_count": 5,
  "most_busy_day": "monday",
  "most_busy_period": 3,
  "subject_distribution": {
    "Mathematics": 45,
    "English": 40,
    "Science": 35
  }
}
```

### 8. Calendar Sync
```
POST   /api/timetable/sync-to-calendar        # Sync timetable to academic calendar
```

**Request Parameters**:
- `academic_year` - Academic year to sync
- `class_id` (optional) - Specific class to sync

### 9. Export
```
POST   /api/timetable/export                  # Export timetable in various formats
```

**Request Body**:
```json
{
  "format": "pdf",  // pdf, excel, csv, ical, json
  "view_type": "class",  // class, teacher, room, master
  "target_id": "class_123",
  "include_breaks": true,
  "include_notes": true,
  "date_range_start": "2025-01-01",
  "date_range_end": "2025-06-30",
  "custom_fields": []
}
```

**Response**:
```json
{
  "download_url": "https://school.dablietech.club/exports/timetable_class_123.pdf",
  "filename": "timetable_class_123.pdf",
  "format": "pdf",
  "generated_at": "2025-01-15T10:30:00Z"
}
```

---

## 🔐 Permission System

All endpoints require JWT authentication and the following permissions:

| Permission | Description | Required By |
|-----------|-------------|-------------|
| `timetable.read` | View timetables | Students, Teachers, Admins |
| `timetable.create` | Create timetable entries | Teachers (limited), Admins |
| `timetable.update` | Update entries and resolve conflicts | Teachers (limited), Admins |
| `timetable.delete` | Delete entries | Admins only |
| `timetable.manage` | Full access to time slots, rooms | Admins only |

---

## 🗄️ Database Models Required

### TimeSlot
```python
{
  "id": ObjectId,
  "branch_id": ObjectId,
  "period_number": int (1-10),
  "start_time": time,
  "end_time": time,
  "period_type": enum[regular, break, lunch, assembly, sports, activity, lab, other],
  "is_break": bool,
  "break_duration_minutes": int (5-60, required if is_break=true),
  "academic_year": str,
  "created_at": datetime,
  "updated_at": datetime
}
```

### TimetableEntry
```python
{
  "id": ObjectId,
  "branch_id": ObjectId,
  "class_id": ObjectId,
  "subject_id": ObjectId (optional),
  "teacher_id": ObjectId (optional),
  "room_number": str (optional),
  "day_of_week": enum[monday, tuesday, wednesday, thursday, friday, saturday, sunday],
  "time_slot_id": ObjectId,
  "academic_year": str,
  "term": str (optional),
  "is_recurring": bool,
  "specific_date": date (required if is_recurring=false),
  "notes": str (optional),
  "resources_needed": array[str],
  "is_substitution": bool,
  "original_teacher_id": ObjectId (optional),
  "created_by": ObjectId,
  "last_modified_by": ObjectId,
  "created_at": datetime,
  "updated_at": datetime
}
```

### Room
```python
{
  "id": ObjectId,
  "branch_id": ObjectId,
  "room_number": str,
  "room_name": str (optional),
  "room_type": enum[classroom, laboratory, auditorium, gym, library],
  "capacity": int (>= 1),
  "equipment": array[str],
  "is_available": bool,
  "floor": str (optional),
  "building": str (optional),
  "notes": str (optional),
  "created_at": datetime,
  "updated_at": datetime
}
```

### TimetableConflict
```python
{
  "id": ObjectId,
  "conflict_type": enum[teacher_overlap, room_overlap, class_overlap, resource_overlap, time_constraint],
  "severity": enum[critical, high, medium, low],
  "description": str,
  "affected_entries": array[ObjectId],
  "suggested_resolution": str,
  "detected_at": datetime,
  "resolved": bool,
  "resolved_at": datetime (optional),
  "resolved_by": ObjectId (optional),
  "metadata": object
}
```

### Substitution
```python
{
  "id": ObjectId,
  "original_entry_id": ObjectId,
  "substitute_teacher_id": ObjectId,
  "substitution_date": date,
  "start_time": time,
  "end_time": time,
  "reason": str,
  "notes": str (optional),
  "status": enum[pending, approved, rejected, completed],
  "notification_sent": bool,
  "approved_by": ObjectId (optional),
  "approved_at": datetime (optional),
  "created_by": ObjectId,
  "created_at": datetime
}
```

---

## 🚀 Deployment Steps

### 1. Backend Implementation (FastAPI)
```bash
# Assumed backend structure
/backend
  /app
    /api
      /timetable
        __init__.py          # Router registration
        time_slots.py        # Time slot endpoints
        entries.py           # Timetable entry endpoints
        views.py             # Class/Teacher timetable views
        conflicts.py         # Conflict management
        rooms.py             # Room management
        substitutions.py     # Substitution workflow
        stats.py             # Statistics endpoints
        exports.py           # Export functionality
        calendar_sync.py     # Calendar integration
    /models
      timetable.py          # Pydantic models & MongoDB schemas
    /services
      timetable_service.py  # Business logic
      conflict_detector.py  # Conflict detection algorithm
```

### 2. Dependencies Required
```python
# requirements.txt or pyproject.toml
motor  # Async MongoDB driver
pydantic
fastapi
python-jose[cryptography]  # JWT
passlib[bcrypt]
reportlab  # PDF generation
openpyxl  # Excel generation
icalendar  # iCal generation
```

### 3. Deploy to Production
```bash
# On production server
cd /path/to/backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Or with systemd service
systemctl restart fastapi
```

### 4. Nginx Configuration
```nginx
location /api/timetable {
    proxy_pass http://127.0.0.1:8000/api/timetable;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### 5. Test Endpoints
```bash
# Get time slots
curl -X GET "https://school.dablietech.club/api/timetable/time-slots?limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Create time slot
curl -X POST "https://school.dablietech.club/api/timetable/time-slots" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "period_number": 1,
    "start_time": "08:00:00",
    "end_time": "08:45:00",
    "period_type": "regular",
    "is_break": false
  }'
```

---

## ✅ Frontend is Ready

The frontend has been fully implemented with:

- ✅ **TimetableAPI service** - Complete TypeScript client
- ✅ **Type definitions** - All interfaces and enums
- ✅ **UI Components** - Responsive timetable grid, mobile cards, forms
- ✅ **Permission-based access** - RBAC integrated
- ✅ **Error handling** - Graceful degradation for missing backend
- ✅ **Navigation menu** - Enabled with proper permissions
- ✅ **Export functionality** - PDF, Excel, CSV, iCal, JSON
- ✅ **Calendar sync** - Integration ready
- ✅ **Conflict detection UI** - Display and resolution
- ✅ **Statistics dashboard** - Charts and metrics
- ✅ **Time slot management** - CRUD operations
- ✅ **Room management** - CRUD operations
- ✅ **Mobile responsiveness** - Works on all devices

---

## 📊 Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend UI | ✅ Complete | Fully implemented and tested |
| TypeScript Types | ✅ Complete | All interfaces defined |
| API Client Service | ✅ Complete | 24 endpoints mapped |
| Permission System | ✅ Complete | RBAC integrated |
| Backend API | ❌ Missing | **Needs deployment** |
| Database Models | ❌ Missing | **Needs implementation** |
| Backend Logic | ❌ Missing | **Needs implementation** |

---

## 🔗 References

- **Frontend Integration Guide**: `TIMETABLE_FRONTEND_INTEGRATION_GUIDE.md` (2,391 lines)
- **API Client**: `src/services/timetableApi.ts`
- **Type Definitions**: `src/types/timetable.ts`
- **UI Component**: `src/components/timetable/TimetableManagement.tsx`
- **Implementation Status**: `TIMETABLE_IMPLEMENTATION_STATUS.md`
- **Upgrade Plan**: `TIMETABLE_UPGRADE_PLAN.md`

---

## 🎯 Next Steps

1. **Immediate**: Deploy backend API endpoints to production server
2. **Priority 1**: Implement Time Slots, Rooms, Timetable Entries CRUD
3. **Priority 2**: Implement conflict detection algorithm
4. **Priority 3**: Add statistics, export, and calendar sync features
5. **Testing**: Verify all 24 endpoints with real data
6. **Production**: Enable timetable features for users

---

**Last Updated**: 2025-01-15
**Status**: ⏳ **Waiting for backend deployment**
