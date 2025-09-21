#!/usr/bin/env python3
"""
Create a test student for discipline integration testing
"""

import requests
from datetime import date

# API Base URL
BASE_URL = "http://localhost:8000"

# Test user credentials
TEST_USER = "admin@gmail.com"
TEST_PASSWORD = "admin123"

def login():
    """Login and get access token"""
    response = requests.post(
        f"{BASE_URL}/users/login",
        data={"username": TEST_USER, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Login failed: {response.text}")
        return None

def create_test_student(token):
    """Create a test student"""
    headers = {"Authorization": f"Bearer {token}"}
    
    student_data = {
        "student_id": "STU001",
        "first_name": "Test Student",
        "date_of_birth": date(2010, 1, 1).isoformat(),
        "gender": "Male",
        "address": "123 Test Street",
        "phone": "1234567890",
        "email": "test@student.com",
        "grade_level": "Grade 5",
        "admission_date": date.today().isoformat(),
        "status": "Active",
        "branch_id": "687a956f94db7613aaf3ff77"
    }
    
    response = requests.post(f"{BASE_URL}/students/", json=student_data, headers=headers)
    
    if response.status_code in [200, 201]:
        print(f"✓ Test student created successfully: {response.json()}")
        return True
    elif response.status_code == 400 and "already exists" in response.text:
        print(f"✓ Test student already exists")
        return True
    else:
        print(f"✗ Failed to create test student: {response.status_code} - {response.text}")
        return False

def main():
    print("Creating test student for discipline integration...")
    
    # Login
    token = login()
    if not token:
        print("Failed to login. Exiting.")
        return
    
    # Create test student
    if create_test_student(token):
        print("\nTest student ready for discipline integration testing!")
    else:
        print("\nFailed to create test student")

if __name__ == "__main__":
    main()