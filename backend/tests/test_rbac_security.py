"""
Comprehensive RBAC Security Test Suite
Tests all role-permission combinations, security vulnerabilities, and edge cases
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import HTTPException

# Import the modules we're testing
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.rbac import (
    Role, Permission, has_permission, has_role_level, can_access_role,
    require_permission, get_current_user, ROLE_PERMISSIONS, ROLE_HIERARCHY
)
from app.utils.branch_context import (
    BranchContext, BranchIsolationMiddleware, enforce_branch_isolation
)
from app.utils.resource_permissions import (
    ResourcePermissionChecker, ResourceType, check_student_grade_access,
    check_payment_access
)
from app.utils.audit_logger import (
    AuditLogger, AuditAction, AuditSeverity, get_audit_logger
)

class TestRBACPermissions:
    """Test basic RBAC permission system"""
    
    def test_role_permission_mapping(self):
        """Test that all roles have correct permissions"""
        
        # Super Admin should have all permissions
        super_admin_perms = ROLE_PERMISSIONS[Role.SUPER_ADMIN]
        all_permissions = set(Permission)
        assert super_admin_perms == all_permissions, "Super Admin should have all permissions"
        
        # Student should have minimal permissions
        student_perms = ROLE_PERMISSIONS[Role.STUDENT]
        expected_student_perms = {
            Permission.READ_STUDENT, Permission.READ_CLASS, Permission.READ_GRADE,
            Permission.READ_ATTENDANCE, Permission.READ_BEHAVIOR_RECORD,
            Permission.SEND_MESSAGES, Permission.READ_MESSAGES
        }
        assert student_perms == expected_student_perms, "Student permissions incorrect"
        
        # Teacher should have classroom management permissions
        teacher_perms = ROLE_PERMISSIONS[Role.TEACHER]
        required_teacher_perms = {
            Permission.CREATE_GRADE, Permission.UPDATE_GRADE, Permission.CREATE_ATTENDANCE,
            Permission.UPDATE_ATTENDANCE, Permission.CREATE_BEHAVIOR_RECORD
        }
        assert required_teacher_perms.issubset(teacher_perms), "Teacher missing required permissions"
    
    def test_has_permission(self):
        """Test permission checking function"""
        
        # Test valid role-permission combinations
        assert has_permission("super_admin", Permission.CREATE_STUDENT) == True
        assert has_permission("teacher", Permission.CREATE_GRADE) == True
        assert has_permission("student", Permission.READ_STUDENT) == True
        assert has_permission("parent", Permission.READ_GRADE) == True
        
        # Test invalid role-permission combinations
        assert has_permission("student", Permission.CREATE_STUDENT) == False
        assert has_permission("teacher", Permission.DELETE_STUDENT) == False
        assert has_permission("parent", Permission.CREATE_GRADE) == False
        
        # Test invalid role
        assert has_permission("invalid_role", Permission.READ_STUDENT) == False
        assert has_permission(None, Permission.READ_STUDENT) == False
    
    def test_role_hierarchy(self):
        """Test role hierarchy levels"""
        
        assert has_role_level("super_admin", 100) == True
        assert has_role_level("super_admin", 50) == True
        assert has_role_level("teacher", 100) == False
        assert has_role_level("teacher", 50) == True
        assert has_role_level("student", 50) == False
        
        # Test role access
        assert can_access_role("super_admin", "teacher") == True
        assert can_access_role("branch_admin", "teacher") == True
        assert can_access_role("teacher", "super_admin") == False
        assert can_access_role("student", "teacher") == False

class TestBranchIsolation:
    """Test branch isolation security"""
    
    @pytest.mark.asyncio
    async def test_branch_access_verification(self):
        """Test branch access verification"""
        
        # HQ role should access all branches
        hq_user = {"role": "super_admin", "branch_id": "branch_1"}
        assert await BranchContext.verify_branch_access("branch_2", "branch_1", hq_user) == True
        
        # Branch user should only access own branch
        branch_user = {"role": "teacher", "branch_id": "branch_1"}
        assert await BranchContext.verify_branch_access("branch_1", "branch_1", branch_user) == True
        assert await BranchContext.verify_branch_access("branch_2", "branch_1", branch_user) == False
        
        # Test with audit logging
        with patch('app.utils.branch_context.get_audit_logger') as mock_audit:
            mock_logger = AsyncMock()
            mock_audit.return_value = mock_logger
            
            result = await BranchContext.verify_branch_access(
                "branch_2", "branch_1", branch_user, "test_action"
            )
            
            assert result == False
            mock_logger.log_security_event.assert_called_once()
    
    def test_branch_filter_queries(self):
        """Test branch filtering on database queries"""
        
        base_query = {"status": "active"}
        
        # HQ role should not get branch filter
        hq_user = {"role": "super_admin", "branch_id": "branch_1"}
        filtered_query = BranchContext.add_branch_filter(base_query.copy(), "branch_1", hq_user)
        assert "branch_id" not in filtered_query
        
        # Branch user should get branch filter
        branch_user = {"role": "teacher", "branch_id": "branch_1"}
        filtered_query = BranchContext.add_branch_filter(base_query.copy(), "branch_1", branch_user)
        assert filtered_query["branch_id"] == "branch_1"
        assert filtered_query["status"] == "active"
    
    @pytest.mark.asyncio
    async def test_cross_branch_reference_validation(self):
        """Test cross-branch reference validation"""
        
        # Mock database
        mock_db = Mock()
        mock_collection = AsyncMock()
        mock_db.__getitem__ = Mock(return_value=mock_collection)
        
        # Test valid same-branch reference
        mock_collection.find_one.return_value = {"_id": "doc_1", "branch_id": "branch_1"}
        
        branch_user = {"role": "teacher", "branch_id": "branch_1", "user_id": "user_1"}
        result = await BranchContext.validate_cross_branch_reference(
            mock_db, "students", "doc_1", "branch_1", branch_user
        )
        assert result == True
        
        # Test invalid cross-branch reference
        mock_collection.find_one.return_value = {"_id": "doc_2", "branch_id": "branch_2"}
        
        with patch('app.utils.branch_context.get_audit_logger') as mock_audit:
            mock_logger = AsyncMock()
            mock_audit.return_value = mock_logger
            
            result = await BranchContext.validate_cross_branch_reference(
                mock_db, "students", "doc_2", "branch_1", branch_user
            )
            
            assert result == False
            mock_logger.log_security_event.assert_called_once()

class TestResourcePermissions:
    """Test resource-level and field-level permissions"""
    
    @pytest.mark.asyncio
    async def test_resource_access_checking(self):
        """Test resource-level access control"""
        
        student_data = {
            "_id": "student_1",
            "first_name": "John",
            "last_name": "Doe",
            "medical_info": "Sensitive medical data",
            "branch_id": "branch_1"
        }
        
        # Teacher should have access but not to sensitive fields
        result = await ResourcePermissionChecker.check_resource_access(
            user_id="teacher_1",
            user_role="teacher",
            user_branch="branch_1",
            resource_type=ResourceType.STUDENT,
            resource_data=student_data,
            action="read",
            requested_fields=["first_name", "last_name", "medical_info"]
        )
        
        assert result["allowed"] == True
        assert "first_name" in result["filtered_data"]
        assert "last_name" in result["filtered_data"]
        # Medical info should be accessible to teachers for safety
        assert "medical_info" in result["filtered_data"]
    
    @pytest.mark.asyncio
    async def test_student_self_access(self):
        """Test student accessing their own data"""
        
        student_data = {
            "_id": "student_1",
            "student_id": "student_1",
            "first_name": "John",
            "grades": [85, 90, 78]
        }
        
        # Student accessing own data
        result = await ResourcePermissionChecker.check_resource_access(
            user_id="student_1",
            user_role="student",
            user_branch="branch_1",
            resource_type=ResourceType.STUDENT,
            resource_data=student_data,
            action="read"
        )
        
        assert result["allowed"] == True
        
        # Student accessing other student's data
        other_student_data = {
            "_id": "student_2",
            "student_id": "student_2",
            "first_name": "Jane"
        }
        
        result = await ResourcePermissionChecker.check_resource_access(
            user_id="student_1",
            user_role="student",
            user_branch="branch_1",
            resource_type=ResourceType.STUDENT,
            resource_data=other_student_data,
            action="read"
        )
        
        assert result["allowed"] == False
    
    @pytest.mark.asyncio
    async def test_parent_child_access(self):
        """Test parent accessing their child's data"""
        
        student_data = {
            "_id": "student_1",
            "parent_guardian_id": "parent_1",
            "first_name": "John",
            "grades": [85, 90, 78]
        }
        
        # Parent accessing their child's data
        result = await ResourcePermissionChecker.check_resource_access(
            user_id="parent_1",
            user_role="parent",
            user_branch="branch_1",
            resource_type=ResourceType.STUDENT,
            resource_data=student_data,
            action="read"
        )
        
        assert result["allowed"] == True
        
        # Parent accessing other child's data
        other_student_data = {
            "_id": "student_2",
            "parent_guardian_id": "parent_2",
            "first_name": "Jane"
        }
        
        result = await ResourcePermissionChecker.check_resource_access(
            user_id="parent_1",
            user_role="parent",
            user_branch="branch_1",
            resource_type=ResourceType.STUDENT,
            resource_data=other_student_data,
            action="read"
        )
        
        assert result["allowed"] == False
    
    @pytest.mark.asyncio
    async def test_sensitive_field_access(self):
        """Test access to sensitive fields"""
        
        teacher_data = {
            "_id": "teacher_1",
            "name": "Jane Smith",
            "salary": 50000,
            "performance_reviews": "Excellent performance"
        }
        
        # HQ Admin should access all fields
        result = await ResourcePermissionChecker.check_resource_access(
            user_id="admin_1",
            user_role="super_admin",
            user_branch="branch_1",
            resource_type=ResourceType.TEACHER,
            resource_data=teacher_data,
            action="read",
            requested_fields=["name", "salary", "performance_reviews"]
        )
        
        assert result["allowed"] == True
        assert "salary" in result["filtered_data"]
        assert "performance_reviews" in result["filtered_data"]
        
        # Branch Admin should not access salary
        result = await ResourcePermissionChecker.check_resource_access(
            user_id="admin_2",
            user_role="branch_admin",
            user_branch="branch_1",
            resource_type=ResourceType.TEACHER,
            resource_data=teacher_data,
            action="read",
            requested_fields=["name", "salary", "performance_reviews"]
        )
        
        assert result["allowed"] == True
        assert "name" in result["filtered_data"]
        assert "salary" not in result["filtered_data"]  # Should be filtered out
        assert "performance_reviews" in result["filtered_data"]

