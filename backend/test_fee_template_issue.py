#!/usr/bin/env python3
"""
Test script to diagnose fee template creation and retrieval issue
"""
import asyncio
import json
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.spring_of_knowledge

async def inspect_fee_templates():
    """Inspect fee templates collection"""
    print("\n" + "="*80)
    print("INSPECTING FEE TEMPLATES COLLECTION")
    print("="*80)
    
    templates_coll = db["fee_templates"]
    
    # Check if collection exists
    collections = await db.list_collection_names()
    print(f"\nFee templates collection exists: {'fee_templates' in collections}")
    
    # Count documents
    count = await templates_coll.count_documents({})
    print(f"Total fee templates in database: {count}")
    
    # Get sample documents
    print("\nSample fee templates (first 5):")
    async for template in templates_coll.find().limit(5):
        print(f"\nTemplate ID: {template.get('_id')}")
        print(f"  Name: {template.get('name')}")
        print(f"  Category: {template.get('category')}")
        print(f"  Amount: {template.get('amount')}")
        print(f"  Branch ID: {template.get('branch_id')}")
        print(f"  Academic Year: {template.get('academic_year')}")
        print(f"  Is Active: {template.get('is_active')}")
        print(f"  Created At: {template.get('created_at')}")
    
    # Check for templates without branch_id
    no_branch_count = await templates_coll.count_documents({"branch_id": None})
    print(f"\nTemplates without branch_id: {no_branch_count}")
    
    # Check for templates with branch_id
    with_branch_count = await templates_coll.count_documents({"branch_id": {"$ne": None}})
    print(f"Templates with branch_id: {with_branch_count}")
    
    # Get unique branch IDs
    branch_ids = await templates_coll.distinct("branch_id")
    print(f"\nUnique branch IDs in templates: {branch_ids}")
    
    return templates_coll

async def inspect_fees_collection():
    """Inspect fees collection"""
    print("\n" + "="*80)
    print("INSPECTING FEES COLLECTION")
    print("="*80)
    
    fees_coll = db["fees"]
    
    # Count documents
    count = await fees_coll.count_documents({})
    print(f"Total fees in database: {count}")
    
    # Get sample documents
    print("\nSample fees (first 5):")
    async for fee in fees_coll.find().limit(5):
        print(f"\nFee ID: {fee.get('_id')}")
        print(f"  Type: {fee.get('fee_type')}")
        print(f"  Amount: {fee.get('amount')}")
        print(f"  Student ID: {fee.get('student_id')}")
        print(f"  Branch ID: {fee.get('branch_id')}")
        print(f"  Status: {fee.get('status')}")
        print(f"  Academic Year: {fee.get('academic_year')}")
    
    return fees_coll

