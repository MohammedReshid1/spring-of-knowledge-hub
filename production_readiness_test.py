#!/usr/bin/env python3
"""
Spring of Knowledge Hub - Production Readiness Test Suite
Comprehensive testing for production deployment readiness.
"""

import asyncio
import aiohttp
import json
import os
import sys
import time
import subprocess
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import traceback

@dataclass
class TestResult:
    category: str
    test_name: str
    status: str  # PASS, FAIL, WARN, SKIP
    message: str
    details: Optional[Dict[str, Any]] = None
    execution_time: Optional[float] = None

@dataclass 
class ProductionChecklist:
    backend_tests: List[TestResult] = field(default_factory=list)
    frontend_tests: List[TestResult] = field(default_factory=list)
    security_tests: List[TestResult] = field(default_factory=list)
    integration_tests: List[TestResult] = field(default_factory=list)
    performance_tests: List[TestResult] = field(default_factory=list)
    deployment_tests: List[TestResult] = field(default_factory=list)

class ProductionReadinessChecker:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = None
        self.checklist = ProductionChecklist()
        self.admin_token = None
        
    async def setup_session(self):
        """Initialize test session"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        
    async def cleanup_session(self):
        """Cleanup test session"""
        if self.session:
            await self.session.close()
            
    def add_result(self, category: str, test_name: str, status: str, message: str, details: Dict = None):
        """Add test result to appropriate category"""
        result = TestResult(category, test_name, status, message, details)
        
        if category == "Backend":
            self.checklist.backend_tests.append(result)
        elif category == "Frontend":
            self.checklist.frontend_tests.append(result)
        elif category == "Security":
            self.checklist.security_tests.append(result)
        elif category == "Integration":
            self.checklist.integration_tests.append(result)
        elif category == "Performance":
            self.checklist.performance_tests.append(result)
        elif category == "Deployment":
            self.checklist.deployment_tests.append(result)

    async def test_backend_health(self):
        """Test backend API health and connectivity"""
        print("🔧 Testing Backend Health...")
        
        try:
            # Test basic connectivity
            start_time = time.time()
            async with self.session.get(f"{self.base_url}/") as response:
                end_time = time.time()
                if response.status == 200:
                    self.add_result("Backend", "API Connectivity", "PASS", 
                                  f"Backend responding (response time: {end_time-start_time:.2f}s)")
                else:
                    self.add_result("Backend", "API Connectivity", "FAIL", 
                                  f"Backend returned status {response.status}")
                    return False
        except Exception as e:
            self.add_result("Backend", "API Connectivity", "FAIL", 
                          f"Cannot connect to backend: {str(e)}")
            return False
            
        # Test database connection via API
        try:
            async with self.session.get(f"{self.base_url}/users/") as response:
                if response.status in [200, 401]:  # 401 is expected without auth
                    self.add_result("Backend", "Database Connection", "PASS", 
                                  "Database accessible via API")
                else:
                    self.add_result("Backend", "Database Connection", "WARN", 
                                  f"Unexpected database response: {response.status}")
        except Exception as e:
            self.add_result("Backend", "Database Connection", "FAIL", 
                          f"Database connection test failed: {str(e)}")
            
        return True

    async def test_authentication_system(self):
        """Test authentication and login functionality"""
        print("🔐 Testing Authentication System...")
        
        # Test login endpoint
        try:
            login_data = {
                "username": "admin@gmail.com",
                "password": "admin123",
                "grant_type": "password"
            }
            
            async with self.session.post(
                f"{self.base_url}/users/login",
                data=login_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    self.admin_token = result.get("access_token")
                    user_info = result.get("user", {})
                    
                    self.add_result("Security", "Admin Login", "PASS", 
                                  f"Admin login successful, role: {user_info.get('role')}")
                else:
                    self.add_result("Security", "Admin Login", "FAIL", 
                                  f"Admin login failed with status {response.status}")
                    
        except Exception as e:
            self.add_result("Security", "Admin Login", "FAIL", 
                          f"Login test failed: {str(e)}")
            
        # Test protected endpoint without auth
        try:
            async with self.session.get(f"{self.base_url}/users/") as response:
                if response.status == 401:
                    self.add_result("Security", "Auth Protection", "PASS", 
                                  "Protected endpoints require authentication")
                else:
                    self.add_result("Security", "Auth Protection", "FAIL", 
                                  f"Protected endpoint accessible without auth: {response.status}")
        except Exception as e:
            self.add_result("Security", "Auth Protection", "WARN", 
                          f"Auth protection test inconclusive: {str(e)}")

    async def test_core_endpoints(self):
        """Test core API endpoints"""
        print("🌐 Testing Core API Endpoints...")
        
        if not self.admin_token:
            self.add_result("Backend", "Core Endpoints", "SKIP", 
                          "No admin token available for testing")
            return
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test critical endpoints
        endpoints_to_test = [
            ("GET", "/users/", "Users API"),
            ("GET", "/users/me", "Current User API"),
            ("GET", "/students/", "Students API"),
            ("GET", "/classes/", "Classes API"),
            ("GET", "/registration-payments/", "Payments API"),
            ("GET", "/stats/", "Statistics API"),
            ("GET", "/branches/", "Branches API"),
        ]
        
        for method, endpoint, description in endpoints_to_test:
            try:
                async with self.session.request(
                    method, f"{self.base_url}{endpoint}", headers=headers
                ) as response:
                    if response.status in [200, 201]:
                        self.add_result("Backend", f"{description}", "PASS", 
                                      f"{method} {endpoint} working")
                    elif response.status == 403:
                        self.add_result("Backend", f"{description}", "WARN", 
                                      f"{method} {endpoint} access denied (RBAC working)")
                    else:
                        self.add_result("Backend", f"{description}", "FAIL", 
                                      f"{method} {endpoint} returned {response.status}")
            except Exception as e:
                self.add_result("Backend", f"{description}", "FAIL", 
                              f"{method} {endpoint} error: {str(e)}")

    async def test_rbac_enforcement(self):
        """Test role-based access control"""
        print("🛡️ Testing RBAC Enforcement...")
        
        if not self.admin_token:
            self.add_result("Security", "RBAC Testing", "SKIP", 
                          "No admin token for RBAC testing")
            return
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test admin-only endpoints
        try:
            async with self.session.get(f"{self.base_url}/users/roles/available", headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    roles = result.get("available_roles", [])
                    if len(roles) > 0:
                        self.add_result("Security", "RBAC Available Roles", "PASS", 
                                      f"RBAC working, {len(roles)} roles available to admin")
                    else:
                        self.add_result("Security", "RBAC Available Roles", "WARN", 
                                      "No roles returned for admin user")
                else:
                    self.add_result("Security", "RBAC Available Roles", "FAIL", 
                                  f"Roles API returned {response.status}")
        except Exception as e:
            self.add_result("Security", "RBAC Available Roles", "FAIL", 
                          f"RBAC test failed: {str(e)}")

    def test_file_structure(self):
        """Test project file structure and dependencies"""
        print("📁 Testing File Structure...")
        
        # Check critical files exist
        critical_files = [
            ("backend/app/main.py", "Backend Main"),
            ("backend/app/db.py", "Database Configuration"),
            ("backend/app/utils/rbac.py", "RBAC System"),
            ("backend/app/utils/auth.py", "Authentication"),
            ("src/App.tsx", "Frontend App"),
            ("src/contexts/AuthContext.tsx", "Auth Context"),
            ("src/hooks/useRoleAccess.tsx", "Role Access Hook"),
            ("package.json", "Frontend Dependencies"),
            ("backend/requirements.txt", "Backend Dependencies"),
        ]
        
        for file_path, description in critical_files:
            if os.path.exists(file_path):
                self.add_result("Deployment", f"{description}", "PASS", 
                              f"{file_path} exists")
            else:
                self.add_result("Deployment", f"{description}", "FAIL", 
                              f"{file_path} missing")
                
        # Check if key directories exist
        key_directories = [
            "backend/app/models",
            "backend/app/routers", 
            "src/components",
            "src/pages",
            "src/hooks",
        ]
        
        for directory in key_directories:
            if os.path.isdir(directory):
                file_count = len([f for f in os.listdir(directory) if f.endswith(('.py', '.tsx', '.ts'))])
                self.add_result("Deployment", f"Directory {directory}", "PASS", 
                              f"Contains {file_count} files")
            else:
                self.add_result("Deployment", f"Directory {directory}", "FAIL", 
                              f"Directory missing")

    def test_dependencies(self):
        """Test that all dependencies are properly configured"""
        print("📦 Testing Dependencies...")
        
        # Check Python dependencies
        try:
            with open("backend/requirements.txt", "r") as f:
                requirements = f.read()
                critical_deps = ["fastapi", "uvicorn", "motor", "pydantic", "passlib", "python-jose"]
                
                missing_deps = []
                for dep in critical_deps:
                    if dep not in requirements:
                        missing_deps.append(dep)
                
                if not missing_deps:
                    self.add_result("Deployment", "Python Dependencies", "PASS", 
                                  f"All critical Python dependencies present")
                else:
                    self.add_result("Deployment", "Python Dependencies", "FAIL", 
                                  f"Missing dependencies: {', '.join(missing_deps)}")
        except FileNotFoundError:
            self.add_result("Deployment", "Python Dependencies", "FAIL", 
                          "requirements.txt not found")
            
        # Check Node.js dependencies
        try:
            with open("package.json", "r") as f:
                package_data = json.load(f)
                deps = package_data.get("dependencies", {})
                critical_deps = ["react", "@tanstack/react-query", "react-router-dom"]
                
                missing_deps = []
                for dep in critical_deps:
                    if dep not in deps:
                        missing_deps.append(dep)
                
                if not missing_deps:
                    self.add_result("Deployment", "Node.js Dependencies", "PASS", 
                                  f"All critical Node.js dependencies present")
                else:
                    self.add_result("Deployment", "Node.js Dependencies", "FAIL", 
                                  f"Missing dependencies: {', '.join(missing_deps)}")
        except FileNotFoundError:
            self.add_result("Deployment", "Node.js Dependencies", "FAIL", 
                          "package.json not found")

    def test_configuration_files(self):
        """Test configuration and setup files"""
        print("⚙️ Testing Configuration Files...")
        
        # Check for environment configuration
        env_files = [".env", ".env.example", ".env.local"]
        env_found = any(os.path.exists(f) for f in env_files)
        
        if env_found:
            self.add_result("Deployment", "Environment Configuration", "PASS", 
                          "Environment configuration files present")
        else:
            self.add_result("Deployment", "Environment Configuration", "WARN", 
                          "No environment configuration files found")
            
        # Check for Docker configuration
        docker_files = ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"]
        docker_found = any(os.path.exists(f) for f in docker_files)
        
        if docker_found:
            self.add_result("Deployment", "Docker Configuration", "PASS", 
                          "Docker configuration files present")
        else:
            self.add_result("Deployment", "Docker Configuration", "WARN", 
                          "No Docker configuration files found")

    async def test_data_validation(self):
        """Test data validation and sanitization"""
        print("🔍 Testing Data Validation...")
        
        if not self.admin_token:
            self.add_result("Security", "Data Validation", "SKIP", 
                          "No admin token for validation testing")
            return
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test invalid data submission
        try:
            invalid_user_data = {
                "email": "invalid-email",  # Invalid email format
                "password": "123",         # Too short password
                "full_name": "",           # Empty name
                "role": "invalid_role"     # Invalid role
            }
            
            async with self.session.post(
                f"{self.base_url}/users/signup",
                json=invalid_user_data,
                headers=headers
            ) as response:
                if response.status in [400, 422]:  # Validation error expected
                    self.add_result("Security", "Input Validation", "PASS", 
                                  "API properly validates and rejects invalid data")
                elif response.status == 200:
                    self.add_result("Security", "Input Validation", "FAIL", 
                                  "API accepts invalid data without validation")
                else:
                    self.add_result("Security", "Input Validation", "WARN", 
                                  f"Unexpected validation response: {response.status}")
        except Exception as e:
            self.add_result("Security", "Input Validation", "WARN", 
                          f"Validation test inconclusive: {str(e)}")

    def test_security_headers(self):
        """Test security headers and configurations"""
        print("🔒 Testing Security Headers...")
        
        # This would typically test CORS, CSP, etc.
        # For now, we'll check if the API responds with appropriate headers
        self.add_result("Security", "Security Headers", "WARN", 
                      "Security headers testing requires manual verification")
        
        # Check for HTTPS in production
        if self.base_url.startswith("https://"):
            self.add_result("Security", "HTTPS Configuration", "PASS", 
                          "Using HTTPS for secure communication")
        else:
            self.add_result("Security", "HTTPS Configuration", "WARN", 
                          "Using HTTP - ensure HTTPS in production")

    async def test_error_handling(self):
        """Test error handling and edge cases"""
        print("⚠️ Testing Error Handling...")
        
        # Test 404 handling
        try:
            async with self.session.get(f"{self.base_url}/nonexistent-endpoint") as response:
                if response.status == 404:
                    self.add_result("Backend", "404 Error Handling", "PASS", 
                                  "API properly handles 404 errors")
                else:
                    self.add_result("Backend", "404 Error Handling", "WARN", 
                                  f"Unexpected response to nonexistent endpoint: {response.status}")
        except Exception as e:
            self.add_result("Backend", "404 Error Handling", "WARN", 
                          f"Error handling test inconclusive: {str(e)}")

    def generate_production_report(self):
        """Generate comprehensive production readiness report"""
        print("\n" + "="*80)
        print("📊 PRODUCTION READINESS REPORT")
        print("="*80)
        
        all_tests = []
        categories = [
            ("Backend", self.checklist.backend_tests),
            ("Frontend", self.checklist.frontend_tests), 
            ("Security", self.checklist.security_tests),
            ("Integration", self.checklist.integration_tests),
            ("Performance", self.checklist.performance_tests),
            ("Deployment", self.checklist.deployment_tests),
        ]
        
        total_pass = total_fail = total_warn = total_skip = 0
        
        for category_name, tests in categories:
            if not tests:
                continue
                
            print(f"\n🔸 {category_name.upper()} TESTS")
            print("-" * 50)
            
            category_pass = category_fail = category_warn = category_skip = 0
            
            for test in tests:
                status_emoji = {
                    "PASS": "✅",
                    "FAIL": "❌", 
                    "WARN": "⚠️",
                    "SKIP": "⏭️"
                }.get(test.status, "❓")
                
                print(f"{status_emoji} {test.test_name}: {test.message}")
                
                if test.status == "PASS":
                    category_pass += 1
                elif test.status == "FAIL":
                    category_fail += 1
                elif test.status == "WARN":
                    category_warn += 1
                elif test.status == "SKIP":
                    category_skip += 1
                    
                all_tests.append(test)
            
            total_tests = len(tests)
            if total_tests > 0:
                success_rate = (category_pass / total_tests) * 100
                print(f"\n{category_name} Summary: {category_pass}/{total_tests} passed ({success_rate:.1f}%)")
                
            total_pass += category_pass
            total_fail += category_fail  
            total_warn += category_warn
            total_skip += category_skip
        
        # Overall summary
        total_tests = len(all_tests)
        if total_tests > 0:
            overall_success = (total_pass / total_tests) * 100
            
            print(f"\n" + "="*80)
            print("📈 OVERALL SUMMARY")
            print("="*80)
            print(f"Total Tests: {total_tests}")
            print(f"✅ Passed: {total_pass} ({(total_pass/total_tests)*100:.1f}%)")
            print(f"❌ Failed: {total_fail} ({(total_fail/total_tests)*100:.1f}%)")
            print(f"⚠️  Warnings: {total_warn} ({(total_warn/total_tests)*100:.1f}%)")
            print(f"⏭️  Skipped: {total_skip} ({(total_skip/total_tests)*100:.1f}%)")
            
            print(f"\n🎯 PRODUCTION READINESS SCORE: {overall_success:.1f}%")
            
            # Production readiness assessment
            if overall_success >= 90 and total_fail == 0:
                print("🚀 READY FOR PRODUCTION")
                print("✅ System meets production readiness criteria")
            elif overall_success >= 80 and total_fail <= 2:
                print("⚠️  MOSTLY READY - MINOR ISSUES")
                print("🔧 Address remaining issues before production deployment")
            elif overall_success >= 60:
                print("❌ NOT READY FOR PRODUCTION")
                print("🚨 Significant issues need to be resolved")
            else:
                print("🚨 CRITICAL ISSUES DETECTED")
                print("❌ System requires major fixes before production")
                
            # Critical recommendations
            print(f"\n📋 PRODUCTION RECOMMENDATIONS:")
            if total_fail > 0:
                print("🔴 HIGH PRIORITY:")
                for test in all_tests:
                    if test.status == "FAIL":
                        print(f"   • Fix: {test.test_name} - {test.message}")
                        
            if total_warn > 0:
                print("🟡 MEDIUM PRIORITY:")
                warn_count = 0
                for test in all_tests:
                    if test.status == "WARN" and warn_count < 5:  # Limit to top 5
                        print(f"   • Review: {test.test_name} - {test.message}")
                        warn_count += 1
                        
            print(f"\n✨ ADDITIONAL PRODUCTION STEPS:")
            print("• Set up environment variables for production")
            print("• Configure HTTPS with SSL certificates")
            print("• Set up monitoring and logging")
            print("• Implement backup strategies")
            print("• Configure auto-scaling if needed")
            print("• Set up CI/CD pipelines")
            print("• Perform load testing")
            print("• Security audit and penetration testing")
            
        return overall_success if total_tests > 0 else 0

    async def run_all_tests(self):
        """Run all production readiness tests"""
        print("🔍 Spring of Knowledge Hub - Production Readiness Check")
        print("="*80)
        print("Running comprehensive production readiness assessment...")
        print()
        
        try:
            await self.setup_session()
            
            # Backend and API tests
            if await self.test_backend_health():
                await self.test_authentication_system()
                await self.test_core_endpoints()
                await self.test_rbac_enforcement()
                await self.test_data_validation()
                await self.test_error_handling()
            
            # File system and configuration tests
            self.test_file_structure()
            self.test_dependencies()
            self.test_configuration_files()
            self.test_security_headers()
            
            # Generate final report
            score = self.generate_production_report()
            return score
            
        except Exception as e:
            print(f"❌ Critical error during testing: {e}")
            traceback.print_exc()
            return 0
        finally:
            await self.cleanup_session()

async def main():
    """Main function"""
    checker = ProductionReadinessChecker()
    score = await checker.run_all_tests()
    
    print(f"\n🏁 Testing completed with score: {score:.1f}%")
    
    # Exit with appropriate code
    if score >= 80:
        sys.exit(0)  # Success
    else:
        sys.exit(1)  # Issues found

if __name__ == "__main__":
    asyncio.run(main())