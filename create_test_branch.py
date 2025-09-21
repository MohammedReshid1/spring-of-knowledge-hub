#!/usr/bin/env python3
"""
Create a test branch and populate basic data
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
        return result['access_token'], result['user']
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None, None

def get_existing_student_branch_id(token):
    """Get branch_id from existing student"""
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{BASE_URL}/students", headers=headers)
    if response.status_code == 200:
        result = response.json()
        students = result.get('items', [])
        if students:
            branch_id = students[0].get('branch_id')
            if branch_id:
                print(f"✅ Found existing branch_id from student: {branch_id}")
                return branch_id
    return None

def create_branch_directly(token):
    """Try to create branch with minimal data"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try minimal branch data
    branch_data = {
        "name": "Downtown Campus"
    }
    
    response = requests.post(f"{BASE_URL}/branches", headers=headers, json=branch_data)
    if response.status_code in [200, 201]:
        branch = response.json()
        print(f"✅ Created branch: {branch['name']} ({branch['id']})")
        return branch['id']
    else:
        print(f"❌ Branch creation failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None

def use_user_branch_id(user):
    """Use the branch_id from the superadmin user"""
    branch_id = user.get('branch_id')
    if branch_id:
        print(f"✅ Using superadmin user's branch_id: {branch_id}")
        return branch_id
    return None

def main():
    print("🏢 Creating Test Branch")
    print("=" * 40)
    
    token, user = login_as_superadmin()
    if not token:
        return
    
    # Try multiple approaches to get/create a branch
    branch_id = None
    
    # Method 1: Use existing student's branch
    branch_id = get_existing_student_branch_id(token)
    
    # Method 2: Use superadmin's branch
    if not branch_id:
        branch_id = use_user_branch_id(user)
    
    # Method 3: Try to create new branch
    if not branch_id:
        branch_id = create_branch_directly(token)
    
    if branch_id:
        print(f"✅ Branch ID available: {branch_id}")
        print("🚀 Ready to proceed with data population!")
        
        # Save branch_id to file for the main script
        with open('branch_id.txt', 'w') as f:
            f.write(branch_id)
        print("💾 Branch ID saved to branch_id.txt")
    else:
        print("❌ Could not establish branch_id")

if __name__ == "__main__":
    main()