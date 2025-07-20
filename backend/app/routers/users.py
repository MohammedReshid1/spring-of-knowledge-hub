from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Any
from bson import ObjectId
from datetime import datetime

from ..db import get_user_collection, validate_branch_id
from ..models.user import UserCreate, User
from ..utils.auth import get_password_hash, verify_password, create_access_token, decode_access_token

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")

async def get_current_user(token: str = Depends(oauth2_scheme), users: Any = Depends(get_user_collection)):
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    
    user_id = payload["sub"]
    # Try to find user by ObjectId first, then by string ID
    try:
        user = await users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await users.find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return User(
        id=str(user["_id"]),
        email=user["email"],
        full_name=user.get("full_name"),
        role=user.get("role"),
        phone=user.get("phone"),
        branch_id=user.get("branch_id"),
        created_at=user.get("created_at"),
        updated_at=user.get("updated_at"),
    )

@router.post("/signup", response_model=User)
async def signup(user_in: UserCreate, users: Any = Depends(get_user_collection)):
    existing = await users.find_one({"email": user_in.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    # prepare user document
    now = datetime.utcnow()
    data = user_in.dict()
    # validate branch_id if provided
    if data.get("branch_id") is not None:
        await validate_branch_id(data["branch_id"])
    pwd = data.pop("password")
    data["hashed_password"] = get_password_hash(pwd)
    data["created_at"] = now
    data["updated_at"] = now
    result = await users.insert_one(data)
    return User(
        id=str(result.inserted_id),
        email=data["email"],
        full_name=data.get("full_name"),
        role=data.get("role"),
        phone=data.get("phone"),
        branch_id=data.get("branch_id"),
        created_at=now,
        updated_at=now,
    )

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), users: Any = Depends(get_user_collection)):
    user = await users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    access_token = create_access_token({"sub": str(user["_id"])})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
async def read_me(current_user: User = Depends(get_current_user)):
    return current_user
