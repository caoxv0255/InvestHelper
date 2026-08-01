from datetime import date
from decimal import Decimal
from sqlalchemy import String, Numeric, Date, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import BaseModel


class Deposit(BaseModel):
    """定期理财表模型"""
    __tablename__ = "deposits"

    bank: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="银行: cmb"
    )
    product_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="产品名称"
    )
    principal: Mapped[Decimal] = mapped_column(
        Numeric(20, 2),
        nullable=False,
        comment="本金"
    )
    annual_rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 4),
        nullable=False,
        comment="年化利率"
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="起息日"
    )
    maturity_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="到期日"
    )
    expected_return: Mapped[Decimal] = mapped_column(
        Numeric(20, 2),
        nullable=False,
        comment="预期收益"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        index=True,
        comment="状态: active/matured"
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="备注"
    )
