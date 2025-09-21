#!/usr/bin/env python3
"""
Comprehensive Backend-Database Integration Testing
Tests each page's API endpoints and database connectivity
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def login_as_superadmin():
    """Login as superadmin and return token"""
    login_data = {
        "username": "superadmin@springofknowledge.com", 
        "password": "SuperAdmin123!"
    }
    
    response = requests.post(f"{BASE_URL}/users/login", data=login_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Superadmin login successful - Role: {result['user']['role']}")
        return result['access_token']
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_students_page_integration(token):
    """Test Students page database integration"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📚 Testing STUDENTS Page Integration")
    print("=" * 50)
    
    tests = [
        ("GET /students (paginated list)", "GET", "/students", None),
        ("GET /students/all (full list)", "GET", "/students/all", None),
        ("GET /students/stats", "GET", "/students/stats", None),
        ("GET /grade-levels (for dropdowns)", "GET", "/grade-levels", None),
        ("GET /classes (for assignments)", "GET", "/classes", None)
    ]
    
    results = {}
    for test_name, method, endpoint, data in tests:
        try:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            else:
                response = requests.post(f"{BASE_URL}{endpoint}", headers=headers, json=data)
            
            if response.status_code == 200:
                result = response.json()
                if isinstance(result, dict) and 'items' in result:
                    count = len(result['items'])
                elif isinstance(result, list):
                    count = len(result)
                else:
                    count = "data available"
                
                print(f"✅ {test_name}: {response.status_code} - {count} records")
                results[endpoint] = {"status": "success", "data": result}
            else:
                print(f"❌ {test_name}: {response.status_code} - {response.text[:100]}")
                results[endpoint] = {"status": "error", "code": response.status_code, "error": response.text}
        except Exception as e:
            print(f"❌ {test_name}: Exception - {e}")
            results[endpoint] = {"status": "exception", "error": str(e)}
    
    return results

def test_classes_page_integration(token):
    """Test Classes page database integration"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n🏫 Testing CLASSES Page Integration")
    print("=" * 50)
    
    tests = [
        ("GET /classes", "GET", "/classes", None),
        ("GET /grade-levels", "GET", "/grade-levels", None),
        ("GET /teachers", "GET", "/teachers", None),
        ("GET /subjects", "GET", "/subjects", None)
    ]
    
    results = {}
    for test_name, method, endpoint, data in tests:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                count = len(result) if isinstance(result, list) else "data available"
                print(f"✅ {test_name}: {response.status_code} - {count} records")
                results[endpoint] = {"status": "success", "data": result}
            else:
                print(f"❌ {test_name}: {response.status_code} - {response.text[:100]}")
                results[endpoint] = {"status": "error", "code": response.status_code}
        except Exception as e:
            print(f"❌ {test_name}: Exception - {e}")
            results[endpoint] = {"status": "exception", "error": str(e)}
    
    return results

def test_teachers_page_integration(token):
    """Test Teachers page database integration"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n👨‍🏫 Testing TEACHERS Page Integration")
    print("=" * 50)
    
    tests = [
        ("GET /teachers", "GET", "/teachers", None),
        ("GET /subjects", "GET", "/subjects", None),
        ("GET /classes", "GET", "/classes", None)
    ]
    
    results = {}
    for test_name, method, endpoint, data in tests:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                count = len(result) if isinstance(result, list) else "data available"
                print(f"✅ {test_name}: {response.status_code} - {count} records")
                results[endpoint] = {"status": "success", "data": result}
            else:
                print(f"❌ {test_name}: {response.status_code} - {response.text[:100]}")
                results[endpoint] = {"status": "error", "code": response.status_code}
        except Exception as e:
            print(f"❌ {test_name}: Exception - {e}")
            results[endpoint] = {"status": "exception", "error": str(e)}
    
    return results

