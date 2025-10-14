#!/bin/bash

# Notification Testing Script
# Tests the notification system with various recipient types

BASE_URL="http://127.0.0.1:8000"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Notification System Testing ==="
echo ""

# First, login to get a token
echo "${YELLOW}1. Logging in to get auth token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/users/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=superadmin@springofknowledge.edu&password=SuperAdmin123")

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "${RED}✗ Failed to get auth token${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "${GREEN}✓ Login successful${NC}"
echo ""

# Test 1: Send notification to ALL_USERS
echo "${YELLOW}2. Testing: Send notification to ALL_USERS${NC}"
TEST1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test: All Users Notification",
    "message": "This notification should reach all users in the system",
    "notification_type": "announcement",
    "recipient_type": "ALL_USERS",
    "priority": "medium",
    "channels": ["in_app"]
  }')

if echo "$TEST1_RESPONSE" | grep -q '"id"'; then
  echo "${GREEN}✓ ALL_USERS notification sent successfully${NC}"
else
  echo "${RED}✗ Failed to send ALL_USERS notification${NC}"
  echo "Response: $TEST1_RESPONSE"
fi
echo ""

# Test 2: Send notification to STUDENTS
echo "${YELLOW}3. Testing: Send notification to STUDENTS${NC}"
TEST2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test: Students Only Notification",
    "message": "This notification should only reach students",
    "notification_type": "academic",
    "recipient_type": "STUDENTS",
    "priority": "high",
    "channels": ["in_app"]
  }')

if echo "$TEST2_RESPONSE" | grep -q '"id"'; then
  echo "${GREEN}✓ STUDENTS notification sent successfully${NC}"
else
  echo "${RED}✗ Failed to send STUDENTS notification${NC}"
  echo "Response: $TEST2_RESPONSE"
fi
echo ""

# Test 3: Send notification to TEACHERS
echo "${YELLOW}4. Testing: Send notification to TEACHERS${NC}"
TEST3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test: Teachers Only Notification",
    "message": "This notification should only reach teachers",
    "notification_type": "announcement",
    "recipient_type": "TEACHERS",
    "priority": "medium",
    "channels": ["in_app"]
  }')

if echo "$TEST3_RESPONSE" | grep -q '"id"'; then
  echo "${GREEN}✓ TEACHERS notification sent successfully${NC}"
else
  echo "${RED}✗ Failed to send TEACHERS notification${NC}"
  echo "Response: $TEST3_RESPONSE"
fi
echo ""

# Test 4: Send notification to ADMINS
echo "${YELLOW}5. Testing: Send notification to ADMINS${NC}"
TEST4_RESPONSE=$(curl -s -X POST "$BASE_URL/api/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test: Admins Only Notification",
    "message": "This notification should only reach administrators",
    "notification_type": "system",
    "recipient_type": "ADMINS",
    "priority": "urgent",
    "channels": ["in_app"]
  }')

if echo "$TEST4_RESPONSE" | grep -q '"id"'; then
  echo "${GREEN}✓ ADMINS notification sent successfully${NC}"
else
  echo "${RED}✗ Failed to send ADMINS notification${NC}"
  echo "Response: $TEST4_RESPONSE"
fi
echo ""

# Test 5: Quick Announcement (using the dedicated endpoint)
echo "${YELLOW}6. Testing: Quick Announcement${NC}"
TEST5_RESPONSE=$(curl -s -X POST "$BASE_URL/api/notifications/quick/announcement?title=Quick%20Test&message=This%20is%20a%20quick%20announcement&recipient_type=ALL_USERS&priority=medium" \
  -H "Authorization: Bearer $TOKEN")

if echo "$TEST5_RESPONSE" | grep -q '"id"'; then
  echo "${GREEN}✓ Quick announcement sent successfully${NC}"
else
  echo "${RED}✗ Failed to send quick announcement${NC}"
  echo "Response: $TEST5_RESPONSE"
fi
echo ""

# Test 6: Check user notifications
echo "${YELLOW}7. Testing: Fetch user notifications${NC}"
TEST6_RESPONSE=$(curl -s -X GET "$BASE_URL/api/notifications/me" \
  -H "Authorization: Bearer $TOKEN")

NOTIF_COUNT=$(echo $TEST6_RESPONSE | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data) if isinstance(data, list) else 'error')" 2>/dev/null)

if [ "$NOTIF_COUNT" != "error" ]; then
  echo "${GREEN}✓ Successfully fetched notifications (count: $NOTIF_COUNT)${NC}"
else
  echo "${RED}✗ Failed to fetch notifications${NC}"
  echo "Response: $TEST6_RESPONSE"
fi
echo ""

echo "${GREEN}=== Notification Testing Complete ===${NC}"
echo ""
echo "Summary:"
echo "- Test the frontend at http://localhost:8080"
echo "- Navigate to the Notifications page"
echo "- You should see the test notifications in your bell dropdown"
echo "- Try creating new notifications with different recipient types"
