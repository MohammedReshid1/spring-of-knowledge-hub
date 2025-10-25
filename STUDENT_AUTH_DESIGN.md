# Student Authentication Flow Design Document

## Executive Summary

This document outlines the design for a comprehensive student authentication system for the Spring of Knowledge Hub. The system provides secure student login using student_id + password credentials, mandatory password change on first login, and robust security features while maintaining separation from staff authentication systems.

## 1. Authentication Flow Diagram

### 1.1 Complete Student Authentication Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Student       │    │   Frontend      │    │   Backend       │
│   Browser       │    │   React App     │    │   FastAPI       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. Enter Student ID   │                       │
         │    + Password         │                       │
         │─────────────────────→│                       │
         │                       │ 2. POST /auth/student │
         │                       │    /login           │
         │                       │─────────────────────→│
         │                       │                       │ 3. Validate Student ID
         │                       │                       │    Find student record
         │                       │                       │    Check password
         │                       │                       │    Detect default password
         │                       │                       │    Update auth metrics
         │                       │                       │
         │                       │    4a. Success:       │
         │                       │    - Default password │
         │                       │    - Require change   │
         │                       │    4b. Success:       │
         │                       │    - Normal login     │
         │                       │    4c. Error:         │
         │                       │    - Invalid credentials
         │                       │←─────────────────────│
         │                       │                       │
         │ 5a. Show password     │                       │
         │    change modal       │                       │
         │ 5b. Redirect to      │                       │
         │    dashboard          │                       │
         │ 5c. Show error       │                       │
         │←─────────────────────│                       │
         │                       │                       │
         │ 6a. Submit new       │                       │
         │    password           │                       │
         │─────────────────────→│                       │
         │                       │ 7. POST /auth/student │
         │                       │    /change-password   │
         │                       │─────────────────────→│
         │                       │                       │ 8. Validate new password
         │                       │                       │    Update password hash
         │                       │                       │    Clear default flag
         │                       │                       │    Log password change
         │                       │                       │
         │                       │    9. Success:        │
         │                       │    - JWT token issued │
         │                       │    10. Error:         │
         │                       │    - Validation failed
         │                       │←─────────────────────│
         │                       │                       │
         │ 11. Redirect to      │                       │
         │    dashboard          │                       │
         │←─────────────────────│                       │
```

### 1.2 Default Password Detection Algorithm

```
┌─────────────────────────────────────────────────────────────────┐
│                Default Password Detection Flow                  │
└─────────────────────────────────────────────────────────────────┘

Input: Student Record (student_id, first_name, grandfather_name)
Output: is_default_password (boolean), default_password (string)

1. Extract student components:
   - first_name = student.first_name.lower().strip()
   - grandfather_name = student.grandfather_name.lower().strip()

2. Generate expected default password:
   - default_password = f"{first_name}.{grandfather_name}321"

3. Verify against current password:
   - is_default = verify_password(default_password, stored_hash)

4. Return results:
   - {
       is_default_password: is_default,
       default_password: default_password if is_default else null
     }

Edge Cases:
- Missing grandfather_name: use "unknown"
- Special characters: remove spaces, convert to lowercase
- Multiple names: use first word only
```

### 1.3 Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Error Handling Flowchart                      │
└─────────────────────────────────────────────────────────────────┘

Student Login Attempt
        │
        ├─ Invalid Student ID
        │   └─ Generic Error: "Invalid student ID or password"
        │
        ├─ Valid Student ID, Invalid Password
        │   ├─ Track failed attempt
        │   ├─ Check account lockout
        │   │   ├─ Locked: Return "Account temporarily locked"
        │   │   └─ Not locked: Return "Invalid student ID or password"
        │
        ├─ Valid Credentials, Default Password
        │   └─ Return: {
        │         success: true,
        │         requires_password_change: true,
        │         message: "Please change your default password"
        │     }
        │
        ├─ Valid Credentials, Password Change Required
        │   └─ Return: {
        │         success: true,
        │         requires_password_change: true,
        │         message: "Password change required by admin"
        │     }
        │
        └─ Valid Credentials, Normal Login
            └─ Return: {
                  success: true,
                  requires_password_change: false,
                  access_token: JWT,
                  user: student_data
              }
```

## 2. Database Schema Updates

### 2.1 Student Collection Schema Enhancements

```javascript
// students collection - new fields for authentication
{
  // ... existing student fields ...

  // Authentication fields
  "student_credentials": {
    "password_hash": String,           // bcrypt hashed password
    "salt": String,                    // bcrypt salt (embedded in hash)
    "is_default_password": Boolean,    // true if using default password
    "password_changed_at": Date,       // timestamp of last password change
    "password_change_required": Boolean, // admin-enforced password change
    "password_strength": Number,       // 0-100 strength score
    "previous_passwords": [{           // password history (last 5)
      "hash": String,
      "changed_at": Date
    }]
  },

  // Authentication tracking
  "auth_tracking": {
    "last_login": Date,
    "login_count": Number,
    "failed_login_attempts": Number,
    "account_locked_until": Date,
    "lockout_reason": String,
    "password_reset_tokens": [{
      "token": String,
      "expires_at": Date,
      "used": Boolean
    }]
  },

  // Device and session tracking
  "device_tracking": {
    "last_device": {
      "ip": String,
      "user_agent": String,
      "device_id": String
    },
    "trusted_devices": [{
      "device_id": String,
      "device_name": String,
      "added_at": Date
    }]
  },

  // Security settings
  "security_settings": {
    "two_factor_enabled": Boolean,     // future feature
    "session_timeout": Number,         // minutes
    "require_device_verification": Boolean
  }
}
```

### 2.2 Student Authentication Log Collection

```javascript
// student_auth_logs collection
{
  "_id": ObjectId,
  "student_id": String,               // references student.student_id
  "user_id": ObjectId,                // references student._id
  "event_type": String,               // "login_attempt", "login_success",
                                     // "login_failure", "password_change",
                                     // "account_locked", "account_unlocked"
  "timestamp": Date,
  "ip_address": String,
  "user_agent": String,
  "device_id": String,
  "success": Boolean,
  "failure_reason": String,           // "invalid_credentials", "account_locked",
                                     // "default_password", "password_expired"
  "additional_data": {
    "session_id": String,
    "login_method": String,           // "student_id_password"
    "password_strength": Number,
    "is_default_password": Boolean
  }
}
```

### 2.3 User Collection Integration

