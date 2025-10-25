# Parent Password Management Module

A comprehensive parent password management system that allows system administrators to reset parent passwords to a default format with full tracking and notification capabilities.

## Overview

This module provides a complete interface for managing parent passwords in the Spring of Knowledge Hub system. It mirrors the student password management functionality but is specifically adapted for parent users.

## Components

### 1. ParentPasswordManagement.tsx
Main component that provides a tabbed interface for all password management operations.

**Features:**
- Tabbed navigation between Single and Bulk reset operations
- Quick action buttons for common operations
- Information cards showing password format and security notices
- Consistent violet/purple color scheme matching the system design

### 2. SingleParentPasswordReset.tsx
Component for resetting individual parent passwords.

**Features:**
- Parent search functionality by name or phone
- Real-time parent information display
- Relationship badge (Father/Mother/Guardian)
- Contact information display (phone, email)
- Linked students count
- Optional email/SMS notification
- Custom message support
- Password visibility toggle
- Reset confirmation with new password display

**API Endpoint:** `POST /admin/parents/password-reset/single`

### 3. BulkParentPasswordReset.tsx
Component for bulk parent password resets.

**Features:**
- Parent selection with checkboxes
- Search and filter by relationship type
- Select all/deselect all functionality
- Bulk notification options
- Progress tracking and results display
- Success/failure breakdown
- CSV export of results
- Detailed results table

**API Endpoint:** `POST /admin/parents/password-reset/bulk`

## Password Format

The default parent password follows this format:
```
firstname.fathername321
```

**Examples:**
- Ahmed Mohammed → `ahmed.mohammed321`
- Sarah Ali → `sarah.ali321`

## Usage

### Import the main component:
```typescript
import { ParentPasswordManagement } from '@/components/system-admin/parent-password-management';

// In your component
<ParentPasswordManagement />
```

### Import individual components:
```typescript
import {
  SingleParentPasswordReset,
  BulkParentPasswordReset
} from '@/components/system-admin/parent-password-management';

// Single reset with callback
<SingleParentPasswordReset
  onSuccess={(data) => console.log('Reset successful:', data)}
  preSelectedParentId="parent-123"
/>

// Bulk reset
<BulkParentPasswordReset
  onSuccess={(data) => console.log('Bulk reset complete:', data)}
/>
```

## Data Structure

### Parent Interface
```typescript
interface Parent {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
  relationship: 'Father' | 'Mother' | 'Guardian';
  linked_students?: number;
}
```

### Password Reset Response
```typescript
interface PasswordResetResponse {
  success: boolean;
  message: string;
  data?: {
    new_password: string;
    parent_name: string;
    reset_at: string;
  };
}
```

### Bulk Reset Response
```typescript
interface BulkResetResponse {
  success: boolean;
  message: string;
  data?: {
    total_processed: number;
    successful_resets: number;
    failed_resets: number;
    results: Array<{
      parent_id: string;
      parent_name: string;
      success: boolean;
      new_password?: string;
      error?: string;
    }>;
    summary_csv_url?: string;
  };
}
```

## API Integration

### Single Parent Password Reset
**Endpoint:** `POST /admin/parents/password-reset/single`

**Request Body:**
```json
{
  "parent_id": "parent-123",
  "branch_id": "branch-456",
  "reset_reason": "Parent forgot password",
  "notify_parent": true,
  "custom_message": "Your password has been reset for security purposes."
}
```

### Bulk Parent Password Reset
**Endpoint:** `POST /admin/parents/password-reset/bulk`

**Request Body:**
```json
{
  "parent_ids": ["parent-123", "parent-456"],
  "branch_id": "branch-789",
  "reset_reason": "System maintenance password reset",
  "notify_parents": true,
  "custom_message": "All passwords have been reset as part of system maintenance."
}
```

### Preview Default Password
**Endpoint:** `GET /admin/parents/password-reset/preview/{parent_id}`

**Response:**
```json
{
  "parent_id": "parent-123",
  "parent_name": "Ahmed Mohammed",
  "default_password": "ahmed.mohammed321"
}
```

## Features

### Parent Selection
- **Search:** Search by parent name or phone number
- **Filtering:** Filter by relationship type (Father/Mother/Guardian)
- **Display:** Shows parent name, relationship, phone, email, and linked students

### Password Reset
- **Single Reset:** Reset one parent's password at a time
- **Bulk Reset:** Reset multiple parents' passwords simultaneously
- **Notifications:** Optional email/SMS notifications with custom messages
- **Audit Trail:** All resets are logged with reason and timestamp

### Security
- **Reason Required:** All password resets require a documented reason
- **Audit Logging:** All operations are logged and tracked
- **Branch Control:** Operations are scoped to selected branch
- **Authorization:** Requires admin authentication

### User Experience
- **Responsive Design:** Works on all screen sizes
- **Loading States:** Clear loading indicators during operations
- **Error Handling:** Comprehensive error messages
- **Success Feedback:** Clear confirmation with password display
- **Animations:** Smooth fade-in animations for better UX

## Dependencies

### UI Components (shadcn/ui)
- Button
- Card
- Input
- Select
- Badge
- Alert
- Separator
- Checkbox
- Table
- ScrollArea
- Form components

### React Ecosystem
- react-hook-form (form state management)
- zod (validation)
- @tanstack/react-query (data fetching)
- lucide-react (icons)

### Contexts
- BranchContext (branch selection)
- Toast (notifications)

### Utilities
- apiClient (API requests)
- TokenStorage (authentication)

## Styling

The module uses a consistent violet/purple color scheme:
- **Primary:** Violet-700 to Purple-700 gradients
- **Accents:** Blue for single reset, Purple for bulk reset
- **Success:** Green for successful operations
- **Error:** Red for failures
- **Info:** Teal/Cyan for informational elements

## Testing

To test the components:

1. **Single Reset:**
   - Navigate to the component
   - Search for a parent
   - Select a parent
   - Fill in reset reason
   - Submit and verify password display

2. **Bulk Reset:**
   - Navigate to bulk reset tab
   - Filter and select multiple parents
   - Configure notifications
   - Submit and verify results table

## File Structure

```
parent-password-management/
├── ParentPasswordManagement.tsx    # Main tabbed interface
├── SingleParentPasswordReset.tsx   # Single reset component
├── BulkParentPasswordReset.tsx     # Bulk reset component
├── index.ts                        # Exports
└── README.md                       # Documentation
```

## Best Practices

1. **Always select a branch** before attempting password resets
2. **Provide clear reset reasons** for audit trail
3. **Verify parent information** before resetting passwords
4. **Use notifications wisely** - only when necessary
5. **Check results carefully** after bulk operations
6. **Download CSV reports** for record keeping

## Error Handling

The module handles various error scenarios:
- No branch selected
- No parent selected
- API failures
- Network errors
- Validation errors

All errors are displayed with user-friendly toast notifications.

## Performance Considerations

- Uses React Query for efficient data caching
- Implements useMemo for filtered lists to prevent re-renders
- Lazy loads parent data based on search input
- Optimistic UI updates for better perceived performance

## Future Enhancements

Potential improvements:
- Password reset history view
- Password format customization
- Batch import from CSV
- Email/SMS template management
- Advanced filtering options
- Export to multiple formats (Excel, PDF)
- Password strength requirements configuration

## Support

For issues or questions, contact the system administrator or refer to the main project documentation.

## License

This module is part of the Spring of Knowledge Hub system and follows the same license.
