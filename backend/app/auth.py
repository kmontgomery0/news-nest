from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from passlib.context import CryptContext
from .mongo import get_users_collection, get_user_preferences_collection
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError, ConnectionFailure
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Use pbkdf2_sha256 to avoid native bcrypt build issues across environments
password_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

@router.get("/check-email")
def check_email(email: str):
    """Return availability of an email address."""
    normalized = (email or "").strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Email cannot be empty.")
    
    try:
        users = get_users_collection()
        exists = users.find_one({"email": normalized})
        return {"available": not bool(exists)}
    except (ServerSelectionTimeoutError, ConnectionFailure) as e:
        logger.error(f"MongoDB connection error in check_email: {e}")
        # Return a default response that allows the user to proceed
        # This is better than blocking registration/login when DB is temporarily unavailable
        return {"available": True, "note": "Database temporarily unavailable, assuming email available"}
    except Exception as e:
        logger.error(f"Unexpected error in check_email: {e}")
        raise HTTPException(status_code=500, detail="Database error. Please try again later.")

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    email: str = Field(..., max_length=256)
    password: str = Field(..., min_length=6, max_length=256)


class RegisterResponse(BaseModel):
    success: bool
    message: str


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=256)
    password: str = Field(..., min_length=6, max_length=256)


class LoginResponse(BaseModel):
    success: bool
    message: str


@router.post("/register", response_model=RegisterResponse)
def register_user(payload: RegisterRequest):
    try:
        users = get_users_collection()
        name = payload.name.strip()
        email = payload.email.strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="Email cannot be empty.")
        # Check email existence (must be unique)
        existing = users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use.")
        # Hash password
        password_hash = password_context.hash(payload.password)
        doc = {
            "name": name,
            "email": email,
            "password_hash": password_hash,
            "created_at": datetime.now(timezone.utc),
        }
        try:
            result = users.insert_one(doc)
            print(f"[auth.register] Inserted user id={result.inserted_id} email={email}")
        except DuplicateKeyError:
            raise HTTPException(status_code=409, detail="Email already in use.")
        return RegisterResponse(success=True, message="User registered.")
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except (ServerSelectionTimeoutError, ConnectionFailure) as e:
        logger.error(f"MongoDB connection error in register_user: {e}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again later.")
    except Exception as e:
        logger.error(f"Unexpected error in register_user: {e}")
        raise HTTPException(status_code=500, detail="Database error. Please try again later.")

class PreferencesRequest(BaseModel):
    email: str = Field(..., max_length=256)
    parrot_name: str = Field("", max_length=64)
    times: Optional[list[str]] = None
    frequency: Optional[str] = Field(None, max_length=16)
    push_notifications: Optional[bool] = None
    email_summaries: Optional[bool] = None
    topics: Optional[list[str]] = None

class PreferencesResponse(BaseModel):
    success: bool
    message: str

@router.post("/preferences", response_model=PreferencesResponse)
def upsert_preferences(payload: PreferencesRequest):
    users = get_users_collection()
    prefs = get_user_preferences_collection()
    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email cannot be empty.")
    # Ensure the user exists first
    user = users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found for provided email.")
    update_doc: Dict[str, Any] = {
        "email": email,
        "parrot_name": (payload.parrot_name or "").strip(),
        "times": payload.times or [],
        "frequency": payload.frequency or "",
        "push_notifications": bool(payload.push_notifications) if payload.push_notifications is not None else False,
        "email_summaries": bool(payload.email_summaries) if payload.email_summaries is not None else False,
        "topics": payload.topics or [],
        "updated_at": datetime.now(timezone.utc),
    }
    # upsert
    prefs.update_one(
        {"email": email},
        {"$set": update_doc, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return PreferencesResponse(success=True, message="Preferences saved.")

class ProfileUpdateRequest(BaseModel):
    email: str = Field(..., max_length=256)
    name: Optional[str] = Field(None, max_length=64)
    password: Optional[str] = Field(None, min_length=6, max_length=256)

class ProfileUpdateResponse(BaseModel):
    success: bool
    message: str

@router.post("/profile", response_model=ProfileUpdateResponse)
def update_profile(payload: ProfileUpdateRequest):
    users = get_users_collection()
    email = (payload.email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email cannot be empty.")
    user = users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    update_doc: Dict[str, Any] = {}
    if payload.name is not None:
        update_doc["name"] = payload.name.strip()
    if payload.password:
        update_doc["password_hash"] = password_context.hash(payload.password)
    if not update_doc:
        return ProfileUpdateResponse(success=True, message="No changes.")
    users.update_one({"email": email}, {"$set": update_doc})
    return ProfileUpdateResponse(success=True, message="Profile updated.")

@router.get("/profile")
def get_profile(email: str):
    users = get_users_collection()
    normalized = (email or "").strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Email cannot be empty.")
    user = users.find_one({"email": normalized}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user

@router.get("/preferences")
def get_preferences(email: str):
    prefs = get_user_preferences_collection()
    normalized = (email or "").strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Email cannot be empty.")
    doc = prefs.find_one({"email": normalized}, {"_id": 0})
    if not doc:
        # Return empty defaults
        return {
            "email": normalized,
            "parrot_name": "",
            "times": [],
            "frequency": "",
            "push_notifications": False,
            "email_summaries": False,
            "topics": [],
        }
    return doc

@router.post("/login", response_model=LoginResponse)
def login_user(payload: LoginRequest):
    try:
        users = get_users_collection()
        email = payload.email.strip().lower()
        user = users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        password_hash = user.get("password_hash") or ""
        if not password_context.verify(payload.password, password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        return LoginResponse(success=True, message="Login successful.")
    except HTTPException:
        # Re-raise HTTP exceptions (like 401)
        raise
    except (ServerSelectionTimeoutError, ConnectionFailure) as e:
        logger.error(f"MongoDB connection error in login_user: {e}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again later.")
    except Exception as e:
        logger.error(f"Unexpected error in login_user: {e}")
        raise HTTPException(status_code=500, detail="Database error. Please try again later.")


