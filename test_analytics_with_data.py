#!/usr/bin/env python3
"""
Test analytics with sample data creation
"""

import requests
import time
from datetime import datetime, date, timedelta
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

def create_sample_assets(token):
    print_header("CREATING SAMPLE ASSETS FOR ANALYTICS")
    headers = {"Authorization": f"Bearer {token}"}
    
    sample_assets = [
        {
            "name": "MacBook Pro 2023",
            "description": "High-performance laptop for design work",
            "category": "electronics",
            "brand": "Apple",
            "model": "MacBook Pro",
            "purchase_price": 2500.0,
            "purchase_date": (date.today() - timedelta(days=30)).isoformat(),
            "status": "active",
            "condition": "excellent",
            "location": "Design Lab"
        },
        {
            "name": "Classroom Projector",
            "description": "4K projector for presentations",
            "category": "electronics",
            "brand": "Epson",
            "model": "Pro Cinema 4050",
            "purchase_price": 1800.0,
            "purchase_date": (date.today() - timedelta(days=120)).isoformat(),
            "status": "active",
            "condition": "good",
            "location": "Room 101"
        },
        {
            "name": "Student Desk Set",
            "description": "Ergonomic desk and chair set",
            "category": "furniture",
            "brand": "IKEA",
            "model": "BEKANT",
            "purchase_price": 300.0,
            "purchase_date": (date.today() - timedelta(days=200)).isoformat(),
            "status": "active",
            "condition": "good",
            "location": "Classroom A"
        },
        {
            "name": "Chemistry Equipment Set",
            "description": "Laboratory equipment for chemistry experiments",
            "category": "laboratory",
            "brand": "LabCorp",
            "model": "Standard Set",
            "purchase_price": 1500.0,
            "purchase_date": (date.today() - timedelta(days=60)).isoformat(),
            "status": "under_maintenance",
            "condition": "fair",
            "location": "Science Lab"
        },
        {
            "name": "Basketball Court Equipment",
            "description": "Hoops, balls, and court maintenance tools",
            "category": "sports_equipment",
            "brand": "Spalding",
            "model": "Professional Set",
            "purchase_price": 800.0,
            "purchase_date": (date.today() - timedelta(days=90)).isoformat(),
            "status": "active",
            "condition": "good",
            "location": "Gymnasium"
        },
        {
            "name": "Broken Printer",
            "description": "Office printer requiring repair",
            "category": "office_supplies",
            "brand": "HP",
            "model": "LaserJet Pro",
            "purchase_price": 400.0,
            "purchase_date": (date.today() - timedelta(days=400)).isoformat(),
            "status": "damaged",
            "condition": "broken",
            "location": "Office"
        }
    ]
    
    created_assets = []
    for i, asset_data in enumerate(sample_assets):
        try:
            response = requests.post(f"{BASE_URL}/inventory/assets", json=asset_data, headers=headers)
            if response.status_code in [200, 201]:
                asset = response.json()
                created_assets.append(asset)
                print_success(f"Created asset {i+1}: {asset.get('name')} ({asset.get('asset_code')})")
            else:
                print_error(f"Failed to create asset {i+1}: {response.text}")
        except Exception as e:
            print_error(f"Error creating asset {i+1}: {str(e)}")
    
    return created_assets

