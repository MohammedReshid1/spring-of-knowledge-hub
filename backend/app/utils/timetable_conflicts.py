"""
Timetable conflict detection and resolution algorithms
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, time, date
from bson import ObjectId

from ..models.timetable import TimetableConflict, ConflictType

logger = logging.getLogger(__name__)

class TimetableConflictDetector:
    """Advanced conflict detection for timetable scheduling"""
    
    def __init__(self):
        self.conflict_rules = {
            "teacher_overlap": self._check_teacher_overlap,
            "room_overlap": self._check_room_overlap,
            "class_overlap": self._check_class_overlap,
            "resource_overlap": self._check_resource_overlap,
            "time_constraint": self._check_time_constraints
        }
    
    async def detect_entry_conflicts(self, entry_data: Dict[str, Any], db) -> List[TimetableConflict]:
        """
        Detect all possible conflicts for a timetable entry
        """
        conflicts = []
        
        try:
            # Run all conflict detection rules
            for conflict_type, check_function in self.conflict_rules.items():
                detected_conflicts = await check_function(entry_data, db)
                conflicts.extend(detected_conflicts)
            
            logger.info(f"Detected {len(conflicts)} conflicts for entry")
            return conflicts
            
        except Exception as e:
            logger.error(f"Error detecting conflicts: {str(e)}")
            return []
    
    async def _check_teacher_overlap(self, entry_data: Dict[str, Any], db) -> List[TimetableConflict]:
        """Check for teacher scheduling conflicts"""
        conflicts = []
        
        teacher_id = entry_data.get("teacher_id")
        if not teacher_id:
            return conflicts
        
        try:
            # Find overlapping entries for the same teacher
            overlap_query = {
                "teacher_id": teacher_id,
                "day_of_week": entry_data["day_of_week"],
                "time_slot_id": entry_data["time_slot_id"],
                "academic_year": entry_data["academic_year"]
            }
            
            # Exclude current entry if updating
            if entry_data.get("_id"):
                overlap_query["_id"] = {"$ne": ObjectId(entry_data["_id"])}
            
            overlapping_entries = await db.timetable_entries.find(overlap_query).to_list(None)
            
            for overlap_entry in overlapping_entries:
                # Get teacher and time slot information for better conflict description
                teacher = await db.teachers.find_one({"_id": ObjectId(teacher_id)})
                time_slot = await db.time_slots.find_one({"_id": ObjectId(entry_data["time_slot_id"])})
                
                teacher_name = f"{teacher.get('first_name', '')} {teacher.get('last_name', '')}".strip() if teacher else "Unknown Teacher"
                time_desc = f"{time_slot.get('start_time')} - {time_slot.get('end_time')}" if time_slot else "Unknown Time"
                
                conflict = TimetableConflict(
                    conflict_type=ConflictType.TEACHER_OVERLAP,
                    severity="critical",
                    description=f"Teacher {teacher_name} is already scheduled at {time_desc} on {entry_data['day_of_week']}",
                    affected_entries=[str(overlap_entry["_id"])],
                    suggested_resolution=f"Reschedule one of the classes or assign a different teacher",
                    detected_at=datetime.now(),
                    metadata={
                        "teacher_id": teacher_id,
                        "teacher_name": teacher_name,
                        "conflicting_class_id": overlap_entry.get("class_id"),
                        "time_slot": time_desc,
                        "day": entry_data["day_of_week"]
                    }
                )
                conflicts.append(conflict)
        
        except Exception as e:
            logger.error(f"Error checking teacher overlap: {str(e)}")
        
        return conflicts
    
    async def _check_room_overlap(self, entry_data: Dict[str, Any], db) -> List[TimetableConflict]:
        """Check for room scheduling conflicts"""
        conflicts = []
        
        room_number = entry_data.get("room_number")
        if not room_number:
            return conflicts
        
        try:
            overlap_query = {
                "room_number": room_number,
                "day_of_week": entry_data["day_of_week"],
                "time_slot_id": entry_data["time_slot_id"],
                "academic_year": entry_data["academic_year"]
            }
            
            if entry_data.get("_id"):
                overlap_query["_id"] = {"$ne": ObjectId(entry_data["_id"])}
            
            overlapping_entries = await db.timetable_entries.find(overlap_query).to_list(None)
            
            for overlap_entry in overlapping_entries:
                time_slot = await db.time_slots.find_one({"_id": ObjectId(entry_data["time_slot_id"])})
                time_desc = f"{time_slot.get('start_time')} - {time_slot.get('end_time')}" if time_slot else "Unknown Time"
                
                conflict = TimetableConflict(
                    conflict_type=ConflictType.ROOM_OVERLAP,
                    severity="high",
                    description=f"Room {room_number} is already booked at {time_desc} on {entry_data['day_of_week']}",
                    affected_entries=[str(overlap_entry["_id"])],
                    suggested_resolution=f"Use a different room or reschedule one of the classes",
                    detected_at=datetime.now(),
                    metadata={
                        "room_number": room_number,
                        "conflicting_class_id": overlap_entry.get("class_id"),
                        "time_slot": time_desc,
                        "day": entry_data["day_of_week"]
                    }
                )
                conflicts.append(conflict)
        
        except Exception as e:
            logger.error(f"Error checking room overlap: {str(e)}")
        
        return conflicts
    
    async def _check_class_overlap(self, entry_data: Dict[str, Any], db) -> List[TimetableConflict]:
        """Check for class scheduling conflicts"""
        conflicts = []
        
        class_id = entry_data.get("class_id")
        if not class_id:
            return conflicts
        
        try:
            overlap_query = {
                "class_id": class_id,
                "day_of_week": entry_data["day_of_week"],
                "time_slot_id": entry_data["time_slot_id"],
                "academic_year": entry_data["academic_year"]
            }
            
            if entry_data.get("_id"):
                overlap_query["_id"] = {"$ne": ObjectId(entry_data["_id"])}
            
            overlapping_entries = await db.timetable_entries.find(overlap_query).to_list(None)
            
            for overlap_entry in overlapping_entries:
                class_info = await db.classes.find_one({"_id": ObjectId(class_id)})
                time_slot = await db.time_slots.find_one({"_id": ObjectId(entry_data["time_slot_id"])})
                
                class_name = class_info.get("class_name", "Unknown Class") if class_info else "Unknown Class"
                time_desc = f"{time_slot.get('start_time')} - {time_slot.get('end_time')}" if time_slot else "Unknown Time"
                
                conflict = TimetableConflict(
                    conflict_type=ConflictType.CLASS_OVERLAP,
                    severity="critical",
                    description=f"Class {class_name} already has a scheduled class at {time_desc} on {entry_data['day_of_week']}",
                    affected_entries=[str(overlap_entry["_id"])],
                    suggested_resolution=f"Reschedule to a different time slot",
                    detected_at=datetime.now(),
                    metadata={
                        "class_id": class_id,
                        "class_name": class_name,
                        "conflicting_subject": overlap_entry.get("subject_id"),
                        "time_slot": time_desc,
                        "day": entry_data["day_of_week"]
                    }
                )
                conflicts.append(conflict)
        
        except Exception as e:
            logger.error(f"Error checking class overlap: {str(e)}")
        
        return conflicts
    
    async def _check_resource_overlap(self, entry_data: Dict[str, Any], db) -> List[TimetableConflict]:
        """Check for resource conflicts (labs, equipment, etc.)"""
        conflicts = []
        
        resources_needed = entry_data.get("resources_needed", [])
        if not resources_needed:
            return conflicts
        
        try:
            # Find other entries that need the same resources at the same time
            for resource in resources_needed:
                overlap_query = {
                    "resources_needed": resource,
                    "day_of_week": entry_data["day_of_week"],
                    "time_slot_id": entry_data["time_slot_id"],
                    "academic_year": entry_data["academic_year"]
                }
                
                if entry_data.get("_id"):
                    overlap_query["_id"] = {"$ne": ObjectId(entry_data["_id"])}
                
                overlapping_entries = await db.timetable_entries.find(overlap_query).to_list(None)
                
                for overlap_entry in overlapping_entries:
                    time_slot = await db.time_slots.find_one({"_id": ObjectId(entry_data["time_slot_id"])})
                    time_desc = f"{time_slot.get('start_time')} - {time_slot.get('end_time')}" if time_slot else "Unknown Time"
                    
                    conflict = TimetableConflict(
                        conflict_type=ConflictType.RESOURCE_OVERLAP,
                        severity="medium",
                        description=f"Resource '{resource}' is already booked at {time_desc} on {entry_data['day_of_week']}",
                        affected_entries=[str(overlap_entry["_id"])],
                        suggested_resolution=f"Use alternative resources or reschedule one of the classes",
                        detected_at=datetime.now(),
                        metadata={
                            "resource": resource,
                            "conflicting_class_id": overlap_entry.get("class_id"),
                            "time_slot": time_desc,
                            "day": entry_data["day_of_week"]
                        }
                    )
                    conflicts.append(conflict)
        
        except Exception as e:
            logger.error(f"Error checking resource overlap: {str(e)}")
        
        return conflicts
    
    async def _check_time_constraints(self, entry_data: Dict[str, Any], db) -> List[TimetableConflict]:
        """Check for time-based constraints and rules"""
        conflicts = []
        
        try:
            teacher_id = entry_data.get("teacher_id")
            class_id = entry_data.get("class_id")
            day_of_week = entry_data["day_of_week"]
            time_slot_id = entry_data["time_slot_id"]
            
            # Get current time slot details
            current_slot = await db.time_slots.find_one({"_id": ObjectId(time_slot_id)})
            if not current_slot:
                return conflicts
            
            # Check for maximum consecutive periods for teacher
            if teacher_id:
                consecutive_conflicts = await self._check_consecutive_periods(
                    teacher_id, day_of_week, current_slot["period_number"], db, entry_data
                )
                conflicts.extend(consecutive_conflicts)
            
            # Check for lunch break violations
            lunch_conflicts = await self._check_lunch_break_violations(
                class_id, day_of_week, current_slot["period_number"], db, entry_data
            )
            conflicts.extend(lunch_conflicts)
            
            # Check for subject-specific constraints (e.g., labs should not be scheduled back-to-back)
            subject_conflicts = await self._check_subject_constraints(entry_data, db)
            conflicts.extend(subject_conflicts)
        
        except Exception as e:
            logger.error(f"Error checking time constraints: {str(e)}")
        
        return conflicts
    
    async def _check_consecutive_periods(self, teacher_id: str, day: str, period_num: int, db, entry_data: Dict) -> List[TimetableConflict]:
        """Check if teacher has too many consecutive periods"""
        conflicts = []
        
        try:
            # Get all entries for this teacher on this day
            teacher_entries = await db.timetable_entries.find({
                "teacher_id": teacher_id,
                "day_of_week": day,
                "academic_year": entry_data["academic_year"]
            }).to_list(None)
            
            # Get time slots to determine sequence
            time_slots = await db.time_slots.find({}).sort("period_number", 1).to_list(None)
            slot_map = {str(slot["_id"]): slot["period_number"] for slot in time_slots}
            
            # Find consecutive periods
            occupied_periods = set()
            for entry in teacher_entries:
                slot_id = entry["time_slot_id"]
                if slot_id in slot_map:
                    occupied_periods.add(slot_map[slot_id])
            
            occupied_periods.add(period_num)  # Add current period
            sorted_periods = sorted(occupied_periods)
            
            # Check for consecutive sequences longer than 3 periods
            consecutive_count = 1
            max_consecutive = 3
            
            for i in range(1, len(sorted_periods)):
                if sorted_periods[i] == sorted_periods[i-1] + 1:
                    consecutive_count += 1
                else:
                    consecutive_count = 1
                
                if consecutive_count > max_consecutive:
                    conflict = TimetableConflict(
                        conflict_type=ConflictType.TIME_CONSTRAINT,
                        severity="medium",
                        description=f"Teacher has {consecutive_count} consecutive periods on {day}, exceeding recommended limit of {max_consecutive}",
                        affected_entries=[],
                        suggested_resolution="Add a break period or redistribute classes",
                        detected_at=datetime.now(),
                        metadata={
                            "teacher_id": teacher_id,
                            "consecutive_count": consecutive_count,
                            "max_allowed": max_consecutive,
                            "day": day
                        }
                    )
                    conflicts.append(conflict)
                    break  # Only report once per sequence
        
        except Exception as e:
            logger.error(f"Error checking consecutive periods: {str(e)}")
        
        return conflicts
    
    async def _check_lunch_break_violations(self, class_id: str, day: str, period_num: int, db, entry_data: Dict) -> List[TimetableConflict]:
        """Check if class has proper lunch break"""
        conflicts = []
        
        try:
            # Typically lunch is around period 4-5, check if class has break
            lunch_periods = [4, 5]  # Configurable based on school policy
            
            if period_num in lunch_periods:
                # Check if this class already has a lunch break scheduled
                class_entries = await db.timetable_entries.find({
                    "class_id": class_id,
                    "day_of_week": day,
                    "academic_year": entry_data["academic_year"]
                }).to_list(None)
                
                # Get time slots to check for break periods
                time_slots = await db.time_slots.find({}).to_list(None)
                slot_map = {str(slot["_id"]): slot for slot in time_slots}
                
                has_lunch_break = False
                for entry in class_entries:
                    slot = slot_map.get(entry["time_slot_id"])
                    if slot and slot.get("period_type") == "lunch":
                        has_lunch_break = True
                        break
                
                if not has_lunch_break:
                    conflict = TimetableConflict(
                        conflict_type=ConflictType.TIME_CONSTRAINT,
                        severity="low",
                        description=f"Class {class_id} may not have a proper lunch break scheduled on {day}",
                        affected_entries=[],
                        suggested_resolution="Ensure a lunch break is scheduled during lunch hours",
                        detected_at=datetime.now(),
                        metadata={
                            "class_id": class_id,
                            "day": day,
                            "recommended_action": "schedule_lunch_break"
                        }
                    )
                    conflicts.append(conflict)
        
        except Exception as e:
            logger.error(f"Error checking lunch break: {str(e)}")
        
        return conflicts
    
    async def _check_subject_constraints(self, entry_data: Dict[str, Any], db) -> List[TimetableConflict]:
        """Check subject-specific scheduling constraints"""
        conflicts = []
        
        try:
            subject_id = entry_data.get("subject_id")
            if not subject_id:
                return conflicts
            
            # Get subject information
            subject = await db.subjects.find_one({"_id": ObjectId(subject_id)})
            if not subject:
                return conflicts
            
            subject_name = subject.get("subject_name", "").lower()
            
            # Check for subjects that shouldn't be scheduled back-to-back
            heavy_subjects = ["mathematics", "physics", "chemistry", "biology"]
            physical_subjects = ["physical education", "sports", "pe"]
            
            if any(heavy in subject_name for heavy in heavy_subjects):
                # Check if there are other heavy subjects adjacent to this period
                adjacent_conflicts = await self._check_adjacent_heavy_subjects(entry_data, db)
                conflicts.extend(adjacent_conflicts)
            
            if any(physical in subject_name for physical in physical_subjects):
                # Physical education should not be last period
                time_slot = await db.time_slots.find_one({"_id": ObjectId(entry_data["time_slot_id"])})
                if time_slot:
                    # Get total periods for the day
                    all_slots = await db.time_slots.find({}).sort("period_number", -1).limit(1).to_list(1)
                    if all_slots and time_slot["period_number"] == all_slots[0]["period_number"]:
                        conflict = TimetableConflict(
                            conflict_type=ConflictType.TIME_CONSTRAINT,
                            severity="low",
                            description=f"Physical Education scheduled as last period may not be ideal for student cleanup",
                            affected_entries=[],
                            suggested_resolution="Consider scheduling PE earlier in the day",
                            detected_at=datetime.now(),
                            metadata={
                                "subject": subject_name,
                                "period": time_slot["period_number"],
                                "constraint_type": "last_period_pe"
                            }
                        )
                        conflicts.append(conflict)
        
        except Exception as e:
            logger.error(f"Error checking subject constraints: {str(e)}")
        
        return conflicts
    
    async def _check_adjacent_heavy_subjects(self, entry_data: Dict[str, Any], db) -> List[TimetableConflict]:
        """Check for heavy subjects scheduled back-to-back"""
        conflicts = []
        
        try:
            current_slot = await db.time_slots.find_one({"_id": ObjectId(entry_data["time_slot_id"])})
            if not current_slot:
                return conflicts
            
            current_period = current_slot["period_number"]
            adjacent_periods = [current_period - 1, current_period + 1]
            
            # Check adjacent periods for heavy subjects
            for adj_period in adjacent_periods:
                if adj_period < 1:  # Skip invalid periods
                    continue
                
                # Find time slot for adjacent period
                adj_slot = await db.time_slots.find_one({"period_number": adj_period})
                if not adj_slot:
                    continue
                
                # Find entries scheduled in adjacent period
                adjacent_entries = await db.timetable_entries.find({
                    "class_id": entry_data["class_id"],
                    "day_of_week": entry_data["day_of_week"],
                    "time_slot_id": str(adj_slot["_id"]),
                    "academic_year": entry_data["academic_year"]
                }).to_list(None)
                
                for adj_entry in adjacent_entries:
                    adj_subject = await db.subjects.find_one({"_id": ObjectId(adj_entry["subject_id"])})
                    if adj_subject:
                        adj_subject_name = adj_subject.get("subject_name", "").lower()
                        heavy_subjects = ["mathematics", "physics", "chemistry", "biology"]
                        
                        if any(heavy in adj_subject_name for heavy in heavy_subjects):
                            conflict = TimetableConflict(
                                conflict_type=ConflictType.TIME_CONSTRAINT,
                                severity="low",
                                description=f"Heavy subjects scheduled consecutively may be challenging for students",
                                affected_entries=[str(adj_entry["_id"])],
                                suggested_resolution="Consider spacing heavy subjects with lighter subjects or breaks",
                                detected_at=datetime.now(),
                                metadata={
                                    "current_subject": entry_data.get("subject_id"),
                                    "adjacent_subject": adj_entry["subject_id"],
                                    "periods": [current_period, adj_period]
                                }
                            )
                            conflicts.append(conflict)
        
        except Exception as e:
            logger.error(f"Error checking adjacent heavy subjects: {str(e)}")
        
        return conflicts
    
    async def auto_resolve_conflicts(self, entry_data: Dict[str, Any], conflicts: List[TimetableConflict], db) -> Dict[str, Any]:
        """Attempt to automatically resolve conflicts"""
        resolved_entry = entry_data.copy()
        
        try:
            for conflict in conflicts:
                if conflict.severity in ["low", "medium"]:
                    # Attempt simple resolutions
                    if conflict.conflict_type == ConflictType.ROOM_OVERLAP:
                        # Find alternative room
                        alternative_room = await self._find_alternative_room(entry_data, db)
                        if alternative_room:
                            resolved_entry["room_number"] = alternative_room["room_number"]
                            logger.info(f"Auto-resolved room conflict by assigning room {alternative_room['room_number']}")
                    
                    elif conflict.conflict_type == ConflictType.RESOURCE_OVERLAP:
                        # Remove conflicting resources if alternatives exist
                        resolved_entry["resources_needed"] = await self._find_alternative_resources(entry_data, db)
        
        except Exception as e:
            logger.error(f"Error in auto-resolution: {str(e)}")
        
        return resolved_entry
    
    async def _find_alternative_room(self, entry_data: Dict[str, Any], db) -> Optional[Dict[str, Any]]:
        """Find an alternative room for the same time slot"""
        try:
            # Get available rooms of the same type
            current_room = await db.rooms.find_one({"room_number": entry_data.get("room_number")})
            if not current_room:
                return None
            
            # Find rooms of the same type that are not booked
            alternative_rooms = await db.rooms.find({
                "room_type": current_room["room_type"],
                "is_available": True,
                "branch_id": entry_data.get("branch_id")
            }).to_list(None)
            
            # Check which rooms are free at this time
            for room in alternative_rooms:
                existing_booking = await db.timetable_entries.find_one({
                    "room_number": room["room_number"],
                    "day_of_week": entry_data["day_of_week"],
                    "time_slot_id": entry_data["time_slot_id"],
                    "academic_year": entry_data["academic_year"]
                })
                
                if not existing_booking:
                    return room
        
        except Exception as e:
            logger.error(f"Error finding alternative room: {str(e)}")
        
        return None
    
    async def _find_alternative_resources(self, entry_data: Dict[str, Any], db) -> List[str]:
        """Find alternative resources to resolve conflicts"""
        try:
            original_resources = entry_data.get("resources_needed", [])
            alternative_resources = []
            
            # This would contain logic to find alternative resources
            # For now, just return original resources
            return original_resources
        
        except Exception as e:
            logger.error(f"Error finding alternative resources: {str(e)}")
            return entry_data.get("resources_needed", [])