import pytest
import asyncio
from datetime import datetime, date, timedelta
from decimal import Decimal
from bson import ObjectId
from fastapi.testclient import TestClient
from motor.motor_asyncio import AsyncIOMotorClient
import json

# Import the main application and dependencies
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.main import app
from app.db import get_database
from app.models.payment import (
    Payment, PaymentCreate, PaymentUpdate, PaymentSummary
)
from app.models.payment_detail import (
    PaymentDetail, PaymentDetailCreate, FeeItemCreate, PaymentWithDetails
)

# Test fixtures and setup
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def db_client():
    """Database client fixture for testing"""
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.test_payment_db

    # Clear collections before each test
    await db.payments.delete_many({})
    await db.payment_details.delete_many({})
    await db.fee_categories.delete_many({})
    await db.branches.delete_many({})
    await db.students.delete_many({})

    yield db

    # Cleanup after test
    await db.payments.delete_many({})
    await db.payment_details.delete_many({})
    await db.fee_categories.delete_many({})
    await db.branches.delete_many({})
    await db.students.delete_many({})
    client.close()

@pytest.fixture
async def test_data(db_client):
    """Create test data for payment tests"""
    # Create test branch
    branch_doc = {
        "_id": ObjectId(),
        "name": "Test Branch",
        "code": "TB",
        "address": "123 Test Street",
        "active": True,
        "created_at": datetime.now()
    }
    await db_client.branches.insert_one(branch_doc)
    branch_id = str(branch_doc["_id"])

    # Create test student
    student_doc = {
        "_id": ObjectId(),
        "student_id": "STU001",
        "first_name": "John",
        "last_name": "Doe",
        "branch_id": branch_id,
        "grade_level": "Grade 10",
        "is_active": True,
        "created_at": datetime.now()
    }
    await db_client.students.insert_one(student_doc)
    student_id = str(student_doc["_id"])

    # Create test fee categories
    fee_categories = [
        {
            "_id": ObjectId(),
            "name": "Tuition Fee",
            "amount": 1000.00,
            "category": "academic",
            "tax_percentage": 10.0,
            "late_fee_percentage": 5.0,
            "late_fee_grace_days": 7,
            "branch_id": branch_id,
            "is_active": True
        },
        {
            "_id": ObjectId(),
            "name": "Activity Fee",
            "amount": 200.00,
            "category": "extracurricular",
            "tax_percentage": 0.0,
            "late_fee_percentage": 0.0,
            "branch_id": branch_id,
            "is_active": True
        }
    ]

    await db_client.fee_categories.insert_many(fee_categories)

    return {
        "branch_id": branch_id,
        "student_id": student_id,
        "fee_categories": [str(doc["_id"]) for doc in fee_categories]
    }

@pytest.fixture
def test_client():
    """FastAPI test client"""
    with TestClient(app) as client:
        yield client

@pytest.fixture
def mock_user():
    """Mock authenticated user for testing"""
    return {
        "id": "test-user-id",
        "username": "testuser",
        "role": "admin",
        "branch_id": None
    }

