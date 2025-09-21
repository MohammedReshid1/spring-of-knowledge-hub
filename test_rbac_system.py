#!/usr/bin/env python3
"""
Comprehensive RBAC (Role-Based Access Control) Testing Script
Tests authentication, authorization, and permission enforcement across the system.
"""

import asyncio
import aiohttp
import json
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

class Role(Enum):
    SUPER_ADMIN = "super_admin"
    HQ_ADMIN = "hq_admin"
    BRANCH_ADMIN = "branch_admin"
    HQ_REGISTRAR = "hq_registrar"
    REGISTRAR = "registrar"
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"

@dataclass
class TestUser:
    email: str
    password: str
    role: Role
    full_name: str
    branch_id: Optional[str] = None

@dataclass
class TestEndpoint:
    method: str
    path: str
    allowed_roles: List[Role]
    description: str
    requires_data: bool = False
    test_data: Optional[Dict] = None

class RBACTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
        self.test_results = []
        
        # Define test users for each role
        self.test_users = [
            TestUser("super_admin@test.com", "password123", Role.SUPER_ADMIN, "Super Admin User"),
            TestUser("hq_admin@test.com", "password123", Role.HQ_ADMIN, "HQ Admin User"),
            TestUser("branch_admin@test.com", "password123", Role.BRANCH_ADMIN, "Branch Admin User", "branch_001"),
            TestUser("registrar@test.com", "password123", Role.REGISTRAR, "Registrar User", "branch_001"),
            TestUser("teacher@test.com", "password123", Role.TEACHER, "Teacher User", "branch_001"),
            TestUser("student@test.com", "password123", Role.STUDENT, "Student User", "branch_001"),
            TestUser("parent@test.com", "password123", Role.PARENT, "Parent User", "branch_001"),
        ]
        
        # Define test endpoints with their permission requirements
        self.test_endpoints = [
            # User Management
            TestEndpoint("GET", "/users/", [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.ADMIN], "List users"),
            TestEndpoint("POST", "/users/signup", [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.ADMIN], "Create user", True, {
                "email": "test@example.com",
                "password": "password123",
                "full_name": "Test User",
                "role": "student"
            }),
            TestEndpoint("GET", "/users/me", list(Role), "Get current user info"),
            TestEndpoint("GET", "/users/roles/available", [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.ADMIN], "Get available roles"),
            
            # Student Management
            TestEndpoint("GET", "/students/", [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.HQ_REGISTRAR, Role.REGISTRAR, Role.ADMIN, Role.TEACHER], "List students"),
            TestEndpoint("POST", "/students/", [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.HQ_REGISTRAR, Role.REGISTRAR, Role.ADMIN], "Create student", True, {
                "full_name": "Test Student",
                "email": "student@test.com",
                "grade_level": "Grade 1",
                "date_of_birth": "2010-01-01"
            }),
            
            # Class Management
            TestEndpoint("GET", "/classes/", [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.HQ_REGISTRAR, Role.REGISTRAR, Role.ADMIN, Role.TEACHER, Role.STUDENT, Role.PARENT], "List classes"),
            TestEndpoint("POST", "/classes/", [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.ADMIN], "Create class", True, {
                "name": "Test Class",
                "grade_level": "Grade 1",
                "capacity": 30
            }),
            
            # Payment Management
            TestEndpoint("GET", "/registration-payments/", [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.HQ_REGISTRAR, Role.REGISTRAR, Role.ADMIN, Role.PARENT], "List payments"),
            TestEndpoint("POST", "/registration-payments/", [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.ADMIN], "Create payment", True, {
                "student_id": "test_student_id",
                "amount": 100.0,
                "payment_method": "cash"
            }),
            
            # Reports
            TestEndpoint("GET", "/stats/", [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.HQ_REGISTRAR, Role.REGISTRAR, Role.ADMIN], "Get statistics"),
            
            # Branch Management
            TestEndpoint("GET", "/branches/", [Role.SUPER_ADMIN, Role.HQ_ADMIN], "List branches"),
            TestEndpoint("POST", "/branches/", [Role.SUPER_ADMIN, Role.HQ_ADMIN], "Create branch", True, {
                "name": "Test Branch",
                "address": "123 Test St",
                "phone": "123-456-7890"
            }),
        ]

    async def setup_session(self):
        """Initialize aiohttp session"""
        self.session = aiohttp.ClientSession()

    async def cleanup_session(self):
        """Cleanup aiohttp session"""
        if self.session:
            await self.session.close()

    async def create_test_users(self):
        """Create test users in the system"""
        print("🔧 Setting up test users...")
        
        # First, login as admin to create test users
        admin_token = await self.login_user("admin@gmail.com", "admin123")
        if not admin_token:
            print("❌ Failed to login as admin for setup")
            return False
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        for user in self.test_users:
            try:
                user_data = {
                    "email": user.email,
                    "password": user.password,
                    "full_name": user.full_name,
                    "role": user.role.value,
                    "branch_id": user.branch_id
                }
                
                async with self.session.post(
                    f"{self.base_url}/users/signup",
                    json=user_data,
                    headers=headers
                ) as response:
                    if response.status in [200, 201]:
                        print(f"✅ Created test user: {user.email} ({user.role.value})")
                    elif response.status == 400:
                        # User might already exist
                        print(f"ℹ️  Test user already exists: {user.email}")
                    else:
                        print(f"⚠️  Failed to create user {user.email}: {response.status}")
                        
            except Exception as e:
                print(f"❌ Error creating user {user.email}: {e}")
        
        return True

    async def login_user(self, email: str, password: str) -> Optional[str]:
        """Login user and return access token"""
        try:
            login_data = {
                "username": email,
                "password": password,
                "grant_type": "password"
            }
            
            async with self.session.post(
                f"{self.base_url}/users/login",
                data=login_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get("access_token")
                else:
                    error_text = await response.text()
                    print(f"❌ Login failed for {email}: {response.status} - {error_text}")
                    return None
                    
        except Exception as e:
            print(f"❌ Login error for {email}: {e}")
            return None

    async def test_endpoint_access(self, user: TestUser, endpoint: TestEndpoint, token: str) -> Dict:
        """Test if user can access specific endpoint"""
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            # Prepare request
            if endpoint.requires_data and endpoint.test_data:
                if endpoint.method == "POST":
                    async with self.session.post(
                        f"{self.base_url}{endpoint.path}",
                        json=endpoint.test_data,
                        headers=headers
                    ) as response:
                        status = response.status
                        text = await response.text()
                elif endpoint.method == "PUT":
                    async with self.session.put(
                        f"{self.base_url}{endpoint.path}",
                        json=endpoint.test_data,
                        headers=headers
                    ) as response:
                        status = response.status
                        text = await response.text()
            else:
                if endpoint.method == "GET":
                    async with self.session.get(
                        f"{self.base_url}{endpoint.path}",
                        headers=headers
                    ) as response:
                        status = response.status
                        text = await response.text()
                elif endpoint.method == "DELETE":
                    async with self.session.delete(
                        f"{self.base_url}{endpoint.path}",
                        headers=headers
                    ) as response:
                        status = response.status
                        text = await response.text()
            
            # Determine if access should be allowed
            should_allow = user.role in endpoint.allowed_roles
            
            # Check result
            if should_allow:
                # User should have access
                if status in [200, 201, 204]:
                    result = "✅ PASS"
                    success = True
                elif status == 403:
                    result = "❌ FAIL - Access denied (should be allowed)"
                    success = False
                elif status == 401:
                    result = "❌ FAIL - Authentication failed"
                    success = False
                else:
                    result = f"⚠️  WARN - Unexpected status: {status}"
                    success = False
            else:
                # User should NOT have access
                if status == 403:
                    result = "✅ PASS - Correctly denied"
                    success = True
                elif status in [200, 201, 204]:
                    result = "❌ FAIL - Access allowed (should be denied)"
                    success = False
                elif status == 401:
                    result = "⚠️  WARN - Authentication failed"
                    success = False
                else:
                    result = f"⚠️  WARN - Unexpected status: {status}"
                    success = False
            
            return {
                "user": user.email,
                "role": user.role.value,
                "endpoint": f"{endpoint.method} {endpoint.path}",
                "description": endpoint.description,
                "should_allow": should_allow,
                "status_code": status,
                "result": result,
                "success": success
            }
            
        except Exception as e:
            return {
                "user": user.email,
                "role": user.role.value,
                "endpoint": f"{endpoint.method} {endpoint.path}",
                "description": endpoint.description,
                "should_allow": user.role in endpoint.allowed_roles,
                "status_code": None,
                "result": f"❌ ERROR - {str(e)}",
                "success": False
            }

    async def run_rbac_tests(self):
        """Run comprehensive RBAC tests"""
        print("🚀 Starting RBAC System Tests")
        print("=" * 60)
        
        # Setup test users
        await self.create_test_users()
        
        print("\n🔍 Testing endpoint access permissions...")
        print("-" * 60)
        
        # Test each user against each endpoint
        for user in self.test_users:
            print(f"\n📝 Testing user: {user.email} ({user.role.value})")
            
            # Login user
            token = await self.login_user(user.email, user.password)
            if not token:
                print(f"❌ Failed to login {user.email}, skipping tests")
                continue
            
            # Test each endpoint
            for endpoint in self.test_endpoints:
                result = await self.test_endpoint_access(user, endpoint, token)
                self.test_results.append(result)
                
                # Print result
                status_emoji = "✅" if result["success"] else "❌"
                print(f"  {status_emoji} {endpoint.method} {endpoint.path} - {result['result']}")

    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n" + "=" * 80)
        print("📊 RBAC TEST REPORT")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ({(passed_tests/total_tests)*100:.1f}%)")
        print(f"Failed: {failed_tests} ({(failed_tests/total_tests)*100:.1f}%)")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            print("-" * 50)
            for result in self.test_results:
                if not result["success"]:
                    print(f"• {result['user']} ({result['role']}) - {result['endpoint']}")
                    print(f"  Expected: {'Allow' if result['should_allow'] else 'Deny'}")
                    print(f"  Result: {result['result']}")
                    print()
        
        # Role-based summary
        print(f"\n📋 ROLE-BASED SUMMARY:")
        print("-" * 50)
        role_stats = {}
        for result in self.test_results:
            role = result["role"]
            if role not in role_stats:
                role_stats[role] = {"total": 0, "passed": 0}
            role_stats[role]["total"] += 1
            if result["success"]:
                role_stats[role]["passed"] += 1
        
        for role, stats in role_stats.items():
            success_rate = (stats["passed"] / stats["total"]) * 100
            print(f"{role}: {stats['passed']}/{stats['total']} ({success_rate:.1f}%)")
        
        # Endpoint-based summary
        print(f"\n🔗 ENDPOINT-BASED SUMMARY:")
        print("-" * 50)
        endpoint_stats = {}
        for result in self.test_results:
            endpoint = result["endpoint"]
            if endpoint not in endpoint_stats:
                endpoint_stats[endpoint] = {"total": 0, "passed": 0}
            endpoint_stats[endpoint]["total"] += 1
            if result["success"]:
                endpoint_stats[endpoint]["passed"] += 1
        
        for endpoint, stats in endpoint_stats.items():
            success_rate = (stats["passed"] / stats["total"]) * 100
            status_emoji = "✅" if success_rate == 100 else "❌" if success_rate < 50 else "⚠️"
            print(f"{status_emoji} {endpoint}: {stats['passed']}/{stats['total']} ({success_rate:.1f}%)")

    async def run_tests(self):
        """Main test runner"""
        try:
            await self.setup_session()
            await self.run_rbac_tests()
            self.generate_report()
        except Exception as e:
            print(f"❌ Test execution failed: {e}")
        finally:
            await self.cleanup_session()

async def main():
    """Main function"""
    print("🔒 Spring of Knowledge Hub - RBAC Testing Suite")
    print("Testing comprehensive role-based access control implementation")
    print()
    
    tester = RBACTester()
    await tester.run_tests()
    
    print("\n✨ RBAC testing completed!")

if __name__ == "__main__":
    asyncio.run(main())