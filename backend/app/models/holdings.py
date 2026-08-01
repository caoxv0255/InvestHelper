from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Numeric, Date, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import BaseModel


class Holding(BaseModel):
    """持仓表模型"""
    __tablename__ = "holdings"

    platform: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="平台类型: alipay/cmb/ths"
    )
    asset_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="资产类型: fund/stock/deposit"
    )
    code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="标的代码"
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="标的名称"
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(20, 6),
        nullable=False,
        comment="持仓数量/份额"
    )
    cost_price: Mapped[Decimal] = mapped_column(
        Numeric(20, 6),
        nullable=False,
        comment="成本价"
    )
    current_price: Mapped[Decimal | None] = mapped_column(
        Numeric(20, 6),
        nullable=True,
        comment="当前价格"
    )
    take_profit_price: Mapped[Decimal | None] = mapped_column(
        Numeric(20, 6),
        nullable=True,
        comment="止盈价"
    )
    stop_loss_price: Mapped[Decimal | None] = mapped_column(
        Numeric(20, 6),
        nullable=True,
        comment="止损价"
    )
    industry: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="行业"
    )
    buy_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="买入日期"
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="备注"
    )
