from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field


class OpportunityCreate(BaseModel):
    """创建投资机会的Schema"""
    code: str = Field(..., description="标的代码")
    name: str = Field(..., description="标的名称")
    opportunity_type: str = Field(..., description="机会类型: sector_momentum/tech_signal/fund_flow")
    score: float = Field(..., ge=0, le=100, description="综合评分 0-100")
    price: Decimal = Field(..., description="当前价格")
    reason: dict = Field(..., description="推荐理由(JSON)")
    discovered_date: date = Field(..., description="发现日期")
    status: str = Field("active", description="状态: active/expired")


class OpportunityUpdate(BaseModel):
    """更新投资机会的Schema"""
    code: str | None = Field(None, description="标的代码")
    name: str | None = Field(None, description="标的名称")
    opportunity_type: str | None = Field(None, description="机会类型")
    score: float | None = Field(None, ge=0, le=100, description="综合评分 0-100")
    price: Decimal | None = Field(None, description="当前价格")
    reason: dict | None = Field(None, description="推荐理由(JSON)")
    discovered_date: date | None = Field(None, description="发现日期")
    status: str | None = Field(None, description="状态: active/expired")


class OpportunityResponse(OpportunityCreate):
    """投资机会响应Schema"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
