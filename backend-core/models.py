from __future__ import annotations

from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Note(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    id: Optional[str] = Field(default=None)
    title: str = Field(..., min_length=1, max_length=160)
    content: str = Field(default="", max_length=20000)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AuthMessageOut(BaseModel):
    message: str


class LoginResponse(BaseModel):
    message: str
    token: str
    name: str = ""
    profileImageKey: str = ""


class ForgotPasswordResponse(BaseModel):
    message: str


class VerifyOTPResponse(BaseModel):
    message: str
    resetToken: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    message: str


class ProfileResponse(BaseModel):
    name: str
    email: EmailStr
    profileImageKey: str = ""
    allowedProfileImageKeys: list[str] = Field(default_factory=list)


class ProfileImagesResponse(BaseModel):
    profileImageKeys: list[str] = Field(default_factory=list)


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    phoneNumber: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class ForgotPassword(BaseModel):
    email: EmailStr


class VerifyOTP(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResetPassword(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    resetToken: Optional[str] = Field(default=None, min_length=16, max_length=128)


class ProfileImageUpdate(BaseModel):
    profileImageKey: str = Field(..., min_length=1, max_length=120)


class TodoItemIn(BaseModel):
    id: Optional[int] = Field(default=None, ge=1)
    text: str = Field(default="", max_length=300)
    done: bool = False
    reminderDate: Optional[str] = Field(default="")
    reminderTime: Optional[str] = Field(default="")
    reminderEnabled: bool = False
    notificationId: Optional[str] = Field(default="", max_length=120)


class TodoBlockIn(BaseModel):
    title: Optional[str] = Field(default="Untitled List", min_length=1, max_length=160)
    items: Optional[List[TodoItemIn]] = None
    listType: Optional[Literal["project", "task"]] = "project"


class TodoItem(BaseModel):
    id: int = Field(..., ge=1)
    text: str = Field(default="", max_length=300)
    done: bool
    reminderDate: Optional[str] = ""
    reminderTime: Optional[str] = ""
    reminderEnabled: bool = False
    notificationId: Optional[str] = ""


class TodoBlock(BaseModel):
    id: str = Field(..., alias="id")
    title: str
    items: List[TodoItem]
    listType: Literal["project", "task"] = "project"


class SlotIn(BaseModel):
    slot_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=160)
    start: str
    end: str
    category: Optional[str] = Field(default="General", max_length=80)


class WeeklyTemplateIn(BaseModel):
    mode: str
    constant: List[SlotIn]
    monday: List[SlotIn]
    tuesday: List[SlotIn]
    wednesday: List[SlotIn]
    thursday: List[SlotIn]
    friday: List[SlotIn]
    saturday: List[SlotIn]
    sunday: List[SlotIn]


class MarkCompleteIn(BaseModel):
    task_id: str
    date: date
