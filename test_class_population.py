#!/usr/bin/env python3
import requests
import json

# Test the student API to see if class information is populated
def test_student_api():
    base_url = "http://localhost:8000"
    
    # First, let's try to get all students
    try:
        response = requests.get(f"{base_url}/students/all")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}...")
        
        if response.status_code == 200:
            students = response.json()
            print(f"\nFound {len(students)} students")
            
            # Check if any student has class information
            for i, student in enumerate(students[:3]):  # Check first 3 students
                print(f"\nStudent {i+1}:")
                print(f"  Name: {student.get('first_name', 'N/A')}")
                print(f"  Class ID: {student.get('class_id', 'None')}")
                print(f"  Classes object: {student.get('classes', 'None')}")
                
                if student.get('classes'):
                    print(f"  Class Name: {student['classes'].get('class_name', 'N/A')}")
                else:
                    print("  No class information populated")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error testing API: {e}")

if __name__ == "__main__":
    test_student_api() 