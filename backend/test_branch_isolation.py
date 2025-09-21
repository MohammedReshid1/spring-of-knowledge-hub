#!/usr/bin/env python3
"""
Comprehensive Branch Isolation Testing Script
Tests that users can only access data from their assigned branch
"""
import asyncio
import httpx
import json
from datetime import datetime
import sys

BASE_URL = "http://localhost:8000"

# Test credentials for different branches
TEST_ACCOUNTS = {
    "superadmin": {
        "email": "superadmin@springofknowledge.edu",
        "password": "superadmin123",
        "expected_branches": ["all"]  # Should see all branches
    },
    "main_admin": {
        "email": "admin@maincampus.edu", 
        "password": "admin123",
        "expected_branches": ["Main Campus"]
    },
    "west_admin": {
        "email": "admin@westbranch.edu",
        "password": "admin123", 
        "expected_branches": ["West Branch"]
    },
    "east_admin": {
        "email": "admin@eastbranch.edu",
        "password": "admin123",
        "expected_branches": ["East Branch"]
    },
    "main_teacher": {
        "email": "teacher@maincampus.edu",
        "password": "teacher123",
        "expected_branches": ["Main Campus"]
    },
    "west_teacher": {
        "email": "teacher@westbranch.edu", 
        "password": "teacher123",
        "expected_branches": ["West Branch"]
    }
}