def create_sample_supplies(token):
    print_header("CREATING SAMPLE SUPPLIES FOR ANALYTICS")
    headers = {"Authorization": f"Bearer {token}"}
    
    sample_supplies = [
        {
            "name": "A4 Paper",
            "description": "White printer paper",
            "category": "office_supplies",
            "unit": "packs",
            "current_stock": 15,
            "minimum_stock": 10,
            "maximum_stock": 50,
            "unit_cost": 5.99
        },
        {
            "name": "Whiteboard Markers",
            "description": "Dry erase markers - assorted colors",
            "category": "teaching_materials",
            "unit": "packs",
            "current_stock": 3,
            "minimum_stock": 5,
            "maximum_stock": 20,
            "unit_cost": 8.50
        },
        {
            "name": "Cleaning Spray",
            "description": "Multi-surface cleaner",
            "category": "cleaning_supplies",
            "unit": "bottles",
            "current_stock": 8,
            "minimum_stock": 3,
            "maximum_stock": 15,
            "unit_cost": 4.25
        },
        {
            "name": "Lab Beakers",
            "description": "250ml glass beakers",
            "category": "laboratory",
            "unit": "pieces",
            "current_stock": 2,
            "minimum_stock": 10,
            "maximum_stock": 30,
            "unit_cost": 12.00
        }
    ]
    
    created_supplies = []
    for i, supply_data in enumerate(sample_supplies):
        try:
            response = requests.post(f"{BASE_URL}/inventory/supplies", json=supply_data, headers=headers)
            if response.status_code in [200, 201]:
                supply = response.json()
                created_supplies.append(supply)
                stock_status = "LOW" if supply_data["current_stock"] <= supply_data["minimum_stock"] else "OK"
                print_success(f"Created supply {i+1}: {supply.get('name')} ({supply.get('supply_code')}) - Stock: {stock_status}")
            else:
                print_error(f"Failed to create supply {i+1}: {response.text}")
        except Exception as e:
            print_error(f"Error creating supply {i+1}: {str(e)}")
    
    return created_supplies

def test_analytics_endpoints(token):
    print_header("TESTING ANALYTICS ENDPOINTS")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test analytics overview
    try:
        response = requests.get(f"{BASE_URL}/inventory/analytics/overview", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print_success("Analytics Overview API working")
            print_info(f"  Total Assets: {data.get('total_assets')}")
            print_info(f"  Active Assets: {data.get('active_assets')}")
            print_info(f"  Total Value: ${data.get('total_asset_value', 0):,.2f}")
            print_info(f"  Asset Utilization: {data.get('system_health', {}).get('asset_utilization', 0):.1f}%")
            print_info(f"  Low Stock Supplies: {data.get('low_stock_supplies')}")
            print_info(f"  Categories: {list(data.get('category_distribution', {}).keys())}")
        else:
            print_error(f"Analytics overview failed: {response.text}")
    except Exception as e:
        print_error(f"Analytics test failed: {str(e)}")

def cleanup_sample_data(token, created_assets, created_supplies):
    print_header("CLEANING UP SAMPLE DATA")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Clean up assets
    for asset in created_assets:
        try:
            response = requests.delete(f"{BASE_URL}/inventory/assets/{asset['id']}", headers=headers)
            if response.status_code in [200, 204]:
                print_success(f"Cleaned up asset: {asset.get('name')}")
        except:
            pass
    
    # Clean up supplies
    for supply in created_supplies:
        try:
            response = requests.delete(f"{BASE_URL}/inventory/supplies/{supply['id']}", headers=headers)
            if response.status_code in [200, 204]:
                print_success(f"Cleaned up supply: {supply.get('name')}")
        except:
            pass

def main():
    print_header("INVENTORY ANALYTICS TEST WITH SAMPLE DATA")
    
    # Login
    token, user_info = login()
    if not token:
        print_error("Failed to login to backend")
        return
    
    print_success(f"Successfully logged in as: {user_info.get('email', TEST_USER)}")
    
    # Create sample data
    created_assets = create_sample_assets(token)
    created_supplies = create_sample_supplies(token)
    
    # Wait a moment for data to be processed
    time.sleep(2)
    
    # Test analytics
    test_analytics_endpoints(token)
    
    print_header("ANALYTICS TESTING COMPLETE")
    print_success("🎉 Analytics page should now show rich data!")
    print_info("📊 Visit: http://localhost:8082/dashboard (then navigate to Inventory > Analytics)")
    print_info("📈 You should see:")
    print_info("  ✓ Detailed asset statistics")
    print_info("  ✓ Category distribution charts")
    print_info("  ✓ Asset condition analysis")
    print_info("  ✓ Supply stock level indicators")
    print_info("  ✓ System health metrics")
    print_info("  ✓ Key insights and recommendations")
    
    # Ask user if they want to keep or clean up the data
    try:
        keep_data = input("\nKeep sample data for testing? (y/N): ").lower().startswith('y')
        if not keep_data:
            cleanup_sample_data(token, created_assets, created_supplies)
            print_success("Sample data cleaned up")
        else:
            print_success("Sample data preserved for testing")
    except KeyboardInterrupt:
        print("\nKeeping sample data for testing...")

if __name__ == "__main__":
    main()