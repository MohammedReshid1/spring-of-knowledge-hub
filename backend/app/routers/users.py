from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Any, List
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel

from ..db import get_user_collection, validate_branch_id
from ..models.user import UserCreate, User
from ..utils.auth import get_password_hash, verify_password, create_access_token, decode_access_token

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")

async def get_current_user(token: str = Depends(oauth2_scheme), users: Any = Depends(get_user_collection)):
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    user = await users.find_one({"_id": ObjectId(payload["sub"])})
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

# List all users (admin only)
@router.get("/", response_model=List[User])
async def list_users(users: Any = Depends(get_user_collection), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "hq_admin", "branch_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    items = []
    async for user in users.find():
        items.append(User(
            id=str(user["_id"]),
            email=user["email"],
            full_name=user.get("full_name"),
            role=user.get("role"),
            phone=user.get("phone"),
            branch_id=user.get("branch_id"),
            created_at=user.get("created_at"),
            updated_at=user.get("updated_at"),
        ))
    return items

# Update user (admin only)
class UserUpdate(BaseModel):
    full_name: str
    role: str
    phone: str
    branch_id: str = None

@router.put("/{user_id}", response_model=User)
async def update_user(user_id: str, user_in: UserUpdate, users: Any = Depends(get_user_collection), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "hq_admin", "branch_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    now = datetime.utcnow()
    update_data = user_in.dict()
    update_data["updated_at"] = now
    res = await users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user = await users.find_one({"_id": ObjectId(user_id)})
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

# Delete user (admin only)
@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, users: Any = Depends(get_user_collection), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["super_admin", "hq_admin", "branch_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    res = await users.delete_one({"_id": ObjectId(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return None
