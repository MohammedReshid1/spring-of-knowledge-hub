import asyncio
from backend.app.db import get_db

async def test_stats():
    db = get_db()
    coll = db["students"]
    
    print("=== Testing Student Stats ===")
    
    # Test 1: No filter (should get all 81 students)
    total_all = await coll.count_documents({})
    print(f"1. Total students (no filter): {total_all}")
    
    # Test 2: Filter by specific branch_id
    total_branch = await coll.count_documents({"branch_id": "687a956f94db7613aaf3ff77"})
    print(f"2. Total students (branch filter): {total_branch}")
    
    # Test 3: Filter by 'all' (should be empty)
    total_all_filter = await coll.count_documents({"branch_id": "all"})
    print(f"3. Total students (branch_id='all'): {total_all_filter}")
    
    # Test 4: Active students with no filter
    active_all = await coll.count_documents({"status": "Active"})
    print(f"4. Active students (no filter): {active_all}")
    
    # Test 5: Active students with branch filter
    active_branch = await coll.count_documents({"branch_id": "687a956f94db7613aaf3ff77", "status": "Active"})
    print(f"5. Active students (branch filter): {active_branch}")
    
    print("\n=== Expected Results ===")
    print("If the frontend sends branch_id='all', the backend should NOT filter by branch")
    print("If the frontend sends branch_id='687a956f94db7613aaf3ff77', the backend should filter by that branch")
    print("Both should return 81 students since all students are in that branch")

if __name__ == "__main__":
    asyncio.run(test_stats()) 