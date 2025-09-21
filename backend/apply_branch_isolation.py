#!/usr/bin/env python3
"""
Apply branch isolation pattern to all routers
Standardizes branch filtering across all components
"""

# Branch isolation pattern for list endpoints
LIST_BRANCH_FILTER = '''
        # Build query with mandatory branch filtering
        query = {}
        if current_user.get("role") == "superadmin":
            # Superadmin sees all data
            pass
        else:
            # Regular users see only their branch's data
            branch_id = current_user.get("branch_id")
            if not branch_id:
                return []  # No branch = no data
            query["branch_id"] = branch_id
'''

# Branch isolation pattern for create endpoints
CREATE_BRANCH_FILTER = '''
    # Only admin and superadmin can create items
    if current_user.get("role") not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can create items"
        )
    
    # Get user's branch
    branch_id = current_user.get("branch_id")
    if not branch_id and current_user.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
'''

# Routers that need branch isolation
ROUTERS_TO_FIX = [
    'attendance.py',
    'classes.py', 
    'fees.py',
    'grade_transitions.py',
    'student_enrollments.py',
    'exams.py',
    'exam_results.py',
    'academic_calendar.py',
    'communication.py',
    'discipline.py',
    'reports.py',
    'notifications.py',
    'registration_payments.py'
]

def analyze_router(router_path):
    """Analyze a router file to identify endpoints that need fixing"""
    try:
        with open(f"app/routers/{router_path}", 'r') as f:
            content = f.read()
        
        # Find all endpoints
        list_endpoints = []
        create_endpoints = []
        
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if '@router.get(' in line:
                # Look for the function name in next few lines
                for j in range(i+1, min(i+5, len(lines))):
                    if 'async def' in lines[j]:
                        func_name = lines[j].split('async def ')[1].split('(')[0]
                        list_endpoints.append(func_name)
                        break
            elif '@router.post(' in line:
                # Look for the function name in next few lines
                for j in range(i+1, min(i+5, len(lines))):
                    if 'async def' in lines[j]:
                        func_name = lines[j].split('async def ')[1].split('(')[0]
                        create_endpoints.append(func_name)
                        break
        
        # Check if branch filtering exists
        has_branch_filter = 'branch_id' in content
        has_role_check = 'superadmin' in content
        
        return {
            'router': router_path,
            'list_endpoints': list_endpoints,
            'create_endpoints': create_endpoints,
            'has_branch_filter': has_branch_filter,
            'has_role_check': has_role_check,
            'needs_fixing': not (has_branch_filter and has_role_check)
        }
        
    except FileNotFoundError:
        return {
            'router': router_path,
            'error': 'File not found',
            'needs_fixing': True
        }
    except Exception as e:
        return {
            'router': router_path,
            'error': str(e),
            'needs_fixing': True
        }

def main():
    print("🔍 Analyzing Routers for Branch Isolation")
    print("=" * 60)
    
    analysis_results = []
    
    for router in ROUTERS_TO_FIX:
        result = analyze_router(router)
        analysis_results.append(result)
        
        if 'error' in result:
            print(f"❌ {router}: {result['error']}")
        else:
            status_icon = "✅" if not result['needs_fixing'] else "⚠️ "
            print(f"{status_icon} {router}:")
            print(f"   List endpoints: {len(result['list_endpoints'])}")
            print(f"   Create endpoints: {len(result['create_endpoints'])}")
            print(f"   Has branch filter: {result['has_branch_filter']}")
            print(f"   Has role check: {result['has_role_check']}")
            print(f"   Needs fixing: {result['needs_fixing']}")
    
    # Summary
    total_routers = len(analysis_results)
    routers_needing_fix = sum(1 for r in analysis_results if r.get('needs_fixing', True))
    
    print(f"\n📊 Summary:")
    print(f"   Total routers analyzed: {total_routers}")
    print(f"   Routers needing fixes: {routers_needing_fix}")
    print(f"   Success rate: {((total_routers - routers_needing_fix) / total_routers * 100):.1f}%")
    
    if routers_needing_fix > 0:
        print(f"\n🔧 Routers that need branch isolation:")
        for result in analysis_results:
            if result.get('needs_fixing', True):
                print(f"   - {result['router']}")
    
    print(f"\n📋 Manual steps needed for each router:")
    print("1. Add branch filtering to list endpoints")
    print("2. Add branch assignment to create endpoints")
    print("3. Add role-based access control")
    print("4. Update existing data validation to include branch context")

if __name__ == "__main__":
    main()