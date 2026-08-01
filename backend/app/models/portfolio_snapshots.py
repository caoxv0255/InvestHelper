from datetime import date
from decimal import Decimal
from sqlalchemy import Date, JSON, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import BaseModel


class PortfolioSnapshot(BaseModel):
    __tablename__ = "portfolio_snapshots"

    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    market_value: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    cost_basis: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    total_profit: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    positions: Mapped[list] = mapped_column(JSON, nullable=False)

    __table_args__ = (UniqueConstraint("snapshot_date", "currency", name="uq_portfolio_snapshot_date_currency"),)
