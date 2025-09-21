#!/usr/bin/env python3
"""
Test incident update functionality
"""

import requests
import json

BASE_URL = "http://localhost:8000"
TEST_USER = "admin@gmail.com"
TEST_PASSWORD = "admin123"

def login():
    response = requests.post(
        f"{BASE_URL}/users/login",
        data={"username": TEST_USER, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Login failed: {response.text}")
        return None

def test_incident_update():
    token = login()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get first incident
    print("Getting first incident...")
    response = requests.get(f"{BASE_URL}/discipline/incidents", headers=headers)
    if response.status_code != 200:
        print(f"Failed to get incidents: {response.text}")
        return
    
    incidents = response.json()
    if not incidents:
        print("No incidents found")
        return
    
    incident = incidents[0]
    incident_id = incident['id']
    print(f"Found incident: {incident['title']} (ID: {incident_id})")
    print(f"Current status: {incident.get('status', 'N/A')}")
    print(f"Current is_resolved: {incident.get('is_resolved', 'N/A')}")
    
    # Test updating title
    print("\n--- Testing title update ---")
    update_data = {"title": f"Updated: {incident['title']} - {incident_id[:8]}"}
    
    response = requests.put(
        f"{BASE_URL}/discipline/incidents/{incident_id}",
        json=update_data,
        headers=headers
    )
    
    if response.status_code == 200:
        updated = response.json()
        print(f"✓ Title update successful: {updated['title']}")
    else:
        print(f"✗ Title update failed: {response.status_code} - {response.text}")
        return
    
    # Test updating status
    print("\n--- Testing status update ---")
    new_status = "resolved" if incident.get('status') != "resolved" else "open"
    update_data = {"status": new_status}
    
    response = requests.put(
        f"{BASE_URL}/discipline/incidents/{incident_id}",
        json=update_data,
        headers=headers
    )
    
    if response.status_code == 200:
        updated = response.json()
        print(f"✓ Status update successful:")
        print(f"  - Status: {updated['status']}")
        print(f"  - Resolved: {updated.get('is_resolved', 'N/A')}")
    else:
        print(f"✗ Status update failed: {response.status_code} - {response.text}")
    
    # Test full form data update (simulate frontend form)
    print("\n--- Testing full form data update ---")
    form_data = {
        "title": f"Form Update Test - {incident_id[:8]}",
        "description": "Testing full form update from frontend",
        "status": "under_investigation",
        "severity": "moderate",
        "location": "Test Location"
    }
    
    response = requests.put(
        f"{BASE_URL}/discipline/incidents/{incident_id}",
        json=form_data,
        headers=headers
    )
    
    if response.status_code == 200:
        updated = response.json()
        print(f"✓ Full form update successful:")
        print(f"  - Title: {updated['title']}")
        print(f"  - Status: {updated['status']}")
        print(f"  - Severity: {updated['severity']}")
        print(f"  - Resolved: {updated.get('is_resolved', 'N/A')}")
    else:
        print(f"✗ Full form update failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    test_incident_update()