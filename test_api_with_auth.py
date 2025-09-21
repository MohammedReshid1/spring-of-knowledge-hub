#!/usr/bin/env python3
"""
Test API with authentication to verify class population
"""
import requests
import json

def test_api_with_auth():
    base_url = "http://localhost:8000"
    
    # Step 1: Login to get token
    login_data = {
        "username": "admin@gmail.com",
        "password": "admin123"
    }
    
    try:
        print("🔐 Logging in...")
        login_response = requests.post(f"{base_url}/users/login", data=login_data)
        print(f"Login Status: {login_response.status_code}")
        
        if login_response.status_code != 200:
            print(f"Login failed: {login_response.text}")
            return
        
        token_data = login_response.json()
        access_token = token_data.get("access_token")
        print(f"✅ Login successful, got token: {access_token[:20]}...")
        
        # Step 2: Test students endpoint with authentication
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        print("\n📚 Testing students endpoint...")
        students_response = requests.get(f"{base_url}/students/all", headers=headers)
        print(f"Students Status: {students_response.status_code}")
        
        if students_response.status_code == 200:
            students = students_response.json()
            print(f"✅ Found {len(students)} students")
            
            # Check first few students for class information
            for i, student in enumerate(students[:3]):
                print(f"\n👤 Student {i+1}:")
                print(f"   Name: {student.get('first_name', 'N/A')} {student.get('father_name', 'N/A')}")
                print(f"   Student ID: {student.get('student_id', 'N/A')}")
                print(f"   Class ID: {student.get('class_id', 'None')}")
                print(f"   Classes object: {student.get('classes', 'None')}")
                
                if student.get('classes'):
                    print(f"   ✅ Class Name: {student['classes'].get('class_name', 'N/A')}")
                    print(f"   ✅ Academic Year: {student['classes'].get('academic_year', 'N/A')}")
                else:
                    print("   ❌ No class information populated")
        else:
            print(f"❌ Students request failed: {students_response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_api_with_auth() 