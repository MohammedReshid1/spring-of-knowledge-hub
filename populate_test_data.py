#!/usr/bin/env python3
"""
Comprehensive Test Data Population Script
Creates realistic test data for all modules of the Spring of Knowledge Hub
"""

import requests
import json
import random
from datetime import datetime, timedelta, date
from faker import Faker
import uuid

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

def get_or_create_branch(token):
    """Get existing branch from file or from existing student"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try to read branch_id from file first
    try:
        with open('branch_id.txt', 'r') as f:
            branch_id = f.read().strip()
            if branch_id:
                print(f"✅ Using branch_id from file: {branch_id}")
                return branch_id
    except FileNotFoundError:
        pass
    
    # Try to get branch from existing student
    response = requests.get(f"{BASE_URL}/students", headers=headers)
    if response.status_code == 200:
        result = response.json()
        students = result.get('items', [])
        if students:
            branch_id = students[0].get('branch_id')
            if branch_id:
                print(f"✅ Using branch_id from existing student: {branch_id}")
                return branch_id
    
    # Try to get existing branches
    response = requests.get(f"{BASE_URL}/branches", headers=headers)
    if response.status_code == 200:
        branches = response.json()
        if branches:
            branch_id = branches[0]['id']
            print(f"✅ Using existing branch: {branches[0]['name']} ({branch_id})")
            return branch_id
    
    print(f"❌ No branch_id available")
    return None

def create_grade_levels(token, branch_id):
    """Create comprehensive grade level structure"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📚 Creating Grade Levels")
    print("=" * 40)
    
    grade_levels = [
        {"grade": "Pre-K", "description": "Pre-Kindergarten", "min_age": 3, "max_age": 4},
        {"grade": "Kindergarten", "description": "Kindergarten", "min_age": 4, "max_age": 5},
        {"grade": "Grade 1", "description": "First Grade", "min_age": 5, "max_age": 6},
        {"grade": "Grade 2", "description": "Second Grade", "min_age": 6, "max_age": 7},
        {"grade": "Grade 3", "description": "Third Grade", "min_age": 7, "max_age": 8},
        {"grade": "Grade 4", "description": "Fourth Grade", "min_age": 8, "max_age": 9},
        {"grade": "Grade 5", "description": "Fifth Grade", "min_age": 9, "max_age": 10},
        {"grade": "Grade 6", "description": "Sixth Grade", "min_age": 10, "max_age": 11},
        {"grade": "Grade 7", "description": "Seventh Grade", "min_age": 11, "max_age": 12},
        {"grade": "Grade 8", "description": "Eighth Grade", "min_age": 12, "max_age": 13},
        {"grade": "Grade 9", "description": "Ninth Grade", "min_age": 13, "max_age": 14},
        {"grade": "Grade 10", "description": "Tenth Grade", "min_age": 14, "max_age": 15},
        {"grade": "Grade 11", "description": "Eleventh Grade", "min_age": 15, "max_age": 16},
        {"grade": "Grade 12", "description": "Twelfth Grade", "min_age": 16, "max_age": 18}
    ]
    
    created_grades = []
    for grade_data in grade_levels:
        grade_data["branch_id"] = branch_id
        
        response = requests.post(f"{BASE_URL}/grade-levels", headers=headers, json=grade_data)
        if response.status_code in [200, 201]:
            grade = response.json()
            created_grades.append(grade)
            print(f"✅ Created grade: {grade_data['grade']}")
        else:
            print(f"❌ Failed to create grade {grade_data['grade']}: {response.status_code}")
    
    print(f"✅ Created {len(created_grades)} grade levels")
    return created_grades

