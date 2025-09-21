#!/usr/bin/env python3
"""
Focus on testing the validation fixes without student dependency
"""
import requests
import json
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:8000"
PAYMENTS_URL = f"{BASE_URL}/payments"

# Test the core validation issues without student lookup
test_payment_data = {
    "student_id": "507f1f77bcf86cd799439011",  # Valid ObjectId format but non-existent
    "amount": 100.0,
    "currency": "USD",
    "payment_method": "cash",
    "payment_date": datetime.now().isoformat(),
    "status": "completed"  # Key issue: should be mapped to "paid"
    # Missing: transaction_id, collected_by, branch_id (key issues)
}

def test_validation_fixes():
    """Test that all validation issues are properly fixed"""
    print("🧪 Testing validation auto-fixes...")

    try:
        response = requests.post(
            f"{PAYMENTS_URL}/transactions/validate",
            json=test_payment_data,
            params={"branch_id": "507f1f77bcf86cd799439012"}  # Valid ObjectId format
        )

        print(f"📡 Status Code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print("✅ Validation endpoint working!")

            auto_fixes = result.get('auto_fixes', [])
            corrected_data = result.get('corrected_data', {})
            errors = result.get('errors', [])

            print(f"\n📋 Auto-fixes applied ({len(auto_fixes)}):")
            for fix in auto_fixes:
                print(f"  ✓ {fix}")

            print(f"\n🔍 Validation Results:")
            print(f"  transaction_id: {'✓ Generated' if corrected_data.get('transaction_id') else '❌ Missing'}")
            print(f"  status: {'✓ ' + corrected_data.get('status', 'N/A') if corrected_data.get('status') == 'paid' else '❌ Not fixed'}")
            print(f"  collected_by: {'✓ Populated' if corrected_data.get('collected_by') else '❌ Missing'}")
            print(f"  branch_id: {'✓ Set' if corrected_data.get('branch_id') else '❌ Missing'}")

            # Check if all critical issues are resolved
            expected_fixes = [
                "Generated transaction_id",
                "Mapped 'completed' status to 'paid'",
                "Auto-populated collected_by from current user",
                "Set branch_id from context"
            ]

            all_fixes_applied = all(fix in auto_fixes for fix in expected_fixes)

            if all_fixes_applied:
                print("\n🎉 ALL VALIDATION ISSUES FIXED!")
                return True
            else:
                missing_fixes = [fix for fix in expected_fixes if fix not in auto_fixes]
                print(f"\n❌ Missing fixes: {missing_fixes}")
                return False

        else:
            print(f"❌ Validation failed: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error during validation: {e}")
        return False

def test_payment_model_validation():
    """Test that the PaymentTransactionCreateDev model accepts the problematic data"""
    print("\n🧪 Testing model validation directly...")

    try:
        response = requests.post(
            f"{PAYMENTS_URL}/transactions",
            json=test_payment_data,
            params={"branch_id": "507f1f77bcf86cd799439012"}
        )

        print(f"📡 Status Code: {response.status_code}")

        if response.status_code in [200, 400]:
            # 200 = success, 400 = business logic error (acceptable)
            if response.status_code == 200:
                result = response.json()
                print("✅ Payment model accepts the data and processes successfully!")
                print(f"💳 Transaction ID: {result.get('transaction_id', 'N/A')}")
                print(f"📊 Status: {result.get('status', 'N/A')}")
                return True
            else:
                # Check if it's a business logic error, not validation error
                error_detail = response.json().get('detail', '')
                if 'not found' in error_detail.lower() or 'invalid' in error_detail.lower():
                    print("✅ Payment model accepts the data (business logic error expected)")
                    return True
                else:
                    print(f"❌ Unexpected business error: {error_detail}")
                    return False
        elif response.status_code == 422:
            error_detail = response.json().get('detail', [])
            print(f"❌ Model validation still failing: {error_detail}")
            return False
        else:
            print(f"❌ Unexpected error: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error during model test: {e}")
        return False

def main():
    """Run focused validation tests"""
    print("🚀 Testing Payment Validation Fixes")
    print("=" * 45)

    # Test 1: Validation endpoint fixes
    validation_success = test_validation_fixes()

    # Test 2: Model validation
    model_success = test_payment_model_validation()

    print("\n" + "=" * 45)
    if validation_success and model_success:
        print("🎉 ALL VALIDATION ISSUES SUCCESSFULLY FIXED!")
        print("\n✅ Summary of fixes:")
        print("  • transaction_id auto-generation")
        print("  • 'completed' → 'paid' status mapping")
        print("  • collected_by auto-population")
        print("  • branch_id handling")
    else:
        print("❌ Some validation issues remain:")
        if not validation_success:
            print("  • Validation endpoint issues")
        if not model_success:
            print("  • Model validation issues")

if __name__ == "__main__":
    main()