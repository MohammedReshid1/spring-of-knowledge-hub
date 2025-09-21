from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime, date
import random
import string

from ..db import (
    get_incidents_collection, get_disciplinary_actions_collection, get_behavior_points_collection,
    get_rewards_collection, get_counseling_sessions_collection, get_behavior_contracts_collection,
    get_behavior_rubrics_collection, get_parent_meetings_collection, get_student_collection,
    validate_branch_id, validate_student_id
)
from ..models.discipline import (
    IncidentCreate, Incident, IncidentUpdate, DisciplinaryActionCreate, DisciplinaryAction,
    BehaviorPointCreate, BehaviorPoint, BehaviorPointUpdate, RewardCreate, Reward, RewardUpdate,
    CounselingSessionCreate, CounselingSession, CounselingSessionUpdate, BehaviorContractCreate, 
    BehaviorContract, BehaviorContractUpdate, BehaviorRubricCreate, BehaviorRubric, 
    ParentMeetingCreate, ParentMeeting, DisciplinaryStats
)
from ..utils.rbac import get_current_user, is_hq_role
from ..models.user import User
from ..utils.validation import (
    sanitize_input, prevent_nosql_injection, validate_mongodb_id
)

router = APIRouter()

def generate_incident_code():
    """Generate a unique incident code."""
    return f"INC{random.randint(100000, 999999)}"

def generate_action_code():
    """Generate a unique disciplinary action code."""
    return f"DA{random.randint(100000, 999999)}"

def generate_point_code():
    """Generate a unique behavior point code."""
    return f"BP{random.randint(100000, 999999)}"

def generate_reward_code():
    """Generate a unique reward code."""
    return f"RW{random.randint(100000, 999999)}"

def generate_session_code():
    """Generate a unique counseling session code."""
    return f"CS{random.randint(100000, 999999)}"

def generate_contract_code():
    """Generate a unique behavior contract code."""
    return f"BC{random.randint(100000, 999999)}"

def generate_rubric_code():
    """Generate a unique behavior rubric code."""
    return f"BR{random.randint(1000, 9999)}"

def generate_meeting_code():
    """Generate a unique parent meeting code."""
    return f"PM{random.randint(100000, 999999)}"

