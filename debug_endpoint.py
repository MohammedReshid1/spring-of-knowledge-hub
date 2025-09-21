#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Import everything needed
from backend.app.db import get_db
from backend.app.routers.library import router as library_router
import asyncio
import traceback

async def test_library():
    """Test library endpoint directly"""
    try:
        # Get database
        db = get_db()
        
        # Try to get books
        books_coll = db["books"]
        books = await books_coll.find().limit(5).to_list(5)
        print(f"✅ Successfully accessed books collection, found {len(books)} books")
        return True
    except Exception as e:
        print(f"❌ Error accessing books: {e}")
        traceback.print_exc()
        return False

async def test_discipline():
    """Test discipline endpoint directly"""
    try:
        # Get database
        db = get_db()
        
        # Try to get incidents
        incidents_coll = db["incidents"]
        incidents = await incidents_coll.find().limit(5).to_list(5)
        print(f"✅ Successfully accessed incidents collection, found {len(incidents)} incidents")
        return True
    except Exception as e:
        print(f"❌ Error accessing incidents: {e}")
        traceback.print_exc()
        return False

async def test_inventory():
    """Test inventory endpoint directly"""
    try:
        # Get database
        db = get_db()
        
        # Try to get assets
        assets_coll = db["assets"]
        assets = await assets_coll.find().limit(5).to_list(5)
        print(f"✅ Successfully accessed assets collection, found {len(assets)} assets")
        return True
    except Exception as e:
        print(f"❌ Error accessing assets: {e}")
        traceback.print_exc()
        return False

async def main():
    print("Testing direct database access...")
    print("-" * 40)
    
    await test_library()
    await test_discipline()
    await test_inventory()

if __name__ == "__main__":
    asyncio.run(main())