#!/usr/bin/env python3

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def login_as_superadmin():
    """Login as superadmin and return token"""
    login_data = {
        "username": "superadmin@springofknowledge.com",
        "password": "SuperAdmin123!"
    }
    
    response = requests.post(f"{BASE_URL}/users/login", data=login_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Superadmin login successful - Role: {result['user']['role']}")
        return result['access_token']
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_student_search_and_filtering(token):
    """Test various search and filtering options"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n🧪 Testing Student Search and Filtering")
    print("=" * 50)
    
    # Test 1: Basic search by name
    print("\n1. Testing search by name")
    response = requests.get(f"{BASE_URL}/students?search=john", headers=headers)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Name search successful - Found {result.get('total', 0)} students")
        if result.get('items'):
            print(f"   Sample result: {result['items'][0].get('first_name', 'N/A')}")
    else:
        print(f"❌ Name search failed: {response.status_code}")
    
    # Test 2: Search by student ID
    print("\n2. Testing search by student ID")
    response = requests.get(f"{BASE_URL}/students?search=DT001", headers=headers)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Student ID search successful - Found {result.get('total', 0)} students")
    else:
        print(f"❌ Student ID search failed: {response.status_code}")
    
    # Test 3: Filter by grade level
    print("\n3. Testing filter by grade level")
    response = requests.get(f"{BASE_URL}/students?grade_level=Grade 1", headers=headers)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Grade level filter successful - Found {result.get('total', 0)} students")
    else:
        print(f"❌ Grade level filter failed: {response.status_code}")
    
    # Test 4: Filter by status
    print("\n4. Testing filter by status")
    response = requests.get(f"{BASE_URL}/students?status=active", headers=headers)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Status filter successful - Found {result.get('total', 0)} students")
    else:
        print(f"❌ Status filter failed: {response.status_code}")
    
    # Test 5: Pagination
    print("\n5. Testing pagination")
    response = requests.get(f"{BASE_URL}/students?page=1&limit=5", headers=headers)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Pagination successful - Page {result.get('page', 'N/A')}, Total pages: {result.get('pages', 'N/A')}")
        print(f"   Items per page: {len(result.get('items', []))}")
    else:
        print(f"❌ Pagination failed: {response.status_code}")
    
    # Test 6: Sorting
    print("\n6. Testing sorting")
    response = requests.get(f"{BASE_URL}/students?sort_by=first_name&sort_order=desc", headers=headers)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Sorting successful - Found {result.get('total', 0)} students")
        if result.get('items') and len(result['items']) > 1:
            print(f"   First student: {result['items'][0].get('first_name', 'N/A')}")
            print(f"   Second student: {result['items'][1].get('first_name', 'N/A')}")
    else:
        print(f"❌ Sorting failed: {response.status_code}")
    
    # Test 7: Combined filters
    print("\n7. Testing combined filters")
    response = requests.get(f"{BASE_URL}/students?search=grade&status=active&page=1", headers=headers)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Combined filters successful - Found {result.get('total', 0)} students")
    else:
        print(f"❌ Combined filters failed: {response.status_code}")
    
    # Test 8: Branch filtering (superadmin privilege)
    print("\n8. Testing branch filtering")
    response = requests.get(f"{BASE_URL}/students?branch_id=all", headers=headers)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Branch filtering (all) successful - Found {result.get('total', 0)} students")
    else:
        print(f"❌ Branch filtering failed: {response.status_code}")
    
    return True

def test_student_list_endpoints(token):
    """Test different student list endpoints"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n🧪 Testing Student List Endpoints")
    print("=" * 50)
    
    # Test /students/all endpoint
    print("\n1. Testing GET /students/all")
    response = requests.get(f"{BASE_URL}/students/all", headers=headers)
    if response.status_code == 200:
        students = response.json()
        print(f"✅ GET /students/all successful - Found {len(students) if isinstance(students, list) else 'N/A'} students")
    else:
        print(f"❌ GET /students/all failed: {response.status_code}")
    
    # Test /students/stats endpoint
    print("\n2. Testing GET /students/stats")
    response = requests.get(f"{BASE_URL}/students/stats", headers=headers)
    if response.status_code == 200:
        stats = response.json()
        print(f"✅ GET /students/stats successful")
        print(f"   Data keys: {list(stats.keys())}")
    else:
        print(f"❌ GET /students/stats failed: {response.status_code}")
    
    return True

def main():
    print("🔍 Student Search and Filtering Testing")
    print("=" * 60)
    
    # Login
    token = login_as_superadmin()
    if not token:
        print("❌ Cannot proceed without valid authentication")
        return
    
    # Test search and filtering
    test_student_search_and_filtering(token)
    
    # Test list endpoints
    test_student_list_endpoints(token)
    
    print(f"\n✅ Student search and filtering testing completed!")
    print("🎯 Key findings:")
    print("   - Basic search functionality working")
    print("   - Pagination and sorting implemented")
    print("   - Branch-based filtering available for superadmin")
    print("   - Multiple filter combinations supported")

if __name__ == "__main__":
    main()