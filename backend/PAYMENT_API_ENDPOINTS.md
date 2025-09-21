# Payment Processing API Endpoints

## Overview
This document provides a comprehensive guide to all payment processing API endpoints available in the Spring of Knowledge Hub system. All endpoints are accessible under the `/payments` prefix.

**Base URL**: `http://localhost:8000/payments`
**Test Mode**: `TEST_MODE=true` (authentication bypassed for development)

---

## 🏗️ Core Configuration

### Test Mode Information
```http
GET /test-info
```
Returns test mode configuration and authentication status.

**Response Example:**
```json
{
  "test_mode": true,
  "dev_mode": true,
  "environment": "development",
  "authentication_bypassed": true,
  "mock_user": {...},
  "message": "Test mode is active - authentication bypassed for development"
}
```

---

## 💰 Fee Templates

### Get Fee Templates
```http
GET /fee-templates?branch_id=all&is_active=true&limit=100
```
Retrieves all fee templates for a branch.

**Query Parameters:**
- `branch_id` (required): Branch identifier or "all"
- `is_active` (optional): Filter by active status
- `fee_type` (optional): Filter by fee type
- `grade_level` (optional): Filter by grade level
- `skip` (optional): Pagination offset (default: 0)
- `limit` (optional): Items per page (default: 100, max: 1000)

**Response Example:**
```json
[
  {
    "id": "68c5ed28b5e0cc3deed2e500",
    "name": "Registration Fee",
    "fee_type": "registration",
    "amount": 1000.0,
    "currency": "USD",
    "frequency": "annual",
    "academic_year": "2024-2025",
    "is_active": true,
    "branch_id": "default"
  }
]
```

### Create Fee Template
```http
POST /fee-templates?branch_id={branch_id}
```
Creates a new fee template.

---

## 👥 Student Management

### Search Students for Payment
```http
GET /students/search?q=john&branch_id=all&limit=20
```
Search students for payment processing.

**Query Parameters:**
- `q` (required): Search query (name, student ID, email, phone)
- `branch_id` (required): Branch identifier
- `limit` (optional): Results limit (default: 20, max: 100)

**Response Example:**
```json
{
  "students": [
    {
      "id": "student_id",
      "student_id": "SCH-2025-001",
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "grade_level": "Grade 10",
      "branch_id": "branch_001",
      "outstanding_balance": 250.00
    }
  ],
  "count": 1,
  "query": "john",
  "branch_id": "all"
}
```

### Get Student Payment Information
```http
GET /students/{student_id}/payment-info?branch_id=all
```
Retrieves comprehensive payment information for a specific student.

**Response Example:**
```json
{
  "student": {
    "id": "student_id",
    "student_id": "SCH-2025-001",
    "full_name": "John Doe",
    "email": "john@example.com",
    "grade_level": "Grade 10"
  },
  "payment_summary": {
    "total_fees": 2500.00,
    "total_paid": 2250.00,
    "total_balance": 250.00,
    "overdue_amount": 0.00,
    "status": "pending"
  },
  "fee_structures": [...],
  "recent_payments": [...]
}
```

### Get Student Balance
```http
GET /students/{student_id}/balance?branch_id=all
```
Gets current balance and payment status for a student.

### Get Student Payment History
```http
GET /students/{student_id}/payment-history?branch_id=all&start_date=2024-01-01&end_date=2024-12-31
```
Retrieves complete payment history for a student.

---

## 💳 Payment Transactions

### Get Payment Transactions
```http
GET /transactions?branch_id=all&limit=100&status=paid
```
Retrieves payment transactions with filtering options.

**Query Parameters:**
- `branch_id` (required): Branch identifier
- `student_id` (optional): Filter by student
- `status` (optional): Filter by payment status
- `payment_method` (optional): Filter by payment method
- `start_date` (optional): Start date filter (YYYY-MM-DD)
- `end_date` (optional): End date filter (YYYY-MM-DD)
- `skip` (optional): Pagination offset
- `limit` (optional): Items per page (default: 100, max: 1000)

**Response Example:**
```json
[
  {
    "id": "transaction_id",
    "transaction_id": "TXN-20250915-ABCD",
    "student_id": "student_id",
    "amount": 500.00,
    "currency": "USD",
    "payment_method": "credit_card",
    "payment_date": "2025-09-15T10:30:00Z",
    "status": "paid",
    "receipt_number": "RCP-MAIN-20250915-XYZ",
    "reference_number": "REF123456"
  }
]
```

### Process Payment
```http
POST /transactions?branch_id=all
```
Processes a new payment transaction.

**Request Body:**
```json
{
  "student_id": "student_id",
  "fee_structure_id": "fee_structure_id",
  "amount": 500.00,
  "payment_method": "credit_card",
  "payment_date": "2025-09-15T10:30:00Z",
  "reference_number": "REF123456",
  "notes": "Tuition payment for September"
}
```

