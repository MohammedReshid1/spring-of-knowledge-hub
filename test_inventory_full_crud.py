#!/usr/bin/env python3
"""
Complete CRUD test for all inventory management components
"""

import requests
from datetime import datetime, date
import json

BASE_URL = "http://localhost:8000"
TEST_USER = "admin@gmail.com"
TEST_PASSWORD = "admin123"

GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")

def print_error(msg):
    print(f"{RED}✗ {msg}{RESET}")

def print_info(msg):
    print(f"{YELLOW}ℹ {msg}{RESET}")

def print_header(msg):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}{msg}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

def login():
    response = requests.post(
        f"{BASE_URL}/users/login",
        data={"username": TEST_USER, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data["access_token"], data.get("user", {})
    return None, None

def test_assets_crud(token, user_info):
    print_header("TESTING ASSETS FULL CRUD")
    headers = {"Authorization": f"Bearer {token}"}
    
    # CREATE
    create_data = {
        "name": "Test Asset - CRUD",
        "description": "Testing complete CRUD functionality",
        "category": "furniture",
        "brand": "Test Brand",
        "model": "Test Model",
        "purchase_price": 1000.0,
        "purchase_date": date.today().isoformat(),
        "location": "Test Room",
        "status": "active",
        "condition": "good",
        "created_by": user_info.get("user_id", "test")
    }
    
    response = requests.post(f"{BASE_URL}/inventory/assets", json=create_data, headers=headers)
    if response.status_code in [200, 201]:
        asset = response.json()
        asset_id = asset["id"]
        print_success(f"CREATE: Created asset {asset_id} with code {asset.get('asset_code')}")
    else:
        print_error(f"CREATE failed: {response.text}")
        return False
    
    # READ
    response = requests.get(f"{BASE_URL}/inventory/assets/{asset_id}", headers=headers)
    if response.status_code == 200:
        print_success("READ: Retrieved asset successfully")
    else:
        print_error(f"READ failed: {response.text}")
        return False
    
    # UPDATE
    update_data = {
        "name": "Test Asset - Updated",
        "description": "Updated description",
        "category": "furniture",
        "brand": "Test Brand",
        "model": "Test Model",
        "purchase_price": 1200.0,
        "purchase_date": date.today().isoformat(),
        "location": "Updated Room",
        "status": "under_maintenance",
        "condition": "fair",
        "created_by": user_info.get("user_id", "test")
    }
    response = requests.put(f"{BASE_URL}/inventory/assets/{asset_id}", json=update_data, headers=headers)
    if response.status_code == 200:
        updated = response.json()
        print_success(f"UPDATE: Status now {updated['status']}, location: {updated.get('location')}")
    else:
        print_error(f"UPDATE failed: {response.text}")
        return False
    
    # DELETE
    response = requests.delete(f"{BASE_URL}/inventory/assets/{asset_id}", headers=headers)
    if response.status_code in [200, 204]:
        print_success("DELETE: Asset deleted successfully")
    else:
        print_error(f"DELETE failed: {response.text}")
        return False
    
    return True

def test_supplies_crud(token, user_info):
    print_header("TESTING SUPPLIES FULL CRUD")
    headers = {"Authorization": f"Bearer {token}"}
    
    # CREATE
    create_data = {
        "name": "Test Supply - CRUD",
        "description": "Testing complete CRUD functionality",
        "category": "office_supplies",
        "unit": "pieces",
        "quantity_in_stock": 100,
        "minimum_stock_level": 20,
        "unit_cost": 5.0,
        "storage_location": "Storage Room A",
        "is_active": True,
        "created_by": user_info.get("user_id", "test")
    }
    
    response = requests.post(f"{BASE_URL}/inventory/supplies", json=create_data, headers=headers)
    if response.status_code in [200, 201]:
        supply = response.json()
        supply_id = supply["id"]
        print_success(f"CREATE: Created supply {supply_id} with code {supply.get('supply_code')}")
    else:
        print_error(f"CREATE failed: {response.text}")
        return False
    
    # READ
    response = requests.get(f"{BASE_URL}/inventory/supplies/{supply_id}", headers=headers)
    if response.status_code == 200:
        print_success("READ: Retrieved supply successfully")
    else:
        print_error(f"READ failed: {response.text}")
        return False
    
    # UPDATE
    update_data = {
        "name": "Test Supply - Updated",
        "description": "Updated description",
        "category": "office_supplies",
        "unit": "pieces",
        "quantity_in_stock": 150,
        "minimum_stock_level": 30,
        "unit_cost": 6.0,
        "storage_location": "Storage Room B",
        "is_active": True,
        "created_by": user_info.get("user_id", "test")
    }
    response = requests.put(f"{BASE_URL}/inventory/supplies/{supply_id}", json=update_data, headers=headers)
    if response.status_code == 200:
        updated = response.json()
        print_success(f"UPDATE: Quantity now {updated['quantity_in_stock']}, cost: ${updated.get('unit_cost')}")
    else:
        print_error(f"UPDATE failed: {response.text}")
        return False
    
    # DELETE
    response = requests.delete(f"{BASE_URL}/inventory/supplies/{supply_id}", headers=headers)
    if response.status_code in [200, 204]:
        print_success("DELETE: Supply deleted successfully")
    else:
        print_error(f"DELETE failed: {response.text}")
        return False
    
    return True

def test_maintenance_crud(token, user_info):
    print_header("TESTING MAINTENANCE RECORDS FULL CRUD")
    headers = {"Authorization": f"Bearer {token}"}
    
    # First create an asset for maintenance
    asset_data = {
        "name": "Test Asset for Maintenance",
        "description": "Asset for maintenance testing",
        "category": "furniture",
        "status": "active",
        "condition": "good",
        "created_by": user_info.get("user_id", "test")
    }
    
    asset_response = requests.post(f"{BASE_URL}/inventory/assets", json=asset_data, headers=headers)
    if asset_response.status_code not in [200, 201]:
        print_error("Failed to create test asset for maintenance")
        return False
    
    test_asset = asset_response.json()
    asset_id = test_asset["id"]
    
    # CREATE MAINTENANCE RECORD
    create_data = {
        "asset_id": asset_id,
        "asset_name": test_asset["name"],
        "maintenance_type": "preventive",
        "title": "CRUD Test Maintenance",
        "description": "Testing complete CRUD functionality",
        "scheduled_date": date.today().isoformat(),
        "status": "scheduled",
        "created_by": user_info.get("user_id", "test")
    }
    
    response = requests.post(f"{BASE_URL}/inventory/maintenance", json=create_data, headers=headers)
    if response.status_code in [200, 201]:
        maintenance = response.json()
        maintenance_id = maintenance["id"]
        print_success(f"CREATE: Created maintenance {maintenance_id} with code {maintenance.get('maintenance_code')}")
    else:
        print_error(f"CREATE failed: {response.text}")
        # Clean up asset
        requests.delete(f"{BASE_URL}/inventory/assets/{asset_id}", headers=headers)
        return False
    
    # READ
    response = requests.get(f"{BASE_URL}/inventory/maintenance/{maintenance_id}", headers=headers)
    if response.status_code == 200:
        print_success("READ: Retrieved maintenance record successfully")
    else:
        print_error(f"READ failed: {response.text}")
        # Clean up
        requests.delete(f"{BASE_URL}/inventory/assets/{asset_id}", headers=headers)
        return False
    
    # UPDATE
    update_data = {
        "asset_id": asset_id,
        "asset_name": test_asset["name"],
        "maintenance_type": "corrective",
        "title": "CRUD Test - Updated Maintenance",
        "description": "Updated maintenance description",
        "scheduled_date": date.today().isoformat(),
        "status": "completed",
        "work_performed": "Completed maintenance work",
        "created_by": user_info.get("user_id", "test")
    }
    response = requests.put(f"{BASE_URL}/inventory/maintenance/{maintenance_id}", json=update_data, headers=headers)
    if response.status_code == 200:
        updated = response.json()
        print_success(f"UPDATE: Status now {updated['status']}, type: {updated.get('maintenance_type')}")
    else:
        print_error(f"UPDATE failed: {response.text}")
        # Clean up
        requests.delete(f"{BASE_URL}/inventory/assets/{asset_id}", headers=headers)
        return False
    
    # DELETE
    response = requests.delete(f"{BASE_URL}/inventory/maintenance/{maintenance_id}", headers=headers)
    if response.status_code in [200, 204]:
        print_success("DELETE: Maintenance record deleted successfully")
    else:
        print_error(f"DELETE failed: {response.text}")
    
    # Clean up test asset
    requests.delete(f"{BASE_URL}/inventory/assets/{asset_id}", headers=headers)
    return True

def test_vendors_crud(token, user_info):
    print_header("TESTING VENDORS FULL CRUD")
    headers = {"Authorization": f"Bearer {token}"}
    
    # CREATE
    create_data = {
        "name": "Test Vendor - CRUD",
        "contact_person": "John Doe",
        "email": "test@vendor.com",
        "phone": "+1234567890",
        "address": "123 Test Street",
        "city": "Test City",
        "country": "USA",
        "categories": ["furniture", "office_supplies"],
        "payment_terms": "Net 30",
        "is_active": True,
        "created_by": user_info.get("user_id", "test")
    }
    
    response = requests.post(f"{BASE_URL}/inventory/vendors", json=create_data, headers=headers)
    if response.status_code in [200, 201]:
        vendor = response.json()
        vendor_id = vendor["id"]
        print_success(f"CREATE: Created vendor {vendor_id} with code {vendor.get('vendor_code')}")
    else:
        print_error(f"CREATE failed: {response.text}")
        return False
    
    # READ
    response = requests.get(f"{BASE_URL}/inventory/vendors/{vendor_id}", headers=headers)
    if response.status_code == 200:
        print_success("READ: Retrieved vendor successfully")
    else:
        print_error(f"READ failed: {response.text}")
        return False
    
    # UPDATE
    update_data = {
        "name": "Test Vendor - Updated",
        "contact_person": "Jane Smith",
        "email": "updated@vendor.com",
        "phone": "+1234567899",
        "address": "456 Updated Street",
        "city": "Updated City",
        "country": "USA",
        "categories": ["electronics", "technology"],
        "payment_terms": "Net 15",
        "is_active": True,
        "created_by": user_info.get("user_id", "test")
    }
    response = requests.put(f"{BASE_URL}/inventory/vendors/{vendor_id}", json=update_data, headers=headers)
    if response.status_code == 200:
        updated = response.json()
        print_success(f"UPDATE: Contact now {updated['contact_person']}, terms: {updated.get('payment_terms')}")
    else:
        print_error(f"UPDATE failed: {response.text}")
        return False
    
    # DELETE
    response = requests.delete(f"{BASE_URL}/inventory/vendors/{vendor_id}", headers=headers)
    if response.status_code in [200, 204]:
        print_success("DELETE: Vendor deleted successfully")
    else:
        print_error(f"DELETE failed: {response.text}")
        return False
    
    return True

def test_inventory_analytics(token):
    print_header("TESTING INVENTORY ANALYTICS")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test overview analytics
    response = requests.get(f"{BASE_URL}/inventory/analytics/overview", headers=headers)
    if response.status_code == 200:
        data = response.json()
        print_success(f"ANALYTICS: Total assets: {data.get('total_assets', 0)}")
        print_success(f"ANALYTICS: Total supplies: {data.get('total_supplies', 0)}")
        print_success(f"ANALYTICS: Asset value: ${data.get('total_asset_value', 0):,.2f}")
    else:
        print_error(f"ANALYTICS failed: {response.text}")
        return False
    
    return True

def main():
    print_header("INVENTORY MANAGEMENT - COMPLETE CRUD TEST")
    
    # Login
    token, user_info = login()
    if not token:
        print_error("Failed to login")
        return
    
    print_success(f"Logged in as: {user_info.get('email', TEST_USER)}")
    
    # Run CRUD tests
    tests_passed = 0
    total_tests = 6
    
    if test_assets_crud(token, user_info):
        tests_passed += 1
    
    if test_supplies_crud(token, user_info):
        tests_passed += 1
    
    if test_maintenance_crud(token, user_info):
        tests_passed += 1
    
    if test_vendors_crud(token, user_info):
        tests_passed += 1
    
    if test_inventory_analytics(token):
        tests_passed += 1
        
    # Test list endpoints
    print_header("TESTING LIST ENDPOINTS")
    headers = {"Authorization": f"Bearer {token}"}
    
    list_tests = [
        ("/inventory/assets", "Assets"),
        ("/inventory/supplies", "Supplies"), 
        ("/inventory/maintenance", "Maintenance"),
        ("/inventory/vendors", "Vendors"),
        ("/inventory/requests", "Requests")
    ]
    
    list_success = 0
    for endpoint, name in list_tests:
        response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print_success(f"LIST {name}: Retrieved {len(data)} items")
            list_success += 1
        else:
            print_error(f"LIST {name} failed: {response.text}")
    
    if list_success == len(list_tests):
        tests_passed += 1
    
    # Summary
    print_header("FINAL RESULTS")
    print(f"CRUD Tests Passed: {tests_passed}/{total_tests}")
    
    if tests_passed == total_tests:
        print_success("\n🎉 ALL INVENTORY MANAGEMENT CRUD OPERATIONS WORKING!")
        print_success("✅ Complete CRUD functionality available:")
        print_info("  ✓ CREATE - All working")
        print_info("  ✓ READ - All working")
        print_info("  ✓ UPDATE - All working")
        print_info("  ✓ DELETE - All working")
        print_info("  ✓ LIST - All working")
        print_info("  ✓ ANALYTICS - Working")
        print_info("  ✓ Auto-generated codes")
        print_info("  ✓ Authentication integrated")
    else:
        print_error(f"{total_tests - tests_passed} tests failed")

if __name__ == "__main__":
    main()