async def test_create_fee_template():
    """Test creating a fee template directly"""
    print("\n" + "="*80)
    print("TESTING FEE TEMPLATE CREATION")
    print("="*80)
    
    templates_coll = db["fee_templates"]
    
    # Create test template
    test_template = {
        "name": f"Test Template {datetime.utcnow().isoformat()}",
        "category": "tuition",
        "amount": 500.00,
        "description": "Test template created by diagnostic script",
        "frequency": "monthly",
        "is_mandatory": True,
        "branch_id": None,  # Test without branch first
        "academic_year": "2024-2025",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    print("\nCreating test template...")
    print(json.dumps({k: str(v) if isinstance(v, datetime) else v for k, v in test_template.items()}, indent=2))
    
    result = await templates_coll.insert_one(test_template)
    print(f"\nTemplate created with ID: {result.inserted_id}")
    
    # Verify creation
    created = await templates_coll.find_one({"_id": result.inserted_id})
    if created:
        print("✓ Template successfully created and retrieved")
        print(f"  Retrieved template name: {created.get('name')}")
    else:
        print("✗ Failed to retrieve created template")
    
    return result.inserted_id

async def test_branch_filtering():
    """Test branch filtering logic"""
    print("\n" + "="*80)
    print("TESTING BRANCH FILTERING")
    print("="*80)
    
    templates_coll = db["fee_templates"]
    branches_coll = db["branches"]
    
    # Get a sample branch
    sample_branch = await branches_coll.find_one()
    if sample_branch:
        branch_id = str(sample_branch["_id"])
        print(f"Using branch ID: {branch_id}")
        print(f"Branch name: {sample_branch.get('name')}")
        
        # Create template with branch
        test_template = {
            "name": f"Branch Test Template {datetime.utcnow().isoformat()}",
            "category": "facilities",
            "amount": 300.00,
            "branch_id": branch_id,
            "academic_year": "2024-2025",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await templates_coll.insert_one(test_template)
        print(f"\nCreated template with branch_id: {result.inserted_id}")
        
        # Test different queries
        queries = [
            ({}, "No filter"),
            ({"branch_id": branch_id}, f"Filter by branch_id={branch_id}"),
            ({"branch_id": None}, "Filter by branch_id=None"),
            ({"is_active": True}, "Filter by is_active=True"),
            ({"branch_id": branch_id, "is_active": True}, "Filter by branch_id AND is_active")
        ]
        
        for query, description in queries:
            count = await templates_coll.count_documents(query)
            print(f"\n{description}:")
            print(f"  Query: {query}")
            print(f"  Results: {count} templates")
    else:
        print("No branches found in database")

async def inspect_indexes():
    """Check indexes on collections"""
    print("\n" + "="*80)
    print("CHECKING INDEXES")
    print("="*80)
    
    templates_coll = db["fee_templates"]
    
    indexes = await templates_coll.list_indexes().to_list(None)
    print("\nFee Templates Indexes:")
    for idx in indexes:
        print(f"  - {idx.get('name')}: {idx.get('key')}")
    
    # Check if we need branch_id index
    has_branch_index = any('branch_id' in str(idx.get('key', {})) for idx in indexes)
    if not has_branch_index:
        print("\n⚠ No index on branch_id field - this could affect query performance")

async def check_data_consistency():
    """Check data consistency between collections"""
    print("\n" + "="*80)
    print("CHECKING DATA CONSISTENCY")
    print("="*80)
    
    templates_coll = db["fee_templates"]
    branches_coll = db["branches"]
    
    # Get all unique branch_ids from templates
    template_branch_ids = await templates_coll.distinct("branch_id")
    template_branch_ids = [bid for bid in template_branch_ids if bid is not None]
    
    # Get all branch IDs from branches collection
    all_branches = await branches_coll.find({}, {"_id": 1}).to_list(None)
    valid_branch_ids = [str(b["_id"]) for b in all_branches]
    
    print(f"Branch IDs in templates: {len(template_branch_ids)}")
    print(f"Valid branches in database: {len(valid_branch_ids)}")
    
    # Check for orphaned templates
    orphaned_ids = set(template_branch_ids) - set(valid_branch_ids)
    if orphaned_ids:
        print(f"\n⚠ Found {len(orphaned_ids)} orphaned branch IDs in templates:")
        for oid in orphaned_ids:
            count = await templates_coll.count_documents({"branch_id": oid})
            print(f"  - {oid}: {count} templates")
    else:
        print("\n✓ All branch_ids in templates are valid")

async def main():
    """Run all diagnostic tests"""
    try:
        print("\n" + "="*80)
        print("FEE TEMPLATE DIAGNOSTIC REPORT")
        print(f"Timestamp: {datetime.utcnow().isoformat()}")
        print("="*80)
        
        # Run inspections
        await inspect_fee_templates()
        await inspect_fees_collection()
        await test_create_fee_template()
        await test_branch_filtering()
        await inspect_indexes()
        await check_data_consistency()
        
        print("\n" + "="*80)
        print("DIAGNOSTIC COMPLETE")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ Error during diagnostics: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())