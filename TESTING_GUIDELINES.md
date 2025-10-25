# Payment System Testing Guidelines

This document provides comprehensive testing guidelines for the extended payment system with conditional payment method fields.

## Overview

The payment system has been extended to support conditional fields for different payment methods while maintaining backward compatibility. This testing suite covers:

- **Backend validation logic** (Unit tests)
- **API integration** (Integration tests)
- **Frontend components** (Component tests)
- **End-to-end user flows** (E2E tests)
- **Performance under load** (Load tests)

## Test Architecture

```
tests/
├── backend/
│   ├── test_payment_validation.py      # Payment validation unit tests
│   ├── test_payments_integration.py    # API integration tests
│   └── conftest.py                     # Test configuration and fixtures
├── frontend/
│   └── components/
│       └── payments/
│           └── __tests__/              # React component tests
├── e2e/
│   └── payment-flow.spec.ts           # Playwright E2E tests
├── performance/
│   └── load-test-plan.py              # Performance and load testing
└── fixtures/
    ├── test-screenshot.jpg            # Test file for uploads
    └── test-document.txt              # Invalid file type test
```

## Running Tests

### Backend Tests

```bash
# Navigate to backend directory
cd backend

# Run all backend tests
pytest tests/ -v

# Run specific test file
pytest tests/test_payment_validation.py -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run performance tests
python tests/performance/load-test-plan.py
```

### Frontend Tests

```bash
# From project root
npm test

# Run component tests for payment components
npm test -- --testPathPattern=payments

# Run tests with coverage
npm test -- --coverage

# Run E2E tests
npx playwright test

# Run specific E2E test
npx playwright test tests/e2e/payment-flow.spec.ts
```

## Test Coverage Requirements

### Backend Coverage Targets
- **Payment validation logic**: 100%
- **API endpoints**: 95%
- **Error handling**: 90%
- **File upload functionality**: 90%

### Frontend Coverage Targets
- **Payment components**: 90%
- **Form validation**: 95%
- **User interactions**: 85%
- **Error states**: 80%

## Test Scenarios

### 1. Payment Validation Tests

**Location**: `backend/tests/test_payment_validation.py`

**Coverage**:
- Bank transfer validation (required fields, length validation)
- Mobile/online payment validation (transaction ID validation)
- Legacy payment method compatibility (cash, check)
- Edge cases (long values, special characters, boundary conditions)
- Error message clarity and helpfulness

**Key Test Cases**:
```python
def test_valid_bank_transfer(self):
    # Test complete valid bank transfer details

def test_missing_bank_name(self):
    # Test validation failure when bank name is missing

def test_short_transaction_number(self):
    # Test validation failure with too short transaction number
```

### 2. API Integration Tests

**Location**: `backend/tests/test_payments_integration.py`

**Coverage**:
- Payment creation for all payment methods
- File upload functionality
- Authentication and authorization
- Error handling (validation errors, network errors)
- Payment retrieval with method-specific details

**Key Test Cases**:
```python
def test_create_bank_transfer_payment_success(self):
    # Test successful bank transfer payment creation

def test_file_upload_success(self):
    # Test successful file upload for payment screenshots

def test_unauthorized_access(self):
    # Test that unauthorized requests are rejected
```

### 3. Frontend Component Tests

**Location**: `src/components/payments/__tests__/`

**Coverage**:
- Component rendering and props handling
- Form validation and user interactions
- File upload functionality with progress tracking
- Conditional rendering based on payment method
- Error display and user feedback
- Accessibility compliance

**Key Test Cases**:
```typescript
test('shows bank transfer details when bank transfer is selected', async () => {
  // Test conditional rendering of method-specific fields
});

test('calls onChange when bank name is changed', async () => {
  // Test form field interactions
});

test('validates file type before upload', async () => {
  // Test file upload validation
});
```

### 4. End-to-End Tests

**Location**: `tests/e2e/payment-flow.spec.ts`

**Coverage**:
- Complete user workflows for all payment methods
- Form validation and error handling
- File upload with progress tracking
- Responsive design and mobile compatibility
- Accessibility compliance
- Network and server error handling

**Key Test Cases**:
```typescript
test('complete bank transfer payment flow', async ({ page }) => {
  // Test entire user journey from form to confirmation
});

test('form validation errors', async ({ page }) => {
  // Test client-side validation and error display
});

test('file upload functionality', async ({ page }) => {
  // Test file upload with progress and validation
});
```

### 5. Performance Tests

**Location**: `tests/performance/load-test-plan.py`

**Coverage**:
- Baseline performance under light load
- Moderate load testing with concurrent users
- High load testing to find breaking points
- Payment method performance comparison
- Response time analysis (mean, median, 95th, 99th percentiles)

