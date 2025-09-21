#!/usr/bin/env python3
"""
Test script for the Behavior Management System
Tests all endpoints and functionality
"""

import requests
import json
from datetime import datetime, date, timedelta
import random

BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/discipline"

# Test credentials
USERNAME = "admin"
PASSWORD = "admin123"

def get_auth_headers():
    """Get authentication headers"""
    login_data = {
        "username": "admin@school.com",  # Use email for login
        "password": PASSWORD
    }
    response = requests.post(f"{BASE_URL}/users/login", data=login_data)
    if response.status_code == 200:
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    else:
        print(f"❌ Login failed: {response.text}")
        return None

def test_incidents():
    """Test incident management endpoints"""
    print("\n📋 Testing Incident Management...")
    headers = get_auth_headers()
    if not headers:
        return False
    
    # Create an incident
    incident_data = {
        "student_id": "675fa3f4a1e3c4b5d6e7f8a9",  # Sample student ID
        "reported_by": "teacher123",
        "incident_type": "behavioral",
        "severity": "moderate",
        "title": "Classroom Disruption",
        "description": "Student was repeatedly talking during lesson despite warnings",
        "location": "Classroom 5A",
        "incident_date": datetime.now().isoformat(),
        "witnesses": ["teacher456", "student789"],
        "immediate_action_taken": "Verbal warning given, student moved to different seat",
        "parent_contacted": True,
        "parent_contact_method": "phone",
        "parent_contact_date": datetime.now().isoformat(),
        "is_resolved": False,
        "follow_up_required": True,
        "follow_up_date": (date.today() + timedelta(days=3)).isoformat()
    }
    
    print("  Creating incident...")
    response = requests.post(f"{API_URL}/incidents", json=incident_data, headers=headers)
    if response.status_code == 200:
        incident = response.json()
        print(f"  ✅ Incident created: {incident['incident_code']}")
        incident_id = incident['id']
        
        # Get incident details
        response = requests.get(f"{API_URL}/incidents/{incident_id}", headers=headers)
        if response.status_code == 200:
            print(f"  ✅ Retrieved incident details")
        
        # Update incident status
        update_data = {
            "status": "under_investigation",
            "assigned_to": "counselor001"
        }
        response = requests.put(f"{API_URL}/incidents/{incident_id}", json=update_data, headers=headers)
        if response.status_code == 200:
            print(f"  ✅ Updated incident status")
        
        # List incidents
        response = requests.get(f"{API_URL}/incidents", headers=headers)
        if response.status_code == 200:
            incidents = response.json()
            print(f"  ✅ Listed {len(incidents)} incident(s)")
        
        return True
    else:
        print(f"  ❌ Failed to create incident: {response.text}")
        return False

def test_behavior_points():
    """Test behavior points system"""
    print("\n⭐ Testing Behavior Points System...")
    headers = get_auth_headers()
    if not headers:
        return False
    
    # Award positive points
    positive_point_data = {
        "student_id": "675fa3f4a1e3c4b5d6e7f8a9",
        "awarded_by": "teacher123",
        "point_type": "positive",
        "category": "participation",
        "points": 10,
        "reason": "Excellent class participation",
        "description": "Student volunteered to help peers with difficult concepts",
        "date_awarded": date.today().isoformat(),
        "class_id": "math101",
        "is_visible_to_student": True,
        "is_visible_to_parent": True
    }
    
    print("  Awarding positive points...")
    response = requests.post(f"{API_URL}/behavior-points", json=positive_point_data, headers=headers)
    if response.status_code == 200:
        point = response.json()
        print(f"  ✅ Positive points awarded: {point['point_code']}")
    else:
        print(f"  ❌ Failed to award positive points: {response.text}")
        return False
    
    # Deduct negative points
    negative_point_data = {
        "student_id": "675fa3f4a1e3c4b5d6e7f8a9",
        "awarded_by": "teacher456",
        "point_type": "negative",
        "category": "behavioral",
        "points": -5,
        "reason": "Late to class",
        "date_awarded": date.today().isoformat(),
        "is_visible_to_student": True,
        "is_visible_to_parent": True
    }
    
    print("  Deducting negative points...")
    response = requests.post(f"{API_URL}/behavior-points", json=negative_point_data, headers=headers)
    if response.status_code == 200:
        point = response.json()
        print(f"  ✅ Negative points deducted: {point['point_code']}")
    
    # List behavior points
    response = requests.get(f"{API_URL}/behavior-points", headers=headers)
    if response.status_code == 200:
        points = response.json()
        print(f"  ✅ Listed {len(points)} behavior point(s)")
    
    return True

