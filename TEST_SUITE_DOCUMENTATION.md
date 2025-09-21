# Payment Dashboard Test Suite Documentation

## Overview

This comprehensive test suite addresses critical issues identified in the payment dashboard system, including:

1. **React Select component error**: "A <Select.Item /> must have a value prop that is not an empty string"
2. **401 Unauthorized errors** for payment endpoints
3. **404 error** for /auth/refresh endpoint  
4. **Authentication failures** preventing super admin access
5. **Permission verification** for different user roles

## Test Structure

```
src/test/
├── setup.ts                           # Test configuration
├── mocks/
│   └── authMocks.ts                    # Authentication and API mocks
├── utils/
│   └── testUtils.tsx                   # Test utilities and helpers
├── components/
│   ├── payments/
│   │   └── PaymentDashboard.permissions.test.tsx
│   └── ui/
│       └── SelectComponent.test.tsx
├── api/
│   └── paymentEndpoints.test.ts
├── auth/
│   └── superAdminAccess.test.tsx
└── integration/
    └── paymentDashboardIntegration.test.tsx
```

## Test Categories

### 1. Permission-Based Access Control Tests (`PaymentDashboard.permissions.test.tsx`)

**Purpose**: Verify that different user roles have appropriate access to the payment dashboard.

**Key Test Cases**:
- Super admin access verification
- Branch admin access with proper permissions
- Teacher, student, and parent access restrictions
- Loading states during permission verification
- Debug information display for unauthorized users

**Addresses Issues**:
- Authentication failures preventing super admin access
- Role-based permission verification

### 2. React Select Component Tests (`SelectComponent.test.tsx`)

**Purpose**: Identify and prevent Select component value prop errors.

**Key Test Cases**:
- Validation that SelectItem components have non-empty values
- Select component interaction testing
- State management validation
- Error prevention mechanisms

**Addresses Issues**:
- React Select component error with empty string values
- Component rendering stability

### 3. API Endpoint Authentication Tests (`paymentEndpoints.test.ts`)

**Purpose**: Test payment API endpoints and authentication mechanisms.

**Key Test Cases**:
- Payment analytics endpoint authentication
- Payment dashboard endpoint authentication
- Token refresh functionality
- User permissions endpoint testing
- Network error handling

**Addresses Issues**:
- 401 Unauthorized errors for payment endpoints
- 404 error for /auth/refresh endpoint
- API authentication reliability

### 4. Super Admin Access Tests (`superAdminAccess.test.tsx`)

**Purpose**: Comprehensive verification of super admin access patterns.

**Key Test Cases**:
- Recognition of super admin role variants (`super_admin`, `superadmin`)
- Permission override mechanisms
- Dashboard feature access
- Cross-branch access verification
- Authentication state recovery

**Addresses Issues**:
- Authentication failures preventing super admin access
- Role variant recognition
- Permission priority handling

### 5. Integration Tests (`paymentDashboardIntegration.test.tsx`)

**Purpose**: End-to-end testing of payment dashboard functionality.

**Key Test Cases**:
- Complete dashboard loading flow
- Filter functionality integration
- Pagination integration
- Error handling integration
- Data refresh mechanisms
- Currency formatting and status badges

**Addresses Issues**:
- Overall system integration
- Component interaction reliability
- Error resilience

## Running the Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Targeted Test Commands

```bash
# Run payment-specific tests
npm run test:payments

# Run authentication tests
npm run test:auth

# Run component tests
npm run test:components

# Run integration tests
npm run test:integration
```

### Individual Test Files

```bash
# Permission tests
npx vitest src/test/components/payments/PaymentDashboard.permissions.test.tsx

# Select component tests
npx vitest src/test/components/ui/SelectComponent.test.tsx

# API endpoint tests
npx vitest src/test/api/paymentEndpoints.test.ts

# Super admin tests
npx vitest src/test/auth/superAdminAccess.test.tsx

# Integration tests
npx vitest src/test/integration/paymentDashboardIntegration.test.tsx
```

## Test Configuration

### Vitest Configuration (`vitest.config.ts`)
- Uses jsdom environment for browser API simulation
- Configured path aliases matching the project structure
- Global test utilities and mocks

### Test Setup (`src/test/setup.ts`)
- Automatic cleanup after each test
- Mocks for browser APIs (IntersectionObserver, ResizeObserver, matchMedia)
- LocalStorage and sessionStorage mocks

## Mock Strategy

### Authentication Mocks (`authMocks.ts`)
- **Mock Users**: Pre-defined users for each role type
- **Mock Permissions**: Role-based permission sets
- **Mock API Client**: Configurable API responses for testing
- **Mock Contexts**: AuthContext and BranchContext providers

### Test Utilities (`testUtils.tsx`)
- **Role-specific renderers**: `renderWithSuperAdmin`, `renderWithBranchAdmin`, etc.
- **Mock role access factory**: `createMockRoleAccess`
- **Query client setup**: Optimized for testing with no retries

## Expected Test Outcomes

### Issue Resolution Validation

1. **Select Component Errors**: Tests verify that all SelectItem components have valid, non-empty values
2. **API Authentication**: Tests confirm proper token handling and error responses
3. **Super Admin Access**: Tests validate that super admin users can access the dashboard regardless of permission loading states
4. **Role-Based Access**: Tests ensure appropriate access control for different user roles

### Coverage Areas

- **Component Rendering**: All payment dashboard components render without errors
- **User Interactions**: Filters, pagination, and refresh functionality work correctly
- **Error Handling**: API failures are handled gracefully without crashing
- **Permission Logic**: Role-based access control functions as expected
- **Integration**: End-to-end user workflows complete successfully

## Debugging Test Issues

### Common Issues and Solutions

1. **Mock not working**:
   ```bash
   # Clear all mocks before each test
   beforeEach(() => {
     vi.clearAllMocks()
   })
   ```

2. **Async operations not completing**:
   ```bash
   # Use waitFor with appropriate timeout
   await waitFor(() => {
     expect(screen.getByText('Expected Text')).toBeInTheDocument()
   }, { timeout: 5000 })
   ```

3. **Component not rendering**:
   ```bash
   # Check that all required mocks are in place
   mockUseRoleAccess.mockReturnValue({
     canViewFinances: true,
     isSuperAdmin: true,
     permissionsLoading: false,
   })
   ```

### Test Output Analysis

- **Green Tests**: Issue is resolved or not present
- **Red Tests**: Issue exists and needs attention
- **Warnings**: Potential issues that should be monitored

## Maintenance

### Adding New Tests

1. Follow the established pattern in existing test files
2. Use appropriate mock utilities from `testUtils.tsx`
3. Include both positive and negative test cases
4. Test edge cases and error conditions

### Updating Mocks

1. Keep mock data synchronized with actual API responses
2. Update user permissions when roles change
3. Maintain mock user data consistency

### Performance Considerations

- Tests use optimized QueryClient configuration
- Mocks prevent actual API calls
- Cleanup prevents memory leaks between tests

## Integration with CI/CD

The test suite is designed to run in continuous integration environments:

```bash
# CI-friendly test run
npm run test:run

# With coverage reporting
npm run test:coverage
```

This documentation serves as a comprehensive guide for understanding, running, and maintaining the payment dashboard test suite, ensuring all critical authentication and permission issues are properly addressed.