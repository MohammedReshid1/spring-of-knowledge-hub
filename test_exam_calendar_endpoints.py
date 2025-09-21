#!/usr/bin/env python3
"""
Test exam management and academic calendar endpoints
"""
import requests
import json

def test_endpoints():
    """Test exam and calendar endpoints"""
    print("🔍 Testing Exam Management & Academic Calendar Endpoints")
    print("=" * 60)
    
    # Login first
    login_data = {
        "username": "superadmin@springofknowledge.com",
        "password": "SuperAdmin123!"
    }
    
    response = requests.post("http://localhost:8000/users/login", data=login_data)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return
    
    result = response.json()
    token = result['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"✅ Logged in successfully")
    
    # Test endpoints
    endpoints_to_test = [
        ("/exams/", "Exams List"),
        ("/subjects/", "Subjects List"),
        ("/classes/", "Classes List"),
        ("/academic-calendar/academic-years", "Academic Years"),
        ("/academic-calendar/academic-years/current", "Current Academic Year"),
        ("/academic-calendar/terms", "Terms"),
        ("/academic-calendar/events", "Academic Events"),
    ]
    
    print("\n📊 Testing Endpoints:")
    print("-" * 40)
    
    for endpoint, name in endpoints_to_test:
        try:
            response = requests.get(f"http://localhost:8000{endpoint}", headers=headers)
            status = "✅" if response.status_code == 200 else f"❌ ({response.status_code})"
            
            # Get response data size/type
            if response.status_code == 200:
                try:
                    data = response.json()
                    if isinstance(data, list):
                        data_info = f"Array with {len(data)} items"
                    elif isinstance(data, dict):
                        data_info = f"Object with {len(data)} fields"
                    else:
                        data_info = f"Data type: {type(data).__name__}"
                except:
                    data_info = "Non-JSON response"
            else:
                data_info = response.text[:100] if response.text else "No response body"
            
            print(f"  {status} {name:25} | {endpoint:35} | {data_info}")
            
        except Exception as e:
            print(f"  ❌ {name:25} | {endpoint:35} | Error: {str(e)}")
    
    print("\n🎯 Summary:")
    print("- All endpoints should return 200 OK")
    print("- Academic calendar endpoints should return data or empty arrays")
    print("- Exam endpoints should return empty arrays (no data yet)")

if __name__ == "__main__":
    test_endpoints()