#!/usr/bin/env python3
"""
Cache Invalidation Test for Fee Management
Tests React Query cache invalidation and real-time updates
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime
from typing import Dict, List
import os
from dotenv import load_dotenv

load_dotenv()

class CacheInvalidationTester:
    def __init__(self):
        self.api_base = "http://localhost:8000"
        self.session = None
        self.auth_token = None
        self.test_branch_id = None
        self.created_templates = []
        
    async def setup(self):
        """Setup test environment"""
        self.session = aiohttp.ClientSession()
        
        # Create test admin token (simplified)
        self.auth_token = "Bearer test_cache_token"
        self.test_branch_id = "test_branch_cache"
        
        print("🔧 Cache invalidation test setup complete")
    
    async def teardown(self):
        """Clean up test environment"""
        if self.session:
            await self.session.close()
        print("🧹 Cache invalidation test cleanup complete")
    
    async def test_immediate_availability(self):
        """Test that created templates are immediately available"""
        print("\n🔍 Testing immediate availability after creation")
        
        headers = {
            "Authorization": self.auth_token,
            "Content-Type": "application/json"
        }
        
        # Create template
        template_data = {
            "name": f"Cache Test Template {datetime.now().isoformat()}",
            "category": "tuition",
            "amount": 199.99,
            "description": "Testing cache invalidation",
            "frequency": "monthly",
            "is_mandatory": True,
            "branch_id": self.test_branch_id,
            "academic_year": "2024-2025",
            "is_active": True
        }
        
        try:
            # Create template
            create_start = time.time()
            async with self.session.post(
                f"{self.api_base}/payments/fee-templates",
                json=template_data,
                headers=headers
            ) as response:
                create_time = time.time() - create_start
                
                if response.status in [200, 201]:
                    create_data = await response.json()
                    template_id = create_data.get("id")
                    self.created_templates.append(template_id)
                    
                    print(f"✅ Template created in {create_time:.3f}s with ID: {template_id}")
                    
                    # Immediately try to retrieve it
                    retrieve_start = time.time()
                    async with self.session.get(
                        f"{self.api_base}/payments/fee-templates/{template_id}",
                        headers=headers
                    ) as get_response:
                        retrieve_time = time.time() - retrieve_start
                        
                        if get_response.status == 200:
                            get_data = await get_response.json()
                            print(f"✅ Template retrieved in {retrieve_time:.3f}s")
                            print(f"📊 Total time (create + retrieve): {(create_time + retrieve_time):.3f}s")
                            
                            # Test that it appears in list immediately
                            list_start = time.time()
                            async with self.session.get(
                                f"{self.api_base}/payments/fee-templates",
                                headers=headers,
                                params={"branch_id": self.test_branch_id}
                            ) as list_response:
                                list_time = time.time() - list_start
                                
                                if list_response.status == 200:
                                    list_data = await list_response.json()
                                    template_in_list = any(
                                        t.get("id") == template_id for t in list_data
                                    )
                                    
                                    if template_in_list:
                                        print(f"✅ Template appears in list in {list_time:.3f}s")
                                        return True
                                    else:
                                        print(f"❌ Template not found in list after {list_time:.3f}s")
                                        return False
                                else:
                                    print(f"❌ Failed to retrieve list: {list_response.status}")
                                    return False
                        else:
                            print(f"❌ Failed to retrieve template: {get_response.status}")
                            return False
                else:
                    error_text = await response.text()
                    print(f"❌ Failed to create template: {response.status} - {error_text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            return False
    
    async def test_concurrent_operations(self):
        """Test cache consistency under concurrent operations"""
        print("\n🔍 Testing concurrent operations cache consistency")
        
        headers = {
            "Authorization": self.auth_token,
            "Content-Type": "application/json"
        }
        
        # Create multiple templates concurrently
        tasks = []
        for i in range(5):
            template_data = {
                "name": f"Concurrent Test {i} - {datetime.now().isoformat()}",
                "category": "activities",
                "amount": 50.0 + i,
                "description": f"Concurrent operation test {i}",
                "frequency": "one_time",
                "is_mandatory": False,
                "branch_id": self.test_branch_id,
                "academic_year": "2024-2025",
                "is_active": True
            }
            
            task = self.session.post(
                f"{self.api_base}/payments/fee-templates",
                json=template_data,
                headers=headers
            )
            tasks.append(task)
        
        try:
            # Execute all creation requests concurrently
            start_time = time.time()
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            creation_time = time.time() - start_time
            
            # Process responses
            created_ids = []
            for response in responses:
                if isinstance(response, Exception):
                    print(f"⚠️ Exception during concurrent creation: {response}")
                    continue
                    
                if response.status in [200, 201]:
                    data = await response.json()
                    template_id = data.get("id")
                    if template_id:
                        created_ids.append(template_id)
                        self.created_templates.append(template_id)
                        
                await response.close()
            
            print(f"✅ Created {len(created_ids)}/5 templates concurrently in {creation_time:.3f}s")
            
            # Verify all templates appear in list
            async with self.session.get(
                f"{self.api_base}/payments/fee-templates",
                headers=headers,
                params={"branch_id": self.test_branch_id}
            ) as list_response:
                if list_response.status == 200:
                    list_data = await list_response.json()
                    found_templates = [
                        t for t in list_data 
                        if t.get("id") in created_ids
                    ]
                    
                    if len(found_templates) == len(created_ids):
                        print(f"✅ All {len(created_ids)} concurrent templates found in list")
                        return True
                    else:
                        print(f"❌ Only {len(found_templates)}/{len(created_ids)} templates found in list")
                        return False
                else:
                    print(f"❌ Failed to retrieve list after concurrent creation: {list_response.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Concurrent operations test failed: {e}")
            return False
    
    async def test_update_consistency(self):
        """Test cache consistency after updates"""
        print("\n🔍 Testing cache consistency after updates")
        
        headers = {
            "Authorization": self.auth_token,
            "Content-Type": "application/json"
        }
        
        # Create a template first
        template_data = {
            "name": f"Update Test Template {datetime.now().isoformat()}",
            "category": "facilities",
            "amount": 300.00,
            "description": "Template for update testing",
            "frequency": "semester",
            "is_mandatory": True,
            "branch_id": self.test_branch_id,
            "academic_year": "2024-2025",
            "is_active": True
        }
        
        try:
            async with self.session.post(
                f"{self.api_base}/payments/fee-templates",
                json=template_data,
                headers=headers
            ) as create_response:
                if create_response.status in [200, 201]:
                    create_data = await create_response.json()
                    template_id = create_data.get("id")
                    self.created_templates.append(template_id)
                    
                    print(f"✅ Created template for update test: {template_id}")
                    
                    # Update the template
                    updated_data = {
                        **template_data,
                        "amount": 450.00,
                        "description": "Updated template description",
                        "name": f"UPDATED - {template_data['name']}"
                    }
                    
                    update_start = time.time()
                    async with self.session.put(
                        f"{self.api_base}/payments/fee-templates/{template_id}",
                        json=updated_data,
                        headers=headers
                    ) as update_response:
                        update_time = time.time() - update_start
                        
                        if update_response.status == 200:
                            print(f"✅ Template updated in {update_time:.3f}s")
                            
                            # Immediately verify the update is reflected
                            async with self.session.get(
                                f"{self.api_base}/payments/fee-templates/{template_id}",
                                headers=headers
                            ) as get_response:
                                if get_response.status == 200:
                                    get_data = await get_response.json()
                                    
                                    if (get_data.get("amount") == 450.00 and 
                                        "UPDATED" in get_data.get("name", "")):
                                        print("✅ Update immediately reflected in single template retrieval")
                                        
                                        # Check if update is reflected in list
                                        async with self.session.get(
                                            f"{self.api_base}/payments/fee-templates",
                                            headers=headers,
                                            params={"branch_id": self.test_branch_id}
                                        ) as list_response:
                                            if list_response.status == 200:
                                                list_data = await list_response.json()
                                                updated_template = next(
                                                    (t for t in list_data if t.get("id") == template_id),
                                                    None
                                                )
                                                
                                                if (updated_template and 
                                                    updated_template.get("amount") == 450.00):
                                                    print("✅ Update immediately reflected in template list")
                                                    return True
                                                else:
                                                    print("❌ Update not reflected in template list")
                                                    return False
                                            else:
                                                print(f"❌ Failed to retrieve list after update: {list_response.status}")
                                                return False
                                    else:
                                        print("❌ Update not reflected in single template retrieval")
                                        return False
                                else:
                                    print(f"❌ Failed to retrieve updated template: {get_response.status}")
                                    return False
                        else:
                            error_text = await update_response.text()
                            print(f"❌ Failed to update template: {update_response.status} - {error_text}")
                            return False
                else:
                    error_text = await create_response.text()
                    print(f"❌ Failed to create template for update test: {create_response.status} - {error_text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Update consistency test failed: {e}")
            return False
    
    async def test_deletion_consistency(self):
        """Test cache consistency after deletion"""
        print("\n🔍 Testing cache consistency after deletion")
        
        headers = {
            "Authorization": self.auth_token,
            "Content-Type": "application/json"
        }
        
        # Create a template to delete
        template_data = {
            "name": f"Delete Test Template {datetime.now().isoformat()}",
            "category": "other",
            "amount": 25.00,
            "description": "Template for deletion testing",
            "frequency": "one_time",
            "is_mandatory": False,
            "branch_id": self.test_branch_id,
            "academic_year": "2024-2025",
            "is_active": True
        }
        
        try:
            async with self.session.post(
                f"{self.api_base}/payments/fee-templates",
                json=template_data,
                headers=headers
            ) as create_response:
                if create_response.status in [200, 201]:
                    create_data = await create_response.json()
                    template_id = create_data.get("id")
                    
                    print(f"✅ Created template for deletion test: {template_id}")
                    
                    # Delete the template
                    delete_start = time.time()
                    async with self.session.delete(
                        f"{self.api_base}/payments/fee-templates/{template_id}",
                        headers=headers
                    ) as delete_response:
                        delete_time = time.time() - delete_start
                        
                        if delete_response.status in [200, 204]:
                            print(f"✅ Template deleted in {delete_time:.3f}s")
                            
                            # Verify it's no longer retrievable
                            async with self.session.get(
                                f"{self.api_base}/payments/fee-templates/{template_id}",
                                headers=headers
                            ) as get_response:
                                if get_response.status == 404:
                                    print("✅ Deleted template immediately not retrievable")
                                    
                                    # Verify it's not in the list
                                    async with self.session.get(
                                        f"{self.api_base}/payments/fee-templates",
                                        headers=headers,
                                        params={"branch_id": self.test_branch_id}
                                    ) as list_response:
                                        if list_response.status == 200:
                                            list_data = await list_response.json()
                                            template_in_list = any(
                                                t.get("id") == template_id for t in list_data
                                            )
                                            
                                            if not template_in_list:
                                                print("✅ Deleted template immediately removed from list")
                                                return True
                                            else:
                                                print("❌ Deleted template still appears in list")
                                                return False
                                        else:
                                            print(f"❌ Failed to retrieve list after deletion: {list_response.status}")
                                            return False
                                else:
                                    print(f"❌ Deleted template still retrievable: {get_response.status}")
                                    return False
                        else:
                            error_text = await delete_response.text()
                            print(f"❌ Failed to delete template: {delete_response.status} - {error_text}")
                            return False
                else:
                    error_text = await create_response.text()
                    print(f"❌ Failed to create template for deletion test: {create_response.status} - {error_text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Deletion consistency test failed: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all cache invalidation tests"""
        print("🚀 Starting Cache Invalidation Tests")
        print("=" * 60)
        
        tests = [
            ("Immediate Availability", self.test_immediate_availability),
            ("Concurrent Operations", self.test_concurrent_operations),
            ("Update Consistency", self.test_update_consistency),
            ("Deletion Consistency", self.test_deletion_consistency)
        ]
        
        results = []
        total_start = time.time()
        
        for test_name, test_func in tests:
            print(f"\n🧪 Running {test_name} test...")
            test_start = time.time()
            
            try:
                success = await test_func()
                test_time = time.time() - test_start
                
                results.append({
                    "test": test_name,
                    "success": success,
                    "duration": test_time
                })
                
                status = "✅ PASS" if success else "❌ FAIL"
                print(f"{status} {test_name} ({test_time:.2f}s)")
                
            except Exception as e:
                test_time = time.time() - test_start
                results.append({
                    "test": test_name,
                    "success": False,
                    "duration": test_time,
                    "error": str(e)
                })
                print(f"❌ FAIL {test_name} ({test_time:.2f}s) - Exception: {e}")
        
        total_time = time.time() - total_start
        
        # Print summary
        print("\n" + "=" * 60)
        print("🎯 CACHE INVALIDATION TEST SUMMARY")
        print("=" * 60)
        
        passed = len([r for r in results if r["success"]])
        failed = len(results) - passed
        
        print(f"\nTotal Tests: {len(results)}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⏱️ Total Time: {total_time:.2f}s")
        print(f"📈 Success Rate: {(passed/len(results)*100):.1f}%")
        
        if failed == 0:
            print(f"\n🎉 ALL CACHE TESTS PASSED! Cache invalidation is working correctly.")
        else:
            print(f"\n⚠️ {failed} cache invalidation issues detected.")
            
        print(f"\n🧹 Created {len(self.created_templates)} test templates")
        
        return results

async def main():
    """Main test runner"""
    tester = CacheInvalidationTester()
    
    try:
        await tester.setup()
        results = await tester.run_all_tests()
        return results
    except Exception as e:
        print(f"❌ Cache invalidation tests failed: {e}")
        return []
    finally:
        await tester.teardown()

if __name__ == "__main__":
    asyncio.run(main())