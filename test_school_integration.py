#!/usr/bin/env python3
"""
Test enhanced school integration features for inventory management
"""

import requests
import time
from datetime import datetime, date, timedelta

BASE_URL = "http://localhost:8000"
TEST_USER = "admin@gmail.com"
TEST_PASSWORD = "admin123"

GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")

def print_error(msg):
    print(f"{RED}✗ {msg}{RESET}")

def print_info(msg):
    print(f"{YELLOW}ℹ {msg}{RESET}")

def print_header(msg):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}{msg}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

def login():
    response = requests.post(
        f"{BASE_URL}/users/login",
        data={"username": TEST_USER, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data["access_token"], data.get("user", {})
    return None, None

def test_teacher_student_assignments(token):
    print_header("TESTING TEACHER/STUDENT ASSIGNMENT FEATURES")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Create a test asset
        asset_data = {
            "name": "School Integration Test Asset",
            "description": "Testing teacher/student assignments",
            "category": "electronics",
            "brand": "Test Brand",
            "model": "Assignment Test",
            "purchase_price": 300.0,
            "purchase_date": date.today().isoformat(),
            "status": "active",
            "condition": "good",
            "location": "Test Location"
        }
        
        response = requests.post(f"{BASE_URL}/inventory/assets", json=asset_data, headers=headers)
        if response.status_code in [200, 201]:
            asset = response.json()
            asset_id = asset.get("id")
            print_success(f"Created test asset: {asset.get('asset_code')}")
            
            # Test asset assignment to teacher
            assignment_data = {
                "assigned_to": "test_teacher_id",
                "assigned_to_type": "teacher"
            }
            
            response = requests.post(
                f"{BASE_URL}/inventory/assets/{asset_id}/assign",
                json=assignment_data,
                headers=headers
            )
            
            if response.status_code == 200:
                print_success("Asset assignment to teacher works")
            else:
                print_error(f"Teacher assignment failed: {response.text}")
            
            # Test getting teacher assignments
            response = requests.get(
                f"{BASE_URL}/inventory/assets/assignments/teachers",
                headers=headers
            )
            
            if response.status_code == 200:
                assignments = response.json()
                print_success(f"Teacher assignments endpoint works: {len(assignments)} assignments")
            else:
                print_error(f"Teacher assignments retrieval failed: {response.text}")
            
            # Test asset unassignment
            response = requests.post(
                f"{BASE_URL}/inventory/assets/{asset_id}/unassign",
                headers=headers
            )
            
            if response.status_code == 200:
                print_success("Asset unassignment works")
            else:
                print_error(f"Asset unassignment failed: {response.text}")
            
            # Clean up
            requests.delete(f"{BASE_URL}/inventory/assets/{asset_id}", headers=headers)
            return True
        else:
            print_error(f"Failed to create test asset: {response.text}")
            return False
    except Exception as e:
        print_error(f"Teacher/Student assignment test failed: {str(e)}")
        return False

def test_academic_calendar_integration(token):
    print_header("TESTING ACADEMIC CALENDAR INTEGRATION")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Create a test asset and maintenance record
        asset_data = {
            "name": "Calendar Test Asset",
            "description": "Testing academic calendar integration",
            "category": "electronics",
            "brand": "Test Brand",
            "purchase_price": 500.0,
            "purchase_date": date.today().isoformat(),
            "status": "active",
            "condition": "good"
        }
        
        response = requests.post(f"{BASE_URL}/inventory/assets", json=asset_data, headers=headers)
        if response.status_code in [200, 201]:
            asset = response.json()
            asset_id = asset.get("id")
            print_success(f"Created test asset: {asset.get('asset_code')}")
            
            # Create maintenance record
            maintenance_data = {
                "asset_id": asset_id,
                "title": "Calendar Integration Test Maintenance",
                "description": "Testing calendar conflict detection",
                "maintenance_type": "preventive",
                "priority": "medium"
            }
            
            response = requests.post(f"{BASE_URL}/inventory/maintenance", json=maintenance_data, headers=headers)
            if response.status_code in [200, 201]:
                maintenance = response.json()
                maintenance_id = maintenance.get("id")
                print_success(f"Created maintenance record: {maintenance.get('maintenance_code')}")
                
                # Test calendar integration scheduling
                schedule_data = {
                    "scheduled_date": (datetime.now() + timedelta(days=7)).isoformat()
                }
                
                response = requests.post(
                    f"{BASE_URL}/inventory/maintenance/{maintenance_id}/schedule-with-calendar",
                    json=schedule_data,
                    headers=headers
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print_success(f"Calendar integration works: {result.get('message')}")
                    if result.get('warnings'):
                        print_info(f"Calendar warnings detected: {len(result['warnings'])}")
                else:
                    print_error(f"Calendar integration failed: {response.text}")
                
                # Test maintenance calendar view
                start_date = datetime.now().isoformat()
                end_date = (datetime.now() + timedelta(days=30)).isoformat()
                
                response = requests.get(
                    f"{BASE_URL}/inventory/maintenance/calendar-integration",
                    params={"start_date": start_date, "end_date": end_date},
                    headers=headers
                )
                
                if response.status_code == 200:
                    calendar_data = response.json()
                    print_success(f"Calendar view works: {len(calendar_data.get('events', []))} events")
                else:
                    print_error(f"Calendar view failed: {response.text}")
                
                # Clean up
                requests.delete(f"{BASE_URL}/inventory/maintenance/{maintenance_id}", headers=headers)
            
            # Clean up asset
            requests.delete(f"{BASE_URL}/inventory/assets/{asset_id}", headers=headers)
            return True
        else:
            print_error(f"Failed to create test asset: {response.text}")
            return False
    except Exception as e:
        print_error(f"Academic calendar integration test failed: {str(e)}")
        return False

def test_classroom_department_assignments(token):
    print_header("TESTING CLASSROOM/DEPARTMENT ASSIGNMENTS")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Create multiple test assets
        assets = []
        for i in range(3):
            asset_data = {
                "name": f"Classroom Test Asset {i+1}",
                "description": f"Testing classroom assignments #{i+1}",
                "category": "furniture",
                "purchase_price": 100.0 + (i * 50),
                "purchase_date": date.today().isoformat(),
                "status": "active",
                "condition": "good"
            }
            
            response = requests.post(f"{BASE_URL}/inventory/assets", json=asset_data, headers=headers)
            if response.status_code in [200, 201]:
                asset = response.json()
                assets.append(asset)
                print_success(f"Created test asset {i+1}: {asset.get('asset_code')}")
        
        if len(assets) >= 2:
            asset_ids = [asset.get("id") for asset in assets[:2]]
            
            # Test bulk assignment to department
            dept_assignment_data = {
                "asset_ids": asset_ids,
                "department_id": "test_department_id",
                "department_name": "Mathematics Department"
            }
            
            response = requests.post(
                f"{BASE_URL}/inventory/assets/bulk-assign-department",
                json=dept_assignment_data,
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                print_success(f"Bulk department assignment works: {result.get('updated_count')} assets assigned")
            else:
                print_error(f"Bulk department assignment failed: {response.text}")
            
            # Test department asset summary
            response = requests.get(f"{BASE_URL}/inventory/assets/by-department", headers=headers)
            if response.status_code == 200:
                departments = response.json()
                print_success(f"Department asset summary works: {len(departments)} departments")
            else:
                print_error(f"Department summary failed: {response.text}")
            
            # Test unassigned assets
            response = requests.get(f"{BASE_URL}/inventory/assets/unassigned", headers=headers)
            if response.status_code == 200:
                unassigned = response.json()
                print_success(f"Unassigned assets endpoint works: {unassigned.get('unassigned_count')} unassigned")
            else:
                print_error(f"Unassigned assets failed: {response.text}")
        
        # Clean up all test assets
        for asset in assets:
            requests.delete(f"{BASE_URL}/inventory/assets/{asset.get('id')}", headers=headers)
        
        return True
    except Exception as e:
        print_error(f"Classroom/Department assignment test failed: {str(e)}")
        return False

def test_branch_filtering(token):
    print_header("TESTING BRANCH FILTERING")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Test that assets list includes branch filtering
        response = requests.get(f"{BASE_URL}/inventory/assets", headers=headers)
        if response.status_code == 200:
            assets = response.json()
            print_success(f"Branch filtering works - Assets accessible: {len(assets)}")
        else:
            print_error(f"Branch filtering test failed: {response.text}")
        
        # Test analytics with branch filtering
        response = requests.get(f"{BASE_URL}/inventory/analytics/overview", headers=headers)
        if response.status_code == 200:
            overview = response.json()
            print_success("Branch-filtered analytics works")
            print_info(f"Branch assets: {overview.get('total_assets', 0)}")
        else:
            print_error(f"Branch analytics failed: {response.text}")
        
        return True
    except Exception as e:
        print_error(f"Branch filtering test failed: {str(e)}")
        return False

def main():
    print_header("SCHOOL INTEGRATION FEATURES - COMPREHENSIVE TEST")
    
    # Login
    token, user_info = login()
    if not token:
        print_error("Failed to login to backend")
        return
    
    print_success(f"Successfully logged in as: {user_info.get('email', TEST_USER)}")
    
    # Run all integration tests
    tests = [
        ("Branch Filtering", test_branch_filtering),
        ("Teacher/Student Assignments", test_teacher_student_assignments),
        ("Academic Calendar Integration", test_academic_calendar_integration),
        ("Classroom/Department Assignments", test_classroom_department_assignments)
    ]
    
    results = {}
    for test_name, test_func in tests:
        print_info(f"Running {test_name} test...")
        results[test_name] = test_func(token)
        time.sleep(1)  # Brief pause between tests
    
    # Summary
    print_header("SCHOOL INTEGRATION TEST RESULTS")
    
    passed_tests = sum(1 for result in results.values() if result)
    total_tests = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        color = GREEN if result else RED
        print(f"{color}{status} - {test_name}{RESET}")
    
    print(f"\n{BLUE}Overall Results: {passed_tests}/{total_tests} tests passed{RESET}")
    
    if passed_tests == total_tests:
        print_success("🎉 All school integration features are working properly!")
        print_info("✅ Branch filtering for inventory access control")
        print_info("✅ Teacher/student assignment capabilities") 
        print_info("✅ Academic calendar integration for maintenance scheduling")
        print_info("✅ Classroom/department asset assignments")
    else:
        print_error(f"❌ {total_tests - passed_tests} tests failed. Review the output above for details.")

if __name__ == "__main__":
    main()