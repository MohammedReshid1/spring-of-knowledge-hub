#!/usr/bin/env python3
"""
Debug the current state to see what's not working
"""

import requests
import json

def debug_current_state():
    """Debug what's currently happening"""
    print("🐛 Debugging Current State")
    print("=" * 40)
    
    # Test if backend is responding
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running and responding")
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Cannot reach backend: {e}")
        return
    
    # Test login
    try:
        login_data = {
            "username": "superadmin@springofknowledge.com", 
            "password": "SuperAdmin123!"
        }
        
        response = requests.post("http://localhost:8000/users/login", data=login_data, timeout=5)
        if response.status_code == 200:
            result = response.json()
            token = result['access_token']
            user = result['user']
            print(f"✅ Login successful - Role: {user['role']}")
            print(f"✅ User branch_id: {user.get('branch_id', 'None')}")
        else:
            print(f"❌ Login failed: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test branches endpoint
    try:
        response = requests.get("http://localhost:8000/branches", headers=headers, timeout=5)
        if response.status_code == 200:
            branches = response.json()
            print(f"✅ Branches endpoint: {len(branches)} branches")
        else:
            print(f"❌ Branches endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Branches error: {e}")
    
    # Test students endpoint with different scenarios
    test_cases = [
        ("No params", ""),
        ("branch_id=all", "?branch_id=all"),
        ("With pagination", "?page=1&limit=10"),
    ]
    
    for name, params in test_cases:
        try:
            url = f"http://localhost:8000/students{params}"
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and 'items' in data:
                    count = len(data['items'])
                    total = data.get('total', count)
                    print(f"✅ Students {name}: {count} items (total: {total})")
                elif isinstance(data, list):
                    print(f"✅ Students {name}: {len(data)} items")
            else:
                print(f"❌ Students {name}: {response.status_code}")
        except Exception as e:
            print(f"❌ Students {name} error: {e}")
    
    print(f"\n🌐 Frontend should be at: http://localhost:8080")
    print("Check browser console for JavaScript errors")

if __name__ == "__main__":
    debug_current_state()