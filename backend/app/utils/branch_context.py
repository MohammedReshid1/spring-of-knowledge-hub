"""
Branch context management for multi-branch data isolation
"""
from fastapi import Depends, HTTPException, status
from typing import Optional, Any, Dict, List
from ..utils.rbac import get_current_user, is_hq_role, Role
from ..utils.audit_logger import get_audit_logger, AuditAction, AuditSeverity
from ..db import get_db
from bson import ObjectId
import asyncio

class BranchContext:
    """
    Manages branch-based data isolation
    Ensures users can only access data from their assigned branch
    """
    
    @staticmethod
    async def get_user_branch(current_user: dict = Depends(get_current_user)) -> str:
        """
        Get the branch_id from the current authenticated user
        """
        branch_id = current_user.get("branch_id")
        if not branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not assigned to any branch"
            )
        return branch_id
    
    @staticmethod
    async def verify_branch_access(
        resource_branch_id: str,
        user_branch_id: str,
        current_user: dict,
        audit_action: Optional[str] = None
    ) -> bool:
        """
        Verify if user has access to a resource based on branch
        HQ roles can access all branches, others only their assigned branch
        """
        user_role = current_user.get("role")
        
        # HQ roles can access all branches
        if is_hq_role(user_role):
            return True
        
        # Regular users can only access their assigned branch
        access_granted = str(resource_branch_id) == str(user_branch_id)
        
        # Log cross-branch access attempts
        if not access_granted and audit_action:
            audit_log = get_audit_logger()
            asyncio.create_task(audit_log.log_security_event(
                event_type="cross_branch_access_attempt",
                user_id=current_user.get("user_id"),
                details={
                    "user_branch": user_branch_id,
                    "attempted_branch": resource_branch_id,
                    "action": audit_action,
                    "user_role": user_role
                },
                severity=AuditSeverity.WARNING
            ))
        
        return access_granted
    
    @staticmethod
    def add_branch_filter(
        query: Dict[str, Any],
        branch_id: str,
        current_user: dict,
        collection_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add branch filter to a MongoDB query
        """
        user_role = current_user.get("role")
        
        # HQ roles see all data
        if is_hq_role(user_role):
            return query
        
        # Add branch filter for branch-level users
        if branch_id:
            query["branch_id"] = branch_id
        
        # Log data access with branch context
        if collection_name:
            audit_log = get_audit_logger()
            asyncio.create_task(audit_log.log_data_access(
                user_id=current_user.get("user_id"),
                user_role=user_role,
                resource_type=collection_name,
                resource_id="filtered_query",
                action=AuditAction.READ.value,
                fields_accessed=["branch_filtered"],
                branch_id=branch_id
            ))
        
        return query
    
    @staticmethod
    async def validate_cross_branch_reference(
        db,
        collection_name: str,
        document_id: str,
        user_branch_id: str,
        current_user: dict
    ) -> bool:
        """
        Validate that a referenced document belongs to the user's branch
        """
        user_role = current_user.get("role")
        
        # HQ roles can reference across branches
        if is_hq_role(user_role):
            return True
        
        collection = db[collection_name]
        
        # Handle both string IDs and ObjectIds
        try:
            if ObjectId.is_valid(document_id):
                doc = await collection.find_one({"_id": ObjectId(document_id)})
            else:
                doc = await collection.find_one({"_id": document_id})
        except:
            doc = await collection.find_one({"_id": document_id})
        
        if not doc:
            # Log attempt to access non-existent resource
            audit_log = get_audit_logger()
            asyncio.create_task(audit_log.log_security_event(
                event_type="access_nonexistent_resource",
                user_id=current_user.get("user_id"),
                details={
                    "collection": collection_name,
                    "document_id": document_id,
                    "user_branch": user_branch_id
                },
                severity=AuditSeverity.WARNING
            ))
            return False
        
        # Check if document has branch_id and matches user's branch
        doc_branch_id = doc.get("branch_id")
        if doc_branch_id:
            access_granted = str(doc_branch_id) == str(user_branch_id)
            
            # Log cross-branch reference attempts
            if not access_granted:
                audit_log = get_audit_logger()
                asyncio.create_task(audit_log.log_security_event(
                    event_type="cross_branch_reference_attempt",
                    user_id=current_user.get("user_id"),
                    details={
                        "collection": collection_name,
                        "document_id": document_id,
                        "document_branch": doc_branch_id,
                        "user_branch": user_branch_id,
                        "user_role": user_role
                    },
                    severity=AuditSeverity.CRITICAL
                ))
            
            return access_granted
        
        # If document doesn't have branch_id, it's a global resource
        return True

class BranchFilter:
    """
    Dependency class for automatic branch filtering
    """
    def __init__(self, allow_cross_branch: bool = False):
        self.allow_cross_branch = allow_cross_branch
    
    async def __call__(
        self,
        current_user: dict = Depends(get_current_user),
        db = Depends(get_db)
    ):
        """
        Returns a configured branch filter
        """
        branch_id = current_user.get("branch_id")
        
        if not branch_id and not is_hq_role(current_user.get("role")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not assigned to any branch"
            )
        
        return {
            "branch_id": branch_id,
            "user": current_user,
            "db": db,
            "allow_cross_branch": self.allow_cross_branch or is_hq_role(current_user.get("role"))
        }

def get_branch_filter(
    allow_cross_branch: bool = False
) -> BranchFilter:
    """
    Factory function to create branch filter dependency
    """
    return BranchFilter(allow_cross_branch=allow_cross_branch)

async def ensure_branch_compatibility(
    data: dict,
    branch_context: dict
) -> dict:
    """
    Ensure all data references are compatible with branch context
    """
    if not branch_context["allow_cross_branch"]:
        # Add branch_id to data if not present
        if "branch_id" not in data:
            data["branch_id"] = branch_context["branch_id"]
        # Verify branch_id matches user's branch
        elif str(data["branch_id"]) != str(branch_context["branch_id"]):
            user_role = branch_context["user"].get("role")
            if not is_hq_role(user_role):
                # Log unauthorized branch modification attempt
                audit_log = get_audit_logger()
                asyncio.create_task(audit_log.log_security_event(
                    event_type="unauthorized_branch_modification",
                    user_id=branch_context["user"].get("user_id"),
                    details={
                        "user_branch": branch_context["branch_id"],
                        "attempted_branch": data["branch_id"],
                        "user_role": user_role
                    },
                    severity=AuditSeverity.CRITICAL
                ))
                
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot create/update resources for other branches"
                )
    
    return data

class BranchIsolationMiddleware:
    """
    Middleware for automatic branch isolation enforcement
    """
    
    @staticmethod
    def require_branch_access(resource_type: str = None):
        """
        Decorator to enforce branch isolation on endpoints
        """
        def decorator(func):
            async def wrapper(*args, **kwargs):
                current_user = kwargs.get('current_user')
                if not current_user:
                    raise HTTPException(status_code=401, detail="Authentication required")
                
                user_role = current_user.get('role')
                user_branch = current_user.get('branch_id')
                
                # HQ roles bypass branch restrictions
                if is_hq_role(user_role):
                    return await func(*args, **kwargs)
                
                # Ensure branch-level users have branch assignment
                if not user_branch:
                    audit_log = get_audit_logger()
                    asyncio.create_task(audit_log.log_security_event(
                        event_type="no_branch_assignment",
                        user_id=current_user.get("user_id"),
                        details={
                            "user_role": user_role,
                            "endpoint": func.__name__,
                            "resource_type": resource_type
                        },
                        severity=AuditSeverity.ERROR
                    ))
                    
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="User must be assigned to a branch"
                    )
                
                return await func(*args, **kwargs)
            return wrapper
        return decorator
    
    @staticmethod
    async def validate_parent_child_branch_access(
        parent_id: str,
        child_data: dict,
        current_user: dict,
        db
    ) -> bool:
        """
        Validate that parent and child entities belong to the same branch
        Used for parent-student relationships
        """
        user_role = current_user.get("role")
        user_branch = current_user.get("branch_id")
        
        # HQ roles can manage cross-branch relationships
        if is_hq_role(user_role):
            return True
        
        # Get parent entity
        parents_collection = db.parents
        parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
        
        if not parent:
            return False
        
        parent_branch = parent.get("branch_id")
        child_branch = child_data.get("branch_id")
        
        # Ensure all entities are in the same branch
        branches_match = (
            str(parent_branch) == str(child_branch) == str(user_branch)
        )
        
        if not branches_match:
            audit_log = get_audit_logger()
            asyncio.create_task(audit_log.log_security_event(
                event_type="cross_branch_relationship_attempt",
                user_id=current_user.get("user_id"),
                details={
                    "parent_branch": parent_branch,
                    "child_branch": child_branch,
                    "user_branch": user_branch,
                    "parent_id": parent_id
                },
                severity=AuditSeverity.CRITICAL
            ))
        
        return branches_match
    
    @staticmethod
    async def filter_branch_accessible_resources(
        resources: List[dict],
        current_user: dict,
        resource_type: str = "resource"
    ) -> List[dict]:
        """
        Filter a list of resources to only include those accessible by the user's branch
        """
        user_role = current_user.get("role")
        user_branch = current_user.get("branch_id")
        
        # HQ roles see all resources
        if is_hq_role(user_role):
            return resources
        
        # Filter resources by branch
        accessible_resources = []
        for resource in resources:
            resource_branch = resource.get("branch_id")
            
            # Include resources without branch_id (global resources)
            if not resource_branch:
                accessible_resources.append(resource)
            # Include resources from user's branch
            elif str(resource_branch) == str(user_branch):
                accessible_resources.append(resource)
        
        # Log filtered access
        audit_log = get_audit_logger()
        asyncio.create_task(audit_log.log_data_access(
            user_id=current_user.get("user_id"),
            user_role=user_role,
            resource_type=resource_type,
            resource_id="filtered_list",
            action="read_filtered",
            fields_accessed=["branch_filtered"],
            branch_id=user_branch
        ))
        
        return accessible_resources

# Enhanced dependency functions
async def enforce_branch_isolation(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Dependency to enforce branch isolation for any endpoint
    """
    user_role = current_user.get("role")
    user_branch = current_user.get("branch_id")
    
    # HQ roles bypass restrictions
    if is_hq_role(user_role):
        return {
            "branch_id": user_branch,
            "user": current_user,
            "db": db,
            "is_hq": True,
            "branch_restricted": False
        }
    
    # Ensure branch assignment for non-HQ roles
    if not user_branch:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    return {
        "branch_id": user_branch,
        "user": current_user,
        "db": db,
        "is_hq": False,
        "branch_restricted": True
    }

async def get_branch_aware_db_collection(
    collection_name: str,
    branch_context: dict = Depends(enforce_branch_isolation)
):
    """
    Get a database collection with automatic branch filtering
    """
    collection = branch_context["db"][collection_name]
    
    if branch_context["branch_restricted"]:
        # Create a wrapper that adds branch filtering to all queries
        class BranchFilteredCollection:
            def __init__(self, collection, branch_id):
                self._collection = collection
                self._branch_id = branch_id
            
            async def find(self, query=None, *args, **kwargs):
                if query is None:
                    query = {}
                query["branch_id"] = self._branch_id
                return self._collection.find(query, *args, **kwargs)
            
            async def find_one(self, query=None, *args, **kwargs):
                if query is None:
                    query = {}
                query["branch_id"] = self._branch_id
                return await self._collection.find_one(query, *args, **kwargs)
            
            async def count_documents(self, query=None, *args, **kwargs):
                if query is None:
                    query = {}
                query["branch_id"] = self._branch_id
                return await self._collection.count_documents(query, *args, **kwargs)
            
            async def insert_one(self, document, *args, **kwargs):
                document["branch_id"] = self._branch_id
                return await self._collection.insert_one(document, *args, **kwargs)
            
            async def update_one(self, filter_query, update, *args, **kwargs):
                filter_query["branch_id"] = self._branch_id
                return await self._collection.update_one(filter_query, update, *args, **kwargs)
            
            async def delete_one(self, filter_query, *args, **kwargs):
                filter_query["branch_id"] = self._branch_id
                return await self._collection.delete_one(filter_query, *args, **kwargs)
        
        return BranchFilteredCollection(collection, branch_context["branch_id"])
    
    return collection

async def get_user_branch_context(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get comprehensive branch context for the current user
    Returns branch info and permissions
    """
    user_role = current_user.get("role")
    user_branch = current_user.get("branch_id")
    
    return {
        "branch_id": user_branch,
        "user": current_user,
        "is_hq": is_hq_role(user_role),
        "branch_restricted": not is_hq_role(user_role),
        "can_access_all_branches": is_hq_role(user_role)
    }

# Export all components
__all__ = [
    'BranchContext',
    'BranchFilter', 
    'BranchIsolationMiddleware',
    'get_branch_filter',
    'ensure_branch_compatibility',
    'enforce_branch_isolation',
    'get_branch_aware_db_collection',
    'get_user_branch_context'
]