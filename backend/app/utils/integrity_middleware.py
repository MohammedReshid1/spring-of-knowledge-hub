"""
Data Integrity Middleware
Provides integration hooks for referential integrity validation in API endpoints
"""
import logging
from typing import Dict, Any, Optional, List
from functools import wraps
from fastapi import HTTPException, status

from .referential_integrity import get_integrity_manager, validate_document_integrity, execute_cascade_operations
from .audit_logger import get_audit_logger, AuditSeverity

logger = logging.getLogger(__name__)

class IntegrityError(Exception):
    """Custom exception for integrity violations"""
    def __init__(self, violations: List):
        self.violations = violations
        super().__init__(f"Integrity violations found: {len(violations)} errors")

async def validate_before_insert(db, collection_name: str, document: Dict[str, Any]) -> Dict[str, Any]:
    """Validate document before insert operation"""
    try:
        violations = await validate_document_integrity(db, collection_name, document, "insert")
        
        # Filter out warnings, only fail on errors
        errors = [v for v in violations if v.severity == "error"]
        
        if errors:
            audit_logger = get_audit_logger()
            await audit_logger.log_data_event(
                event_type="integrity_validation_failed",
                details={
                    "collection": collection_name,
                    "operation": "insert",
                    "violations": [
                        {
                            "type": v.violation_type,
                            "description": v.description,
                            "reference": v.reference_name
                        } for v in errors
                    ]
                },
                severity=AuditSeverity.ERROR
            )
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Data integrity validation failed",
                    "violations": [
                        {
                            "type": v.violation_type,
                            "description": v.description,
                            "suggested_action": v.suggested_action
                        } for v in errors
                    ]
                }
            )
        
        return document
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in integrity validation: {e}")
        # Don't fail the operation for validation errors, just log
        return document

async def validate_before_update(db, collection_name: str, document: Dict[str, Any], document_id: str) -> Dict[str, Any]:
    """Validate document before update operation"""
    try:
        # Add the _id to the document for validation
        document["_id"] = document_id
        violations = await validate_document_integrity(db, collection_name, document, "update")
        
        # Filter out warnings, only fail on errors
        errors = [v for v in violations if v.severity == "error"]
        
        if errors:
            audit_logger = get_audit_logger()
            await audit_logger.log_data_event(
                event_type="integrity_validation_failed",
                details={
                    "collection": collection_name,
                    "operation": "update",
                    "document_id": document_id,
                    "violations": [
                        {
                            "type": v.violation_type,
                            "description": v.description,
                            "reference": v.reference_name
                        } for v in errors
                    ]
                },
                severity=AuditSeverity.ERROR
            )
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Data integrity validation failed",
                    "violations": [
                        {
                            "type": v.violation_type,
                            "description": v.description,
                            "suggested_action": v.suggested_action
                        } for v in errors
                    ]
                }
            )
        
        return document
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in integrity validation: {e}")
        return document

async def validate_before_delete(db, collection_name: str, document_id: str) -> bool:
    """Validate before delete operation and handle cascades"""
    try:
        # Get the document first
        collection = db[collection_name]
        document = await collection.find_one({"_id": document_id})
        
        if not document:
            return True  # Document doesn't exist, nothing to validate
        
        violations = await validate_document_integrity(db, collection_name, document, "delete")
        
        # Check for restrict violations (these block deletion)
        restrict_violations = [v for v in violations if v.violation_type == "restrict_violation"]
        
        if restrict_violations:
            audit_logger = get_audit_logger()
            await audit_logger.log_data_event(
                event_type="delete_blocked_by_integrity",
                details={
                    "collection": collection_name,
                    "document_id": document_id,
                    "violations": [
                        {
                            "type": v.violation_type,
                            "description": v.description,
                            "reference": v.reference_name
                        } for v in restrict_violations
                    ]
                },
                severity=AuditSeverity.WARNING
            )
            
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Cannot delete record due to existing dependencies",
                    "violations": [
                        {
                            "type": v.violation_type,
                            "description": v.description,
                            "suggested_action": v.suggested_action
                        } for v in restrict_violations
                    ]
                }
            )
        
        return True
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete validation: {e}")
        return True

async def handle_after_delete(db, collection_name: str, document_id: str) -> Dict[str, Any]:
    """Handle cascades and cleanup after successful delete"""
    try:
        cascade_results = await execute_cascade_operations(db, collection_name, document_id, "delete")
        
        audit_logger = get_audit_logger()
        await audit_logger.log_data_event(
            event_type="cascade_operations_completed",
            details={
                "collection": collection_name,
                "document_id": document_id,
                "results": cascade_results
            },
            severity=AuditSeverity.INFO
        )
        
        return cascade_results
        
    except Exception as e:
        logger.error(f"Error in post-delete cascade operations: {e}")
        return {"errors": [str(e)]}

def with_integrity_validation(collection_name: str):
    """Decorator to add integrity validation to API endpoints"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # This is a placeholder for more sophisticated middleware integration
            # In practice, you would integrate this with FastAPI dependencies
            return await func(*args, **kwargs)
        return wrapper
    return decorator

async def check_data_consistency(db, collection_name: str) -> Dict[str, Any]:
    """Check data consistency for a collection"""
    try:
        integrity_manager = get_integrity_manager(db)
        report = await integrity_manager.check_database_integrity([collection_name])
        
        return {
            "collection": collection_name,
            "violations_found": len(report["violations"]),
            "violations": report["violations"],
            "recommendations": report["recommendations"],
            "statistics": report["statistics"].get(collection_name, {})
        }
        
    except Exception as e:
        logger.error(f"Error checking data consistency: {e}")
        return {
            "collection": collection_name,
            "error": str(e)
        }

async def auto_repair_integrity_issues(db, collection_name: str) -> Dict[str, Any]:
    """Auto-repair integrity issues in a collection"""
    try:
        integrity_manager = get_integrity_manager(db)
        
        # First check for violations
        report = await integrity_manager.check_database_integrity([collection_name])
        violations = report["violations"]
        
        # Filter auto-fixable violations
        auto_fixable = [v for v in violations if v.auto_fixable]
        
        if not auto_fixable:
            return {
                "collection": collection_name,
                "message": "No auto-fixable violations found",
                "total_violations": len(violations)
            }
        
        # Attempt repairs
        repair_results = await integrity_manager.auto_repair_violations(auto_fixable)
        
        return {
            "collection": collection_name,
            "repaired_count": repair_results["repaired_count"],
            "failed_repairs": repair_results["failed_repairs"],
            "operations": repair_results["operations"],
            "total_violations": len(violations)
        }
        
    except Exception as e:
        logger.error(f"Error in auto-repair: {e}")
        return {
            "collection": collection_name,
            "error": str(e)
        }

# Export main functions
__all__ = [
    'validate_before_insert',
    'validate_before_update', 
    'validate_before_delete',
    'handle_after_delete',
    'with_integrity_validation',
    'check_data_consistency',
    'auto_repair_integrity_issues',
    'IntegrityError'
]