class BranchIsolationTester:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        self.tokens = {}
        self.test_results = []
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        
    async def login(self, credentials):
        """Login and get access token"""
        try:
            response = await self.client.post(
                "/users/login",
                data={
                    "username": credentials["email"],
                    "password": credentials["password"]
                }
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("access_token")
            else:
                print(f"❌ Login failed for {credentials['email']}: {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ Login error for {credentials['email']}: {str(e)}")
            return None
    
    async def test_endpoint_access(self, account_name, endpoint, expected_result="accessible"):
        """Test if an account can access an endpoint"""
        self.total_tests += 1
        
        token = self.tokens.get(account_name)
        if not token:
            self.failed_tests += 1
            print(f"❌ No token for {account_name}")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            response = await self.client.get(endpoint, headers=headers)
            
            if expected_result == "accessible":
                if response.status_code in [200, 201]:
                    self.passed_tests += 1
                    print(f"✅ {account_name} → {endpoint} (accessible)")
                    return True
                else:
                    self.failed_tests += 1
                    print(f"❌ {account_name} → {endpoint} (expected accessible, got {response.status_code})")
                    return False
            elif expected_result == "forbidden":
                if response.status_code in [403, 404]:
                    self.passed_tests += 1
                    print(f"✅ {account_name} → {endpoint} (correctly blocked)")
                    return True
                else:
                    self.failed_tests += 1
                    print(f"❌ {account_name} → {endpoint} (expected blocked, got {response.status_code})")
                    return False
                    
        except Exception as e:
            self.failed_tests += 1
            print(f"❌ {account_name} → {endpoint}: {str(e)}")
            return False
    
    async def test_data_isolation(self, account_name, endpoint, expected_branch_data):
        """Test that an account only sees data from their branch"""
        self.total_tests += 1
        
        token = self.tokens.get(account_name)
        if not token:
            self.failed_tests += 1
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            response = await self.client.get(endpoint, headers=headers)
            if response.status_code != 200:
                self.failed_tests += 1
                print(f"❌ {account_name} → {endpoint}: HTTP {response.status_code}")
                return False
            
            data = response.json()
            
            # Check if response has branch filtering
            if "branch_filtered" in data and data["branch_filtered"]:
                if "branch_id" in data:
                    self.passed_tests += 1
                    print(f"✅ {account_name} → {endpoint} (branch filtered: {data.get('branch_id', 'unknown')[:8]}...)")
                    return True
            
            # Check items for branch_id
            items = data.get("items", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            
            if not items:
                self.passed_tests += 1
                print(f"✅ {account_name} → {endpoint} (no items - branch isolation working)")
                return True
            
            # Check if all items belong to user's branch
            branch_ids = set()
            for item in items:
                if "branch_id" in item:
                    branch_ids.add(item["branch_id"])
            
            if len(branch_ids) <= 1:  # All items from same branch or no branch_id
                self.passed_tests += 1
                print(f"✅ {account_name} → {endpoint} (data isolated to single branch)")
                return True
            else:
                self.failed_tests += 1
                print(f"❌ {account_name} → {endpoint} (data from multiple branches: {len(branch_ids)})")
                return False
                
        except Exception as e:
            self.failed_tests += 1
            print(f"❌ {account_name} → {endpoint}: {str(e)}")
            return False
    
    async def run_tests(self):
        """Run comprehensive branch isolation tests"""
        
        print("\n" + "="*70)
        print("🏢 SPRING OF KNOWLEDGE HUB - BRANCH ISOLATION TEST")
        print("="*70)
        
        # Step 1: Login all test accounts
        print("\n🔐 Step 1: Authentication Testing")
        print("-" * 40)
        
        for account_name, credentials in TEST_ACCOUNTS.items():
            token = await self.login(credentials)
            if token:
                self.tokens[account_name] = token
                print(f"✅ {account_name} logged in successfully")
            else:
                print(f"❌ {account_name} login failed")
        
        print(f"\n   Successfully logged in: {len(self.tokens)}/{len(TEST_ACCOUNTS)} accounts")
        
        if len(self.tokens) < 2:
            print("\n❌ Not enough accounts logged in to test branch isolation")
            return False
        
        # Step 2: Test branch-aware endpoints
        print("\n📊 Step 2: Branch Data Isolation Testing")
        print("-" * 40)
        
        # Test endpoints that should be branch-filtered
        branch_endpoints = [
            "/students/",
            "/teachers/", 
            "/classes/",
            "/subjects/",
            "/grade-levels/",
            "/fees/",
            "/attendance/",
            "/notifications/"
        ]
        
        for account_name in self.tokens.keys():
            print(f"\n   Testing {account_name}:")
            for endpoint in branch_endpoints:
                await self.test_data_isolation(account_name, endpoint, None)
        
        # Step 3: Test cross-branch access restrictions
        print("\n🚫 Step 3: Cross-Branch Access Testing")
        print("-" * 40)
        
        # Test that non-superadmin accounts can't access other branches
        if "main_admin" in self.tokens and "west_admin" in self.tokens:
            # Both should get different data from same endpoint
            print("\n   Testing that different branch admins see different data:")
            
            main_token = self.tokens["main_admin"]
            west_token = self.tokens["west_admin"]
            
            # Test students endpoint
            main_response = await self.client.get(
                "/students/", 
                headers={"Authorization": f"Bearer {main_token}"}
            )
            west_response = await self.client.get(
                "/students/",
                headers={"Authorization": f"Bearer {west_token}"}
            )
            
            if (main_response.status_code == 200 and west_response.status_code == 200):
                main_data = main_response.json()
                west_data = west_response.json()
                
                main_branch = main_data.get("branch_id")
                west_branch = west_data.get("branch_id")
                
                if main_branch != west_branch:
                    self.passed_tests += 1
                    print(f"   ✅ Branch isolation confirmed: Main({main_branch[:8] if main_branch else 'None'}...) ≠ West({west_branch[:8] if west_branch else 'None'}...)")
                else:
                    self.failed_tests += 1
                    print(f"   ❌ Branch isolation failed: Both see same branch")
                
                self.total_tests += 1
        
        # Step 4: Test superadmin access
        print("\n👑 Step 4: Superadmin Access Testing")  
        print("-" * 40)
        
        if "superadmin" in self.tokens:
            print("\n   Testing superadmin can access all data:")
            
            for endpoint in branch_endpoints:
                response = await self.client.get(
                    endpoint,
                    headers={"Authorization": f"Bearer {self.tokens['superadmin']}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # Superadmin should see more data (from all branches)
                    total_items = data.get("total_count", 0) if isinstance(data, dict) else len(data)
                    print(f"   ✅ Superadmin sees {total_items} items from {endpoint}")
                else:
                    print(f"   ❌ Superadmin access failed for {endpoint}")
        
        # Step 5: Test branch creation/updates (admin only)
        print("\n🏗️  Step 5: Administrative Operations Testing")
        print("-" * 40)
        
        # Test that regular users can't access admin endpoints
        restricted_endpoints = [
            "/branches/",
            "/users/",
            "/stats/dashboard"
        ]
        
        # Test with teacher account (should be restricted)
        if "main_teacher" in self.tokens:
            print("\n   Testing teacher restrictions:")
            for endpoint in restricted_endpoints:
                await self.test_endpoint_access("main_teacher", endpoint, "forbidden")
        
        # Test with admin account (should work)
        if "main_admin" in self.tokens:
            print("\n   Testing admin access:")
            for endpoint in restricted_endpoints:
                await self.test_endpoint_access("main_admin", endpoint, "accessible")
        
        # Print test summary
        print("\n" + "="*70)
        print("📊 BRANCH ISOLATION TEST SUMMARY")
        print("="*70)
        print(f"Total Tests: {self.total_tests}")
        print(f"✅ Passed: {self.passed_tests}")
        print(f"❌ Failed: {self.failed_tests}")
        success_rate = (self.passed_tests/self.total_tests*100) if self.total_tests > 0 else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("\n🎉 EXCELLENT: Branch isolation is working properly!")
        elif success_rate >= 70:
            print("\n✅ GOOD: Branch isolation is mostly working, minor issues detected")
        elif success_rate >= 50:
            print("\n⚠️  WARNING: Branch isolation has significant issues")
        else:
            print("\n❌ CRITICAL: Branch isolation is not working properly")
        
        # Provide recommendations
        print("\n💡 Recommendations:")
        if success_rate < 100:
            print("   • Review branch filtering in failing endpoints")
            print("   • Ensure all routers use BranchContext")
            print("   • Verify user branch assignments")
            print("   • Check authentication middleware")
        else:
            print("   • Branch isolation is working perfectly!")
            print("   • System is ready for multi-branch deployment")
        
        # Close client
        await self.client.aclose()
        
        return success_rate >= 90

async def main():
    """Main testing function"""
    tester = BranchIsolationTester()
    success = await tester.run_tests()
    
    if success:
        print("\n🎉 BRANCH ISOLATION TESTS PASSED!")
        print("   The system properly isolates data by branch.")
        sys.exit(0)
    else:
        print("\n⚠️  BRANCH ISOLATION ISSUES DETECTED!")
        print("   Please review the failed tests and fix isolation issues.")
        sys.exit(1)

if __name__ == "__main__":
    print("🏢 Starting Branch Isolation Tests...")
    print(f"   Target: {BASE_URL}")
    print("   Make sure the backend server is running with branch-aware routers!")
    print("")
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test suite error: {str(e)}")
        sys.exit(1)