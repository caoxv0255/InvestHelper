"""仓位管理与止盈止损 API 路由

提供：
- GET /api/position/suggestions - 获取所有持仓的仓位建议
- GET /api/position/alerts - 获取止盈止损预警
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.deposits import Deposit
from app.models.holdings import Holding
from app.services import alerts as alert_service
from app.services import market_data
from app.services import signals as signal_service
from app.services.position import calculate_atr, calculate_take_profit_stop_loss, suggest_position_size

router = APIRouter()
logger = logging.getLogger(__name__)


class TakeProfitStopLossUpdate(BaseModel):
    """更新持仓止盈止损请求体"""

    take_profit_price: Decimal | None = Field(None, description="止盈价")
    stop_loss_price: Decimal | None = Field(None, description="止损价")


class PositionSuggestionResponse(BaseModel):
    """仓位建议响应单项"""

    holding_id: int
    code: str
    name: str
    asset_type: str
    rating: str
    score: int
    current_price: float
    total_assets: float
    current_position_ratio: float
    suggested_ratio: float
    suggested_value: float
    suggested_quantity: float
    risk_amount: float
    reason: str


class PositionSuggestionsResponse(BaseModel):
    """仓位建议列表响应"""

    total_assets: float
    risk_tolerance: float
    suggestions: list[PositionSuggestionResponse]


class PositionAlertResponse(BaseModel):
    """止盈止损预警响应"""

    alerts: list[dict[str, Any]]


def _calc_total_assets(db: Session) -> Decimal:
    """计算总资产：持仓市值 + 定期理财本金 + 已赚收益"""
    holdings = db.query(Holding).all()
    deposits = db.query(Deposit).filter(Deposit.status == "active").all()
    today = date.today()

    holding_market_value = sum(
        h.quantity * (h.current_price or h.cost_price) for h in holdings
    )
    deposit_principal = sum(d.principal for d in deposits)
    deposit_earned = Decimal("0")
    for d in deposits:
        total_days = (d.maturity_date - d.start_date).days
        if total_days > 0:
            held_days = max(0, min((today - d.start_date).days, total_days))
            deposit_earned += d.expected_return * Decimal(held_days) / Decimal(total_days)

    return holding_market_value + deposit_principal + deposit_earned


def _fetch_klines(code: str, asset_type: str) -> list[dict]:
    """获取标的 K 线数据，失败返回空列表"""
    end_date = date.today().strftime("%Y-%m-%d")
    start_date = (date.today() - timedelta(days=365)).strftime("%Y-%m-%d")
    try:
        if asset_type == "fund":
            data = market_data.get_fund_nav(code, start_date, end_date)
        elif asset_type == "index":
            data = market_data.get_index_daily(code, start_date, end_date)
        else:
            data = market_data.get_stock_daily(code, start_date, end_date)
        return data.get("klines", [])
    except Exception as e:  # noqa: BLE001
        logger.warning("获取 K 线失败 code=%s asset_type=%s: %s", code, asset_type, e)
        return []


@router.get("/position/suggestions", response_model=PositionSuggestionsResponse)
async def get_position_suggestions(
    risk_tolerance: float = Query(0.02, description="单笔风险承受比例，默认 2%"),
    db: Session = Depends(get_db),
):
    """获取所有持仓的仓位建议

    综合技术信号、ATR 与总资产，为每个可分析持仓给出建议仓位。
    """
    holdings = db.query(Holding).all()
    total_assets = _calc_total_assets(db)
    total_assets_float = float(total_assets) if total_assets > 0 else 0.0

    suggestions: list[PositionSuggestionResponse] = []

    for holding in holdings:
        # 仅对股票/基金计算仓位建议
        if holding.asset_type not in ("stock", "fund"):
            continue

        current_price = float(holding.current_price or holding.cost_price or 0)
        if current_price <= 0:
            continue

        # 当前仓位占比
        market_value = float(holding.quantity) * current_price
        current_position_ratio = market_value / total_assets_float if total_assets_float > 0 else 0.0

        # 获取技术信号
        signal = signal_service.get_signal(
            holding.code,
            period="daily",
            asset_type=holding.asset_type,
            use_cache=True,
        )
        rating = signal.get("rating", "neutral")
        score = signal.get("score", 50)

        # 获取 K 线并计算 ATR
        klines = _fetch_klines(holding.code, holding.asset_type)
        atr = calculate_atr(klines, period=14)

        suggestion = suggest_position_size(
            rating=rating,
            score=score,
            atr=atr,
            current_price=current_price,
            total_assets=total_assets_float,
            risk_tolerance=risk_tolerance,
            current_position_ratio=current_position_ratio,
        )

        suggestions.append(
            PositionSuggestionResponse(
                holding_id=holding.id,
                code=holding.code,
                name=holding.name,
                asset_type=holding.asset_type,
                rating=rating,
                score=score,
                current_price=current_price,
                total_assets=total_assets_float,
                current_position_ratio=round(current_position_ratio, 4),
                suggested_ratio=suggestion["suggested_ratio"],
                suggested_value=suggestion["suggested_value"],
                suggested_quantity=suggestion["suggested_quantity"],
                risk_amount=suggestion["risk_amount"],
                reason=suggestion["reason"],
            )
        )

    return PositionSuggestionsResponse(
        total_assets=total_assets_float,
        risk_tolerance=risk_tolerance,
        suggestions=suggestions,
    )


@router.get("/position/alerts", response_model=PositionAlertResponse)
async def get_position_alerts(db: Session = Depends(get_db)):
    """获取止盈止损预警

    检查所有设置了止盈止损价的持仓，返回当前价触及预警线的列表。
    """
    holdings = db.query(Holding).all()
    alerts = alert_service.check_take_profit_stop_loss(holdings)
    return PositionAlertResponse(alerts=alerts)


@router.put("/position/{holding_id}/take-profit-stop-loss")
async def update_take_profit_stop_loss(
    holding_id: int,
    update: TakeProfitStopLossUpdate,
    db: Session = Depends(get_db),
):
    """更新持仓的止盈止损价格"""
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="持仓记录不存在")

    holding.take_profit_price = update.take_profit_price
    holding.stop_loss_price = update.stop_loss_price
    db.commit()
    db.refresh(holding)
    return {
        "message": "更新成功",
        "holding_id": holding_id,
        "take_profit_price": holding.take_profit_price,
        "stop_loss_price": holding.stop_loss_price,
    }


@router.post("/position/{holding_id}/calculate-take-profit-stop-loss")
async def calc_take_profit_stop_loss(
    holding_id: int,
    multiplier: float = Query(2.0, description="ATR 倍数，默认 2.0"),
    db: Session = Depends(get_db),
):
    """根据 ATR 自动计算并返回某持仓的止盈止损价（不保存）"""
    holding = db.query(Holding).filter(Holding.id == holding_id).first()
    if not holding:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="持仓记录不存在")

    current_price = float(holding.current_price or holding.cost_price or 0)
    cost_price = float(holding.cost_price or 0)

    klines = _fetch_klines(holding.code, holding.asset_type)
    atr = calculate_atr(klines, period=14)

    result = calculate_take_profit_stop_loss(
        cost_price=cost_price,
        current_price=current_price,
        atr=atr,
        multiplier=multiplier,
    )
    return result