class TestAuditLogging:
    """Test audit logging functionality"""
    
    @pytest.mark.asyncio
    async def test_audit_logger_initialization(self):
        """Test audit logger setup and initialization"""
        
        audit_logger = AuditLogger()
        
        # Test initialization
        with patch('app.utils.audit_logger.AsyncIOMotorClient') as mock_client:
            mock_db = Mock()
            mock_collection = AsyncMock()
            mock_client.return_value.school_db = mock_db
            mock_db.audit_logs = mock_collection
            
            await audit_logger.initialize()
            
            assert audit_logger._initialized == True
            mock_collection.create_index.assert_called()
    
    @pytest.mark.asyncio
    async def test_permission_check_logging(self):
        """Test permission check audit logging"""
        
        audit_logger = AuditLogger()
        audit_logger._initialized = True
        audit_logger.collection = AsyncMock()
        
        await audit_logger.log_permission_check(
            user_id="user_1",
            user_role="teacher",
            required_permission="READ_STUDENT",
            granted=True,
            endpoint="/students",
            method="GET",
            ip_address="192.168.1.100",
            branch_id="branch_1"
        )
        
        # Verify audit log was created
        audit_logger.collection.insert_one.assert_called_once()
        call_args = audit_logger.collection.insert_one.call_args[0][0]
        
        assert call_args["action"] == "read"
        assert call_args["user"]["id"] == "user_1"
        assert call_args["user"]["role"] == "teacher"
        assert call_args["details"]["required_permission"] == "READ_STUDENT"
        assert call_args["success"] == True
    
    @pytest.mark.asyncio
    async def test_security_event_logging(self):
        """Test security event logging"""
        
        audit_logger = AuditLogger()
        audit_logger._initialized = True
        audit_logger.collection = AsyncMock()
        
        await audit_logger.log_security_event(
            event_type="brute_force_attempt",
            user_id="attacker_1",
            details={"attempts": 10, "ip": "192.168.1.200"},
            ip_address="192.168.1.200",
            severity=AuditSeverity.CRITICAL
        )
        
        # Verify security event was logged
        audit_logger.collection.insert_one.assert_called_once()
        call_args = audit_logger.collection.insert_one.call_args[0][0]
        
        assert call_args["action"] == "suspicious_activity"
        assert call_args["severity"] == "critical"
        assert call_args["details"]["event_type"] == "brute_force_attempt"
        assert call_args["success"] == False
    
    @pytest.mark.asyncio
    async def test_brute_force_detection(self):
        """Test brute force attack detection"""
        
        audit_logger = AuditLogger()
        audit_logger._initialized = True
        audit_logger.collection = AsyncMock()
        
        # Mock failed login attempts
        audit_logger.collection.count_documents.return_value = 6  # More than 5 attempts
        
        with patch.object(audit_logger, 'log_security_event', new_callable=AsyncMock) as mock_log:
            result = await audit_logger.detect_brute_force("attacker@example.com")
            
            assert result == True
            mock_log.assert_called_once()
            call_args = mock_log.call_args[1]
            assert call_args["event_type"] == "brute_force_detected"
            assert call_args["severity"] == AuditSeverity.CRITICAL

