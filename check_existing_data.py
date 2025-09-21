#!/usr/bin/env python3
"""
Check existing data in the system
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def login_as_superadmin():
    """Login as superadmin and return token"""
    login_data = {
        "username": "superadmin@springofknowledge.com", 
        "password": "SuperAdmin123!"
    }
    
    response = requests.post(f"{BASE_URL}/users/login", data=login_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Superadmin login successful - Role: {result['user']['role']}")
        return result['access_token']
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def check_existing_data(token):
    """Check what data already exists"""
    headers = {"Authorization": f"Bearer {token}"}
    
    endpoints = [
        ("Branches", "/branches"),
        ("Grade Levels", "/grade-levels"),
        ("Subjects", "/subjects"),
        ("Teachers", "/teachers"),
        ("Classes", "/classes"),
        ("Students", "/students"),
        ("Fees", "/fees"),
        ("Payment Modes", "/payment-mode")
    ]
    
    for name, endpoint in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    count = len(data)
                elif isinstance(data, dict) and 'items' in data:
                    count = len(data['items'])
                elif isinstance(data, dict) and 'total' in data:
                    count = data['total']
                else:
                    count = "unknown"
                print(f"✅ {name}: {count}")
                
                # Show sample data for branches
                if endpoint == "/branches" and isinstance(data, list) and data:
                    print(f"   Sample branch: {data[0].get('name', 'N/A')} (ID: {data[0].get('id', 'N/A')})")
                    
            else:
                print(f"❌ {name}: Error {response.status_code}")
        except Exception as e:
            print(f"❌ {name}: Exception {e}")

def main():
    print("🔍 Checking Existing Data")
    print("=" * 40)
    
    token = login_as_superadmin()
    if token:
        check_existing_data(token)

if __name__ == "__main__":
    main()