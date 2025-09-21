#!/usr/bin/env python3
"""
Payment Services Integration Test
Simple test to verify the payment services are properly integrated and working
"""
import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '.'))

def test_import_services():
    """Test that all payment services can be imported correctly"""
    print("🧪 Testing service imports...")

    try:
        from app.services.payment_service import PaymentService
        print("✅ PaymentService imported successfully")
    except Exception as e:
        print(f"❌ PaymentService import failed: {e}")
        return False

    try:
        from app.services.invoice_service import InvoiceService
        print("✅ InvoiceService imported successfully")
    except Exception as e:
        print(f"❌ InvoiceService import failed: {e}")
        return False

    try:
        from app.services.financial_analytics_service import FinancialAnalyticsService
        print("✅ FinancialAnalyticsService imported successfully")
    except Exception as e:
        print(f"❌ FinancialAnalyticsService import failed: {e}")
        return False

    return True

def test_model_imports():
    """Test that all payment models can be imported correctly"""
    print("\n🧪 Testing model imports...")

    try:
        from app.models.payment import (
            PaymentTransaction, PaymentTransactionCreate, PaymentTransactionUpdate,
            FeeTemplate, FeeTemplateCreate, FeeTemplateUpdate,
            Invoice, InvoiceCreate, InvoiceUpdate,
            PaymentSchedule, PaymentScheduleCreate, PaymentScheduleUpdate,
            Refund, RefundCreate, RefundUpdate,
            FinancialSummary, PaymentAnalytics,
            PaymentStatus, PaymentMethod, FeeType, Currency
        )
        print("✅ All payment models imported successfully")
        return True
    except Exception as e:
        print(f"❌ Payment models import failed: {e}")
        return False

def test_route_imports():
    """Test that payment routes can be imported correctly"""
    print("\n🧪 Testing route imports...")

    try:
        from app.routers.payments import router
        print("✅ Payment router imported successfully")
        print(f"✅ Router has {len(router.routes)} routes defined")

        # Print some route information
        route_names = []
        for route in router.routes[:5]:  # Show first 5 routes
            if hasattr(route, 'path'):
                route_names.append(f"{route.path}")

        if route_names:
            print(f"✅ Sample routes: {', '.join(route_names)}")

        return True
    except Exception as e:
        print(f"❌ Payment router import failed: {e}")
        return False

def test_service_instantiation():
    """Test that services can be instantiated with a mock database"""
    print("\n🧪 Testing service instantiation...")

    try:
        from app.services.payment_service import PaymentService
        from app.services.invoice_service import InvoiceService
        from app.services.financial_analytics_service import FinancialAnalyticsService

        # Create mock database object
        class MockDB:
            def __getattr__(self, name):
                return MockCollection()

        class MockCollection:
            def __getattr__(self, name):
                return lambda *args, **kwargs: None

        mock_db = MockDB()

        # Test service instantiation
        payment_service = PaymentService(mock_db)
        print("✅ PaymentService instantiated successfully")

        invoice_service = InvoiceService(mock_db)
        print("✅ InvoiceService instantiated successfully")

        analytics_service = FinancialAnalyticsService(mock_db)
        print("✅ FinancialAnalyticsService instantiated successfully")

        return True

    except Exception as e:
        print(f"❌ Service instantiation failed: {e}")
        return False

def check_server_running():
    """Check if the FastAPI server is running"""
    print("\n🧪 Checking server status...")

    try:
        import requests
        response = requests.get("http://localhost:8001/health", timeout=5)
        if response.status_code == 200:
            print("✅ FastAPI server is running and healthy")
            return True
        else:
            print(f"⚠️ Server responded with status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("⚠️ Server not accessible (connection refused)")
        return False
    except Exception as e:
        print(f"⚠️ Error checking server: {e}")
        return False

def main():
    """Run all integration tests"""
    print("🚀 Payment Services Integration Test")
    print("=" * 60)

    tests = [
        ("Service Imports", test_import_services),
        ("Model Imports", test_model_imports),
        ("Route Imports", test_route_imports),
        ("Service Instantiation", test_service_instantiation),
        ("Server Status", check_server_running)
    ]

    passed = 0
    failed = 0

    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            failed += 1

    # Print summary
    print("\n" + "=" * 60)
    print("📊 INTEGRATION TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📝 Total Tests: {passed + failed}")

    success_rate = (passed / (passed + failed) * 100) if (passed + failed) > 0 else 0
    print(f"\n🎯 Success Rate: {success_rate:.1f}%")

    if success_rate == 100:
        print("🎉 All integration tests passed! Payment services are properly integrated.")
    elif success_rate >= 80:
        print("✅ Payment services are mostly working with minor issues.")
    else:
        print("⚠️ Payment services have integration issues that need attention.")

if __name__ == "__main__":
    main()