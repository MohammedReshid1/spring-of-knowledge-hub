#!/usr/bin/env python3
"""
Corrected Test Data Population Script with proper field names
"""

import requests
import json
import random
from datetime import datetime, timedelta, date
from faker import Faker

# Initialize Faker for generating realistic data
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
        print(f"✅ Superadmin login successful - Role: {result['user']['role']}")
        return result['access_token']
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def get_branch_id():
    """Get branch_id from file"""
    try:
        with open('branch_id.txt', 'r') as f:
            branch_id = f.read().strip()
            if branch_id:
                print(f"✅ Using branch_id: {branch_id}")
                return branch_id
    except FileNotFoundError:
        pass
    
    # Fallback branch_id
    branch_id = "68b7231bb110092a69ae2acc"
    print(f"✅ Using fallback branch_id: {branch_id}")
    return branch_id

def create_grade_levels(token, branch_id):
    """Create grade levels with correct field names"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📚 Creating Grade Levels")
    print("=" * 40)
    
    current_year = datetime.now().year
    grade_levels = [
        {"grade": "Pre-K", "description": "Pre-Kindergarten", "academic_year": str(current_year)},
        {"grade": "Kindergarten", "description": "Kindergarten", "academic_year": str(current_year)},
        {"grade": "Grade 1", "description": "First Grade", "academic_year": str(current_year)},
        {"grade": "Grade 2", "description": "Second Grade", "academic_year": str(current_year)},
        {"grade": "Grade 3", "description": "Third Grade", "academic_year": str(current_year)},
        {"grade": "Grade 4", "description": "Fourth Grade", "academic_year": str(current_year)},
        {"grade": "Grade 5", "description": "Fifth Grade", "academic_year": str(current_year)},
        {"grade": "Grade 6", "description": "Sixth Grade", "academic_year": str(current_year)},
        {"grade": "Grade 7", "description": "Seventh Grade", "academic_year": str(current_year)},
        {"grade": "Grade 8", "description": "Eighth Grade", "academic_year": str(current_year)}
    ]
    
    created_grades = []
    for grade_data in grade_levels:
        grade_data["branch_id"] = branch_id
        grade_data["max_capacity"] = 150
        grade_data["current_enrollment"] = 0
        
        response = requests.post(f"{BASE_URL}/grade-levels", headers=headers, json=grade_data)
        if response.status_code in [200, 201]:
            grade = response.json()
            created_grades.append(grade)
            print(f"✅ Created grade: {grade_data['grade']}")
        else:
            print(f"❌ Failed to create grade {grade_data['grade']}: {response.status_code} - {response.text[:100]}")
    
    print(f"✅ Created {len(created_grades)} grade levels")
    return created_grades

def create_subjects(token, branch_id):
    """Create subjects with correct field names"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📖 Creating Subjects")
    print("=" * 40)
    
    subjects = [
        {"subject_name": "Mathematics", "subject_code": "MATH", "description": "Mathematics and Problem Solving"},
        {"subject_name": "English Language Arts", "subject_code": "ELA", "description": "Reading, Writing, Literature"},
        {"subject_name": "Science", "subject_code": "SCI", "description": "General Science and Laboratory"},
        {"subject_name": "Social Studies", "subject_code": "SS", "description": "History, Geography, Civics"},
        {"subject_name": "Art", "subject_code": "ART", "description": "Visual Arts and Creative Expression"},
        {"subject_name": "Music", "subject_code": "MUS", "description": "Music Theory and Performance"},
        {"subject_name": "Physical Education", "subject_code": "PE", "description": "Physical Fitness and Sports"},
        {"subject_name": "Computer Science", "subject_code": "CS", "description": "Programming and Digital Literacy"}
    ]
    
    created_subjects = []
    for subject_data in subjects:
        subject_data["branch_id"] = branch_id
        
        response = requests.post(f"{BASE_URL}/subjects", headers=headers, json=subject_data)
        if response.status_code in [200, 201]:
            subject = response.json()
            created_subjects.append(subject)
            print(f"✅ Created subject: {subject_data['subject_name']}")
        else:
            print(f"❌ Failed to create subject {subject_data['subject_name']}: {response.status_code}")
    
    print(f"✅ Created {len(created_subjects)} subjects")
    return created_subjects

