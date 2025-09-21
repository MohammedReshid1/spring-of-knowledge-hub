from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import FileResponse
import os
import shutil
from pathlib import Path
from typing import List
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("public/lovable-uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file to the server
    """
    try:
        # Create a unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{os.urandom(16).hex()}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Return the file URL
        return {
            "filename": unique_filename,
            "original_name": file.filename,
            "url": f"/uploads/{unique_filename}",
            "size": file_path.stat().st_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/files")
async def list_files(
    current_user: User = Depends(get_current_user)
):
    """
    List all uploaded files
    """
    try:
        files = []
        for file_path in UPLOAD_DIR.iterdir():
            if file_path.is_file():
                files.append({
                    "filename": file_path.name,
                    "size": file_path.stat().st_size,
                    "url": f"/uploads/{file_path.name}"
                })
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")

@router.get("/{filename}")
async def get_file(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific file
    """
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)

@router.delete("/{filename}")
async def delete_file(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a specific file
    """
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        file_path.unlink()
        return {"message": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
