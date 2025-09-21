#!/usr/bin/env python3
"""
Test all Disciplinary Management tabs/endpoints
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def login():
    """Login and get token"""
    response = requests.post(
        f"{BASE_URL}/users/login",
        data={"username": "admin@springofknowledge.com", "password": "admin123"}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    return None

def test_all_tabs():
    token = login()
    if not token:
        print("❌ Failed to login")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Logged in successfully\n")
    
    # Test endpoints that the tabs use
    endpoints = [
        ("/discipline/stats", "Overview/Stats"),
        ("/discipline/incidents", "Incidents"),
        ("/discipline/behavior-points", "Behavior Points"),
        ("/discipline/rewards", "Rewards"),
        ("/discipline/counseling-sessions", "Counseling Sessions"),
        ("/discipline/behavior-contracts", "Behavior Contracts")
    ]
    
    print("Testing all discipline tabs endpoints:")
    print("=" * 50)
    
    for endpoint, name in endpoints:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"✅ {name:25} - OK ({len(data)} records)")
            elif isinstance(data, dict):
                print(f"✅ {name:25} - OK (stats object)")
            else:
                print(f"✅ {name:25} - OK")
        else:
            print(f"❌ {name:25} - Failed ({response.status_code})")
    
    print("\n" + "=" * 50)
    print("All tabs should now be fetching data from the backend!")

if __name__ == "__main__":
    test_all_tabs()