#!/usr/bin/env python3
"""
Test Data Isolation Issues
Check if components properly isolate data by branch
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_login(email, password):
    """Login and get token"""
    response = requests.post(f"{BASE_URL}/users/login", 
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        raise Exception(f"Login failed: {response.text}")

def test_api_call(method, endpoint, token, data=None):
    """Make authenticated API call"""
    headers = {"Authorization": f"Bearer {token}"}
    if data:
        headers["Content-Type"] = "application/json"
    
    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
        elif method == "POST":
            response = requests.post(f"{BASE_URL}{endpoint}", headers=headers, json=data)
        
        return response.status_code, response.json() if response.content else {}
    except Exception as e:
        return 500, {"error": str(e)}

def main():
    print("🔍 Testing Data Isolation Issues")
    print("=" * 50)
    
    # Get tokens for different users
    try:
        super_token = test_login("superadmin@springofknowledge.edu", "superadmin123")
        print("✅ Superadmin login successful")
        
        # Try to get branch admin tokens
        admin_tokens = {}
        
        # Test Downtown Campus admin
        try:
            downtown_token = test_login("admin@downtowncampus.edu", "admin123")
            admin_tokens["downtown"] = downtown_token
            print("✅ Downtown admin login successful")
        except:
            print("⚠️  Downtown admin login failed")
        
        # Test Manual Setup Campus admin
        try:
            manual_token = test_login("admin@testmanualcampus.edu", "admin123")
            admin_tokens["manual"] = manual_token
            print("✅ Manual setup admin login successful")
        except:
            print("⚠️  Manual setup admin login failed")
            
    except Exception as e:
        print(f"❌ Login failed: {e}")
        return
    
    # Test data isolation across different endpoints
    test_endpoints = [
        "/students/",
        "/teachers/", 
        "/classes/",
        "/fees/",
        "/exams/",
        "/inventory/assets",
        "/reports/academic-reports",
        "/notifications/"
    ]
    
    print(f"\n🔍 Testing Data Isolation Across {len(test_endpoints)} Endpoints...")
    
    isolation_issues = []
    
    for endpoint in test_endpoints:
        print(f"\n--- Testing {endpoint} ---")
        
        # Test superadmin access (should see all)
        status, super_data = test_api_call("GET", endpoint, super_token)
        super_count = 0
        if status == 200:
            if isinstance(super_data, dict):
                super_count = super_data.get("total_count", len(super_data.get("items", [])))
            else:
                super_count = len(super_data) if isinstance(super_data, list) else 0
            print(f"   Superadmin sees: {super_count} items")
        else:
            print(f"   Superadmin error: {status}")
        
        # Test branch admin isolation
        branch_data = {}
        for branch_name, token in admin_tokens.items():
            status, data = test_api_call("GET", endpoint, token)
            count = 0
            if status == 200:
                if isinstance(data, dict):
                    count = data.get("total_count", len(data.get("items", [])))
                else:
                    count = len(data) if isinstance(data, list) else 0
                branch_data[branch_name] = count
                print(f"   {branch_name} admin sees: {count} items")
            else:
                print(f"   {branch_name} admin error: {status}")
        
        # Check for isolation issues
        if len(admin_tokens) >= 2:
            branch_counts = list(branch_data.values())
            if len(set(branch_counts)) == 1 and len(branch_counts) > 1 and branch_counts[0] > 0:
                # All branches see the same non-zero data - potential isolation issue
                isolation_issues.append({
                    "endpoint": endpoint,
                    "issue": "All branch admins see same data count",
                    "counts": branch_data
                })
                print(f"   ⚠️  ISOLATION ISSUE: All branches see same count ({branch_counts[0]})")
            elif any(count > 0 for count in branch_counts):
                print(f"   ✅ Branches see different data counts: {branch_data}")
    
    # Test cross-component data relationships
    print(f"\n🔗 Testing Cross-Component Data Flow...")
    
    # Check if students can be created and accessed consistently
    if "downtown" in admin_tokens:
        downtown_token = admin_tokens["downtown"]
        
        # Test student creation (if endpoint works)
        student_data = {
            "first_name": "Test",
            "last_name": "Student", 
            "student_id": "TEST001",
            "date_of_birth": "2010-01-01",
            "status": "active"
        }
        
        status, result = test_api_call("POST", "/students/", downtown_token, student_data)
        if status in [200, 201]:
            student_id = result.get("id")
            print(f"✅ Created test student: {student_id}")
            
            # Test if other components can reference this student
            test_references = [
                ("/attendance/", {"student_id": student_id, "date": "2024-09-02", "status": "present"}),
                ("/fees/", {"student_id": student_id, "amount": 100.0, "fee_type": "tuition"})
            ]
            
            for ref_endpoint, ref_data in test_references:
                status, ref_result = test_api_call("POST", ref_endpoint, downtown_token, ref_data)
                if status in [200, 201]:
                    print(f"✅ Cross-reference works: {ref_endpoint}")
                else:
                    print(f"⚠️  Cross-reference issue: {ref_endpoint} -> {status}")
        else:
            print(f"⚠️  Could not create test student: {status} - {result}")
    
    # Summary
    print("\n" + "=" * 50)
    print("🎯 Data Isolation Analysis Complete!")
    
    if isolation_issues:
        print(f"\n❌ Found {len(isolation_issues)} isolation issues:")
        for issue in isolation_issues:
            print(f"   - {issue['endpoint']}: {issue['issue']}")
            print(f"     Branch counts: {issue['counts']}")
    else:
        print("\n✅ No obvious isolation issues found")
    
    print(f"\n📊 Summary:")
    print(f"   • Tested {len(test_endpoints)} endpoints")
    print(f"   • Found {len(isolation_issues)} isolation issues")
    print(f"   • Superadmin access: Working")
    print(f"   • Branch admin access: {'Working' if admin_tokens else 'Issues'}")
    
    print(f"\n🔧 Recommendations:")
    if isolation_issues:
        print("   1. Fix branch filtering in affected endpoints")
        print("   2. Add branch_id validation to all data queries") 
        print("   3. Test cross-component data aggregation (reports)")
        print("   4. Ensure inventory and payments respect branch isolation")
    else:
        print("   1. Test more complex cross-component scenarios")
        print("   2. Verify report generation respects branch boundaries")
        print("   3. Test bulk operations maintain isolation")

if __name__ == "__main__":
    main()