def create_teachers(token, subjects, branch_id):
    """Create teachers with correct field names"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n👨‍🏫 Creating Teachers")
    print("=" * 40)
    
    created_teachers = []
    for i in range(12):  # Create 12 teachers
        first_name = fake.first_name()
        last_name = fake.last_name()
        subject = random.choice(subjects) if subjects else None
        
        teacher_data = {
            "teacher_id": f"TCH{str(i+1).zfill(3)}",
            "first_name": first_name,
            "last_name": last_name,
            "email": f"{first_name.lower()}.{last_name.lower()}@springofknowledge.edu",
            "phone": fake.phone_number()[:15],
            "subject_specialization": subject['subject_name'] if subject else "General",
            "qualification": random.choice(["Bachelor's in Education", "Master's in Education", "PhD in Education"]),
            "experience_years": random.randint(1, 15),
            "branch_id": branch_id
        }
        
        response = requests.post(f"{BASE_URL}/teachers", headers=headers, json=teacher_data)
        if response.status_code in [200, 201]:
            teacher = response.json()
            created_teachers.append(teacher)
            print(f"✅ Created teacher: {teacher_data['first_name']} {teacher_data['last_name']}")
        else:
            print(f"❌ Failed to create teacher: {response.status_code} - {response.text[:100]}")
    
    print(f"✅ Created {len(created_teachers)} teachers")
    return created_teachers

def create_classes(token, grade_levels, teachers, branch_id):
    """Create classes with proper assignments"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n🏫 Creating Classes")
    print("=" * 40)
    
    created_classes = []
    current_year = datetime.now().year
    
    # Create 1-2 classes per grade level
    for grade_level in grade_levels:
        sections = ['A', 'B'] if len(grade_levels) > 5 else ['A']
        
        for section in sections:
            teacher = random.choice(teachers) if teachers else None
            class_data = {
                "class_name": f"{grade_level['grade']} - Section {section}",
                "grade_level_id": grade_level['id'],
                "teacher_id": teacher['id'] if teacher else None,
                "max_capacity": random.randint(20, 30),
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
    
    print(f"✅ Created {len(created_classes)} classes")
    return created_classes

def create_students_bulk(token, grade_levels, classes, branch_id):
    """Create students for each class"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n👨‍🎓 Creating Students")
    print("=" * 40)
    
    created_students = []
    student_counter = 2  # Start from 2 since we have 1 existing
    
    # Create 5-12 students per class
    for class_obj in classes:
        # Find the grade level for this class
        grade_level = next((g for g in grade_levels if g['id'] == class_obj['grade_level_id']), None)
        if not grade_level:
            continue
            
        num_students = random.randint(5, 12)
        
        for i in range(num_students):
            first_name = fake.first_name()
            
            student_data = {
                "student_id": f"STU{str(student_counter).zfill(4)}",
                "first_name": first_name,
                "date_of_birth": fake.date_of_birth(minimum_age=5, maximum_age=18).isoformat(),
                "gender": random.choice(["male", "female"]),
                "address": fake.address()[:100],
                "phone": fake.phone_number()[:15],
                "email": f"{first_name.lower()}{student_counter}@student.edu",
                "emergency_contact_name": fake.name(),
                "emergency_contact_phone": fake.phone_number()[:15],
                "grade_level": grade_level['grade'],
                "class_id": class_obj['id'],
                "status": "Active",
                "branch_id": branch_id
            }
            
            response = requests.post(f"{BASE_URL}/students", headers=headers, json=student_data)
            if response.status_code in [200, 201]:
                student = response.json()
                created_students.append(student)
                student_counter += 1
                
                # Print progress every 20 students
                if len(created_students) % 20 == 0:
                    print(f"✅ Created {len(created_students)} students...")
            else:
                print(f"❌ Failed to create student: {response.status_code}")
                student_counter += 1
    
    print(f"✅ Created {len(created_students)} students total")
    return created_students

def create_sample_payments(token, students, branch_id):
    """Create sample payment records"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n💰 Creating Sample Payments")
    print("=" * 40)
    
    current_year = datetime.now().year
    payment_counter = 0
    
    # Create registration payments for first 30 students
    sample_students = students[:30]
    
    for student in sample_students:
        payment_data = {
            "student_id": student['student_id'],
            "amount": random.choice([150.0, 200.0, 175.0]),
            "payment_date": fake.date_between(start_date='-6m', end_date='today').isoformat(),
            "payment_method": random.choice(["Cash", "Credit Card", "Bank Transfer"]),
            "academic_year": str(current_year),
            "branch_id": branch_id,
            "status": random.choice(["Paid", "Paid", "Paid", "Pending"])  # Mostly paid
        }
        
        response = requests.post(f"{BASE_URL}/registration-payments", headers=headers, json=payment_data)
        if response.status_code in [200, 201]:
            payment_counter += 1
    
    print(f"✅ Created {payment_counter} payment records")
    return payment_counter

def main():
    print("🚀 Spring of Knowledge Hub - Corrected Test Data Population")
    print("=" * 70)
    
    # Login as superadmin
    token = login_as_superadmin()
    if not token:
        print("❌ Cannot proceed without authentication")
        return
    
    # Get branch_id
    branch_id = get_branch_id()
    
    try:
        print(f"\n🏗️ Creating Academic Structure...")
        
        # Create core academic structure
        grade_levels = create_grade_levels(token, branch_id)
        subjects = create_subjects(token, branch_id)
        teachers = create_teachers(token, subjects, branch_id)
        classes = create_classes(token, grade_levels, teachers, branch_id)
        
        print(f"\n👥 Creating Student Population...")
        
        # Create student population
        students = create_students_bulk(token, grade_levels, classes, branch_id)
        
        print(f"\n💳 Creating Payment Records...")
        
        # Create payment records
        payment_count = create_sample_payments(token, students, branch_id)
        
        # Summary
        print(f"\n🎉 TEST DATA POPULATION COMPLETE!")
        print("=" * 70)
        print(f"📊 Successfully Created:")
        print(f"   • {len(grade_levels)} Grade Levels")
        print(f"   • {len(subjects)} Subjects")
        print(f"   • {len(teachers)} Teachers")
        print(f"   • {len(classes)} Classes")
        print(f"   • {len(students)} Students")
        print(f"   • {payment_count} Payment Records")
        
        print(f"\n🌐 System Ready for Testing!")
        print(f"   Frontend: http://localhost:8080")
        print(f"   - Rich student data across all grade levels")
        print(f"   - Teacher assignments and class structure")
        print(f"   - Payment records for financial testing")
        print(f"   - Ready for comprehensive module testing")
        
    except Exception as e:
        print(f"❌ Error during data population: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()