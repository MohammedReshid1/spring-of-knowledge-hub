"""
Centralized Data Validation Service
Provides unified validation for all data models and ensures referential integrity
"""

import asyncio
import logging
from datetime import datetime, date
from typing import Dict, List, Optional, Any, Union, Set
from enum import Enum
from dataclasses import dataclass
from bson import ObjectId
from pydantic import BaseModel, ValidationError
import re

from .audit_logger import get_audit_logger, AuditAction, AuditSeverity

# Configure validation logger
validation_logger = logging.getLogger("data_validation")
validation_logger.setLevel(logging.INFO)

class ValidationLevel(str, Enum):
    """Validation severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class ValidationScope(str, Enum):
    """Scope of validation"""
    FIELD = "field"
    RECORD = "record"
    RELATIONSHIP = "relationship"
    BUSINESS_RULE = "business_rule"
    REFERENTIAL_INTEGRITY = "referential_integrity"

@dataclass
class ValidationResult:
    """Result of data validation"""
    is_valid: bool
    level: ValidationLevel
    scope: ValidationScope
    field_name: Optional[str]
    message: str
    details: Optional[Dict[str, Any]] = None
    suggested_fix: Optional[str] = None

@dataclass
class ValidationContext:
    """Context for validation operations"""
    user_id: Optional[str]
    branch_id: Optional[str]
    operation: str  # create, update, delete
    collection_name: str
    document_id: Optional[str] = None

class DataValidator:
    """
    Centralized data validation service with comprehensive validation rules
    """
    
    def __init__(self, db):
        self.db = db
        self.audit_logger = None
        
        # Cache for frequently accessed reference data
        self._branch_cache = {}
        self._grade_level_cache = {}
        self._subject_cache = {}
        self._cache_ttl = 300  # 5 minutes
        self._last_cache_update = {}
        
        # Validation rule registry
        self.field_validators = {}
        self.business_rule_validators = {}
        self.relationship_validators = {}
        
        self._initialize_validators()
    
    async def initialize(self):
        """Initialize the data validator"""
        self.audit_logger = get_audit_logger()
        await self.audit_logger.initialize()
        validation_logger.info("Data validator initialized")
    
    def _initialize_validators(self):
        """Initialize validation rules"""
        
        # Field-level validators
        self.field_validators.update({
            'email': self._validate_email,
            'phone': self._validate_phone,
            'student_id': self._validate_student_id,
            'date_of_birth': self._validate_date_of_birth,
            'grade_level': self._validate_grade_level,
            'branch_id': self._validate_branch_id,
            'academic_year': self._validate_academic_year,
            'percentage': self._validate_percentage,
            'marks': self._validate_marks
        })
        
        # Business rule validators
        self.business_rule_validators.update({
            'student_age_grade_consistency': self._validate_student_age_grade,
            'teacher_subject_qualification': self._validate_teacher_subject_qualification,
            'exam_date_academic_calendar': self._validate_exam_date_calendar,
            'fee_amount_grade_structure': self._validate_fee_amount_structure,
            'class_capacity_limits': self._validate_class_capacity,
            'academic_year_transitions': self._validate_academic_year_transition
        })
        
        # Relationship validators
        self.relationship_validators.update({
            'student_class_assignment': self._validate_student_class_assignment,
            'teacher_class_assignment': self._validate_teacher_class_assignment,
            'parent_student_relationship': self._validate_parent_student_relationship,
            'exam_subject_class_consistency': self._validate_exam_subject_class,
            'fee_student_grade_consistency': self._validate_fee_student_grade,
            'attendance_student_class': self._validate_attendance_student_class
        })
    
    async def validate_document(
        self,
        data: Dict[str, Any],
        context: ValidationContext,
        validation_rules: Optional[List[str]] = None
    ) -> List[ValidationResult]:
        """
        Comprehensive document validation
        
        Args:
            data: Document data to validate
            context: Validation context
            validation_rules: Specific rules to apply (if None, applies all relevant rules)
        
        Returns:
            List of validation results
        """
        results = []
        
        try:
            # 1. Field-level validation
            field_results = await self._validate_fields(data, context)
            results.extend(field_results)
            
            # 2. Business rule validation
            if not validation_rules or any('business_rule' in rule for rule in validation_rules):
                business_results = await self._validate_business_rules(data, context)
                results.extend(business_results)
            
            # 3. Relationship validation
            if not validation_rules or any('relationship' in rule for rule in validation_rules):
                relationship_results = await self._validate_relationships(data, context)
                results.extend(relationship_results)
            
            # 4. Referential integrity validation
            if not validation_rules or any('referential' in rule for rule in validation_rules):
                integrity_results = await self._validate_referential_integrity(data, context)
                results.extend(integrity_results)
            
            # Log validation results
            if any(r.level in [ValidationLevel.ERROR, ValidationLevel.CRITICAL] for r in results):
                await self._log_validation_results(results, context)
            
        except Exception as e:
            validation_logger.error(f"Error during document validation: {e}")
            results.append(ValidationResult(
                is_valid=False,
                level=ValidationLevel.CRITICAL,
                scope=ValidationScope.RECORD,
                field_name=None,
                message=f"Validation system error: {str(e)}",
                suggested_fix="Contact system administrator"
            ))
        
        return results
    
    async def _validate_fields(self, data: Dict[str, Any], context: ValidationContext) -> List[ValidationResult]:
        """Validate individual fields"""
        results = []
        
        for field_name, value in data.items():
            if field_name in self.field_validators and value is not None:
                try:
                    validator = self.field_validators[field_name]
                    result = await validator(value, field_name, context)
                    if result:
                        results.append(result)
                except Exception as e:
                    results.append(ValidationResult(
                        is_valid=False,
                        level=ValidationLevel.ERROR,
                        scope=ValidationScope.FIELD,
                        field_name=field_name,
                        message=f"Field validation error: {str(e)}",
                        suggested_fix=f"Check {field_name} format and value"
                    ))
        
        return results
    
    async def _validate_business_rules(self, data: Dict[str, Any], context: ValidationContext) -> List[ValidationResult]:
        """Validate business rules"""
        results = []
        
        # Determine which business rules to apply based on collection
        relevant_rules = self._get_relevant_business_rules(context.collection_name)
        
        for rule_name in relevant_rules:
            if rule_name in self.business_rule_validators:
                try:
                    validator = self.business_rule_validators[rule_name]
                    result = await validator(data, context)
                    if result:
                        results.append(result)
                except Exception as e:
                    results.append(ValidationResult(
                        is_valid=False,
                        level=ValidationLevel.WARNING,
                        scope=ValidationScope.BUSINESS_RULE,
                        field_name=None,
                        message=f"Business rule validation error: {str(e)}",
                        suggested_fix=f"Review {rule_name} business rule"
                    ))
        
        return results
    
    async def _validate_relationships(self, data: Dict[str, Any], context: ValidationContext) -> List[ValidationResult]:
        """Validate entity relationships"""
        results = []
        
        # Determine which relationship rules to apply
        relevant_relationships = self._get_relevant_relationships(context.collection_name)
        
        for relationship_name in relevant_relationships:
            if relationship_name in self.relationship_validators:
                try:
                    validator = self.relationship_validators[relationship_name]
                    result = await validator(data, context)
                    if result:
                        results.append(result)
                except Exception as e:
                    results.append(ValidationResult(
                        is_valid=False,
                        level=ValidationLevel.ERROR,
                        scope=ValidationScope.RELATIONSHIP,
                        field_name=None,
                        message=f"Relationship validation error: {str(e)}",
                        suggested_fix=f"Check {relationship_name} relationship consistency"
                    ))
        
        return results
    
    async def _validate_referential_integrity(self, data: Dict[str, Any], context: ValidationContext) -> List[ValidationResult]:
        """Validate referential integrity"""
        results = []
        
        # Define foreign key relationships per collection
        foreign_keys = {
            'students': [
                ('branch_id', 'branches'),
                ('class_id', 'classes'),
                ('parent_guardian_id', 'parents')
            ],
            'classes': [
                ('branch_id', 'branches'),
                ('grade_level_id', 'grade_levels'),
                ('teacher_id', 'teachers')
            ],
            'exams': [
                ('subject_id', 'subjects'),
                ('class_id', 'classes'),
                ('teacher_id', 'teachers'),
                ('branch_id', 'branches')
            ],
            'fees': [
                ('student_id', 'students'),
                ('branch_id', 'branches')
            ],
            'attendance': [
                ('student_id', 'students'),
                ('class_id', 'classes'),
                ('branch_id', 'branches')
            ]
        }
        
        collection_fks = foreign_keys.get(context.collection_name, [])
        
        for field_name, referenced_collection in collection_fks:
            if field_name in data and data[field_name] is not None:
                try:
                    is_valid = await self._check_reference_exists(
                        data[field_name], referenced_collection, context
                    )
                    
                    if not is_valid:
                        results.append(ValidationResult(
                            is_valid=False,
                            level=ValidationLevel.ERROR,
                            scope=ValidationScope.REFERENTIAL_INTEGRITY,
                            field_name=field_name,
                            message=f"Referenced {referenced_collection} record not found",
                            details={
                                "referenced_id": str(data[field_name]),
                                "referenced_collection": referenced_collection
                            },
                            suggested_fix=f"Ensure {field_name} references a valid {referenced_collection} record"
                        ))
                
                except Exception as e:
                    results.append(ValidationResult(
                        is_valid=False,
                        level=ValidationLevel.WARNING,
                        scope=ValidationScope.REFERENTIAL_INTEGRITY,
                        field_name=field_name,
                        message=f"Could not validate reference: {str(e)}",
                        suggested_fix=f"Check database connectivity and {referenced_collection} collection"
                    ))
        
        return results
    
    # Field Validators
    async def _validate_email(self, value: str, field_name: str, context: ValidationContext) -> Optional[ValidationResult]:
        """Validate email format"""
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        if not re.match(email_pattern, value):
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.ERROR,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message="Invalid email format",
                suggested_fix="Use format: user@domain.com"
            )
        return None
    
    async def _validate_phone(self, value: str, field_name: str, context: ValidationContext) -> Optional[ValidationResult]:
        """Validate phone number format"""
        # Allow various phone formats
        phone_pattern = r'^[\+]?[\d\s\-\(\)]{7,15}$'
        
        if not re.match(phone_pattern, value):
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.ERROR,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message="Invalid phone number format",
                suggested_fix="Use format: +1-234-567-8900 or similar"
            )
        return None
    
    async def _validate_student_id(self, value: str, field_name: str, context: ValidationContext) -> Optional[ValidationResult]:
        """Validate student ID uniqueness and format"""
        # Check format (example: STU-2024-0001)
        student_id_pattern = r'^[A-Z]{2,4}-\d{4}-\d{4,6}$'
        
        if not re.match(student_id_pattern, value):
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.WARNING,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message="Student ID doesn't match recommended format",
                suggested_fix="Use format: STU-YYYY-NNNN (e.g., STU-2024-0001)"
            )
        
        # Check uniqueness within branch
        if context.branch_id:
            existing = await self.db.students.find_one({
                "student_id": value,
                "branch_id": context.branch_id,
                "_id": {"$ne": ObjectId(context.document_id)} if context.document_id else None
            })
            
            if existing:
                return ValidationResult(
                    is_valid=False,
                    level=ValidationLevel.ERROR,
                    scope=ValidationScope.FIELD,
                    field_name=field_name,
                    message="Student ID already exists in this branch",
                    suggested_fix="Use a unique student ID within the branch"
                )
        
        return None
    
    async def _validate_date_of_birth(self, value: Union[datetime, date], field_name: str, context: ValidationContext) -> Optional[ValidationResult]:
        """Validate date of birth"""
        today = date.today()
        
        # Convert datetime to date if necessary
        if isinstance(value, datetime):
            birth_date = value.date()
        else:
            birth_date = value
        
        # Check if date is in the future
        if birth_date > today:
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.ERROR,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message="Date of birth cannot be in the future",
                suggested_fix="Enter a valid past date"
            )
        
        # Check if age is reasonable (between 3 and 25 for students)
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        
        if context.collection_name == 'students':
            if age < 3:
                return ValidationResult(
                    is_valid=False,
                    level=ValidationLevel.WARNING,
                    scope=ValidationScope.FIELD,
                    field_name=field_name,
                    message=f"Student age ({age}) seems too young",
                    suggested_fix="Verify the date of birth is correct"
                )
            elif age > 25:
                return ValidationResult(
                    is_valid=False,
                    level=ValidationLevel.WARNING,
                    scope=ValidationScope.FIELD,
                    field_name=field_name,
                    message=f"Student age ({age}) seems high for typical student",
                    suggested_fix="Verify this is not a teacher or staff member"
                )
        
        return None
    
    async def _validate_grade_level(self, value: str, field_name: str, context: ValidationContext) -> Optional[ValidationResult]:
        """Validate grade level exists"""
        grade_levels = await self._get_cached_grade_levels(context.branch_id)
        
        if value not in grade_levels:
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.ERROR,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message=f"Grade level '{value}' not found",
                details={"available_grades": list(grade_levels)[:10]},  # Show first 10
                suggested_fix="Use an existing grade level or create it first"
            )
        
        return None
    
    async def _validate_branch_id(self, value: str, field_name: str, context: ValidationContext) -> Optional[ValidationResult]:
        """Validate branch ID exists"""
        branches = await self._get_cached_branches()
        
        if value not in branches:
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.ERROR,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message=f"Branch '{value}' not found",
                suggested_fix="Use an existing branch ID"
            )
        
        return None
    
    async def _validate_academic_year(self, value: str, field_name: str, context: ValidationContext) -> Optional[ValidationResult]:
        """Validate academic year format and existence"""
        # Check format (e.g., "2024-2025")
        academic_year_pattern = r'^\d{4}-\d{4}$'
        
        if not re.match(academic_year_pattern, value):
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.ERROR,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message="Invalid academic year format",
                suggested_fix="Use format: YYYY-YYYY (e.g., 2024-2025)"
            )
        
        # Validate year sequence
        start_year, end_year = map(int, value.split('-'))
        if end_year != start_year + 1:
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.ERROR,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message="Academic year must be consecutive years",
                suggested_fix="Use format: YYYY-YYYY where second year = first year + 1"
            )
        
        return None
    
    async def _validate_percentage(self, value: float, field_name: str, context: ValidationContext) -> Optional[ValidationResult]:
        """Validate percentage value"""
        if not 0 <= value <= 100:
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.ERROR,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message="Percentage must be between 0 and 100",
                suggested_fix="Enter a value between 0 and 100"
            )
        
        return None
    
    async def _validate_marks(self, value: float, field_name: str, context: ValidationContext) -> Optional[ValidationResult]:
        """Validate marks value"""
        if value < 0:
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.ERROR,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message="Marks cannot be negative",
                suggested_fix="Enter a non-negative value"
            )
        
        # Check if marks seem reasonable (warning for very high values)
        if value > 1000:
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.WARNING,
                scope=ValidationScope.FIELD,
                field_name=field_name,
                message=f"Marks value ({value}) seems unusually high",
                suggested_fix="Verify the marks value is correct"
            )
        
        return None
    
    # Business Rule Validators
    async def _validate_teacher_subject_qualification(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate teacher is qualified to teach assigned subjects"""
        if context.collection_name != 'teachers' or 'subjects' not in data:
            return None
        
        # This would check against teacher qualifications in a real system
        # For now, just a basic check
        return None
    
    async def _validate_exam_date_calendar(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate exam date is within academic calendar"""
        if context.collection_name != 'exams' or 'exam_date' not in data:
            return None
        
        try:
            exam_date = data['exam_date']
            if isinstance(exam_date, str):
                exam_date = datetime.fromisoformat(exam_date)
            
            # Check if exam is scheduled on a weekend (warning)
            if exam_date.weekday() >= 5:  # Saturday = 5, Sunday = 6
                return ValidationResult(
                    is_valid=False,
                    level=ValidationLevel.WARNING,
                    scope=ValidationScope.BUSINESS_RULE,
                    field_name="exam_date",
                    message="Exam scheduled on weekend",
                    suggested_fix="Consider scheduling exam on a weekday"
                )
        except Exception as e:
            validation_logger.warning(f"Could not validate exam date: {e}")
        
        return None
    
    async def _validate_fee_amount_structure(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate fee amount matches fee structure"""
        if context.collection_name != 'fees' or 'amount' not in data:
            return None
        
        # This would validate against fee structures
        amount = float(data.get('amount', 0))
        if amount < 0:
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.ERROR,
                scope=ValidationScope.BUSINESS_RULE,
                field_name="amount",
                message="Fee amount cannot be negative",
                suggested_fix="Enter a positive fee amount"
            )
        
        return None
    
    async def _validate_class_capacity(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate class capacity limits"""
        if context.collection_name != 'classes' or 'capacity' not in data:
            return None
        
        capacity = int(data.get('capacity', 0))
        if capacity > 50:
            return ValidationResult(
                is_valid=False,
                level=ValidationLevel.WARNING,
                scope=ValidationScope.BUSINESS_RULE,
                field_name="capacity",
                message=f"Class capacity ({capacity}) seems very high",
                suggested_fix="Consider if this capacity is manageable"
            )
        
        return None
    
    async def _validate_academic_year_transition(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate academic year transition logic"""
        # Implementation would check for proper academic year transitions
        return None

    async def _validate_student_age_grade(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate student age is appropriate for grade level"""
        if context.collection_name != 'students' or 'date_of_birth' not in data or 'grade_level' not in data:
            return None
        
        try:
            birth_date = data['date_of_birth']
            if isinstance(birth_date, str):
                birth_date = datetime.fromisoformat(birth_date).date()
            elif isinstance(birth_date, datetime):
                birth_date = birth_date.date()
            
            today = date.today()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            
            grade_level = data['grade_level']
            
            # Define typical age ranges for grades
            grade_age_map = {
                'kindergarten': (5, 6),
                'grade_1': (6, 7),
                'grade_2': (7, 8),
                'grade_3': (8, 9),
                'grade_4': (9, 10),
                'grade_5': (10, 11),
                'grade_6': (11, 12),
                'grade_7': (12, 13),
                'grade_8': (13, 14),
                'grade_9': (14, 15),
                'grade_10': (15, 16),
                'grade_11': (16, 17),
                'grade_12': (17, 18)
            }
            
            expected_range = grade_age_map.get(grade_level.lower())
            if expected_range:
                min_age, max_age = expected_range
                if not (min_age - 1 <= age <= max_age + 2):  # Allow some flexibility
                    return ValidationResult(
                        is_valid=False,
                        level=ValidationLevel.WARNING,
                        scope=ValidationScope.BUSINESS_RULE,
                        field_name="age_grade_consistency",
                        message=f"Student age ({age}) may not be typical for {grade_level}",
                        details={
                            "student_age": age,
                            "grade_level": grade_level,
                            "typical_age_range": f"{min_age}-{max_age + 1}"
                        },
                        suggested_fix="Verify grade level assignment is correct for student's age"
                    )
        
        except Exception as e:
            validation_logger.warning(f"Could not validate age-grade consistency: {e}")
        
        return None
    
    # Relationship Validators
    async def _validate_student_class_assignment(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate student-class assignment consistency"""
        if 'class_id' not in data or 'grade_level' not in data:
            return None
        
        try:
            class_doc = await self.db.classes.find_one({"_id": ObjectId(data['class_id'])})
            if class_doc:
                class_grade = class_doc.get('grade_level_id')
                student_grade = data['grade_level']
                
                if class_grade != student_grade:
                    return ValidationResult(
                        is_valid=False,
                        level=ValidationLevel.ERROR,
                        scope=ValidationScope.RELATIONSHIP,
                        field_name="class_grade_consistency",
                        message=f"Student grade level ({student_grade}) doesn't match class grade level ({class_grade})",
                        details={
                            "student_grade": student_grade,
                            "class_grade": class_grade,
                            "class_id": str(data['class_id'])
                        },
                        suggested_fix="Assign student to a class matching their grade level"
                    )
        
        except Exception as e:
            validation_logger.warning(f"Could not validate student-class assignment: {e}")
        
        return None
    
    async def _validate_teacher_class_assignment(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate teacher-class assignment"""
        # Implementation would check teacher availability and qualifications
        return None
    
    async def _validate_parent_student_relationship(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate parent-student relationship"""
        if context.collection_name != 'parent_student_links':
            return None
        
        # Check if both parent and student exist and are in same branch
        parent_id = data.get('parent_user_id')
        student_id = data.get('student_id')
        
        if parent_id and student_id:
            try:
                # Verify both exist and are in compatible branches
                parent = await self.db.parents.find_one({"user_id": parent_id})
                student = await self.db.students.find_one({"_id": ObjectId(student_id)})
                
                if not parent or not student:
                    return ValidationResult(
                        is_valid=False,
                        level=ValidationLevel.ERROR,
                        scope=ValidationScope.RELATIONSHIP,
                        field_name="parent_student_link",
                        message="Parent or student not found",
                        suggested_fix="Verify both parent and student exist"
                    )
                
                # Check branch compatibility
                if parent.get('branch_id') != student.get('branch_id'):
                    return ValidationResult(
                        is_valid=False,
                        level=ValidationLevel.WARNING,
                        scope=ValidationScope.RELATIONSHIP,
                        field_name="branch_compatibility",
                        message="Parent and student are in different branches",
                        suggested_fix="Ensure parent and student are in the same branch"
                    )
                    
            except Exception as e:
                validation_logger.warning(f"Could not validate parent-student relationship: {e}")
        
        return None
    
    async def _validate_exam_subject_class(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate exam subject-class consistency"""
        if context.collection_name != 'exams':
            return None
        
        # Check if subject is taught in the specified class
        subject_id = data.get('subject_id')
        class_id = data.get('class_id')
        
        if subject_id and class_id:
            try:
                # This would check if subject is part of class curriculum
                class_doc = await self.db.classes.find_one({"_id": ObjectId(class_id)})
                if class_doc:
                    class_subjects = class_doc.get('subjects', [])
                    if subject_id not in class_subjects:
                        return ValidationResult(
                            is_valid=False,
                            level=ValidationLevel.WARNING,
                            scope=ValidationScope.RELATIONSHIP,
                            field_name="subject_class_consistency",
                            message="Subject may not be taught in this class",
                            suggested_fix="Verify subject is part of class curriculum"
                        )
            except Exception as e:
                validation_logger.warning(f"Could not validate exam subject-class consistency: {e}")
        
        return None
    
    async def _validate_fee_student_grade(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate fee-student grade consistency"""
        if context.collection_name != 'fees':
            return None
        
        # Check if fee structure matches student's grade level
        return None
    
    async def _validate_attendance_student_class(self, data: Dict[str, Any], context: ValidationContext) -> Optional[ValidationResult]:
        """Validate attendance student-class relationship"""
        if context.collection_name != 'attendance':
            return None
        
        student_id = data.get('student_id')
        class_id = data.get('class_id')
        
        if student_id and class_id:
            try:
                # Check if student is enrolled in the class
                enrollment = await self.db.enrollments.find_one({
                    "student_id": ObjectId(student_id),
                    "class_id": ObjectId(class_id),
                    "status": "active"
                })
                
                if not enrollment:
                    return ValidationResult(
                        is_valid=False,
                        level=ValidationLevel.ERROR,
                        scope=ValidationScope.RELATIONSHIP,
                        field_name="student_class_enrollment",
                        message="Student is not enrolled in this class",
                        suggested_fix="Enroll student in class before marking attendance"
                    )
                    
            except Exception as e:
                validation_logger.warning(f"Could not validate attendance student-class relationship: {e}")
        
        return None
    
    # Helper methods
    async def _check_reference_exists(self, reference_id: str, collection_name: str, context: ValidationContext) -> bool:
        """Check if a referenced document exists"""
        try:
            # Handle ObjectId conversion
            if ObjectId.is_valid(reference_id):
                query = {"_id": ObjectId(reference_id)}
            else:
                query = {"_id": reference_id}
            
            # Add branch filtering if applicable
            if collection_name != 'branches' and context.branch_id:
                query["branch_id"] = context.branch_id
            
            collection = self.db[collection_name]
            doc = await collection.find_one(query)
            return doc is not None
        
        except Exception as e:
            validation_logger.error(f"Error checking reference existence: {e}")
            return False
    
    async def _get_cached_branches(self) -> Set[str]:
        """Get cached branch IDs"""
        cache_key = "branches"
        
        if (cache_key not in self._branch_cache or 
            datetime.now().timestamp() - self._last_cache_update.get(cache_key, 0) > self._cache_ttl):
            
            branches = await self.db.branches.find({}, {"_id": 1}).to_list(length=None)
            self._branch_cache[cache_key] = {str(b["_id"]) for b in branches}
            self._last_cache_update[cache_key] = datetime.now().timestamp()
        
        return self._branch_cache[cache_key]
    
    async def _get_cached_grade_levels(self, branch_id: Optional[str]) -> Set[str]:
        """Get cached grade levels for a branch"""
        cache_key = f"grade_levels_{branch_id or 'all'}"
        
        if (cache_key not in self._grade_level_cache or 
            datetime.now().timestamp() - self._last_cache_update.get(cache_key, 0) > self._cache_ttl):
            
            query = {"branch_id": branch_id} if branch_id else {}
            grade_levels = await self.db.grade_levels.find(query, {"name": 1}).to_list(length=None)
            self._grade_level_cache[cache_key] = {gl["name"] for gl in grade_levels}
            self._last_cache_update[cache_key] = datetime.now().timestamp()
        
        return self._grade_level_cache[cache_key]
    
    def _get_relevant_business_rules(self, collection_name: str) -> List[str]:
        """Get relevant business rules for a collection"""
        rules_map = {
            'students': ['student_age_grade_consistency'],
            'teachers': ['teacher_subject_qualification'],
            'exams': ['exam_date_academic_calendar'],
            'fees': ['fee_amount_grade_structure'],
            'classes': ['class_capacity_limits']
        }
        return rules_map.get(collection_name, [])
    
    def _get_relevant_relationships(self, collection_name: str) -> List[str]:
        """Get relevant relationship validations for a collection"""
        relationships_map = {
            'students': ['student_class_assignment', 'parent_student_relationship'],
            'teachers': ['teacher_class_assignment'],
            'exams': ['exam_subject_class_consistency'],
            'fees': ['fee_student_grade_consistency'],
            'attendance': ['attendance_student_class']
        }
        return relationships_map.get(collection_name, [])
    
    async def _log_validation_results(self, results: List[ValidationResult], context: ValidationContext):
        """Log validation results to audit system"""
        if not self.audit_logger:
            return
        
        error_count = sum(1 for r in results if r.level == ValidationLevel.ERROR)
        critical_count = sum(1 for r in results if r.level == ValidationLevel.CRITICAL)
        
        if error_count > 0 or critical_count > 0:
            await self.audit_logger.log_event(
                action=AuditAction.CREATE if context.operation == 'create' else AuditAction.UPDATE,
                user_id=context.user_id,
                resource_type=context.collection_name,
                resource_id=context.document_id,
                details={
                    "validation_errors": error_count,
                    "critical_errors": critical_count,
                    "operation": context.operation,
                    "failed_validations": [
                        {
                            "field": r.field_name,
                            "message": r.message,
                            "level": r.level.value
                        }
                        for r in results
                        if r.level in [ValidationLevel.ERROR, ValidationLevel.CRITICAL]
                    ]
                },
                severity=AuditSeverity.ERROR if critical_count > 0 else AuditSeverity.WARNING,
                branch_id=context.branch_id,
                success=critical_count == 0
            )

# Global validator instance
_data_validator_instance = None

async def get_data_validator(db) -> DataValidator:
    """Get or create the global data validator instance"""
    global _data_validator_instance
    if _data_validator_instance is None:
        _data_validator_instance = DataValidator(db)
        await _data_validator_instance.initialize()
    return _data_validator_instance

# Convenience functions for common validations
async def validate_student_data(student_data: Dict[str, Any], context: ValidationContext, db) -> List[ValidationResult]:
    """Validate student data specifically"""
    validator = await get_data_validator(db)
    return await validator.validate_document(student_data, context)

async def validate_referential_integrity(document_data: Dict[str, Any], context: ValidationContext, db) -> List[ValidationResult]:
    """Validate only referential integrity"""
    validator = await get_data_validator(db)
    return await validator.validate_document(document_data, context, validation_rules=['referential_integrity'])

# Export all components
__all__ = [
    'DataValidator',
    'ValidationResult',
    'ValidationContext',
    'ValidationLevel',
    'ValidationScope',
    'get_data_validator',
    'validate_student_data',
    'validate_referential_integrity'
]