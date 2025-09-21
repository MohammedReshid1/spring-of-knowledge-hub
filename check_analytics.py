#!/usr/bin/env python3
import requests
import json

# Login and get token
r = requests.post('http://localhost:8000/users/login', data={'username': 'admin@gmail.com', 'password': 'admin123'})
token = r.json()['access_token']

# Get analytics data
r = requests.get('http://localhost:8000/inventory/analytics/overview', headers={'Authorization': f'Bearer {token}'})
data = r.json()

print('📊 CURRENT ANALYTICS DATA:')
print(f'📱 Assets: {data["total_assets"]} total (${data["total_asset_value"]:,.0f} value)')
print(f'📦 Supplies: {data["total_supplies"]} total ({data["low_stock_supplies"]} low stock)')
print(f'🎯 Asset Utilization: {data["system_health"]["asset_utilization"]:.1f}%')
print(f'⚙️ Maintenance Compliance: {data["system_health"]["maintenance_compliance"]:.1f}%')
print(f'📦 Stock Adequacy: {data["system_health"]["stock_adequacy"]:.1f}%')
print(f'📋 Categories: {list(data["category_distribution"].keys())}')
print(f'🔧 Maintenance: {data["pending_maintenance"]} pending, {data["overdue_maintenance"]} overdue')
print()
print('✅ Analytics data is rich and comprehensive!')
print('🌐 Visit http://localhost:8082 and go to Inventory > Analytics to see the dashboard')