def test_rewards():
    """Test rewards system"""
    print("\n🏆 Testing Rewards System...")
    headers = get_auth_headers()
    if not headers:
        return False
    
    reward_data = {
        "student_id": "675fa3f4a1e3c4b5d6e7f8a9",
        "awarded_by": "principal001",
        "reward_type": "certificate",
        "title": "Student of the Month",
        "description": "Outstanding academic performance and behavior",
        "criteria_met": "Maintained A+ grades and perfect attendance",
        "date_awarded": date.today().isoformat(),
        "category": "academic_excellence",
        "is_public": True,
        "presentation_date": (date.today() + timedelta(days=7)).isoformat()
    }
    
    print("  Creating reward...")
    response = requests.post(f"{API_URL}/rewards", json=reward_data, headers=headers)
    if response.status_code == 200:
        reward = response.json()
        print(f"  ✅ Reward created: {reward['reward_code']}")
    else:
        print(f"  ❌ Failed to create reward: {response.text}")
        return False
    
    # List rewards
    response = requests.get(f"{API_URL}/rewards", headers=headers)
    if response.status_code == 200:
        rewards = response.json()
        print(f"  ✅ Listed {len(rewards)} reward(s)")
    
    return True

def test_counseling_sessions():
    """Test counseling sessions"""
    print("\n💬 Testing Counseling Sessions...")
    headers = get_auth_headers()
    if not headers:
        return False
    
    session_data = {
        "student_id": "675fa3f4a1e3c4b5d6e7f8a9",
        "counselor_id": "counselor001",
        "session_type": "individual",
        "reason": "behavioral",
        "title": "Behavior Improvement Discussion",
        "session_date": (datetime.now() + timedelta(days=2)).isoformat(),
        "duration_minutes": 45,
        "location": "Counselor's Office",
        "goals": ["Identify triggers for disruptive behavior", "Develop coping strategies"],
        "intervention_strategies": ["Positive reinforcement", "Self-monitoring chart"],
        "next_session_date": (datetime.now() + timedelta(days=9)).isoformat(),
        "risk_level": "moderate",
        "confidentiality_level": "standard",
        "parent_involvement_required": True,
        "follow_up_required": True
    }
    
    print("  Scheduling counseling session...")
    response = requests.post(f"{API_URL}/counseling-sessions", json=session_data, headers=headers)
    if response.status_code == 200:
        session = response.json()
        print(f"  ✅ Session scheduled: {session['session_code']}")
    else:
        print(f"  ❌ Failed to schedule session: {response.text}")
        return False
    
    # List sessions
    response = requests.get(f"{API_URL}/counseling-sessions", headers=headers)
    if response.status_code == 200:
        sessions = response.json()
        print(f"  ✅ Listed {len(sessions)} session(s)")
    
    return True

def test_behavior_contracts():
    """Test behavior contracts"""
    print("\n📝 Testing Behavior Contracts...")
    headers = get_auth_headers()
    if not headers:
        return False
    
    contract_data = {
        "student_id": "675fa3f4a1e3c4b5d6e7f8a9",
        "created_by": "counselor001",
        "contract_type": "behavioral",
        "title": "Classroom Behavior Improvement Plan",
        "description": "A contract to improve classroom behavior and academic engagement",
        "goals": [
            "Reduce classroom disruptions by 80%",
            "Complete all assignments on time",
            "Participate positively in group activities"
        ],
        "expectations": [
            "Raise hand before speaking",
            "Stay seated during lessons",
            "Complete homework daily"
        ],
        "consequences": [
            "Loss of privileges if contract is violated",
            "Parent conference required",
            "Possible detention"
        ],
        "rewards": [
            "Extra computer time",
            "Lunch with favorite teacher",
            "Special recognition certificate"
        ],
        "start_date": date.today().isoformat(),
        "end_date": (date.today() + timedelta(days=30)).isoformat(),
        "review_frequency": "weekly",
        "success_criteria": [
            "No more than 2 minor incidents per week",
            "All homework submitted on time",
            "Positive teacher feedback"
        ],
        "monitoring_method": "teacher_observation",
        "parent_signature_required": True,
        "student_signature_required": True,
        "is_active": True
    }
    
    print("  Creating behavior contract...")
    response = requests.post(f"{API_URL}/behavior-contracts", json=contract_data, headers=headers)
    if response.status_code == 200:
        contract = response.json()
        print(f"  ✅ Contract created: {contract['contract_code']}")
    else:
        print(f"  ❌ Failed to create contract: {response.text}")
        return False
    
    # List contracts
    response = requests.get(f"{API_URL}/behavior-contracts", headers=headers)
    if response.status_code == 200:
        contracts = response.json()
        print(f"  ✅ Listed {len(contracts)} contract(s)")
    
    return True

