# Integration Guide: Parent Password Management

This guide shows how to integrate the Parent Password Management module into your application.

## Quick Start

### 1. Basic Integration

Add the component to your system admin page:

```typescript
import { ParentPasswordManagement } from '@/components/system-admin/parent-password-management';

function SystemAdminPage() {
  return (
    <div className="container mx-auto p-6">
      <ParentPasswordManagement />
    </div>
  );
}
```

### 2. Route Setup

Add a route for the parent password management page:

```typescript
// In your routing configuration
import { ParentPasswordManagement } from '@/components/system-admin/parent-password-management';

const routes = [
  {
    path: '/system-admin/parent-password-management',
    element: <ParentPasswordManagement />,
    // Add appropriate role guards
    roles: ['superadmin', 'system_admin']
  }
];
```

### 3. Navigation Menu

Add a menu item to access the parent password management:

```typescript
<NavigationMenu>
  <NavigationMenuItem>
    <Link to="/system-admin/parent-password-management">
      <Key className="h-4 w-4 mr-2" />
      Parent Password Management
    </Link>
  </NavigationMenuItem>
</NavigationMenu>
```

## Advanced Integration

### Using Individual Components

If you need more control, you can use the individual components:

```typescript
import {
  SingleParentPasswordReset,
  BulkParentPasswordReset
} from '@/components/system-admin/parent-password-management';

function CustomParentManagement() {
  const handleResetSuccess = (data) => {
    console.log('Password reset successful:', data);
    // Custom logic here (e.g., send notification, update UI)
  };

  return (
    <div className="space-y-6">
      <h1>Custom Parent Password Management</h1>

      {/* Single Reset Section */}
      <section>
        <h2>Single Parent Reset</h2>
        <SingleParentPasswordReset
          onSuccess={handleResetSuccess}
          preSelectedParentId="optional-parent-id"
        />
      </section>

      {/* Bulk Reset Section */}
      <section>
        <h2>Bulk Parent Reset</h2>
        <BulkParentPasswordReset
          onSuccess={handleResetSuccess}
        />
      </section>
    </div>
  );
}
```

### Integration with Parent Management Page

