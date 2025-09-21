#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

# Login to get token
response = client.post("/users/login", data={"username": "admin@springofknowledge.com", "password": "admin123"})
if response.status_code != 200:
    print(f"Login failed: {response.text}")
    sys.exit(1)

token = response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Test library endpoint
print("Testing /library/books...")
response = client.get("/library/books", headers=headers)
print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(f"Response: {response.text}")

# Test discipline endpoint  
print("\nTesting /discipline/incidents...")
response = client.get("/discipline/incidents", headers=headers)
print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(f"Response: {response.text}")

# Test inventory endpoint
print("\nTesting /inventory/assets...")
response = client.get("/inventory/assets", headers=headers)
print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(f"Response: {response.text}")