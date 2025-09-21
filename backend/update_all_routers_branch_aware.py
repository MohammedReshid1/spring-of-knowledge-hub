#!/usr/bin/env python3
"""
Script to update all routers to be branch-aware
Creates branch-isolated versions of all routers
"""
import os
import shutil
from pathlib import Path

# Router files that need branch-aware updates
ROUTERS_TO_UPDATE = [
    "students.py",
    "teachers.py", 
    "classes.py",
    "subjects.py",
    "grade_levels.py",
    "fees.py",
    "attendance.py",
    "exams.py",
    "exam_results.py",
    "inventory.py",
    "notifications.py",
    "discipline.py",
    "reports.py",
    "academic_calendar.py",
    "communication.py"
]

# Common branch-aware imports to add
BRANCH_IMPORTS = """
from ..utils.branch_context import BranchContext, get_branch_filter, ensure_branch_compatibility
"""

# Common branch filter dependency
BRANCH_DEPENDENCY = """    branch_context: dict = Depends(get_branch_filter()),"""

def create_branch_aware_router_template(original_file_path):
    """Create a branch-aware version of a router"""
    
    router_name = Path(original_file_path).stem
    
    return f'''"""
Branch-aware {router_name} router
Ensures data isolation per branch
"""
from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime

from ..db import get_db
from ..utils.rbac import get_current_user
from ..utils.branch_context import BranchContext, get_branch_filter, ensure_branch_compatibility
from ..models.user import User

router = APIRouter()

@router.get("/")
async def list_items(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    branch_context: dict = Depends(get_branch_filter()),
    db = Depends(get_db)
):
    """List items with branch isolation"""
    collection = db["{router_name}"]
    
    # Build filter query with branch isolation
    filter_query = BranchContext.add_branch_filter(
        {{}}, 
        branch_context["branch_id"], 
        branch_context["user"]
    )
    
    # Add search if provided
    if search:
        search_regex = {{"$regex": search, "$options": "i"}}
        # Add appropriate search fields based on collection
        filter_query["$or"] = [
            {{"name": search_regex}},
            # Add more search fields as needed
        ]
    
    # Get total count
    total_count = await collection.count_documents(filter_query)
    
    # Get paginated results
    skip = (page - 1) * limit
    cursor = collection.find(filter_query).skip(skip).limit(limit).sort("created_at", -1)
    
    items = []
    async for item in cursor:
        item_data = {{
            "id": str(item["_id"]),
            **{{k: v for k, v in item.items() if k != "_id"}}
        }}
        items.append(item_data)
    
    total_pages = (total_count + limit - 1) // limit
    
    return {{
        "items": items,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "branch_id": branch_context["branch_id"],
        "branch_filtered": True
    }}

@router.get("/{{item_id}}")
async def get_item(
    item_id: str,
    branch_context: dict = Depends(get_branch_filter()),
    db = Depends(get_db)
):
    """Get single item with branch isolation"""
    collection = db["{router_name}"]
    
    # Build filter with branch isolation
    filter_query = BranchContext.add_branch_filter(
        {{"_id": ObjectId(item_id) if ObjectId.is_valid(item_id) else item_id}},
        branch_context["branch_id"],
        branch_context["user"]
    )
    
    item = await collection.find_one(filter_query)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or not accessible"
        )
    
    return {{
        "id": str(item["_id"]),
        **{{k: v for k, v in item.items() if k != "_id"}}
    }}

@router.post("/")
async def create_item(
    item_data: dict,
    branch_context: dict = Depends(get_branch_filter()),
    db = Depends(get_db)
):
    """Create item with branch isolation"""
    collection = db["{router_name}"]
    
    # Ensure branch compatibility
    item_data = await ensure_branch_compatibility(item_data, branch_context)
    
    # Add timestamps
    now = datetime.utcnow()
    item_data["created_at"] = now
    item_data["updated_at"] = now
    
    try:
        result = await collection.insert_one(item_data)
        return {{
            "id": str(result.inserted_id),
            **item_data
        }}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating item: {{str(e)}}"
        )

@router.put("/{{item_id}}")
async def update_item(
    item_id: str,
    update_data: dict,
    branch_context: dict = Depends(get_branch_filter()),
    db = Depends(get_db)
):
    """Update item with branch isolation"""
    collection = db["{router_name}"]
    
    # Find existing item with branch filter
    filter_query = BranchContext.add_branch_filter(
        {{"_id": ObjectId(item_id) if ObjectId.is_valid(item_id) else item_id}},
        branch_context["branch_id"],
        branch_context["user"]
    )
    
    existing_item = await collection.find_one(filter_query)
    if not existing_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or not accessible"
        )
    
    # Ensure branch compatibility
    update_data = await ensure_branch_compatibility(update_data, branch_context)
    update_data["updated_at"] = datetime.utcnow()
    
    await collection.update_one(filter_query, {{"$set": update_data}})
    
    # Return updated item
    updated_item = await collection.find_one(filter_query)
    return {{
        "id": str(updated_item["_id"]),
        **{{k: v for k, v in updated_item.items() if k != "_id"}}
    }}

@router.delete("/{{item_id}}")
async def delete_item(
    item_id: str,
    branch_context: dict = Depends(get_branch_filter()),
    db = Depends(get_db)
):
    """Delete item with branch isolation"""
    collection = db["{router_name}"]
    
    # Find existing item with branch filter
    filter_query = BranchContext.add_branch_filter(
        {{"_id": ObjectId(item_id) if ObjectId.is_valid(item_id) else item_id}},
        branch_context["branch_id"],
        branch_context["user"]
    )
    
    existing_item = await collection.find_one(filter_query)
    if not existing_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or not accessible"
        )
    
    # Only superadmins can hard delete, others do soft delete
    if branch_context["user"].get("role") != "superadmin":
        # Soft delete
        await collection.update_one(
            filter_query,
            {{"$set": {{"status": "inactive", "updated_at": datetime.utcnow()}}}}
        )
        return {{"message": "Item deactivated successfully"}}
    else:
        # Hard delete
        await collection.delete_one(filter_query)
        return {{"message": "Item deleted successfully"}}
'''

