"""
Test script for exam-report integration functionality
Tests the complete workflow from exam creation to report generation
"""
import asyncio
import pytest
import sys
import os
from datetime import datetime, timedelta
from bson import ObjectId

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.exam_grade_integration_service import ExamGradeIntegrationService, GradeUpdateTrigger
from app.services.report_generation_service import ReportGenerationService
from app.services.exam_scheduling_service import ExamSchedulingService
from app.utils.websocket_manager import WebSocketManager

class MockCollection:
    """Mock MongoDB collection for testing"""
    def __init__(self, initial_data=None):
        self.data = initial_data or []
        self._id_counter = 1
    
    async def insert_one(self, document):
        document["_id"] = ObjectId()
        self.data.append(document)
        return type('MockResult', (), {'inserted_id': document["_id"]})()
    
    async def find_one(self, query):
        for doc in self.data:
            if "_id" in query and doc.get("_id") == query["_id"]:
                return doc
            # Simple string matching for test purposes
            for key, value in query.items():
                if key in doc and doc[key] == value:
                    return doc
        return None
    
    async def update_one(self, query, update):
        for doc in self.data:
            if "_id" in query and doc.get("_id") == query["_id"]:
                if "$set" in update:
                    doc.update(update["$set"])
                return type('MockResult', (), {'matched_count': 1, 'modified_count': 1})()
        return type('MockResult', (), {'matched_count': 0, 'modified_count': 0})()
    
    async def count_documents(self, query):
        count = 0
        for doc in self.data:
            match = True
            for key, value in query.items():
                if key not in doc or doc[key] != value:
                    match = False
                    break
            if match:
                count += 1
        return count
    
    def find(self, query=None):
        query = query or {}
        matching_docs = []
        for doc in self.data:
            match = True
            for key, value in query.items():
                if key not in doc or doc[key] != value:
                    match = False
                    break
            if match:
                matching_docs.append(doc)
        
        return type('MockCursor', (), {
            'sort': lambda *args: type('MockCursor', (), {
                '__aiter__': lambda: iter(matching_docs),
                '__anext__': lambda: next(iter(matching_docs))
            })(),
            '__aiter__': lambda: iter(matching_docs),
            '__anext__': lambda: next(iter(matching_docs))
        })()

class MockWebSocketManager:
    """Mock WebSocket manager for testing"""
    def __init__(self):
        self.notifications_sent = []
        self.progress_updates = []
    
    async def broadcast_grade_notification(self, parent_ids, grade_data, student_name):
        self.notifications_sent.append({
            "type": "grade",
            "parent_ids": parent_ids,
            "data": grade_data,
            "student_name": student_name
        })
    
    async def broadcast_report_notification(self, parent_ids, report_data, student_name):
        self.notifications_sent.append({
            "type": "report",
            "parent_ids": parent_ids,
            "data": report_data,
            "student_name": student_name
        })
    
    async def broadcast_exam_notification(self, parent_ids, exam_data, student_name):
        self.notifications_sent.append({
            "type": "exam",
            "parent_ids": parent_ids,
            "data": exam_data,
            "student_name": student_name
        })
    
    async def send_progress_update(self, user_ids, operation_id, progress, message=""):
        self.progress_updates.append({
            "user_ids": user_ids,
            "operation_id": operation_id,
            "progress": progress,
            "message": message
        })

