from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import settings
from db import db, normalize_user_id, users_collection, utcnow
from email_utils import send_email
from models import (
    AuthMessageOut,
    ForgotPassword,
    ForgotPasswordResponse,
    HealthResponse,
    LoginResponse,
    ProfileImageUpdate,
    ProfileImagesResponse,
    ProfileResponse,
    ResetPassword,
    UserCreate,
    UserLogin,
    VerifyOTP,
    VerifyOTPResponse,
)
from security import (
    create_access_token,
    decode_access_token,
    generate_otp,
    generate_reset_token,
    hash_otp,
    hash_password,
    is_password_hash,
    is_strong_password,
    verify_password,
)


router = APIRouter(prefix="/api", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

PROFILE_IMAGES_DIR = Path(__file__).resolve().parent / "static" / "profile-images"
PROFILE_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def get_profile_image_keys() -> list[str]:
    if not PROFILE_IMAGES_DIR.exists():
        return []
    return sorted(
        [
            path.name
            for path in PROFILE_IMAGES_DIR.iterdir()
            if path.is_file() and path.suffix.lower() in PROFILE_IMAGE_EXTENSIONS
        ]
    )


def get_default_profile_image_key() -> str:
    keys = get_profile_image_keys()
    return keys[0] if keys else ""


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(credentials.credentials)
    email = normalize_user_id(payload["sub"])
    try:
        user = await users_collection.find_one({"email": email})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    user["_access_token"] = credentials.credentials
    return user


def _sanitize_user(user: dict) -> dict:
    allowed_keys = get_profile_image_keys()
    default_key = allowed_keys[0] if allowed_keys else ""
    profile_image_key = user.get("profileImageKey") or default_key
    if profile_image_key not in allowed_keys:
        profile_image_key = default_key
    return {
        "name": user.get("name", "User"),
        "email": user.get("email", ""),
        "profileImageKey": profile_image_key,
        "allowedProfileImageKeys": allowed_keys,
    }


@router.post("/signup", response_model=AuthMessageOut, status_code=status.HTTP_201_CREATED)
async def signup(user: UserCreate, background_tasks: BackgroundTasks):
    email = normalize_user_id(str(user.email))
    if not is_strong_password(user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Weak password. Use at least 8 characters with letters and numbers.",
        )

    try:
        existing_user = await users_collection.find_one({"email": email})
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

        user_dict = user.model_dump()
        user_dict["email"] = email
        user_dict["password"] = hash_password(user.password)
        user_dict["profileImageKey"] = get_default_profile_image_key()
        user_dict["password_reset"] = {"otp_hash": None, "expires_at": None, "verified_until": None, "reset_token": None}
        await users_collection.insert_one(user_dict)
    except HTTPException:
        raise
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered") from exc
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc

    background_tasks.add_task(
        send_email,
        email,
        "Welcome to NoteKit",
        f"Hi {user.name}, your NoteKit account has been created successfully.",
    )
    return AuthMessageOut(message="User registered successfully")


@router.post("/login", response_model=LoginResponse)
async def login(data: UserLogin):
    email = normalize_user_id(str(data.email))
    try:
        user = await users_collection.find_one({"email": email})
        if user and not is_password_hash(user.get("password")) and verify_password(data.password, user.get("password")):
            await users_collection.update_one({"_id": user["_id"]}, {"$set": {"password": hash_password(data.password)}})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not verify_password(data.password, user.get("password")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")

    token = create_access_token(subject=email, expires_delta=timedelta(minutes=settings.access_token_expire_minutes))
    profile = _sanitize_user(user)
    return LoginResponse(
        message="Login successful",
        token=token,
        name=profile["name"],
        profileImageKey=profile["profileImageKey"],
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(data: ForgotPassword, background_tasks: BackgroundTasks):
    email = normalize_user_id(str(data.email))
    try:
        user = await users_collection.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        otp = generate_otp()
        expires_at = utcnow() + timedelta(minutes=settings.otp_expire_minutes)
        await users_collection.update_one(
            {"email": email},
            {
                "$set": {
                    "password_reset.otp_hash": hash_otp(otp),
                    "password_reset.expires_at": expires_at,
                    "password_reset.verified_until": None,
                    "password_reset.reset_token": None,
                }
            },
        )
    except HTTPException:
        raise
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc

    background_tasks.add_task(
        send_email,
        email,
        "NoteKit password reset code",
        f"Your NoteKit OTP is {otp}. It expires in {settings.otp_expire_minutes} minutes.",
    )
    return ForgotPasswordResponse(message="OTP sent")


@router.post("/verify-otp", response_model=VerifyOTPResponse)
async def verify_otp(data: VerifyOTP):
    email = normalize_user_id(str(data.email))
    try:
        user = await users_collection.find_one({"email": email})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    reset_state = user.get("password_reset") or {}
    otp_hash = reset_state.get("otp_hash")
    expires_at = reset_state.get("expires_at")
    if not otp_hash or not expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No OTP request found")
    if expires_at < utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expired OTP")
    if not verify_password(data.otp, otp_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email or OTP")

    reset_token = generate_reset_token()
    verified_until = utcnow() + timedelta(minutes=settings.password_reset_window_minutes)
    try:
        await users_collection.update_one(
            {"email": email},
            {
                "$set": {
                    "password_reset.otp_hash": None,
                    "password_reset.expires_at": None,
                    "password_reset.verified_until": verified_until,
                    "password_reset.reset_token": hash_password(reset_token),
                }
            },
        )
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
    return VerifyOTPResponse(message="OTP verified", resetToken=reset_token)


@router.post("/reset-password", response_model=AuthMessageOut)
async def reset_password(data: ResetPassword):
    email = normalize_user_id(str(data.email))
    if not is_strong_password(data.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Weak password. Use at least 8 characters with letters and numbers.",
        )

    try:
        user = await users_collection.find_one({"email": email})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    reset_state = user.get("password_reset") or {}
    verified_until = reset_state.get("verified_until")
    reset_token_hash = reset_state.get("reset_token")
    if not verified_until or verified_until < utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password reset verification expired")
    if data.resetToken and reset_token_hash and not verify_password(data.resetToken, reset_token_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid password reset token")

    try:
        await users_collection.update_one(
            {"email": email},
            {
                "$set": {"password": hash_password(data.password)},
                "$unset": {
                    "password_reset.otp_hash": "",
                    "password_reset.expires_at": "",
                    "password_reset.verified_until": "",
                    "password_reset.reset_token": "",
                },
            },
        )
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return AuthMessageOut(message="Password reset successfully")


@router.get("/protected", response_model=AuthMessageOut)
async def protected_route(current_user=Depends(get_current_user)):
    return AuthMessageOut(message=f"Hello {current_user.get('name', 'user')}, you accessed a protected route.")


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(current_user=Depends(get_current_user)):
    profile = _sanitize_user(current_user)
    return ProfileResponse(**profile)


@router.put("/profile-image", response_model=AuthMessageOut)
async def update_profile_image(payload: ProfileImageUpdate, current_user=Depends(get_current_user)):
    key = payload.profileImageKey
    allowed_keys = get_profile_image_keys()
    if key not in allowed_keys:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid profile image option")
    try:
        await users_collection.update_one({"_id": current_user["_id"]}, {"$set": {"profileImageKey": key}})
    except PyMongoError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return AuthMessageOut(message="Profile image updated")


@router.get("/profile-images", response_model=ProfileImagesResponse)
async def get_profile_images():
    return ProfileImagesResponse(profileImageKeys=get_profile_image_keys())


@router.get("/health", response_model=HealthResponse)
async def health_check():
    try:
        await db.command("ping")
    except PyMongoError as exc:
        return HealthResponse(status="error", message=str(exc))
    return HealthResponse(status="ok", message="Connected to MongoDB successfully!")
