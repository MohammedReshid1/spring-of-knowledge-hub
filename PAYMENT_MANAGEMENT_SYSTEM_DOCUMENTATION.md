# Payment Management System Documentation

## Overview

This document describes the comprehensive Payment Management System designed for the Spring of Knowledge Hub school management application. The system provides complete functionality for fee management, payment processing, receipt generation, and financial reporting.

## System Architecture

### Technology Stack
- **Backend**: FastAPI with Python
- **Database**: MongoDB with Motor (async driver)
- **PDF Generation**: ReportLab
- **Data Processing**: Pandas for Excel/CSV imports
- **Authentication**: JWT-based with RBAC
- **Branch Isolation**: All data is isolated by `branch_id`

### Core Components

1. **Models** (`backend/app/models/`)
   - `fee_category.py` - Fee structure definitions
   - `payment.py` - Payment transactions
   - `payment_detail.py` - Line items for each payment
   - `payment_receipt.py` - Receipt generation metadata

2. **Routers** (`backend/app/routers/`)
   - `fee_categories.py` - Fee category management
   - `payments.py` - Payment processing
   - `payment_reports.py` - Financial reporting
   - `payment_bulk_import.py` - Bulk import functionality
   - `payment_receipts.py` - Receipt generation

3. **Utilities** (`backend/app/utils/`)
   - `payment_validation.py` - Comprehensive validation
   - `payment_calculations.py` - Fee calculations
   - `receipt_generator.py` - PDF receipt generation
   - `bulk_import_handler.py` - CSV/Excel processing

## Database Collections

### fee_categories
Stores fee structure definitions:
```javascript
{
  _id: ObjectId,
  name: "Tuition Fee",
  arabic_name: "رسوم الدراسة",
  description: "Annual tuition fee",
  amount: "5000.00",
  fee_type: "mandatory|optional|recurring|one-time",
  frequency: "monthly|quarterly|semi-annual|annual|one-time",
  grade_level_id: ObjectId,
  academic_year_id: ObjectId,
  due_date_offset: 30,
  late_fee_percentage: "5.00",
  late_fee_grace_days: 7,
  discount_eligible: true,
  tax_percentage: "15.00",
  priority: 1,
  is_active: true,
  branch_id: "branch_123",
  created_at: ISODate,
  created_by: "user_id"
}
```

### payments
Stores payment transactions:
```javascript
{
  _id: ObjectId,
  receipt_no: "RCP-2024-000001",
  student_id: "STU001",
  payment_date: ISODate,
  academic_year_id: ObjectId,
  term_id: ObjectId,
  subtotal: "5000.00",
  discount_amount: "500.00",
  discount_percentage: "10.00",
  discount_reason: "Sibling discount",
  tax_amount: "675.00",
  late_fee_amount: "0.00",
  total_amount: "5175.00",
  payment_method: "cash|card|bank_transfer|cheque|online|mobile_payment",
  payment_reference: "TXN12345",
  payment_gateway: "stripe",
  bank_name: "ABC Bank",
  cheque_number: "123456",
  cheque_date: ISODate,
  card_last_four: "1234",
  status: "pending|completed|failed|cancelled|refunded|partial_refund",
  verification_status: "unverified|verified|rejected",
  verified_by: "user_id",
  verified_at: ISODate,
  remarks: "Payment notes",
  payer_name: "Parent Name",
  payer_phone: "+1234567890",
  payer_email: "parent@email.com",
  branch_id: "branch_123",
  created_at: ISODate,
  created_by: "user_id"
}
```

### payment_details
Stores line items for each payment:
```javascript
{
  _id: ObjectId,
  payment_id: "payment_id",
  fee_category_id: "category_id",
  fee_category_name: "Tuition Fee",
  original_amount: "5000.00",
  discount_amount: "500.00",
  discount_percentage: "10.00",
  tax_amount: "675.00",
  late_fee_amount: "0.00",
  paid_amount: "5175.00",
  quantity: 1,
  unit_price: "5000.00",
  remarks: "Q1 tuition",
  period_start: ISODate,
  period_end: ISODate,
  branch_id: "branch_123",
  created_at: ISODate
}
```

### payment_receipts
Stores receipt generation metadata:
```javascript
{
  _id: ObjectId,
  payment_id: "payment_id",
  receipt_number: "RCP-2024-000001",
  template_id: "template_id",
  generated_at: ISODate,
  generated_by: "user_id",
  generation_type: "manual|automatic|reprint",
  file_url: "/receipts/receipt_123.pdf",
  file_size: 245760,
  file_hash: "sha256hash",
  sent_via_email: true,
  email_sent_to: ["parent@email.com"],
  email_sent_at: ISODate,
  sent_via_sms: false,
  print_count: 2,
  download_count: 5,
  status: "draft|final|cancelled|archived",
  branch_id: "branch_123",
  created_at: ISODate
}
```

