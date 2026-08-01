from datetime import datetime
from pydantic import BaseModel, Field


class UserSettingCreate(BaseModel):
    """创建用户设置的Schema"""
    setting_key: str = Field(..., description="设置项key")
    setting_value: dict = Field(..., description="设置值(JSON格式)")


class UserSettingUpdate(BaseModel):
    """更新用户设置的Schema"""
    setting_value: dict = Field(..., description="设置值(JSON格式)")


class UserSettingResponse(UserSettingCreate):
    """用户设置响应Schema"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