def create_subjects(token, branch_id):
    """Create subject curriculum"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📖 Creating Subjects")
    print("=" * 40)
    
    subjects = [
        {"name": "Mathematics", "code": "MATH", "description": "Mathematics and Problem Solving"},
        {"name": "English Language Arts", "code": "ELA", "description": "Reading, Writing, Literature"},
        {"name": "Science", "code": "SCI", "description": "General Science and Laboratory"},
        {"name": "Social Studies", "code": "SS", "description": "History, Geography, Civics"},
        {"name": "Art", "code": "ART", "description": "Visual Arts and Creative Expression"},
        {"name": "Music", "code": "MUS", "description": "Music Theory and Performance"},
        {"name": "Physical Education", "code": "PE", "description": "Physical Fitness and Sports"},
        {"name": "Computer Science", "code": "CS", "description": "Programming and Digital Literacy"},
        {"name": "Foreign Language", "code": "FL", "description": "Spanish/French Language"},
        {"name": "Life Skills", "code": "LS", "description": "Personal Development"}
    ]
    
    created_subjects = []
    for subject_data in subjects:
        subject_data["branch_id"] = branch_id
        
        response = requests.post(f"{BASE_URL}/subjects", headers=headers, json=subject_data)
        if response.status_code in [200, 201]:
            subject = response.json()
            created_subjects.append(subject)
            print(f"✅ Created subject: {subject_data['name']}")
        else:
            print(f"⚠️ Subject {subject_data['name']} may already exist")
    
    print(f"✅ Created {len(created_subjects)} subjects")
    return created_subjects

def create_teachers(token, branch_id):
    """Create teaching staff"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n👨‍🏫 Creating Teachers")
    print("=" * 40)
    
    subjects = ["Mathematics", "English", "Science", "Social Studies", "Art", "Music", "PE", "Computer Science"]
    
    teachers_data = []
    for i in range(15):  # Create 15 teachers
        first_name = fake.first_name()
        last_name = fake.last_name()
        teacher_data = {
            "employee_id": f"TCH{str(i+1).zfill(3)}",
            "first_name": first_name,
            "last_name": last_name,
            "email": f"{first_name.lower()}.{last_name.lower()}@springofknowledge.edu",
            "phone": fake.phone_number()[:15],
            "address": fake.address()[:100],
            "date_of_birth": fake.date_of_birth(minimum_age=25, maximum_age=60).isoformat(),
            "hire_date": fake.date_between(start_date='-5y', end_date='today').isoformat(),
            "subject_specialization": random.choice(subjects),
            "qualification": random.choice(["Bachelor's in Education", "Master's in Education", "PhD in Education"]),
            "experience_years": random.randint(1, 15),
            "salary": random.randint(35000, 75000),
            "status": "Active",
            "branch_id": branch_id
        }
        teachers_data.append(teacher_data)
    
    created_teachers = []
    for teacher_data in teachers_data:
        response = requests.post(f"{BASE_URL}/teachers", headers=headers, json=teacher_data)
        if response.status_code in [200, 201]:
            teacher = response.json()
            created_teachers.append(teacher)
            print(f"✅ Created teacher: {teacher_data['first_name']} {teacher_data['last_name']} ({teacher_data['subject_specialization']})")
        else:
            print(f"❌ Failed to create teacher: {response.status_code}")
    
    print(f"✅ Created {len(created_teachers)} teachers")
    return created_teachers

def create_classes(token, grade_levels, teachers, branch_id):
    """Create classes with teacher assignments"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n🏫 Creating Classes")
    print("=" * 40)
    
    created_classes = []
    current_year = datetime.now().year
    
    # Create 2-3 classes per grade level
    for grade_level in grade_levels:
        sections = ['A', 'B'] if random.choice([True, False]) else ['A', 'B', 'C']
        
        for section in sections:
            teacher = random.choice(teachers)
            class_data = {
                "class_name": f"{grade_level['grade']} - Section {section}",
                "grade_level_id": grade_level['id'],
                "teacher_id": teacher['id'],
                "max_capacity": random.randint(20, 30),
                "current_enrollment": 0,
                "academic_year": str(current_year),
                "branch_id": branch_id,
                "room_number": f"Room {random.randint(101, 399)}",
                "schedule": f"Monday-Friday, {random.choice(['8:00 AM - 12:00 PM', '1:00 PM - 5:00 PM'])}"
            }
            
            response = requests.post(f"{BASE_URL}/classes", headers=headers, json=class_data)
            if response.status_code in [200, 201]:
                class_obj = response.json()
                created_classes.append(class_obj)
                print(f"✅ Created class: {class_data['class_name']} (Teacher: {teacher['first_name']} {teacher['last_name']})")
            else:
                print(f"❌ Failed to create class: {response.status_code}")
    
    print(f"✅ Created {len(created_classes)} classes")
    return created_classes

def create_students(token, grade_levels, classes, branch_id):
    """Create diverse student population"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n👨‍🎓 Creating Students")
    print("=" * 40)
    
    created_students = []
    student_counter = 1
    
    # Create 8-15 students per class
    for class_obj in classes:
        # Find the grade level for age calculation
        grade_level = next((g for g in grade_levels if g['id'] == class_obj['grade_level_id']), None)
        if not grade_level:
            continue
            
        num_students = random.randint(8, 15)
        
        for i in range(num_students):
            first_name = fake.first_name()
            
            # Calculate appropriate birth date based on grade level
            min_age = grade_level.get('min_age', 6)
            max_age = grade_level.get('max_age', 18)
            birth_date = fake.date_of_birth(minimum_age=min_age, maximum_age=max_age)
            
            student_data = {
                "student_id": f"STU{str(student_counter).zfill(4)}",
                "first_name": first_name,
                "date_of_birth": birth_date.isoformat(),
                "gender": random.choice(["male", "female"]),
                "address": fake.address()[:150],
                "phone": fake.phone_number()[:15],
                "email": f"{first_name.lower()}{student_counter}@student.edu",
                "emergency_contact_name": fake.name(),
                "emergency_contact_phone": fake.phone_number()[:15],
                "father_name": fake.first_name_male() + " " + fake.last_name(),
                "mother_name": fake.first_name_female() + " " + fake.last_name(),
                "grade_level": grade_level['grade'],
                "class_id": class_obj['id'],
                "admission_date": fake.date_between(start_date='-2y', end_date='today').isoformat(),
                "status": random.choice(["Active", "Active", "Active", "Inactive"]),  # 75% active
                "branch_id": branch_id,
                "medical_info": random.choice([None, "Allergic to nuts", "Asthma medication", "No medical issues"])
            }
            
            response = requests.post(f"{BASE_URL}/students", headers=headers, json=student_data)
            if response.status_code in [200, 201]:
                student = response.json()
                created_students.append(student)
                if student_counter % 10 == 0:  # Print every 10th student
                    print(f"✅ Created student {student_counter}: {student_data['first_name']} ({student_data['grade_level']})")
                student_counter += 1
            else:
                print(f"❌ Failed to create student: {response.status_code}")
                student_counter += 1
    
    print(f"✅ Created {len(created_students)} students")
    return created_students

