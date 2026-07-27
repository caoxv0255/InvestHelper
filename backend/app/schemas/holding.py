from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


class HoldingBase(BaseModel):
    platform: str = Field(..., max_length=20, description="平台标识")
    platform_name: Optional[str] = Field(None, max_length=50, description="平台显示名称")
    asset_type: str = Field(..., max_length=20, description="资产类型：fund/stock/deposit")
    code: str = Field(..., max_length=20, description="标的代码")
    name: str = Field(..., max_length=100, description="标的名称")
    quantity: float = Field(0, ge=0, description="持仓数量/份额")
    cost_price: float = Field(0, ge=0, description="成本价")
    buy_date: Optional[date] = Field(None, description="买入日期")
    notes: Optional[str] = Field(None, description="备注")


class HoldingCreate(HoldingBase):
    pass


class HoldingUpdate(BaseModel):
    platform: Optional[str] = Field(None, max_length=20)
    platform_name: Optional[str] = Field(None, max_length=50)
    asset_type: Optional[str] = Field(None, max_length=20)
    code: Optional[str] = Field(None, max_length=20)
    name: Optional[str] = Field(None, max_length=100)
    quantity: Optional[float] = Field(None, ge=0)
    cost_price: Optional[float] = Field(None, ge=0)
    current_price: Optional[float] = Field(None)
    buy_date: Optional[date] = Field(None)
    notes: Optional[str] = Field(None)


class HoldingResponse(HoldingBase):
    id: int
    current_price: float = 0
    current_price_updated: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HoldingListResponse(BaseModel):
    total: int
    items: list[HoldingResponse]
