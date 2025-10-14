# Timetable Management - Upgrade Plan

**Current Status**: Existing implementation with direct API calls
**Target**: Modern implementation with TimetableAPI service + permission-based filtering

---

## ✅ What's Already Working

The existing `TimetableManagement.tsx` has:
- ✅ Timetable grid view with weekly schedule
- ✅ Mobile-friendly day cards
- ✅ Class/Teacher/Room view modes
- ✅ Create/Edit/Delete timetable entries
- ✅ Conflict detection and display
- ✅ Export functionality (PDF, Excel, CSV, iCal, JSON)
- ✅ Calendar sync integration
- ✅ Statistics dashboard
- ✅ Responsive design
- ✅ Auto-resolve conflicts feature
- ✅ Beautiful premium UI with animations

---

## 🔄 Required Updates

### 1. Replace Direct API Calls with TimetableAPI Service

**Current (lines 100-210):**
```typescript
const { data, error } = await apiClient.request('/timetable/entries');
```

**Update to:**
```typescript
import { TimetableAPI } from '@/services/timetableApi';

const { data } = useQuery({
  queryKey: ['time-slots'],
  queryFn: () => TimetableAPI.getTimeSlots({ limit: 100 })
});
```

**Files to update:**
- All `useQuery` hooks
- All `useMutation` hooks
- Replace manual `apiClient.request()` with `TimetableAPI.*()` methods

---

### 2. Add Permission-Based UI Filtering

**Current (line 667-676):**
```typescript
if (!['admin', 'superadmin', 'branch_admin', 'hq_admin'].includes(userRole)) {
  return <AlertTriangle />; // Hard-coded role check
}
```

**Update to:**
```typescript
import { usePermissionCheck } from '@/contexts/RoleAccessContext';

const { hasPermission } = usePermissionCheck();
const canCreate = hasPermission('timetable.create');
const canUpdate = hasPermission('timetable.update');
const canDelete = hasPermission('timetable.delete');
const canManage = hasPermission('timetable.manage');

// Then use in UI
{canCreate && <Button>Add Entry</Button>}
{canUpdate && <Button>Edit</Button>}
{canDelete && <Button>Delete</Button>}
```

**Where to apply:**
- Create entry button
- Edit entry button
- Delete entry button
- Time slots tab
- Rooms tab
- Export buttons
- Calendar sync button
- Auto-resolve button

---

### 3. Update Interface Props

**Current (lines 60-64):**
```typescript
interface TimetableManagementProps {
  userRole: string;
  currentUserId: string;
  branchId?: string;
}
```

**Update to:**
```typescript
// Remove props - use contexts instead
export const TimetableManagement: React.FC = () => {
  const { user } = useAuth();
  const { selectedBranch } = useBranch();
  const { hasPermission } = usePermissionCheck();
  // ...
}
```

---

### 4. Fix Type Imports

**Current (lines 45-57):**
```typescript
import type {
  TimeSlot,
  TimetableEntry,
  // ... from '@/types/api'
} from '@/types/api';
```

**Update to:**
```typescript
import type {
  TimeSlot,
  TimetableEntry,
  TimetableConflict,
  ClassTimetableView,
  TeacherTimetableView,
  TimetableStats,
  TimetableExportRequest,
  Room,
  RoomCreate,
  Substitution,
  DayOfWeek
} from '@/types/timetable';

// Keep SchoolClass, Subject, Teacher from @/types/api
import type { SchoolClass, Subject, Teacher } from '@/types/api';
```

---

### 5. Update API Mutations

**Current approach (lines 212-337):**
```typescript
const createEntryMutation = useMutation({
  mutationFn: async (entry) => {
    const response = await apiClient.request('/timetable/entries', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
    return response.data;
  }
});
```

**Update to:**
```typescript
const createEntryMutation = useMutation({
  mutationFn: (entry: TimetableEntryCreate) =>
    TimetableAPI.createEntry(entry),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['timetable-entries'] });
    toast({ title: 'Success', description: 'Entry created' });
    setShowCreateDialog(false);
  },
  onError: (error: any) => {
    if (error.message?.includes('Critical conflicts')) {
      // Show conflict resolution dialog
      setConflictDialogData(error);
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  }
});
```

---

### 6. Add Missing Features

#### A. Time Slot Management (Currently Disabled - Line 841-850)
```typescript
<TabsContent value="time-slots">
  <TimeSlotManagement />
</TabsContent>
```

Create `src/components/timetable/TimeSlotManagement.tsx` with:
- List time slots with pagination
- Create new time slot form
- Edit time slot
- Delete time slot (with usage validation)
- Bulk create time slots