class TestPaymentEndpoints:
    """Test suite for payment API endpoints"""

    @pytest.mark.asyncio
    async def test_create_payment_success(self, test_client, test_data, db_client, mock_user):
        """Test successful payment creation"""
        # Mock authentication
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Prepare payment data
        fee_items = [
            {
                "fee_category_id": test_data["fee_categories"][0],
                "quantity": 1,
                "discount_percentage": None,
                "discount_amount": None,
                "remarks": "Tuition for Term 1"
            }
        ]

        payment_data = {
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "fee_items": fee_items,
            "payment_method": "cash",
            "payment_date": datetime.now().isoformat(),
            "payer_name": "John Doe Sr.",
            "payer_phone": "+1234567890",
            "payer_email": "john.doe.sr@email.com"
        }

        response = test_client.post("/api/payments/", json=payment_data)

        assert response.status_code == 201
        data = response.json()

        # Verify payment structure
        assert "payment" in data
        assert "details" in data
        assert "summary" in data

        payment = data["payment"]
        assert payment["student_id"] == test_data["student_id"]
        assert payment["branch_id"] == test_data["branch_id"]
        assert payment["payment_method"] == "cash"
        assert payment["status"] == "completed"

        # Verify payment details
        details = data["details"]
        assert len(details) == 1
        assert details[0]["fee_category_id"] == test_data["fee_categories"][0]

        # Verify summary
        summary = data["summary"]
        assert summary["total_items"] == 1
        assert len(summary["fee_categories"]) == 1

        # Clean up dependency override
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_create_payment_with_discount(self, test_client, test_data, mock_user):
        """Test payment creation with discount"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        fee_items = [
            {
                "fee_category_id": test_data["fee_categories"][0],
                "quantity": 1,
                "discount_percentage": 10.0,
                "discount_amount": None,
                "remarks": "Early bird discount"
            }
        ]

        payment_data = {
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "fee_items": fee_items,
            "payment_method": "card",
            "discount_percentage": 5.0,
            "discount_reason": "Sibling discount"
        }

        response = test_client.post("/api/payments/", json=payment_data)

        assert response.status_code == 201
        data = response.json()

        payment = data["payment"]
        assert float(payment["discount_percentage"]) == 5.0
        assert payment["discount_reason"] == "Sibling discount"

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_create_payment_invalid_student(self, test_client, test_data, mock_user):
        """Test payment creation with invalid student ID"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        fee_items = [
            {
                "fee_category_id": test_data["fee_categories"][0],
                "quantity": 1
            }
        ]

        payment_data = {
            "student_id": str(ObjectId()),  # Non-existent student
            "branch_id": test_data["branch_id"],
            "fee_items": fee_items,
            "payment_method": "cash"
        }

        response = test_client.post("/api/payments/", json=payment_data)

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_payments_with_filters(self, test_client, test_data, mock_user, db_client):
        """Test payment retrieval with various filters"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Create test payments
        payment_docs = [
            {
                "_id": ObjectId(),
                "receipt_no": "RCP001",
                "student_id": test_data["student_id"],
                "branch_id": test_data["branch_id"],
                "payment_date": datetime.now(),
                "subtotal": "1000.00",
                "discount_amount": "0.00",
                "tax_amount": "100.00",
                "late_fee_amount": "0.00",
                "total_amount": "1100.00",
                "payment_method": "cash",
                "status": "completed",
                "verification_status": "verified"
            },
            {
                "_id": ObjectId(),
                "receipt_no": "RCP002",
                "student_id": test_data["student_id"],
                "branch_id": test_data["branch_id"],
                "payment_date": datetime.now() - timedelta(days=1),
                "subtotal": "500.00",
                "discount_amount": "50.00",
                "tax_amount": "0.00",
                "late_fee_amount": "0.00",
                "total_amount": "450.00",
                "payment_method": "card",
                "status": "pending",
                "verification_status": "unverified"
            }
        ]

        await db_client.payments.insert_many(payment_docs)

        # Test basic retrieval
        response = test_client.get(f"/api/payments/?branch_id={test_data['branch_id']}")
        assert response.status_code == 200
        payments = response.json()
        assert len(payments) == 2

        # Test status filter
        response = test_client.get(
            f"/api/payments/?branch_id={test_data['branch_id']}&status=completed"
        )
        assert response.status_code == 200
        payments = response.json()
        assert len(payments) == 1
        assert payments[0]["status"] == "completed"

        # Test payment method filter
        response = test_client.get(
            f"/api/payments/?branch_id={test_data['branch_id']}&payment_method=card"
        )
        assert response.status_code == 200
        payments = response.json()
        assert len(payments) == 1
        assert payments[0]["payment_method"] == "card"

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_payment_by_id(self, test_client, test_data, mock_user, db_client):
        """Test retrieving a specific payment by ID"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Create test payment and details
        payment_id = ObjectId()
        payment_doc = {
            "_id": payment_id,
            "receipt_no": "RCP003",
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "payment_date": datetime.now(),
            "subtotal": "1000.00",
            "discount_amount": "100.00",
            "tax_amount": "90.00",
            "late_fee_amount": "0.00",
            "total_amount": "990.00",
            "payment_method": "bank_transfer",
            "status": "completed",
            "verification_status": "verified"
        }
        await db_client.payments.insert_one(payment_doc)

        detail_doc = {
            "_id": ObjectId(),
            "payment_id": str(payment_id),
            "fee_category_id": test_data["fee_categories"][0],
            "fee_category_name": "Tuition Fee",
            "original_amount": "1000.00",
            "discount_amount": "100.00",
            "tax_amount": "90.00",
            "late_fee_amount": "0.00",
            "paid_amount": "990.00",
            "quantity": 1,
            "unit_price": "1000.00",
            "branch_id": test_data["branch_id"]
        }
        await db_client.payment_details.insert_one(detail_doc)

        response = test_client.get(f"/api/payments/{payment_id}")
        assert response.status_code == 200

        data = response.json()
        assert "payment" in data
        assert "details" in data
        assert "summary" in data

        payment = data["payment"]
        assert payment["receipt_no"] == "RCP003"
        assert payment["payment_method"] == "bank_transfer"

        details = data["details"]
        assert len(details) == 1
        assert details[0]["fee_category_name"] == "Tuition Fee"

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_update_payment(self, test_client, test_data, mock_user, db_client):
        """Test payment update functionality"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Create test payment
        payment_id = ObjectId()
        payment_doc = {
            "_id": payment_id,
            "receipt_no": "RCP004",
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "payment_date": datetime.now(),
            "subtotal": "500.00",
            "discount_amount": "0.00",
            "tax_amount": "0.00",
            "late_fee_amount": "0.00",
            "total_amount": "500.00",
            "payment_method": "cash",
            "status": "pending",
            "verification_status": "unverified",
            "remarks": "Original remarks"
        }
        await db_client.payments.insert_one(payment_doc)

        # Update payment
        update_data = {
            "verification_status": "verified",
            "remarks": "Updated remarks",
            "bank_name": "Test Bank"
        }

        response = test_client.put(f"/api/payments/{payment_id}", json=update_data)
        assert response.status_code == 200

        updated_payment = response.json()
        assert updated_payment["verification_status"] == "verified"
        assert updated_payment["remarks"] == "Updated remarks"
        assert updated_payment["bank_name"] == "Test Bank"
        assert "verified_by" in updated_payment
        assert "verified_at" in updated_payment

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_cancel_payment(self, test_client, test_data, mock_user, db_client):
        """Test payment cancellation"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Create test payment
        payment_id = ObjectId()
        payment_doc = {
            "_id": payment_id,
            "receipt_no": "RCP005",
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "payment_date": datetime.now(),
            "subtotal": "300.00",
            "discount_amount": "0.00",
            "tax_amount": "0.00",
            "late_fee_amount": "0.00",
            "total_amount": "300.00",
            "payment_method": "card",
            "status": "pending",
            "verification_status": "unverified"
        }
        await db_client.payments.insert_one(payment_doc)

        # Cancel payment
        cancel_data = {
            "cancellation_reason": "Student requested cancellation"
        }

        response = test_client.post(
            f"/api/payments/{payment_id}/cancel",
            json=cancel_data
        )
        assert response.status_code == 200

        cancelled_payment = response.json()
        assert cancelled_payment["status"] == "cancelled"
        assert cancelled_payment["cancellation_reason"] == "Student requested cancellation"
        assert "cancelled_by" in cancelled_payment
        assert "cancelled_at" in cancelled_payment

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_refund_payment(self, test_client, test_data, mock_user, db_client):
        """Test payment refund functionality"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Create completed payment
        payment_id = ObjectId()
        payment_doc = {
            "_id": payment_id,
            "receipt_no": "RCP006",
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "payment_date": datetime.now(),
            "subtotal": "800.00",
            "discount_amount": "0.00",
            "tax_amount": "80.00",
            "late_fee_amount": "0.00",
            "total_amount": "880.00",
            "payment_method": "card",
            "status": "completed",
            "verification_status": "verified"
        }
        await db_client.payments.insert_one(payment_doc)

        # Process partial refund
        refund_data = {
            "refund_amount": 400.00,
            "refund_reference": "REF123456",
            "refund_reason": "Partial service not delivered"
        }

        response = test_client.post(
            f"/api/payments/{payment_id}/refund",
            json=refund_data
        )
        assert response.status_code == 200

        refunded_payment = response.json()
        assert refunded_payment["status"] == "partial_refund"
        assert float(refunded_payment["refund_amount"]) == 400.00
        assert refunded_payment["refund_reference"] == "REF123456"

        # Process full refund
        refund_data = {
            "refund_amount": 480.00,  # Remaining amount
            "refund_reason": "Full cancellation"
        }

        response = test_client.post(
            f"/api/payments/{payment_id}/refund",
            json=refund_data
        )
        assert response.status_code == 200

        fully_refunded_payment = response.json()
        assert fully_refunded_payment["status"] == "refunded"
        assert float(fully_refunded_payment["refund_amount"]) == 880.00

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_payment_summary(self, test_client, test_data, mock_user, db_client):
        """Test payment summary endpoint"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Create test payments
        payment_docs = [
            {
                "_id": ObjectId(),
                "receipt_no": "RCP007",
                "branch_id": test_data["branch_id"],
                "payment_date": datetime.now(),
                "subtotal": "1000.00",
                "discount_amount": "100.00",
                "tax_amount": "90.00",
                "late_fee_amount": "10.00",
                "total_amount": "1000.00",
                "payment_method": "cash",
                "status": "completed"
            },
            {
                "_id": ObjectId(),
                "receipt_no": "RCP008",
                "branch_id": test_data["branch_id"],
                "payment_date": datetime.now(),
                "subtotal": "500.00",
                "discount_amount": "0.00",
                "tax_amount": "50.00",
                "late_fee_amount": "0.00",
                "total_amount": "550.00",
                "payment_method": "card",
                "status": "pending"
            },
            {
                "_id": ObjectId(),
                "receipt_no": "RCP009",
                "branch_id": test_data["branch_id"],
                "payment_date": datetime.now(),
                "subtotal": "300.00",
                "discount_amount": "30.00",
                "tax_amount": "0.00",
                "late_fee_amount": "5.00",
                "total_amount": "275.00",
                "payment_method": "cash",
                "status": "cancelled"
            }
        ]

        await db_client.payments.insert_many(payment_docs)

        response = test_client.get(
            f"/api/payments/summary/branch?branch_id={test_data['branch_id']}"
        )
        assert response.status_code == 200

        summary = response.json()
        assert summary["total_payments"] == 2  # Cancelled payments excluded
        assert float(summary["total_amount"]) == 1550.00  # 1000 + 550
        assert float(summary["total_discount"]) == 100.00
        assert float(summary["total_tax"]) == 140.00  # 90 + 50
        assert float(summary["total_late_fees"]) == 10.00

        # Check payment method breakdown
        payment_methods = summary["payment_methods"]
        assert payment_methods["cash"] == 1
        assert payment_methods["card"] == 1

        # Check status breakdown
        status_breakdown = summary["status_breakdown"]
        assert status_breakdown["completed"] == 1
        assert status_breakdown["pending"] == 1

        app.dependency_overrides.clear()

