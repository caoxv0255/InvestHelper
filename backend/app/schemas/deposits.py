from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field


class DepositCreate(BaseModel):
    """创建定期理财的Schema"""
    bank: str = Field(..., description="银行: cmb")
    product_name: str = Field(..., description="产品名称")
    principal: Decimal = Field(..., description="本金")
    annual_rate: Decimal = Field(..., description="年化利率")
    start_date: date = Field(..., description="起息日")
    maturity_date: date = Field(..., description="到期日")
    expected_return: Decimal = Field(..., description="预期收益")
    status: str = Field("active", description="状态: active/matured")
    notes: str | None = Field(None, description="备注")


class DepositUpdate(BaseModel):
    """更新定期理财的Schema"""
    bank: str | None = Field(None, description="银行")
    product_name: str | None = Field(None, description="产品名称")
    principal: Decimal | None = Field(None, description="本金")
    annual_rate: Decimal | None = Field(None, description="年化利率")
    start_date: date | None = Field(None, description="起息日")
    maturity_date: date | None = Field(None, description="到期日")
    expected_return: Decimal | None = Field(None, description="预期收益")
    status: str | None = Field(None, description="状态: active/matured")
    notes: str | None = Field(None, description="备注")


class DepositResponse(DepositCreate):
    """定期理财响应Schema"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
