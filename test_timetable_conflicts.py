#!/usr/bin/env python3
"""
Test script for timetable conflict detection system
"""
import asyncio
import logging
from datetime import datetime, time
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import our conflict detection system
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.utils.timetable_conflicts import TimetableConflictDetector
from backend.app.db import get_db

def get_database():
    """Wrapper function to match the expected interface"""
    return get_db()

class TimetableConflictTester:
    def __init__(self):
        self.db = get_database()
        self.conflict_detector = TimetableConflictDetector()
        self.test_data = {}
    
    async def setup_test_data(self):
        """Create test data for conflict detection"""
        logger.info("Setting up test data...")
        
        # Create test time slots
        time_slots = [
            {
                "_id": ObjectId(),
                "period_number": 1,
                "start_time": "09:00:00",
                "end_time": "10:00:00",
                "period_type": "regular",
                "is_break": False,
                "branch_id": "test_branch"
            },
            {
                "_id": ObjectId(),
                "period_number": 2,
                "start_time": "10:00:00",
                "end_time": "11:00:00",
                "period_type": "regular",
                "is_break": False,
                "branch_id": "test_branch"
            }
        ]
        
        # Clear and insert test time slots
        await self.db.time_slots.delete_many({"branch_id": "test_branch"})
        await self.db.time_slots.insert_many(time_slots)
        
        # Create test teachers, classes, subjects
        teacher1_id = ObjectId()
        teacher2_id = ObjectId()
        
        teachers = [
            {
                "_id": teacher1_id,
                "teacher_id": "T001",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@school.edu",
                "branch_id": "test_branch"
            },
            {
                "_id": teacher2_id,
                "teacher_id": "T002",
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane.smith@school.edu",
                "branch_id": "test_branch"
            }
        ]
        
        classes = [
            {
                "_id": ObjectId(),
                "class_name": "Grade 9A",
                "grade_level": "9",
                "branch_id": "test_branch"
            },
            {
                "_id": ObjectId(),
                "class_name": "Grade 9B",
                "grade_level": "9",
                "branch_id": "test_branch"
            }
        ]
        
        subjects = [
            {
                "_id": ObjectId(),
                "subject_name": "Mathematics",
                "subject_code": "MATH101",
                "branch_id": "test_branch"
            },
            {
                "_id": ObjectId(),
                "subject_name": "Physics",
                "subject_code": "PHY101",
                "branch_id": "test_branch"
            }
        ]
        
        # Clear and insert test data
        for collection_name, data in [
            ("teachers", teachers),
            ("classes", classes),
            ("subjects", subjects)
        ]:
            await self.db[collection_name].delete_many({"branch_id": "test_branch"})
            await self.db[collection_name].insert_many(data)
        
        # Store IDs for tests
        self.test_data = {
            "time_slots": time_slots,
            "teachers": teachers,
            "classes": classes,
            "subjects": subjects
        }
        
        logger.info("Test data setup completed")
    
    async def test_teacher_overlap_conflict(self):
        """Test teacher double-booking conflict"""
        logger.info("Testing teacher overlap conflict...")
        
        teacher_id = str(self.test_data["teachers"][0]["_id"])
        time_slot_id = str(self.test_data["time_slots"][0]["_id"])
        class1_id = str(self.test_data["classes"][0]["_id"])
        class2_id = str(self.test_data["classes"][1]["_id"])
        subject_id = str(self.test_data["subjects"][0]["_id"])
        
        # Create first entry
        entry1 = {
            "class_id": class1_id,
            "subject_id": subject_id,
            "teacher_id": teacher_id,
            "room_number": "101",
            "day_of_week": "monday",
            "time_slot_id": time_slot_id,
            "academic_year": "2024-2025",
            "branch_id": "test_branch",
            "created_at": datetime.now()
        }
        
        await self.db.timetable_entries.insert_one(entry1)
        
        # Try to create conflicting entry (same teacher, same time)
        entry2 = {
            "class_id": class2_id,
            "subject_id": subject_id,
            "teacher_id": teacher_id,  # Same teacher
            "room_number": "102",
            "day_of_week": "monday",  # Same day
            "time_slot_id": time_slot_id,  # Same time slot
            "academic_year": "2024-2025",
            "branch_id": "test_branch",
            "created_at": datetime.now()
        }
        
        conflicts = await self.conflict_detector.detect_entry_conflicts(entry2, self.db)
        
        assert len(conflicts) > 0, "Should detect teacher overlap conflict"
        teacher_conflicts = [c for c in conflicts if c.conflict_type == "teacher_overlap"]
        assert len(teacher_conflicts) > 0, "Should detect teacher overlap specifically"
        
        logger.info(f"✓ Teacher overlap conflict detected: {teacher_conflicts[0].description}")
        return True
    
    async def test_room_overlap_conflict(self):
        """Test room double-booking conflict"""
        logger.info("Testing room overlap conflict...")
        
        teacher1_id = str(self.test_data["teachers"][0]["_id"])
        teacher2_id = str(self.test_data["teachers"][1]["_id"])
        time_slot_id = str(self.test_data["time_slots"][1]["_id"])  # Use different time slot
        class1_id = str(self.test_data["classes"][0]["_id"])
        class2_id = str(self.test_data["classes"][1]["_id"])
        subject_id = str(self.test_data["subjects"][0]["_id"])
        
        # Create first entry
        entry1 = {
            "class_id": class1_id,
            "subject_id": subject_id,
            "teacher_id": teacher1_id,
            "room_number": "201",
            "day_of_week": "tuesday",
            "time_slot_id": time_slot_id,
            "academic_year": "2024-2025",
            "branch_id": "test_branch",
            "created_at": datetime.now()
        }
        
        await self.db.timetable_entries.insert_one(entry1)
        
        # Try to create conflicting entry (same room, same time)
        entry2 = {
            "class_id": class2_id,
            "subject_id": subject_id,
            "teacher_id": teacher2_id,  # Different teacher
            "room_number": "201",  # Same room
            "day_of_week": "tuesday",  # Same day
            "time_slot_id": time_slot_id,  # Same time slot
            "academic_year": "2024-2025",
            "branch_id": "test_branch",
            "created_at": datetime.now()
        }
        
        conflicts = await self.conflict_detector.detect_entry_conflicts(entry2, self.db)
        
        assert len(conflicts) > 0, "Should detect room overlap conflict"
        room_conflicts = [c for c in conflicts if c.conflict_type == "room_overlap"]
        assert len(room_conflicts) > 0, "Should detect room overlap specifically"
        
        logger.info(f"✓ Room overlap conflict detected: {room_conflicts[0].description}")
        return True
    
    async def test_class_overlap_conflict(self):
        """Test class double-booking conflict"""
        logger.info("Testing class overlap conflict...")
        
        teacher1_id = str(self.test_data["teachers"][0]["_id"])
        teacher2_id = str(self.test_data["teachers"][1]["_id"])
        time_slot_id = str(self.test_data["time_slots"][0]["_id"])
        class_id = str(self.test_data["classes"][0]["_id"])
        subject1_id = str(self.test_data["subjects"][0]["_id"])
        subject2_id = str(self.test_data["subjects"][1]["_id"])
        
        # Create first entry for a class
        entry1 = {
            "class_id": class_id,
            "subject_id": subject1_id,
            "teacher_id": teacher1_id,
            "room_number": "301",
            "day_of_week": "wednesday",
            "time_slot_id": time_slot_id,
            "academic_year": "2024-2025",
            "branch_id": "test_branch",
            "created_at": datetime.now()
        }
        
        await self.db.timetable_entries.insert_one(entry1)
        
        # Try to create conflicting entry (same class, same time)
        entry2 = {
            "class_id": class_id,  # Same class
            "subject_id": subject2_id,  # Different subject
            "teacher_id": teacher2_id,  # Different teacher
            "room_number": "302",  # Different room
            "day_of_week": "wednesday",  # Same day
            "time_slot_id": time_slot_id,  # Same time slot
            "academic_year": "2024-2025",
            "branch_id": "test_branch",
            "created_at": datetime.now()
        }
        
        conflicts = await self.conflict_detector.detect_entry_conflicts(entry2, self.db)
        
        assert len(conflicts) > 0, "Should detect class overlap conflict"
        class_conflicts = [c for c in conflicts if c.conflict_type == "class_overlap"]
        assert len(class_conflicts) > 0, "Should detect class overlap specifically"
        
        logger.info(f"✓ Class overlap conflict detected: {class_conflicts[0].description}")
        return True
    
    async def test_no_conflicts(self):
        """Test that valid entries don't create conflicts"""
        logger.info("Testing valid entry with no conflicts...")
        
        teacher_id = str(self.test_data["teachers"][1]["_id"])
        time_slot_id = str(self.test_data["time_slots"][1]["_id"])
        class_id = str(self.test_data["classes"][1]["_id"])
        subject_id = str(self.test_data["subjects"][1]["_id"])
        
        # Create a valid entry that shouldn't conflict
        entry = {
            "class_id": class_id,
            "subject_id": subject_id,
            "teacher_id": teacher_id,
            "room_number": "401",  # Unique room
            "day_of_week": "friday",  # Different day
            "time_slot_id": time_slot_id,
            "academic_year": "2024-2025",
            "branch_id": "test_branch",
            "created_at": datetime.now()
        }
        
        conflicts = await self.conflict_detector.detect_entry_conflicts(entry, self.db)
        
        assert len(conflicts) == 0, f"Should not detect conflicts, but found: {[c.description for c in conflicts]}"
        
        logger.info("✓ No conflicts detected for valid entry")
        return True
    
    async def cleanup_test_data(self):
        """Clean up test data"""
        logger.info("Cleaning up test data...")
        
        collections = ["time_slots", "teachers", "classes", "subjects", "timetable_entries", "timetable_conflicts"]
        for collection in collections:
            await self.db[collection].delete_many({"branch_id": "test_branch"})
        
        logger.info("Test data cleanup completed")
    
    async def run_all_tests(self):
        """Run all conflict detection tests"""
        logger.info("Starting timetable conflict detection tests...")
        
        try:
            await self.setup_test_data()
            
            tests = [
                self.test_teacher_overlap_conflict,
                self.test_room_overlap_conflict,
                self.test_class_overlap_conflict,
                self.test_no_conflicts
            ]
            
            passed = 0
            failed = 0
            
            for test in tests:
                try:
                    await test()
                    passed += 1
                except Exception as e:
                    logger.error(f"✗ Test {test.__name__} failed: {str(e)}")
                    failed += 1
            
            logger.info(f"Tests completed: {passed} passed, {failed} failed")
            
            if failed == 0:
                logger.info("🎉 All tests passed! Conflict detection system is working correctly.")
            else:
                logger.error(f"❌ {failed} tests failed. Please review the conflict detection system.")
            
            return failed == 0
            
        finally:
            await self.cleanup_test_data()

async def main():
    """Main test runner"""
    tester = TimetableConflictTester()
    success = await tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)