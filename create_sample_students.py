#!/usr/bin/env python3
"""
Create sample students using existing academic structure
"""

import requests
import json
import random
from datetime import datetime, timedelta, date
from faker import Faker

fake = Faker()
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
        print(f"✅ Superadmin login successful")
        return result['access_token']
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def get_existing_data(token):
    """Get existing academic structure"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get grade levels
    grade_response = requests.get(f"{BASE_URL}/grade-levels", headers=headers)
    grades = grade_response.json() if grade_response.status_code == 200 else []
    
    # Get teachers  
    teacher_response = requests.get(f"{BASE_URL}/teachers", headers=headers)
    teachers = teacher_response.json() if teacher_response.status_code == 200 else []
    
    print(f"Found: {len(grades)} grades, {len(teachers)} teachers")
    return grades, teachers

def create_simple_classes(token, grades, teachers, branch_id):
    """Create simple classes"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n🏫 Creating Classes")
    print("=" * 30)
    
    created_classes = []
    current_year = datetime.now().year
    
    for grade in grades[:5]:  # Create classes for first 5 grades
        teacher = random.choice(teachers) if teachers else None
        
        class_data = {
            "class_name": f"{grade['grade']} - Main",
            "grade_level_id": grade['id'],
            "teacher_id": teacher['id'] if teacher else None,
            "max_capacity": 25,
            "current_enrollment": 0,
            "academic_year": str(current_year),
            "branch_id": branch_id
        }
        
        response = requests.post(f"{BASE_URL}/classes", headers=headers, json=class_data)
        if response.status_code in [200, 201]:
            class_obj = response.json()
            created_classes.append(class_obj)
            print(f"✅ Created class: {class_data['class_name']}")
        else:
            print(f"❌ Failed to create class: {response.status_code}")
    
    return created_classes

def create_sample_students(token, grades, classes, branch_id):
    """Create sample students"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n👨‍🎓 Creating Students")
    print("=" * 30)
    
    created_students = []
    student_counter = 2  # Start from 2 since we have 1 existing
    
    for class_obj in classes:
        # Find corresponding grade
        grade = next((g for g in grades if g['id'] == class_obj['grade_level_id']), None)
        if not grade:
            continue
            
        # Create 8-12 students per class
        for i in range(random.randint(8, 12)):
            first_name = fake.first_name()
            
            student_data = {
                "student_id": f"STU{str(student_counter).zfill(4)}",
                "first_name": first_name,
                "date_of_birth": fake.date_of_birth(minimum_age=5, maximum_age=18).isoformat(),
                "gender": random.choice(["male", "female"]),
                "grade_level": grade['grade'],
                "class_id": class_obj['id'],
                "status": "Active",
                "branch_id": branch_id,
                "phone": fake.phone_number()[:15],
                "emergency_contact_name": fake.name(),
                "emergency_contact_phone": fake.phone_number()[:15]
            }
            
            response = requests.post(f"{BASE_URL}/students", headers=headers, json=student_data)
            if response.status_code in [200, 201]:
                student = response.json()
                created_students.append(student)
                student_counter += 1
                
                if len(created_students) % 15 == 0:
                    print(f"✅ Created {len(created_students)} students...")
            else:
                print(f"❌ Failed to create student: {response.status_code}")
                student_counter += 1
    
    print(f"✅ Created {len(created_students)} students total")
    return created_students

def main():
    print("👥 Creating Sample Students & Classes")
    print("=" * 50)
    
    # Get credentials and branch
    token = login_as_superadmin()
    if not token:
        return
        
    try:
        with open('branch_id.txt', 'r') as f:
            branch_id = f.read().strip()
    except:
        branch_id = "68b7231bb110092a69ae2acc"
    
    # Get existing academic structure
    grades, teachers = get_existing_data(token)
    
    if not grades:
        print("❌ No grades found. Run populate_corrected_data.py first!")
        return
    
    # Create classes
    classes = create_simple_classes(token, grades, teachers, branch_id)
    
    if classes:
        # Create students
        students = create_sample_students(token, grades, classes, branch_id)
        
        print(f"\n🎉 SUCCESS!")
        print(f"Created {len(classes)} classes and {len(students)} students")
        print("🌐 Ready for testing at http://localhost:8080")
    else:
        print("❌ No classes created, cannot create students")

if __name__ == "__main__":
    main()