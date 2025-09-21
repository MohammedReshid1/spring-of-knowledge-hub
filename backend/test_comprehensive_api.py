#!/usr/bin/env python3
"""
Comprehensive API testing script for Spring of Knowledge Hub
Tests all endpoints to ensure the backend is 100% functional
"""
import asyncio
import httpx
import json
from datetime import datetime
import sys

BASE_URL = "http://localhost:8000"

# Test credentials
TEST_ADMIN = {
    "email": "admin@springofknowledge.edu",
    "password": "admin123"
}

TEST_TEACHER = {
    "email": "teacher@springofknowledge.edu", 
    "password": "teacher123"
}

class APITester:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        self.admin_token = None
        self.teacher_token = None
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
                print(f"❌ Login failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ Login error: {str(e)}")
            return None
    
    async def test_endpoint(self, method, endpoint, name, token=None, data=None, params=None):
        """Test a single endpoint"""
        self.total_tests += 1
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method == "GET":
                response = await self.client.get(endpoint, headers=headers, params=params)
            elif method == "POST":
                response = await self.client.post(endpoint, headers=headers, json=data)
            elif method == "PUT":
                response = await self.client.put(endpoint, headers=headers, json=data)
            elif method == "DELETE":
                response = await self.client.delete(endpoint, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if response.status_code in [200, 201, 204]:
                self.passed_tests += 1
                result = "✅ PASS"
                self.test_results.append({"name": name, "status": "PASS", "code": response.status_code})
                print(f"{result} - {name} ({response.status_code})")
                return True, response
            else:
                self.failed_tests += 1
                result = "❌ FAIL"
                self.test_results.append({"name": name, "status": "FAIL", "code": response.status_code, "error": response.text[:100]})
                print(f"{result} - {name} ({response.status_code}) - {response.text[:100]}")
                return False, response
                
        except Exception as e:
            self.failed_tests += 1
            self.test_results.append({"name": name, "status": "ERROR", "error": str(e)})
            print(f"❌ ERROR - {name}: {str(e)}")
            return False, None
    
    async def run_tests(self):
        """Run all API tests"""
        print("\n" + "="*60)
        print("🧪 SPRING OF KNOWLEDGE HUB - COMPREHENSIVE API TEST")
        print("="*60)
        
        # Test health endpoint
        print("\n📍 Testing Health Check...")
        await self.test_endpoint("GET", "/health", "Health Check")
        
        # Login as admin
        print("\n🔐 Testing Authentication...")
        self.admin_token = await self.login(TEST_ADMIN)
        if self.admin_token:
            print("✅ Admin login successful")
        else:
            print("❌ Admin login failed - some tests will be skipped")
            
        self.teacher_token = await self.login(TEST_TEACHER)
        if self.teacher_token:
            print("✅ Teacher login successful")
        
        # Test User Management
        print("\n👤 Testing User Management...")
        await self.test_endpoint("GET", "/users/me", "Get Current User", self.admin_token)
        await self.test_endpoint("GET", "/users/", "List Users", self.admin_token)
        
        # Test Branches
        print("\n🏢 Testing Branches...")
        await self.test_endpoint("GET", "/branches/", "List Branches", self.admin_token)
        success, response = await self.test_endpoint("POST", "/branches/", "Create Branch", self.admin_token, data={
            "name": "Test Branch",
            "address": "123 Test St",
            "phone": "+1-555-9999",
            "email": "test@branch.edu"
        })
        if success and response:
            branch_id = response.json().get("_id")
            await self.test_endpoint("GET", f"/branches/{branch_id}", "Get Branch", self.admin_token)
            await self.test_endpoint("PUT", f"/branches/{branch_id}", "Update Branch", self.admin_token, data={
                "name": "Updated Test Branch",
                "address": "123 Test St",
                "phone": "+1-555-9999",
                "email": "test@branch.edu"
            })
            await self.test_endpoint("DELETE", f"/branches/{branch_id}", "Delete Branch", self.admin_token)
        
        # Test Students
        print("\n👨‍🎓 Testing Students...")
        await self.test_endpoint("GET", "/students/", "List Students", self.admin_token)
        success, response = await self.test_endpoint("POST", "/students/", "Create Student", self.admin_token, data={
            "student_id": "TEST001",
            "first_name": "Test",
            "last_name": "Student",
            "date_of_birth": "2015-01-01",
            "gender": "Male",
            "address": "123 Test St",
            "guardian_name": "Test Guardian",
            "guardian_phone": "+1-555-8888",
            "guardian_email": "guardian@test.com",
            "enrollment_date": datetime.now().isoformat(),
            "status": "active"
        })
        if success and response:
            student_id = response.json().get("_id")
            await self.test_endpoint("GET", f"/students/{student_id}", "Get Student", self.admin_token)
            await self.test_endpoint("PUT", f"/students/{student_id}", "Update Student", self.admin_token, data={
                "first_name": "Updated",
                "last_name": "Student"
            })
            await self.test_endpoint("DELETE", f"/students/{student_id}", "Delete Student", self.admin_token)
        
        # Test Teachers
        print("\n👩‍🏫 Testing Teachers...")
        await self.test_endpoint("GET", "/teachers/", "List Teachers", self.admin_token)
        success, response = await self.test_endpoint("POST", "/teachers/", "Create Teacher", self.admin_token, data={
            "teacher_id": "TEST_TCH001",
            "first_name": "Test",
            "last_name": "Teacher",
            "email": "test.teacher@school.edu",
            "phone": "+1-555-7777",
            "date_of_birth": "1990-01-01",
            "gender": "Female",
            "address": "456 Test Ave",
            "hire_date": datetime.now().isoformat(),
            "qualifications": ["Bachelor in Education"],
            "status": "active"
        })
        if success and response:
            teacher_id = response.json().get("_id")
            await self.test_endpoint("GET", f"/teachers/{teacher_id}", "Get Teacher", self.admin_token)
            await self.test_endpoint("DELETE", f"/teachers/{teacher_id}", "Delete Teacher", self.admin_token)
        
        # Test Grade Levels
        print("\n📚 Testing Grade Levels...")
        await self.test_endpoint("GET", "/grade-levels/", "List Grade Levels", self.admin_token)
        
        # Test Classes
        print("\n🏫 Testing Classes...")
        await self.test_endpoint("GET", "/classes/", "List Classes", self.admin_token)
        await self.test_endpoint("GET", "/classes/suggestions", "Class Suggestions", self.admin_token)
        
        # Test Subjects
        print("\n📖 Testing Subjects...")
        await self.test_endpoint("GET", "/subjects/", "List Subjects", self.admin_token)
        
        # Test Attendance
        print("\n✅ Testing Attendance...")
        await self.test_endpoint("GET", "/attendance/", "List Attendance", self.admin_token)
        await self.test_endpoint("GET", "/attendance/summary", "Attendance Summary", self.admin_token)
        
        # Test Fees
        print("\n💰 Testing Fees...")
        await self.test_endpoint("GET", "/fees/", "List Fees", self.admin_token)
        await self.test_endpoint("GET", "/fees/summary", "Fees Summary", self.admin_token)
        
        # Test Payments
        print("\n💳 Testing Payments...")
        await self.test_endpoint("GET", "/registration-payments/", "List Payments", self.admin_token)
        await self.test_endpoint("GET", "/payment-mode/", "List Payment Modes", self.admin_token)
        
        # Test Student Enrollments
        print("\n📝 Testing Enrollments...")
        await self.test_endpoint("GET", "/student-enrollments/", "List Enrollments", self.admin_token)
        
        # Test Grade Transitions
        print("\n🎓 Testing Grade Transitions...")
        await self.test_endpoint("GET", "/grade-transitions/", "List Grade Transitions", self.admin_token)
        
        # Test Statistics
        print("\n📊 Testing Statistics...")
        await self.test_endpoint("GET", "/stats/dashboard", "Dashboard Stats", self.admin_token)
        await self.test_endpoint("GET", "/stats/overview", "Overview Stats", self.admin_token)
        
        # Test Backup Logs
        print("\n💾 Testing Backup Logs...")
        await self.test_endpoint("GET", "/backup-logs/", "List Backup Logs", self.admin_token)
        
        # Test Exams
        print("\n📝 Testing Exams...")
        await self.test_endpoint("GET", "/exams/", "List Exams", self.admin_token)
        await self.test_endpoint("GET", "/exam-results/", "List Exam Results", self.admin_token)
        
        # Test Academic Calendar
        print("\n📅 Testing Academic Calendar...")
        await self.test_endpoint("GET", "/academic-calendar/events", "List Calendar Events", self.admin_token)
        await self.test_endpoint("GET", "/academic-calendar/years", "List Academic Years", self.admin_token)
        
        # Test Communication
        print("\n💬 Testing Communication...")
        await self.test_endpoint("GET", "/communication/messages", "List Messages", self.admin_token)
        await self.test_endpoint("GET", "/communication/announcements", "List Announcements", self.admin_token)
        
        # Test Discipline
        print("\n⚖️ Testing Discipline...")
        await self.test_endpoint("GET", "/discipline/incidents", "List Incidents", self.admin_token)
        await self.test_endpoint("GET", "/discipline/actions", "List Disciplinary Actions", self.admin_token)
        await self.test_endpoint("GET", "/discipline/behavior-points", "List Behavior Points", self.admin_token)
        
        # Test Reports
        print("\n📈 Testing Reports...")
        await self.test_endpoint("GET", "/reports/student", "Student Reports", self.admin_token)
        await self.test_endpoint("GET", "/reports/class", "Class Reports", self.admin_token)
        await self.test_endpoint("GET", "/reports/financial", "Financial Reports", self.admin_token)
        
        # Test Notifications
        print("\n🔔 Testing Notifications...")
        await self.test_endpoint("GET", "/notifications/", "List Notifications", self.admin_token)
        await self.test_endpoint("GET", "/notifications/unread-count", "Unread Notification Count", self.admin_token)
        
        # Test Inventory
        print("\n📦 Testing Inventory...")
        await self.test_endpoint("GET", "/inventory/assets", "List Assets", self.admin_token)
        await self.test_endpoint("GET", "/inventory/supplies", "List Supplies", self.admin_token)
        await self.test_endpoint("GET", "/inventory/transactions", "List Inventory Transactions", self.admin_token)
        
        # Print test summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.total_tests}")
        print(f"✅ Passed: {self.passed_tests}")
        print(f"❌ Failed: {self.failed_tests}")
        print(f"Success Rate: {(self.passed_tests/self.total_tests*100):.1f}%")
        
        if self.failed_tests > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if result["status"] != "PASS":
                    error = result.get("error", "")
                    print(f"   - {result['name']}: {result.get('code', 'ERROR')} {error}")
        
        # Close client
        await self.client.aclose()
        
        return self.failed_tests == 0

async def main():
    """Main function"""
    tester = APITester()
    success = await tester.run_tests()
    
    if success:
        print("\n🎉 ALL TESTS PASSED! Backend is 100% functional!")
        sys.exit(0)
    else:
        print("\n⚠️ Some tests failed. Please check the backend implementation.")
        sys.exit(1)

if __name__ == "__main__":
    print("🚀 Starting Spring of Knowledge Hub API Tests...")
    print(f"   Target: {BASE_URL}")
    print("   Make sure the backend server is running!")
    print("")
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test suite error: {str(e)}")
        sys.exit(1)