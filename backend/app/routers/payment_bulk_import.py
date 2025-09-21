from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorCollection
import io

from ..db import (
    get_payments_collection,
    get_payment_details_collection,
    get_students_collection,
    get_fee_categories_collection,
    validate_branch_id
)
from ..utils.rbac import get_current_user, has_permission, Permission
from ..utils.bulk_import_handler import (
    PaymentBulkImporter,
    BulkImportError,
    validate_file_size,
    is_supported_file_type
)

router = APIRouter()

@router.post("/upload")
async def bulk_import_payments(
    file: UploadFile = File(..., description="CSV or Excel file with payment data"),
    branch_id: str = Form(..., description="Branch ID for the payments"),
    dry_run: bool = Form(False, description="Validate only, don't actually import"),
    skip_validation: bool = Form(False, description="Skip validation for faster import"),
    sheet_name: Optional[str] = Form(None, description="Excel sheet name (for .xlsx files)"),
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    payment_details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection),
    students_collection: AsyncIOMotorCollection = Depends(get_students_collection),
    fee_categories_collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Bulk import payments from CSV or Excel file"""

    if not has_permission(current_user.get("role"), Permission.CREATE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_branch_id(branch_id)

    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file uploaded"
        )

    if not is_supported_file_type(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Please upload CSV, XLS, or XLSX files only."
        )

    # Read file content
    try:
        file_content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}"
        )

    # Validate file size (10MB limit)
    if not validate_file_size(file_content, max_size_mb=10):
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds 10MB limit"
        )

    # Initialize importer
    importer = PaymentBulkImporter(
        payments_collection,
        payment_details_collection,
        students_collection,
        fee_categories_collection
    )

    try:
        # Process file based on type
        file_extension = file.filename.lower().split('.')[-1]

        if file_extension == 'csv':
            results = await importer.process_csv_file(
                file_content,
                branch_id,
                current_user["id"],
                skip_validation,
                dry_run
            )
        else:  # xlsx or xls
            results = await importer.process_excel_file(
                file_content,
                branch_id,
                current_user["id"],
                sheet_name,
                skip_validation,
                dry_run
            )

        # Add metadata
        results.update({
            "file_name": file.filename,
            "file_size_bytes": len(file_content),
            "branch_id": branch_id,
            "dry_run": dry_run,
            "processed_by": current_user["id"],
            "processed_at": "now"  # Would be actual timestamp
        })

        return results

    except BulkImportError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )

@router.get("/template")
async def download_import_template(
    branch_id: str,
    format: str = "csv",
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    payment_details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection),
    students_collection: AsyncIOMotorCollection = Depends(get_students_collection),
    fee_categories_collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Download CSV template for bulk import"""

    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_branch_id(branch_id)

    if format.lower() != "csv":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV format is supported for templates"
        )

    # Initialize importer
    importer = PaymentBulkImporter(
        payments_collection,
        payment_details_collection,
        students_collection,
        fee_categories_collection
    )

    # Generate template
    template_content = importer.generate_template_csv(branch_id)

    # Return as downloadable file
    return StreamingResponse(
        io.BytesIO(template_content.encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=payment_import_template_{branch_id}.csv"
        }
    )

@router.post("/validate")
async def validate_import_file(
    file: UploadFile = File(..., description="File to validate"),
    branch_id: str = Form(..., description="Branch ID for validation"),
    sheet_name: Optional[str] = Form(None, description="Excel sheet name"),
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    payment_details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection),
    students_collection: AsyncIOMotorCollection = Depends(get_students_collection),
    fee_categories_collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Validate import file without importing data"""

    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    # This is essentially the same as bulk_import_payments with dry_run=True
    return await bulk_import_payments(
        file=file,
        branch_id=branch_id,
        dry_run=True,
        skip_validation=False,
        sheet_name=sheet_name,
        current_user=current_user,
        payments_collection=payments_collection,
        payment_details_collection=payment_details_collection,
        students_collection=students_collection,
        fee_categories_collection=fee_categories_collection
    )

@router.get("/import-history")
async def get_import_history(
    branch_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get history of bulk imports"""

    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_branch_id(branch_id)

    # This would query an import_history collection if we had one
    # For now, return placeholder
    return {
        "branch_id": branch_id,
        "imports": [],
        "total": 0,
        "message": "Import history feature not yet implemented"
    }

@router.post("/export-errors")
async def export_import_errors(
    import_results: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    payment_details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection),
    students_collection: AsyncIOMotorCollection = Depends(get_students_collection),
    fee_categories_collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Export import errors as CSV file"""

    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Initialize importer
    importer = PaymentBulkImporter(
        payments_collection,
        payment_details_collection,
        students_collection,
        fee_categories_collection
    )

    # Generate error report
    error_csv = importer.generate_error_report(import_results)

    if not error_csv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No errors to export"
        )

    # Return as downloadable file
    return StreamingResponse(
        io.BytesIO(error_csv.encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=import_errors.csv"
        }
    )