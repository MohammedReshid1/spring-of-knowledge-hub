#!/usr/bin/env python3
"""
Test script to verify discipline management system integration
"""
import requests
import json
from datetime import datetime, timedelta

# Base URL for the API
BASE_URL = "http://localhost:8000"

# Test credentials
EMAIL = "admin@gmail.com"
PASSWORD = "admin123"

def login():
    """Login and get access token"""
    print("Logging in...")
    response = requests.post(
        f"{BASE_URL}/users/login",
        data={"username": EMAIL, "password": PASSWORD}
    )
    if response.status_code == 200:
        token = response.json()["access_token"]
        print("✓ Login successful")
        return token
    else:
        print(f"✗ Login failed: {response.status_code}")
        print(response.text)
        return None

def test_discipline_stats(headers):
    """Test discipline stats endpoint"""
    print("\n1. Testing Discipline Stats...")
    response = requests.get(f"{BASE_URL}/discipline/stats", headers=headers)
    if response.status_code == 200:
        stats = response.json()
        print("✓ Stats endpoint working")
        print(f"  - Total incidents: {stats.get('total_incidents', 0)}")
        print(f"  - Total behavior points: {stats.get('total_behavior_points', 0)}")
        print(f"  - Total rewards: {stats.get('total_rewards', 0)}")
        print(f"  - Total counseling sessions: {stats.get('total_counseling_sessions', 0)}")
        print(f"  - Active contracts: {stats.get('active_contracts', 0)}")
        return True
    else:
        print(f"✗ Stats endpoint failed: {response.status_code}")
        return False

def test_incidents_crud(headers):
    """Test incidents CRUD operations"""
    print("\n2. Testing Incidents CRUD...")
    
    # Create incident
    incident_data = {
        "student_id": "STU001",
        "incident_type": "behavioral",
        "description": "Test incident",
        "severity": "medium",
        "location": "Classroom",
        "witnesses": ["Teacher A"],
        "action_taken": "Verbal warning",
        "incident_date": datetime.now().isoformat()
    }
    
    response = requests.post(f"{BASE_URL}/discipline/incidents", headers=headers, json=incident_data)
    if response.status_code == 200:
        print("✓ Create incident successful")
        incident = response.json()
        incident_id = incident["id"]
        
        # Read incidents
        response = requests.get(f"{BASE_URL}/discipline/incidents", headers=headers)
        if response.status_code == 200:
            print("✓ Read incidents successful")
            
            # Update incident
            update_data = {"description": "Updated test incident"}
            response = requests.put(f"{BASE_URL}/discipline/incidents/{incident_id}", headers=headers, json=update_data)
            if response.status_code == 200:
                print("✓ Update incident successful")
                
                # Delete incident
                response = requests.delete(f"{BASE_URL}/discipline/incidents/{incident_id}", headers=headers)
                if response.status_code == 200:
                    print("✓ Delete incident successful")
                    return True
                else:
                    print(f"✗ Delete incident failed: {response.status_code}")
            else:
                print(f"✗ Update incident failed: {response.status_code}")
        else:
            print(f"✗ Read incidents failed: {response.status_code}")
    else:
        print(f"✗ Create incident failed: {response.status_code}")
        print(response.text)
    
    return False

def test_behavior_points_crud(headers):
    """Test behavior points CRUD operations"""
    print("\n3. Testing Behavior Points CRUD...")
    
    # Create behavior point
    point_data = {
        "student_id": "STU001",
        "point_type": "positive",
        "points": 10,
        "category": "Academic",
        "reason": "Excellent homework",
        "date_awarded": datetime.now().isoformat()
    }
    
    response = requests.post(f"{BASE_URL}/discipline/behavior-points", headers=headers, json=point_data)
    if response.status_code == 200:
        print("✓ Create behavior point successful")
        point = response.json()
        point_id = point["id"]
        
        # Read behavior points
        response = requests.get(f"{BASE_URL}/discipline/behavior-points", headers=headers)
        if response.status_code == 200:
            print("✓ Read behavior points successful")
            
            # Update behavior point
            update_data = {"points": 15}
            response = requests.put(f"{BASE_URL}/discipline/behavior-points/{point_id}", headers=headers, json=update_data)
            if response.status_code == 200:
                print("✓ Update behavior point successful")
                
                # Delete behavior point
                response = requests.delete(f"{BASE_URL}/discipline/behavior-points/{point_id}", headers=headers)
                if response.status_code == 200:
                    print("✓ Delete behavior point successful")
                    return True
                else:
                    print(f"✗ Delete behavior point failed: {response.status_code}")
            else:
                print(f"✗ Update behavior point failed: {response.status_code}")
        else:
            print(f"✗ Read behavior points failed: {response.status_code}")
    else:
        print(f"✗ Create behavior point failed: {response.status_code}")
        print(response.text)
    
    return False

def test_rewards_crud(headers):
    """Test rewards CRUD operations"""
    print("\n4. Testing Rewards CRUD...")
    
    # Create reward
    reward_data = {
        "student_id": "STU001",
        "title": "Star Student",
        "description": "Awarded for excellent behavior",
        "reward_type": "Certificate",
        "points_awarded": 50,
        "date_awarded": datetime.now().isoformat()
    }
    
    response = requests.post(f"{BASE_URL}/discipline/rewards", headers=headers, json=reward_data)
    if response.status_code == 200:
        print("✓ Create reward successful")
        reward = response.json()
        reward_id = reward["id"]
        
        # Read rewards
        response = requests.get(f"{BASE_URL}/discipline/rewards", headers=headers)
        if response.status_code == 200:
            print("✓ Read rewards successful")
            
            # Update reward
            update_data = {"points_awarded": 75}
            response = requests.put(f"{BASE_URL}/discipline/rewards/{reward_id}", headers=headers, json=update_data)
            if response.status_code == 200:
                print("✓ Update reward successful")
                
                # Delete reward
                response = requests.delete(f"{BASE_URL}/discipline/rewards/{reward_id}", headers=headers)
                if response.status_code == 200:
                    print("✓ Delete reward successful")
                    return True
                else:
                    print(f"✗ Delete reward failed: {response.status_code}")
            else:
                print(f"✗ Update reward failed: {response.status_code}")
        else:
            print(f"✗ Read rewards failed: {response.status_code}")
    else:
        print(f"✗ Create reward failed: {response.status_code}")
        print(response.text)
    
    return False

