from datetime import date
from decimal import Decimal
from sqlalchemy import String, Numeric, Date, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import BaseModel


class Opportunity(BaseModel):
    """投资机会表模型"""
    __tablename__ = "opportunities"

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
    opportunity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="机会类型: sector_momentum/tech_signal/fund_flow"
    )
    score: Mapped[int] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        index=True,
        comment="综合评分 0-100"
    )
    price: Mapped[Decimal] = mapped_column(
        Numeric(20, 6),
        nullable=False,
        comment="当前价格"
    )
    reason: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="推荐理由(JSON)"
    )
    discovered_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="发现日期"
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        index=True,
        comment="状态: active/expired"
    )
