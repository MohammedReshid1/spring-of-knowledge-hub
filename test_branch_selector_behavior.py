#!/usr/bin/env python3
"""
Test the new branch selector behavior
"""

import requests

def test_branch_selector_behavior():
    """Test how the new branch selector should work"""
    print("🧪 Testing New Branch Selector Behavior")
    print("=" * 50)
    
    # Login as super admin
    login_data = {
        "username": "superadmin@springofknowledge.com", 
        "password": "SuperAdmin123!"
    }
    
    response = requests.post("http://localhost:8000/users/login", data=login_data)
    token = response.json()['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    
    print("✅ Logged in as super admin")
    
    # Check branches
    response = requests.get("http://localhost:8000/branches", headers=headers)
    branches = response.json()
    print(f"📊 Available branches: {len(branches)}")
    
    # Test different branch selection scenarios
    scenarios = [
        ("No branch selected", None),
        ("All branches selected", "all"),
    ]
    
    for scenario_name, branch_param in scenarios:
        print(f"\n🔍 Testing: {scenario_name}")
        
        if branch_param is None:
            url = "http://localhost:8000/students?page=1&limit=30"
        elif branch_param == "all":
            url = "http://localhost:8000/students?branch_id=all&page=1&limit=30"
        
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            items = len(data.get('items', []))
            total = data.get('total', 0)
            print(f"   ✅ Students returned: {items} out of {total}")
        else:
            print(f"   ❌ Error: {response.status_code}")
    
    print(f"\n🎯 Expected Frontend Behavior:")
    print("1. Branch selector shows 'Select Branch' initially")
    print("2. Dropdown includes 'All Branches (0)' option")
    print("3. Users can manually choose 'All Branches' or specific branches")
    print("4. No data shows until user makes a selection")
    print("5. When 'All Branches' is selected, shows all 53 students")

if __name__ == "__main__":
    test_branch_selector_behavior()