```javascript
// users collection - ensure student users exist
{
  "_id": ObjectId,
  "email": String,                    // student email if provided
  "student_id": String,               // unique student identifier
  "full_name": String,                // combination of first + last name
  "role": "student",                  // fixed role for students
  "hashed_password": String,          // same as student_credentials.password_hash
  "branch_id": String,                // from student record
  "student_ref": ObjectId,            // reference to students collection
  "is_student": true,                 // flag for student identification
  "active": Boolean,                  // from student status

  // Audit fields
  "created_at": Date,
  "updated_at": Date,
  "created_by": String,               // admin who created student account
}
```

## 3. API Endpoint Design

### 3.1 Student Authentication Endpoints

```python
# POST /auth/student/login
{
  "request": {
    "student_id": string,      // Required: Student unique identifier
    "password": string,        // Required: Student password
    "device_info": {           // Optional: Device fingerprinting
      "device_id": string,
      "user_agent": string,
      "ip_address": string
    }
  },
  "responses": {
    "200": {
      "success": true,
      "message": "Login successful",
      "requires_password_change": false,
      "access_token": string,
      "token_type": "bearer",
      "user": {
        "id": string,
        "student_id": string,
        "full_name": string,
        "role": "student",
        "email": string,
        "branch_id": string
      }
    },
    "200_default": {
      "success": true,
      "message": "Default password detected. Password change required.",
      "requires_password_change": true,
      "force_change": true,
      "temp_token": string,      // Short-lived token for password change
      "user": {
        "id": string,
        "student_id": string,
        "full_name": string,
        "role": "student"
      }
    },
    "200_required": {
      "success": true,
      "message": "Password change required by administrator.",
      "requires_password_change": true,
      "force_change": true,
      "temp_token": string,
      "user": {
        "id": string,
        "student_id": string,
        "full_name": string,
        "role": "student"
      }
    },
    "401": {
      "success": false,
      "message": "Invalid student ID or password",
      "requires_password_change": false,
      "error": "INVALID_CREDENTIALS"
    },
    "423": {
      "success": false,
      "message": "Account temporarily locked due to multiple failed attempts",
      "requires_password_change": false,
      "error": "ACCOUNT_LOCKED",
      "lockout_duration": number,    // minutes
      "unlock_time": string          // ISO datetime
    },
    "404": {
      "success": false,
      "message": "Student account not found",
      "requires_password_change": false,
      "error": "STUDENT_NOT_FOUND"
    }
  }
}
```

### 3.2 Password Change Endpoint

```python
# POST /auth/student/change-password
{
  "request": {
    "temp_token": string,        // Required: Temporary token from login
    "current_password": string,  // Optional: Current password (for verification)
    "new_password": string,      // Required: New password
    "confirm_password": string,  // Required: Password confirmation
    "device_info": {             // Optional: Device info
      "device_id": string,
      "user_agent": string
    }
  },
  "responses": {
    "200": {
      "success": true,
      "message": "Password changed successfully",
      "access_token": string,    // Full JWT token
      "token_type": "bearer",
      "user": {
        "id": string,
        "student_id": string,
        "full_name": string,
        "role": "student",
        "email": string,
        "branch_id": string
      }
    },
    "400": {
      "success": false,
      "message": "Password validation failed",
      "errors": {
        "password_strength": "Password does not meet minimum requirements",
        "password_match": "New password and confirmation do not match",
        "previous_password": "New password cannot be same as previous password"
      }
    },
    "401": {
      "success": false,
      "message": "Invalid or expired temporary token",
      "error": "INVALID_TOKEN"
    },
    "422": {
      "success": false,
      "message": "Validation error",
      "details": object
    }
  }
}
```

### 3.3 Password Validation Endpoint

```python
# POST /auth/student/validate-password
{
  "request": {
    "password": string,          // Required: Password to validate
    "student_id": string         // Optional: Student context for history check
  },
  "responses": {
    "200": {
      "valid": true,
      "strength_score": 85,
      "feedback": {
        "message": "Strong password",
        "warnings": [],
        "suggestions": []
      }
    },
    "200_weak": {
      "valid": false,
      "strength_score": 45,
      "feedback": {
        "message": "Password is too weak",
        "warnings": [
          "Password should be at least 12 characters long",
          "Include uppercase and lowercase letters",
          "Include numbers and special characters"
        ],
        "suggestions": [
          "Use a passphrase with multiple words",
          "Add special characters like !@#$%"
        ]
      }
    },
    "400": {
      "valid": false,
      "error": "Password validation failed"
    }
  }
}
```

### 3.4 Student Account Status Endpoint

```python
# GET /auth/student/status/{student_id}
{
  "responses": {
    "200": {
      "exists": true,
      "active": true,
      "locked": false,
      "requires_password_change": true,
      "password_expired": false,
      "account_details": {
        "student_id": string,
        "full_name": string,
        "email": string,
        "branch_id": string,
        "grade_level": string,
        "last_login": string,
        "login_count": number
      }
    },
    "404": {
      "exists": false,
      "message": "Student account not found"
    }
  }
}
```

## 4. Security Implementation Details

### 4.1 Password Strength Validation Rules

```python
class PasswordStrengthValidator:
    """
    Comprehensive password strength validation for students
    """

    MIN_LENGTH = 12
    MAX_LENGTH = 128
    REQUIRED_ENTROPY = 60  # bits

    def validate_password(self, password: str, student_context: dict = None) -> dict:
        """
        Validate password against security requirements

        Args:
            password: Password to validate
            student_context: Student data for personalized rules

        Returns:
            dict with validation results
        """
        results = {
            "valid": True,
            "strength_score": 0,
            "feedback": {
                "warnings": [],
                "suggestions": [],
                "message": ""
            }
        }

        # Length validation
        if len(password) < self.MIN_LENGTH:
            results["valid"] = False
            results["feedback"]["warnings"].append(
                f"Password must be at least {self.MIN_LENGTH} characters long"
            )

        # Character variety checks
        has_lower = any(c.islower() for c in password)
        has_upper = any(c.isupper() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)

        variety_score = sum([has_lower, has_upper, has_digit, has_special])
        if variety_score < 3:
            results["valid"] = False
            results["feedback"]["warnings"].append(
                "Include at least 3 of: lowercase, uppercase, numbers, special characters"
            )

        # Common password patterns
        if self._is_common_pattern(password, student_context):
            results["valid"] = False
            results["feedback"]["warnings"].append(
                "Password is too predictable based on your information"
            )

        # Entropy calculation
        entropy = self._calculate_entropy(password)
        results["strength_score"] = min(100, int((entropy / self.REQUIRED_ENTROPY) * 100))

        # Generate feedback message
        if results["valid"]:
            if results["strength_score"] >= 80:
                results["feedback"]["message"] = "Very strong password"
            elif results["strength_score"] >= 60:
                results["feedback"]["message"] = "Strong password"
            else:
                results["feedback"]["message"] = "Password meets minimum requirements"
        else:
            results["feedback"]["message"] = "Password does not meet requirements"
            results["feedback"]["suggestions"] = [
                "Use a passphrase with multiple unrelated words",
                "Include numbers and special characters",
                "Avoid using personal information"
            ]

        return results

    def _is_common_pattern(self, password: str, student_context: dict = None) -> bool:
        """Check if password matches common or predictable patterns"""
        if not student_context:
            return False

        # Check against student information
        student_id = student_context.get("student_id", "").lower()
        first_name = student_context.get("first_name", "").lower()
        grandfather_name = student_context.get("grandfather_name", "").lower()

        password_lower = password.lower()

        # Check for personal information
        personal_terms = [student_id, first_name, grandfather_name]
        for term in personal_terms:
            if term and len(term) > 2 and term in password_lower:
                return True

        # Check for sequential characters
        if self._has_sequential_chars(password):
            return True

        # Check for repeated characters
        if self._has_repeated_chars(password):
            return True

        return False

    def _calculate_entropy(self, password: str) -> float:
        """Calculate password entropy in bits"""
        import math
        import string

        charset_size = 0
        if any(c.islower() for c in password):
            charset_size += 26
        if any(c.isupper() for c in password):
            charset_size += 26
        if any(c.isdigit() for c in password):
            charset_size += 10
        if any(c in string.punctuation for c in password):
            charset_size += len(string.punctuation)

        if charset_size == 0:
            return 0

        entropy = len(password) * math.log2(charset_size)
        return entropy
```

