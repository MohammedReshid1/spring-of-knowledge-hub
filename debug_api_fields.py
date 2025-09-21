#!/usr/bin/env python3
"""
Debug API field requirements for data creation
"""

import requests
import json

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

def test_grade_level_creation(token, branch_id):
    """Test grade level creation with different data structures"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n🧪 Testing Grade Level Creation")
    print("=" * 40)
    
    # Test 1: Minimal data
    test_data = {
        "grade": "Test Grade 1",
        "branch_id": branch_id
    }
    
    response = requests.post(f"{BASE_URL}/grade-levels", headers=headers, json=test_data)
    print(f"Test 1 - Minimal data: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.text}")
    
    # Test 2: Full data structure  
    test_data = {
        "grade": "Test Grade 2",
        "description": "Test Grade Description",
        "min_age": 6,
        "max_age": 7,
        "max_capacity": 100,
        "current_enrollment": 0,
        "branch_id": branch_id
    }
    
    response = requests.post(f"{BASE_URL}/grade-levels", headers=headers, json=test_data)
    print(f"Test 2 - Full data: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.text}")

def test_teacher_creation(token, branch_id):
    """Test teacher creation with different data structures"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n🧪 Testing Teacher Creation")
    print("=" * 40)
    
    # Test 1: Minimal required fields
    test_data = {
        "employee_id": "TEST001",
        "first_name": "John",
        "last_name": "Doe",
        "branch_id": branch_id
    }
    
    response = requests.post(f"{BASE_URL}/teachers", headers=headers, json=test_data)
    print(f"Test 1 - Minimal data: {response.status_code}")
    if response.status_code not in [200, 201]:
        print(f"  Error: {response.text}")
    else:
        print(f"  Success: Teacher created")
        return response.json()
    
    return None

def test_subject_creation(token, branch_id):
    """Test subject creation"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n🧪 Testing Subject Creation")
    print("=" * 40)
    
    test_data = {
        "name": "Test Subject",
        "code": "TEST",
        "description": "Test Subject Description",
        "branch_id": branch_id
    }
    
    response = requests.post(f"{BASE_URL}/subjects", headers=headers, json=test_data)
    print(f"Subject creation: {response.status_code}")
    if response.status_code not in [200, 201]:
        print(f"  Error: {response.text}")
    else:
        print(f"  Success: Subject created")
        return response.json()
    
    return None

def test_class_creation(token, branch_id, grade_levels, teachers):
    """Test class creation"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n🧪 Testing Class Creation")
    print("=" * 40)
    
    if not grade_levels or not teachers:
        print("⚠️ Need grade levels and teachers for class creation")
        return None
    
    test_data = {
        "class_name": "Test Class A",
        "grade_level_id": grade_levels[0]['id'] if grade_levels else None,
        "teacher_id": teachers[0]['id'] if teachers else None,
        "max_capacity": 25,
        "academic_year": "2025",
        "branch_id": branch_id
    }
    
    response = requests.post(f"{BASE_URL}/classes", headers=headers, json=test_data)
    print(f"Class creation: {response.status_code}")
    if response.status_code not in [200, 201]:
        print(f"  Error: {response.text}")
    else:
        print(f"  Success: Class created")
        return response.json()
    
    return None

def main():
    print("🐛 API Field Requirements Debugging")
    print("=" * 50)
    
    token = login_as_superadmin()
    if not token:
        return
    
    # Get branch_id
    try:
        with open('branch_id.txt', 'r') as f:
            branch_id = f.read().strip()
    except:
        branch_id = "68b7231bb110092a69ae2acc"  # fallback
    
    print(f"Using branch_id: {branch_id}")
    
    # Test each endpoint
    grade_levels = test_grade_level_creation(token, branch_id)
    subjects = test_subject_creation(token, branch_id)  
    teachers = test_teacher_creation(token, branch_id)
    
    # Test class creation if we have prerequisites
    if grade_levels and teachers:
        test_class_creation(token, branch_id, [grade_levels], [teachers])

if __name__ == "__main__":
    main()