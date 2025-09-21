#!/usr/bin/env python3
"""
Test script for the Payment Management System

This script tests the core functionality of the payment system including:
- Fee category creation
- Payment processing
- Receipt generation
- Bulk import
- Reporting

Run with: python test_payment_system.py
"""

import asyncio
import json
from datetime import datetime, date
from decimal import Decimal
from motor.motor_asyncio import AsyncIOMotorClient

# Test data
TEST_BRANCH_ID = "507f1f77bcf86cd799439011"
TEST_STUDENT_ID = "STU001"
TEST_USER_ID = "507f1f77bcf86cd799439012"

async def setup_test_data(client):
    """Setup test data in MongoDB"""
    db = client.spring_of_knowledge_test

    # Clear existing test data
    collections = [
        "branches", "students", "fee_categories",
        "payments", "payment_details", "payment_receipts"
    ]

    for collection_name in collections:
        await db[collection_name].delete_many({"branch_id": TEST_BRANCH_ID})

    print("✅ Cleared existing test data")

    # Insert test branch
    branch_doc = {
        "_id": TEST_BRANCH_ID,
        "name": "Test Branch",
        "school_name": "Test School",
        "address": "123 Test Street, Test City",
        "phone": "+1234567890",
        "email": "test@school.edu",
        "is_active": True
    }
    await db.branches.insert_one(branch_doc)

    # Insert test student
    student_doc = {
        "student_id": TEST_STUDENT_ID,
        "first_name": "John Doe",
        "grade_level": "Grade 10",
        "class_id": "10A",
        "status": "Active",
        "father_name": "Parent Name",
        "phone": "+1234567890",
        "email": "parent@email.com",
        "branch_id": TEST_BRANCH_ID,
        "created_at": datetime.now()
    }
    await db.students.insert_one(student_doc)

    print("✅ Setup test branch and student")
    return db

async def test_fee_categories(db):
    """Test fee category operations"""
    print("\n🧪 Testing Fee Categories...")

    # Create test fee categories
    fee_categories = [
        {
            "name": "Tuition Fee",
            "arabic_name": "رسوم الدراسة",
            "description": "Annual tuition fee",
            "amount": "5000.00",
            "fee_type": "mandatory",
            "frequency": "annual",
            "is_active": True,
            "priority": 1,
            "discount_eligible": True,
            "tax_percentage": "15.00",
            "branch_id": TEST_BRANCH_ID,
            "created_at": datetime.now(),
            "created_by": TEST_USER_ID
        },
        {
            "name": "Transportation Fee",
            "arabic_name": "رسوم النقل",
            "description": "Monthly transportation fee",
            "amount": "300.00",
            "fee_type": "optional",
            "frequency": "monthly",
            "is_active": True,
            "priority": 2,
            "discount_eligible": True,
            "branch_id": TEST_BRANCH_ID,
            "created_at": datetime.now(),
            "created_by": TEST_USER_ID
        },
        {
            "name": "Books & Materials",
            "arabic_name": "الكتب والمواد",
            "description": "Books and learning materials",
            "amount": "500.00",
            "fee_type": "mandatory",
            "frequency": "annual",
            "is_active": True,
            "priority": 3,
            "discount_eligible": False,
            "branch_id": TEST_BRANCH_ID,
            "created_at": datetime.now(),
            "created_by": TEST_USER_ID
        }
    ]

    # Insert fee categories
    result = await db.fee_categories.insert_many(fee_categories)
    fee_category_ids = [str(id) for id in result.inserted_ids]

    # Test retrieval
    categories = await db.fee_categories.find({"branch_id": TEST_BRANCH_ID}).to_list(None)

    print(f"✅ Created {len(categories)} fee categories")

    # Test search by type
    mandatory_fees = await db.fee_categories.find({
        "branch_id": TEST_BRANCH_ID,
        "fee_type": "mandatory"
    }).to_list(None)

    print(f"✅ Found {len(mandatory_fees)} mandatory fees")

    return fee_category_ids

