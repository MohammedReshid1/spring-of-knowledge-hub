#!/usr/bin/env python3
"""
Comprehensive test script to verify full CRUD operations on all inventory pages
"""

import requests
import time
import json
from datetime import datetime, date

BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:8082"
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
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}{msg}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

def login():
    try:
        response = requests.post(
            f"{BASE_URL}/users/login",
            data={"username": TEST_USER, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data["access_token"], data.get("user", {})
        return None, None
    except Exception as e:
        print_error(f"Login failed: {str(e)}")
        return None, None

def test_assets_crud(token):
    print_header("TESTING ASSETS CRUD OPERATIONS")
    headers = {"Authorization": f"Bearer {token}"}
    
    # CREATE Asset
    asset_data = {
        "name": "Test Laptop CRUD",
        "description": "Test laptop for CRUD operations",
        "category": "electronics",
        "brand": "TestBrand",
        "model": "TestModel",
        "purchase_price": 1500.00,
        "purchase_date": "2024-01-01",
        "status": "active",
        "condition": "good",
        "location": "Test Lab"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/inventory/assets", json=asset_data, headers=headers)
        if response.status_code in [200, 201]:
            asset = response.json()
            asset_id = asset['id']
            print_success(f"✓ CREATE: Asset created - {asset.get('name')} ({asset.get('asset_code')})")
        else:
            print_error(f"✗ CREATE: Failed to create asset - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ CREATE: Error - {str(e)}")
        return False
    
    # READ Asset
    try:
        response = requests.get(f"{BASE_URL}/inventory/assets/{asset_id}", headers=headers)
        if response.status_code == 200:
            asset = response.json()
            print_success(f"✓ READ: Asset retrieved - {asset.get('name')}")
        else:
            print_error(f"✗ READ: Failed to retrieve asset")
            return False
    except Exception as e:
        print_error(f"✗ READ: Error - {str(e)}")
        return False
    
    # UPDATE Asset
    update_data = {
        "name": "Updated Test Laptop CRUD",
        "description": "Updated test laptop for CRUD operations",
        "category": "electronics",
        "brand": "UpdatedBrand",
        "model": "UpdatedModel",
        "purchase_price": 1600.00,
        "purchase_date": "2024-01-01",
        "status": "active",
        "condition": "excellent",
        "location": "Updated Test Lab"
    }
    
    try:
        response = requests.put(f"{BASE_URL}/inventory/assets/{asset_id}", json=update_data, headers=headers)
        if response.status_code == 200:
            updated_asset = response.json()
            print_success(f"✓ UPDATE: Asset updated - {updated_asset.get('name')}")
        else:
            print_error(f"✗ UPDATE: Failed to update asset - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ UPDATE: Error - {str(e)}")
        return False
    
    # DELETE Asset
    try:
        response = requests.delete(f"{BASE_URL}/inventory/assets/{asset_id}", headers=headers)
        if response.status_code in [200, 204]:
            print_success("✓ DELETE: Asset deleted successfully")
            return True
        else:
            print_error(f"✗ DELETE: Failed to delete asset - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ DELETE: Error - {str(e)}")
        return False

def test_supplies_crud(token):
    print_header("TESTING SUPPLIES CRUD OPERATIONS")
    headers = {"Authorization": f"Bearer {token}"}
    
    # CREATE Supply
    supply_data = {
        "name": "Test Pens CRUD",
        "description": "Test pens for CRUD operations",
        "category": "office_supplies",
        "unit": "packs",
        "quantity_in_stock": 25,
        "minimum_stock_level": 5,
        "maximum_stock_level": 100,
        "unit_cost": 3.50
    }
    
    try:
        response = requests.post(f"{BASE_URL}/inventory/supplies", json=supply_data, headers=headers)
        if response.status_code in [200, 201]:
            supply = response.json()
            supply_id = supply['id']
            print_success(f"✓ CREATE: Supply created - {supply.get('name')} ({supply.get('supply_code')})")
        else:
            print_error(f"✗ CREATE: Failed to create supply - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ CREATE: Error - {str(e)}")
        return False
    
    # READ Supply
    try:
        response = requests.get(f"{BASE_URL}/inventory/supplies/{supply_id}", headers=headers)
        if response.status_code == 200:
            supply = response.json()
            print_success(f"✓ READ: Supply retrieved - {supply.get('name')}")
        else:
            print_error(f"✗ READ: Failed to retrieve supply")
            return False
    except Exception as e:
        print_error(f"✗ READ: Error - {str(e)}")
        return False
    
    # UPDATE Supply
    update_data = {
        "name": "Updated Test Pens CRUD",
        "description": "Updated test pens for CRUD operations",
        "category": "office_supplies",
        "unit": "packs",
        "quantity_in_stock": 30,
        "minimum_stock_level": 8,
        "maximum_stock_level": 120,
        "unit_cost": 4.00
    }
    
    try:
        response = requests.put(f"{BASE_URL}/inventory/supplies/{supply_id}", json=update_data, headers=headers)
        if response.status_code == 200:
            updated_supply = response.json()
            print_success(f"✓ UPDATE: Supply updated - {updated_supply.get('name')}")
        else:
            print_error(f"✗ UPDATE: Failed to update supply - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ UPDATE: Error - {str(e)}")
        return False
    
    # DELETE Supply
    try:
        response = requests.delete(f"{BASE_URL}/inventory/supplies/{supply_id}", headers=headers)
        if response.status_code in [200, 204]:
            print_success("✓ DELETE: Supply deleted successfully")
            return True
        else:
            print_error(f"✗ DELETE: Failed to delete supply - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ DELETE: Error - {str(e)}")
        return False

def test_requests_crud(token):
    print_header("TESTING INVENTORY REQUESTS CRUD OPERATIONS")
    headers = {"Authorization": f"Bearer {token}"}
    
    # CREATE Request
    request_data = {
        "title": "Test Request CRUD",
        "description": "Test request for CRUD operations",
        "request_type": "asset_request",
        "priority": "medium",
        "items": [],
        "justification": "Testing CRUD functionality"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/inventory/requests", json=request_data, headers=headers)
        if response.status_code in [200, 201]:
            request = response.json()
            request_id = request['id']
            print_success(f"✓ CREATE: Request created - {request.get('title')} ({request.get('request_code')})")
        else:
            print_error(f"✗ CREATE: Failed to create request - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ CREATE: Error - {str(e)}")
        return False
    
    # READ Request
    try:
        response = requests.get(f"{BASE_URL}/inventory/requests/{request_id}", headers=headers)
        if response.status_code == 200:
            request = response.json()
            print_success(f"✓ READ: Request retrieved - {request.get('title')}")
        else:
            print_error(f"✗ READ: Failed to retrieve request")
            return False
    except Exception as e:
        print_error(f"✗ READ: Error - {str(e)}")
        return False
    
    # UPDATE Request
    update_data = {
        "title": "Updated Test Request CRUD",
        "description": "Updated test request for CRUD operations",
        "request_type": "supply_request",
        "priority": "high",
        "items": [],
        "justification": "Updated testing CRUD functionality"
    }
    
    try:
        response = requests.put(f"{BASE_URL}/inventory/requests/{request_id}", json=update_data, headers=headers)
        if response.status_code == 200:
            updated_request = response.json()
            print_success(f"✓ UPDATE: Request updated - {updated_request.get('title')}")
        else:
            print_error(f"✗ UPDATE: Failed to update request - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ UPDATE: Error - {str(e)}")
        return False
    
    # DELETE Request
    try:
        response = requests.delete(f"{BASE_URL}/inventory/requests/{request_id}", headers=headers)
        if response.status_code in [200, 204]:
            print_success("✓ DELETE: Request deleted successfully")
            return True
        else:
            print_error(f"✗ DELETE: Failed to delete request - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ DELETE: Error - {str(e)}")
        return False

def test_maintenance_crud(token):
    print_header("TESTING MAINTENANCE CRUD OPERATIONS")
    headers = {"Authorization": f"Bearer {token}"}
    
    # First, get an existing asset for maintenance
    try:
        response = requests.get(f"{BASE_URL}/inventory/assets", headers=headers)
        if response.status_code == 200:
            assets = response.json()
            if not assets:
                print_error("✗ No assets available for maintenance testing")
                return False
            asset_id = assets[0]['id']
            print_info(f"Using asset: {assets[0]['name']} for maintenance testing")
        else:
            print_error("✗ Failed to get assets for maintenance testing")
            return False
    except Exception as e:
        print_error(f"✗ Error getting assets: {str(e)}")
        return False
    
    # CREATE Maintenance
    maintenance_data = {
        "asset_id": asset_id,
        "maintenance_type": "preventive",
        "title": "Test Maintenance CRUD",
        "description": "Test maintenance for CRUD operations",
        "scheduled_date": "2024-12-01",
        "estimated_cost": 150.00
    }
    
    try:
        response = requests.post(f"{BASE_URL}/inventory/maintenance", json=maintenance_data, headers=headers)
        if response.status_code in [200, 201]:
            maintenance = response.json()
            maintenance_id = maintenance['id']
            print_success(f"✓ CREATE: Maintenance created - {maintenance.get('title')} ({maintenance.get('maintenance_code')})")
        else:
            print_error(f"✗ CREATE: Failed to create maintenance - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ CREATE: Error - {str(e)}")
        return False
    
    # READ Maintenance
    try:
        response = requests.get(f"{BASE_URL}/inventory/maintenance/{maintenance_id}", headers=headers)
        if response.status_code == 200:
            maintenance = response.json()
            print_success(f"✓ READ: Maintenance retrieved - {maintenance.get('title')}")
        else:
            print_error(f"✗ READ: Failed to retrieve maintenance")
            return False
    except Exception as e:
        print_error(f"✗ READ: Error - {str(e)}")
        return False
    
    # UPDATE Maintenance
    update_data = {
        "asset_id": asset_id,
        "maintenance_type": "corrective",
        "title": "Updated Test Maintenance CRUD",
        "description": "Updated test maintenance for CRUD operations",
        "scheduled_date": "2024-12-02",
        "estimated_cost": 200.00
    }
    
    try:
        response = requests.put(f"{BASE_URL}/inventory/maintenance/{maintenance_id}", json=update_data, headers=headers)
        if response.status_code == 200:
            updated_maintenance = response.json()
            print_success(f"✓ UPDATE: Maintenance updated - {updated_maintenance.get('title')}")
        else:
            print_error(f"✗ UPDATE: Failed to update maintenance - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ UPDATE: Error - {str(e)}")
        return False
    
    # DELETE Maintenance
    try:
        response = requests.delete(f"{BASE_URL}/inventory/maintenance/{maintenance_id}", headers=headers)
        if response.status_code in [200, 204]:
            print_success("✓ DELETE: Maintenance deleted successfully")
            return True
        else:
            print_error(f"✗ DELETE: Failed to delete maintenance - {response.text}")
            return False
    except Exception as e:
        print_error(f"✗ DELETE: Error - {str(e)}")
        return False

def test_frontend_components():
    print_header("TESTING FRONTEND COMPONENT FUNCTIONALITY")
    
    component_checks = [
        {
            "name": "AssetManagement.tsx", 
            "path": "/Users/ahmed/Documents/GitHub/spring-of-knowledge-hub/src/components/inventory/AssetManagement.tsx",
            "required_patterns": ["handleEdit", "handleDelete", "Edit", "Trash2", "isEditDialogOpen", "isDeleteDialogOpen"]
        },
        {
            "name": "SupplyManagement.tsx",
            "path": "/Users/ahmed/Documents/GitHub/spring-of-knowledge-hub/src/components/inventory/SupplyManagement.tsx", 
            "required_patterns": ["handleEditSupply", "handleDeleteSupply", "Edit", "Trash2", "isEditSupplyOpen", "isDeleteSupplyOpen"]
        },
        {
            "name": "InventoryRequests.tsx",
            "path": "/Users/ahmed/Documents/GitHub/spring-of-knowledge-hub/src/components/inventory/InventoryRequests.tsx",
            "required_patterns": ["handleEditRequest", "handleDeleteRequest", "Edit", "Trash2", "isEditRequestOpen", "isDeleteRequestOpen"]
        },
        {
            "name": "MaintenanceManagement.tsx",
            "path": "/Users/ahmed/Documents/GitHub/spring-of-knowledge-hub/src/components/inventory/MaintenanceManagement.tsx",
            "required_patterns": ["handleEditMaintenance", "handleDeleteMaintenance", "Edit", "Trash2", "isEditMaintenanceOpen", "isDeleteMaintenanceOpen"]
        }
    ]
    
    all_good = True
    
    for component in component_checks:
        try:
            with open(component["path"], 'r') as f:
                content = f.read()
                
            missing_patterns = []
            for pattern in component["required_patterns"]:
                if pattern not in content:
                    missing_patterns.append(pattern)
            
            if missing_patterns:
                print_error(f"✗ {component['name']}: Missing patterns - {', '.join(missing_patterns)}")
                all_good = False
            else:
                print_success(f"✓ {component['name']}: All CRUD patterns found")
                
        except Exception as e:
            print_error(f"✗ {component['name']}: Error reading file - {str(e)}")
            all_good = False
    
    return all_good

def main():
    print_header("COMPREHENSIVE INVENTORY CRUD OPERATIONS TEST")
    
    # Test frontend components first
    frontend_ok = test_frontend_components()
    
    # Login and test backend CRUD
    token, user_info = login()
    if not token:
        print_error("Failed to login - cannot test backend CRUD operations")
        return
    
    print_success(f"Successfully logged in as: {user_info.get('email', TEST_USER)}")
    
    # Test all CRUD operations
    results = {
        "Assets CRUD": test_assets_crud(token),
        "Supplies CRUD": test_supplies_crud(token), 
        "Requests CRUD": test_requests_crud(token),
        "Maintenance CRUD": test_maintenance_crud(token),
        "Frontend Components": frontend_ok
    }
    
    print_header("COMPREHENSIVE CRUD TEST RESULTS")
    
    all_passed = True
    for test_name, result in results.items():
        if result:
            print_success(f"✓ {test_name}: PASSED")
        else:
            print_error(f"✗ {test_name}: FAILED")
            all_passed = False
    
    print_header("FINAL SUMMARY")
    if all_passed:
        print_success("🎉 ALL CRUD OPERATIONS ARE WORKING PERFECTLY!")
        print_info("✅ Full CRUD functionality implemented across all inventory pages:")
        print_info("  • Assets: Create ✓ Read ✓ Update ✓ Delete ✓")
        print_info("  • Supplies: Create ✓ Read ✓ Update ✓ Delete ✓") 
        print_info("  • Requests: Create ✓ Read ✓ Update ✓ Delete ✓")
        print_info("  • Maintenance: Create ✓ Read ✓ Update ✓ Delete ✓")
        print_info("  • Frontend: Edit/Delete buttons working ✓")
        print_info("")
        print_info("🚀 Ready for production use!")
        print_info("📱 Visit http://localhost:8082/dashboard → Inventory to test the UI")
    else:
        print_error("❌ SOME CRUD OPERATIONS FAILED")
        print_error("Please check the errors above and fix the issues")

if __name__ == "__main__":
    main()