### Bulk Payment Processing
```http
POST /transactions/bulk?branch_id=all
```
Processes multiple payments in bulk.

**Request Body:**
```json
[
  {
    "student_id": "student_1",
    "amount": 500.00,
    "payment_method": "bank_transfer",
    "payment_date": "2025-09-15T10:30:00Z"
  },
  {
    "student_id": "student_2",
    "amount": 750.00,
    "payment_method": "cash",
    "payment_date": "2025-09-15T11:00:00Z"
  }
]
```

**Response Example:**
```json
{
  "successful": ["TXN-001", "TXN-002"],
  "failed": [],
  "total_amount": 1250.00
}
```

### Validate Payment Data
```http
POST /transactions/validate?branch_id=all
```
Validates payment data before processing.

**Request Body:**
```json
{
  "student_id": "student_id",
  "fee_structure_id": "fee_structure_id",
  "amount": 500.00
}
```

**Response Example:**
```json
{
  "is_valid": true,
  "errors": [],
  "warnings": ["Payment amount exceeds outstanding balance"]
}
```

---

## ✅ Approval Workflow

### Get Pending Approvals
```http
GET /transactions/pending-approvals?branch_id=all&limit=50
```
Retrieves payments pending approval.

**Response Example:**
```json
{
  "payments": [
    {
      "id": "transaction_id",
      "transaction_id": "TXN-20250915-LARGE",
      "amount": 15000.00,
      "student_name": "John Doe",
      "student_student_id": "SCH-2025-001",
      "requires_approval": true,
      "approval_status": "pending"
    }
  ],
  "total_count": 5,
  "current_count": 1
}
```

### Approve/Reject Payment
```http
PUT /transactions/{transaction_id}/approve?branch_id=all
```
Approves or rejects a payment requiring approval.

**Request Body:**
```json
{
  "approval_status": "approved",
  "approval_notes": "Approved after verification"
}
```

---

## 📊 Analytics and Dashboard

### Payment Dashboard
```http
GET /dashboard?branch_id=all&date_range=30d
```
Retrieves payment dashboard data.

**Query Parameters:**
- `branch_id` (required): Branch identifier
- `academic_year` (optional): Academic year filter
- `date_range` (optional): "7d", "30d", "90d" (default: "30d")

**Response Example:**
```json
{
  "total_revenue": 25750.00,
  "transaction_count": 125,
  "pending_payments": 15,
  "overdue_payments": 3,
  "date_range": "30d",
  "start_date": "2025-08-16T00:00:00",
  "end_date": "2025-09-15T23:59:59",
  "test_mode": true
}
```

### Financial Summary
```http
GET /analytics/summary?branch_id=all&start_date=2024-01-01&end_date=2024-12-31
```
Generates comprehensive financial summary.

**Response Example:**
```json
{
  "branch_id": "all",
  "period_start": "2024-01-01",
  "period_end": "2024-12-31",
  "currency": "USD",
  "total_revenue": 125750.50,
  "tuition_revenue": 95000.00,
  "other_revenue": 30750.50,
  "total_collected": 113300.00,
  "total_outstanding": 12450.50,
  "total_transactions": 145,
  "successful_transactions": 132,
  "collection_rate": 92.5
}
```

### Detailed Payment Analytics
```http
GET /analytics/detailed?branch_id=all&days=30
```
Provides detailed payment analytics with breakdowns.

**Response Example:**
```json
{
  "branch_id": "all",
  "daily_collections": [
    {"date": "2025-09-14", "amount": 500, "count": 1},
    {"date": "2025-09-15", "amount": 250, "count": 1}
  ],
  "payment_method_distribution": {
    "cash": 500.0,
    "credit_card": 250.0
  },
  "fee_type_distribution": {
    "tuition": 750.0
  }
}
```

---

## 📄 Export and Reports

### Export Transactions
```http
GET /export/transactions?format=json&branch_id=all&start_date=2024-01-01&end_date=2024-12-31
```
Exports payment transactions in various formats.

**Query Parameters:**
- `format` (required): "csv", "excel", "json"
- `branch_id` (required): Branch identifier
- `start_date` (optional): Start date filter
- `end_date` (optional): End date filter
- `status` (optional): Payment status filter
- `payment_method` (optional): Payment method filter

**Response Example:**
```json
{
  "filename": "payment_transactions_20250915_123120.json",
  "data": [...],
  "count": 125,
  "format": "json",
  "headers": ["transaction_id", "payment_date", "amount", "student_name"]
}
```

### Financial Report
```http
GET /reports/financial-summary?branch_id=all&start_date=2024-01-01&end_date=2024-12-31&group_by=month
```
Generates financial summary reports with grouping.

