#!/usr/bin/env python3
"""
Test role-based branch permissions
"""

import requests
import json

def test_role_permissions():
    """Test different user roles and their branch access"""
    print("🔍 Testing Role-Based Branch Permissions")
    print("=" * 50)
    
    # Test different user roles
    test_users = [
        ("superadmin@springofknowledge.com", "SuperAdmin123!", "super_admin"),
        # Add other test users here if available
    ]
    
    for username, password, expected_role in test_users:
        print(f"\n📌 Testing {expected_role}:")
        
        # Login
        login_data = {
            "username": username,
            "password": password
        }
        
        response = requests.post("http://localhost:8000/users/login", data=login_data)
        if response.status_code != 200:
            print(f"  ❌ Login failed for {username}")
            continue
            
        result = response.json()
        token = result['access_token']
        user = result['user']
        
        print(f"  ✅ Logged in as: {user['email']}")
        print(f"  Role: {user['role']}")
        print(f"  Branch ID: {user.get('branch_id', 'None')}")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test what branches they can see
        response = requests.get("http://localhost:8000/branches", headers=headers)
        if response.status_code == 200:
            branches = response.json()
            print(f"  Can see {len(branches)} branches")
        
        # Test what students they can see
        response = requests.get("http://localhost:8000/students", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'items' in data:
                print(f"  Can see {len(data['items'])} students (total: {data.get('total', 0)})")
        
        # Test with branch_id=all (should only work for super admin)
        response = requests.get("http://localhost:8000/students?branch_id=all", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'items' in data:
                print(f"  ✅ Can use 'all' branches filter: {len(data['items'])} students")
        else:
            print(f"  ❌ Cannot use 'all' branches filter: {response.status_code}")
    
    print(f"\n🎯 Expected Behavior:")
    print("• Super Admin:")
    print("  - Branch selector visible with 'All Branches' option")
    print("  - Can switch between all branches")
    print("  - Can see all 53 students when 'All Branches' selected")
    print("\n• Other Roles (Admin, Registrar, Teacher):")
    print("  - Branch selector hidden")
    print("  - Locked to their assigned branch")
    print("  - Can only see students from their branch")

if __name__ == "__main__":
    test_role_permissions()