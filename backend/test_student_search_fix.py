#!/usr/bin/env python3
"""
Test script to verify the student search fix.
"""
import asyncio
import sys
import os
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup database connection
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.spring_of_knowledge

async def test_search_fix():
    """Test the student search API after fixes"""
    print("=== TESTING STUDENT SEARCH FIX ===\n")

    # Get some real student names to test with
    target_branch = "68b7231bb110092a69ae2acc"
    students = await db.students.find({"branch_id": target_branch}).limit(5).to_list(length=5)

    print("Sample students in target branch:")
    test_queries = []
    for student in students:
        name = student.get("first_name", "")
        print(f"  {student.get('student_id', 'NO_ID')} - {name} - Status: {student.get('status', 'NO_STATUS')}")
        if len(name) >= 3:
            test_queries.append(name[:3].lower())  # First 3 characters

    print(f"\nTest queries to try: {test_queries}")

    # Test the API endpoint directly using the FastAPI test client
    base_url = "http://localhost:8000"  # Assuming FastAPI is running

    for query in test_queries[:3]:  # Test first 3 queries
        try:
            print(f"\n--- Testing search query: '{query}' ---")

            url = f"{base_url}/payments/students/search"
            params = {
                "q": query,
                "branch_id": target_branch,
                "limit": 10
            }

            response = requests.get(url, params=params, timeout=10)

            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Results found: {data.get('count', 0)}")
                if data.get('debug_info'):
                    debug = data['debug_info']
                    print(f"Debug info: total_in_branch={debug.get('total_in_branch')}, active_in_branch={debug.get('active_in_branch')}, search_results={debug.get('search_results')}")

                if data.get('students'):
                    print("Sample results:")
                    for student in data['students'][:3]:
                        print(f"  {student.get('student_id')} - {student.get('first_name')} - Active: {student.get('is_active')}")
            else:
                print(f"Error: {response.text}")

        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            print("Note: Make sure FastAPI server is running on localhost:8000")
            break

    # Also test some common search patterns
    print(f"\n--- Testing common patterns ---")
    common_tests = ["a", "ab", "grade", "student"]

    for query in common_tests:
        try:
            count = await db.students.count_documents({
                "$or": [
                    {"student_id": {"$regex": query, "$options": "i"}},
                    {"first_name": {"$regex": query, "$options": "i"}},
                    {"last_name": {"$regex": query, "$options": "i"}},
                    {"email": {"$regex": query, "$options": "i"}},
                    {"phone": {"$regex": query, "$options": "i"}},
                    {"father_name": {"$regex": query, "$options": "i"}},
                    {"mother_name": {"$regex": query, "$options": "i"}},
                    {"grandfather_name": {"$regex": query, "$options": "i"}}
                ],
                "branch_id": target_branch,
                "status": {"$in": ["Active", "active"]}
            })
            print(f"  Query '{query}': {count} matches in database")
        except Exception as e:
            print(f"  Query '{query}': Error - {e}")

if __name__ == "__main__":
    asyncio.run(test_search_fix())