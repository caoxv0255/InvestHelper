from datetime import datetime
from sqlalchemy import String, Text, DateTime, Boolean, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import BaseModel


class News(BaseModel):
    """快讯表模型"""
    __tablename__ = "news"

    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="来源: eastmoney/ths/sina"
    )
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="标题"
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="内容"
    )
    url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
        comment="原文链接"
    )
    publish_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="发布时间(UTC)"
    )
    is_important: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
        comment="是否重磅"
    )
    keywords: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
        comment="匹配的关键词(JSON数组)"
    )
    content_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        comment="内容哈希(用于去重)"
    )

    __table_args__ = (
        UniqueConstraint('source', 'url', name='uq_news_source_url'),
    )