class TestPaymentValidation:
    """Test suite for payment validation logic"""

    @pytest.mark.asyncio
    async def test_invalid_payment_amount(self, test_client, test_data, mock_user):
        """Test payment creation with invalid amounts"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        fee_items = [
            {
                "fee_category_id": test_data["fee_categories"][0],
                "quantity": -1,  # Invalid quantity
            }
        ]

        payment_data = {
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "fee_items": fee_items,
            "payment_method": "cash"
        }

        response = test_client.post("/api/payments/", json=payment_data)
        assert response.status_code == 422  # Validation error

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_excessive_discount(self, test_client, test_data, mock_user):
        """Test payment creation with excessive discount"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        fee_items = [
            {
                "fee_category_id": test_data["fee_categories"][0],
                "quantity": 1,
                "discount_percentage": 150.0,  # Invalid: > 100%
            }
        ]

        payment_data = {
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "fee_items": fee_items,
            "payment_method": "cash"
        }

        response = test_client.post("/api/payments/", json=payment_data)
        assert response.status_code == 422

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_invalid_payment_method(self, test_client, test_data, mock_user):
        """Test payment creation with invalid payment method"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        fee_items = [
            {
                "fee_category_id": test_data["fee_categories"][0],
                "quantity": 1
            }
        ]

        payment_data = {
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "fee_items": fee_items,
            "payment_method": "cryptocurrency"  # Invalid method
        }

        response = test_client.post("/api/payments/", json=payment_data)
        assert response.status_code == 422

        app.dependency_overrides.clear()

class TestPaymentCalculations:
    """Test suite for payment calculation logic"""

    @pytest.mark.asyncio
    async def test_tax_calculation(self, test_client, test_data, mock_user):
        """Test tax calculation in payments"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        fee_items = [
            {
                "fee_category_id": test_data["fee_categories"][0],  # Has 10% tax
                "quantity": 1
            }
        ]

        payment_data = {
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "fee_items": fee_items,
            "payment_method": "cash"
        }

        response = test_client.post("/api/payments/", json=payment_data)
        assert response.status_code == 201

        data = response.json()
        payment = data["payment"]

        # Base amount: 1000, Tax: 10% = 100, Total: 1100
        assert float(payment["subtotal"]) == 1000.00
        assert float(payment["tax_amount"]) == 100.00
        assert float(payment["total_amount"]) == 1100.00

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_discount_calculation(self, test_client, test_data, mock_user):
        """Test discount calculation in payments"""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        fee_items = [
            {
                "fee_category_id": test_data["fee_categories"][0],
                "quantity": 1,
                "discount_percentage": 20.0
            }
        ]

        payment_data = {
            "student_id": test_data["student_id"],
            "branch_id": test_data["branch_id"],
            "fee_items": fee_items,
            "payment_method": "cash"
        }

        response = test_client.post("/api/payments/", json=payment_data)
        assert response.status_code == 201

        data = response.json()
        details = data["details"]

        # Base: 1000, Discount: 20% = 200, After discount: 800, Tax: 10% of 800 = 80, Total: 880
        detail = details[0]
        assert float(detail["original_amount"]) == 1000.00
        assert float(detail["discount_amount"]) == 200.00
        assert float(detail["tax_amount"]) == 80.00
        assert float(detail["paid_amount"]) == 880.00

        app.dependency_overrides.clear()

# Import the get_current_user dependency for mocking
from app.utils.auth import get_current_user

if __name__ == "__main__":
    pytest.main([__file__, "-v"])