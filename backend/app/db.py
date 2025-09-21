from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import Depends, HTTPException, status
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.spring_of_knowledge

def get_db():
    return db

# Dependency functions to fetch specific collections
    
def get_user_collection(db=Depends(get_db)):
    return db["users"]

    
def get_branch_collection(db=Depends(get_db)):
    return db["branches"]

    
def get_student_collection(db=Depends(get_db)):
    return db["students"]


def get_teacher_collection(db=Depends(get_db)):
    return db["teachers"]


def get_reports_collection(db=Depends(get_db)):
    return db["reports"]


def get_student_reports_collection(db=Depends(get_db)):
    return db["student_reports"]


def get_class_reports_collection(db=Depends(get_db)):
    return db["class_reports"]


def get_exam_analyses_collection(db=Depends(get_db)):
    return db["exam_analyses"]


def get_financial_reports_collection(db=Depends(get_db)):
    return db["financial_reports"]


def get_fee_templates_collection(db=Depends(get_db)):
    return db["fee_templates"]


def get_attendance_reports_collection(db=Depends(get_db)):
    return db["attendance_reports"]


def get_report_templates_collection(db=Depends(get_db)):
    return db["report_templates"]


def get_report_schedules_collection(db=Depends(get_db)):
    return db["report_schedules"]


def get_notification_templates_collection(db=Depends(get_db)):
    return db["notification_templates"]


def get_notification_recipients_collection(db=Depends(get_db)):
    return db["notification_recipients"]


def get_notification_preferences_collection(db=Depends(get_db)):
    return db["notification_preferences"]


def get_notification_queue_collection(db=Depends(get_db)):
    return db["notification_queue"]


def get_notification_batches_collection(db=Depends(get_db)):
    return db["notification_batches"]


def get_notification_campaigns_collection(db=Depends(get_db)):
    return db["notification_campaigns"]


def get_notification_analytics_collection(db=Depends(get_db)):
    return db["notification_analytics"]


def get_push_devices_collection(db=Depends(get_db)):
    return db["push_devices"]


def get_notification_settings_collection(db=Depends(get_db)):
    return db["notification_settings"]


def get_assets_collection(db=Depends(get_db)):
    return db["assets"]


def get_supplies_collection(db=Depends(get_db)):
    return db["supplies"]


def get_inventory_transactions_collection(db=Depends(get_db)):
    return db["inventory_transactions"]


def get_maintenance_records_collection(db=Depends(get_db)):
    return db["maintenance_records"]


def get_inventory_requests_collection(db=Depends(get_db)):
    return db["inventory_requests"]


def get_purchase_orders_collection(db=Depends(get_db)):
    return db["purchase_orders"]


def get_inventory_audits_collection(db=Depends(get_db)):
    return db["inventory_audits"]


def get_inventory_audit_items_collection(db=Depends(get_db)):
    return db["inventory_audit_items"]


def get_vendors_collection(db=Depends(get_db)):
    return db["vendors"]


def get_inventory_settings_collection(db=Depends(get_db)):
    return db["inventory_settings"]

