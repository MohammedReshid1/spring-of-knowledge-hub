#!/usr/bin/env python3
"""
Test script to verify Library, Discipline, and Inventory module integration
"""
import requests
import json
import sys
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

# Test credentials (using email as username for OAuth2PasswordRequestForm)
TEST_USER = {
    "username": "admin@springofknowledge.com",  # OAuth2 form expects "username" field, but API checks email
    "password": "admin123"
}

def login():
    """Login and get authentication token"""
    try:
        # Try to login (using form data as expected by the API)
        response = requests.post(
            f"{BASE_URL}/users/login",
            data=TEST_USER
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return None

def test_library_endpoints(token):
    """Test library management endpoints"""
    print("\n📚 Testing Library Management...")
    headers = {"Authorization": f"Bearer {token}"}
    
    tests_passed = 0
    tests_failed = 0
    
    # Test 1: Get books
    try:
        response = requests.get(f"{BASE_URL}/library/books", headers=headers)
        if response.status_code == 200:
            print("✅ GET /library/books - OK")
            tests_passed += 1
        else:
            print(f"❌ GET /library/books - Failed ({response.status_code})")
            tests_failed += 1
    except Exception as e:
        print(f"❌ GET /library/books - Error: {e}")
        tests_failed += 1
    
    # Test 2: Create a book
    try:
        book_data = {
            "title": "Test Book",
            "author": "Test Author",
            "isbn": "978-0-123456-78-9",
            "category": "textbook",  # Use valid enum value
            "total_copies": 5,
            "available_copies": 5,
            "location": "Shelf A1"
        }
        response = requests.post(f"{BASE_URL}/library/books", headers=headers, json=book_data)
        if response.status_code in [200, 201]:
            print("✅ POST /library/books - OK")
            tests_passed += 1
            book_id = response.json().get("id")
        else:
            print(f"❌ POST /library/books - Failed ({response.status_code}): {response.text}")
            tests_failed += 1
            book_id = None
    except Exception as e:
        print(f"❌ POST /library/books - Error: {e}")
        tests_failed += 1
        book_id = None
    
    # Test 3: Get borrow records
    try:
        response = requests.get(f"{BASE_URL}/library/borrow-records", headers=headers)
        if response.status_code == 200:
            print("✅ GET /library/borrow-records - OK")
            tests_passed += 1
        else:
            print(f"❌ GET /library/borrow-records - Failed ({response.status_code})")
            tests_failed += 1
    except Exception as e:
        print(f"❌ GET /library/borrow-records - Error: {e}")
        tests_failed += 1
    
    # Test 4: Get digital resources
    try:
        response = requests.get(f"{BASE_URL}/library/digital-resources", headers=headers)
        if response.status_code == 200:
            print("✅ GET /library/digital-resources - OK")
            tests_passed += 1
        else:
            print(f"❌ GET /library/digital-resources - Failed ({response.status_code})")
            tests_failed += 1
    except Exception as e:
        print(f"❌ GET /library/digital-resources - Error: {e}")
        tests_failed += 1
    
    print(f"\nLibrary Tests: {tests_passed} passed, {tests_failed} failed")
    return tests_passed, tests_failed

def test_discipline_endpoints(token):
    """Test discipline management endpoints"""
    print("\n🛡️ Testing Discipline Management...")
    headers = {"Authorization": f"Bearer {token}"}
    
    tests_passed = 0
    tests_failed = 0
    
    # Test 1: Get incidents
    try:
        response = requests.get(f"{BASE_URL}/discipline/incidents", headers=headers)
        if response.status_code == 200:
            print("✅ GET /discipline/incidents - OK")
            tests_passed += 1
        else:
            print(f"❌ GET /discipline/incidents - Failed ({response.status_code})")
            tests_failed += 1
    except Exception as e:
        print(f"❌ GET /discipline/incidents - Error: {e}")
        tests_failed += 1
    
    # Test 2: Create an incident
    try:
        incident_data = {
            "student_id": "TEST001",
            "title": "Test Incident",  # Add required title field
            "incident_type": "behavioral",  # Use proper enum value
            "description": "Test incident",
            "location": "Classroom",  # Add required location field
            "incident_date": datetime.now().date().isoformat(),  # Use date format
            "severity": "low",
            "action_taken": "Warning issued",
            "reported_by": "Test Teacher"
        }
        response = requests.post(f"{BASE_URL}/discipline/incidents", headers=headers, json=incident_data)
        if response.status_code in [200, 201]:
            print("✅ POST /discipline/incidents - OK")
            tests_passed += 1
        else:
            print(f"❌ POST /discipline/incidents - Failed ({response.status_code}): {response.text}")
            tests_failed += 1
    except Exception as e:
        print(f"❌ POST /discipline/incidents - Error: {e}")
        tests_failed += 1
    
    # Test 3: Get behavior points
    try:
        response = requests.get(f"{BASE_URL}/discipline/behavior-points", headers=headers)
        if response.status_code == 200:
            print("✅ GET /discipline/behavior-points - OK")
            tests_passed += 1
        else:
            print(f"❌ GET /discipline/behavior-points - Failed ({response.status_code})")
            tests_failed += 1
    except Exception as e:
        print(f"❌ GET /discipline/behavior-points - Error: {e}")
        tests_failed += 1
    
    # Test 4: Get rewards
    try:
        response = requests.get(f"{BASE_URL}/discipline/rewards", headers=headers)
        if response.status_code == 200:
            print("✅ GET /discipline/rewards - OK")
            tests_passed += 1
        else:
            print(f"❌ GET /discipline/rewards - Failed ({response.status_code})")
            tests_failed += 1
    except Exception as e:
        print(f"❌ GET /discipline/rewards - Error: {e}")
        tests_failed += 1
    
    print(f"\nDiscipline Tests: {tests_passed} passed, {tests_failed} failed")
    return tests_passed, tests_failed

def test_inventory_endpoints(token):
    """Test inventory management endpoints"""
    print("\n📦 Testing Inventory Management...")
    headers = {"Authorization": f"Bearer {token}"}
    
    tests_passed = 0
    tests_failed = 0
    
    # Test 1: Get assets
    try:
        response = requests.get(f"{BASE_URL}/inventory/assets", headers=headers)
        if response.status_code == 200:
            print("✅ GET /inventory/assets - OK")
            tests_passed += 1
        else:
            print(f"❌ GET /inventory/assets - Failed ({response.status_code})")
            tests_failed += 1
    except Exception as e:
        print(f"❌ GET /inventory/assets - Error: {e}")
        tests_failed += 1
    
    # Test 2: Create an asset
    try:
        asset_data = {
            "asset_code": "TEST001",  # Add required asset_code
            "name": "Test Asset",
            "category": "electronics",  # Use valid enum value
            "quantity": 10,
            "unit": "pieces",
            "location": "Storage Room A",
            "condition": "good",  # Use lowercase enum value
            "purchase_date": datetime.now().date().isoformat(),  # Use date format
            "purchase_cost": 1000.00,
            "created_by": "admin"  # Add required created_by field
        }
        response = requests.post(f"{BASE_URL}/inventory/assets", headers=headers, json=asset_data)
        if response.status_code in [200, 201]:
            print("✅ POST /inventory/assets - OK")
            tests_passed += 1
        else:
            print(f"❌ POST /inventory/assets - Failed ({response.status_code}): {response.text}")
            tests_failed += 1
    except Exception as e:
        print(f"❌ POST /inventory/assets - Error: {e}")
        tests_failed += 1
    
    # Test 3: Get supplies
    try:
        response = requests.get(f"{BASE_URL}/inventory/supplies", headers=headers)
        if response.status_code == 200:
            print("✅ GET /inventory/supplies - OK")
            tests_passed += 1
        else:
            print(f"❌ GET /inventory/supplies - Failed ({response.status_code})")
            tests_failed += 1
    except Exception as e:
        print(f"❌ GET /inventory/supplies - Error: {e}")
        tests_failed += 1
    
    # Test 4: Get maintenance records
    try:
        response = requests.get(f"{BASE_URL}/inventory/maintenance", headers=headers)
        if response.status_code == 200:
            print("✅ GET /inventory/maintenance - OK")
            tests_passed += 1
        else:
            print(f"❌ GET /inventory/maintenance - Failed ({response.status_code})")
            tests_failed += 1
    except Exception as e:
        print(f"❌ GET /inventory/maintenance - Error: {e}")
        tests_failed += 1
    
    print(f"\nInventory Tests: {tests_passed} passed, {tests_failed} failed")
    return tests_passed, tests_failed

def main():
    """Main test runner"""
    print("=" * 60)
    print("🧪 Testing School Management System Module Integration")
    print("=" * 60)
    
    # Login first
    print("\n🔐 Authenticating...")
    token = login()
    
    if not token:
        print("\n❌ Failed to authenticate. Cannot proceed with tests.")
        print("\nPlease ensure:")
        print("1. Backend server is running on http://localhost:8000")
        print("2. Admin user exists with username: 'admin' and password: 'admin123'")
        sys.exit(1)
    
    print("✅ Authentication successful!")
    
    # Run tests for each module
    total_passed = 0
    total_failed = 0
    
    # Test Library Management
    passed, failed = test_library_endpoints(token)
    total_passed += passed
    total_failed += failed
    
    # Test Discipline Management
    passed, failed = test_discipline_endpoints(token)
    total_passed += passed
    total_failed += failed
    
    # Test Inventory Management
    passed, failed = test_inventory_endpoints(token)
    total_passed += passed
    total_failed += failed
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Total Passed: {total_passed}")
    print(f"❌ Total Failed: {total_failed}")
    
    if total_failed == 0:
        print("\n🎉 All tests passed! Modules are properly integrated.")
    else:
        print(f"\n⚠️ {total_failed} tests failed. Please review the errors above.")
    
    return 0 if total_failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())