### receipt_templates
Stores receipt template configurations:
```javascript
{
  _id: ObjectId,
  name: "Default Receipt Template",
  description: "Standard receipt layout",
  paper_size: "A4|Letter|A5",
  orientation: "portrait|landscape",
  margins: {top: 20, bottom: 20, left: 15, right: 15},
  show_logo: true,
  show_branch_info: true,
  show_fee_breakdown: true,
  show_tax_details: true,
  primary_color: "#2563eb",
  is_default: true,
  is_active: true,
  branch_id: "branch_123"
}
```

## API Endpoints

### Fee Categories (`/fee-categories`)

#### POST /fee-categories
Create a new fee category
```json
{
  "name": "Transportation Fee",
  "arabic_name": "رسوم النقل",
  "amount": 500.00,
  "fee_type": "optional",
  "frequency": "monthly",
  "branch_id": "branch_123"
}
```

#### GET /fee-categories
Get fee categories with filters
- `branch_id` (required)
- `grade_level_id` (optional)
- `fee_type` (optional)
- `is_active` (optional)

#### PUT /fee-categories/{category_id}
Update fee category

#### DELETE /fee-categories/{category_id}
Soft delete fee category (set is_active=false)

#### POST /fee-categories/bulk
Create multiple fee categories at once

### Payments (`/payments`)

#### POST /payments
Create a new payment
```json
{
  "student_id": "STU001",
  "branch_id": "branch_123",
  "fee_items": [
    {
      "fee_category_id": "category_123",
      "amount": 1000.00,
      "quantity": 1,
      "discount_amount": 100.00
    }
  ],
  "payment_method": "cash",
  "payer_name": "Parent Name",
  "payer_email": "parent@email.com"
}
```

#### GET /payments
Get payments with filters
- `branch_id` (required)
- `student_id` (optional)
- `status` (optional)
- `payment_method` (optional)
- `from_date` / `to_date` (optional)

#### GET /payments/{payment_id}
Get payment with full details

#### PUT /payments/{payment_id}
Update payment information

#### POST /payments/{payment_id}/cancel
Cancel a payment with reason

#### POST /payments/{payment_id}/refund
Process refund with amount and reason

#### GET /payments/summary/branch
Get payment summary for branch

### Payment Reports (`/payment-reports`)

#### GET /payment-reports/daily-collection
Daily collection report
- `branch_id` (required)
- `report_date` (required)
- `format` (json|csv)

#### GET /payment-reports/outstanding-fees
Outstanding fees report
- `branch_id` (required)
- `grade_level_id` (optional)
- `class_id` (optional)
- `as_of_date` (optional)

#### GET /payment-reports/fee-collection-summary
Fee collection summary
- `branch_id` (required)
- `from_date` / `to_date` (required)
- `group_by` (day|month|fee_category|grade_level)

#### GET /payment-reports/student-payment-history/{student_id}
Student payment history

### Bulk Import (`/payment-bulk-import`)

#### POST /payment-bulk-import/upload
Upload CSV/Excel file for bulk payment import
- Supports CSV, XLS, XLSX formats
- Validation and dry-run options
- Error reporting

#### GET /payment-bulk-import/template
Download CSV template for bulk import

#### POST /payment-bulk-import/validate
Validate import file without importing

### Receipt Management (`/payment-receipts`)

#### POST /payment-receipts/generate
Generate payment receipt
```json
{
  "payment_id": "payment_123",
  "template_id": "template_123",
  "language": "en|ar|bilingual",
  "format": "pdf|html",
  "send_email": true,
  "email_addresses": ["parent@email.com"]
}
```

#### POST /payment-receipts/generate-bulk
Generate receipts for multiple payments

#### GET /payment-receipts
Get receipt records

#### POST /payment-receipts/{receipt_id}/resend
Resend receipt via email/SMS

## Business Logic Features

### Payment Validation
- Student existence validation
- Fee category validation
- Payment method validation
- Duplicate payment detection
- Amount calculation validation

### Fee Calculations
- Subtotal calculation
- Discount application (percentage or fixed)
- Tax calculation
- Late fee calculation
- Installment calculation
- Prorated fee calculation
- Refund calculation

### Receipt Generation
- PDF generation using ReportLab
- HTML receipts for email/web display
- Customizable templates
- Multi-language support
- Bulk receipt generation
- Email/SMS delivery

### Bulk Import
- CSV and Excel file support
- Data validation
- Error reporting
- Dry-run capability
- Template generation
- Progress tracking

### Reporting
- Daily collection reports
- Outstanding fees tracking
- Fee collection summaries
- Student payment history
- Customizable date ranges
- Export to CSV

## Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Permission checking for all operations
- User activity tracking

