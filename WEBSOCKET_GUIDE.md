# WebSocket Live Data Updates - Implementation Guide

## Overview

This application uses a **global WebSocket connection** that provides real-time data updates across all pages. The WebSocket connection is established once when the user logs in and is shared across the entire application.

## Architecture

```
App.tsx
├── WebSocketProvider (Global - Single Connection)
│   └── All Pages Have Access
│       ├── StudentsPage → useLiveData(['students'])
│       ├── AttendancePage → useLiveData(['attendance', 'students', 'classes'])
│       ├── PaymentsPage → useLiveData(['payments'])
│       └── ... other pages
```

## Key Components

### 1. WebSocketProvider (Global Context)
- **Location**: `src/contexts/WebSocketContext.tsx`
- **Setup**: Already configured in `App.tsx`
- **Features**:
  - Single global connection (no duplicates)
  - Auto-reconnection on disconnect
  - Authentication handling
  - Subscription management

### 2. useLiveData Hook (Recommended)
- **Location**: `src/hooks/useLiveData.tsx`
- **Purpose**: Subscribe to real-time updates for collections
- **Features**:
  - Automatically invalidates React Query cache
  - Handles all update types (insert, update, delete, batch)
  - Supports filters and custom callbacks

## Usage Examples

### Basic Usage - Single Collection

```tsx
import { useLiveData } from '@/hooks/useLiveData';

function StudentsPage() {
  // This will automatically refresh student data when changes occur
  useLiveData(['students']);

  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiClient.getStudents()
  });

  return <div>{/* Your component */}</div>;
}
```

### Multiple Collections

```tsx
function AttendancePage() {
  // Subscribe to multiple collections at once
  useLiveData(['attendance', 'students', 'classes']);

  const { data: attendance } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => apiClient.getAttendance()
  });

  return <div>{/* Your component */}</div>;
}
```

### With Filters

```tsx
function StudentsPage() {
  const { selectedBranch } = useBranch();
  const { selectedClass } = useState('');

  // Only get updates for filtered data
  useLiveData(['students'], {
    filters: {
      branch_id: selectedBranch,
      class_id: selectedClass
    }
  });

  return <div>{/* Your component */}</div>;
}
```

### With Custom Callbacks

```tsx
function PaymentsPage() {
  useLiveData(['payments'], {
    onUpdate: (collection, payload) => {
      toast({
        title: 'Payment Updated',
        description: `Payment ${payload.id} has been updated`
      });
    },
    onInsert: (collection, payload) => {
      toast({
        title: 'New Payment',
        description: 'A new payment has been received'
      });
    }
  });

  return <div>{/* Your component */}</div>;
}
```

### Page-Specific Hook (Recommended for Complex Pages)

```tsx
import { useLiveDataForPage } from '@/hooks/useLiveData';

function AttendancePage() {
  const { selectedBranch } = useBranch();

  // Automatically handles main collection + related data
  useLiveDataForPage('attendance', {
    relatedCollections: ['students', 'classes', 'subjects'],
    filters: { branch_id: selectedBranch },
    // Also invalidates: attendance-analytics, attendance-summary, attendance-report
  });

  return <div>{/* Your component */}</div>;
}
```

## Migration from Old Hooks

### From useWebSocketQuerySync

```tsx
// ❌ Old Way (Polling-based)
useWebSocketQuerySync(['students', 'classes']);

// ✅ New Way (Event-based)
useLiveData(['students', 'classes']);
```

### From useRealtimeData

```tsx
// ❌ Old Way
useRealtimeData({
  resource: 'students',
  queryKeys: ['students', 'student-stats'],
  filters: { branch_id: '123' }
});

// ✅ New Way
useLiveData(['students'], {
  filters: { branch_id: '123' },
  additionalQueryKeys: ['student-stats']
});
```

## Backend Message Format

The backend sends WebSocket messages in these formats:

### Single Update
```json
{
  "type": "data_update:students",
  "payload": {
    "id": "student-123",
    "action": "update",
    "data": { ... }
  }
}
```

### Batch Update
```json
{
  "type": "data_batch",
  "payload": {
    "collections": {
      "students": [{ ... }],
      "attendance": [{ ... }]
    }
  }
}
```

## Best Practices

