#!/usr/bin/env python3
"""
Simple test script to add test data through the API
Bypasses authentication for testing
"""

import requests
import json

API_BASE = "http://localhost:8001"

# First, let's create a test user and get a token
def create_and_login():
    """Create a test user and get token"""
    # Register a new test user
    register_data = {
        "email": "testadmin@test.com",
        "password": "testpassword123",
        "full_name": "Test Admin",
        "role": "super_admin"
    }
    
    try:
        # Try to register
        response = requests.post(f"{API_BASE}/users/register", json=register_data)
        print(f"Register status: {response.status_code}")
    except Exception as e:
        print(f"Register failed: {e}")
    
    # Try to login with form data
    login_data = {
        "username": "testadmin@test.com",
        "password": "testpassword123"
    }
    
    response = requests.post(
        f"{API_BASE}/users/login", 
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if response.status_code == 200:
        token = response.json()["access_token"]
        print(f"✓ Got token")
        return token
    else:
        print(f"Login failed: {response.status_code} - {response.text}")
        # Try the superadmin default
        login_data = {
            "username": "superadmin@example.com",
            "password": "SecurePassword123!"
        }
        
        response = requests.post(
            f"{API_BASE}/users/login", 
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if response.status_code == 200:
            token = response.json()["access_token"]
            print(f"✓ Got token with default superadmin")
            return token
        else:
            print("Could not get token, continuing anyway...")
            return None

def main():
    print("=" * 60)
    print("Creating Test Data for Class Management")
    print("=" * 60)
    
    # Get token
    token = create_and_login()
    
    if not token:
        print("Warning: No token available, requests may fail")
        return
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Create grade levels
    print("\n1. Creating grade levels...")
    grades = ["kg", "grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6", "grade_7", "grade_8"]
    grade_map = {}
    
    for grade in grades:
        data = {
            "grade": grade,
            "max_capacity": 100,
            "current_enrollment": 0
        }
        response = requests.post(f"{API_BASE}/grade-levels/", json=data, headers=headers)
        if response.status_code in [200, 201]:
            result = response.json()
            grade_map[grade] = result["id"]
            print(f"  ✓ Created grade: {grade}")
        else:
            # Try to get existing
            response = requests.get(f"{API_BASE}/grade-levels/", headers=headers)
            if response.status_code == 200:
                for g in response.json():
                    if g["grade"] == grade:
                        grade_map[grade] = g["id"]
                        print(f"  ✓ Found existing grade: {grade}")
                        break
    
    if not grade_map:
        print("Failed to create/find grade levels")
        return
    
    # Create duplicate classes
    print("\n2. Creating duplicate classes for testing cleanup...")
    duplicate_classes = [
        ("GRADE 3 - A", "grade_3"),
        ("GRADE 3 - A", "grade_3"),  # Duplicate
        ("GRADE 5 - B", "grade_5"),
        ("GRADE 5 - B", "grade_5"),  # Duplicate
        ("GRADE 5 - B", "grade_5"),  # Another duplicate
    ]
    
    class_ids = []
    for class_name, grade in duplicate_classes:
        if grade in grade_map:
            data = {
                "class_name": class_name,
                "grade_level_id": grade_map[grade],
                "max_capacity": 30,
                "academic_year": "2024"
            }
            response = requests.post(f"{API_BASE}/classes/", json=data, headers=headers)
            if response.status_code in [200, 201]:
                result = response.json()
                class_ids.append(result["id"])
                print(f"  ✓ Created class: {class_name}")
    
    # Create normal classes
    print("\n3. Creating normal classes...")
    normal_classes = [
        ("KG - A", "kg"),
        ("GRADE 1 - A", "grade_1"),
        ("GRADE 2 - A", "grade_2"),
        ("GRADE 4 - A", "grade_4"),
        ("GRADE 6 - A", "grade_6"),
    ]
    
    for class_name, grade in normal_classes:
        if grade in grade_map:
            data = {
                "class_name": class_name,
                "grade_level_id": grade_map[grade],
                "max_capacity": 30,
                "academic_year": "2024"
            }
            response = requests.post(f"{API_BASE}/classes/", json=data, headers=headers)
            if response.status_code in [200, 201]:
                result = response.json()
                class_ids.append(result["id"])
                print(f"  ✓ Created class: {class_name}")
    
    # Create students with grade mismatches
    print("\n4. Creating students with grade mismatches...")
    
    # Get the created classes
    response = requests.get(f"{API_BASE}/classes/", headers=headers)
    if response.status_code == 200:
        classes = response.json()
        
        # Find specific classes
        grade_3_class = next((c for c in classes if "GRADE 3" in c["class_name"]), None)
        grade_5_class = next((c for c in classes if "GRADE 5" in c["class_name"]), None)
        kg_class = next((c for c in classes if "KG" in c["class_name"]), None)
        
        # Create mismatched students
        mismatched = [
            ("Alice", "Wrong", "grade_1", grade_3_class["id"] if grade_3_class else None),
            ("Bob", "Mismatch", "grade_2", grade_5_class["id"] if grade_5_class else None),
            ("Charlie", "Oops", "grade_4", kg_class["id"] if kg_class else None),
        ]
        
        for first_name, last_name, grade, class_id in mismatched:
            if class_id:
                data = {
                    "first_name": first_name,
                    "last_name": last_name,
                    "student_id": f"STU{first_name[:3].upper()}",
                    "date_of_birth": "2010-01-01",
                    "gender": "Male",
                    "grade_level": grade,
                    "class_id": class_id,
                    "status": "Active",
                    "phone": "+1234567890"
                }
                response = requests.post(f"{API_BASE}/students/", json=data, headers=headers)
                if response.status_code in [200, 201]:
                    print(f"  ✓ Created MISMATCHED student: {first_name} {last_name}")
    
    print("\n" + "=" * 60)
    print("TEST DATA CREATED!")
    print("=" * 60)
    print("\nYou should now see:")
    print("1. Duplicate classes (GRADE 3 - A and GRADE 5 - B)")
    print("2. Students with grade mismatches")
    print("\nOpen http://localhost:8080/classes to test the features!")

if __name__ == "__main__":
    main()