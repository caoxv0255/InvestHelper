from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field


class HoldingCreate(BaseModel):
    """创建持仓的Schema"""
    platform: str = Field(..., description="平台类型: alipay/cmb/ths")
    asset_type: str = Field(..., description="资产类型: fund/stock/deposit")
    code: str = Field(..., description="标的代码")
    name: str = Field(..., description="标的名称")
    quantity: Decimal = Field(..., description="持仓数量/份额")
    cost_price: Decimal = Field(..., description="成本价")
    current_price: Decimal | None = Field(None, description="当前价格")
    take_profit_price: Decimal | None = Field(None, description="止盈价")
    stop_loss_price: Decimal | None = Field(None, description="止损价")
    industry: str | None = Field(None, description="行业")
    buy_date: date | None = Field(None, description="买入日期")
    notes: str | None = Field(None, description="备注")


class HoldingUpdate(BaseModel):
    """更新持仓的Schema"""
    platform: str | None = Field(None, description="平台类型")
    asset_type: str | None = Field(None, description="资产类型")
    code: str | None = Field(None, description="标的代码")
    name: str | None = Field(None, description="标的名称")
    quantity: Decimal | None = Field(None, description="持仓数量/份额")
    cost_price: Decimal | None = Field(None, description="成本价")
    current_price: Decimal | None = Field(None, description="当前价格")
    take_profit_price: Decimal | None = Field(None, description="止盈价")
    stop_loss_price: Decimal | None = Field(None, description="止损价")
    industry: str | None = Field(None, description="行业")
    buy_date: date | None = Field(None, description="买入日期")
    notes: str | None = Field(None, description="备注")


class HoldingResponse(HoldingCreate):
    """持仓响应Schema"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
