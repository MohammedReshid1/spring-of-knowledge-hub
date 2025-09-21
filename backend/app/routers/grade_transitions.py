from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, time

from ..db import get_grade_transitions_collection, get_student_collection, get_grade_levels_collection, get_classes_collection
from ..models.grade_transition import GradeTransitionCreate, GradeTransition
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()

@router.post("/", response_model=GradeTransition)
async def create_grade_transition(
    transition_in: GradeTransitionCreate,
    coll: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = transition_in.dict()
    # convert transition_date to datetime for MongoDB
    doc["transition_date"] = datetime.combine(doc["transition_date"], time())
    doc["created_at"] = now
    result = await coll.insert_one(doc)
    return GradeTransition(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[GradeTransition])
async def list_grade_transitions(
    coll: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[GradeTransition] = []
    async for g in coll.find():
        items.append(GradeTransition(id=str(g["_id"]), **{k: g.get(k) for k in g}))
    return items

@router.get("/{transition_id}", response_model=GradeTransition)
async def get_grade_transition(
    transition_id: str,
    coll: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    g = await coll.find_one({"_id": ObjectId(transition_id)})
    if not g:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GradeTransition not found")
    return GradeTransition(id=transition_id, **{k: g.get(k) for k in g})

@router.put("/{transition_id}", response_model=GradeTransition)
async def update_grade_transition(
    transition_id: str,
    transition_in: GradeTransitionCreate,
    coll: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    # convert transition_date to datetime for MongoDB
    update_data = transition_in.dict()
    update_data["transition_date"] = datetime.combine(update_data["transition_date"], time())
    res = await coll.update_one({"_id": ObjectId(transition_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GradeTransition not found")
    # return updated document
    g = await coll.find_one({"_id": ObjectId(transition_id)})
    return GradeTransition(id=transition_id, **{k: g.get(k) for k in g})

@router.delete("/{transition_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grade_transition(
    transition_id: str,
    coll: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(transition_id)})

@router.get("/preview/transition", response_model=List[dict])
async def preview_grade_transition(
    students: Any = Depends(get_student_collection),
    grade_levels: Any = Depends(get_grade_levels_collection),
    classes: Any = Depends(get_classes_collection),
    current_user: User = Depends(get_current_user),
):
    """Preview what will happen during grade transition"""
    # Check if current user has admin privileges
    if current_user.role not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to preview grade transitions")
    
    # Get only active students (not graduated, not inactive, etc.)
    active_students = []
    async for student in students.find({"status": "Active"}):
        active_students.append(student)
    
    # Get grade levels for mapping
    grade_level_map = {}
    async for grade_level in grade_levels.find():
        grade_level_map[grade_level.get("grade")] = grade_level
    
    # Get existing classes for reference
    existing_classes = {}
    async for class_item in classes.find():
        grade = grade_level_map.get(class_item.get("grade_level_id", ""), {}).get("grade", "")
        branch = class_item.get("branch_id", "")
        key = f"{grade}_{branch}"
        if key not in existing_classes:
            existing_classes[key] = []
        existing_classes[key].append(class_item)
    
    # Count students per grade and branch for preview
    grade_branch_counts = {}
    for student in active_students:
        current_grade = student.get("grade_level", "")
        next_grade = grade_progression.get(current_grade, current_grade)
        if next_grade != "graduated":
            branch_id = student.get("branch_id", "")
            key = f"{next_grade}_{branch_id}"
            grade_branch_counts[key] = grade_branch_counts.get(key, 0) + 1
    
    # Define grade progression
    grade_progression = {
        'pre_k': 'kg',
        'kg': 'grade_1',
        'grade_1': 'grade_2',
        'grade_2': 'grade_3',
        'grade_3': 'grade_4',
        'grade_4': 'grade_5',
        'grade_5': 'grade_6',
        'grade_6': 'grade_7',
        'grade_7': 'grade_8',
        'grade_8': 'grade_9',
        'grade_9': 'grade_10',
        'grade_10': 'grade_11',
        'grade_11': 'grade_12',
        'grade_12': 'graduated'
    }
    
    preview = []
    for student in active_students:
        current_grade = student.get("grade_level", "")
        next_grade = grade_progression.get(current_grade, current_grade)
        
        # Check if class will be created for non-graduating students
        will_create_class = False
        new_class_name = None
        if next_grade != "graduated":
            branch_id = student.get("branch_id", "")
            key = f"{next_grade}_{branch_id}"
            existing_class_list = existing_classes.get(key, [])
            will_create_class = len(existing_class_list) == 0
            
            # Predict new class name based on current class
            if will_create_class and student.get("class_id"):
                # Get current class name
                current_class_doc = None
                for class_item in existing_classes.get(f"{current_grade}_{branch_id}", []):
                    if str(class_item["_id"]) == student.get("class_id"):
                        current_class_doc = class_item
                        break
                
                if current_class_doc:
                    current_class_name = current_class_doc.get("class_name", "")
                    # Extract letter from current class name
                    class_letter = "A"
                    if " - " in current_class_name:
                        class_letter = current_class_name.split(" - ")[-1]
                    elif " " in current_class_name:
                        last_part = current_class_name.split(" ")[-1]
                        if len(last_part) > 1 and last_part[-1].isalpha():
                            class_letter = last_part[-1]
                    else:
                        # Handle formats like "5A", "5B" (no spaces)
                        if len(current_class_name) > 1 and current_class_name[-1].isalpha():
                            class_letter = current_class_name[-1]
                    
                    # Create predicted class name
                    grade_display = next_grade.upper().replace('_', ' ')
                    if grade_display.startswith('GRADE '):
                        grade_display = grade_display
                    elif grade_display == 'KG':
                        grade_display = 'KG'
                    elif grade_display == 'PRE K':
                        grade_display = 'PRE-K'
                    else:
                        grade_display = grade_display
                    
                    new_class_name = f"{grade_display} - {class_letter}"
        
        # Get student count for this grade/branch
        students_in_class = 0
        if next_grade != "graduated":
            branch_id = student.get("branch_id", "")
            key = f"{next_grade}_{branch_id}"
            students_in_class = grade_branch_counts.get(key, 0)
        
        preview.append({
            "student_id": str(student["_id"]),
            "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}",
            "current_grade": current_grade,
            "next_grade": next_grade,
            "action": "Will Graduate" if next_grade == "graduated" else "Will Transition",
            "branch_id": student.get("branch_id"),
            "current_class": student.get("class_id"),
            "will_remove_from_class": bool(student.get("class_id")),
            "will_create_class": will_create_class,
            "new_class_name": new_class_name,
            "students_in_class": students_in_class
        })
    
    return preview

@router.post("/execute/transition", response_model=dict)
async def execute_grade_transition(
    students: Any = Depends(get_student_collection),
    grade_levels: Any = Depends(get_grade_levels_collection),
    classes: Any = Depends(get_classes_collection),
    transitions: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    """Execute grade transition for all active students"""
    # Check if current user has admin privileges
    if current_user.role not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to execute grade transitions")
    
    # Get only active students (not graduated, not inactive, etc.)
    active_students = []
    async for student in students.find({"status": "Active"}):
        active_students.append(student)
    
    # Get grade levels for mapping
    grade_level_map = {}
    async for grade_level in grade_levels.find():
        grade_level_map[grade_level.get("grade")] = grade_level
    
    # Get existing classes for reference
    existing_classes = {}
    async for class_item in classes.find():
        grade = grade_level_map.get(class_item.get("grade_level_id", ""), {}).get("grade", "")
        branch = class_item.get("branch_id", "")
        key = f"{grade}_{branch}"
        if key not in existing_classes:
            existing_classes[key] = []
        existing_classes[key].append(class_item)
    
    # Define grade progression
    grade_progression = {
        'pre_k': 'kg',
        'kg': 'grade_1',
        'grade_1': 'grade_2',
        'grade_2': 'grade_3',
        'grade_3': 'grade_4',
        'grade_4': 'grade_5',
        'grade_5': 'grade_6',
        'grade_6': 'grade_7',
        'grade_7': 'grade_8',
        'grade_8': 'grade_9',
        'grade_9': 'grade_10',
        'grade_10': 'grade_11',
        'grade_11': 'grade_12',
        'grade_12': 'graduated'
    }
    
    transitioned_count = 0
    graduated_count = 0
    results = []
    
    # Count students per grade and branch for capacity planning
    grade_branch_counts = {}
    for student in active_students:
        current_grade = student.get("grade_level", "")
        next_grade = grade_progression.get(current_grade, current_grade)
        if next_grade != "graduated":
            branch_id = student.get("branch_id", "")
            key = f"{next_grade}_{branch_id}"
            grade_branch_counts[key] = grade_branch_counts.get(key, 0) + 1
    
    # Track class mappings to ensure consistency
    class_mappings = {}  # Maps (next_grade, branch_id, current_class_name) -> new_class_id
    
    # Helper function to get or create class for a grade and branch
    async def get_or_create_class(grade: str, branch_id: str, grade_level_map: dict, classes: Any, student_count: int = 0, current_class_name: str = None):
        if grade == "graduated":
            return None
        
        # Find grade level ID for the grade
        grade_level_id = None
        for gl_id, gl_data in grade_level_map.items():
            if gl_data.get("grade") == grade:
                grade_level_id = gl_id
                break
        
        if not grade_level_id:
            return None
        
        # Check if class exists for this grade and branch
        key = f"{grade}_{branch_id}"
        existing_class_list = existing_classes.get(key, [])
        
        # If class exists, return it (all students go to same class)
        if existing_class_list:
            return str(existing_class_list[0]["_id"])
        
        # If no class exists, create a new one with capacity for all students
        academic_year = f"{datetime.utcnow().year}-{datetime.utcnow().year + 1}"
        
        # Convert grade format to display format (e.g., "grade_5" -> "GRADE 5")
        grade_display = grade.upper().replace('_', ' ')
        if grade_display.startswith('GRADE '):
            grade_display = grade_display
        elif grade_display == 'KG':
            grade_display = 'KG'
        elif grade_display == 'PRE K':
            grade_display = 'PRE-K'
        else:
            grade_display = grade_display
        
        # Determine class letter - preserve from current class if possible
        class_letter = "A"
        if current_class_name:
            # Extract letter from current class name (e.g., "GRADE 5 - A" -> "A")
            if " - " in current_class_name:
                class_letter = current_class_name.split(" - ")[-1]
            elif " " in current_class_name:
                # Handle formats like "5A", "5B"
                last_part = current_class_name.split(" ")[-1]
                if len(last_part) > 1 and last_part[-1].isalpha():
                    class_letter = last_part[-1]
            else:
                # Handle formats like "5A", "5B" (no spaces)
                if len(current_class_name) > 1 and current_class_name[-1].isalpha():
                    class_letter = current_class_name[-1]
        
        # Create class name in format "GRADE X - LETTER"
        class_name = f"{grade_display} - {class_letter}"
        
        # Use student count as max capacity, minimum 30
        max_capacity = max(student_count, 30)
        
        new_class = {
            "grade_level_id": grade_level_id,
            "class_name": class_name,
            "max_capacity": max_capacity,
            "current_enrollment": 0,
            "academic_year": academic_year,
            "branch_id": branch_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await classes.insert_one(new_class)
        return str(result.inserted_id)
    
    for student in active_students:
        current_grade = student.get("grade_level", "")
        next_grade = grade_progression.get(current_grade, current_grade)
        
        # Remove student from current class if they have one
        current_class_id = student.get("class_id")
        current_class_name = None
        
        if current_class_id:
            # Get current class name before removing student
            current_class_doc = await classes.find_one({"_id": ObjectId(current_class_id)})
            if current_class_doc:
                current_class_name = current_class_doc.get("class_name")
            
            # Decrease class enrollment count
            await classes.update_one(
                {"_id": ObjectId(current_class_id)},
                {"$inc": {"current_enrollment": -1}}
            )
        
        if next_grade == "graduated":
            # Mark as graduated and remove from class
            await students.update_one(
                {"_id": student["_id"]},
                {
                    "$set": {
                        "status": "graduated",
                        "class_id": None,  # Remove from class
                        "graduated_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            graduated_count += 1
            results.append({
                "student_id": str(student["_id"]),
                "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}",
                "status": "Graduated",
                "previous_grade": current_grade,
                "new_grade": "graduated",
                "removed_from_class": current_class_id
            })
        else:
            # Get or create class for the new grade
            branch_id = student.get("branch_id")
            key = f"{next_grade}_{branch_id}"
            student_count = grade_branch_counts.get(key, 0)
            
            # Check if we already created a class for this mapping
            mapping_key = (next_grade, branch_id, current_class_name)
            if mapping_key in class_mappings:
                new_class_id = class_mappings[mapping_key]
            else:
                new_class_id = await get_or_create_class(next_grade, branch_id, grade_level_map, classes, student_count, current_class_name)
                class_mappings[mapping_key] = new_class_id
            
            # Transition to next grade and assign to new class
            await students.update_one(
                {"_id": student["_id"]},
                {
                    "$set": {
                        "grade_level": next_grade,
                        "class_id": new_class_id,  # Assign to new class
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            # Increase enrollment count for the new class
            if new_class_id:
                await classes.update_one(
                    {"_id": ObjectId(new_class_id)},
                    {"$inc": {"current_enrollment": 1}}
                )
            
            transitioned_count += 1
            results.append({
                "student_id": str(student["_id"]),
                "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}",
                "status": "Transitioned",
                "previous_grade": current_grade,
                "new_grade": next_grade,
                "removed_from_class": current_class_id,
                "assigned_to_class": new_class_id
            })
    
    # Create transition record
    transition_record = {
        "academic_year": f"{datetime.utcnow().year}-{datetime.utcnow().year + 1}",
        "transition_date": datetime.utcnow(),
        "students_transitioned": transitioned_count,
        "students_graduated": graduated_count,
        "performed_by": current_user.id,
        "notes": f"Automated grade transition performed by {current_user.full_name}",
        "created_at": datetime.utcnow()
    }
    
    await transitions.insert_one(transition_record)
    
    return {
        "message": "Grade transition completed successfully",
        "students_transitioned": transitioned_count,
        "students_graduated": graduated_count,
        "total_processed": len(active_students),
        "results": results
    }