### 4.2 Default Password Detection Algorithm

```python
class DefaultPasswordDetector:
    """
    Detects and manages default password usage
    """

    @staticmethod
    def generate_default_password(student_data: dict) -> str:
        """
        Generate expected default password for student

        Format: {firstname}.{grandfathername}321
        """
        first_name = student_data.get("first_name", "").lower().strip()
        grandfather_name = student_data.get("grandfather_name", "unknown").lower().strip()

        # Clean names: remove spaces, special characters
        import re
        first_name = re.sub(r'[^a-zA-Z0-9]', '', first_name)
        grandfather_name = re.sub(r'[^a-zA-Z0-9]', '', grandfather_name)

        if not first_name:
            first_name = "student"
        if not grandfather_name:
            grandfather_name = "unknown"

        return f"{first_name}.{grandfather_name}321"

    @staticmethod
    def is_using_default_password(student_data: dict, password_hash: str) -> dict:
        """
        Check if student is using default password

        Returns:
            dict with detection results
        """
        from ..utils.auth import verify_password

        expected_default = DefaultPasswordDetector.generate_default_password(student_data)

        return {
            "is_default": verify_password(expected_default, password_hash),
            "default_password": expected_default,
            "pattern_detected": f"{student_data.get('first_name', '')}.{student_data.get('grandfather_name', '')}321"
        }

    @staticmethod
    def validate_password_format(student_id: str, student_data: dict, password: str) -> bool:
        """
        Validate if password matches default format for given student

        Used for preventing default-like passwords
        """
        expected_default = DefaultPasswordDetector.generate_default_password(student_data)

        # Direct match
        if password == expected_default:
            return True

        # Similar patterns (case insensitive, spaces)
        import re
        normalized_password = re.sub(r'[^a-zA-Z0-9.]', '', password.lower())
        normalized_default = re.sub(r'[^a-zA-Z0-9.]', '', expected_default.lower())

        return normalized_password == normalized_default
```

### 4.3 Account Lockout Policy for Students

```python
class StudentAccountLockout:
    """
    Student-specific account lockout management
    """

    MAX_ATTEMPTS = 5  # More lenient than staff
    LOCKOUT_DURATION = 15 * 60  # 15 minutes
    PROGRESSIVE_LOCKOUT = True  # Increase duration for repeated lockouts

    lockout_tracker = {}  # In-memory, should use Redis in production

    @classmethod
    def track_failed_attempt(cls, student_id: str, ip_address: str = None) -> dict:
        """
        Track failed login attempt for student

        Returns:
            dict with lockout status
        """
        key = f"{student_id}:{ip_address or 'unknown'}"

        if key not in cls.lockout_tracker:
            cls.lockout_tracker[key] = {
                "attempts": 1,
                "first_attempt": datetime.utcnow(),
                "last_attempt": datetime.utcnow(),
                "lockout_count": 0,
                "locked_until": None
            }
        else:
            cls.lockout_tracker[key]["attempts"] += 1
            cls.lockout_tracker[key]["last_attempt"] = datetime.utcnow()

        tracker = cls.lockout_tracker[key]

        # Check if lockout should be triggered
        if tracker["attempts"] >= cls.MAX_ATTEMPTS:
            tracker["lockout_count"] += 1

            # Progressive lockout duration
            if cls.PROGRESSIVE_LOCKOUT:
                duration = cls.LOCKOUT_DURATION * (2 ** (tracker["lockout_count"] - 1))
                duration = min(duration, 24 * 60 * 60)  # Cap at 24 hours
            else:
                duration = cls.LOCKOUT_DURATION

            tracker["locked_until"] = datetime.utcnow() + timedelta(seconds=duration)

            return {
                "locked": True,
                "lockout_duration": duration,
                "unlock_time": tracker["locked_until"],
                "attempts": tracker["attempts"],
                "lockout_count": tracker["lockout_count"]
            }

        return {
            "locked": False,
            "attempts": tracker["attempts"],
            "remaining_attempts": cls.MAX_ATTEMPTS - tracker["attempts"]
        }

    @classmethod
    def is_account_locked(cls, student_id: str, ip_address: str = None) -> dict:
        """
        Check if student account is currently locked

        Returns:
            dict with lockout status
        """
        key = f"{student_id}:{ip_address or 'unknown'}"

        if key not in cls.lockout_tracker:
            return {"locked": False}

        tracker = cls.lockout_tracker[key]

        if tracker["locked_until"] and datetime.utcnow() < tracker["locked_until"]:
            return {
                "locked": True,
                "unlock_time": tracker["locked_until"],
                "remaining_time": (tracker["locked_until"] - datetime.utcnow()).total_seconds()
            }
        else:
            # Lockout expired, reset tracker
            cls.reset_tracker(student_id, ip_address)
            return {"locked": False}

    @classmethod
    def reset_tracker(cls, student_id: str, ip_address: str = None):
        """Reset failed attempt tracker for student"""
        key = f"{student_id}:{ip_address or 'unknown'}"
        cls.lockout_tracker.pop(key, None)
```