#### B. Room Management (Currently Disabled - Line 852-861)
```typescript
<TabsContent value="rooms">
  <RoomManagement />
</TabsContent>
```

Create `src/components/timetable/RoomManagement.tsx` with:
- Room list with cards
- Create room form
- Room availability checker
- Equipment management

#### C. Substitution Management (Missing)
Create `src/components/timetable/SubstitutionManagement.tsx` with:
- Create substitution request
- List substitutions (pending/approved/rejected)
- Approve/Reject (admin only)
- Teacher view (own substitutions)

---

## 🎯 Step-by-Step Update Process

### Phase 1: Update Imports and Types (15 min)
1. Add `import { TimetableAPI } from '@/services/timetableApi';`
2. Update type imports from `@/types/timetable`
3. Remove unused props, add context hooks

### Phase 2: Replace API Calls (30 min)
4. Update all `useQuery` hooks to use `TimetableAPI.*`
5. Update all `useMutation` hooks to use `TimetableAPI.*`
6. Remove manual `apiClient.request()` calls

### Phase 3: Add Permission Checks (20 min)
7. Add `usePermissionCheck()` hook
8. Define permission constants (`canCreate`, `canUpdate`, etc.)
9. Wrap UI elements with permission checks
10. Update tab visibility based on permissions

### Phase 4: Enhanced Error Handling (15 min)
11. Add conflict error handling in mutations
12. Show conflict resolution dialog
13. Add permission error messages

### Phase 5: Create Missing Components (60 min)
14. Create `TimeSlotManagement.tsx`
15. Create `RoomManagement.tsx`
16. Create `SubstitutionManagement.tsx`
17. Create `ConflictResolutionDialog.tsx`

### Phase 6: Testing (30 min)
18. Test CRUD operations
19. Test permission filtering
20. Test conflict detection
21. Test export/calendar sync
22. Test on mobile

**Total Estimated Time: 2.5-3 hours**

---

## 🔧 Quick Fixes for Immediate Use

### Fix 1: Update Route in App.tsx
```typescript
<Route
  path="/timetable"
  element={
    <ProtectedRoute>
      <RoleBasedRoute permission="timetable.read">
        <DashboardLayout>
          <TimetableManagement />
        </DashboardLayout>
      </RoleBasedRoute>
    </ProtectedRoute>
  }
/>
```

### Fix 2: Add Sidebar Link
```typescript
// In DashboardLayout
{hasPermission('timetable.read') && (
  <NavLink to="/timetable">
    <CalendarClock className="h-4 w-4" />
    Timetable
  </NavLink>
)}
```

---

## 📊 Current vs Target Comparison

| Feature | Current | Target | Status |
|---------|---------|--------|--------|
| API Integration | Direct `apiClient` | `TimetableAPI` service | 🔄 Needs update |
| Permission System | Hard-coded roles | Dynamic RBAC | 🔄 Needs update |
| Type Safety | Partial | Complete | 🔄 Needs update |
| Time Slots UI | Disabled | Full CRUD | ❌ Missing |
| Rooms UI | Disabled | Full CRUD | ❌ Missing |
| Substitutions | Missing | Full workflow | ❌ Missing |
| Conflict Detection | ✅ Working | ✅ Working | ✅ Keep |
| Grid View | ✅ Working | ✅ Working | ✅ Keep |
| Export | ✅ Working | ✅ Working | ✅ Keep |
| Statistics | ✅ Working | ✅ Working | ✅ Keep |
| Responsive Design | ✅ Working | ✅ Working | ✅ Keep |

---

## 💡 Recommendations

1. **Don't rewrite from scratch** - The existing code is solid
2. **Incremental updates** - Update API calls first, then permissions
3. **Keep what works** - Grid view, mobile cards, animations are excellent
4. **Add missing features** - Time slots, rooms, substitutions
5. **Test thoroughly** - Especially permission filtering and conflict handling

---

## 🚀 Priority Order

**High Priority (Must have)**
1. ✅ Update API calls to use TimetableAPI service
2. ✅ Add permission-based UI filtering
3. ✅ Fix type imports

**Medium Priority (Should have)**
4. Create TimeSlotManagement component
5. Create RoomManagement component
6. Create SubstitutionManagement component
7. Add conflict resolution dialog

**Low Priority (Nice to have)**
8. Add drag-and-drop for entries
9. Add print-friendly CSS
10. Add accessibility improvements
11. Add keyboard shortcuts

---

**Next Step**: Start with Phase 1 - Update imports and remove the hard-coded role check, then progressively update API calls.
