#!/usr/bin/env python3
"""
Quick script to generate a test OTP for development testing
"""
import sys
sys.path.insert(0, '.')

from app.models.otp import OTPModelService

# Generate an OTP code
otp_code = OTPModelService.generate_otp_code()
print(f"Generated OTP: {otp_code}")