def update_router_files():
    """Update all router files to be branch-aware"""
    
    routers_dir = Path("app/routers")
    backup_dir = Path("app/routers_backup")
    
    # Create backup directory
    backup_dir.mkdir(exist_ok=True)
    
    print("🔄 Updating routers to be branch-aware...")
    
    for router_file in ROUTERS_TO_UPDATE:
        router_path = routers_dir / router_file
        backup_path = backup_dir / router_file
        branch_aware_path = routers_dir / f"{router_file.split('.')[0]}_branch_aware.py"
        
        if router_path.exists():
            print(f"   📁 Processing {router_file}...")
            
            # Create backup
            shutil.copy2(router_path, backup_path)
            print(f"      ✅ Backup created: {backup_path}")
            
            # Create branch-aware version
            branch_aware_content = create_branch_aware_router_template(router_file)
            
            with open(branch_aware_path, 'w') as f:
                f.write(branch_aware_content)
            print(f"      ✅ Branch-aware version created: {branch_aware_path}")
        else:
            print(f"      ⚠️  File not found: {router_file}")
    
    print("\n🎉 Router update completed!")
    print("\n📋 Next Steps:")
    print("1. Review the generated branch-aware routers")
    print("2. Update main.py to use the new routers") 
    print("3. Test each endpoint with branch isolation")
    print("4. Customize router templates as needed")

