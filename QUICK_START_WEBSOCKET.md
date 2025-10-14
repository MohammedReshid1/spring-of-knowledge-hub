# WebSocket Quick Start - 5 Minute Guide

## ⚡ TL;DR - Add Live Updates to Your Page

**Just add this one line at the top of your component:**

```tsx
import { useLiveData } from '@/hooks/useLiveData';

export default function YourPage() {
  useLiveData(['your-collection-name']);

  // Your existing code stays exactly the same!
  const { data } = useQuery({ ... });

  return <div>...</div>;
}
```

**That's it! Your page now has real-time updates! 🎉**

---

## 🎯 Examples by Page Type

### Simple Page (Single Collection)

```tsx
// StudentsPage.tsx
import { useLiveData } from '@/hooks/useLiveData';

export default function StudentsPage() {
  useLiveData(['students']);

  // Everything else stays the same
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiClient.getStudents()
  });

  return <div>{/* Your UI */}</div>;
}
```

### Page with Filters

```tsx
// StudentsPage.tsx
import { useLiveData } from '@/hooks/useLiveData';
import { useBranch } from '@/contexts/BranchContext';

export default function StudentsPage() {
  const { selectedBranch } = useBranch();
  const [selectedClass, setSelectedClass] = useState('');

  useLiveData(['students'], {
    filters: {
      branch_id: selectedBranch,
      ...(selectedClass && { class_id: selectedClass })
    }
  });

  const { data: students } = useQuery({ ... });

  return <div>{/* Your UI */}</div>;
}
```

### Complex Page (Multiple Collections)

```tsx
// AttendancePage.tsx - Already Updated!
import { useLiveDataForPage } from '@/hooks/useLiveData';

export default function AttendancePage() {
  const { selectedBranch } = useBranch();

  useLiveDataForPage('attendance', {
    relatedCollections: ['students', 'classes', 'subjects'],
    filters: { branch_id: selectedBranch }
  });

  // Your code...
}
```

---

## 📋 Copy-Paste Templates

### For Most Pages:
```tsx
import { useLiveData } from '@/hooks/useLiveData';

export default function MyPage() {
  useLiveData(['my-collection']);
  // Rest of your code...
}
```

### For Pages with Branch Filter:
```tsx
import { useLiveData } from '@/hooks/useLiveData';
import { useBranch } from '@/contexts/BranchContext';

export default function MyPage() {
  const { selectedBranch } = useBranch();

  useLiveData(['my-collection'], {
    filters: selectedBranch && selectedBranch !== 'all'
      ? { branch_id: selectedBranch }
      : {}
  });

  // Rest of your code...
}
```

### For Complex Pages:
```tsx
import { useLiveDataForPage } from '@/hooks/useLiveData';
import { useBranch } from '@/contexts/BranchContext';

export default function MyPage() {
  const { selectedBranch } = useBranch();

  useLiveDataForPage('main-collection', {
    relatedCollections: ['related1', 'related2', 'related3'],
    filters: { branch_id: selectedBranch }
  });

  // Rest of your code...
}
```

---

## 🗺️ Which Collections Should Each Page Use?

| Your Page | Collections to Watch |
|-----------|---------------------|
| StudentsPage | `['students', 'classes']` |
| TeachersPage | `['teachers', 'classes', 'subjects']` |
| ClassesPage | `['classes', 'teachers', 'students']` |
| PaymentsPage | `['payments', 'students']` |
| AttendancePage | `['attendance', 'students', 'classes', 'subjects']` |
| ExamsPage | `['exams', 'classes', 'subjects', 'students']` |
| GradesPage | `['grades', 'students', 'exams']` |
| TimetablePage | `['timetable', 'classes', 'teachers', 'subjects']` |
| InventoryPage | `['inventory']` |
| DisciplinePage | `['discipline', 'students']` |

---

## ✅ Checklist for Adding to a Page

1. [ ] Import the hook
2. [ ] Add one line at the top of component
3. [ ] (Optional) Add filters if needed
4. [ ] Test by opening page and making a change in another tab
5. [ ] Done!

---

## 🔍 Verification

### How to test it works:

1. **Open your page** in the browser
2. **Open the same page in a new tab**
3. **Make a change** (add/edit/delete data)
4. **Watch the first tab** - it should update automatically!

### Check in DevTools:

```
Console should show:
[useLiveData] Subscribing to students
WebSocket: Authentication successful
```

---

## 🚨 Common Mistakes

### ❌ Don't Do This:
```tsx
// Wrong - hook inside condition
if (someCondition) {
  useLiveData(['students']); // NO!
}

// Wrong - hook inside loop
items.map(() => {
  useLiveData(['students']); // NO!
});

// Wrong - multiple subscriptions to same thing
useLiveData(['students']);
useLiveData(['students']); // Duplicate!
```

### ✅ Do This Instead:
```tsx
// Correct - hook at top level
useLiveData(['students']);

// Use enabled option for conditional logic
useLiveData(['students'], {
  enabled: someCondition
});

// Or use filters
useLiveData(['students'], {
  filters: { class_id: selectedClass }
});
```

---

## 📞 Need Help?

- **Full Guide**: See `WEBSOCKET_GUIDE.md`
- **Example**: Check `src/pages/AttendancePage.tsx` (already updated)
- **Hook Code**: Look at `src/hooks/useLiveData.tsx`

---

## 🎉 You're Done!

Just add `useLiveData(['your-collection'])` to your page and enjoy real-time updates!

**No configuration, no complex setup, just one hook!**