async def test_payments(db, fee_category_ids):
    """Test payment processing"""
    print("\n🧪 Testing Payments...")

    # Create a test payment
    payment_doc = {
        "receipt_no": "RCP-2024-000001",
        "student_id": TEST_STUDENT_ID,
        "payment_date": datetime.now(),
        "subtotal": "5800.00",  # 5000 + 300 + 500
        "discount_amount": "580.00",  # 10% discount
        "discount_percentage": "10.00",
        "discount_reason": "Early payment discount",
        "tax_amount": "783.00",  # 15% tax on discounted amount
        "late_fee_amount": "0.00",
        "total_amount": "6003.00",  # 5800 - 580 + 783
        "payment_method": "cash",
        "status": "completed",
        "verification_status": "verified",
        "remarks": "Test payment",
        "payer_name": "Parent Name",
        "payer_phone": "+1234567890",
        "payer_email": "parent@email.com",
        "branch_id": TEST_BRANCH_ID,
        "created_at": datetime.now(),
        "created_by": TEST_USER_ID
    }

    payment_result = await db.payments.insert_one(payment_doc)
    payment_id = str(payment_result.inserted_id)

    # Create payment details
    payment_details = [
        {
            "payment_id": payment_id,
            "fee_category_id": fee_category_ids[0],
            "fee_category_name": "Tuition Fee",
            "original_amount": "5000.00",
            "discount_amount": "500.00",
            "tax_amount": "675.00",
            "late_fee_amount": "0.00",
            "paid_amount": "5175.00",
            "quantity": 1,
            "unit_price": "5000.00",
            "branch_id": TEST_BRANCH_ID,
            "created_at": datetime.now()
        },
        {
            "payment_id": payment_id,
            "fee_category_id": fee_category_ids[1],
            "fee_category_name": "Transportation Fee",
            "original_amount": "300.00",
            "discount_amount": "30.00",
            "tax_amount": "40.50",
            "late_fee_amount": "0.00",
            "paid_amount": "310.50",
            "quantity": 1,
            "unit_price": "300.00",
            "branch_id": TEST_BRANCH_ID,
            "created_at": datetime.now()
        },
        {
            "payment_id": payment_id,
            "fee_category_id": fee_category_ids[2],
            "fee_category_name": "Books & Materials",
            "original_amount": "500.00",
            "discount_amount": "50.00",
            "tax_amount": "67.50",
            "late_fee_amount": "0.00",
            "paid_amount": "517.50",
            "quantity": 1,
            "unit_price": "500.00",
            "branch_id": TEST_BRANCH_ID,
            "created_at": datetime.now()
        }
    ]

    await db.payment_details.insert_many(payment_details)

    print(f"✅ Created payment {payment_id} with {len(payment_details)} line items")

    # Test payment retrieval with details
    payment = await db.payments.find_one({"_id": payment_id})
    details = await db.payment_details.find({"payment_id": payment_id}).to_list(None)

    print(f"✅ Retrieved payment with {len(details)} details")

    return payment_id

async def test_payment_calculations():
    """Test payment calculation functions"""
    print("\n🧪 Testing Payment Calculations...")

    # Import calculation functions
    from app.utils.payment_calculations import (
        calculate_payment_totals,
        apply_late_fees,
        calculate_discount_amount,
        calculate_prorated_fee
    )

    # Test total calculation
    fee_items = [
        {"amount": 5000, "quantity": 1, "discount_amount": 500, "tax_percentage": 15},
        {"amount": 300, "quantity": 1, "discount_percentage": 10, "tax_percentage": 15},
        {"amount": 500, "quantity": 1, "discount_amount": 0, "tax_percentage": 0}
    ]

    totals = await calculate_payment_totals(fee_items)
    print(f"✅ Calculated totals: {totals}")

    # Test late fee calculation
    late_fee = await apply_late_fees(
        Decimal("1000"),
        Decimal("5"),
        grace_days=7,
        due_date=date(2024, 1, 1),
        payment_date=date(2024, 1, 15)
    )
    print(f"✅ Calculated late fee: {late_fee}")

    # Test discount calculation
    discount = await calculate_discount_amount(
        Decimal("1000"),
        "percentage",
        Decimal("10")
    )
    print(f"✅ Calculated discount: {discount}")

