from sqlalchemy import String, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import BaseModel


class UserSetting(BaseModel):
    """用户设置表模型"""
    __tablename__ = "user_settings"

    setting_key: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="设置项key"
    )
    setting_value: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="设置值(JSON格式)"
    )