### Data Isolation
- Branch-based data separation
- User access restricted to assigned branches
- All queries filtered by branch_id

### Input Validation
- Comprehensive input validation
- SQL injection prevention
- XSS protection
- File upload validation

### Audit Trail
- All payment operations logged
- User tracking for create/update operations
- Timestamp tracking
- Change history

## Configuration

### Environment Variables
```bash
MONGODB_URI=mongodb://localhost:27017/spring_of_knowledge
SESSION_SECRET_KEY=your_secret_key
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
ENVIRONMENT=development
```

### Dependencies
```bash
# Core dependencies
fastapi>=0.104.0
motor>=3.3.0
pydantic>=2.0.0
python-multipart>=0.0.6

# PDF generation
reportlab>=4.0.0

# Data processing
pandas>=2.0.0
openpyxl>=3.1.0

# Authentication
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
```

## Usage Examples

### Creating a Fee Category
```bash
curl -X POST "http://localhost:8000/fee-categories" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Library Fee",
    "amount": 200.00,
    "fee_type": "optional",
    "branch_id": "branch_123"
  }'
```

### Processing a Payment
```bash
curl -X POST "http://localhost:8000/payments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "STU001",
    "branch_id": "branch_123",
    "fee_items": [
      {
        "fee_category_id": "category_123",
        "amount": 1000.00,
        "quantity": 1
      }
    ],
    "payment_method": "cash"
  }'
```

### Generating a Receipt
```bash
curl -X POST "http://localhost:8000/payment-receipts/generate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "payment_123",
    "format": "pdf",
    "language": "en"
  }' --output receipt.pdf
```

### Getting Daily Collection Report
```bash
curl "http://localhost:8000/payment-reports/daily-collection?branch_id=branch_123&report_date=2024-01-15&format=csv" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output daily_collection.csv
```

## Error Handling

The system provides comprehensive error handling with structured error responses:

```json
{
  "detail": "Student 'STU999' not found or inactive in branch 'branch_123'",
  "field": "student_id",
  "error_code": "STUDENT_NOT_FOUND"
}
```

Common error codes:
- `VALIDATION_ERROR` - Input validation failed
- `STUDENT_NOT_FOUND` - Student doesn't exist
- `FEE_CATEGORY_NOT_FOUND` - Fee category doesn't exist
- `PAYMENT_NOT_FOUND` - Payment doesn't exist
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `DUPLICATE_RECEIPT` - Receipt number already exists

## Performance Considerations

### Database Indexing
Recommended indexes for optimal performance:
```javascript
// fee_categories
db.fee_categories.createIndex({"branch_id": 1, "is_active": 1})
db.fee_categories.createIndex({"branch_id": 1, "grade_level_id": 1})

// payments
db.payments.createIndex({"branch_id": 1, "payment_date": -1})
db.payments.createIndex({"student_id": 1, "payment_date": -1})
db.payments.createIndex({"receipt_no": 1}, {unique: true})
db.payments.createIndex({"branch_id": 1, "status": 1})

// payment_details
db.payment_details.createIndex({"payment_id": 1})
db.payment_details.createIndex({"fee_category_id": 1})
```

### Caching Strategy
- Fee categories cached per branch
- Receipt templates cached
- Student information cached
- Currency formatting cached

### File Storage
- Receipts stored in organized directory structure
- PDF files compressed for storage efficiency
- Old receipts archived automatically
- CDN integration for fast delivery

## Future Enhancements

### Planned Features
1. **Payment Gateway Integration**
   - Stripe, PayPal, local payment gateways
   - Webhook handling for payment status updates
   - Automatic payment reconciliation

2. **Advanced Reporting**
   - Interactive dashboards
   - Custom report builder
   - Automated report scheduling
   - Data export to accounting systems

3. **Mobile App Integration**
   - Parent payment portal
   - Push notifications
   - QR code payments
   - Offline receipt storage

4. **Multi-Currency Support**
   - Currency conversion
   - Exchange rate management
   - Multi-currency reporting

5. **Subscription Management**
   - Recurring payment automation
   - Payment plan management
   - Dunning management
   - Grace period handling

## Troubleshooting

### Common Issues

1. **Receipt Generation Fails**
   - Check ReportLab installation
   - Verify template configuration
   - Check file permissions

2. **Bulk Import Errors**
   - Validate CSV format
   - Check required columns
   - Verify student IDs exist

3. **Payment Validation Fails**
   - Check fee category exists
   - Verify student is active
   - Confirm branch access

### Logging

The system provides comprehensive logging:
```python
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Log payment operations
logger = logging.getLogger("payments")
logger.info(f"Payment created: {payment_id}")
```

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.

---

This Payment Management System provides a comprehensive solution for school fee management with robust validation, reporting, and user-friendly features while maintaining security and performance standards.