#!/usr/bin/env python3
"""
Final test to verify discipline management system integration
"""

import requests
import json
from datetime import datetime, date, timedelta
import time

# API Base URL
BASE_URL = "http://localhost:8000"

# Test user credentials
TEST_USER = "admin@gmail.com"
TEST_PASSWORD = "admin123"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def print_success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")

def print_error(msg):
    print(f"{RED}✗ {msg}{RESET}")

def print_info(msg):
    print(f"{YELLOW}ℹ {msg}{RESET}")

def login():
    """Login and get access token"""
    response = requests.post(
        f"{BASE_URL}/users/login",
        data={"username": TEST_USER, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print_error(f"Login failed: {response.text}")
        return None

def test_discipline_endpoints(token):
    """Test all discipline management endpoints"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test data
    test_student_id = "STU001"
    test_user_id = "admin"
    
    results = {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "errors": []
    }
    
    # Test 1: Create Incident
    print_info("Testing Incident Management...")
    incident_data = {
        "student_id": test_student_id,
        "reported_by": test_user_id,
        "incident_type": "behavioral",
        "severity": "minor",
        "title": "Test Incident",
        "description": "Testing incident creation",
        "location": "Classroom",
        "incident_date": datetime.now().isoformat()
    }
    
    results["total"] += 1
    try:
        response = requests.post(f"{BASE_URL}/discipline/incidents", json=incident_data, headers=headers)
        if response.status_code in [200, 201]:
            print_success("Incident created successfully")
            results["passed"] += 1
            incident_id = response.json().get("id")
        else:
            print_error(f"Incident creation failed: {response.status_code} - {response.text}")
            results["failed"] += 1
            results["errors"].append(f"Incident: {response.text}")
    except Exception as e:
        print_error(f"Incident creation error: {e}")
        results["failed"] += 1
        results["errors"].append(f"Incident: {str(e)}")
    
    # Test 2: Create Behavior Points
    print_info("Testing Behavior Points...")
    points_data = {
        "student_id": test_student_id,
        "awarded_by": test_user_id,
        "point_type": "positive",
        "category": "academic",
        "points": 10,
        "reason": "Excellent homework",
        "date_awarded": date.today().isoformat()
    }
    
    results["total"] += 1
    try:
        response = requests.post(f"{BASE_URL}/discipline/behavior-points", json=points_data, headers=headers)
        if response.status_code in [200, 201]:
            print_success("Behavior points created successfully")
            results["passed"] += 1
        else:
            print_error(f"Behavior points creation failed: {response.status_code} - {response.text}")
            results["failed"] += 1
            results["errors"].append(f"Behavior Points: {response.text}")
    except Exception as e:
        print_error(f"Behavior points creation error: {e}")
        results["failed"] += 1
        results["errors"].append(f"Behavior Points: {str(e)}")
    
    # Test 3: Create Reward
    print_info("Testing Rewards...")
    reward_data = {
        "student_id": test_student_id,
        "awarded_by": test_user_id,
        "reward_type": "certificate",
        "category": "academic_excellence",
        "title": "Outstanding Achievement",
        "description": "For excellent performance",
        "criteria_met": "100% attendance and high grades",
        "date_awarded": date.today().isoformat()
    }
    
    results["total"] += 1
    try:
        response = requests.post(f"{BASE_URL}/discipline/rewards", json=reward_data, headers=headers)
        if response.status_code in [200, 201]:
            print_success("Reward created successfully")
            results["passed"] += 1
        else:
            print_error(f"Reward creation failed: {response.status_code} - {response.text}")
            results["failed"] += 1
            results["errors"].append(f"Reward: {response.text}")
    except Exception as e:
        print_error(f"Reward creation error: {e}")
        results["failed"] += 1
        results["errors"].append(f"Reward: {str(e)}")
    
    # Test 4: Create Counseling Session
    print_info("Testing Counseling Sessions...")
    session_data = {
        "student_id": test_student_id,
        "counselor_id": test_user_id,
        "session_type": "individual",
        "reason": "behavioral",
        "title": "Initial Assessment",
        "session_date": datetime.now().isoformat(),
        "duration_minutes": 30,
        "location": "Counselor Office",
        "goals": ["Improve behavior", "Develop coping strategies"],
        "risk_level": "low",
        "confidentiality_level": "standard",
        "follow_up_required": True
    }
    
    results["total"] += 1
    try:
        response = requests.post(f"{BASE_URL}/discipline/counseling-sessions", json=session_data, headers=headers)
        if response.status_code in [200, 201]:
            print_success("Counseling session created successfully")
            results["passed"] += 1
        else:
            print_error(f"Counseling session creation failed: {response.status_code} - {response.text}")
            results["failed"] += 1
            results["errors"].append(f"Counseling: {response.text}")
    except Exception as e:
        print_error(f"Counseling session creation error: {e}")
        results["failed"] += 1
        results["errors"].append(f"Counseling: {str(e)}")
    
    # Test 5: Create Behavior Contract
    print_info("Testing Behavior Contracts...")
    contract_data = {
        "student_id": test_student_id,
        "created_by": test_user_id,
        "contract_type": "behavioral",
        "title": "Behavior Improvement Plan",
        "description": "Contract for improving classroom behavior",
        "goals": ["Follow classroom rules", "Complete assignments"],
        "expectations": ["Arrive on time", "Respect others"],
        "consequences": ["Loss of privileges", "Parent meeting"],
        "rewards": ["Extra recess", "Special recognition"],
        "start_date": date.today().isoformat(),
        "end_date": (date.today() + timedelta(days=30)).isoformat(),
        "review_frequency": "weekly",
        "success_criteria": ["80% compliance", "No major incidents"],
        "monitoring_method": "teacher_observation",
        "parent_signature_required": True,
        "student_signature_required": True
    }
    
    results["total"] += 1
    try:
        response = requests.post(f"{BASE_URL}/discipline/behavior-contracts", json=contract_data, headers=headers)
        if response.status_code in [200, 201]:
            print_success("Behavior contract created successfully")
            results["passed"] += 1
        else:
            print_error(f"Behavior contract creation failed: {response.status_code} - {response.text}")
            results["failed"] += 1
            results["errors"].append(f"Contract: {response.text}")
    except Exception as e:
        print_error(f"Behavior contract creation error: {e}")
        results["failed"] += 1
        results["errors"].append(f"Contract: {str(e)}")
    
    # Test 6: Get Disciplinary Stats
    print_info("Testing Disciplinary Stats...")
    results["total"] += 1
    try:
        response = requests.get(f"{BASE_URL}/discipline/stats", headers=headers)
        if response.status_code == 200:
            stats = response.json()
            print_success("Disciplinary stats retrieved successfully")
            print(f"  - Total incidents: {stats.get('total_incidents', 0)}")
            print(f"  - Positive behavior points: {stats.get('positive_behavior_points', 0)}")
            print(f"  - Rewards given: {stats.get('rewards_given', 0)}")
            print(f"  - Counseling sessions: {stats.get('counseling_sessions_held', 0)}")
            print(f"  - Active contracts: {stats.get('behavior_contracts_active', 0)}")
            results["passed"] += 1
        else:
            print_error(f"Stats retrieval failed: {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_error(f"Stats retrieval error: {e}")
        results["failed"] += 1
    
    return results

def main():
    print("\n" + "="*60)
    print("DISCIPLINE MANAGEMENT INTEGRATION TEST - FINAL")
    print("="*60 + "\n")
    
    # Login
    print_info("Logging in...")
    token = login()
    if not token:
        print_error("Failed to login. Exiting.")
        return
    
    print_success("Login successful\n")
    
    # Run tests
    results = test_discipline_endpoints(token)
    
    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"Total Tests: {results['total']}")
    print(f"{GREEN}Passed: {results['passed']}{RESET}")
    print(f"{RED}Failed: {results['failed']}{RESET}")
    
    if results['failed'] == 0:
        print(f"\n{GREEN}🎉 ALL TESTS PASSED! Discipline Management System is 100% integrated!{RESET}")
    else:
        print(f"\n{RED}Some tests failed. Details:{RESET}")
        for error in results['errors']:
            print(f"  - {error[:200]}...")  # Truncate long errors
    
    success_rate = (results['passed'] / results['total']) * 100 if results['total'] > 0 else 0
    print(f"\nSuccess Rate: {success_rate:.1f}%")
    
    if success_rate == 100:
        print(f"{GREEN}✨ Perfect integration achieved!{RESET}")
    elif success_rate >= 80:
        print(f"{YELLOW}⚠ Good integration, minor issues remain{RESET}")
    else:
        print(f"{RED}⚠ Integration needs more work{RESET}")

if __name__ == "__main__":
    main()