import re
import html
from typing import Any, Optional
from datetime import datetime

# Input validation patterns
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
PHONE_PATTERN = re.compile(r'^\+?[1-9]\d{1,14}$')  # E.164 format
STUDENT_ID_PATTERN = re.compile(r'^[A-Z0-9]{3,20}$')  # Alphanumeric student IDs
NAME_PATTERN = re.compile(r'^[a-zA-Z\s\'-]{1,50}$')  # Names with spaces, hyphens, apostrophes
ALPHANUMERIC_PATTERN = re.compile(r'^[a-zA-Z0-9\s\-_.]{1,100}$')

def sanitize_html(text: str) -> str:
    """Sanitize HTML to prevent XSS attacks."""
    if not text:
        return ""
    # Escape HTML entities
    return html.escape(text)

def validate_email(email: str) -> bool:
    """Validate email format."""
    if not email or len(email) > 254:
        return False
    return bool(EMAIL_PATTERN.match(email.lower()))

def validate_phone(phone: str) -> bool:
    """Validate phone number format."""
    if not phone:
        return False
    # Remove spaces and hyphens for validation
    cleaned_phone = phone.replace(" ", "").replace("-", "")
    return bool(PHONE_PATTERN.match(cleaned_phone))

def validate_student_id(student_id: str) -> bool:
    """Validate student ID format."""
    if not student_id:
        return False
    return bool(STUDENT_ID_PATTERN.match(student_id.upper()))

def validate_name(name: str) -> bool:
    """Validate name format."""
    if not name or len(name) > 50:
        return False
    return bool(NAME_PATTERN.match(name))

def validate_alphanumeric(text: str, max_length: int = 100) -> bool:
    """Validate alphanumeric text with common punctuation."""
    if not text or len(text) > max_length:
        return False
    return bool(ALPHANUMERIC_PATTERN.match(text))

def validate_date(date_str: str, format: str = "%Y-%m-%d") -> Optional[datetime]:
    """Validate and parse date string."""
    try:
        return datetime.strptime(date_str, format)
    except (ValueError, TypeError):
        return None

def validate_amount(amount: Any) -> Optional[float]:
    """Validate and convert amount to float."""
    try:
        amount_float = float(amount)
        if amount_float < 0:
            return None
        # Limit to 2 decimal places
        return round(amount_float, 2)
    except (ValueError, TypeError):
        return None

def validate_payment_status(status: str) -> bool:
    """Validate payment status."""
    valid_statuses = ["Paid", "Unpaid", "Partial", "Waived", "Refunded"]
    return status in valid_statuses

def validate_payment_method(method: str) -> bool:
    """Validate payment method."""
    valid_methods = ["Cash", "Card", "Bank Transfer", "Check", "Online", "Other"]
    return method in valid_methods

def validate_role(role: str) -> bool:
    """Validate user role."""
    valid_roles = ["super_admin", "hq_admin", "branch_admin", "admin", "teacher", "student", "parent", "viewer"]
    return role in valid_roles

def validate_grade_level(grade: str) -> bool:
    """Validate grade level."""
    valid_grades = [
        "kindergarten", "kg_1", "kg_2", "kg_3",
        "grade_1", "grade_2", "grade_3", "grade_4", "grade_5",
        "grade_6", "grade_7", "grade_8", "grade_9", "grade_10",
        "grade_11", "grade_12", "university", "other"
    ]
    return grade.lower() in valid_grades

def sanitize_input(data: dict, allowed_fields: list) -> dict:
    """Sanitize input data by removing unwanted fields and escaping values."""
    sanitized = {}
    for field in allowed_fields:
        if field in data:
            value = data[field]
            if isinstance(value, str):
                # Sanitize string values
                sanitized[field] = sanitize_html(value.strip())
            elif isinstance(value, (int, float, bool)):
                sanitized[field] = value
            elif isinstance(value, list):
                # Sanitize list items if they're strings
                sanitized[field] = [
                    sanitize_html(item.strip()) if isinstance(item, str) else item
                    for item in value
                ]
            elif isinstance(value, dict):
                # Recursively sanitize nested dictionaries
                sanitized[field] = sanitize_input(value, list(value.keys()))
            else:
                sanitized[field] = value
    return sanitized

def validate_mongodb_id(id_str: str) -> bool:
    """Validate MongoDB ObjectId format."""
    if not id_str or len(id_str) != 24:
        return False
    try:
        # Check if it's a valid hex string
        int(id_str, 16)
        return True
    except ValueError:
        return False

def validate_pagination(page: int, limit: int) -> tuple:
    """Validate and sanitize pagination parameters."""
    # Ensure positive integers
    page = max(1, int(page))
    # Limit the page size to prevent DOS
    limit = min(max(1, int(limit)), 100)
    return page, limit

def validate_sort_field(field: str, allowed_fields: list) -> Optional[str]:
    """Validate sort field against allowed fields."""
    if field in allowed_fields:
        return field
    return None

def prevent_nosql_injection(query: dict) -> dict:
    """Prevent NoSQL injection by sanitizing MongoDB queries."""
    sanitized = {}
    for key, value in query.items():
        # Remove any MongoDB operators from user input
        if isinstance(key, str) and not key.startswith('$'):
            if isinstance(value, str):
                # Remove any potential MongoDB operators
                value = value.replace('$', '')
            sanitized[key] = value
    return sanitized