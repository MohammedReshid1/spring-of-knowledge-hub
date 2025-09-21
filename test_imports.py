#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

print("Testing imports...")

try:
    from backend.app.db import (
        get_books_collection, get_borrow_requests_collection, get_borrow_records_collection,
        get_library_members_collection, get_library_settings_collection, get_reservations_collection,
        get_digital_resources_collection, get_student_collection, get_user_collection,
        validate_branch_id, validate_student_id
    )
    print("✅ Library imports successful")
except ImportError as e:
    print(f"❌ Library imports failed: {e}")

try:
    from backend.app.db import (
        get_incidents_collection, get_behavior_points_collection, get_rewards_collection,
        get_disciplinary_actions_collection, get_counseling_sessions_collection,
        get_behavior_contracts_collection, get_parent_meetings_collection
    )
    print("✅ Discipline imports successful")
except ImportError as e:
    print(f"❌ Discipline imports failed: {e}")

try:
    from backend.app.db import (
        get_assets_collection, get_supplies_collection, get_maintenance_collection,
        get_inventory_requests_collection, get_inventory_transactions_collection,
        get_vendors_collection, get_purchase_orders_collection
    )
    print("✅ Inventory imports successful")
except ImportError as e:
    print(f"❌ Inventory imports failed: {e}")

print("\nAll imports completed!")