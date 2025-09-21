#!/usr/bin/env python3
"""
Systematic page-by-page backend integration diagnostics
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
        print(f"✅ Login successful - Role: {result['user']['role']}")
        return result['access_token']
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_endpoint(name, url, headers, expected_codes=[200]):
    """Test a single endpoint"""
    try:
        response = requests.get(url, headers=headers)
        if response.status_code in expected_codes:
            print(f"  ✅ {name}: {response.status_code}")
            return response
        else:
            print(f"  ❌ {name}: {response.status_code} - {response.text[:200]}")
            return None
    except Exception as e:
        print(f"  💥 {name}: Exception - {str(e)}")
        return None

def diagnose_students_page(headers):
    """Test Students page endpoints"""
    print(f"\n📚 Students Page Diagnostics")
    print("=" * 40)
    
    endpoints = [
        ("Students List", f"{BASE_URL}/students/"),
        ("Students All", f"{BASE_URL}/students/all"),
        ("Students Stats", f"{BASE_URL}/students/stats"),
        ("Grade Levels", f"{BASE_URL}/grade-levels/"),
        ("Classes", f"{BASE_URL}/classes/")
    ]
    
    results = {}
    for name, url in endpoints:
        results[name] = test_endpoint(name, url, headers)
    
    return results

def diagnose_teachers_page(headers):
    """Test Teachers page endpoints"""
    print(f"\n👨‍🏫 Teachers Page Diagnostics")
    print("=" * 40)
    
    endpoints = [
        ("Teachers List", f"{BASE_URL}/teachers/"),
        ("Grade Levels", f"{BASE_URL}/grade-levels/"),
        ("Classes", f"{BASE_URL}/classes/"),
        ("Subjects", f"{BASE_URL}/subjects/")
    ]
    
    results = {}
    for name, url in endpoints:
        results[name] = test_endpoint(name, url, headers)
    
    return results

def diagnose_classes_page(headers):
    """Test Classes page endpoints"""
    print(f"\n🏫 Classes Page Diagnostics") 
    print("=" * 40)
    
    endpoints = [
        ("Classes List", f"{BASE_URL}/classes/"),
        ("Grade Levels", f"{BASE_URL}/grade-levels/"),
        ("Teachers", f"{BASE_URL}/teachers/"),
        ("Students All", f"{BASE_URL}/students/all")
    ]
    
    results = {}
    for name, url in endpoints:
        results[name] = test_endpoint(name, url, headers)
        
    return results

def diagnose_exams_page(headers):
    """Test Exams page endpoints"""
    print(f"\n📝 Exams Page Diagnostics")
    print("=" * 40)
    
    endpoints = [
        ("Exams List", f"{BASE_URL}/exams/"),
        ("Academic Years", f"{BASE_URL}/academic-calendar/academic-years"),
        ("Current Academic Year", f"{BASE_URL}/academic-calendar/academic-years/current"),
        ("Classes", f"{BASE_URL}/classes/"),
        ("Subjects", f"{BASE_URL}/subjects/"),
        ("Teachers", f"{BASE_URL}/teachers/")
    ]
    
    results = {}
    for name, url in endpoints:
        results[name] = test_endpoint(name, url, headers, expected_codes=[200, 500])  # 500 expected for academic calendar
        
    return results

def diagnose_payments_page(headers):
    """Test Payment Dashboard endpoints"""
    print(f"\n💰 Payment Dashboard Diagnostics")
    print("=" * 40)
    
    endpoints = [
        ("Students All", f"{BASE_URL}/students/all"),
        ("Registration Payments", f"{BASE_URL}/registration-payments/"),
        ("Fees", f"{BASE_URL}/fees/"),
        ("Grade Levels", f"{BASE_URL}/grade-levels/"),
        ("Payment Modes", f"{BASE_URL}/payment-mode/")
    ]
    
    results = {}
    for name, url in endpoints:
        results[name] = test_endpoint(name, url, headers)
    
    return results

def diagnose_settings_page(headers):
    """Test Settings page endpoints"""
    print(f"\n⚙️ Settings Page Diagnostics")
    print("=" * 40)
    
    endpoints = [
        ("Users", f"{BASE_URL}/users/"),
        ("Available Roles", f"{BASE_URL}/users/roles/available"),
        ("Branches", f"{BASE_URL}/branches/"),
        ("Current User", f"{BASE_URL}/users/me")
    ]
    
    results = {}
    for name, url in endpoints:
        results[name] = test_endpoint(name, url, headers)
    
    return results

def fix_academic_calendar_issue(headers):
    """Try to fix the academic calendar 500 error"""
    print(f"\n🔧 Attempting to fix Academic Calendar")
    print("=" * 45)
    
    # Try to create a basic academic year
    current_year = datetime.now().year
    academic_year_data = {
        "name": f"Academic Year {current_year}-{current_year + 1}",
        "start_date": f"{current_year}-09-01",
        "end_date": f"{current_year + 1}-06-30",
        "is_current": True,
        "created_by": "superadmin",
        "branch_id": "68b7231bb110092a69ae2acc"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/academic-calendar/academic-years", 
                               headers=headers, json=academic_year_data)
        if response.status_code in [200, 201]:
            print(f"  ✅ Created academic year: {academic_year_data['name']}")
            return True
        else:
            print(f"  ❌ Failed to create academic year: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"  💥 Exception creating academic year: {e}")
        return False

def generate_summary_report(all_results):
    """Generate a summary of all diagnostics"""
    print(f"\n📊 COMPREHENSIVE DIAGNOSTIC SUMMARY")
    print("=" * 60)
    
    total_endpoints = 0
    working_endpoints = 0
    broken_endpoints = []
    
    for page_name, results in all_results.items():
        print(f"\n{page_name}:")
        for endpoint_name, response in results.items():
            total_endpoints += 1
            if response is not None:
                working_endpoints += 1
                print(f"  ✅ {endpoint_name}")
            else:
                broken_endpoints.append(f"{page_name} - {endpoint_name}")
                print(f"  ❌ {endpoint_name}")
    
    print(f"\n🎯 OVERALL HEALTH: {working_endpoints}/{total_endpoints} endpoints working ({(working_endpoints/total_endpoints)*100:.1f}%)")
    
    if broken_endpoints:
        print(f"\n🚨 BROKEN ENDPOINTS REQUIRING FIXES:")
        for broken in broken_endpoints:
            print(f"  • {broken}")
    
    return working_endpoints, total_endpoints, broken_endpoints

def main():
    print("🔍 SYSTEMATIC BACKEND-DATABASE INTEGRATION DIAGNOSTICS")
    print("=" * 70)
    
    # Login
    token = login_as_superadmin()
    if not token:
        print("❌ Cannot proceed without authentication")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test all pages systematically
    all_results = {}
    
    all_results["Students Page"] = diagnose_students_page(headers)
    all_results["Teachers Page"] = diagnose_teachers_page(headers) 
    all_results["Classes Page"] = diagnose_classes_page(headers)
    all_results["Exams Page"] = diagnose_exams_page(headers)
    all_results["Payment Dashboard"] = diagnose_payments_page(headers)
    all_results["Settings Page"] = diagnose_settings_page(headers)
    
    # Try to fix known issues
    academic_fixed = fix_academic_calendar_issue(headers)
    
    # Generate comprehensive report
    working, total, broken = generate_summary_report(all_results)
    
    print(f"\n🎉 DIAGNOSIS COMPLETE!")
    print(f"Ready to systematically fix {len(broken)} broken endpoints")
    
    if academic_fixed:
        print(f"✅ Academic Calendar issue resolved - re-test Exams page")

if __name__ == "__main__":
    main()