Add a quick action button in your parent management page:

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SingleParentPasswordReset } from '@/components/system-admin/parent-password-management';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function ParentManagementPage() {
  const [selectedParent, setSelectedParent] = useState(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const handleResetPassword = (parent) => {
    setSelectedParent(parent);
    setResetDialogOpen(true);
  };

  return (
    <div>
      {/* Parent List */}
      <Table>
        <TableBody>
          {parents.map(parent => (
            <TableRow key={parent.id}>
              <TableCell>{parent.full_name}</TableCell>
              <TableCell>{parent.phone}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  onClick={() => handleResetPassword(parent)}
                >
                  Reset Password
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <SingleParentPasswordReset
            preSelectedParentId={selectedParent?.id}
            onSuccess={(data) => {
              console.log('Success:', data);
              setResetDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

## Backend API Requirements

Ensure your backend has these endpoints implemented:

### 1. Single Parent Password Reset

```python
@router.post("/admin/parents/password-reset/single")
async def reset_single_parent_password(
    request: SinglePasswordResetRequest,
    current_user: User = Depends(get_current_admin_user)
):
    """
    Reset a single parent's password to default format.

    Request body:
    - parent_id: str
    - branch_id: str
    - reset_reason: str
    - notify_parent: bool
    - custom_message: Optional[str]
    """
    pass
```

### 2. Bulk Parent Password Reset

```python
@router.post("/admin/parents/password-reset/bulk")
async def reset_bulk_parent_passwords(
    request: BulkPasswordResetRequest,
    current_user: User = Depends(get_current_admin_user)
):
    """
    Reset multiple parents' passwords to default format.

    Request body:
    - parent_ids: List[str]
    - branch_id: str
    - reset_reason: str
    - notify_parents: bool
    - custom_message: Optional[str]
    """
    pass
```

### 3. Preview Default Password (Optional)

```python
@router.get("/admin/parents/password-reset/preview/{parent_id}")
async def preview_default_password(
    parent_id: str,
    current_user: User = Depends(get_current_admin_user)
):
    """
    Preview what the default password would be for a parent.
    """
    pass
```

## Permission Requirements

Add appropriate permissions to your RBAC system:

```typescript
const permissions = {
  'parent_password_management': {
    'view': ['superadmin', 'system_admin'],
    'reset_single': ['superadmin', 'system_admin'],
    'reset_bulk': ['superadmin'],
  }
};
```

### Protecting Routes

```typescript
import { PermissionWrapper } from '@/components/rbac/PermissionWrapper';

<PermissionWrapper
  requiredPermission="parent_password_management.view"
  fallback={<AccessDenied />}
>
  <ParentPasswordManagement />
</PermissionWrapper>
```

## Notification Setup

To enable email/SMS notifications, ensure you have:

1. **Email Service Configured:**
   ```python
   # backend/app/core/config.py
   EMAIL_HOST = "smtp.gmail.com"
   EMAIL_PORT = 587
   EMAIL_USE_TLS = True
   EMAIL_HOST_USER = "your-email@example.com"
   EMAIL_HOST_PASSWORD = "your-password"
   ```

2. **SMS Service Configured:**
   ```python
   # For SMS notifications (if using Twilio)
   TWILIO_ACCOUNT_SID = "your-account-sid"
   TWILIO_AUTH_TOKEN = "your-auth-token"
   TWILIO_PHONE_NUMBER = "+1234567890"
   ```

3. **Email Template:**
   ```html
   <!-- templates/password_reset_notification.html -->
   <html>
     <body>
       <h1>Password Reset Notification</h1>
       <p>Dear {{ parent_name }},</p>
       <p>Your password has been reset. Your new password is:</p>
       <p><strong>{{ new_password }}</strong></p>
       <p>Please change this password after logging in.</p>
       {% if custom_message %}
         <p>{{ custom_message }}</p>
       {% endif %}
     </body>
   </html>
   ```

## Testing the Integration

### 1. Manual Testing Checklist

- [ ] Can navigate to parent password management page
- [ ] Can search for parents
- [ ] Can select a parent
- [ ] Can reset single parent password
- [ ] Password format is correct (firstname.fathername321)
- [ ] Can reset multiple parent passwords
- [ ] Notifications are sent when enabled
- [ ] Results are displayed correctly
- [ ] CSV export works for bulk resets
- [ ] Error handling works correctly

### 2. Unit Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SingleParentPasswordReset } from './SingleParentPasswordReset';

describe('SingleParentPasswordReset', () => {
  it('renders search input', () => {
    render(<SingleParentPasswordReset />);
    expect(screen.getByPlaceholderText(/search parent/i)).toBeInTheDocument();
  });

  it('displays parent information when selected', async () => {
    // Test implementation
  });

  it('validates reset reason is required', async () => {
    // Test implementation
  });
});
```

### 3. Integration Tests

```typescript
describe('Parent Password Management Integration', () => {
  it('completes full password reset flow', async () => {
    // 1. Search for parent
    // 2. Select parent
    // 3. Fill reset reason
    // 4. Submit form
    // 5. Verify success message
    // 6. Verify new password is displayed
  });
});
```

## Troubleshooting

### Common Issues

1. **"Please select a branch" error:**
   - Ensure BranchContext is properly set up
   - Check that selectedBranch is not null or 'all'

2. **Parent search not working:**
   - Verify API endpoint returns correct data format
   - Check that search length is > 2 characters

3. **Password reset fails:**
   - Check API authentication token is valid
   - Verify parent_id format matches backend expectations
   - Check backend logs for detailed error

4. **Notifications not sending:**
   - Verify email/SMS service configuration
   - Check parent has valid email/phone number
   - Review notification service logs

### Debug Mode

Enable debug logging:

```typescript
<SingleParentPasswordReset
  onSuccess={(data) => {
    console.log('Success:', data);
  }}
  onError={(error) => {
    console.error('Error:', error);
  }}
/>
```

## Performance Optimization

### 1. Lazy Loading

```typescript
const ParentPasswordManagement = lazy(() =>
  import('@/components/system-admin/parent-password-management')
);

<Suspense fallback={<LoadingSpinner />}>
  <ParentPasswordManagement />
</Suspense>
```

### 2. Query Caching

The component already uses React Query for caching. Configure cache time:

```typescript
const { data } = useQuery({
  queryKey: ['parents'],
  queryFn: fetchParents,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

## Security Considerations

1. **Rate Limiting:** Implement rate limiting on password reset endpoints
2. **Audit Logging:** Log all password reset operations
3. **Permission Checks:** Always verify user has appropriate permissions
4. **Token Expiry:** Ensure authentication tokens expire appropriately
5. **Secure Transport:** Always use HTTPS in production

## Next Steps

After integration:

1. Test all functionality in staging environment
2. Train system administrators on usage
3. Set up monitoring for password reset operations
4. Create user documentation
5. Configure backup and recovery procedures
6. Schedule regular security audits

## Support

For additional help:
- Check the main README.md in the module directory
- Review the TypeScript types in index.ts
- Contact the development team
- Submit issues to the project repository
