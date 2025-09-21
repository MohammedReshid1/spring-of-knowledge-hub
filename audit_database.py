#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    try:
        client = AsyncIOMotorClient("mongodb://localhost:27017/")
        db = client.spring_of_knowledge
        
        # Check all collections we need for reports
        collections_to_check = [
            'students',
            'classes', 
            'attendance',
            'registration_payments',
            'exam_results',
            'exams',
            'branches',
            'grade_levels',
            'fees',
            'teachers'
        ]
        
        print("=== DATABASE AUDIT FOR REPORTS ===\n")
        
        for collection_name in collections_to_check:
            collection = db[collection_name]
            count = await collection.count_documents({})
            print(f"{collection_name}: {count} documents")
            
            if count > 0:
                # Get sample document to see structure
                sample = await collection.find_one({})
                if sample:
                    keys = list(sample.keys())
                    print(f"  Sample fields: {', '.join(keys[:10])}{'...' if len(keys) > 10 else ''}")
            print()
        
        # Check specific data that reports need
        print("=== REPORT-SPECIFIC DATA CHECKS ===\n")
        
        # Financial data
        payments = db.registration_payments
        payment_count = await payments.count_documents({})
        print(f"Total payments for financial reports: {payment_count}")
        if payment_count > 0:
            sample_payment = await payments.find_one({})
            print(f"Sample payment fields: {list(sample_payment.keys())}")
            # Check if payments have amounts
            payments_with_amount = await payments.count_documents({"amount_paid": {"$exists": True, "$gt": 0}})
            print(f"Payments with amount > 0: {payments_with_amount}")
        print()
        
        # Attendance data
        attendance = db.attendance
        attendance_count = await attendance.count_documents({})
        print(f"Total attendance records: {attendance_count}")
        if attendance_count > 0:
            sample_attendance = await attendance.find_one({})
            print(f"Sample attendance fields: {list(sample_attendance.keys())}")
        print()
        
        # Students with classes
        students = db.students
        students_with_class = await students.count_documents({"class_id": {"$exists": True, "$ne": None}})
        total_students = await students.count_documents({})
        print(f"Students with class assignment: {students_with_class}/{total_students}")
        
        # Check if we have any exam data
        exam_results = db.exam_results
        exam_count = await exam_results.count_documents({})
        print(f"Total exam results: {exam_count}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())