from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class TransactionBase(BaseModel):
    account: str = Field(min_length=1, max_length=50)
    asset_type: str = Field(min_length=1, max_length=50)
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    side: str = Field(pattern="^(buy|sell|dividend)$")
    trade_date: date
    quantity: Decimal = Field(gt=0)
    price: Decimal = Field(ge=0)
    fee: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = Field(default="CNY", max_length=10)
    notes: str | None = None


class TransactionCreate(TransactionBase):
    pass


class TransactionResponse(TransactionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