def test_payments_page_integration(token):
    """Test Payments page database integration"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n💰 Testing PAYMENTS Page Integration")
    print("=" * 50)
    
    tests = [
        ("GET /registration-payments", "GET", "/registration-payments", None),
        ("GET /fees", "GET", "/fees", None),
        ("GET /payment-mode", "GET", "/payment-mode", None),
        ("GET /students/all (for payment assignments)", "GET", "/students/all", None)
    ]
    
    results = {}
    for test_name, method, endpoint, data in tests:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                count = len(result) if isinstance(result, list) else "data available"
                print(f"✅ {test_name}: {response.status_code} - {count} records")
                results[endpoint] = {"status": "success", "data": result}
            else:
                print(f"❌ {test_name}: {response.status_code} - {response.text[:100]}")
                results[endpoint] = {"status": "error", "code": response.status_code}
        except Exception as e:
            print(f"❌ {test_name}: Exception - {e}")
            results[endpoint] = {"status": "exception", "error": str(e)}
    
    return results

def test_dashboard_integration(token):
    """Test Dashboard statistics integration"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📊 Testing DASHBOARD Integration")
    print("=" * 50)
    
    tests = [
        ("GET /stats (main dashboard stats)", "GET", "/stats", None),
        ("GET /students/stats", "GET", "/students/stats", None),
        ("GET /classes (for class count)", "GET", "/classes", None),
        ("GET /teachers (for teacher count)", "GET", "/teachers", None)
    ]
    
    results = {}
    for test_name, method, endpoint, data in tests:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ {test_name}: {response.status_code} - Data loaded")
                results[endpoint] = {"status": "success", "data": result}
            else:
                print(f"❌ {test_name}: {response.status_code} - {response.text[:100]}")
                results[endpoint] = {"status": "error", "code": response.status_code}
        except Exception as e:
            print(f"❌ {test_name}: Exception - {e}")
            results[endpoint] = {"status": "exception", "error": str(e)}
    
    return results

def test_database_connectivity():
    """Test basic database connectivity"""
    print(f"\n🗄️ Testing Database Connectivity")
    print("=" * 50)
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Backend health check: OK")
            return True
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend connectivity failed: {e}")
        return False

def analyze_issues(all_results):
    """Analyze all test results and identify patterns"""
    print(f"\n🔍 Issue Analysis")
    print("=" * 50)
    
    total_tests = 0
    failed_tests = 0
    error_patterns = {}
    
    for page, results in all_results.items():
        for endpoint, result in results.items():
            total_tests += 1
            if result['status'] != 'success':
                failed_tests += 1
                error_type = result.get('code', result.get('error', 'unknown'))
                if error_type in error_patterns:
                    error_patterns[error_type] += 1
                else:
                    error_patterns[error_type] = 1
    
    print(f"📊 Test Summary:")
    print(f"   Total tests: {total_tests}")
    print(f"   Successful: {total_tests - failed_tests}")
    print(f"   Failed: {failed_tests}")
    print(f"   Success rate: {((total_tests - failed_tests) / total_tests * 100):.1f}%")
    
    if error_patterns:
        print(f"\n❌ Common Error Patterns:")
        for error, count in error_patterns.items():
            print(f"   {error}: {count} occurrences")
    
    return {
        'total': total_tests,
        'failed': failed_tests,
        'patterns': error_patterns
    }

def main():
    print("🔧 Backend-Database Integration Comprehensive Test")
    print("=" * 70)
    
    # Test basic connectivity first
    if not test_database_connectivity():
        print("❌ Cannot proceed - backend not responding")
        return
    
    # Login
    token = login_as_superadmin()
    if not token:
        print("❌ Cannot proceed - authentication failed")
        return
    
    # Test each page integration
    all_results = {}
    all_results['dashboard'] = test_dashboard_integration(token)
    all_results['students'] = test_students_page_integration(token)
    all_results['classes'] = test_classes_page_integration(token)
    all_results['teachers'] = test_teachers_page_integration(token)
    all_results['payments'] = test_payments_page_integration(token)
    
    # Analyze results
    analysis = analyze_issues(all_results)
    
    print(f"\n🎯 Recommendations:")
    if analysis['failed'] == 0:
        print("✅ All backend integrations working correctly!")
    else:
        print("❌ Issues found - systematic fixes needed:")
        print("   1. Check MongoDB connection and collections")
        print("   2. Verify API router registrations")
        print("   3. Check branch isolation logic")
        print("   4. Validate data models and serialization")
    
    print(f"\n🌐 Frontend testing: http://localhost:8080")

if __name__ == "__main__":
    main()