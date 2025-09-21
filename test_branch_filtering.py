#!/usr/bin/env python3
"""
Test branch filtering to see why only 1 student shows
"""

import requests
import json

def test_branch_filtering():
    """Test different branch filtering scenarios"""
    print("🔍 Testing Branch Filtering Issue")
    print("=" * 40)
    
    # Login
    login_data = {
        "username": "superadmin@springofknowledge.com", 
        "password": "SuperAdmin123!"
    }
    
    response = requests.post("http://localhost:8000/users/login", data=login_data)
    token = response.json()['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test different scenarios
    test_cases = [
        ("No branch filter", "/students?page=1&limit=30"),
        ("Specific branch filter", "/students?branch_id=68b7231bb110092a69ae2acc&page=1&limit=30"),
        ("All students (no pagination)", "/students/all"),
        ("All students with branch", "/students/all?branch_id=68b7231bb110092a69ae2acc"),
    ]
    
    for name, url in test_cases:
        response = requests.get(f"http://localhost:8000{url}", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'items' in data:
                count = len(data['items'])
                total = data.get('total', count)
                print(f"✅ {name}: {count} items (total: {total})")
                
                if data['items']:
                    sample = data['items'][0]
                    branch_id = sample.get('branch_id', 'None')
                    print(f"   First student branch_id: {branch_id}")
                    print(f"   First student: {sample.get('first_name')} {sample.get('student_id')}")
            elif isinstance(data, list):
                print(f"✅ {name}: {len(data)} students")
                if data:
                    sample = data[0]
                    branch_id = sample.get('branch_id', 'None') 
                    print(f"   First student branch_id: {branch_id}")
                    print(f"   First student: {sample.get('first_name')} {sample.get('student_id')}")
        else:
            print(f"❌ {name}: HTTP {response.status_code}")
    
    # Check what branches actually exist
    print(f"\n🏢 Available Branches:")
    response = requests.get("http://localhost:8000/branches", headers=headers)
    if response.status_code == 200:
        branches = response.json()
        print(f"   Total branches: {len(branches)}")
        for branch in branches:
            print(f"   - {branch['name']} (ID: {branch['id']})")
    else:
        print(f"   ❌ Could not fetch branches: {response.status_code}")
    
    # Count students per branch
    print(f"\n📊 Student Distribution:")
    response = requests.get("http://localhost:8000/students/all", headers=headers)
    if response.status_code == 200:
        students = response.json()
        branch_counts = {}
        for student in students:
            branch_id = student.get('branch_id', 'None')
            branch_counts[branch_id] = branch_counts.get(branch_id, 0) + 1
        
        for branch_id, count in branch_counts.items():
            print(f"   Branch {branch_id}: {count} students")

if __name__ == "__main__":
    test_branch_filtering()