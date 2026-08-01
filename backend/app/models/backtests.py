from datetime import date
from decimal import Decimal
from sqlalchemy import Date, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import BaseModel


class BacktestRun(BaseModel):
    """策略实验室的可复现回测记录。"""
    __tablename__ = "backtest_runs"

    strategy: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    initial_capital: Mapped[Decimal] = mapped_column(Numeric(20, 2), nullable=False)
    config: Mapped[dict] = mapped_column(JSON, nullable=False)
    metrics: Mapped[dict] = mapped_column(JSON, nullable=False)
    equity_curve: Mapped[list] = mapped_column(JSON, nullable=False)