# Incidents Management
@router.post("/incidents", response_model=Incident)
async def create_incident(
    incident_in: IncidentCreate,
    incidents_coll: Any = Depends(get_incidents_collection),
    current_user: dict = Depends(get_current_user),
):
    """Create a new incident report."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to create incidents")
    
    # Sanitize input
    incident_data = sanitize_input(incident_in.dict(), [
        "student_id", "reported_by", "incident_type", "severity", "title", "description",
        "location", "incident_date", "witnesses", "evidence_files", "immediate_action_taken",
        "parent_contacted", "parent_contact_method", "parent_contact_date", "is_resolved",
        "follow_up_required", "follow_up_date", "class_id", "subject_id", "branch_id"
    ])
    
    # Validate student exists
    await validate_student_id(incident_data["student_id"])
    
    # Attach/enforce branch for isolation
    payload_branch_id = incident_data.get("branch_id")
    if is_hq_role(current_user.get("role")):
        # HQ must specify a branch id when creating
        if not payload_branch_id:
            raise HTTPException(status_code=400, detail="branch_id is required when creating incidents as HQ user")
        await validate_branch_id(payload_branch_id)
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            raise HTTPException(status_code=403, detail="User must be assigned to a branch")
        incident_data["branch_id"] = user_branch_id
    
    # Generate unique incident code
    incident_code = generate_incident_code()
    while await incidents_coll.find_one({"incident_code": incident_code}):
        incident_code = generate_incident_code()
    
    # Add metadata
    now = datetime.utcnow()
    incident_data.update({
        "incident_code": incident_code,
        "status": "open",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get('user_id', current_user.get('email'))
    })
    
    result = await incidents_coll.insert_one(incident_data)
    incident_data["id"] = str(result.inserted_id)
    
    return Incident(**incident_data)

@router.get("/incidents")
async def list_incidents(
    student_id: Optional[str] = Query(None),
    incident_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    incidents_coll: Any = Depends(get_incidents_collection),
    current_user: dict = Depends(get_current_user),
):
    """List incidents with filtering options."""
    query = {}
    
    if student_id:
        query["student_id"] = student_id
    if incident_type:
        query["incident_type"] = incident_type
    if severity:
        query["severity"] = severity
    if status:
        query["status"] = status
    
    # Search functionality
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"title": search_regex},
            {"description": search_regex},
            {"incident_code": search_regex},
            {"location": search_regex}
        ]
    
    # Branch isolation
    if is_hq_role(current_user.get("role")):
        if branch_id:
            query["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        query["branch_id"] = user_branch_id
    
    query = prevent_nosql_injection(query)
    
    incidents = []
    async for incident in incidents_coll.find(query).skip(skip).limit(limit).sort("created_at", -1):
        # Convert ObjectId to string and format the document
        incident_dict = {
            "id": str(incident["_id"]),
            "incident_code": incident.get("incident_code", ""),
            "student_id": incident.get("student_id", ""),
            "title": incident.get("title", ""),
            "description": incident.get("description", ""),
            "incident_type": incident.get("incident_type", ""),
            "severity": incident.get("severity", ""),
            "status": incident.get("status", "open"),
            "location": incident.get("location", ""),
            "incident_date": incident.get("incident_date", incident.get("created_at", datetime.utcnow())).isoformat() if incident.get("incident_date") or incident.get("created_at") else datetime.utcnow().isoformat(),
            "reported_by": incident.get("reported_by", ""),
            "parent_contacted": incident.get("parent_contacted", False),
            "is_resolved": incident.get("is_resolved", False),
            "created_at": incident.get("created_at").isoformat() if incident.get("created_at") else datetime.utcnow().isoformat()
        }
        incidents.append(incident_dict)
    
    return incidents

@router.get("/incidents/{incident_id}", response_model=Incident)
async def get_incident(
    incident_id: str,
    incidents_coll: Any = Depends(get_incidents_collection),
    current_user: dict = Depends(get_current_user),
):
    """Get a specific incident by ID."""
    if not validate_mongodb_id(incident_id):
        raise HTTPException(status_code=400, detail="Invalid incident ID")
    
    incident = await incidents_coll.find_one({"_id": ObjectId(incident_id)})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return Incident(
        id=str(incident["_id"]),
        **{k: v for k, v in incident.items() if k != "_id"}
    )

@router.put("/incidents/{incident_id}", response_model=Incident)
async def update_incident(
    incident_id: str,
    incident_update: IncidentUpdate,
    incidents_coll: Any = Depends(get_incidents_collection),
    current_user: dict = Depends(get_current_user),
):
    """Update an incident."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to update incidents")
    
    if not validate_mongodb_id(incident_id):
        raise HTTPException(status_code=400, detail="Invalid incident ID")
    
    # Sanitize update data
    update_data = sanitize_input(incident_update.dict(exclude_unset=True), [
        "incident_type", "severity", "title", "description", "location", "incident_date",
        "witnesses", "evidence_files", "immediate_action_taken", "parent_contacted",
        "parent_contact_method", "parent_contact_date", "is_resolved", "follow_up_required",
        "follow_up_date", "status", "assigned_to", "resolution_summary", "lessons_learned"
    ])
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.utcnow()
    
    # Synchronize status and is_resolved fields
    if "status" in update_data:
        if update_data["status"] in ["resolved", "closed"]:
            update_data["is_resolved"] = True
        elif update_data["status"] in ["open", "under_investigation"]:
            update_data["is_resolved"] = False
    
    result = await incidents_coll.update_one(
        {"_id": ObjectId(incident_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Return updated incident
    updated_incident = await incidents_coll.find_one({"_id": ObjectId(incident_id)})
    return Incident(
        id=str(updated_incident["_id"]),
        **{k: v for k, v in updated_incident.items() if k != "_id"}
    )

@router.delete("/incidents/{incident_id}")
async def delete_incident(
    incident_id: str,
    incidents_coll: Any = Depends(get_incidents_collection),
    current_user: dict = Depends(get_current_user),
):
    """Delete an incident."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized to delete incidents")
    
    if not validate_mongodb_id(incident_id):
        raise HTTPException(status_code=400, detail="Invalid incident ID")
    
    result = await incidents_coll.delete_one({"_id": ObjectId(incident_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return {"message": "Incident deleted successfully"}

# Disciplinary Actions
@router.post("/disciplinary-actions", response_model=DisciplinaryAction)
async def create_disciplinary_action(
    action_in: DisciplinaryActionCreate,
    actions_coll: Any = Depends(get_disciplinary_actions_collection),
    current_user: dict = Depends(get_current_user),
):
    """Create a disciplinary action."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized to create disciplinary actions")
    
    # Sanitize input
    action_data = sanitize_input(action_in.dict(), [
        "incident_id", "student_id", "action_type", "severity_level", "title", "description",
        "start_date", "end_date", "duration_days", "conditions", "assigned_by", "supervised_by",
        "location", "appeal_allowed", "appeal_deadline", "make_up_work_allowed",
        "extracurricular_restriction", "parent_notification_required", "is_completed",
        "completion_notes", "branch_id"
    ])
    
    # Validate student exists
    await validate_student_id(action_data["student_id"])

    # Attach/enforce branch isolation
    payload_branch_id = action_data.get("branch_id")
    if is_hq_role(current_user.get("role")):
        if not payload_branch_id:
            raise HTTPException(status_code=400, detail="branch_id is required when creating disciplinary actions as HQ user")
        await validate_branch_id(payload_branch_id)
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            raise HTTPException(status_code=403, detail="User must be assigned to a branch")
        action_data["branch_id"] = user_branch_id
    
    # Generate unique action code
    action_code = generate_action_code()
    while await actions_coll.find_one({"action_code": action_code}):
        action_code = generate_action_code()
    
    # Add metadata
    now = datetime.utcnow()
    action_data.update({
        "action_code": action_code,
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get('user_id', current_user.get('email'))
    })
    
    result = await actions_coll.insert_one(action_data)
    action_data["id"] = str(result.inserted_id)
    
    return DisciplinaryAction(**action_data)

@router.get("/disciplinary-actions", response_model=List[DisciplinaryAction])
async def list_disciplinary_actions(
    student_id: Optional[str] = Query(None),
    incident_id: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    actions_coll: Any = Depends(get_disciplinary_actions_collection),
    current_user: dict = Depends(get_current_user),
):
    """List disciplinary actions."""
    query = {}
    
    if student_id:
        query["student_id"] = student_id
    if incident_id:
        query["incident_id"] = incident_id
    if action_type:
        query["action_type"] = action_type
    if status:
        query["status"] = status
    
    # Branch isolation
    if is_hq_role(current_user.get("role")):
        if branch_id:
            query["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        query["branch_id"] = user_branch_id
    
    actions = []
    async for action in actions_coll.find(query).skip(skip).limit(limit).sort("start_date", -1):
        actions.append(DisciplinaryAction(
            id=str(action["_id"]),
            **{k: v for k, v in action.items() if k != "_id"}
        ))
    
    return actions

# Behavior Points
@router.post("/behavior-points", response_model=BehaviorPoint)
async def create_behavior_point(
    point_in: BehaviorPointCreate,
    points_coll: Any = Depends(get_behavior_points_collection),
    current_user: dict = Depends(get_current_user),
):
    """Award or deduct behavior points."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to award behavior points")
    
    # Sanitize input
    point_data = sanitize_input(point_in.dict(), [
        "student_id", "awarded_by", "point_type", "category", "points", "reason",
        "description", "date_awarded", "class_id", "subject_id", "activity_id",
        "is_visible_to_student", "is_visible_to_parent", "branch_id"
    ])
    
    # Validate student exists
    await validate_student_id(point_data["student_id"])

    # Attach/enforce branch isolation
    payload_branch_id = point_data.get("branch_id")
    if is_hq_role(current_user.get("role")):
        if not payload_branch_id:
            raise HTTPException(status_code=400, detail="branch_id is required when creating behavior points as HQ user")
        await validate_branch_id(payload_branch_id)
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            raise HTTPException(status_code=403, detail="User must be assigned to a branch")
        point_data["branch_id"] = user_branch_id
    
    # Convert date fields to datetime
    if "date_awarded" in point_data and point_data["date_awarded"]:
        if isinstance(point_data["date_awarded"], date) and not isinstance(point_data["date_awarded"], datetime):
            point_data["date_awarded"] = datetime.combine(point_data["date_awarded"], datetime.min.time())
    
    # Generate unique point code
    point_code = generate_point_code()
    while await points_coll.find_one({"point_code": point_code}):
        point_code = generate_point_code()
    
    # Add metadata
    now = datetime.utcnow()
    point_data.update({
        "point_code": point_code,
        "created_at": now,
        "updated_at": now
    })
    
    result = await points_coll.insert_one(point_data)
    point_data["id"] = str(result.inserted_id)
    
    return BehaviorPoint(**point_data)

@router.get("/behavior-points")
async def list_behavior_points(
    student_id: Optional[str] = Query(None),
    point_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    points_coll: Any = Depends(get_behavior_points_collection),
    current_user: dict = Depends(get_current_user),
):
    """List behavior points."""
    query = {}
    
    if student_id:
        query["student_id"] = student_id
    if point_type:
        query["point_type"] = point_type
    if category:
        query["category"] = category
    
    # Branch isolation
    if is_hq_role(current_user.get("role")):
        if branch_id:
            query["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        query["branch_id"] = user_branch_id
    
    points = []
    async for point in points_coll.find(query).skip(skip).limit(limit).sort("created_at", -1):
        point_dict = {
            "id": str(point["_id"]),
            "point_code": point.get("point_code", ""),
            "student_id": point.get("student_id", ""),
            "awarded_by": point.get("awarded_by", ""),
            "point_type": point.get("point_type", "positive"),
            "points": point.get("points", 0),
            "category": point.get("category", ""),
            "reason": point.get("reason", ""),
            "date_awarded": point.get("date_awarded") if isinstance(point.get("date_awarded"), str) else (point.get("date_awarded").isoformat() if point.get("date_awarded") else datetime.utcnow().isoformat()),
            "created_at": point.get("created_at") if isinstance(point.get("created_at"), str) else (point.get("created_at").isoformat() if point.get("created_at") else datetime.utcnow().isoformat())
        }
        points.append(point_dict)
    
    return points

@router.put("/behavior-points/{point_id}", response_model=BehaviorPoint)
async def update_behavior_point(
    point_id: str,
    point_update: BehaviorPointUpdate,
    points_coll: Any = Depends(get_behavior_points_collection),
    current_user: dict = Depends(get_current_user),
):
    """Update a behavior point."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to update behavior points")
    
    if not validate_mongodb_id(point_id):
        raise HTTPException(status_code=400, detail="Invalid point ID")
    
    # Sanitize update data
    update_data = sanitize_input(point_update.dict(exclude_unset=True), [
        "point_type", "category", "points", "reason", "description", "date_awarded",
        "class_id", "subject_id", "activity_id", "is_visible_to_student", "is_visible_to_parent"
    ])
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Convert date fields to datetime
    if "date_awarded" in update_data and update_data["date_awarded"]:
        if isinstance(update_data["date_awarded"], date) and not isinstance(update_data["date_awarded"], datetime):
            update_data["date_awarded"] = datetime.combine(update_data["date_awarded"], datetime.min.time())
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await points_coll.update_one(
        {"_id": ObjectId(point_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Behavior point not found")
    
    # Return updated point
    updated_point = await points_coll.find_one({"_id": ObjectId(point_id)})
    return BehaviorPoint(
        id=str(updated_point["_id"]),
        **{k: v for k, v in updated_point.items() if k != "_id"}
    )

@router.delete("/behavior-points/{point_id}")
async def delete_behavior_point(
    point_id: str,
    points_coll: Any = Depends(get_behavior_points_collection),
    current_user: dict = Depends(get_current_user),
):
    """Delete a behavior point."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to delete behavior points")
    
    if not validate_mongodb_id(point_id):
        raise HTTPException(status_code=400, detail="Invalid point ID")
    
    result = await points_coll.delete_one({"_id": ObjectId(point_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Behavior point not found")
    
    return {"message": "Behavior point deleted successfully"}

# Rewards
@router.post("/rewards", response_model=Reward)
async def create_reward(
    reward_in: RewardCreate,
    rewards_coll: Any = Depends(get_rewards_collection),
    current_user: dict = Depends(get_current_user),
):
    """Create a reward for a student."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to create rewards")
    
    # Sanitize input
    reward_data = sanitize_input(reward_in.dict(), [
        "student_id", "awarded_by", "reward_type", "title", "description", "criteria_met",
        "date_awarded", "date_earned", "points_required", "monetary_value", "is_public",
        "category", "certificate_template", "presentation_date", "presented_by",
        "photo_url", "branch_id"
    ])
    
    # Validate student exists
    await validate_student_id(reward_data["student_id"])

    # Attach/enforce branch isolation
    payload_branch_id = reward_data.get("branch_id")
    if is_hq_role(current_user.get("role")):
        if not payload_branch_id:
            raise HTTPException(status_code=400, detail="branch_id is required when creating rewards as HQ user")
        await validate_branch_id(payload_branch_id)
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            raise HTTPException(status_code=403, detail="User must be assigned to a branch")
        reward_data["branch_id"] = user_branch_id
    
    # Convert date fields to datetime
    if "date_awarded" in reward_data and reward_data["date_awarded"]:
        if isinstance(reward_data["date_awarded"], date) and not isinstance(reward_data["date_awarded"], datetime):
            reward_data["date_awarded"] = datetime.combine(reward_data["date_awarded"], datetime.min.time())
    if "date_earned" in reward_data and reward_data["date_earned"]:
        if isinstance(reward_data["date_earned"], date) and not isinstance(reward_data["date_earned"], datetime):
            reward_data["date_earned"] = datetime.combine(reward_data["date_earned"], datetime.min.time())
    if "presentation_date" in reward_data and reward_data["presentation_date"]:
        if isinstance(reward_data["presentation_date"], date) and not isinstance(reward_data["presentation_date"], datetime):
            reward_data["presentation_date"] = datetime.combine(reward_data["presentation_date"], datetime.min.time())
    
    # Generate unique reward code
    reward_code = generate_reward_code()
    while await rewards_coll.find_one({"reward_code": reward_code}):
        reward_code = generate_reward_code()
    
    # Add metadata
    now = datetime.utcnow()
    reward_data.update({
        "reward_code": reward_code,
        "status": "awarded",
        "created_at": now,
        "updated_at": now
    })
    
    result = await rewards_coll.insert_one(reward_data)
    reward_data["id"] = str(result.inserted_id)
    
    return Reward(**reward_data)

@router.get("/rewards")
async def list_rewards(
    student_id: Optional[str] = Query(None),
    reward_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    rewards_coll: Any = Depends(get_rewards_collection),
    current_user: dict = Depends(get_current_user),
):
    """List rewards."""
    query = {}
    
    if student_id:
        query["student_id"] = student_id
    if reward_type:
        query["reward_type"] = reward_type
    if category:
        query["category"] = category
    
    # Branch isolation
    if is_hq_role(current_user.get("role")):
        if branch_id:
            query["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        query["branch_id"] = user_branch_id
    
    rewards = []
    async for reward in rewards_coll.find(query).skip(skip).limit(limit).sort("created_at", -1):
        reward_dict = {
            "id": str(reward["_id"]),
            "reward_code": reward.get("reward_code", ""),
            "student_id": reward.get("student_id", ""),
            "title": reward.get("title", ""),
            "description": reward.get("description", ""),
            "reward_type": reward.get("reward_type", ""),
            "points_awarded": reward.get("points_awarded", 0),
            "date_awarded": reward.get("date_awarded") if isinstance(reward.get("date_awarded"), str) else (reward.get("date_awarded").isoformat() if reward.get("date_awarded") else datetime.utcnow().isoformat()),
            "awarded_by": reward.get("awarded_by", ""),
            "created_at": reward.get("created_at") if isinstance(reward.get("created_at"), str) else (reward.get("created_at").isoformat() if reward.get("created_at") else datetime.utcnow().isoformat())
        }
        rewards.append(reward_dict)
    
    return rewards

@router.put("/rewards/{reward_id}", response_model=Reward)
async def update_reward(
    reward_id: str,
    reward_update: RewardUpdate,
    rewards_coll: Any = Depends(get_rewards_collection),
    current_user: dict = Depends(get_current_user),
):
    """Update a reward."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to update rewards")
    
    if not validate_mongodb_id(reward_id):
        raise HTTPException(status_code=400, detail="Invalid reward ID")
    
    # Sanitize update data
    update_data = sanitize_input(reward_update.dict(exclude_unset=True), [
        "reward_type", "title", "description", "criteria_met", "date_awarded", "date_earned",
        "points_required", "monetary_value", "is_public", "category", "certificate_template",
        "presentation_date", "presented_by", "photo_url", "status"
    ])
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Convert date fields to datetime if needed
    for date_field in ["date_awarded", "date_earned", "presentation_date"]:
        if date_field in update_data and update_data[date_field]:
            if isinstance(update_data[date_field], date) and not isinstance(update_data[date_field], datetime):
                update_data[date_field] = datetime.combine(update_data[date_field], datetime.min.time())
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await rewards_coll.update_one(
        {"_id": ObjectId(reward_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Return updated reward
    updated_reward = await rewards_coll.find_one({"_id": ObjectId(reward_id)})
    return Reward(
        id=str(updated_reward["_id"]),
        **{k: v for k, v in updated_reward.items() if k != "_id"}
    )

@router.delete("/rewards/{reward_id}")
async def delete_reward(
    reward_id: str,
    rewards_coll: Any = Depends(get_rewards_collection),
    current_user: dict = Depends(get_current_user),
):
    """Delete a reward."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to delete rewards")
    
    if not validate_mongodb_id(reward_id):
        raise HTTPException(status_code=400, detail="Invalid reward ID")
    
    result = await rewards_coll.delete_one({"_id": ObjectId(reward_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return {"message": "Reward deleted successfully"}

# Counseling Sessions
@router.post("/counseling-sessions", response_model=CounselingSession)
async def create_counseling_session(
    session_in: CounselingSessionCreate,
    sessions_coll: Any = Depends(get_counseling_sessions_collection),
    current_user: dict = Depends(get_current_user),
):
    """Create a counseling session."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'counselor']:
        raise HTTPException(status_code=403, detail="Not authorized to create counseling sessions")
    
    # Sanitize input
    session_data = sanitize_input(session_in.dict(), [
        "student_id", "counselor_id", "session_type", "reason", "title", "session_date",
        "duration_minutes", "location", "participants", "goals", "intervention_strategies",
        "homework_assigned", "next_session_date", "risk_level", "confidentiality_level",
        "parent_involvement_required", "teacher_notification_required", "follow_up_required",
        "referral_needed", "referral_type", "emergency_contact_made", "branch_id"
    ])
    
    # Validate student exists
    await validate_student_id(session_data["student_id"])

    # Attach/enforce branch isolation
    payload_branch_id = session_data.get("branch_id")
    if is_hq_role(current_user.get("role")):
        if not payload_branch_id:
            raise HTTPException(status_code=400, detail="branch_id is required when creating counseling sessions as HQ user")
        await validate_branch_id(payload_branch_id)
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            raise HTTPException(status_code=403, detail="User must be assigned to a branch")
        session_data["branch_id"] = user_branch_id
    
    # Generate unique session code
    session_code = generate_session_code()
    while await sessions_coll.find_one({"session_code": session_code}):
        session_code = generate_session_code()
    
    # Add metadata
    now = datetime.utcnow()
    session_data.update({
        "session_code": session_code,
        "status": "scheduled",
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get('user_id', current_user.get('email'))
    })
    
    result = await sessions_coll.insert_one(session_data)
    session_data["id"] = str(result.inserted_id)
    
    return CounselingSession(**session_data)

@router.get("/counseling-sessions")
async def list_counseling_sessions(
    student_id: Optional[str] = Query(None),
    counselor_id: Optional[str] = Query(None),
    session_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    sessions_coll: Any = Depends(get_counseling_sessions_collection),
    current_user: dict = Depends(get_current_user),
):
    """List counseling sessions."""
    query = {}
    
    if student_id:
        query["student_id"] = student_id
    if counselor_id:
        query["counselor_id"] = counselor_id
    if session_type:
        query["session_type"] = session_type
    if status:
        query["status"] = status
    
    # Branch isolation
    if is_hq_role(current_user.get("role")):
        if branch_id:
            query["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        query["branch_id"] = user_branch_id
    
    sessions = []
    async for session in sessions_coll.find(query).skip(skip).limit(limit).sort("session_date", -1):
        session_dict = {
            "id": str(session["_id"]),
            "session_code": session.get("session_code", ""),
            "student_id": session.get("student_id", ""),
            "counselor_id": session.get("counselor_id", ""),
            "session_type": session.get("session_type", ""),
            "reason": session.get("reason", ""),
            "title": session.get("title", ""),
            "session_date": session.get("session_date").isoformat() if session.get("session_date") else datetime.utcnow().isoformat(),
            "duration_minutes": session.get("duration_minutes", 0),
            "location": session.get("location", ""),
            "status": session.get("status", "scheduled"),
            "created_at": session.get("created_at").isoformat() if session.get("created_at") else datetime.utcnow().isoformat()
        }
        sessions.append(session_dict)
    
    return sessions

@router.put("/counseling-sessions/{session_id}", response_model=CounselingSession)
async def update_counseling_session(
    session_id: str,
    session_update: CounselingSessionUpdate,
    sessions_coll: Any = Depends(get_counseling_sessions_collection),
    current_user: dict = Depends(get_current_user),
):
    """Update a counseling session."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'counselor', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to update counseling sessions")
    
    if not validate_mongodb_id(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    # Sanitize update data
    update_data = sanitize_input(session_update.dict(exclude_unset=True), [
        "session_type", "reason", "title", "session_date", "duration_minutes", "location",
        "participants", "goals", "intervention_strategies", "homework_assigned", "next_session_date",
        "risk_level", "confidentiality_level", "parent_involvement_required", "teacher_notification_required",
        "follow_up_required", "referral_needed", "referral_type", "emergency_contact_made",
        "status", "session_notes", "progress_assessment"
    ])
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Convert datetime fields
    for datetime_field in ["session_date", "next_session_date"]:
        if datetime_field in update_data and update_data[datetime_field]:
            if isinstance(update_data[datetime_field], str):
                try:
                    update_data[datetime_field] = datetime.fromisoformat(update_data[datetime_field].replace('Z', '+00:00'))
                except:
                    pass
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await sessions_coll.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Counseling session not found")
    
    # Return updated session
    updated_session = await sessions_coll.find_one({"_id": ObjectId(session_id)})
    return CounselingSession(
        id=str(updated_session["_id"]),
        **{k: v for k, v in updated_session.items() if k != "_id"}
    )

@router.delete("/counseling-sessions/{session_id}")
async def delete_counseling_session(
    session_id: str,
    sessions_coll: Any = Depends(get_counseling_sessions_collection),
    current_user: dict = Depends(get_current_user),
):
    """Delete a counseling session."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'counselor']:
        raise HTTPException(status_code=403, detail="Not authorized to delete counseling sessions")
    
    if not validate_mongodb_id(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    result = await sessions_coll.delete_one({"_id": ObjectId(session_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Counseling session not found")
    
    return {"message": "Counseling session deleted successfully"}

# Behavior Contracts
@router.post("/behavior-contracts", response_model=BehaviorContract)
async def create_behavior_contract(
    contract_in: BehaviorContractCreate,
    contracts_coll: Any = Depends(get_behavior_contracts_collection),
    current_user: dict = Depends(get_current_user),
):
    """Create a behavior contract."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'counselor']:
        raise HTTPException(status_code=403, detail="Not authorized to create behavior contracts")
    
    # Sanitize input
    contract_data = sanitize_input(contract_in.dict(), [
        "student_id", "created_by", "contract_type", "title", "description", "goals",
        "expectations", "consequences", "rewards", "start_date", "end_date",
        "review_frequency", "success_criteria", "monitoring_method",
        "parent_signature_required", "student_signature_required",
        "teacher_signatures_required", "is_active", "branch_id"
    ])
    
    # Validate student exists
    await validate_student_id(contract_data["student_id"])

    # Attach/enforce branch isolation
    payload_branch_id = contract_data.get("branch_id")
    if is_hq_role(current_user.get("role")):
        if not payload_branch_id:
            raise HTTPException(status_code=400, detail="branch_id is required when creating behavior contracts as HQ user")
        await validate_branch_id(payload_branch_id)
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            raise HTTPException(status_code=403, detail="User must be assigned to a branch")
        contract_data["branch_id"] = user_branch_id
    
    # Convert date fields to datetime
    if "start_date" in contract_data and contract_data["start_date"]:
        if isinstance(contract_data["start_date"], date) and not isinstance(contract_data["start_date"], datetime):
            contract_data["start_date"] = datetime.combine(contract_data["start_date"], datetime.min.time())
    if "end_date" in contract_data and contract_data["end_date"]:
        if isinstance(contract_data["end_date"], date) and not isinstance(contract_data["end_date"], datetime):
            contract_data["end_date"] = datetime.combine(contract_data["end_date"], datetime.min.time())
    
    # Generate unique contract code
    contract_code = generate_contract_code()
    while await contracts_coll.find_one({"contract_code": contract_code}):
        contract_code = generate_contract_code()
    
    # Add metadata
    now = datetime.utcnow()
    contract_data.update({
        "contract_code": contract_code,
        "status": "draft",
        "signed_by_student": False,
        "signed_by_parent": False,
        "teacher_signatures": {},
        "progress_reviews": [],
        "completion_percentage": 0.0,
        "violation_count": 0,
        "renewal_count": 0,
        "created_at": now,
        "updated_at": now
    })
    
    result = await contracts_coll.insert_one(contract_data)
    contract_data["id"] = str(result.inserted_id)
    
    return BehaviorContract(**contract_data)

@router.get("/behavior-contracts")
async def list_behavior_contracts(
    student_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    branch_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    contracts_coll: Any = Depends(get_behavior_contracts_collection),
    current_user: dict = Depends(get_current_user),
):
    """List behavior contracts."""
    query = {}
    
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status
    if is_active is not None:
        query["is_active"] = is_active
    
    # Branch isolation
    if is_hq_role(current_user.get("role")):
        if branch_id:
            query["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        query["branch_id"] = user_branch_id

    contracts = []
    async for contract in contracts_coll.find(query).skip(skip).limit(limit).sort("start_date", -1):
        contract_dict = {
            "id": str(contract["_id"]),
            "contract_code": contract.get("contract_code", ""),
            "student_id": contract.get("student_id", ""),
            "created_by": contract.get("created_by", ""),
            "contract_type": contract.get("contract_type", ""),
            "title": contract.get("title", ""),
            "description": contract.get("description", ""),
            "goals": contract.get("goals", []),
            "start_date": contract.get("start_date") if isinstance(contract.get("start_date"), str) else (contract.get("start_date").isoformat() if contract.get("start_date") else datetime.utcnow().isoformat()),
            "end_date": contract.get("end_date") if isinstance(contract.get("end_date"), str) else (contract.get("end_date").isoformat() if contract.get("end_date") else datetime.utcnow().isoformat()),
            "status": contract.get("status", "draft"),
            "is_active": contract.get("is_active", False),
            "completion_percentage": contract.get("completion_percentage", 0.0),
            "created_at": contract.get("created_at") if isinstance(contract.get("created_at"), str) else (contract.get("created_at").isoformat() if contract.get("created_at") else datetime.utcnow().isoformat())
        }
        contracts.append(contract_dict)
    
    return contracts

@router.put("/behavior-contracts/{contract_id}", response_model=BehaviorContract)
async def update_behavior_contract(
    contract_id: str,
    contract_update: BehaviorContractUpdate,
    contracts_coll: Any = Depends(get_behavior_contracts_collection),
    current_user: dict = Depends(get_current_user),
):
    """Update a behavior contract."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'counselor', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to update behavior contracts")
    
    if not validate_mongodb_id(contract_id):
        raise HTTPException(status_code=400, detail="Invalid contract ID")
    
    # Sanitize update data
    update_data = sanitize_input(contract_update.dict(exclude_unset=True), [
        "contract_type", "title", "description", "goals", "expectations", "consequences",
        "rewards", "start_date", "end_date", "review_frequency", "success_criteria",
        "monitoring_method", "parent_signature_required", "student_signature_required",
        "teacher_signatures_required", "is_active", "status", "signed_by_student",
        "signed_by_parent", "completion_percentage"
    ])
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Convert date fields
    for date_field in ["start_date", "end_date"]:
        if date_field in update_data and update_data[date_field]:
            if isinstance(update_data[date_field], date) and not isinstance(update_data[date_field], datetime):
                update_data[date_field] = datetime.combine(update_data[date_field], datetime.min.time())
    
    update_data["updated_at"] = datetime.utcnow()
    
    result = await contracts_coll.update_one(
        {"_id": ObjectId(contract_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Behavior contract not found")
    
    # Return updated contract
    updated_contract = await contracts_coll.find_one({"_id": ObjectId(contract_id)})
    return BehaviorContract(
        id=str(updated_contract["_id"]),
        **{k: v for k, v in updated_contract.items() if k != "_id"}
    )

@router.delete("/behavior-contracts/{contract_id}")
async def delete_behavior_contract(
    contract_id: str,
    contracts_coll: Any = Depends(get_behavior_contracts_collection),
    current_user: dict = Depends(get_current_user),
):
    """Delete a behavior contract."""
    if current_user.get('role') not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'counselor']:
        raise HTTPException(status_code=403, detail="Not authorized to delete behavior contracts")
    
    if not validate_mongodb_id(contract_id):
        raise HTTPException(status_code=400, detail="Invalid contract ID")
    
    result = await contracts_coll.delete_one({"_id": ObjectId(contract_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Behavior contract not found")
    
    return {"message": "Behavior contract deleted successfully"}

# Disciplinary Statistics
@router.get("/stats", response_model=DisciplinaryStats)
async def get_disciplinary_statistics(
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    incidents_coll: Any = Depends(get_incidents_collection),
    actions_coll: Any = Depends(get_disciplinary_actions_collection),
    points_coll: Any = Depends(get_behavior_points_collection),
    rewards_coll: Any = Depends(get_rewards_collection),
    sessions_coll: Any = Depends(get_counseling_sessions_collection),
    contracts_coll: Any = Depends(get_behavior_contracts_collection),
    meetings_coll: Any = Depends(get_parent_meetings_collection),
    current_user: dict = Depends(get_current_user),
):
    """Get disciplinary statistics (branch-aware)."""
    # Build branch filter
    branch_filter: dict = {}
    if is_hq_role(current_user.get("role")):
        # HQ can view all or a specific branch if provided
        if branch_id:
            branch_filter["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if user_branch_id:
            branch_filter["branch_id"] = user_branch_id

    # Basic counts
    total_incidents = await incidents_coll.count_documents(branch_filter)
    open_incidents = await incidents_coll.count_documents({**branch_filter, "status": "open"})
    resolved_incidents = await incidents_coll.count_documents({**branch_filter, "status": "resolved"})
    
    # Behavior points
    positive_points_cursor = points_coll.aggregate([
        {"$match": {**branch_filter, "point_type": "positive"}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ])
    positive_points_result = await positive_points_cursor.to_list(1)
    positive_behavior_points = positive_points_result[0]["total"] if positive_points_result else 0
    
    negative_points_cursor = points_coll.aggregate([
        {"$match": {**branch_filter, "point_type": "negative"}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ])
    negative_points_result = await negative_points_cursor.to_list(1)
    negative_behavior_points = abs(negative_points_result[0]["total"]) if negative_points_result else 0
    
    # Other counts
    rewards_given = await rewards_coll.count_documents(branch_filter)
    counseling_sessions_held = await sessions_coll.count_documents({**branch_filter, "status": "completed"})
    behavior_contracts_active = await contracts_coll.count_documents({**branch_filter, "status": "active"})
    parent_meetings_scheduled = await meetings_coll.count_documents({**branch_filter, "status": {"$in": ["scheduled", "confirmed"]}})
    disciplinary_actions_pending = await actions_coll.count_documents({**branch_filter, "status": "pending"})
    
    # Incidents by type
    incidents_by_type_cursor = incidents_coll.aggregate([
        {"$match": branch_filter if branch_filter else {}},
        {"$group": {"_id": "$incident_type", "count": {"$sum": 1}}}
    ])
    incidents_by_type = {}
    async for item in incidents_by_type_cursor:
        incidents_by_type[item["_id"]] = item["count"]
    
    # Incidents by severity
    incidents_by_severity_cursor = incidents_coll.aggregate([
        {"$match": branch_filter if branch_filter else {}},
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
    ])
    incidents_by_severity = {}
    async for item in incidents_by_severity_cursor:
        incidents_by_severity[item["_id"]] = item["count"]
    
    return DisciplinaryStats(
        total_incidents=total_incidents,
        open_incidents=open_incidents,
        resolved_incidents=resolved_incidents,
        incidents_by_type=incidents_by_type,
        incidents_by_severity=incidents_by_severity,
        most_common_violations=[],  # Can be implemented based on requirements
        repeat_offenders=[],  # Can be implemented based on requirements
        positive_behavior_points=positive_behavior_points,
        negative_behavior_points=negative_behavior_points,
        rewards_given=rewards_given,
        counseling_sessions_held=counseling_sessions_held,
        behavior_contracts_active=behavior_contracts_active,
        parent_meetings_scheduled=parent_meetings_scheduled,
        disciplinary_actions_pending=disciplinary_actions_pending,
        trend_analysis={},  # Can be implemented based on requirements
        class_behavior_summary={},  # Can be implemented based on requirements
        grade_level_analysis={}  # Can be implemented based on requirements
    )
