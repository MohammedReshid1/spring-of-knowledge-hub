#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json
import os
from pathlib import Path

async def comprehensive_backend_audit():
    """Comprehensive audit of the entire backend system"""
    
    print("=" * 80)
    print("COMPREHENSIVE BACKEND SYSTEM AUDIT")
    print("=" * 80)
    
    try:
        # Connect to database
        client = AsyncIOMotorClient("mongodb://localhost:27017/")
        db = client.spring_of_knowledge
        
        # 1. DATABASE COLLECTIONS AUDIT
        print("\n1. DATABASE COLLECTIONS OVERVIEW")
        print("-" * 50)
        
        collections = await db.list_collection_names()
        print(f"Total collections: {len(collections)}")
        
        collection_stats = {}
        for collection_name in collections:
            collection = db[collection_name]
            count = await collection.count_documents({})
            collection_stats[collection_name] = count
            
            # Get sample document structure
            sample = await collection.find_one({})
            fields = list(sample.keys()) if sample else []
            
            print(f"\n{collection_name}: {count} documents")
            if fields:
                print(f"  Fields: {', '.join(fields[:8])}{'...' if len(fields) > 8 else ''}")
        
        # 2. DATA RELATIONSHIPS AUDIT
        print("\n\n2. DATA RELATIONSHIPS & REFERENCES")
        print("-" * 50)
        
        # Check student-class relationships
        students_collection = db.students
        classes_collection = db.classes
        
        total_students = await students_collection.count_documents({})
        students_with_class = await students_collection.count_documents({"class_id": {"$exists": True, "$ne": None}})
        
        print(f"Students: {total_students} total, {students_with_class} with class assignment")
        
        # Check payment relationships
        payments_collection = db.registration_payments
        fees_collection = db.fees
        
        total_payments = await payments_collection.count_documents({})
        payments_with_amount = await payments_collection.count_documents({"amount_paid": {"$gt": 0}})
        
        total_fees = await fees_collection.count_documents({})
        fees_with_amount = await fees_collection.count_documents({"amount_paid": {"$gt": 0}})
        
        print(f"Payments: {total_payments} total, {payments_with_amount} with amount > 0")
        print(f"Fees: {total_fees} total, {fees_with_amount} with amount > 0")
        
        # Check exam relationships
        exams_collection = db.exams
        exam_results_collection = db.exam_results
        
        total_exams = await exams_collection.count_documents({})
        total_results = await exam_results_collection.count_documents({})
        
        print(f"Exams: {total_exams} total, {total_results} results")
        
        # 3. DATA CONSISTENCY ISSUES
        print("\n\n3. DATA CONSISTENCY ISSUES")
        print("-" * 50)
        
        # Check for orphaned references
        if students_with_class > 0:
            # Get all class IDs referenced by students
            student_class_ids = await students_collection.distinct("class_id")
            actual_class_ids = await classes_collection.distinct("_id")
            actual_class_ids_str = [str(cid) for cid in actual_class_ids]
            
            orphaned_refs = [cid for cid in student_class_ids if cid and str(cid) not in actual_class_ids_str]
            if orphaned_refs:
                print(f"WARNING: {len(orphaned_refs)} orphaned class references in students")
        
        # Check for inconsistent field formats
        print("\n4. FIELD FORMAT CONSISTENCY")
        print("-" * 50)
        
        # Check date formats across collections
        date_fields_check = [
            ("students", "created_at"),
            ("classes", "created_at"), 
            ("registration_payments", "payment_date"),
            ("fees", "due_date"),
            ("attendance", "attendance_date")
        ]
        
        for collection_name, field_name in date_fields_check:
            collection = db[collection_name]
            sample_dates = await collection.find({field_name: {"$exists": True}}).limit(3).to_list(length=3)
            
            if sample_dates:
                date_types = set()
                for doc in sample_dates:
                    date_val = doc.get(field_name)
                    if date_val:
                        date_types.add(type(date_val).__name__)
                
                print(f"{collection_name}.{field_name}: {', '.join(date_types)}")
        
        # 5. API ENDPOINTS ANALYSIS
        print("\n\n5. BACKEND FILE STRUCTURE")
        print("-" * 50)
        
        backend_path = Path("/Users/ahmed/Documents/GitHub/spring-of-knowledge-hub/backend")
        
        # Check routers
        routers_path = backend_path / "app" / "routers"
        if routers_path.exists():
            router_files = list(routers_path.glob("*.py"))
            print(f"Router files: {len(router_files)}")
            for router_file in router_files:
                print(f"  - {router_file.name}")
        
        # Check models
        models_path = backend_path / "app" / "models"
        if models_path.exists():
            model_files = list(models_path.glob("*.py"))
            print(f"Model files: {len(model_files)}")
            for model_file in model_files:
                print(f"  - {model_file.name}")
        
        print("\n" + "=" * 80)
        print("AUDIT COMPLETE")
        print("=" * 80)
        
        return collection_stats
    
    except Exception as e:
        print(f"Error during audit: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(comprehensive_backend_audit())