def test_counseling_sessions_crud(headers):
    """Test counseling sessions CRUD operations"""
    print("\n5. Testing Counseling Sessions CRUD...")
    
    # Create counseling session
    session_data = {
        "student_id": "STU001",
        "reason": "Academic support",
        "session_type": "individual",
        "counselor_id": "COUN001",
        "location": "Counseling Room",
        "duration_minutes": 30,
        "status": "scheduled",
        "session_date": (datetime.now() + timedelta(days=1)).isoformat()
    }
    
    response = requests.post(f"{BASE_URL}/discipline/counseling-sessions", headers=headers, json=session_data)
    if response.status_code == 200:
        print("✓ Create counseling session successful")
        session = response.json()
        session_id = session["id"]
        
        # Read counseling sessions
        response = requests.get(f"{BASE_URL}/discipline/counseling-sessions", headers=headers)
        if response.status_code == 200:
            print("✓ Read counseling sessions successful")
            
            # Update counseling session
            update_data = {"status": "completed"}
            response = requests.put(f"{BASE_URL}/discipline/counseling-sessions/{session_id}", headers=headers, json=update_data)
            if response.status_code == 200:
                print("✓ Update counseling session successful")
                
                # Delete counseling session
                response = requests.delete(f"{BASE_URL}/discipline/counseling-sessions/{session_id}", headers=headers)
                if response.status_code == 200:
                    print("✓ Delete counseling session successful")
                    return True
                else:
                    print(f"✗ Delete counseling session failed: {response.status_code}")
            else:
                print(f"✗ Update counseling session failed: {response.status_code}")
        else:
            print(f"✗ Read counseling sessions failed: {response.status_code}")
    else:
        print(f"✗ Create counseling session failed: {response.status_code}")
        print(response.text)
    
    return False

def test_behavior_contracts_crud(headers):
    """Test behavior contracts CRUD operations"""
    print("\n6. Testing Behavior Contracts CRUD...")
    
    # Create behavior contract
    contract_data = {
        "student_id": "STU001",
        "title": "Behavior Improvement Plan",
        "description": "Contract for improving classroom behavior",
        "goals": ["Complete assignments on time", "Participate in class"],
        "contract_type": "behavior",
        "status": "active",
        "start_date": datetime.now().date().isoformat(),
        "end_date": (datetime.now() + timedelta(days=30)).date().isoformat(),
        "is_active": True
    }
    
    response = requests.post(f"{BASE_URL}/discipline/behavior-contracts", headers=headers, json=contract_data)
    if response.status_code == 200:
        print("✓ Create behavior contract successful")
        contract = response.json()
        contract_id = contract["id"]
        
        # Read behavior contracts
        response = requests.get(f"{BASE_URL}/discipline/behavior-contracts", headers=headers)
        if response.status_code == 200:
            print("✓ Read behavior contracts successful")
            
            # Update behavior contract
            update_data = {"completion_percentage": 50}
            response = requests.put(f"{BASE_URL}/discipline/behavior-contracts/{contract_id}", headers=headers, json=update_data)
            if response.status_code == 200:
                print("✓ Update behavior contract successful")
                
                # Delete behavior contract
                response = requests.delete(f"{BASE_URL}/discipline/behavior-contracts/{contract_id}", headers=headers)
                if response.status_code == 200:
                    print("✓ Delete behavior contract successful")
                    return True
                else:
                    print(f"✗ Delete behavior contract failed: {response.status_code}")
            else:
                print(f"✗ Update behavior contract failed: {response.status_code}")
        else:
            print(f"✗ Read behavior contracts failed: {response.status_code}")
    else:
        print(f"✗ Create behavior contract failed: {response.status_code}")
        print(response.text)
    
    return False

def test_students_endpoint(headers):
    """Test students endpoint for useStudentName hook"""
    print("\n7. Testing Students Endpoint (for name display)...")
    
    response = requests.get(f"{BASE_URL}/students/all", headers=headers)
    if response.status_code == 200:
        students = response.json()
        print("✓ Students endpoint working")
        print(f"  - Total students: {len(students)}")
        return True
    else:
        print(f"✗ Students endpoint failed: {response.status_code}")
        return False

def main():
    print("=" * 60)
    print("DISCIPLINE MANAGEMENT SYSTEM INTEGRATION TEST")
    print("=" * 60)
    
    # Login
    token = login()
    if not token:
        print("\n✗ Cannot proceed without authentication")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Run tests
    results = []
    results.append(test_discipline_stats(headers))
    results.append(test_incidents_crud(headers))
    results.append(test_behavior_points_crud(headers))
    results.append(test_rewards_crud(headers))
    results.append(test_counseling_sessions_crud(headers))
    results.append(test_behavior_contracts_crud(headers))
    results.append(test_students_endpoint(headers))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"✓ ALL TESTS PASSED ({passed}/{total})")
        print("✓ Discipline Management System is 100% integrated!")
    else:
        print(f"✗ SOME TESTS FAILED ({passed}/{total} passed)")
        print("✗ Discipline Management System needs fixes")
    
    print("=" * 60)

if __name__ == "__main__":
    main()
