#!/usr/bin/env python3
"""
Test script to create data for testing class management advanced features:
1. Duplicate classes - to test duplicate cleanup
2. Grade mismatches - to test grade mismatch fixing
3. Various enrollment levels - to test capacity tracking
"""

import asyncio
import httpx
from datetime import datetime
import random

API_BASE = "http://localhost:8001"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzU4NDRhZjU1ZDEyNzQ3OTI5ZTE2ZTQiLCJlbWFpbCI6InN1cGVyYWRtaW5AZXhhbXBsZS5jb20iLCJmdWxsX25hbWUiOiJTdXBlciBBZG1pbiIsInJvbGUiOiJzdXBlcmFkbWluIiwiYnJhbmNoX2lkIjpudWxsLCJleHAiOjE3MzYwNjQ5MDZ9.lNPqjLOZ8QbHpM2v3ZJdQQLGw0IZSfRPy_EGIdBRt0Y"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

async def login_and_get_token():
    """Login and get a fresh token"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_BASE}/users/login",
            json={"email": "superadmin@example.com", "password": "superadmin123"}
        )
        if response.status_code == 200:
            data = response.json()
            return data["access_token"]
        else:
            print(f"Login failed: {response.status_code}")
            return None

async def get_or_create_grade_levels():
    """Get existing grade levels or create them"""
    async with httpx.AsyncClient() as client:
        # Get existing grade levels
        response = await client.get(f"{API_BASE}/grade-levels/", headers=headers)
        if response.status_code == 200:
            grade_levels = response.json()
            if grade_levels and len(grade_levels) > 0:
                return {g["grade"]: g["id"] for g in grade_levels}
        
        # Create grade levels if they don't exist
        grades = [
            "kg", "grade_1", "grade_2", "grade_3", "grade_4", 
            "grade_5", "grade_6", "grade_7", "grade_8"
        ]
        
        grade_map = {}
        for grade in grades:
            data = {
                "grade": grade,
                "max_capacity": 100,
                "current_enrollment": 0
            }
            response = await client.post(f"{API_BASE}/grade-levels/", json=data, headers=headers)
            if response.status_code == 200 or response.status_code == 201:
                result = response.json()
                grade_map[grade] = result["id"]
                print(f"Created grade level: {grade}")
            else:
                print(f"Failed to create grade level {grade}: {response.status_code} - {response.text}")
        
        return grade_map

async def create_duplicate_classes(grade_map):
    """Create duplicate classes to test cleanup feature"""
    async with httpx.AsyncClient() as client:
        # Create multiple classes with the same name
        duplicate_names = [
            ("GRADE 3 - A", "grade_3"),
            ("GRADE 3 - A", "grade_3"),  # Duplicate
            ("GRADE 5 - B", "grade_5"),
            ("GRADE 5 - B", "grade_5"),  # Duplicate
            ("GRADE 5 - B", "grade_5"),  # Another duplicate
        ]
        
        created_classes = []
        for class_name, grade in duplicate_names:
            data = {
                "class_name": class_name,
                "grade_level_id": grade_map[grade],
                "max_capacity": 30,
                "academic_year": "2024"
            }
            response = await client.post(f"{API_BASE}/classes/", json=data, headers=headers)
            if response.status_code == 200:
                result = response.json()
                created_classes.append(result)
                print(f"Created class: {class_name} (ID: {result['id']})")
        
        return created_classes

async def create_normal_classes(grade_map):
    """Create normal classes for different grades"""
    async with httpx.AsyncClient() as client:
        classes = [
            ("KG - A", "kg", 25),
            ("KG - B", "kg", 28),
            ("GRADE 1 - A", "grade_1", 30),
            ("GRADE 2 - A", "grade_2", 28),
            ("GRADE 4 - A", "grade_4", 30),
            ("GRADE 6 - A", "grade_6", 32),
            ("GRADE 7 - A", "grade_7", 30),
            ("GRADE 8 - A", "grade_8", 35),
        ]
        
        created_classes = []
        for class_name, grade, capacity in classes:
            data = {
                "class_name": class_name,
                "grade_level_id": grade_map[grade],
                "max_capacity": capacity,
                "academic_year": "2024"
            }
            response = await client.post(f"{API_BASE}/classes/", json=data, headers=headers)
            if response.status_code == 200:
                result = response.json()
                created_classes.append(result)
                print(f"Created class: {class_name} (Capacity: {capacity})")
        
        return created_classes

async def create_students_with_mismatches(classes, grade_map):
    """Create students with intentional grade mismatches"""
    async with httpx.AsyncClient() as client:
        students = []
        
        # Find specific classes for mismatch testing
        grade_3_class = next((c for c in classes if "GRADE 3" in c["class_name"]), None)
        grade_5_class = next((c for c in classes if "GRADE 5" in c["class_name"]), None)
        kg_class = next((c for c in classes if "KG" in c["class_name"]), None)
        
        # Create students with correct grade assignments
        correct_students = [
            ("John", "Smith", "grade_3", grade_3_class["id"] if grade_3_class else None),
            ("Jane", "Doe", "grade_5", grade_5_class["id"] if grade_5_class else None),
            ("Bob", "Wilson", "kg", kg_class["id"] if kg_class else None),
        ]
        
        # Create students with WRONG grade assignments (mismatches)
        mismatched_students = [
            ("Alice", "Johnson", "grade_1", grade_3_class["id"] if grade_3_class else None),  # Grade 1 student in Grade 3 class
            ("Tom", "Brown", "grade_2", grade_5_class["id"] if grade_5_class else None),     # Grade 2 student in Grade 5 class
            ("Sarah", "Davis", "grade_4", kg_class["id"] if kg_class else None),            # Grade 4 student in KG class
            ("Mike", "Miller", "grade_6", grade_3_class["id"] if grade_3_class else None),  # Grade 6 student in Grade 3 class
            ("Emma", "Wilson", "grade_7", grade_5_class["id"] if grade_5_class else None),  # Grade 7 student in Grade 5 class
        ]
        
        # Create correct students
        for first_name, last_name, grade, class_id in correct_students:
            if class_id:
                data = {
                    "first_name": first_name,
                    "last_name": last_name,
                    "student_id": f"STU{random.randint(1000, 9999)}",
                    "date_of_birth": "2010-01-01",
                    "gender": random.choice(["Male", "Female"]),
                    "grade_level": grade,
                    "class_id": class_id,
                    "status": "Active",
                    "phone": f"+1234567{random.randint(1000, 9999)}"
                }
                response = await client.post(f"{API_BASE}/students/", json=data, headers=headers)
                if response.status_code == 200:
                    result = response.json()
                    students.append(result)
                    print(f"Created student: {first_name} {last_name} (Grade: {grade}, Class: Correct)")
        
        # Create mismatched students
        for first_name, last_name, grade, class_id in mismatched_students:
            if class_id:
                data = {
                    "first_name": first_name,
                    "last_name": last_name,
                    "student_id": f"STU{random.randint(1000, 9999)}",
                    "date_of_birth": "2010-01-01",
                    "gender": random.choice(["Male", "Female"]),
                    "grade_level": grade,
                    "class_id": class_id,
                    "status": "Active",
                    "phone": f"+1234567{random.randint(1000, 9999)}"
                }
                response = await client.post(f"{API_BASE}/students/", json=data, headers=headers)
                if response.status_code == 200:
                    result = response.json()
                    students.append(result)
                    print(f"Created MISMATCHED student: {first_name} {last_name} (Grade: {grade}, Class: WRONG)")
        
        # Create some students without class assignments
        unassigned_students = [
            ("Peter", "Parker", "grade_1"),
            ("Mary", "Jane", "grade_2"),
            ("Harry", "Potter", "grade_3"),
        ]
        
        for first_name, last_name, grade in unassigned_students:
            data = {
                "first_name": first_name,
                "last_name": last_name,
                "student_id": f"STU{random.randint(1000, 9999)}",
                "date_of_birth": "2010-01-01",
                "gender": random.choice(["Male", "Female"]),
                "grade_level": grade,
                "status": "Active",
                "phone": f"+1234567{random.randint(1000, 9999)}"
            }
            response = await client.post(f"{API_BASE}/students/", json=data, headers=headers)
            if response.status_code == 200:
                result = response.json()
                students.append(result)
                print(f"Created unassigned student: {first_name} {last_name} (Grade: {grade})")
        
        return students

async def main():
    """Main function to create test data"""
    print("=" * 60)
    print("Creating test data for Class Management Advanced Features")
    print("=" * 60)
    
    # Try to get a fresh token
    print("\n1. Getting authentication token...")
    fresh_token = await login_and_get_token()
    if fresh_token:
        global headers
        headers["Authorization"] = f"Bearer {fresh_token}"
        print("✓ Got fresh token")
    else:
        print("⚠ Using existing token")
    
    print("\n2. Creating grade levels...")
    grade_map = await get_or_create_grade_levels()
    print(f"✓ Grade levels ready: {list(grade_map.keys())}")
    
    print("\n3. Creating duplicate classes...")
    duplicate_classes = await create_duplicate_classes(grade_map)
    print(f"✓ Created {len(duplicate_classes)} classes (including duplicates)")
    
    print("\n4. Creating normal classes...")
    normal_classes = await create_normal_classes(grade_map)
    print(f"✓ Created {len(normal_classes)} normal classes")
    
    print("\n5. Creating students with grade mismatches...")
    all_classes = duplicate_classes + normal_classes
    students = await create_students_with_mismatches(all_classes, grade_map)
    print(f"✓ Created {len(students)} students")
    
    print("\n" + "=" * 60)
    print("TEST DATA CREATED SUCCESSFULLY!")
    print("=" * 60)
    print("\nYou should now see in the Classes page:")
    print("1. DUPLICATE CLASSES: 'GRADE 3 - A' (2 copies) and 'GRADE 5 - B' (3 copies)")
    print("2. GRADE MISMATCHES: 5 students assigned to wrong grade classes")
    print("3. UNASSIGNED STUDENTS: 3 students without class assignments")
    print("4. GRADE CAPACITY: Various enrollment levels across grades")
    print("\nOpen http://localhost:8080/classes to test the features!")

if __name__ == "__main__":
    asyncio.run(main())