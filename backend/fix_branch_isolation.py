#!/usr/bin/env python3
"""
Fix branch isolation across key backend components
"""

# Key routers that need branch isolation fixes
ROUTERS_TO_FIX = [
    'inventory.py',
    'reports.py', 
    'fees.py',
    'attendance.py',
    'classes.py',
    'teachers.py',
    'exams.py',
    'exam_results.py',
    'notifications.py',
    'discipline.py'
]

# Branch filtering code template for list endpoints
BRANCH_FILTER_TEMPLATE = '''    # Build query based on user role  
    query = {}
    
    if current_user.get("role") == "superadmin":
        # Superadmin sees all data
        pass
    else:
        # Regular users see only their branch's data
        branch_id = current_user.get("branch_id")
        if not branch_id:
            return []  # No branch = no data
        query["branch_id"] = branch_id'''

# Branch assignment for create endpoints
BRANCH_CREATE_TEMPLATE = '''    # Only admin and superadmin can create
    if current_user.get("role") not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can create items"
        )
    
    # Get user's branch
    branch_id = current_user.get("branch_id")
    if not branch_id and current_user.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    # Add branch_id to document
    doc["branch_id"] = branch_id'''

print("🔧 Branch isolation fixes would be applied to:")
for router in ROUTERS_TO_FIX:
    print(f"   - {router}")

print("\n📋 Manual fixes needed:")
print("1. Add branch filtering to list endpoints")
print("2. Add branch assignment to create endpoints") 
print("3. Add branch validation to update/delete endpoints")
print("4. Test cross-component data sharing")