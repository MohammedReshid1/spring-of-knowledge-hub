#!/usr/bin/env python3
"""
Proper login test for Phase 1 security testing
"""
import requests

API_BASE = "http://localhost:8000"

def test_login():
    print("Testing Login with HttpOnly Cookies")
    print("=" * 50)
    print()

    # Test login
    login_data = {
        "username": "security_test@test.com",
        "password": "TestSecure123!"
    }

    print(f"Attempting login with: {login_data['username']}")

    response = requests.post(
        f"{API_BASE}/auth/login",
        data=login_data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded"
        }
    )

    print(f"Status Code: {response.status_code}")
    print()

    # Check cookies
    print("Cookies received:")
    for cookie in response.cookies:
        print(f"  - {cookie.name}: {cookie.value[:20]}... (httponly={cookie.has_nonstandard_attr('HttpOnly')})")

    if not response.cookies:
        print("  No cookies received!")
    print()

    # Check headers
    print("Response Headers:")
    for header, value in response.headers.items():
        if 'cookie' in header.lower() or 'set-cookie' in header.lower():
            print(f"  {header}: {value}")
    print()

    # Check response body
    print("Response Body:")
    try:
        body = response.json()
        print(f"  {body}")

        if "access_token" in body:
            print("  ⚠️ WARNING: Token in response body!")
        else:
            print("  ✓ No token in response body")
    except:
        print(f"  {response.text}")
    print()

    # Test authentication with cookie
    if response.status_code == 200 and response.cookies:
        print("Testing authenticated request with cookie...")
        me_response = requests.get(
            f"{API_BASE}/auth/me",
            cookies=response.cookies
        )
        print(f"Auth check status: {me_response.status_code}")
        if me_response.status_code == 200:
            print(f"User: {me_response.json()}")
            print("✓ Cookie authentication works!")

if __name__ == "__main__":
    test_login()