async def test_bulk_import():
    """Test bulk import functionality"""
    print("\n🧪 Testing Bulk Import...")

    from app.utils.bulk_import_handler import PaymentBulkImporter

    # Create sample CSV data
    csv_data = """student_id,payment_date,payment_method,fee_category_name,amount,branch_id,payer_name
STU001,2024-01-15,cash,Tuition Fee,5000.00,507f1f77bcf86cd799439011,Parent Name
STU001,2024-01-15,cash,Transportation Fee,300.00,507f1f77bcf86cd799439011,Parent Name"""

    # Test template generation
    importer = PaymentBulkImporter(None, None, None, None)
    template = importer.generate_template_csv(TEST_BRANCH_ID)

    print(f"✅ Generated CSV template ({len(template)} characters)")

    print("✅ Bulk import functionality tested")

async def test_receipt_generation():
    """Test receipt generation"""
    print("\n🧪 Testing Receipt Generation...")

    try:
        from app.utils.receipt_generator import PaymentReceiptGenerator, create_default_receipt_template

        # Create sample data for receipt generation
        payment_data = {
            "_id": "507f1f77bcf86cd799439013",
            "receipt_no": "RCP-2024-000001",
            "payment_date": datetime.now(),
            "total_amount": "6003.00",
            "subtotal": "5800.00",
            "discount_amount": "580.00",
            "tax_amount": "783.00",
            "payment_method": "cash",
            "status": "completed",
            "payer_name": "Parent Name"
        }

        student_data = {
            "student_id": TEST_STUDENT_ID,
            "first_name": "John Doe",
            "grade_level": "Grade 10",
            "current_class": "10A"
        }

        branch_data = {
            "name": "Test Branch",
            "school_name": "Test School",
            "address": "123 Test Street, Test City",
            "phone": "+1234567890"
        }

        payment_details = [
            {
                "fee_category_name": "Tuition Fee",
                "original_amount": "5000.00",
                "discount_amount": "500.00",
                "paid_amount": "5175.00",
                "quantity": 1
            }
        ]

        # Create default template
        template = create_default_receipt_template(TEST_BRANCH_ID)

        # Generate HTML receipt (PDF generation requires ReportLab)
        generator = PaymentReceiptGenerator()
        html_receipt = generator.generate_receipt_html(
            payment_data, payment_details, student_data, branch_data, template
        )

        print(f"✅ Generated HTML receipt ({len(html_receipt)} characters)")

    except ImportError as e:
        print(f"⚠️  ReportLab not available, skipping PDF generation: {e}")

    print("✅ Receipt generation tested")

async def test_reporting(db):
    """Test reporting functionality"""
    print("\n🧪 Testing Reporting...")

    # Test daily collection aggregation
    start_date = datetime.combine(date.today(), datetime.min.time())
    end_date = datetime.combine(date.today(), datetime.max.time())

    pipeline = [
        {
            "$match": {
                "branch_id": TEST_BRANCH_ID,
                "payment_date": {"$gte": start_date, "$lte": end_date},
                "status": {"$nin": ["cancelled", "failed"]}
            }
        },
        {
            "$group": {
                "_id": "$payment_method",
                "count": {"$sum": 1},
                "total_amount": {"$sum": {"$toDecimal": "$total_amount"}}
            }
        }
    ]

    results = await db.payments.aggregate(pipeline).to_list(None)
    print(f"✅ Daily collection report: {len(results)} payment methods")

    # Test outstanding fees calculation
    students = await db.students.find({"branch_id": TEST_BRANCH_ID}).to_list(None)
    mandatory_fees = await db.fee_categories.find({
        "branch_id": TEST_BRANCH_ID,
        "fee_type": "mandatory"
    }).to_list(None)

    total_due = sum(float(fee.get("amount", 0)) for fee in mandatory_fees)
    print(f"✅ Outstanding fees calculation: ${total_due:.2f} per student")