**Query Parameters:**
- `branch_id` (required): Branch identifier
- `start_date` (required): Report start date
- `end_date` (required): Report end date
- `group_by` (required): "day", "week", "month"

**Response Example:**
```json
{
  "summary": {
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "total_amount": 125750.00,
    "total_transactions": 145,
    "group_by": "month"
  },
  "data": [
    {
      "period": "2024-01",
      "amount": 12500.00,
      "count": 15,
      "methods": {"cash": 5000.00, "credit_card": 7500.00}
    }
  ],
  "method_breakdown": {
    "cash": 45000.00,
    "credit_card": 80750.00
  }
}
```

---

## 🧾 Receipts

### Get Payment Receipt
```http
GET /receipts/{transaction_id}?format=json&branch_id=all
```
Generates payment receipt for a transaction.

**Query Parameters:**
- `format` (required): "json", "html", "pdf"
- `branch_id` (required): Branch identifier

**Response Example:**
```json
{
  "receipt_number": "RCP-MAIN-20250915-XYZ",
  "transaction_id": "TXN-20250915-ABCD",
  "payment_date": "2025-09-15 10:30:00",
  "amount": 500.00,
  "currency": "USD",
  "payment_method": "credit_card",
  "status": "paid",
  "student": {
    "name": "John Doe",
    "student_id": "SCH-2025-001",
    "email": "john@example.com",
    "grade_level": "Grade 10"
  },
  "generated_at": "2025-09-15 12:31:20"
}
```

---

## 📋 Invoices

### Get Invoices
```http
GET /invoices?branch_id=all&student_id=student_id&status=sent
```
Retrieves invoices with filtering options.

**Query Parameters:**
- `branch_id` (required): Branch identifier
- `student_id` (optional): Filter by student
- `status` (optional): Filter by invoice status
- `start_date` (optional): Start date filter
- `end_date` (optional): End date filter
- `skip` (optional): Pagination offset
- `limit` (optional): Items per page

---

## 🔧 Development and Testing

### Simple Test Endpoint
```http
GET /test-fee-templates-simple
```
Simple test endpoint for debugging fee templates.

**Response Example:**
```json
{
  "status": "success",
  "count": 64,
  "user": "test@example.com",
  "test_mode": true
}
```

---

## 🚨 Error Handling

All endpoints return standardized error responses:

### 400 Bad Request
```json
{
  "detail": "Validation failed: Payment amount must be greater than zero"
}
```

### 404 Not Found
```json
{
  "detail": "Student not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Failed to retrieve fee templates: Database connection error"
}
```

---

## 🔐 Authentication

In **Test Mode** (`TEST_MODE=true`):
- Authentication is bypassed
- Mock user credentials are used automatically
- All endpoints are accessible without authentication headers

In **Production Mode** (`TEST_MODE=false`):
- Authentication is required for all endpoints
- JWT tokens must be provided in the Authorization header
- Role-based access control is enforced

---

## 📱 Frontend Integration Examples

### React/TypeScript Example
```typescript
// Fetch fee templates
const fetchFeeTemplates = async (branchId: string) => {
  const response = await fetch(
    `/payments/fee-templates?branch_id=${branchId}&is_active=true`
  );
  return response.json();
};

// Search students
const searchStudents = async (query: string, branchId: string) => {
  const response = await fetch(
    `/payments/students/search?q=${encodeURIComponent(query)}&branch_id=${branchId}`
  );
  return response.json();
};

// Process payment
const processPayment = async (paymentData: PaymentTransaction) => {
  const response = await fetch('/payments/transactions?branch_id=all', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paymentData),
  });
  return response.json();
};
```

---

## 📖 Additional Resources

- **API Documentation**: Available at `/docs` when server is running in development mode
- **OpenAPI Schema**: Available at `/openapi.json`
- **Test Mode Info**: Use `/payments/test-info` to verify configuration
- **Database Collections**: `fee_templates`, `payment_transactions`, `fee_structures`, `invoices`

---

## 🎯 Key Features

✅ **Complete Payment Processing**: Single payments, bulk processing, approval workflows
✅ **Student Management**: Search, payment info, balance tracking, payment history
✅ **Financial Analytics**: Dashboard, summaries, detailed analytics, trends
✅ **Export Capabilities**: CSV, Excel, JSON formats with flexible filtering
✅ **Receipt Generation**: JSON, HTML, PDF formats (PDF in development)
✅ **Invoice Management**: Generation, tracking, status management
✅ **Test Mode Support**: Development-friendly with authentication bypass
✅ **Error Handling**: Comprehensive error responses with meaningful messages
✅ **Data Validation**: Pre-processing validation with warnings and errors
✅ **Legacy Data Support**: Handles existing data with missing fields gracefully

This payment system provides a complete solution for educational institution payment processing with modern API design and comprehensive functionality.