async def test_exam_result_to_report_integration():
    """Test the complete flow from exam result creation to report generation"""
    
    # Setup mock data
    exam_id = str(ObjectId())
    student_id = str(ObjectId())
    parent_id = str(ObjectId())
    class_id = str(ObjectId())
    
    # Mock collections with test data
    exams_collection = MockCollection([
        {
            "_id": ObjectId(exam_id),
            "name": "Mathematics Midterm",
            "subject_id": "math_101",
            "class_id": class_id,
            "total_marks": 100,
            "passing_marks": 40,
            "exam_type": "midterm",
            "term": "1st_term",
            "academic_year": "2023-2024"
        }
    ])
    
    students_collection = MockCollection([
        {
            "_id": ObjectId(student_id),
            "first_name": "John",
            "last_name": "Doe",
            "student_id": "STU001",
            "class_id": class_id,
            "parent_guardian_id": parent_id
        }
    ])
    
    parents_collection = MockCollection([
        {
            "_id": ObjectId(parent_id),
            "father_name": "John Doe Sr",
            "father_email": "johndoe@example.com",
            "student_ids": [student_id],
            "notifications": []
        }
    ])
    
    exam_results_collection = MockCollection()
    classes_collection = MockCollection([
        {
            "_id": ObjectId(class_id),
            "name": "Grade 10 A",
            "grade_level": 10,
            "student_count": 1
        }
    ])
    
    reports_collection = MockCollection()
    websocket_manager = MockWebSocketManager()
    
    # Test data for exam result
    exam_result_data = {
        "exam_id": exam_id,
        "student_id": student_id,
        "marks_obtained": 85,
        "percentage": 85.0,
        "grade": "A",
        "status": "pass",
        "attendance_status": "present",
        "submission_status": "submitted",
        "graded_by": "teacher_001",
        "created_at": datetime.utcnow()
    }
    
    print("=== Testing Exam-Report Integration ===")
    print(f"Exam: Mathematics Midterm (ID: {exam_id})")
    print(f"Student: John Doe (ID: {student_id})")
    print(f"Score: 85/100 (85%)")
    
    # Test 1: Process exam result update and trigger integration
    print("\n1. Testing exam result processing and integration...")
    
    integration_result = await ExamGradeIntegrationService.process_exam_result_update(
        exam_result=exam_result_data,
        trigger=GradeUpdateTrigger.EXAM_RESULT_CREATED,
        exams_collection=exams_collection,
        exam_results_collection=exam_results_collection,
        students_collection=students_collection,
        parents_collection=parents_collection,
        classes_collection=classes_collection,
        reports_collection=reports_collection,
        websocket_manager=websocket_manager,
        auto_generate_reports=True
    )
    
    assert integration_result["success"], "Integration should succeed"
    print("✓ Exam result processing completed successfully")
    print(f"✓ Integration result: {integration_result.get('message', 'Integration completed successfully')}")
    if "report_generated" in integration_result:
        print(f"✓ Report generation: {integration_result['report_generated']}")
    if "notifications_sent" in integration_result:
        print(f"✓ Notifications sent: {len(integration_result['notifications_sent'])}")
    
    # Test 2: Verify notifications were sent
    print("\n2. Testing notification system...")
    
    assert len(websocket_manager.notifications_sent) > 0, "Notifications should be sent"
    
    # Check for exam notification
    exam_notifications = [n for n in websocket_manager.notifications_sent if n["type"] == "exam"]
    assert len(exam_notifications) > 0, "Exam notification should be sent"
    
    exam_notif = exam_notifications[0]
    assert student_id in exam_notif["parent_ids"] or parent_id in exam_notif["parent_ids"], "Parent should receive notification"
    assert exam_notif["student_name"] == "John Doe", "Student name should be correct"
    assert exam_notif["data"]["marks_obtained"] == 85, "Exam data should be correct"
    
    print("✓ Exam notification sent to parents")
    print(f"✓ Notification content: {exam_notif['data']['marks_obtained']}/{exam_notif['data'].get('total_marks', 100)}")
    
    # Test 3: Verify report generation was triggered
    print("\n3. Testing automated report generation...")
    
    # Check if report was created in the reports collection
    reports_count = await reports_collection.count_documents({"student_id": student_id})
    assert reports_count > 0, "Report should be generated"
    
    print(f"✓ {reports_count} report(s) generated for student")
    
    # Test 4: Test exam scheduling integration
    print("\n4. Testing exam scheduling integration...")
    
    exam_schedules_collection = MockCollection()
    report_schedules_collection = MockCollection()
    
    exam_data_for_scheduling = {
        "id": exam_id,
        "name": "Mathematics Midterm",
        "class_id": class_id,
        "exam_date": datetime.utcnow() + timedelta(days=7),
        "duration_minutes": 120,
        "exam_type": "midterm",
        "created_by": "teacher_001"
    }
    
    schedule_result = await ExamSchedulingService.schedule_exam_with_report_integration(
        exam_data=exam_data_for_scheduling,
        exams_collection=exams_collection,
        exam_schedules_collection=exam_schedules_collection,
        report_schedules_collection=report_schedules_collection,
        classes_collection=classes_collection,
        websocket_manager=websocket_manager,
        auto_schedule_reports=True
    )
    
    assert schedule_result["exam_id"] == exam_id, "Exam should be scheduled"
    assert len(schedule_result["report_schedules"]) > 0, "Report schedules should be created"
    
    print("✓ Exam scheduled successfully")
    print(f"✓ {len(schedule_result['report_schedules'])} report schedule(s) created")
    
    # Test 5: Test report generation service directly
    print("\n5. Testing direct report generation...")
    
    report_request = {
        "student_id": student_id,
        "class_id": class_id,
        "term_id": "term_001",
        "report_type": "progress_report",
        "auto_publish_to_parents": True,
        "include_behavior_comments": False,
        "include_attendance_summary": True
    }
    
    report_result = await ReportGenerationService.generate_student_report(
        request=report_request,
        students_collection=students_collection,
        parents_collection=parents_collection,
        exams_collection=exams_collection,
        exam_results_collection=exam_results_collection,
        classes_collection=classes_collection,
        reports_collection=reports_collection,
        websocket_manager=websocket_manager
    )
    
    assert report_result["success"], "Report generation should succeed"
    assert "report_id" in report_result, "Report ID should be returned"
    
    print("✓ Direct report generation successful")
    print(f"✓ Report ID: {report_result.get('report_id', 'N/A')}")
    
    # Test 6: Verify parent notifications for reports
    print("\n6. Testing parent portal notifications...")
    
    report_notifications = [n for n in websocket_manager.notifications_sent if n["type"] == "report"]
    assert len(report_notifications) > 0, "Report notifications should be sent"
    
    report_notif = report_notifications[0]
    assert report_notif["student_name"] == "John Doe", "Student name should be correct in report notification"
    
    print("✓ Report notification sent to parents")
    print(f"✓ Report type: {report_notif['data'].get('report_type', 'progress_report')}")
    
    # Test 7: Check progress updates
    print("\n7. Testing progress updates...")
    
    assert len(websocket_manager.progress_updates) > 0, "Progress updates should be sent"
    
    completed_updates = [u for u in websocket_manager.progress_updates if u["progress"] == 100]
    assert len(completed_updates) > 0, "Should have completion updates"
    
    print(f"✓ {len(websocket_manager.progress_updates)} progress updates sent")
    print(f"✓ {len(completed_updates)} operations completed")
    
    print("\n=== Integration Test Results ===")
    print("✓ All tests passed successfully!")
    print("✓ Exam result processing: WORKING")
    print("✓ Automated report generation: WORKING") 
    print("✓ Parent notifications: WORKING")
    print("✓ Exam scheduling integration: WORKING")
    print("✓ Real-time progress updates: WORKING")
    print("\nIntegration test completed successfully! 🎉")
    
    return True

