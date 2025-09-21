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

def test_students_endpoints(token):
    """Test all student-related endpoints"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n🧪 Testing Student Management Endpoints")
    print("=" * 50)
    
    # 1. Test GET /students (list students)
    print("\n1. Testing GET /students")
    response = requests.get(f"{BASE_URL}/students", headers=headers)
    if response.status_code == 200:
        students = response.json()
        if isinstance(students, list):
            print(f"✅ GET /students successful - Found {len(students)} students")
            if students:
                print(f"   Sample student: {students[0].get('first_name', 'N/A')} ({students[0].get('student_id', 'N/A')})")
        else:
            print(f"✅ GET /students successful - Response: {type(students)}")
            print(f"   Data: {students}")
    else:
        print(f"❌ GET /students failed: {response.status_code} - {response.text}")
    
    # 2. Test GET /students with filters
    print("\n2. Testing GET /students with search")
    response = requests.get(f"{BASE_URL}/students?search=test", headers=headers)
    if response.status_code == 200:
        print(f"✅ Student search successful")
    else:
        print(f"❌ Student search failed: {response.status_code}")
    
    # 3. Test POST /students (create student)
    print("\n3. Testing POST /students (create)")
    test_student = {
        "student_id": f"TEST{datetime.now().strftime('%H%M%S')}",
        "first_name": f"Test Student {datetime.now().strftime('%H%M%S')}",
        "email": f"test{datetime.now().strftime('%H%M%S')}@test.com",
        "phone": "+1-555-0199",
        "date_of_birth": "2005-01-15",
        "gender": "male",
        "address": "123 Test St",
        "emergency_contact_name": "Test Parent",
        "emergency_contact_phone": "+1-555-0200",
        "grade_level": "Grade 10",
        "status": "Active"
    }
    
    response = requests.post(f"{BASE_URL}/students", headers=headers, json=test_student)
    created_student_id = None
    if response.status_code in [200, 201]:
        result = response.json()
        created_student_id = result.get('_id') or result.get('id')
        print(f"✅ Student creation successful - ID: {created_student_id}")
    else:
        print(f"❌ Student creation failed: {response.status_code} - {response.text}")
    
    # 4. Test GET /students/{id} (get specific student)
    if created_student_id:
        print(f"\n4. Testing GET /students/{created_student_id}")
        response = requests.get(f"{BASE_URL}/students/{created_student_id}", headers=headers)
        if response.status_code == 200:
            print(f"✅ Individual student fetch successful")
        else:
            print(f"❌ Individual student fetch failed: {response.status_code}")
    
    # 5. Test PUT /students/{id} (update student)
    if created_student_id:
        print(f"\n5. Testing PUT /students/{created_student_id}")
        update_data = {
            **test_student,
            "first_name": f"Updated Test Student {datetime.now().strftime('%H%M%S')}",
            "phone": "+1-555-0299"
        }
        response = requests.put(f"{BASE_URL}/students/{created_student_id}", headers=headers, json=update_data)
        if response.status_code == 200:
            print(f"✅ Student update successful")
        else:
            print(f"❌ Student update failed: {response.status_code} - {response.text}")
    
    # 6. Test student statistics
    print(f"\n6. Testing GET /students/stats")
    response = requests.get(f"{BASE_URL}/students/stats", headers=headers)
    if response.status_code == 200:
        stats = response.json()
        print(f"✅ Student statistics successful")
        print(f"   Total students: {stats.get('total_students', 'N/A')}")
        print(f"   Active students: {stats.get('active_students', 'N/A')}")
    else:
        print(f"❌ Student statistics failed: {response.status_code}")
    
    # 7. Test DELETE /students/{id} (cleanup)
    if created_student_id:
        print(f"\n7. Testing DELETE /students/{created_student_id}")
        response = requests.delete(f"{BASE_URL}/students/{created_student_id}", headers=headers)
        if response.status_code in [200, 204]:
            print(f"✅ Student deletion successful")
        else:
            print(f"❌ Student deletion failed: {response.status_code}")
    
    return True

def test_student_related_endpoints(token):
    """Test other student-related functionality"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n🧪 Testing Student-Related Endpoints")
    print("=" * 50)
    
    # Test grade levels
    print("\n1. Testing GET /grade-levels")
    response = requests.get(f"{BASE_URL}/grade-levels", headers=headers)
    if response.status_code == 200:
        print(f"✅ Grade levels fetch successful")
    else:
        print(f"❌ Grade levels failed: {response.status_code}")
    
    # Test classes
    print("\n2. Testing GET /classes")
    response = requests.get(f"{BASE_URL}/classes", headers=headers)
    if response.status_code == 200:
        print(f"✅ Classes fetch successful")
    else:
        print(f"❌ Classes failed: {response.status_code}")
    
    # Test student enrollments
    print("\n3. Testing GET /student-enrollments")
    response = requests.get(f"{BASE_URL}/student-enrollments", headers=headers)
    if response.status_code == 200:
        print(f"✅ Student enrollments fetch successful")
    else:
        print(f"❌ Student enrollments failed: {response.status_code}")

def main():
    print("🧪 Student Management Comprehensive Testing")
    print("=" * 60)
    
    # Login
    token = login_as_superadmin()
    if not token:
        print("❌ Cannot proceed without valid authentication")
        return
    
    # Test core student endpoints
    test_students_endpoints(token)
    
    # Test related endpoints
    test_student_related_endpoints(token)
    
    print(f"\n✅ Student Management testing completed!")
    print("You can now test the frontend interface at http://localhost:8080/students")

if __name__ == "__main__":
    main()