def create_payment_data(token, students, branch_id):
    """Create payment records and fee structure"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n💰 Creating Payment Data")
    print("=" * 40)
    
    # Create fee structure
    current_year = datetime.now().year
    fees_data = [
        {"fee_name": "Registration Fee", "amount": 150.00, "fee_type": "one_time", "academic_year": str(current_year)},
        {"fee_name": "Tuition Fee", "amount": 800.00, "fee_type": "monthly", "academic_year": str(current_year)},
        {"fee_name": "Library Fee", "amount": 50.00, "fee_type": "annual", "academic_year": str(current_year)},
        {"fee_name": "Lab Fee", "amount": 75.00, "fee_type": "quarterly", "academic_year": str(current_year)},
        {"fee_name": "Sports Fee", "amount": 100.00, "fee_type": "annual", "academic_year": str(current_year)}
    ]
    
    created_fees = []
    for fee_data in fees_data:
        fee_data["branch_id"] = branch_id
        response = requests.post(f"{BASE_URL}/fees", headers=headers, json=fee_data)
        if response.status_code in [200, 201]:
            fee = response.json()
            created_fees.append(fee)
            print(f"✅ Created fee: {fee_data['fee_name']} - ${fee_data['amount']}")
        else:
            print(f"⚠️ Fee {fee_data['fee_name']} may already exist")
    
    # Create registration payments for active students
    payment_counter = 0
    for student in students[:50]:  # Create payments for first 50 students
        if student.get('status') == 'Active':
            payment_data = {
                "student_id": student['student_id'],
                "amount": 150.00,
                "payment_date": fake.date_between(start_date='-1y', end_date='today').isoformat(),
                "payment_method": random.choice(["Cash", "Credit Card", "Bank Transfer", "Check"]),
                "academic_year": str(current_year),
                "branch_id": branch_id,
                "status": random.choice(["Paid", "Paid", "Pending", "Overdue"]),  # Most paid
                "notes": random.choice([None, "Paid in full", "Partial payment", "Late fee applied"])
            }
            
            response = requests.post(f"{BASE_URL}/registration-payments", headers=headers, json=payment_data)
            if response.status_code in [200, 201]:
                payment_counter += 1
    
    print(f"✅ Created {len(created_fees)} fee types and {payment_counter} payment records")
    return created_fees

def create_attendance_records(token, students, classes, branch_id):
    """Create attendance records"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📅 Creating Attendance Records")
    print("=" * 40)
    
    attendance_counter = 0
    
    # Create attendance for the last 30 days for active students
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    # Sample of students to create attendance for (not all to avoid overwhelming)
    sample_students = students[:30]  
    
    current_date = start_date
    while current_date <= end_date:
        # Skip weekends
        if current_date.weekday() < 5:  # Monday = 0, Friday = 4
            
            for student in sample_students:
                if student.get('status') == 'Active':
                    attendance_data = {
                        "student_id": student['student_id'],
                        "date": current_date.isoformat(),
                        "status": random.choice([
                            "Present", "Present", "Present", "Present",  # 80% present
                            "Absent", "Late"
                        ]),
                        "notes": random.choice([None, "Sick", "Family trip", "Doctor appointment"]),
                        "branch_id": branch_id
                    }
                    
                    response = requests.post(f"{BASE_URL}/attendance", headers=headers, json=attendance_data)
                    if response.status_code in [200, 201]:
                        attendance_counter += 1
        
        current_date += timedelta(days=1)
    
    print(f"✅ Created {attendance_counter} attendance records")
    return attendance_counter

