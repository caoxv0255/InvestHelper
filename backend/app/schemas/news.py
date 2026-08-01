from datetime import datetime
from pydantic import BaseModel, Field


class NewsCreate(BaseModel):
    """创建快讯的Schema"""
    source: str = Field(..., description="来源: eastmoney/ths/sina")
    title: str = Field(..., description="标题")
    content: str = Field(..., description="内容")
    url: str | None = Field(None, description="原文链接")
    publish_time: datetime = Field(..., description="发布时间(UTC)")
    is_important: bool = Field(False, description="是否重磅")
    keywords: list[str] | None = Field(None, description="匹配的关键词(JSON数组)")
    content_hash: str | None = Field(None, description="内容哈希(用于去重)")


class NewsUpdate(BaseModel):
    """更新快讯的Schema"""
    source: str | None = Field(None, description="来源")
    title: str | None = Field(None, description="标题")
    content: str | None = Field(None, description="内容")
    url: str | None = Field(None, description="原文链接")
    publish_time: datetime | None = Field(None, description="发布时间(UTC)")
    is_important: bool | None = Field(None, description="是否重磅")
    keywords: list[str] | None = Field(None, description="匹配的关键词(JSON数组)")
    content_hash: str | None = Field(None, description="内容哈希(用于去重)")


class NewsResponse(NewsCreate):
    """快讯响应Schema"""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
