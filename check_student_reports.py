#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient("mongodb://localhost:27017/")
        db = client.school_management
        
        # Check student reports collection
        student_reports_collection = db.student_reports
        report_count = await student_reports_collection.count_documents({})
        
        print(f"Total student reports in database: {report_count}")
        
        if report_count > 0:
            # Get a few sample reports
            reports = await student_reports_collection.find({}).limit(5).to_list(length=5)
            for report in reports:
                print(f"Report: {report.get('report_code', 'N/A')} - Student: {report.get('student_name', 'N/A')} - Year: {report.get('academic_year', 'N/A')}")
        else:
            print("No student reports found. This explains why the frontend shows empty state.")
            print("You can generate reports using the 'Generate Report' button in the UI.")
        
        # Check if any students exist to generate reports for
        students_collection = db.students
        student_count = await students_collection.count_documents({})
        print(f"\nAvailable students for report generation: {student_count}")
        
        if student_count > 0:
            # Get first few students
            students = await students_collection.find({}).limit(3).to_list(length=3)
            print("Sample students:")
            for student in students:
                print(f"  - ID: {student.get('student_id', 'N/A')} - Name: {student.get('first_name', '')} {student.get('last_name', '')} - Class: {student.get('class_id', 'N/A')}")
    
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())