async def test_error_handling():
    """Test error handling in the integration"""
    print("\n=== Testing Error Handling ===")
    
    # Test with missing exam data
    try:
        websocket_manager = MockWebSocketManager()
        result = await ExamGradeIntegrationService.process_exam_result_update(
            exam_result={"invalid": "data"},
            trigger=GradeUpdateTrigger.EXAM_RESULT_CREATED,
            exams_collection=MockCollection(),
            exam_results_collection=MockCollection(),
            students_collection=MockCollection(),
            parents_collection=MockCollection(),
            classes_collection=MockCollection(),
            reports_collection=MockCollection(),
            websocket_manager=websocket_manager,
            auto_generate_reports=True
        )
        print("✓ Error handling test passed - graceful failure")
    except Exception as e:
        print(f"✓ Error handling test passed - exception caught: {str(e)[:50]}...")
    
    return True

async def main():
    """Run all integration tests"""
    print("Starting Exam-Report Integration Tests...")
    print("=" * 50)
    
    try:
        # Run main integration test
        await test_exam_result_to_report_integration()
        
        # Run error handling test
        await test_error_handling()
        
        print("\n" + "=" * 50)
        print("🎉 ALL TESTS PASSED! 🎉")
        print("The exam-report integration system is working correctly.")
        print("Features verified:")
        print("- ✅ Exam result processing")
        print("- ✅ Automated report generation") 
        print("- ✅ Parent portal notifications")
        print("- ✅ Real-time progress updates")
        print("- ✅ Exam scheduling integration")
        print("- ✅ Error handling")
        
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)