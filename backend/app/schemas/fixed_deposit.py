from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


class FixedDepositBase(BaseModel):
    bank: str = Field(..., max_length=50, description="银行名称")
    product_name: str = Field(..., max_length=100, description="产品名称")
    principal: float = Field(0, ge=0, description="本金")
    annual_rate: float = Field(0, ge=0, description="年利率%")
    start_date: date = Field(..., description="起息日")
    end_date: date = Field(..., description="到期日")
    interest_method: str = Field("simple", max_length=20, description="计息方式")
    notes: Optional[str] = Field(None, description="备注")


class FixedDepositCreate(FixedDepositBase):
    pass


class FixedDepositUpdate(BaseModel):
    bank: Optional[str] = Field(None, max_length=50)
    product_name: Optional[str] = Field(None, max_length=100)
    principal: Optional[float] = Field(None, ge=0)
    annual_rate: Optional[float] = Field(None, ge=0)
    start_date: Optional[date] = Field(None)
    end_date: Optional[date] = Field(None)
    interest_method: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None)


class FixedDepositResponse(FixedDepositBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FixedDepositListResponse(BaseModel):
    total: int
    items: list[FixedDepositResponse]