**Test Scenarios**:
```python
async def moderate_load_test(auth_token: str):
    # Test with 10 concurrent users, 100 total requests

async def stress_test(auth_token: str):
    # Gradually increase load to find breaking point

async def payment_method_performance_test(auth_token: str):
    # Compare performance across different payment methods
```

## Performance Benchmarks

### Response Time Targets
- **Baseline**: < 500ms average response time
- **Moderate load**: < 800ms 95th percentile
- **High load**: < 1.5s 99th percentile
- **File upload**: < 5s for 5MB files

### Success Rate Targets
- **Light load**: > 99% success rate
- **Moderate load**: > 95% success rate
- **High load**: > 90% success rate
- **Stress test**: Maintain > 80% success rate until breaking point

## Test Data Management

### Mock Data Structure
```python
# Bank Transfer Payment
{
    "student_id": "student_123",
    "fee_id": "tuition",
    "amount": 5000,
    "payment_method": "bank_transfer",
    "bank_details": {
        "bank_name": "Commercial Bank of Ethiopia",
        "transaction_number": "TXN123456789",
        "bank_code": "001"
    }
}

# Mobile Payment
{
    "student_id": "student_456",
    "fee_id": "exam_fee",
    "amount": 2500,
    "payment_method": "mobile_payment",
    "mobile_details": {
        "transaction_id": "MP987654321"
    }
}
```

### File Upload Test Data
- **Valid files**: JPG, PNG images under 5MB
- **Invalid files**: TXT, PDF over 5MB
- **Edge cases**: Empty files, corrupted images

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Payment System Tests

on:
  push:
    paths:
      - 'backend/app/api/payments.py'
      - 'src/components/payments/**'
      - 'tests/**'

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run backend tests
        run: |
          cd backend
          pytest tests/ --cov=app

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run frontend tests
        run: |
          npm test -- --coverage

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run E2E tests
        run: |
          npx playwright test
```

## Test Environment Setup

### Prerequisites
1. **Backend**: FastAPI server running on http://127.0.0.1:8000
2. **Frontend**: Vite dev server running on http://localhost:8080
3. **Database**: MongoDB test instance
4. **Authentication**: Valid test token for API tests

### Environment Variables
```bash
# Backend
MONGO_URI=mongodb://localhost:27017/test_db
SECRET_KEY=test_secret_key
TESTING=true

# Frontend
VITE_API_URL=http://localhost:8000
VITE_TEST_MODE=true
```

## Bug Reporting and Test Maintenance

### When Tests Fail
1. **Check system status**: Ensure all services are running
2. **Review logs**: Check application logs for errors
3. **Validate test data**: Ensure test data is still valid
4. **Update tests**: Modify tests if requirements have changed

### Test Maintenance Schedule
- **Weekly**: Run full test suite
- **Monthly**: Review test coverage and add missing tests
- **Quarterly**: Update performance benchmarks
- **As needed**: Add tests for new features and bug fixes

## Debugging Test Failures

### Backend Test Debugging
```bash
# Run with verbose output
pytest tests/test_payment_validation.py -v -s

# Run specific test with debugging
pytest tests/test_payment_validation.py::TestBankTransferValidation::test_valid_bank_transfer -v -s --pdb

# Check test coverage
pytest tests/ --cov=app --cov-report=term-missing
```

### Frontend Test Debugging
```bash
# Run tests in watch mode
npm test -- --watch

# Run tests with debugger
npm test -- --runInBand --no-cache

# Generate coverage report
npm test -- --coverage --coverageReporters=text-lcov
```

### E2E Test Debugging
```bash
# Run in headed mode
npx playwright test --headed

# Run with debugging
npx playwright test --debug

# Generate trace files
npx playwright test --trace on
```

## Security Testing

### Input Validation Tests
- SQL injection attempts
- XSS payload testing
- File upload security (malicious files)
- Authentication bypass attempts

### Authorization Tests
- Role-based access control
- API endpoint protection
- Data access restrictions

## Accessibility Testing

### Automated Tests
- Screen reader compatibility
- Keyboard navigation
- Color contrast compliance
- ARIA label completeness

### Manual Testing Checklist
- [ ] All interactive elements are keyboard accessible
- [ ] Forms have proper labels and error messages
- [ ] Content is readable with screen readers
- [ ] Color contrast meets WCAG 2.1 AA standards

## Conclusion

This comprehensive testing strategy ensures the extended payment system is reliable, performant, and secure. Regular execution of these tests helps maintain code quality and provides confidence in system functionality.

For questions or contributions to the testing suite, please refer to the development team or create an issue in the project repository.