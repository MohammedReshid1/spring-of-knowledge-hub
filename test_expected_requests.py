#!/usr/bin/env python3
"""
Test what the frontend should be requesting after our fix
"""

import requests

def test_expected_requests():
    """Test the requests frontend should make"""
    print("🧪 Testing Expected Frontend Requests After Fix")
    print("=" * 50)
    
    # Login
    login_data = {
        "username": "superadmin@springofknowledge.com", 
        "password": "SuperAdmin123!"
    }
    
    response = requests.post("http://localhost:8000/users/login", data=login_data)
    token = response.json()['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    
    # These are the requests frontend should make with selectedBranch = 'all'
    expected_requests = [
        ("Students (no branch filter)", "/students?sort_by=name&sort_order=asc&page=1&limit=30"),
        ("Student Stats (no branch filter)", "/students/stats"),
        ("Classes", "/classes"),
    ]
    
    print("Expected requests frontend should make:")
    for name, url in expected_requests:
        response = requests.get(f"http://localhost:8000{url}", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'items' in data:
                count = len(data['items'])
                total = data.get('total', count)
                print(f"✅ {name}: {count} items (total: {total})")
            elif isinstance(data, list):
                print(f"✅ {name}: {len(data)} items")
            elif isinstance(data, dict):
                print(f"✅ {name}: data available")
        else:
            print(f"❌ {name}: HTTP {response.status_code}")
    
    print(f"\n🎯 Frontend should now show:")
    print("- Students (30) - showing 30 items out of 53 total")
    print("- Proper pagination with 2 pages")
    print("- All students from all branches")

if __name__ == "__main__":
    test_expected_requests()