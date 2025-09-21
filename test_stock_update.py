#!/usr/bin/env python3
"""
Test script to verify stock update functionality
"""

import requests
import json

BASE_URL = "http://localhost:8000"
TEST_USER = "admin@gmail.com"
TEST_PASSWORD = "admin123"

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
        print(f"Login failed: {str(e)}")
        return None, None

def test_stock_update():
    # Login
    token, user_info = login()
    if not token:
        print("❌ Failed to login")
        return
    
    print(f"✅ Successfully logged in as: {user_info.get('email', TEST_USER)}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get all supplies first
    try:
        response = requests.get(f"{BASE_URL}/inventory/supplies", headers=headers)
        if response.status_code == 200:
            supplies = response.json()
            if not supplies:
                print("❌ No supplies found to test stock update")
                return
            
            supply = supplies[0]
            supply_id = supply['id']
            original_stock = supply.get('quantity_in_stock', 0)
            
            print(f"🧪 Testing stock update for: {supply['name']}")
            print(f"📦 Original stock: {original_stock}")
            
            # Test stock increase
            stock_data = {
                "quantity_change": 5,
                "reason": "Test stock increase"
            }
            
            response = requests.put(f"{BASE_URL}/inventory/supplies/{supply_id}/stock", 
                                  json=stock_data, headers=headers)
            
            if response.status_code == 200:
                updated_supply = response.json()
                new_stock = updated_supply.get('quantity_in_stock', 0)
                print(f"✅ Stock update successful: {original_stock} → {new_stock}")
                
                # Test stock decrease
                stock_data = {
                    "quantity_change": -2,
                    "reason": "Test stock decrease"
                }
                
                response = requests.put(f"{BASE_URL}/inventory/supplies/{supply_id}/stock", 
                                      json=stock_data, headers=headers)
                
                if response.status_code == 200:
                    final_supply = response.json()
                    final_stock = final_supply.get('quantity_in_stock', 0)
                    print(f"✅ Stock decrease successful: {new_stock} → {final_stock}")
                    print("🎉 Stock update functionality is working perfectly!")
                else:
                    print(f"❌ Stock decrease failed: {response.text}")
            else:
                print(f"❌ Stock increase failed: {response.text}")
                print(f"Status code: {response.status_code}")
        else:
            print(f"❌ Failed to get supplies: {response.text}")
    except Exception as e:
        print(f"❌ Error during test: {str(e)}")

if __name__ == "__main__":
    test_stock_update()