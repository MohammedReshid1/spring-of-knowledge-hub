#!/usr/bin/env python3
"""
Create test data for academic calendar and exams
"""
import requests
import json
from datetime import datetime, date

def create_test_data():
    """Create comprehensive test data"""
    print("🏗️  Creating Test Data for Academic Calendar & Exams")
    print("=" * 60)
    
    # Login first
    login_data = {
        "username": "superadmin@springofknowledge.com",
        "password": "SuperAdmin123!"
    }
    
    response = requests.post("http://localhost:8000/users/login", data=login_data)
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return
    
    result = response.json()
    token = result['access_token']
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"✅ Logged in successfully")
    
    # Get current academic year
    response = requests.get("http://localhost:8000/academic-calendar/academic-years/current", headers=headers)
    if response.status_code != 200:
        print(f"❌ Failed to get academic year: {response.status_code}")
        return
    
    academic_year = response.json()
    academic_year_id = academic_year['id']
    print(f"📅 Using Academic Year: {academic_year.get('name', 'Unnamed')} (ID: {academic_year_id})")
    
    # Get available subjects and classes
    subjects_response = requests.get("http://localhost:8000/subjects/", headers=headers)
    classes_response = requests.get("http://localhost:8000/classes/", headers=headers)
    
    if subjects_response.status_code == 200 and classes_response.status_code == 200:
        subjects = subjects_response.json()
        classes = classes_response.json()
        print(f"📚 Found {len(subjects)} subjects and {len(classes)} classes")
    else:
        print("❌ Failed to get subjects or classes")
        return
    
    # Create some academic events first
    print("\n🎯 Creating Academic Events...")
    events_to_create = [
        {
            "title": "First Term Starts",
            "description": "Beginning of the first academic term",
            "event_type": "academic",
            "start_date": "2024-09-01T08:00:00",
            "end_date": "2024-09-01T09:00:00",
            "is_all_day": False,
            "academic_year_id": academic_year_id,
            "color": "#4CAF50",
            "is_public": True
        },
        {
            "title": "Mid-Term Break",
            "description": "Mid-term break for students",
            "event_type": "holiday",
            "start_date": "2024-10-15T00:00:00",
            "end_date": "2024-10-20T23:59:59",
            "is_all_day": True,
            "academic_year_id": academic_year_id,
            "color": "#FF9800",
            "is_public": True
        },
        {
            "title": "Parent-Teacher Meeting",
            "description": "Quarterly parent-teacher conferences",
            "event_type": "meeting",
            "start_date": "2024-11-15T14:00:00",
            "end_date": "2024-11-15T17:00:00",
            "is_all_day": False,
            "academic_year_id": academic_year_id,
            "color": "#2196F3",
            "is_public": True
        }
    ]
    
    created_events = []
    for event_data in events_to_create:
        response = requests.post("http://localhost:8000/academic-calendar/events", 
                               headers=headers, json=event_data)
        if response.status_code == 200:
            event = response.json()
            created_events.append(event)
            print(f"  ✅ Created event: {event_data['title']}")
        else:
            print(f"  ❌ Failed to create event: {event_data['title']} ({response.status_code})")
    
    # Create exams if we have subjects and classes
    if subjects and classes:
        print(f"\n📝 Creating Test Exams...")
        
        # Take first few subjects and classes for testing
        test_subjects = subjects[:3]  # First 3 subjects
        test_classes = classes[:2]    # First 2 classes
        
        exam_types = ["mid_term", "final", "quiz"]
        exam_counter = 1
        
        created_exams = []
        for subject in test_subjects:
            for class_obj in test_classes:
                for exam_type in exam_types:
                    exam_data = {
                        "name": f"{subject.get('name', 'Subject')} {exam_type.replace('_', ' ').title()} - {class_obj.get('name', 'Class')}",
                        "subject_id": subject['id'],
                        "class_id": class_obj['id'],
                        "teacher_id": class_obj.get('teacher_id', ''),  # May be empty
                        "exam_type": exam_type,
                        "total_marks": 100,
                        "passing_marks": 40,
                        "exam_date": f"2024-{10 + (exam_counter % 2):02d}-{15 + (exam_counter % 10):02d}",
                        "duration_minutes": 90,
                        "instructions": f"Instructions for {exam_type} examination",
                        "academic_year": "2024-2025",
                        "term": "first_term",
                        "is_active": True
                    }
                    
                    response = requests.post("http://localhost:8000/exams/", 
                                           headers=headers, json=exam_data)
                    if response.status_code == 200:
                        exam = response.json()
                        created_exams.append(exam)
                        print(f"  ✅ Created exam: {exam_data['name'][:50]}...")
                        exam_counter += 1
                        
                        # Stop after creating 8 exams
                        if len(created_exams) >= 8:
                            break
                    else:
                        print(f"  ❌ Failed to create exam: {exam_data['name'][:50]}... ({response.status_code})")
                
                if len(created_exams) >= 8:
                    break
            if len(created_exams) >= 8:
                break
    
    # Summary
    print(f"\n📊 Test Data Creation Summary:")
    print(f"  🎯 Academic Events: {len(created_events)} created")
    print(f"  📝 Exams: {len(created_exams) if 'created_exams' in locals() else 0} created")
    print(f"  📅 Academic Year: Using existing year")
    
    print(f"\n🎯 Ready for Testing:")
    print(f"  - Calendar Page: http://localhost:8080/calendar")
    print(f"  - Exams Page: http://localhost:8080/exams")
    print(f"  - Both pages should now show test data")

if __name__ == "__main__":
    create_test_data()