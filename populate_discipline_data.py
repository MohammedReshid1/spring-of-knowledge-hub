#!/usr/bin/env python3
"""
Populate sample data for Disciplinary Management
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from bson import ObjectId
import random
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

async def populate_discipline_data():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.spring_of_knowledge

    # Clear existing test data (optional)
    print("Clearing existing test data...")
    # Uncomment if you want to clear existing data
    # await db.incidents.delete_many({})
    # await db.behavior_points.delete_many({})
    # await db.rewards.delete_many({})
    
    # Sample incidents data
    incidents = []
    incident_types = ["behavioral", "academic", "attendance", "safety"]
    severities = ["minor", "moderate", "major"]
    statuses = ["open", "under_investigation", "resolved", "closed"]
    
    for i in range(10):
        incident = {
            "_id": ObjectId(),
            "student_id": f"STU00{i+1}",
            "reported_by": "Teacher Admin",
            "incident_type": random.choice(incident_types),
            "severity": random.choice(severities),
            "title": f"Sample Incident {i+1}",
            "description": f"This is a sample incident description for testing purposes. Incident number {i+1}.",
            "location": f"Room {100 + i}",
            "incident_date": datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            "witnesses": [f"Witness{j}" for j in range(random.randint(0, 3))],
            "evidence_files": [],
            "immediate_action_taken": "Verbal warning given",
            "parent_contacted": random.choice([True, False]),
            "parent_contact_method": random.choice(["phone", "email", "meeting", None]),
            "parent_contact_date": datetime.utcnow() - timedelta(days=random.randint(1, 10)) if random.choice([True, False]) else None,
            "is_resolved": random.choice([True, False]),
            "follow_up_required": random.choice([True, False]),
            "follow_up_date": None,
            "incident_code": f"INC{100000 + i}",
            "status": random.choice(statuses),
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            "updated_at": datetime.utcnow(),
            "created_by": "admin"
        }
        incidents.append(incident)
    
    if incidents:
        result = await db.incidents.insert_many(incidents)
        print(f"✅ Inserted {len(result.inserted_ids)} incidents")
    
    # Sample behavior points
    behavior_points = []
    point_types = ["positive", "negative"]
    categories = ["academic", "behavior", "participation", "leadership", "attendance"]
    
    for i in range(20):
        point = {
            "_id": ObjectId(),
            "student_id": f"STU00{random.randint(1, 10)}",
            "awarded_by": "Teacher Admin",
            "point_type": random.choice(point_types),
            "points": random.randint(1, 10) if random.choice(point_types) == "positive" else -random.randint(1, 10),
            "category": random.choice(categories),
            "reason": f"Sample reason for behavior point {i+1}",
            "date_awarded": datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            "point_code": f"BP{100000 + i}",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            "updated_at": datetime.utcnow()
        }
        behavior_points.append(point)
    
    if behavior_points:
        result = await db.behavior_points.insert_many(behavior_points)
        print(f"✅ Inserted {len(result.inserted_ids)} behavior points")
    
    # Sample rewards
    rewards_list = []
    reward_types = ["certificate", "trophy", "medal", "privilege", "recognition"]
    
    for i in range(10):
        reward = {
            "_id": ObjectId(),
            "student_id": f"STU00{random.randint(1, 10)}",
            "title": f"Outstanding Achievement {i+1}",
            "description": f"Awarded for excellent performance in {random.choice(['Mathematics', 'Science', 'Sports', 'Arts', 'Leadership'])}",
            "reward_type": random.choice(reward_types),
            "points_awarded": random.randint(10, 50),
            "date_awarded": datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            "awarded_by": "Principal",
            "reward_code": f"RW{100000 + i}",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            "updated_at": datetime.utcnow()
        }
        rewards_list.append(reward)
    
    if rewards_list:
        result = await db.rewards.insert_many(rewards_list)
        print(f"✅ Inserted {len(result.inserted_ids)} rewards")
    
    # Sample counseling sessions
    sessions = []
    session_types = ["behavioral", "academic", "emotional", "social", "career"]
    session_statuses = ["scheduled", "completed", "cancelled", "no_show"]
    
    for i in range(8):
        session = {
            "_id": ObjectId(),
            "student_id": f"STU00{random.randint(1, 10)}",
            "counselor_id": "Counselor Admin",
            "session_type": random.choice(session_types),
            "title": f"Counseling Session {i+1}",
            "description": f"Session to discuss {random.choice(['behavior improvement', 'academic progress', 'emotional support', 'social skills'])}",
            "scheduled_date": datetime.utcnow() + timedelta(days=random.randint(1, 14)),
            "duration_minutes": random.choice([30, 45, 60]),
            "location": f"Counseling Room {random.randint(1, 3)}",
            "status": random.choice(session_statuses),
            "session_code": f"CS{100000 + i}",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 7)),
            "updated_at": datetime.utcnow()
        }
        sessions.append(session)
    
    if sessions:
        result = await db.counseling_sessions.insert_many(sessions)
        print(f"✅ Inserted {len(result.inserted_ids)} counseling sessions")
    
    # Sample behavior contracts
    contracts = []
    contract_statuses = ["draft", "active", "completed", "terminated"]
    
    for i in range(5):
        contract = {
            "_id": ObjectId(),
            "student_id": f"STU00{random.randint(1, 10)}",
            "title": f"Behavior Improvement Contract {i+1}",
            "description": "Contract for improving student behavior and academic performance",
            "goals": [
                "Arrive on time to all classes",
                "Complete all homework assignments",
                "Participate actively in class"
            ],
            "start_date": datetime.utcnow() - timedelta(days=random.randint(1, 14)),
            "end_date": datetime.utcnow() + timedelta(days=random.randint(30, 90)),
            "status": random.choice(contract_statuses),
            "contract_code": f"BC{100000 + i}",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 14)),
            "updated_at": datetime.utcnow(),
            "created_by": "admin"
        }
        contracts.append(contract)
    
    if contracts:
        result = await db.behavior_contracts.insert_many(contracts)
        print(f"✅ Inserted {len(result.inserted_ids)} behavior contracts")
    
    # Sample parent meetings
    meetings = []
    meeting_statuses = ["scheduled", "confirmed", "completed", "cancelled"]
    
    for i in range(6):
        meeting = {
            "_id": ObjectId(),
            "student_id": f"STU00{random.randint(1, 10)}",
            "parent_name": f"Parent {i+1}",
            "teacher_id": "Teacher Admin",
            "purpose": random.choice(["behavior_discussion", "academic_review", "incident_followup", "progress_update"]),
            "scheduled_date": datetime.utcnow() + timedelta(days=random.randint(1, 14)),
            "duration_minutes": random.choice([30, 45, 60]),
            "location": f"Meeting Room {random.randint(1, 3)}",
            "status": random.choice(meeting_statuses),
            "meeting_code": f"PM{100000 + i}",
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 7)),
            "updated_at": datetime.utcnow()
        }
        meetings.append(meeting)
    
    if meetings:
        result = await db.parent_meetings.insert_many(meetings)
        print(f"✅ Inserted {len(result.inserted_ids)} parent meetings")
    
    print("\n✅ Sample discipline data populated successfully!")
    
    # Display summary
    total_incidents = await db.incidents.count_documents({})
    total_points = await db.behavior_points.count_documents({})
    total_rewards = await db.rewards.count_documents({})
    total_sessions = await db.counseling_sessions.count_documents({})
    total_contracts = await db.behavior_contracts.count_documents({})
    total_meetings = await db.parent_meetings.count_documents({})
    
    print(f"\n📊 Database Summary:")
    print(f"   - Incidents: {total_incidents}")
    print(f"   - Behavior Points: {total_points}")
    print(f"   - Rewards: {total_rewards}")
    print(f"   - Counseling Sessions: {total_sessions}")
    print(f"   - Behavior Contracts: {total_contracts}")
    print(f"   - Parent Meetings: {total_meetings}")

if __name__ == "__main__":
    asyncio.run(populate_discipline_data())