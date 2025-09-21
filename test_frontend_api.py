#!/usr/bin/env python3
"""
Test API endpoints that frontend uses to identify pagination issues
"""

import requests
import json

def test_students_endpoint():
    """Test students endpoint pagination"""
    print("🔍 Testing Students API Endpoints")
    print("=" * 40)
    
    # Login first
    login_data = {
        "username": "superadmin@springofknowledge.com", 
        "password": "SuperAdmin123!"
    }
    
    response = requests.post("http://localhost:8000/users/login", data=login_data)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return
    
    token = response.json()['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test different pagination scenarios
    test_cases = [
        ("Default (no params)", "http://localhost:8000/students"),
        ("Page 1, Limit 10", "http://localhost:8000/students?page=1&limit=10"),
        ("Page 1, Limit 50", "http://localhost:8000/students?page=1&limit=50"),
        ("All students", "http://localhost:8000/students/all"),
    ]
    
    for name, url in test_cases:
        print(f"\n📊 {name}:")
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'items' in data:
                print(f"   Items returned: {len(data['items'])}")
                print(f"   Total available: {data.get('total', 'N/A')}")
                print(f"   Page: {data.get('page', 'N/A')}")
                print(f"   Pages: {data.get('pages', 'N/A')}")
                print(f"   Limit: {data.get('limit', 'N/A')}")
                
                # Show first student ID if available
                if data['items']:
                    print(f"   First student: {data['items'][0].get('first_name', 'N/A')} ({data['items'][0].get('student_id', 'N/A')})")
                    
            elif isinstance(data, list):
                print(f"   Students returned: {len(data)}")
                if data:
                    print(f"   First student: {data[0].get('first_name', 'N/A')} ({data[0].get('student_id', 'N/A')})")
        else:
            print(f"   ❌ Error: {response.status_code}")

def check_api_structure():
    """Check API response structure for frontend compatibility"""
    print(f"\n🔧 API Structure Analysis")
    print("=" * 30)
    
    login_data = {
        "username": "superadmin@springofknowledge.com", 
        "password": "SuperAdmin123!"
    }
    
    response = requests.post("http://localhost:8000/users/login", data=login_data)
    token = response.json()['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get("http://localhost:8000/students", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print("Response structure:")
        print(f"  Type: {type(data)}")
        print(f"  Keys: {list(data.keys()) if isinstance(data, dict) else 'List'}")
        
        if isinstance(data, dict) and 'items' in data and data['items']:
            sample_student = data['items'][0]
            print(f"  Sample student fields: {len(sample_student)} fields")
            required_fields = ['id', 'student_id', 'first_name', 'grade_level']
            missing_fields = [f for f in required_fields if f not in sample_student]
            print(f"  Required fields present: {len(required_fields) - len(missing_fields)}/{len(required_fields)}")
            if missing_fields:
                print(f"  Missing fields: {missing_fields}")

if __name__ == "__main__":
    test_students_endpoint()
    check_api_structure()