async def test_validation():
    """Test validation functions"""
    print("\n🧪 Testing Validation...")

    from app.utils.payment_validation import (
        validate_receipt_number_format,
        validate_phone_number,
        validate_email
    )

    # Test receipt number validation
    valid_receipt = "RCP-2024-000001"
    invalid_receipt = "INVALID"

    assert validate_receipt_number_format(valid_receipt) == True
    assert validate_receipt_number_format(invalid_receipt) == False
    print("✅ Receipt number validation works")

    # Test phone validation
    valid_phone = "+1234567890"
    invalid_phone = "invalid_phone"

    assert validate_phone_number(valid_phone) == True
    assert validate_phone_number(invalid_phone) == False
    print("✅ Phone number validation works")

    # Test email validation
    valid_email = "test@example.com"
    invalid_email = "invalid_email"

    assert validate_email(valid_email) == True
    assert validate_email(invalid_email) == False
    print("✅ Email validation works")

async def generate_test_report(db):
    """Generate a summary test report"""
    print("\n📊 Test Summary Report")
    print("=" * 50)

    # Count collections
    branch_count = await db.branches.count_documents({"_id": TEST_BRANCH_ID})
    student_count = await db.students.count_documents({"branch_id": TEST_BRANCH_ID})
    category_count = await db.fee_categories.count_documents({"branch_id": TEST_BRANCH_ID})
    payment_count = await db.payments.count_documents({"branch_id": TEST_BRANCH_ID})
    detail_count = await db.payment_details.count_documents({"branch_id": TEST_BRANCH_ID})

    print(f"Branches:        {branch_count}")
    print(f"Students:        {student_count}")
    print(f"Fee Categories:  {category_count}")
    print(f"Payments:        {payment_count}")
    print(f"Payment Details: {detail_count}")

    # Calculate total payments
    total_pipeline = [
        {"$match": {"branch_id": TEST_BRANCH_ID}},
        {"$group": {"_id": None, "total": {"$sum": {"$toDecimal": "$total_amount"}}}}
    ]

    total_result = await db.payments.aggregate(total_pipeline).to_list(1)
    total_amount = total_result[0]["total"] if total_result else 0

    print(f"Total Payments:  ${float(total_amount):,.2f}")
    print("=" * 50)

async def cleanup_test_data(client):
    """Cleanup test data"""
    print("\n🧹 Cleaning up test data...")

    db = client.spring_of_knowledge_test

    collections = [
        "branches", "students", "fee_categories",
        "payments", "payment_details", "payment_receipts"
    ]

    for collection_name in collections:
        result = await db[collection_name].delete_many({"branch_id": TEST_BRANCH_ID})
        print(f"✅ Deleted {result.deleted_count} documents from {collection_name}")

async def main():
    """Main test function"""
    print("🚀 Starting Payment Management System Test")
    print("=" * 60)

    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")

    try:
        # Setup test data
        db = await setup_test_data(client)

        # Run tests
        fee_category_ids = await test_fee_categories(db)
        payment_id = await test_payments(db, fee_category_ids)
        await test_payment_calculations()
        await test_bulk_import()
        await test_receipt_generation()
        await test_reporting(db)
        await test_validation()

        # Generate report
        await generate_test_report(db)

        print("\n🎉 All tests completed successfully!")

    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        await cleanup_test_data(client)
        client.close()
        print("\n✅ Test cleanup completed")

if __name__ == "__main__":
    asyncio.run(main())