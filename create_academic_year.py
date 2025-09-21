import asyncio
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.db import get_db
from datetime import datetime, date

async def create_academic_year():
    db = get_db()
    academic_years = db['academic_years']
    
    # Check if any academic year exists
    existing = await academic_years.find_one()
    if existing:
        print('Academic year already exists')
        return
    
    academic_year_data = {
        'name': '2024-2025',
        'start_date': datetime(2024, 9, 1),
        'end_date': datetime(2025, 6, 30), 
        'is_current': True,
        'description': 'Current academic year',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': '507f1f77bcf86cd799439011'
    }
    
    result = await academic_years.insert_one(academic_year_data)
    print(f'Created academic year: {result.inserted_id}')

if __name__ == "__main__":
    asyncio.run(create_academic_year())