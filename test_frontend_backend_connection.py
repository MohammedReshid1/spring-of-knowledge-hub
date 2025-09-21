#!/usr/bin/env python3
"""
Test Frontend-Backend Connection by checking browser console and network requests
"""

import requests
import time

BASE_URL = "http://localhost:8000"

def test_cors_and_preflight():
    """Test CORS configuration and preflight requests"""
    print("🌐 Testing CORS Configuration")
    print("=" * 40)
    
    # Test CORS preflight (OPTIONS request)
    headers = {
        'Origin': 'http://localhost:8080',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type'
    }
    
    response = requests.options(f"{BASE_URL}/students", headers=headers)
    print(f"CORS Preflight: {response.status_code}")
    
    if response.status_code == 200:
        cors_headers = response.headers
        print(f"✅ CORS Headers:")
        for header, value in cors_headers.items():
            if 'access-control' in header.lower():
                print(f"   {header}: {value}")
    
    # Test actual GET request with CORS
    headers = {
        'Origin': 'http://localhost:8080',
        'Authorization': 'Bearer test'
    }
    
    response = requests.get(f"{BASE_URL}/health", headers=headers)
    print(f"CORS GET request: {response.status_code}")

def check_api_endpoints_for_frontend():
    """Check if all endpoints expected by frontend exist"""
    print(f"\n📡 Testing Frontend API Endpoints")
    print("=" * 40)
    
    endpoints_to_check = [
        "/health",
        "/users/login", 
        "/students",
        "/students/all",
        "/students/stats",
        "/classes",
        "/teachers",
        "/grade-levels",
        "/subjects",
        "/registration-payments",
        "/fees",
        "/payment-mode"
    ]
    
    for endpoint in endpoints_to_check:
        try:
            if endpoint == "/users/login":
                # POST endpoint
                response = requests.post(f"{BASE_URL}{endpoint}", data={})
                expected_codes = [422, 401]  # Expected for invalid data
            else:
                # GET endpoint
                response = requests.get(f"{BASE_URL}{endpoint}")
                expected_codes = [200, 401, 403]  # Expected codes
            
            if response.status_code in expected_codes:
                print(f"✅ {endpoint}: {response.status_code} (available)")
            else:
                print(f"❌ {endpoint}: {response.status_code} (check implementation)")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ {endpoint}: Connection error - {e}")

def create_test_api_call_script():
    """Create a simple test script that frontend can use"""
    print(f"\n🧪 Creating Frontend API Test")
    print("=" * 40)
    
    test_script = """
// Test Frontend-Backend Connection
// Run this in browser console on http://localhost:8080

async function testAPIConnection() {
    console.log('🧪 Testing Frontend-Backend Connection...');
    
    // Test 1: Health check
    try {
        const healthResponse = await fetch('http://localhost:8000/health');
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData);
    } catch (error) {
        console.error('❌ Health check failed:', error);
    }
    
    // Test 2: Students endpoint (should require auth)
    try {
        const studentsResponse = await fetch('http://localhost:8000/students');
        if (studentsResponse.status === 401) {
            console.log('✅ Students endpoint accessible (401 expected without auth)');
        } else {
            console.log('Students response status:', studentsResponse.status);
        }
    } catch (error) {
        console.error('❌ Students endpoint error:', error);
    }
    
    // Test 3: Login endpoint
    try {
        const loginResponse = await fetch('http://localhost:8000/users/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'username=test&password=test'
        });
        console.log('✅ Login endpoint accessible (status:', loginResponse.status, ')');
    } catch (error) {
        console.error('❌ Login endpoint error:', error);
    }
    
    console.log('🎯 Test complete. Check for CORS errors above.');
}

testAPIConnection();
"""
    
    with open('frontend_api_test.js', 'w') as f:
        f.write(test_script)
    
    print("✅ Created frontend_api_test.js")
    print("📋 Instructions:")
    print("   1. Open http://localhost:8080 in browser")
    print("   2. Open Developer Tools (F12)")
    print("   3. Go to Console tab")
    print("   4. Copy and paste the contents of frontend_api_test.js")
    print("   5. Press Enter to run the test")
    print("   6. Check for any CORS or connection errors")

def check_backend_logs_for_requests():
    """Simulate frontend requests and check what backend receives"""
    print(f"\n📊 Simulating Frontend Requests")
    print("=" * 40)
    
    # Simulate requests that frontend would make
    headers = {
        'Origin': 'http://localhost:8080',
        'User-Agent': 'Mozilla/5.0 (Frontend Test)',
        'Accept': 'application/json',
    }
    
    # Login simulation
    print("🔐 Simulating login...")
    login_data = {
        'username': 'superadmin@springofknowledge.com',
        'password': 'SuperAdmin123!'
    }
    response = requests.post(f"{BASE_URL}/users/login", data=login_data, headers=headers)
    
    if response.status_code == 200:
        token = response.json()['access_token']
        auth_headers = {
            **headers,
            'Authorization': f'Bearer {token}'
        }
        
        print("✅ Login successful, testing authenticated requests...")
        
        # Test endpoints that frontend uses
        test_endpoints = [
            "/students",
            "/students/all", 
            "/classes",
            "/teachers"
        ]
        
        for endpoint in test_endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=auth_headers)
            if response.status_code == 200:
                data = response.json()
                count = len(data) if isinstance(data, list) else data.get('total', 'N/A')
                print(f"✅ {endpoint}: {count} records")
            else:
                print(f"❌ {endpoint}: {response.status_code}")
    else:
        print(f"❌ Login failed: {response.status_code}")

def main():
    print("🔗 Frontend-Backend Connection Test")
    print("=" * 50)
    
    test_cors_and_preflight()
    check_api_endpoints_for_frontend()
    check_backend_logs_for_requests()
    create_test_api_call_script()
    
    print(f"\n✅ Connection test complete!")
    print("Next steps:")
    print("1. Check browser console for CORS errors")
    print("2. Verify auth token is being sent properly") 
    print("3. Check network tab in browser dev tools")

if __name__ == "__main__":
    main()