class TestSecurityEdgeCases:
    """Test security edge cases and attack scenarios"""
    
    def test_role_escalation_prevention(self):
        """Test prevention of role escalation attacks"""
        
        # Attempt to escalate from teacher to admin
        assert can_access_role("teacher", "super_admin") == False
        assert can_access_role("student", "teacher") == False
        assert can_access_role("parent", "branch_admin") == False
        
        # Only higher roles can manage lower roles
        assert can_access_role("super_admin", "teacher") == True
        assert can_access_role("branch_admin", "teacher") == True
        assert can_access_role("hq_admin", "branch_admin") == True
    
    def test_invalid_role_handling(self):
        """Test handling of invalid or malicious role values"""
        
        # Test with None role
        assert has_permission(None, Permission.READ_STUDENT) == False
        assert has_role_level(None, 50) == False
        
        # Test with empty string role
        assert has_permission("", Permission.READ_STUDENT) == False
        
        # Test with malicious role values
        assert has_permission("admin; DROP TABLE users;", Permission.READ_STUDENT) == False
        assert has_permission("../../admin", Permission.READ_STUDENT) == False
        assert has_permission("<script>alert('xss')</script>", Permission.READ_STUDENT) == False
    
    @pytest.mark.asyncio
    async def test_token_tampering_detection(self):
        """Test detection of JWT token tampering"""
        
        # Mock tampered token scenarios
        with patch('app.utils.rbac.decode_access_token') as mock_decode:
            # Test with invalid signature
            mock_decode.return_value = None
            
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(Mock(credentials="tampered.token.here"))
            
            assert exc_info.value.status_code == 401
            assert "Invalid or expired token" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_cross_branch_data_isolation(self):
        """Test data isolation across branches"""
        
        # Mock database with cross-branch data
        student_data = {
            "_id": "student_1",
            "name": "John Doe",
            "branch_id": "branch_2"  # Different branch
        }
        
        # Branch user trying to access other branch data
        result = await ResourcePermissionChecker.check_resource_access(
            user_id="teacher_1",
            user_role="teacher",
            user_branch="branch_1",  # Different branch
            resource_type=ResourceType.STUDENT,
            resource_data=student_data,
            action="read"
        )
        
        assert result["allowed"] == False
        assert "Cross-branch access denied" in result["reason"]
    
    def test_permission_boundary_conditions(self):
        """Test edge cases in permission checking"""
        
        # Test with edge case role combinations
        roles_to_test = [
            "super_admin", "hq_admin", "branch_admin", "teacher", 
            "student", "parent", "registrar", "admin"
        ]
        
        critical_permissions = [
            Permission.DELETE_STUDENT, Permission.VIEW_FINANCIAL_REPORTS,
            Permission.MANAGE_BRANCHES, Permission.SYSTEM_SETTINGS
        ]
        
        for role in roles_to_test:
            for permission in critical_permissions:
                result = has_permission(role, permission)
                # Ensure only appropriate roles have critical permissions
                if permission == Permission.MANAGE_BRANCHES:
                    expected = role in ["super_admin", "hq_admin"]
                    assert result == expected, f"Role {role} permission {permission} check failed"

