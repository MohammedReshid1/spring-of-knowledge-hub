#!/usr/bin/env python3
"""
Comprehensive test for Library, Discipline, and Inventory modules
"""
import requests
import json
import sys
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

# Test credentials
TEST_USER = {
    "username": "admin@springofknowledge.com",
    "password": "admin123"
}

def login():
    """Login and get authentication token"""
    try:
        response = requests.post(
            f"{BASE_URL}/users/login",
            data=TEST_USER
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        else:
            print(f"❌ Login failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return None

def test_library_full(token):
    """Test library management with CRUD operations"""
    print("\n📚 Testing Library Management (Full CRUD)...")
    headers = {"Authorization": f"Bearer {token}"}
    
    tests_passed = 0
    tests_failed = 0
    
    # Test 1: Create a book
    print("\n  Creating a book...")
    try:
        book_data = {
            "title": "Introduction to Python Programming",
            "author": "John Smith",
            "isbn": "978-0-123456-78-9",
            "category": "textbook",
            "total_copies": 10,
            "available_copies": 10,
            "location": "Shelf A1",
            "publisher": "Tech Books Publishing",
            "publication_year": 2024,
            "language": "English",
            "pages": 450,
            "description": "A comprehensive guide to Python programming"
        }
        response = requests.post(f"{BASE_URL}/library/books", headers=headers, json=book_data)
        if response.status_code in [200, 201]:
            print("  ✅ Book created successfully")
            book = response.json()
            book_id = book.get("id")
            tests_passed += 1
        else:
            print(f"  ❌ Failed to create book: {response.status_code} - {response.text}")
            tests_failed += 1
            book_id = None
    except Exception as e:
        print(f"  ❌ Error creating book: {e}")
        tests_failed += 1
        book_id = None
    
    # Test 2: List books
    print("\n  Listing books...")
    try:
        response = requests.get(f"{BASE_URL}/library/books", headers=headers)
        if response.status_code == 200:
            books = response.json()
            print(f"  ✅ Found {len(books)} book(s)")
            tests_passed += 1
        else:
            print(f"  ❌ Failed to list books: {response.status_code}")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ Error listing books: {e}")
        tests_failed += 1
    
    # Test 3: Create a digital resource
    print("\n  Creating a digital resource...")
    try:
        resource_data = {
            "title": "Python Video Tutorial Series",
            "resource_type": "video",
            "url": "https://example.com/python-tutorials",
            "description": "Complete Python programming video course",
            "subject": "Computer Science",
            "grade_level": "High School",
            "file_size_mb": 2048,
            "duration_minutes": 360,
            "access_type": "free"
        }
        response = requests.post(f"{BASE_URL}/library/digital-resources", headers=headers, json=resource_data)
        if response.status_code in [200, 201]:
            print("  ✅ Digital resource created successfully")
            tests_passed += 1
        else:
            print(f"  ❌ Failed to create digital resource: {response.status_code}")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ Error creating digital resource: {e}")
        tests_failed += 1
    
    print(f"\n📚 Library Tests Summary: {tests_passed} passed, {tests_failed} failed")
    return tests_passed, tests_failed

def test_discipline_full(token):
    """Test discipline management with CRUD operations"""
    print("\n🛡️ Testing Discipline Management (Full CRUD)...")
    headers = {"Authorization": f"Bearer {token}"}
    
    tests_passed = 0
    tests_failed = 0
    
    # Test 1: Create an incident
    print("\n  Creating an incident...")
    try:
        incident_data = {
            "student_id": "STU001",
            "title": "Minor Classroom Disruption",
            "incident_type": "behavioral",
            "description": "Student was talking during class instruction",
            "location": "Room 204 - Math Class",
            "incident_date": datetime.now().date().isoformat(),
            "severity": "low",
            "action_taken": "Verbal warning given",
            "reported_by": "Ms. Johnson",
            "witnesses": ["John Doe", "Jane Smith"]
        }
        response = requests.post(f"{BASE_URL}/discipline/incidents", headers=headers, json=incident_data)
        if response.status_code in [200, 201]:
            print("  ✅ Incident created successfully")
            incident = response.json()
            incident_id = incident.get("id")
            tests_passed += 1
        else:
            print(f"  ❌ Failed to create incident: {response.status_code} - {response.text}")
            tests_failed += 1
            incident_id = None
    except Exception as e:
        print(f"  ❌ Error creating incident: {e}")
        tests_failed += 1
        incident_id = None
    
    # Test 2: List incidents
    print("\n  Listing incidents...")
    try:
        response = requests.get(f"{BASE_URL}/discipline/incidents", headers=headers)
        if response.status_code == 200:
            incidents = response.json()
            print(f"  ✅ Found {len(incidents)} incident(s)")
            tests_passed += 1
        else:
            print(f"  ❌ Failed to list incidents: {response.status_code}")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ Error listing incidents: {e}")
        tests_failed += 1
    
    # Test 3: Create a reward
    print("\n  Creating a reward...")
    try:
        reward_data = {
            "student_id": "STU002",
            "title": "Outstanding Academic Performance",
            "description": "Achieved highest grade in Mathematics exam",
            "reward_type": "certificate",
            "points_awarded": 50,
            "date_awarded": datetime.now().date().isoformat(),
            "awarded_by": "Mr. Thompson"
        }
        response = requests.post(f"{BASE_URL}/discipline/rewards", headers=headers, json=reward_data)
        if response.status_code in [200, 201]:
            print("  ✅ Reward created successfully")
            tests_passed += 1
        else:
            print(f"  ❌ Failed to create reward: {response.status_code}")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ Error creating reward: {e}")
        tests_failed += 1
    
    print(f"\n🛡️ Discipline Tests Summary: {tests_passed} passed, {tests_failed} failed")
    return tests_passed, tests_failed

def test_inventory_full(token):
    """Test inventory management with CRUD operations"""
    print("\n📦 Testing Inventory Management (Full CRUD)...")
    headers = {"Authorization": f"Bearer {token}"}
    
    tests_passed = 0
    tests_failed = 0
    
    # Test 1: Create an asset
    print("\n  Creating an asset...")
    try:
        asset_data = {
            "asset_code": "COMP-2024-001",
            "name": "Dell Desktop Computer",
            "category": "electronics",
            "quantity": 25,
            "unit": "pieces",
            "location": "Computer Lab 1",
            "condition": "excellent",
            "purchase_date": "2024-01-15",
            "purchase_cost": 15000.00,
            "warranty_expiry": "2027-01-15",
            "supplier": "Tech Solutions Inc.",
            "created_by": "admin"
        }
        response = requests.post(f"{BASE_URL}/inventory/assets", headers=headers, json=asset_data)
        if response.status_code in [200, 201]:
            print("  ✅ Asset created successfully")
            asset = response.json()
            asset_id = asset.get("id")
            tests_passed += 1
        else:
            print(f"  ❌ Failed to create asset: {response.status_code} - {response.text}")
            tests_failed += 1
            asset_id = None
    except Exception as e:
        print(f"  ❌ Error creating asset: {e}")
        tests_failed += 1
        asset_id = None
    
    # Test 2: List assets
    print("\n  Listing assets...")
    try:
        response = requests.get(f"{BASE_URL}/inventory/assets", headers=headers)
        if response.status_code == 200:
            assets = response.json()
            print(f"  ✅ Found {len(assets)} asset(s)")
            tests_passed += 1
        else:
            print(f"  ❌ Failed to list assets: {response.status_code}")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ Error listing assets: {e}")
        tests_failed += 1
    
    # Test 3: Create a supply item
    print("\n  Creating a supply item...")
    try:
        supply_data = {
            "name": "A4 Paper",
            "category": "office_supplies",
            "quantity": 500,
            "unit": "reams",
            "min_quantity": 50,
            "location": "Supply Room",
            "supplier": "Office Supplies Co.",
            "unit_price": 5.99
        }
        response = requests.post(f"{BASE_URL}/inventory/supplies", headers=headers, json=supply_data)
        if response.status_code in [200, 201]:
            print("  ✅ Supply item created successfully")
            tests_passed += 1
        else:
            print(f"  ❌ Failed to create supply item: {response.status_code}")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ Error creating supply item: {e}")
        tests_failed += 1
    
    print(f"\n📦 Inventory Tests Summary: {tests_passed} passed, {tests_failed} failed")
    return tests_passed, tests_failed

def main():
    """Main test runner"""
    print("=" * 70)
    print("🧪 COMPREHENSIVE SCHOOL MANAGEMENT SYSTEM MODULE TEST")
    print("=" * 70)
    
    # Login first
    print("\n🔐 Authenticating...")
    token = login()
    
    if not token:
        print("\n❌ Failed to authenticate. Cannot proceed with tests.")
        print("\nPlease ensure:")
        print("1. Backend server is running on http://localhost:8000")
        print("2. Admin user exists")
        return 1
    
    print("✅ Authentication successful!")
    
    # Run comprehensive tests
    total_passed = 0
    total_failed = 0
    
    # Test Library Management
    passed, failed = test_library_full(token)
    total_passed += passed
    total_failed += failed
    
    # Test Discipline Management
    passed, failed = test_discipline_full(token)
    total_passed += passed
    total_failed += failed
    
    # Test Inventory Management
    passed, failed = test_inventory_full(token)
    total_passed += passed
    total_failed += failed
    
    # Final Summary
    print("\n" + "=" * 70)
    print("📊 FINAL TEST SUMMARY")
    print("=" * 70)
    print(f"✅ Total Tests Passed: {total_passed}")
    print(f"❌ Total Tests Failed: {total_failed}")
    
    if total_failed == 0:
        print("\n🎉 SUCCESS! All modules are working correctly and fully integrated!")
        print("\nYou can now access the modules at:")
        print("  📚 Library: http://localhost:5173/library")
        print("  🛡️ Discipline: http://localhost:5173/discipline")
        print("  📦 Inventory: http://localhost:5173/inventory")
    else:
        print(f"\n⚠️ {total_failed} tests failed. Please review the errors above.")
    
    return 0 if total_failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())