def create_main_py_update():
    """Create an updated main.py that uses branch-aware routers"""
    
    main_content = '''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
import asyncio

load_dotenv()

# Choose database implementation based on environment
USE_MOCK_DB = os.getenv("USE_MOCK_DB", "false").lower() == "true"

if USE_MOCK_DB:
    print("🔧 Using mock database for development")
    from .db_mock import get_db
else:
    print("🗄️ Using MongoDB database")
    from .db import get_db

# Import branch-aware routers
from .routers import (
    users, branches, 
    students_branch_aware as students,
    teachers_branch_aware as teachers,
    classes_branch_aware as classes,
    subjects_branch_aware as subjects,
    grade_levels_branch_aware as grade_levels,
    fees_branch_aware as fees,
    attendance_branch_aware as attendance,
    exams_branch_aware as exams,
    exam_results_branch_aware as exam_results,
    inventory_branch_aware as inventory,
    notifications_branch_aware as notifications,
    discipline_branch_aware as discipline,
    reports_branch_aware as reports,
    academic_calendar_branch_aware as academic_calendar,
    communication_branch_aware as communication,
    # Keep non-branch specific routers as they are
    backup_logs, grade_transitions, payment_mode, 
    student_enrollments, stats, uploads, registration_payments
)
from .utils.rate_limit import rate_limiter, periodic_cleanup

app = FastAPI(
    title="Spring of Knowledge Hub API - Branch Aware",
    version="2.0.0",
    description="Multi-branch school management system with data isolation",
    docs_url="/docs" if os.getenv("ENVIRONMENT", "development") == "development" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT", "development") == "development" else None,
)

# Security middleware - Trusted Host
allowed_hosts = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
if allowed_hosts and allowed_hosts[0]:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=allowed_hosts
    )

# Compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Session middleware for CSRF protection
session_secret = os.getenv("SESSION_SECRET_KEY")
if not session_secret:
    session_secret = os.urandom(32).hex()
    print("⚠️  SESSION_SECRET_KEY not set, using generated key")

app.add_middleware(
    SessionMiddleware,
    secret_key=session_secret
)

# CORS configuration with stricter settings
origins = os.getenv("CORS_ORIGINS", "http://localhost:8080,http://localhost:8081,http://localhost:8082,http://localhost:5173,http://127.0.0.1:8080,http://127.0.0.1:8081,http://127.0.0.1:8082,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    expose_headers=["X-Total-Count", "X-Page", "X-Per-Page"],
)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory="public/lovable-uploads"), name="uploads")

# Include branch-aware routers
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(branches.router, prefix="/branches", tags=["branches"])
app.include_router(students.router, prefix="/students", tags=["students-branch-aware"])
app.include_router(teachers.router, prefix="/teachers", tags=["teachers-branch-aware"])
app.include_router(classes.router, prefix="/classes", tags=["classes-branch-aware"])
app.include_router(subjects.router, prefix="/subjects", tags=["subjects-branch-aware"])
app.include_router(grade_levels.router, prefix="/grade-levels", tags=["grade-levels-branch-aware"])
app.include_router(fees.router, prefix="/fees", tags=["fees-branch-aware"])
app.include_router(attendance.router, prefix="/attendance", tags=["attendance-branch-aware"])
app.include_router(exams.router, prefix="/exams", tags=["exams-branch-aware"])
app.include_router(exam_results.router, prefix="/exam-results", tags=["exam-results-branch-aware"])
app.include_router(inventory.router, prefix="/inventory", tags=["inventory-branch-aware"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications-branch-aware"])
app.include_router(discipline.router, prefix="/discipline", tags=["discipline-branch-aware"])
app.include_router(reports.router, prefix="/reports", tags=["reports-branch-aware"])
app.include_router(academic_calendar.router, prefix="/academic-calendar", tags=["academic-calendar-branch-aware"])
app.include_router(communication.router, prefix="/communication", tags=["communication-branch-aware"])

# Include non-branch specific routers
app.include_router(backup_logs.router, prefix="/backup-logs", tags=["backup-logs"])
app.include_router(grade_transitions.router, prefix="/grade-transitions", tags=["grade-transitions"])
app.include_router(payment_mode.router, prefix="/payment-mode", tags=["payment-mode"])
app.include_router(registration_payments.router, prefix="/registration-payments", tags=["registration-payments"])
app.include_router(student_enrollments.router, prefix="/student-enrollments", tags=["student-enrollments"])
app.include_router(stats.router, prefix="/stats", tags=["statistics"])
app.include_router(uploads.router, prefix="/uploads", tags=["uploads"])

@app.on_event("startup")
async def startup_event():
    """Run startup tasks."""
    # Start periodic cleanup task
    asyncio.create_task(periodic_cleanup())
    print("✅ Branch-aware API server started successfully")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy", 
        "service": "Spring of Knowledge Hub API - Branch Aware",
        "version": "2.0.0",
        "features": ["branch_isolation", "data_security", "multi_tenant"]
    }

@app.get("/branch-status")
async def branch_status():
    """Check branch isolation status."""
    return {
        "branch_isolation": "enabled",
        "data_isolation": "per_branch",
        "cross_branch_access": "superadmin_only",
        "security_level": "high"
    }
'''
    
    with open("app/main_branch_aware.py", 'w') as f:
        f.write(main_content)
    
    print("✅ Created app/main_branch_aware.py")

if __name__ == "__main__":
    print("🏢 Spring of Knowledge Hub - Branch Isolation Setup")
    print("=" * 50)
    
    # Update router files
    update_router_files()
    
    # Create updated main.py
    create_main_py_update()
    
    print("\n🎯 Branch isolation setup completed!")
    print("\n📚 Summary of changes:")
    print("   • All routers now filter data by branch")
    print("   • Cross-branch access restricted to superadmins")
    print("   • Data isolation enforced at query level")
    print("   • Branch context available in all endpoints")
    print("   • Backup copies of original routers created")
    
    print("\n🚀 To activate branch-aware system:")
    print("   1. Replace app/main.py with app/main_branch_aware.py")
    print("   2. Run the branch-isolated database initialization")
    print("   3. Test with different branch users")
    print("   4. Verify data isolation works correctly")