async def validate_branch_id(branch_id: str) -> str:
    """
    Ensure the branch_id exists in the branches collection.
    Special case: 'all' is allowed for multi-branch queries.
    """
    # Allow 'all' as a special case for multi-branch queries
    if branch_id == "all":
        return branch_id

    # use global db to get branches collection
    branches = db["branches"]
    if not ObjectId.is_valid(branch_id) or not await branches.find_one({"_id": ObjectId(branch_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid branch_id"
        )
    return branch_id
 
async def validate_student_id(student_id: str) -> str:
    """
    Ensure the student_id exists in the students collection.
    """
    students = db["students"]
    # Validate by custom student_id field or by MongoDB _id
    # First try custom field
    student = await students.find_one({"student_id": student_id})
    if not student:
        # Try matching MongoDB _id
        if ObjectId.is_valid(student_id):
            student = await students.find_one({"_id": ObjectId(student_id)})
    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid student_id"
        )
    return student_id

async def validate_subject_id(subject_id: str) -> str:
    """
    Ensure the subject_id exists in the subjects collection.
    """
    subjects = db["subjects"]
    if not ObjectId.is_valid(subject_id) or not await subjects.find_one({"_id": ObjectId(subject_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subject_id"
        )
    return subject_id

async def validate_teacher_id(teacher_id: str) -> str:
    """
    Ensure the teacher_id exists in the teachers collection.
    """
    teachers = db["teachers"]
    # Validate ObjectId and existence in teachers collection
    if not ObjectId.is_valid(teacher_id) or not await teachers.find_one({"_id": ObjectId(teacher_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teacher not found or invalid"
        )
    return teacher_id

async def validate_grade_level_id(grade_level_id: str) -> str:
    """
    Ensure the grade_level_id exists in the grade_levels collection.
    """
    grade_levels = db["grade_levels"]
    if not ObjectId.is_valid(grade_level_id) or not await grade_levels.find_one({"_id": ObjectId(grade_level_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid grade_level_id"
        )
    return grade_level_id

async def validate_class_id(class_id: str) -> str:
    """
    Ensure the class_id exists in the classes collection.
    """
    classes = db["classes"]
    if not ObjectId.is_valid(class_id) or not await classes.find_one({"_id": ObjectId(class_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid class_id"
        )
    return class_id


async def validate_fee_category_id(fee_category_id: str) -> str:
    """
    Ensure the fee_category_id exists in the fee_categories collection.
    """
    fee_categories = db["fee_categories"]
    if not ObjectId.is_valid(fee_category_id) or not await fee_categories.find_one({"_id": ObjectId(fee_category_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid fee_category_id"
        )
    return fee_category_id


async def validate_payment_id(payment_id: str) -> str:
    """
    Ensure the payment_id exists in the payments collection.
    """
    payments = db["payments"]
    if not ObjectId.is_valid(payment_id) or not await payments.find_one({"_id": ObjectId(payment_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment_id"
        )
    return payment_id


def get_attendance_collection(db=Depends(get_db)):
    return db["attendance"]


def get_backup_logs_collection(db=Depends(get_db)):
    return db["backup_logs"]


def get_classes_collection(db=Depends(get_db)):
    return db["classes"]


def get_fees_collection(db=Depends(get_db)):
    return db["fees"]


def get_fee_structures_collection(db=Depends(get_db)):
    return db["fee_structures"]


def get_payment_transactions_collection(db=Depends(get_db)):
    return db["payment_transactions"]


def get_payment_links_collection(db=Depends(get_db)):
    return db["payment_links"]


def get_payment_gateways_collection(db=Depends(get_db)):
    return db["payment_gateways"]


def get_payment_webhooks_collection(db=Depends(get_db)):
    return db["payment_webhooks"]


def get_bulk_fee_generations_collection(db=Depends(get_db)):
    return db["bulk_fee_generations"]


def get_refunds_collection(db=Depends(get_db)):
    return db["refunds"]


def get_students_collection(db=Depends(get_db)):
    return db["students"]


def get_grade_levels_collection(db=Depends(get_db)):
    return db["grade_levels"]


def get_grade_transitions_collection(db=Depends(get_db)):
    return db["grade_transitions"]


def get_payment_mode_collection(db=Depends(get_db)):
    return db["payment_mode"]


def get_registration_payments_collection(db=Depends(get_db)):
    return db["registration_payments"]


def get_student_enrollments_collection(db=Depends(get_db)):
    return db["student_enrollments"]


def get_subjects_collection(db=Depends(get_db)):
    return db["subjects"]


def get_exams_collection(db=Depends(get_db)):
    return db["exams"]


def get_exam_results_collection(db=Depends(get_db)):
    return db["exam_results"]


def get_grading_scales_collection(db=Depends(get_db)):
    return db["grading_scales"]


def get_assignments_collection(db=Depends(get_db)):
    return db["assignments"]


def get_assignment_submissions_collection(db=Depends(get_db)):
    return db["assignment_submissions"]


def get_academic_years_collection(db=Depends(get_db)):
    return db["academic_years"]


def get_terms_collection(db=Depends(get_db)):
    return db["terms"]


def get_academic_events_collection(db=Depends(get_db)):
    return db["academic_events"]


def get_timetable_slots_collection(db=Depends(get_db)):
    return db["timetable_slots"]


def get_holidays_collection(db=Depends(get_db)):
    return db["holidays"]


def get_messages_collection(db=Depends(get_db)):
    return db["messages"]


def get_message_recipients_collection(db=Depends(get_db)):
    return db["message_recipients"]


def get_notifications_collection(db=Depends(get_db)):
    return db["notifications"]


def get_announcements_collection(db=Depends(get_db)):
    return db["announcements"]


def get_parent_student_links_collection(db=Depends(get_db)):
    return db["parent_student_links"]


def get_parents_collection(db=Depends(get_db)):
    return db["parents"]


def get_communication_settings_collection(db=Depends(get_db)):
    return db["communication_settings"]


def get_books_collection(db=Depends(get_db)):
    return db["books"]


def get_borrow_requests_collection(db=Depends(get_db)):
    return db["borrow_requests"]


def get_borrow_records_collection(db=Depends(get_db)):
    return db["borrow_records"]


def get_library_members_collection(db=Depends(get_db)):
    return db["library_members"]


def get_library_settings_collection(db=Depends(get_db)):
    return db["library_settings"]


def get_reservations_collection(db=Depends(get_db)):
    return db["reservations"]


def get_digital_resources_collection(db=Depends(get_db)):
    return db["digital_resources"]


def get_routes_collection(db=Depends(get_db)):
    return db["routes"]


def get_vehicles_collection(db=Depends(get_db)):
    return db["vehicles"]


def get_drivers_collection(db=Depends(get_db)):
    return db["drivers"]


def get_transport_assignments_collection(db=Depends(get_db)):
    return db["transport_assignments"]


def get_trips_collection(db=Depends(get_db)):
    return db["trips"]


def get_transport_attendance_collection(db=Depends(get_db)):
    return db["transport_attendance"]


def get_transport_fees_collection(db=Depends(get_db)):
    return db["transport_fees"]


def get_gps_locations_collection(db=Depends(get_db)):
    return db["gps_locations"]


def get_emergency_contacts_collection(db=Depends(get_db)):
    return db["emergency_contacts"]


def get_incidents_collection(db=Depends(get_db)):
    return db["incidents"]


def get_disciplinary_actions_collection(db=Depends(get_db)):
    return db["disciplinary_actions"]


def get_behavior_points_collection(db=Depends(get_db)):
    return db["behavior_points"]


def get_rewards_collection(db=Depends(get_db)):
    return db["rewards"]


def get_counseling_sessions_collection(db=Depends(get_db)):
    return db["counseling_sessions"]


def get_behavior_contracts_collection(db=Depends(get_db)):
    return db["behavior_contracts"]


def get_behavior_rubrics_collection(db=Depends(get_db)):
    return db["behavior_rubrics"]


def get_parent_meetings_collection(db=Depends(get_db)):
    return db["parent_meetings"]


def get_report_schedules_collection(db=Depends(get_db)):
    return db["report_schedules"]


# Payment Management Collections
def get_fee_categories_collection(db=Depends(get_db)):
    return db["fee_categories"]


def get_payments_collection(db=Depends(get_db)):
    return db["payments"]


def get_payment_details_collection(db=Depends(get_db)):
    return db["payment_details"]


def get_payment_receipts_collection(db=Depends(get_db)):
    return db["payment_receipts"]


def get_receipt_templates_collection(db=Depends(get_db)):
    return db["receipt_templates"]

# Branches collection (used by payment receipts and other features)
def get_branches_collection(db=Depends(get_db)):
    return db["branches"]
