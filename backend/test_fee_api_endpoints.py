#!/usr/bin/env python3
"""
Test script to verify fee template API endpoints are working correctly
"""
import asyncio
import aiohttp
import json
from datetime import datetime

# API configuration
BASE_URL = "http://localhost:8000"
TOKEN = None  # Will be set after login

async def login():
    """Login to get authentication token"""
    global TOKEN
    async with aiohttp.ClientSession() as session:
        login_data = {
            "username": "admin",
            "password": "admin123"  # Use your actual admin password
        }
        async with session.post(f"{BASE_URL}/users/login", json=login_data) as resp:
            if resp.status == 200:
                data = await resp.json()
                TOKEN = data.get("access_token")
                print("✓ Login successful")
                print(f"  User: {data.get('user', {}).get('username')}")
                print(f"  Role: {data.get('user', {}).get('role')}")
                print(f"  Branch ID: {data.get('user', {}).get('branch_id')}")
                return data.get('user')
            else:
                print(f"✗ Login failed: {resp.status}")
                text = await resp.text()
                print(f"  Response: {text}")
                return None

async def test_debug_endpoint():
    """Test the debug endpoint to see what's happening"""
    print("\n" + "="*80)
    print("TESTING DEBUG ENDPOINT")
    print("="*80)
    
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {TOKEN}"}
        async with session.get(f"{BASE_URL}/payments/fee-templates/debug", headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                print("✓ Debug endpoint working")
                print(f"\nUser Context:")
                print(json.dumps(data.get("user_context"), indent=2))
                print(f"\nQuery Used:")
                print(data.get("query_used"))
                print(f"\nTemplate Counts:")
                print(f"  Total in DB: {data.get('total_templates_in_db')}")
                print(f"  Visible to user: {data.get('templates_visible_to_user')}")
                print(f"\nSample Templates:")
                for template in data.get("sample_templates", []):
                    print(f"  - {template.get('name')} (Branch: {template.get('branch_id')})")
            else:
                print(f"✗ Debug endpoint failed: {resp.status}")
                text = await resp.text()
                print(f"  Response: {text}")

async def test_get_templates():
    """Test getting fee templates"""
    print("\n" + "="*80)
    print("TESTING GET FEE TEMPLATES")
    print("="*80)
    
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {TOKEN}"}
        async with session.get(f"{BASE_URL}/payments/fee-templates", headers=headers) as resp:
            if resp.status == 200:
                templates = await resp.json()
                print(f"✓ Retrieved {len(templates)} fee templates")
                for template in templates[:3]:  # Show first 3
                    print(f"\n  Template: {template.get('name')}")
                    print(f"    ID: {template.get('id')}")
                    print(f"    Category: {template.get('category')}")
                    print(f"    Amount: ${template.get('amount')}")
                    print(f"    Branch ID: {template.get('branch_id')}")
                    print(f"    Active: {template.get('is_active')}")
                return templates
            else:
                print(f"✗ Get templates failed: {resp.status}")
                text = await resp.text()
                print(f"  Response: {text}")
                return []

async def test_create_template():
    """Test creating a new fee template"""
    print("\n" + "="*80)
    print("TESTING CREATE FEE TEMPLATE")
    print("="*80)
    
    template_data = {
        "name": f"Test Template {datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
        "category": "tuition",
        "amount": 750.00,
        "description": "Test template created via API test",
        "frequency": "monthly",
        "is_mandatory": True,
        "academic_year": "2024-2025",
        "is_active": True
    }
    
    print(f"Creating template: {template_data['name']}")
    
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {TOKEN}"}
        async with session.post(
            f"{BASE_URL}/payments/fee-templates", 
            headers=headers,
            json=template_data
        ) as resp:
            if resp.status == 200:
                created = await resp.json()
                print(f"✓ Template created successfully")
                print(f"  ID: {created.get('id')}")
                print(f"  Name: {created.get('name')}")
                print(f"  Branch ID: {created.get('branch_id')}")
                return created.get('id')
            else:
                print(f"✗ Create template failed: {resp.status}")
                text = await resp.text()
                print(f"  Response: {text}")
                return None

async def test_get_single_template(template_id):
    """Test getting a single template by ID"""
    print("\n" + "="*80)
    print("TESTING GET SINGLE TEMPLATE")
    print("="*80)
    
    if not template_id:
        print("⚠ No template ID provided, skipping test")
        return
    
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {TOKEN}"}
        # Note: This endpoint might not exist, but let's try
        async with session.get(f"{BASE_URL}/payments/fee-templates/{template_id}", headers=headers) as resp:
            if resp.status == 200:
                template = await resp.json()
                print(f"✓ Retrieved template: {template.get('name')}")
                print(f"  All fields: {list(template.keys())}")
            elif resp.status == 404:
                print("⚠ Single template endpoint not implemented (404)")
            else:
                print(f"✗ Get single template failed: {resp.status}")

async def test_filter_templates():
    """Test filtering fee templates"""
    print("\n" + "="*80)
    print("TESTING TEMPLATE FILTERING")
    print("="*80)
    
    filters = [
        {"params": {"is_active": "true"}, "description": "Active templates only"},
        {"params": {"category": "tuition"}, "description": "Tuition category only"},
        {"params": {"academic_year": "2024-2025"}, "description": "2024-2025 academic year"}
    ]
    
    async with aiohttp.ClientSession() as session:
        headers = {"Authorization": f"Bearer {TOKEN}"}
        
        for filter_test in filters:
            params = filter_test["params"]
            desc = filter_test["description"]
            
            async with session.get(
                f"{BASE_URL}/payments/fee-templates",
                headers=headers,
                params=params
            ) as resp:
                if resp.status == 200:
                    templates = await resp.json()
                    print(f"\n{desc}:")
                    print(f"  ✓ Found {len(templates)} templates")
                    if templates:
                        print(f"    First: {templates[0].get('name')}")
                else:
                    print(f"\n{desc}:")
                    print(f"  ✗ Filter failed: {resp.status}")

async def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("FEE TEMPLATE API TEST SUITE")
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    print(f"API Base: {BASE_URL}")
    print("="*80)
    
    # Login first
    user = await login()
    if not user:
        print("\n❌ Cannot proceed without authentication")
        return
    
    # Run tests
    await test_debug_endpoint()
    templates = await test_get_templates()
    created_id = await test_create_template()
    await test_get_single_template(created_id)
    await test_filter_templates()
    
    # Re-test get templates to see if new one appears
    print("\n" + "="*80)
    print("VERIFYING NEW TEMPLATE APPEARS IN LIST")
    print("="*80)
    templates_after = await test_get_templates()
    
    if created_id and templates_after:
        found = any(t.get('id') == created_id for t in templates_after)
        if found:
            print("\n✓✓✓ SUCCESS: New template appears in list!")
        else:
            print("\n✗✗✗ ISSUE: New template NOT appearing in list!")
            print("This indicates the branch filtering issue persists")
    
    print("\n" + "="*80)
    print("TEST SUITE COMPLETE")
    print("="*80)

if __name__ == "__main__":
    asyncio.run(main())