### 4.4 Session Management for Students

```python
class StudentSessionManager:
    """
    Student-specific session management
    """

    SESSION_TIMEOUT = 8 * 60 * 60  # 8 hours (school day)
    MAX_CONCURRENT_SESSIONS = 2    # Allow multiple devices but limited

    @classmethod
    def create_student_session(cls, student_id: str, device_info: dict) -> dict:
        """
        Create new session for student with device tracking

        Returns:
            dict with session information
        """
        session_id = secrets.token_urlsafe(32)

        session_data = {
            "session_id": session_id,
            "student_id": student_id,
            "device_info": device_info,
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(seconds=cls.SESSION_TIMEOUT),
            "active": True
        }

        # Store in database/cache
        cls._store_session(session_data)

        return {
            "session_id": session_id,
            "expires_at": session_data["expires_at"],
            "timeout_seconds": cls.SESSION_TIMEOUT
        }

    @classmethod
    def validate_session(cls, session_id: str, student_id: str) -> dict:
        """
        Validate student session and update activity

        Returns:
            dict with validation results
        """
        session_data = cls._get_session(session_id)

        if not session_data:
            return {"valid": False, "reason": "Session not found"}

        if session_data["student_id"] != student_id:
            return {"valid": False, "reason": "Session mismatch"}

        if datetime.utcnow() > session_data["expires_at"]:
            cls._invalidate_session(session_id)
            return {"valid": False, "reason": "Session expired"}

        # Update last activity
        session_data["last_activity"] = datetime.utcnow()
        cls._store_session(session_data)

        return {
            "valid": True,
            "expires_at": session_data["expires_at"],
            "time_remaining": (session_data["expires_at"] - datetime.utcnow()).total_seconds()
        }
```

## 5. Error Handling Strategy

### 5.1 Professional Error Messages

```python
class StudentAuthErrorHandler:
    """
    Centralized error handling for student authentication
    """

    ERROR_MESSAGES = {
        "INVALID_CREDENTIALS": {
            "message": "Invalid student ID or password",
            "code": "AUTH_001",
            "log_level": "INFO",
            "should_lockout": True
        },
        "ACCOUNT_LOCKED": {
            "message": "Account temporarily locked for security reasons",
            "code": "AUTH_002",
            "log_level": "WARNING",
            "show_lockout_duration": True
        },
        "ACCOUNT_INACTIVE": {
            "message": "Student account is currently inactive. Please contact administration.",
            "code": "AUTH_003",
            "log_level": "INFO"
        },
        "DEFAULT_PASSWORD_REQUIRED": {
            "message": "For security, you must change your default password before continuing.",
            "code": "AUTH_004",
            "log_level": "INFO",
            "force_password_change": True
        },
        "PASSWORD_EXPIRED": {
            "message": "Your password has expired. Please set a new password.",
            "code": "AUTH_005",
            "log_level": "INFO",
            "force_password_change": True
        },
        "PASSWORD_CHANGE_REQUIRED": {
            "message": "Password change required by administrator. Please update your password.",
            "code": "AUTH_006",
            "log_level": "INFO",
            "force_password_change": True
        },
        "WEAK_PASSWORD": {
            "message": "Password does not meet security requirements.",
            "code": "AUTH_007",
            "log_level": "INFO",
            "show_requirements": True
        },
        "SESSION_EXPIRED": {
            "message": "Your session has expired. Please login again.",
            "code": "AUTH_008",
            "log_level": "INFO"
        },
        "DEVICE_NOT_TRUSTED": {
            "message": "Additional verification required for this device.",
            "code": "AUTH_009",
            "log_level": "WARNING"
        },
        "RATE_LIMIT_EXCEEDED": {
            "message": "Too many login attempts. Please try again later.",
            "code": "AUTH_010",
            "log_level": "WARNING"
        }
    }

    @classmethod
    def handle_auth_error(cls, error_code: str, context: dict = None) -> dict:
        """
        Handle authentication error with appropriate response

        Args:
            error_code: Error code from ERROR_MESSAGES
            context: Additional context for error handling

        Returns:
            dict with error response
        """
        error_config = cls.ERROR_MESSAGES.get(error_code, {
            "message": "An error occurred during authentication",
            "code": "AUTH_999",
            "log_level": "ERROR"
        })

        response = {
            "success": False,
            "error_code": error_config["code"],
            "message": error_config["message"],
            "requires_password_change": error_config.get("force_password_change", False)
        }

        # Add additional context based on error type
        if error_code == "ACCOUNT_LOCKED" and context:
            response["lockout_info"] = {
                "duration_minutes": context.get("lockout_duration", 15),
                "unlock_time": context.get("unlock_time"),
                "remaining_attempts": 0
            }

        if error_code == "WEAK_PASSWORD" and context:
            response["password_requirements"] = {
                "min_length": 12,
                "require_uppercase": True,
                "require_lowercase": True,
                "require_numbers": True,
                "require_special_chars": True,
                "previous_passwords_check": 5
            }

        if error_code == "INVALID_CREDENTIALS":
            response["suggestions"] = [
                "Check your student ID and password",
                "Ensure caps lock is off",
                "Contact school administration if you continue to have issues"
            ]

        return response
```

### 5.2 Rate Limiting for Students

