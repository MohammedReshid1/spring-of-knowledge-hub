# Student Password Management Components

This directory contains a comprehensive set of React components for managing student passwords in the Spring of Knowledge Hub school management system.

## Components Overview

### 1. SingleStudentPasswordReset
**File:** `SingleStudentPasswordReset.tsx`
**Purpose:** Reset an individual student's password to the default format.

**Features:**
- Student search and selection
- Form validation with reset reason
- Email notification options (student/parent)
- Custom message support
- Password preview after reset
- Success/error handling with toasts

**Props:**
- `onSuccess?: (data: PasswordResetResponse) => void` - Callback after successful reset
- `preSelectedStudentId?: string` - Pre-selected student ID

### 2. BulkStudentPasswordReset
**File:** `BulkStudentPasswordReset.tsx`
**Purpose:** Reset passwords for multiple students simultaneously.

**Features:**
- Advanced filtering (grade, class, search)
- Batch student selection
- Detailed reset tracking
- CSV export of results
- Success/failure reporting
- Email notification options

**Props:**
- `onSuccess?: (data: BulkResetResponse) => void` - Callback after bulk operation

### 3. PasswordPreviewModal
**File:** `PasswordPreviewModal.tsx`
**Purpose:** Preview what a student's default password would be without actually resetting it.

**Features:**
- Student search within modal
- Password format display
- Password visibility toggle
- Copy to clipboard functionality
- Download password information
- Reset history display

**Props:**
- `open: boolean` - Modal open state
- `onOpenChange: (open: boolean) => void` - Modal state handler
- `student?: Student` - Pre-selected student
- `studentId?: string` - Alternative to student prop

### 4. PasswordResetHistory
**File:** `PasswordResetHistory.tsx`
**Purpose:** Display comprehensive password reset history and statistics.

**Features:**
- Advanced filtering and search
- Pagination support
- CSV export functionality
- Detailed reset records
- IP address tracking
- Success/failure status

**Props:**
- `studentId?: string` - Filter by specific student
- `showFilters?: boolean` - Show/hide filter options
- `maxHeight?: string` - Maximum height for scroll area

### 5. PasswordFormatInfo
**File:** `PasswordFormatInfo.tsx`
**Purpose:** Display information about the password format and security guidelines.

**Features:**
- Format pattern explanation
- Example password generation
- Security requirements display
- Usage statistics
- Best practices
- Compact and full views

**Props:**
- `compact?: boolean` - Show compact version
- `showStatistics?: boolean` - Include usage statistics
- `showSecurityNotes?: boolean` - Include security information

### 6. StudentPasswordManagement (Main Component)
**File:** `StudentPasswordManagement.tsx`
**Purpose:** Main dashboard component that integrates all password management features.

**Features:**
- Tabbed interface
- Quick action buttons
- Comprehensive integration
- Security notices
- Professional UI design

## API Integration

The components integrate with the following backend endpoints:

- `POST /admin/students/password-reset/single` - Single student password reset
- `POST /admin/students/password-reset/bulk` - Bulk password reset
- `GET /admin/students/password-reset/preview/{student_id}` - Password preview
- `GET /admin/students/password-reset/history/{student_id}` - Reset history
- `GET /admin/students/password-reset/formats` - Format information

## Usage Examples

### Basic Usage - Single Reset
```tsx
import { SingleStudentPasswordReset } from '@/components/system-admin/student-password-management';

function MyComponent() {
  return (
    <SingleStudentPasswordReset
      onSuccess={(data) => console.log('Reset successful:', data)}
    />
  );
}
```

### Usage with Preview Modal
```tsx
import { useState } from 'react';
import { PasswordPreviewModal, Button } from '@/components/system-admin/student-password-management';

function MyComponent() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setModalOpen(true)}>
        Preview Password
      </Button>
      <PasswordPreviewModal
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
```

### Complete Management Dashboard
```tsx
import { StudentPasswordManagement } from '@/components/system-admin/student-password-management';

function SystemAdminDashboard() {
  return <StudentPasswordManagement />;
}
```

## Technical Details

### Dependencies
- React 18 with hooks
- TypeScript for type safety
- Tailwind CSS for styling
- shadcn/ui components
- React Hook Form with Zod validation
- TanStack Query for data fetching
- Lucide React for icons

### Password Format
Default format: `firstname.grandfathername321`

Example: For student "Ahmed Mohammed Abdullah", the default password would be: `ahmed.abdullah321`

### Security Features
- All operations are logged and tracked
- IP address recording
- Role-based access control integration
- Secure password handling
- Audit trail maintenance

### Error Handling
- Comprehensive error states
- User-friendly error messages
- Toast notifications for feedback
- Graceful degradation
- Retry mechanisms

## Styling and Design

The components use:
- Modern gradient backgrounds
- Consistent color schemes (blues, grays)
- Smooth animations and transitions
- Responsive design patterns
- Professional typography
- Accessibility-focused design

## File Structure
```
src/components/system-admin/student-password-management/
├── SingleStudentPasswordReset.tsx
├── BulkStudentPasswordReset.tsx
├── PasswordPreviewModal.tsx
├── PasswordResetHistory.tsx
├── PasswordFormatInfo.tsx
├── StudentPasswordManagement.tsx
├── index.ts
└── README.md
```

## Integration Notes

1. **Branch Context**: All components use the BranchContext for branch filtering
2. **API Client**: Uses the centralized API client from `@/lib/api`
3. **Toast Notifications**: Integrates with the toast system for user feedback
4. **Authentication**: Assumes user is authenticated and has appropriate permissions
5. **Type Safety**: Full TypeScript integration with proper type definitions

## Best Practices

1. Always provide error boundaries around these components
2. Use proper role-based access control before rendering
3. Handle loading states appropriately
4. Implement proper cleanup in useEffect hooks
5. Test with different user roles and permissions
6. Validate API responses before using data

## Troubleshooting

Common issues and solutions:

1. **API Errors**: Check network connectivity and authentication status
2. **Type Errors**: Ensure all required props are provided with correct types
3. **Styling Issues**: Verify Tailwind CSS classes are applied correctly
4. **State Issues**: Check React state management and prop drilling
5. **Permission Errors**: Verify user has required permissions for operations