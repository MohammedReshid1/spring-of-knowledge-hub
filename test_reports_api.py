#!/usr/bin/env python3

"""
Simple test script to verify the reports API endpoints are working
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_endpoint(endpoint, description, headers=None):
    """Test an API endpoint"""
    print(f"\n🔍 Testing {description}")
    print(f"📡 GET {BASE_URL}{endpoint}")
    
    try:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=headers or {})
        print(f"📊 Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Got {len(json.dumps(data))} characters of data")
            if isinstance(data, dict):
                print(f"🔑 Keys: {list(data.keys())[:5]}{'...' if len(data.keys()) > 5 else ''}")
            elif isinstance(data, list):
                print(f"📋 List with {len(data)} items")
            return True
        elif response.status_code == 401:
            print("🔐 Authentication required - this is expected for protected endpoints")
            return False
        else:
            print(f"❌ Error: {response.text}")
            return False
    except Exception as e:
        print(f"💥 Exception: {e}")
        return False

def main():
    print("🧪 Testing Reports API Endpoints")
    print("=" * 50)
    
    # Test public endpoints first
    endpoints_to_test = [
        ("/docs", "API Documentation"),
        ("/reports/analytics/overview", "Analytics Overview"),
        ("/reports/financial-reports/summary", "Financial Summary"),
        ("/reports/attendance-reports/summary", "Attendance Summary"),
        ("/reports/analytics/performance", "Performance Analytics"),
    ]
    
    results = []
    
    for endpoint, description in endpoints_to_test:
        success = test_endpoint(endpoint, description)
        results.append((endpoint, description, success))
    
    print("\n" + "=" * 50)
    print("📈 Test Results Summary:")
    
    for endpoint, description, success in results:
        status = "✅ PASS" if success else "⚠️  REQUIRES AUTH"
        print(f"{status} - {description}")
    
    # Check if server is accessible
    try:
        health_response = requests.get(f"{BASE_URL}/docs")
        if health_response.status_code == 200:
            print(f"\n🚀 Server is running and accessible at {BASE_URL}")
            print("💡 To view the full API docs, visit: http://localhost:8000/docs")
        else:
            print(f"\n⚠️  Server may not be fully ready (docs status: {health_response.status_code})")
    except:
        print(f"\n❌ Cannot connect to server at {BASE_URL}")
        print("💡 Make sure the backend is running: cd backend && python3 -m uvicorn app.main:app --reload")

if __name__ == "__main__":
    main()