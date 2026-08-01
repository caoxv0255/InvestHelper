from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class PriceBar(BaseModel):
    date: date
    close: Decimal = Field(gt=0)


class BacktestAsset(BaseModel):
    code: str = Field(min_length=1)
    name: str = ""
    target_weight: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    bars: list[PriceBar] = Field(min_length=2)


class RiskConstraints(BaseModel):
    max_drawdown: Decimal = Field(default=Decimal("0.20"), gt=0, le=1)
    max_single_weight: Decimal = Field(default=Decimal("0.30"), gt=0, le=1)
    max_monthly_trades: int = Field(default=4, ge=0, le=100)
    min_trade_amount: Decimal = Field(default=Decimal("500"), ge=0)
    min_cash_weight: Decimal = Field(default=Decimal("0.10"), ge=0, le=1)


class BacktestRequest(BaseModel):
    strategy: str = Field(pattern="^(buy_hold|sma_trend|momentum|rebalance)$")
    initial_capital: Decimal = Field(default=Decimal("10000"), gt=0)
    fee_rate: Decimal = Field(default=Decimal("0.001"), ge=0, le=1)
    slippage_rate: Decimal = Field(default=Decimal("0.0005"), ge=0, le=1)
    lookback: int = Field(default=20, ge=2, le=250)
    short_window: int = Field(default=20, ge=2, le=250)
    long_window: int = Field(default=60, ge=3, le=500)
    assets: list[BacktestAsset] = Field(min_length=1)
    constraints: RiskConstraints = RiskConstraints()


class BacktestResponse(BaseModel):
    strategy: str
    metrics: dict
    equity_curve: list[dict]
    trades: list[dict]
    warnings: list[str]
