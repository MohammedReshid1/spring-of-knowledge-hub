#!/usr/bin/env python3
"""
Test student data structure to understand field names and values
"""

import requests
import json

def test_student_data():
    """Test student data structure"""
    print("🔍 Testing Student Data Structure")
    print("=" * 40)
    
    # Login
    login_data = {
        "username": "superadmin@springofknowledge.com", 
        "password": "SuperAdmin123!"
    }
    
    response = requests.post("http://localhost:8000/users/login", data=login_data)
    token = response.json()['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get first few students
    response = requests.get("http://localhost:8000/students?limit=3", headers=headers)
    if response.status_code == 200:
        data = response.json()
        students = data.get('items', [])
        
        print(f"Sample student data ({len(students)} students):")
        for i, student in enumerate(students, 1):
            print(f"\nStudent {i}:")
            name_fields = ['first_name', 'father_name', 'grandfather_name', 'mother_name', 'last_name']
            for field in name_fields:
                value = student.get(field, 'NOT_FOUND')
                print(f"  {field}: '{value}'")
            
            print(f"  student_id: '{student.get('student_id', 'NOT_FOUND')}'")
            print(f"  grade_level: '{student.get('grade_level', 'NOT_FOUND')}'")
            print(f"  class_id: '{student.get('class_id', 'NOT_FOUND')}'")
            print(f"  status: '{student.get('status', 'NOT_FOUND')}'")
            print(f"  branch_id: '{student.get('branch_id', 'NOT_FOUND')}'")

if __name__ == "__main__":
    test_student_data()