# Mock database implementation for development/testing
from fastapi import Depends, HTTPException, status
from typing import Dict, List, Any
import json
import os
from datetime import datetime

# In-memory storage for development
mock_data = {
    "users": [],
    "branches": [
        {
            "_id": "507f1f77bcf86cd799439011",
            "name": "Main Branch",
            "address": "123 Main St",
            "phone": "+1234567890",
            "email": "main@school.edu",
            "created_at": datetime.now().isoformat()
        }
    ],
    "students": [],
    "classes": [],
    "attendance": [],
    "fees": [],
    "grade_levels": [],
    "subjects": [],
    "student_enrollments": [],
    "payment_mode": [],
    "registration_payments": [],
    "backup_logs": [],
    "grade_transitions": []
}

# File to persist data during development
DATA_FILE = "mock_data.json"

def load_mock_data():
    """Load mock data from file if it exists"""
    global mock_data
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r') as f:
                mock_data = json.load(f)
        except Exception as e:
            print(f"Error loading mock data: {e}")
    return mock_data

def save_mock_data():
    """Save mock data to file"""
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(mock_data, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving mock data: {e}")

# Load data on module import
load_mock_data()

class MockCollection:
    def __init__(self, collection_name: str):
        self.collection_name = collection_name
    
    async def find(self, query: Dict = None):
        """Mock find operation"""
        data = mock_data.get(self.collection_name, [])
        if query is None:
            return MockCursor(data)
        
        # Simple query filtering (can be extended)
        filtered_data = []
        for item in data:
            match = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    match = False
                    break
            if match:
                filtered_data.append(item)
        
        return MockCursor(filtered_data)
    
    async def find_one(self, query: Dict):
        """Mock find_one operation"""
        data = mock_data.get(self.collection_name, [])
        for item in data:
            match = True
            for key, value in query.items():
                if key == "_id" and isinstance(value, dict) and "$oid" in value:
                    if item.get("_id") != value["$oid"]:
                        match = False
                        break
                elif key not in item or item[key] != value:
                    match = False
                    break
            if match:
                return item
        return None
    
    async def insert_one(self, document: Dict):
        """Mock insert_one operation"""
        if "_id" not in document:
            # Generate a simple ID
            document["_id"] = f"mock_id_{len(mock_data.get(self.collection_name, []))}"
        
        mock_data.setdefault(self.collection_name, []).append(document)
        save_mock_data()
        
        return MockInsertResult(document["_id"])
    
    async def update_one(self, query: Dict, update: Dict):
        """Mock update_one operation"""
        data = mock_data.get(self.collection_name, [])
        for i, item in enumerate(data):
            match = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    match = False
                    break
            if match:
                if "$set" in update:
                    item.update(update["$set"])
                save_mock_data()
                return MockUpdateResult(1)
        return MockUpdateResult(0)
    
    async def delete_one(self, query: Dict):
        """Mock delete_one operation"""
        data = mock_data.get(self.collection_name, [])
        for i, item in enumerate(data):
            match = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    match = False
                    break
            if match:
                del data[i]
                save_mock_data()
                return MockDeleteResult(1)
        return MockDeleteResult(0)

class MockCursor:
    def __init__(self, data: List[Dict]):
        self.data = data
    
    def to_list(self, length: int = None):
        if length is None:
            return self.data
        return self.data[:length]

class MockInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id

class MockUpdateResult:
    def __init__(self, modified_count):
        self.modified_count = modified_count

class MockDeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count

class MockDatabase:
    def __getitem__(self, collection_name: str):
        return MockCollection(collection_name)

def get_db():
    """Return mock database for development"""
    return MockDatabase()

# Dependency functions to fetch specific collections
def get_user_collection(db=Depends(get_db)):
    return db["users"]

def get_branch_collection(db=Depends(get_db)):
    return db["branches"]

def get_student_collection(db=Depends(get_db)):
    return db["students"]

async def validate_branch_id(branch_id: str) -> str:
    """
    Ensure the branch_id exists in the branches collection.
    Special case: 'all' is allowed for multi-branch queries.
    """
    # Allow 'all' as a special case for multi-branch queries
    if branch_id == "all":
        return branch_id

    branches = MockCollection("branches")
    branch = await branches.find_one({"_id": branch_id})
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid branch_id"
        )
    return branch_id

async def validate_student_id(student_id: str) -> str:
    """
    Ensure the student_id exists in the students collection.
    """
    students = MockCollection("students")
    student = await students.find_one({"_id": student_id})
    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid student_id"
        )
    return student_id