class TestPerformance:
    """Test RBAC performance characteristics"""
    
    def test_permission_check_performance(self):
        """Test that permission checks are fast enough"""
        import time
        
        start_time = time.time()
        
        # Perform 1000 permission checks
        for _ in range(1000):
            has_permission("teacher", Permission.READ_STUDENT)
            has_permission("student", Permission.CREATE_GRADE)
            has_permission("super_admin", Permission.MANAGE_BRANCHES)
        
        end_time = time.time()
        elapsed = end_time - start_time
        
        # Should complete 1000 checks in under 0.1 seconds
        assert elapsed < 0.1, f"Permission checks too slow: {elapsed} seconds"
    
    def test_role_hierarchy_performance(self):
        """Test role hierarchy checking performance"""
        import time
        
        start_time = time.time()
        
        # Perform 1000 hierarchy checks
        for _ in range(1000):
            has_role_level("super_admin", 50)
            has_role_level("teacher", 100)
            can_access_role("branch_admin", "teacher")
        
        end_time = time.time()
        elapsed = end_time - start_time
        
        # Should complete 1000 checks in under 0.1 seconds
        assert elapsed < 0.1, f"Hierarchy checks too slow: {elapsed} seconds"

# Test fixtures and utilities
@pytest.fixture
def mock_current_user():
    """Mock current user for testing"""
    return {
        "user_id": "test_user_1",
        "email": "test@example.com",
        "role": "teacher",
        "branch_id": "branch_1",
        "full_name": "Test User"
    }