```python
class StudentRateLimiter:
    """
    Student-specific rate limiting with educational considerations
    """

    def __init__(self):
        self.redis_client = None  # Initialize Redis connection
        self.local_cache = {}  # Fallback for development

    # Rate limits for different operations
    RATE_LIMITS = {
        "login": {
            "requests": 5,      # 5 attempts
            "window": 300,      # per 5 minutes
            "penalty": 900      # 15 minute penalty
        },
        "password_change": {
            "requests": 3,      # 3 attempts
            "window": 300,      # per 5 minutes
            "penalty": 300      # 5 minute penalty
        },
        "password_validation": {
            "requests": 20,     # 20 requests
            "window": 300,      # per 5 minutes
            "penalty": 60       # 1 minute penalty
        }
    }

    async def check_rate_limit(self,
                             student_id: str,
                             operation: str,
                             ip_address: str = None) -> dict:
        """
        Check if operation is allowed for student

        Returns:
            dict with rate limit status
        """
        limit_config = self.RATE_LIMITS.get(operation, {})
        if not limit_config:
            return {"allowed": True}

        key = f"student_rate:{student_id}:{operation}:{ip_address or 'unknown'}"

        # Try Redis first, fallback to local cache
        try:
            current_data = await self._get_from_redis(key)
        except:
            current_data = self.local_cache.get(key, {"attempts": 0, "window_start": datetime.utcnow()})

        now = datetime.utcnow()
        window_start = current_data.get("window_start", now)

        # Reset window if expired
        if (now - window_start).total_seconds() > limit_config["window"]:
            current_data = {
                "attempts": 0,
                "window_start": now,
                "penalty_until": None
            }

        # Check penalty
        penalty_until = current_data.get("penalty_until")
        if penalty_until and now < penalty_until:
            return {
                "allowed": False,
                "penalty_active": True,
                "penalty_remaining": (penalty_until - now).total_seconds(),
                "message": f"Rate limit penalty active. Try again in {(penalty_until - now).seconds // 60} minutes."
            }

        # Check rate limit
        if current_data["attempts"] >= limit_config["requests"]:
            # Apply penalty
            current_data["penalty_until"] = now + timedelta(seconds=limit_config["penalty"])

            # Save updated data
            try:
                await self._set_to_redis(key, current_data, limit_config["penalty"])
            except:
                self.local_cache[key] = current_data

            return {
                "allowed": False,
                "rate_limit_exceeded": True,
                "message": f"Rate limit exceeded. Try again in {limit_config['penalty'] // 60} minutes.",
                "retry_after": limit_config["penalty"]
            }

        # Increment counter
        current_data["attempts"] += 1

        # Save updated data
        try:
            await self._set_to_redis(key, current_data, limit_config["window"])
        except:
            self.local_cache[key] = current_data

        remaining = limit_config["requests"] - current_data["attempts"]

        return {
            "allowed": True,
            "remaining_attempts": remaining,
            "window_reset": window_start + timedelta(seconds=limit_config["window"])
        }
```

## 6. Frontend Integration Points

### 6.1 Student Login Form Component

```typescript
// StudentLoginForm.tsx
interface StudentLoginFormProps {
  onSuccess: (userData: StudentUser) => void;
  onPasswordChangeRequired: (changeData: PasswordChangeData) => void;
  onError: (error: AuthError) => void;
}

interface StudentLoginData {
  student_id: string;
  password: string;
  remember_me?: boolean;
}

interface PasswordChangeData {
  tempToken: string;
  studentInfo: {
    id: string;
    student_id: string;
    full_name: string;
  };
  isDefaultPassword: boolean;
}

const StudentLoginForm: React.FC<StudentLoginFormProps> = ({
  onSuccess,
  onPasswordChangeRequired,
  onError
}) => {
  const [formData, setFormData] = useState<StudentLoginData>({
    student_id: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors([]);

    try {
      // Client-side validation
      if (!formData.student_id.trim()) {
        setErrors(['Student ID is required']);
        return;
      }

      if (!formData.password) {
        setErrors(['Password is required']);
        return;
      }

      // Get device info for security
      const deviceInfo = {
        device_id: getDeviceId(),
        user_agent: navigator.userAgent,
        ip_address: await getClientIP()
      };

      const response = await fetch('/auth/student/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          device_info: deviceInfo
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.requires_password_change) {
          // Handle password change requirement
          onPasswordChangeRequired({
            tempToken: data.temp_token,
            studentInfo: data.user,
            isDefaultPassword: data.force_change
          });
        } else {
          // Successful login
          onSuccess({
            ...data.user,
            access_token: data.access_token
          });
        }
      } else {
        // Handle various error types
        const errorMessage = data.message || 'Login failed';
        const errorDetails = {
          code: data.error_code,
          lockoutInfo: data.lockout_info,
          suggestions: data.suggestions
        };

        onError({
          message: errorMessage,
          details: errorDetails
        });
      }
    } catch (error) {
      onError({
        message: 'Network error. Please try again.',
        details: { type: 'network_error' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="student-login-form">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="student_id" className="block text-sm font-medium text-gray-700">
            Student ID
          </label>
          <input
            type="text"
            id="student_id"
            value={formData.student_id}
            onChange={(e) => setFormData({...formData, student_id: e.target.value})}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your Student ID"
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </div>

        {errors.length > 0 && (
          <div className="error-messages bg-red-50 border border-red-200 rounded-md p-4">
            {errors.map((error, index) => (
              <p key={index} className="text-red-600 text-sm">{error}</p>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};
```

### 6.2 Password Change Modal Component

