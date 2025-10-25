#!/bin/bash

echo "Testing Login with HttpOnly Cookies..."
echo "======================================"
echo ""

# Test login
curl -v -X POST "http://localhost:8000/auth/login" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=security_test@test.com&password=TestSecure123!" \
     2>&1 | tee login_response.txt

echo ""
echo ""
echo "Checking for Set-Cookie headers..."
echo "-----------------------------------"
grep -i "set-cookie" login_response.txt || echo "No Set-Cookie headers found"

echo ""
echo "Checking for httpOnly flag..."
echo "------------------------------"
grep -i "httponly" login_response.txt || echo "No HttpOnly flag found"

echo ""
echo "Checking response body for access_token..."
echo "-------------------------------------------"
tail -1 login_response.txt | grep -o '"access_token"' && echo "WARNING: Token in response body!" || echo "Good: No token in response body"