def create_additional_test_data(token, branch_id):
    """Create additional test data for other modules"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📋 Creating Additional Test Data")
    print("=" * 40)
    
    # Create backup logs
    backup_logs = []
    for i in range(5):
        backup_data = {
            "backup_type": random.choice(["full", "incremental", "differential"]),
            "status": random.choice(["completed", "failed", "in_progress"]),
            "file_size": random.randint(100, 5000),
            "backup_date": fake.date_between(start_date='-30d', end_date='today').isoformat(),
            "notes": f"Automated backup #{i+1}",
            "branch_id": branch_id
        }
        
        response = requests.post(f"{BASE_URL}/backup-logs", headers=headers, json=backup_data)
        if response.status_code in [200, 201]:
            backup_logs.append(response.json())
    
    print(f"✅ Created {len(backup_logs)} backup log entries")
    
    # Create payment modes
    payment_modes = [
        {"mode_name": "Cash", "description": "Cash payments"},
        {"mode_name": "Credit Card", "description": "Credit card payments"},
        {"mode_name": "Debit Card", "description": "Debit card payments"},
        {"mode_name": "Bank Transfer", "description": "Direct bank transfers"},
        {"mode_name": "Online Payment", "description": "Online payment gateway"},
        {"mode_name": "Check", "description": "Check payments"}
    ]
    
    created_modes = []
    for mode_data in payment_modes:
        mode_data["branch_id"] = branch_id
        response = requests.post(f"{BASE_URL}/payment-mode", headers=headers, json=mode_data)
        if response.status_code in [200, 201]:
            created_modes.append(response.json())
    
    print(f"✅ Created {len(created_modes)} payment modes")
    
    return {"backup_logs": backup_logs, "payment_modes": created_modes}

def main():
    print("🚀 Spring of Knowledge Hub - Comprehensive Test Data Population")
    print("=" * 80)
    
    # Login as superadmin
    token = login_as_superadmin()
    if not token:
        print("❌ Cannot proceed without authentication")
        return
    
    # Get or create branch
    branch_id = get_or_create_branch(token)
    if not branch_id:
        print("❌ Cannot proceed without branch")
        return
    
    try:
        # Create core academic structure
        grade_levels = create_grade_levels(token, branch_id)
        subjects = create_subjects(token, branch_id)
        teachers = create_teachers(token, branch_id)
        classes = create_classes(token, grade_levels, teachers, branch_id)
        
        # Create student population
        students = create_students(token, grade_levels, classes, branch_id)
        
        # Create financial data
        fees = create_payment_data(token, students, branch_id)
        
        # Create attendance records
        attendance_count = create_attendance_records(token, students, classes, branch_id)
        
        # Create additional test data
        additional_data = create_additional_test_data(token, branch_id)
        
        # Summary
        print(f"\n🎉 TEST DATA POPULATION COMPLETE!")
        print("=" * 80)
        print(f"📊 Created:")
        print(f"   • {len(grade_levels)} Grade Levels (Pre-K to Grade 12)")
        print(f"   • {len(subjects)} Subjects")
        print(f"   • {len(teachers)} Teachers")
        print(f"   • {len(classes)} Classes")
        print(f"   • {len(students)} Students")
        print(f"   • {len(fees)} Fee Types")
        print(f"   • {attendance_count} Attendance Records")
        print(f"   • Payment modes, backup logs, and more!")
        print(f"\n🌐 Frontend ready for testing at: http://localhost:8080")
        print(f"   - Student Management: Full population with diverse data")
        print(f"   - Class Management: All grades with assigned teachers")
        print(f"   - Teacher Management: 15 teachers across subjects")
        print(f"   - Payment Dashboard: Fees and payment records")
        print(f"   - Reports: Rich data for analytics")
        
    except Exception as e:
        print(f"❌ Error during data population: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()