```typescript
// PasswordChangeModal.tsx
interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tempToken: string;
  studentInfo: StudentInfo;
  isDefaultPassword: boolean;
  onSuccess: (userData: StudentUser) => void;
  onError: (error: AuthError) => void;
}

const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
  isOpen,
  onClose,
  tempToken,
  studentInfo,
  isDefaultPassword,
  onSuccess,
  onError
}) => {
  const [formData, setFormData] = useState({
    new_password: '',
    confirm_password: '',
    current_password: '' // Only for non-default password changes
  });
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const validatePassword = async (password: string) => {
    try {
      const response = await fetch('/auth/student/validate-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: password,
          student_id: studentInfo.student_id
        })
      });

      const data = await response.json();
      setPasswordStrength(data.strength_score);

      if (!data.valid) {
        setValidationErrors(data.feedback.warnings);
      } else {
        setValidationErrors([]);
      }
    } catch (error) {
      console.error('Password validation error:', error);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'new_password') {
      validatePassword(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setValidationErrors([]);

    try {
      // Client-side validation
      if (formData.new_password !== formData.confirm_password) {
        setValidationErrors(['Passwords do not match']);
        return;
      }

      if (passwordStrength < 60) {
        setValidationErrors(['Password is too weak. Please choose a stronger password.']);
        return;
      }

      const deviceInfo = {
        device_id: getDeviceId(),
        user_agent: navigator.userAgent
      };

      const response = await fetch('/auth/student/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          temp_token: tempToken,
          current_password: isDefaultPassword ? undefined : formData.current_password,
          new_password: formData.new_password,
          confirm_password: formData.confirm_password,
          device_info: deviceInfo
        })
      });

      const data = await response.json();

      if (data.success) {
        onSuccess({
          ...data.user,
          access_token: data.access_token
        });
        onClose();
      } else {
        setValidationErrors(data.errors ? Object.values(data.errors) : [data.message]);
      }
    } catch (error) {
      onError({
        message: 'Network error. Please try again.',
        details: { type: 'network_error' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Change Your Password
          </h3>

          {isDefaultPassword && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                You're using a default password. For security, please create a new password.
              </p>
            </div>
          )}

          <div className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isDefaultPassword && (
                <div>
                  <label htmlFor="current_password" className="block text-sm font-medium text-gray-700">
                    Current Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="current_password"
                    value={formData.current_password}
                    onChange={handlePasswordChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                    required
                  />
                </div>
              )}

              <div>
                <label htmlFor="new_password" className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  id="new_password"
                  value={formData.new_password}
                  onChange={handlePasswordChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  required
                />

                {/* Password strength indicator */}
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Password Strength</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength >= 80 ? 'text-green-600' :
                      passwordStrength >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {passwordStrength}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        passwordStrength >= 80 ? 'bg-green-500' :
                        passwordStrength >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  id="confirm_password"
                  value={formData.confirm_password}
                  onChange={handlePasswordChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="show_password"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="show_password" className="ml-2 block text-sm text-gray-900">
                  Show passwords
                </label>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  {validationErrors.map((error, index) => (
                    <p key={index} className="text-red-600 text-sm">{error}</p>
                  ))}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || passwordStrength < 60}
                  className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 6.3 Authentication Context Updates

```typescript
// AuthContext.tsx - Extended for student authentication
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  studentLogin: (credentials: StudentLoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (passwordData: PasswordChangeData) => Promise<void>;
  refreshToken: () => Promise<void>;
  isStudent: boolean;
  requiresPasswordChange: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

  const studentLogin = async (credentials: StudentLoginCredentials) => {
    setIsLoading(true);

    try {
      const response = await authAPI.studentLogin(credentials);

      if (response.requires_password_change) {
        setRequiresPasswordChange(true);
        // Store temporary token for password change
        localStorage.setItem('temp_token', response.temp_token);
        return response;
      } else {
        // Successful login
        setUser(response.user);
        localStorage.setItem('access_token', response.access_token);
        setRequiresPasswordChange(false);
        return response;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (passwordData: PasswordChangeData) => {
    setIsLoading(true);

    try {
      const response = await authAPI.changeStudentPassword(passwordData);

      if (response.success) {
        setUser(response.user);
        localStorage.setItem('access_token', response.access_token);
        setRequiresPasswordChange(false);
        localStorage.removeItem('temp_token');
      }

      return response;
    } finally {
      setIsLoading(false);
    }
  };

  const isStudent = user?.role === 'student';

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login: async (credentials) => { /* existing login logic */ },
      studentLogin,
      logout: async () => { /* existing logout logic */ },
      changePassword,
      refreshToken: async () => { /* existing refresh logic */ },
      isStudent,
      requiresPasswordChange
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

## 7. Testing Strategy

### 7.1 Test Cases for Student Authentication

```python
# test_student_auth.py
import pytest
import asyncio
from datetime import datetime, timedelta
from app.utils.auth import get_password_hash, verify_password
from app.utils.student_auth import DefaultPasswordDetector, StudentAccountLockout
from app.models.student import StudentCreate

class TestStudentAuthentication:
    """Comprehensive test suite for student authentication"""

    @pytest.fixture
    async def test_student(self):
        """Create test student with default password"""
        student_data = StudentCreate(
            student_id="STU001",
            first_name="Ahmed",
            grandfather_name="Mohammed",
            email="ahmed.stu001@school.edu",
            grade_level="Grade 10"
        )

        # Generate default password
        default_password = DefaultPasswordDetector.generate_default_password(
            student_data.dict()
        )

        # Hash and store password
        student_data.student_credentials = {
            "password_hash": get_password_hash(default_password),
            "is_default_password": True,
            "password_changed_at": None
        }

        return student_data, default_password

    @pytest.mark.asyncio
    async def test_default_password_generation(self, test_student):
        """Test default password generation algorithm"""
        student_data, expected_password = test_student

        generated = DefaultPasswordDetector.generate_default_password(
            student_data.dict()
        )

        assert generated == "ahmed.mohammed321"
        assert generated == expected_password

    @pytest.mark.asyncio
    async def test_default_password_detection(self, test_student):
        """Test detection of default password usage"""
        student_data, default_password = test_student

        # Test with default password
        detection_result = DefaultPasswordDetector.is_using_default_password(
            student_data.dict(),
            student_data.student_credentials["password_hash"]
        )

        assert detection_result["is_default"] is True
        assert detection_result["default_password"] == default_password

        # Test with custom password
        custom_password = "MySecurePassword123!"
        custom_hash = get_password_hash(custom_password)

        student_data.student_credentials["password_hash"] = custom_hash
        student_data.student_credentials["is_default_password"] = False

        detection_result = DefaultPasswordDetector.is_using_default_password(
            student_data.dict(),
            custom_hash
        )

        assert detection_result["is_default"] is False

    @pytest.mark.asyncio
    async def test_student_login_with_default_password(self, test_student):
        """Test student login when using default password"""
        student_data, default_password = test_student

        # Simulate login request
        login_data = {
            "student_id": student_data.student_id,
            "password": default_password
        }

        # Should detect default password and require change
        response = await self.student_login_endpoint(login_data)

        assert response["success"] is True
        assert response["requires_password_change"] is True
        assert response["force_change"] is True
        assert "temp_token" in response
        assert "access_token" not in response  # No full token until password changed

    @pytest.mark.asyncio
    async def test_student_login_with_custom_password(self, test_student):
        """Test student login with custom password"""
        student_data, _ = test_student

        # Change password to custom
        custom_password = "SecureStudentPass123!"
        custom_hash = get_password_hash(custom_password)

        student_data.student_credentials["password_hash"] = custom_hash
        student_data.student_credentials["is_default_password"] = False
        student_data.student_credentials["password_changed_at"] = datetime.utcnow()

        login_data = {
            "student_id": student_data.student_id,
            "password": custom_password
        }

        response = await self.student_login_endpoint(login_data)

        assert response["success"] is True
        assert response["requires_password_change"] is False
        assert "access_token" in response
        assert response["user"]["role"] == "student"

    @pytest.mark.asyncio
    async def test_password_change_flow(self, test_student):
        """Test complete password change flow"""
        student_data, default_password = test_student

        # Step 1: Login with default password
        login_response = await self.student_login_endpoint({
            "student_id": student_data.student_id,
            "password": default_password
        })

        assert login_response["requires_password_change"] is True
        temp_token = login_response["temp_token"]

        # Step 2: Change password
        new_password = "NewSecurePassword456!"
        change_response = await self.change_password_endpoint({
            "temp_token": temp_token,
            "new_password": new_password,
            "confirm_password": new_password
        })

        assert change_response["success"] is True
        assert "access_token" in change_response

        # Step 3: Verify login with new password
        login_response = await self.student_login_endpoint({
            "student_id": student_data.student_id,
            "password": new_password
        })

        assert login_response["success"] is True
        assert login_response["requires_password_change"] is False

    @pytest.mark.asyncio
    async def test_account_lockout_mechanism(self, test_student):
        """Test student account lockout after failed attempts"""
        student_data, _ = test_student

        # Make multiple failed login attempts
        for i in range(5):
            response = await self.student_login_endpoint({
                "student_id": student_data.student_id,
                "password": "wrongpassword"
            })

            if i < 4:
                assert response["success"] is False
                assert "error" in response
            else:
                # 5th attempt should trigger lockout
                assert response["error_code"] == "AUTH_002"  # Account locked
                assert "lockout_info" in response

    @pytest.mark.asyncio
    async def test_password_strength_validation(self, test_student):
        """Test password strength validation"""
        weak_passwords = [
            "password",          # Too common
            "123456789012",      # Only numbers
            "ahmed.mohammed321", # Default pattern
            "student",           # Too short
            "STU001",            # Student ID
        ]

        strong_passwords = [
            "SecurePass123!@#",
            "MyDogLovesBones456!",
            "BlueSky$GreenGrass789"
        ]

        for password in weak_passwords:
            validation = await self.validate_password_endpoint({
                "password": password,
                "student_id": test_student[0].student_id
            })

            assert validation["valid"] is False
            assert validation["strength_score"] < 60

        for password in strong_passwords:
            validation = await self.validate_password_endpoint({
                "password": password,
                "student_id": test_student[0].student_id
            })

            assert validation["valid"] is True
            assert validation["strength_score"] >= 60

    @pytest.mark.asyncio
    async def test_concurrent_session_management(self, test_student):
        """Test concurrent session limits for students"""
        student_data, _ = test_student

        # Create custom password for testing
        custom_password = "TestPassword123!"
        custom_hash = get_password_hash(custom_password)
        student_data.student_credentials["password_hash"] = custom_hash
        student_data.student_credentials["is_default_password"] = False

        # Login from multiple devices
        device1_response = await self.student_login_endpoint({
            "student_id": student_data.student_id,
            "password": custom_password,
            "device_info": {"device_id": "device1", "user_agent": "Chrome/Windows"}
        })

        device2_response = await self.student_login_endpoint({
            "student_id": student_data.student_id,
            "password": custom_password,
            "device_info": {"device_id": "device2", "user_agent": "Safari/iPhone"}
        })

        assert device1_response["success"] is True
        assert device2_response["success"] is True

        # Third device should work but may log out oldest session
        device3_response = await self.student_login_endpoint({
            "student_id": student_data.student_id,
            "password": custom_password,
            "device_info": {"device_id": "device3", "user_agent": "Firefox/Linux"}
        })

        assert device3_response["success"] is True

    @pytest.mark.asyncio
    async def test_session_expiry_and_refresh(self, test_student):
        """Test session expiry and token refresh"""
        student_data, custom_password = test_student

        # Login and get token
        login_response = await self.student_login_endpoint({
            "student_id": student_data.student_id,
            "password": custom_password
        })

        access_token = login_response["access_token"]

        # Use token for authenticated request
        me_response = await self.get_current_user_endpoint(access_token)
        assert me_response["student_id"] == student_data.student_id

        # Test token refresh
        refresh_response = await self.refresh_token_endpoint(access_token)
        assert "access_token" in refresh_response

        # Verify new token works
        new_me_response = await self.get_current_user_endpoint(refresh_response["access_token"])
        assert new_me_response["student_id"] == student_data.student_id

    @pytest.mark.asyncio
    async def test_audit_logging(self, test_student):
        """Test comprehensive audit logging"""
        student_data, default_password = test_student

        # Successful login
        await self.student_login_endpoint({
            "student_id": student_data.student_id,
            "password": default_password
        })

        # Check audit logs
        audit_logs = await self.get_audit_logs({
            "student_id": student_data.student_id,
            "event_type": "login_success"
        })

        assert len(audit_logs) == 1
        assert audit_logs[0]["success"] is True
        assert "ip_address" in audit_logs[0]
        assert "user_agent" in audit_logs[0]

        # Failed login attempt
        await self.student_login_endpoint({
            "student_id": student_data.student_id,
            "password": "wrongpassword"
        })

        # Check failed login logs
        failed_logs = await self.get_audit_logs({
            "student_id": student_data.student_id,
            "event_type": "login_failure"
        })

        assert len(failed_logs) >= 1
        assert failed_logs[-1]["success"] is False
        assert failed_logs[-1]["failure_reason"] == "invalid_credentials"
```

### 7.2 Security Testing Requirements

```python
# test_student_auth_security.py
import pytest
from app.utils.student_auth import StudentAccountLockout, DefaultPasswordDetector
from app.security.testing import SecurityTestCase

class TestStudentAuthSecurity(SecurityTestCase):
    """Security-focused tests for student authentication"""

    @pytest.mark.asyncio
    async def test_student_id_enumeration_prevention(self):
        """Test that responses don't reveal whether student ID exists"""

        # Test with non-existent student ID
        response1 = await self.student_login_endpoint({
            "student_id": "NONEXISTENT123",
            "password": "anypassword"
        })

        # Test with existing student ID but wrong password
        response2 = await self.student_login_endpoint({
            "student_id": "STU001",
            "password": "wrongpassword"
        })

        # Responses should be identical (timing and content)
        assert response1["error_code"] == response2["error_code"]
        assert response1["message"] == response2["message"]

        # Timing should be similar (within 100ms)
        # This would be tested with actual timing measurements

    @pytest.mark.asyncio
    async def test_brute_force_protection(self):
        """Test protection against brute force attacks"""

        # Simulate rapid successive attempts
        for i in range(10):
            response = await self.student_login_endpoint({
                "student_id": "STU001",
                "password": f"wrongpass{i}"
            })

            if i >= 5:
                assert response["error_code"] == "AUTH_002"  # Account locked

    @pytest.mark.asyncio
    async def test_password_history_enforcement(self):
        """Test that students can't reuse recent passwords"""

        # Login and change password
        temp_token = await self.get_temp_token_for_password_change()

        passwords = ["Password1!", "Password2!", "Password3!"]

        # Use first password
        await self.change_password_endpoint({
            "temp_token": temp_token,
            "new_password": passwords[0],
            "confirm_password": passwords[0]
        })

        # Try to change back to first password (should be rejected)
        new_temp_token = await self.get_temp_token_for_password_change()
        response = await self.change_password_endpoint({
            "temp_token": new_temp_token,
            "new_password": passwords[0],
            "confirm_password": passwords[0]
        })

        assert response["success"] is False
        assert "previous_password" in str(response["errors"])

    @pytest.mark.asyncio
    async def test_session_hijacking_prevention(self):
        """Test session security features"""

        # Login and get session
        login_response = await self.student_login_endpoint({
            "student_id": "STU001",
            "password": "SecurePassword123!"
        })

        access_token = login_response["access_token"]

        # Try to use session from different IP (should require re-auth)
        suspicious_response = await self.get_current_user_endpoint(
            access_token,
            headers={"X-Forwarded-For": "192.168.1.100"}  # Different IP
        )

        # Should either work with warning or require re-authentication
        # Implementation depends on security policy

    @pytest.mark.asyncio
    async def test_xss_prevention_in_auth_responses(self):
        """Test that auth responses are XSS-safe"""

        # Create student with XSS in name
        xss_name = "<script>alert('xss')</script>"

        login_response = await self.student_login_endpoint({
            "student_id": "STU001",
            "password": "password"
        })

        # Response should contain sanitized data
        assert "<script>" not in str(login_response)
        assert "alert" not in str(login_response)

    @pytest.mark.asyncio
    async def test_csrf_protection_in_student_auth(self):
        """Test CSRF protection for student authentication endpoints"""

        # Test that state-changing operations require proper CSRF tokens
        # This would test actual CSRF middleware implementation

        response = await self.change_password_endpoint({
            "temp_token": "valid_token",
            "new_password": "NewPassword123!",
            "confirm_password": "NewPassword123!"
        }, headers={})  # Missing CSRF header

        # Should reject request without CSRF token
        assert response.status_code == 403
```

### 7.3 Integration Testing

```python
# test_student_auth_integration.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

class TestStudentAuthIntegration:
    """Integration tests for complete student auth flow"""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    async def setup_student(self):
        """Set up test student in database"""
        # Create student record
        # Set up default password
        # Return student credentials
        pass

    @pytest.mark.asyncio
    async def test_complete_student_onboarding_flow(self, client, setup_student):
        """Test complete new student onboarding flow"""

        # 1. Student logs in with default password
        login_response = client.post("/auth/student/login", json={
            "student_id": setup_student["student_id"],
            "password": setup_student["default_password"]
        })

        assert login_response.status_code == 200
        assert login_response.json()["requires_password_change"] is True

        # 2. Student changes password
        change_response = client.post("/auth/student/change-password", json={
            "temp_token": login_response.json()["temp_token"],
            "new_password": "MySecurePassword123!",
            "confirm_password": "MySecurePassword123!"
        })

        assert change_response.status_code == 200
        assert "access_token" in change_response.json()

        # 3. Student accesses protected resources
        headers = {"Authorization": f"Bearer {change_response.json()['access_token']}"}

        profile_response = client.get("/auth/me", headers=headers)
        assert profile_response.status_code == 200
        assert profile_response.json()["role"] == "student"

        # 4. Student logs out
        logout_response = client.post("/auth/logout", headers=headers)
        assert logout_response.status_code == 200

        # 5. Verify session is invalidated
        profile_response_after = client.get("/auth/me", headers=headers)
        assert profile_response_after.status_code == 401

    @pytest.mark.asyncio
    async def test_student_auth_with_different_devices(self, client, setup_student):
        """Test student authentication across multiple devices"""

        # Simulate different devices
        device_configs = [
            {"user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            {"user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"},
            {"user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}
        ]

        tokens = []

        for device in device_configs:
            headers = {"User-Agent": device["user_agent"]}

            login_response = client.post("/auth/student/login", json={
                "student_id": setup_student["student_id"],
                "password": setup_student["custom_password"]  # Using custom password
            }, headers=headers)

            assert login_response.status_code == 200
            tokens.append({
                "token": login_response.json()["access_token"],
                "device": device["user_agent"]
            })

        # All tokens should be valid
        for token_data in tokens:
            headers = {
                "Authorization": f"Bearer {token_data['token']}",
                "User-Agent": token_data["device"]
            }

            me_response = client.get("/auth/me", headers=headers)
            assert me_response.status_code == 200
            assert me_response.json()["student_id"] == setup_student["student_id"]

    @pytest.mark.asyncio
    async def test_student_auth_with_network_interruption(self, client, setup_student):
        """Test authentication behavior during network issues"""

        # Start password change process
        login_response = client.post("/auth/student/login", json={
            "student_id": setup_student["student_id"],
            "password": setup_student["default_password"]
        })

        temp_token = login_response.json()["temp_token"]

        # Simulate network interruption during password change
        # (This would require mocking network failures)

        # Password change should still work with valid temp token
        change_response = client.post("/auth/student/change-password", json={
            "temp_token": temp_token,
            "new_password": "NetworkResilientPassword123!",
            "confirm_password": "NetworkResilientPassword123!"
        })

        assert change_response.status_code == 200

    @pytest.mark.asyncio
    async def test_student_auth_performance(self, client, setup_student):
        """Test authentication performance under load"""

        import time
        import concurrent.futures

        def single_login():
            start_time = time.time()
            response = client.post("/auth/student/login", json={
                "student_id": setup_student["student_id"],
                "password": setup_student["custom_password"]
            })
            end_time = time.time()
            return {
                "status": response.status_code,
                "response_time": end_time - start_time
            }

        # Run 10 concurrent logins
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(single_login) for _ in range(10)]
            results = [future.result() for future in futures]

        # All should succeed
        assert all(result["status"] == 200 for result in results)

        # Average response time should be reasonable (< 2 seconds)
        avg_response_time = sum(result["response_time"] for result in results) / len(results)
        assert avg_response_time < 2.0
```

## Implementation Steps

### Phase 1: Backend Implementation (Week 1-2)
1. Implement default password detection algorithm
2. Create student authentication endpoints
3. Update database schema
4. Implement password strength validation
5. Add comprehensive audit logging

### Phase 2: Security Features (Week 3)
1. Implement account lockout policies
2. Add rate limiting
3. Create session management
4. Implement error handling strategy
5. Add security headers and CSRF protection

### Phase 3: Frontend Integration (Week 4)
1. Create student login form
2. Implement password change modal
3. Update authentication context
4. Add error handling components
5. Implement session management

### Phase 4: Testing & Deployment (Week 5)
1. Write comprehensive test suites
2. Perform security testing
3. Load testing and optimization
4. User acceptance testing
5. Documentation and training

## Conclusion

This comprehensive student authentication system provides:
- Secure login using student credentials
- Mandatory password change for first-time users
- Robust security features including rate limiting and account lockout
- Comprehensive audit logging for compliance
- User-friendly password change flow
- Integration with existing authentication infrastructure
- Extensive testing coverage for security and functionality

The design maintains separation from staff authentication while leveraging existing security patterns and infrastructure. The system is scalable, maintainable, and follows security best practices for educational environments.