### 1. Use One Hook Per Page
```tsx
// ✅ Good: Single hook at page level
function StudentsPage() {
  useLiveData(['students', 'classes']);
  // ... rest of component
}

// ❌ Bad: Multiple hooks for same data
function StudentsPage() {
  useLiveData(['students']);
  useLiveData(['students']); // Duplicate subscription!
}
```

### 2. Place Hook at Top Level
```tsx
// ✅ Good: At component top level
function MyPage() {
  useLiveData(['students']);
  const [state, setState] = useState();
  // ...
}

// ❌ Bad: Inside conditions or loops
function MyPage() {
  if (someCondition) {
    useLiveData(['students']); // Don't do this!
  }
}
```

### 3. Use Filters for Performance
```tsx
// ✅ Good: Filter at WebSocket level
useLiveData(['students'], {
  filters: { class_id: selectedClass }
});

// ❌ Bad: Getting all data and filtering client-side
useLiveData(['students']);
// ... then filter in component
```

### 4. Disable When Not Needed
```tsx
function MyComponent() {
  const [enabled, setEnabled] = useState(false);

  useLiveData(['students'], {
    enabled: enabled // Only subscribe when needed
  });
}
```

## Troubleshooting

### Data Not Updating?

1. Check WebSocket connection status:
```tsx
import { useWebSocket } from '@/contexts/WebSocketContext';

function MyComponent() {
  const { isConnected, connectionStatus } = useWebSocket();

  console.log('Connected:', isConnected);
  console.log('Status:', connectionStatus);
}
```

2. Verify subscription in DevTools:
   - Open browser console
   - Look for `[useLiveData] Subscribing to...` messages

3. Check backend is sending messages:
   - Look for WebSocket messages in Network tab
   - Filter by WS (WebSocket)

### Multiple Connections?

The global WebSocket prevents multiple connections, but check:
- Only one `<WebSocketProvider>` in App.tsx
- No manual WebSocket creation in components

### Data Refreshing Too Often?

Configure React Query staleTime:
```tsx
const { data } = useQuery({
  queryKey: ['students'],
  queryFn: () => apiClient.getStudents(),
  staleTime: 30000, // Only refetch if data is older than 30s
  refetchOnWindowFocus: false // Don't refetch on tab focus
});
```

## Performance Considerations

- **One Connection**: Single WebSocket for entire app
- **Selective Subscriptions**: Only subscribe to needed collections
- **Smart Invalidation**: React Query caching prevents unnecessary API calls
- **Automatic Cleanup**: Subscriptions auto-cleanup on unmount

## Connection States

The WebSocket has these states:
- `disconnected`: Not connected
- `connecting`: Attempting to connect
- `connected`: Connected but not authenticated
- `authenticated`: Fully connected and ready

## Summary

✅ **DO**:
- Use `useLiveData()` for real-time updates
- Place at component top level
- Use filters to reduce data
- Check connection status when debugging

❌ **DON'T**:
- Create manual WebSocket connections
- Use old `useWebSocketQuerySync` (deprecated)
- Subscribe to same collection multiple times
- Place hooks inside conditions

## Example: Complete Page Implementation

```tsx
import { useLiveData } from '@/hooks/useLiveData';
import { useQuery } from '@tanstack/react-query';
import { useBranch } from '@/contexts/BranchContext';

export default function StudentsPage() {
  const { selectedBranch } = useBranch();
  const [selectedClass, setSelectedClass] = useState('');

  // Enable live updates
  useLiveData(['students', 'classes'], {
    filters: {
      branch_id: selectedBranch,
      ...(selectedClass && { class_id: selectedClass })
    }
  });

  // React Query will auto-refresh when WebSocket updates arrive
  const { data: students, isLoading } = useQuery({
    queryKey: ['students', selectedBranch, selectedClass],
    queryFn: () => apiClient.getStudents({
      branch_id: selectedBranch,
      class_id: selectedClass
    }),
    staleTime: 30000 // Cache for 30 seconds
  });

  return (
    <div>
      {isLoading ? 'Loading...' : students.map(s => <div key={s.id}>{s.name}</div>)}
    </div>
  );
}
```

This implementation ensures:
- Single global WebSocket connection
- Real-time updates across all pages
- No duplicate subscriptions
- Optimal performance with React Query caching