def test_disciplinary_actions():
    """Test disciplinary actions"""
    print("\n⚖️ Testing Disciplinary Actions...")
    headers = get_auth_headers()
    if not headers:
        return False
    
    action_data = {
        "incident_id": "incident123",
        "student_id": "675fa3f4a1e3c4b5d6e7f8a9",
        "action_type": "detention",
        "severity_level": "level_2",
        "title": "After-school Detention",
        "description": "Student must attend detention for repeated classroom disruptions",
        "start_date": (date.today() + timedelta(days=1)).isoformat(),
        "end_date": (date.today() + timedelta(days=3)).isoformat(),
        "duration_days": 3,
        "conditions": ["Must complete reflection essay", "No extracurricular activities"],
        "assigned_by": "principal001",
        "supervised_by": "teacher789",
        "location": "Detention Room",
        "appeal_allowed": True,
        "appeal_deadline": (date.today() + timedelta(days=7)).isoformat(),
        "make_up_work_allowed": True,
        "extracurricular_restriction": True,
        "parent_notification_required": True
    }
    
    print("  Creating disciplinary action...")
    response = requests.post(f"{API_URL}/disciplinary-actions", json=action_data, headers=headers)
    if response.status_code == 200:
        action = response.json()
        print(f"  ✅ Disciplinary action created: {action['action_code']}")
    else:
        print(f"  ❌ Failed to create action: {response.text}")
        return False
    
    # List actions
    response = requests.get(f"{API_URL}/disciplinary-actions", headers=headers)
    if response.status_code == 200:
        actions = response.json()
        print(f"  ✅ Listed {len(actions)} action(s)")
    
    return True

def test_statistics():
    """Test disciplinary statistics"""
    print("\n📊 Testing Disciplinary Statistics...")
    headers = get_auth_headers()
    if not headers:
        return False
    
    response = requests.get(f"{API_URL}/stats", headers=headers)
    if response.status_code == 200:
        stats = response.json()
        print(f"  ✅ Statistics retrieved:")
        print(f"     Total Incidents: {stats['total_incidents']}")
        print(f"     Open Incidents: {stats['open_incidents']}")
        print(f"     Resolved Incidents: {stats['resolved_incidents']}")
        print(f"     Positive Behavior Points: {stats['positive_behavior_points']}")
        print(f"     Negative Behavior Points: {stats['negative_behavior_points']}")
        print(f"     Rewards Given: {stats['rewards_given']}")
        print(f"     Counseling Sessions: {stats['counseling_sessions_held']}")
        print(f"     Active Behavior Contracts: {stats['behavior_contracts_active']}")
        return True
    else:
        print(f"  ❌ Failed to get statistics: {response.text}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("🧪 BEHAVIOR MANAGEMENT SYSTEM TEST SUITE")
    print("=" * 60)
    
    all_tests_passed = True
    
    # Run tests
    tests = [
        test_incidents,
        test_behavior_points,
        test_rewards,
        test_counseling_sessions,
        test_behavior_contracts,
        test_disciplinary_actions,
        test_statistics
    ]
    
    for test in tests:
        try:
            if not test():
                all_tests_passed = False
        except Exception as e:
            print(f"  ❌ Test failed with error: {str(e)}")
            all_tests_passed = False
    
    print("\n" + "=" * 60)
    if all_tests_passed:
        print("✅ ALL TESTS PASSED!")
    else:
        print("❌ SOME TESTS FAILED - Please check the output above")
    print("=" * 60)

if __name__ == "__main__":
    main()