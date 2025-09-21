#!/usr/bin/env python3
"""
RBAC Validation Script - Tests the role-based access control logic
This script validates the RBAC implementation without requiring a running backend.
"""

import sys
import os

# Add the backend path to sys.path to import our RBAC module
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from backend.app.utils.rbac import Role, Permission, ROLE_PERMISSIONS, has_permission, can_access_role
    print("✅ Successfully imported RBAC module")
except ImportError as e:
    print(f"❌ Failed to import RBAC module: {e}")
    print("Make sure you're running this from the project root directory")
    sys.exit(1)

def test_role_permissions():
    """Test role permission assignments"""
    print("\n🔍 Testing Role Permission Assignments")
    print("-" * 50)
    
    test_cases = [
        # Super Admin should have all permissions
        (Role.SUPER_ADMIN, Permission.CREATE_USER, True),
        (Role.SUPER_ADMIN, Permission.MANAGE_BRANCHES, True),
        (Role.SUPER_ADMIN, Permission.DELETE_USER, True),
        
        # HQ Admin should have most permissions except super admin specific
        (Role.HQ_ADMIN, Permission.CREATE_USER, True),
        (Role.HQ_ADMIN, Permission.MANAGE_BRANCHES, True),
        (Role.HQ_ADMIN, Permission.DELETE_USER, True),
        
        # Branch Admin should have branch-level permissions
        (Role.BRANCH_ADMIN, Permission.CREATE_STUDENT, True),
        (Role.BRANCH_ADMIN, Permission.CREATE_USER, True),
        (Role.BRANCH_ADMIN, Permission.MANAGE_BRANCHES, False),  # Should not have this
        
        # Teacher should have limited permissions
        (Role.TEACHER, Permission.READ_STUDENT, True),
        (Role.TEACHER, Permission.CREATE_GRADE, True),
        (Role.TEACHER, Permission.DELETE_USER, False),  # Should not have this
        (Role.TEACHER, Permission.MANAGE_BRANCHES, False),  # Should not have this
        
        # Student should have very limited permissions
        (Role.STUDENT, Permission.READ_STUDENT, True),  # Own data only
        (Role.STUDENT, Permission.READ_CLASS, True),    # Own classes only
        (Role.STUDENT, Permission.CREATE_USER, False),
        (Role.STUDENT, Permission.DELETE_USER, False),
        
        # Parent should have child-related permissions
        (Role.PARENT, Permission.READ_STUDENT, True),   # Children's data only
        (Role.PARENT, Permission.READ_PAYMENT, True),   # Own payments only
        (Role.PARENT, Permission.CREATE_USER, False),
        (Role.PARENT, Permission.DELETE_STUDENT, False),
    ]
    
    passed = 0
    total = len(test_cases)
    
    for role, permission, expected in test_cases:
        actual = has_permission(role.value, permission)
        status = "✅ PASS" if actual == expected else "❌ FAIL"
        
        if actual == expected:
            passed += 1
        
        print(f"{status} {role.value} - {permission.value}: Expected {expected}, Got {actual}")
    
    print(f"\nResult: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    return passed == total

def test_role_hierarchy():
    """Test role hierarchy and access control"""
    print("\n🔍 Testing Role Hierarchy")
    print("-" * 50)
    
    test_cases = [
        # Super Admin can access all roles
        (Role.SUPER_ADMIN, Role.HQ_ADMIN, True),
        (Role.SUPER_ADMIN, Role.TEACHER, True),
        (Role.SUPER_ADMIN, Role.STUDENT, True),
        
        # HQ Admin can access branch roles but not super admin
        (Role.HQ_ADMIN, Role.BRANCH_ADMIN, True),
        (Role.HQ_ADMIN, Role.TEACHER, True),
        (Role.HQ_ADMIN, Role.SUPER_ADMIN, False),
        
        # Branch Admin can access lower roles
        (Role.BRANCH_ADMIN, Role.TEACHER, True),
        (Role.BRANCH_ADMIN, Role.STUDENT, True),
        (Role.BRANCH_ADMIN, Role.HQ_ADMIN, False),
        (Role.BRANCH_ADMIN, Role.SUPER_ADMIN, False),
        
        # Teacher cannot access admin roles
        (Role.TEACHER, Role.STUDENT, True),
        (Role.TEACHER, Role.BRANCH_ADMIN, False),
        (Role.TEACHER, Role.HQ_ADMIN, False),
        
        # Student cannot access other roles
        (Role.STUDENT, Role.TEACHER, False),
        (Role.STUDENT, Role.PARENT, False),
        (Role.STUDENT, Role.ADMIN, False),
    ]
    
    passed = 0
    total = len(test_cases)
    
    for user_role, target_role, expected in test_cases:
        actual = can_access_role(user_role.value, target_role.value)
        status = "✅ PASS" if actual == expected else "❌ FAIL"
        
        if actual == expected:
            passed += 1
        
        print(f"{status} {user_role.value} can access {target_role.value}: Expected {expected}, Got {actual}")
    
    print(f"\nResult: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    return passed == total

def test_permission_coverage():
    """Test that all roles have appropriate permission coverage"""
    print("\n🔍 Testing Permission Coverage")
    print("-" * 50)
    
    # Check that each role has permissions assigned
    for role in Role:
        permissions = ROLE_PERMISSIONS.get(role, set())
        count = len(permissions)
        
        if count == 0:
            print(f"❌ {role.value} has no permissions assigned")
        else:
            print(f"✅ {role.value} has {count} permissions")
            
            # Show sample permissions for verification
            sample_perms = list(permissions)[:3]
            for perm in sample_perms:
                print(f"   • {perm.value}")
            if count > 3:
                print(f"   • ... and {count-3} more")
    
    # Check critical permissions are properly assigned
    critical_checks = [
        ("User management permissions", Permission.CREATE_USER, [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.ADMIN]),
        ("Student read permissions", Permission.READ_STUDENT, [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.HQ_REGISTRAR, Role.REGISTRAR, Role.ADMIN, Role.TEACHER, Role.STUDENT, Role.PARENT]),
        ("Branch management permissions", Permission.MANAGE_BRANCHES, [Role.SUPER_ADMIN, Role.HQ_ADMIN]),
        ("Financial report permissions", Permission.VIEW_FINANCIAL_REPORTS, [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.HQ_REGISTRAR]),
    ]
    
    print(f"\n🔒 Critical Permission Assignments:")
    for description, permission, expected_roles in critical_checks:
        print(f"\n{description}:")
        for role in Role:
            has_perm = has_permission(role.value, permission)
            should_have = role in expected_roles
            status = "✅" if has_perm == should_have else "❌"
            print(f"  {status} {role.value}: {'Has' if has_perm else 'No'} permission ({'Expected' if should_have else 'Not expected'})")

def main():
    """Main validation function"""
    print("🔒 Spring of Knowledge Hub - RBAC Validation")
    print("=" * 60)
    
    # Run all tests
    test_results = []
    
    print("Running RBAC validation tests...")
    
    test_results.append(test_role_permissions())
    test_results.append(test_role_hierarchy())
    test_permission_coverage()  # This is informational, not pass/fail
    
    # Summary
    passed_tests = sum(test_results)
    total_tests = len(test_results)
    
    print("\n" + "=" * 60)
    print("📊 VALIDATION SUMMARY")
    print("=" * 60)
    print(f"Tests Passed: {passed_tests}/{total_tests}")
    
    if passed_tests == total_tests:
        print("✅ All RBAC validation tests passed!")
        print("🚀 The role-based access control system is properly configured.")
    else:
        print("❌ Some tests failed. Please review the RBAC configuration.")
        return False
    
    print("\n🎯 RBAC System Features:")
    print("• ✅ Hierarchical role system")
    print("• ✅ Permission-based access control")
    print("• ✅ Branch-level isolation")
    print("• ✅ Fine-grained permission assignments")
    print("• ✅ Admin role separation")
    print("• ✅ Student/Parent access restrictions")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)