@pytest.fixture
def mock_database():
    """Mock database for testing"""
    db = Mock()
    
    # Mock collections
    db.students = AsyncMock()
    db.teachers = AsyncMock()
    db.parents = AsyncMock()
    db.audit_logs = AsyncMock()
    
    return db

# Integration test for full RBAC workflow
class TestRBACIntegration:
    """Integration tests for complete RBAC workflows"""
    
    @pytest.mark.asyncio
    async def test_complete_student_access_workflow(self):
        """Test complete workflow for student data access"""
        
        with patch('app.utils.audit_logger.AuditLogger.log_event', new_callable=AsyncMock) as mock_log:
            # Simulate teacher accessing student data
            student_data = {
                "_id": "student_1",
                "name": "John Doe",
                "grade": "A",
                "medical_info": "No allergies",
                "branch_id": "branch_1"
            }
            
            result = await ResourcePermissionChecker.check_resource_access(
                user_id="teacher_1",
                user_role="teacher",
                user_branch="branch_1",
                resource_type=ResourceType.STUDENT,
                resource_data=student_data,
                action="read",
                requested_fields=["name", "grade", "medical_info"]
            )
            
            # Verify access granted and audit logged
            assert result["allowed"] == True
            assert "name" in result["filtered_data"]
            assert "grade" in result["filtered_data"]
            assert "medical_info" in result["filtered_data"]  # Teachers can access for safety

if __name__ == "__main__":
    # Run specific test categories
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--disable-warnings"
    ])