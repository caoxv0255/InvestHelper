"""止盈止损预警服务

检查持仓是否触及预设的止盈价或止损价，返回触发预警的持仓列表。
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any, Optional

logger = logging.getLogger(__name__)


def check_take_profit_stop_loss(holdings: list[Any]) -> list[dict[str, Any]]:
    """检查持仓是否触及止盈止损线

    参数:
        holdings: 持仓对象列表，每个对象需包含
                  code, name, current_price, take_profit_price, stop_loss_price 等字段

    返回:
        触发预警的持仓列表，每个元素包含原始持仓信息、触发类型、触发价及说明
    """
    alerts: list[dict[str, Any]] = []

    for holding in holdings:
        # 支持 ORM 对象与字典两种形式
        if isinstance(holding, dict):
            code = holding.get("code", "")
            name = holding.get("name", "")
            current_price = holding.get("current_price")
            take_profit_price = holding.get("take_profit_price")
            stop_loss_price = holding.get("stop_loss_price")
            quantity = holding.get("quantity", 0)
            cost_price = holding.get("cost_price", 0)
        else:
            code = getattr(holding, "code", "")
            name = getattr(holding, "name", "")
            current_price = getattr(holding, "current_price", None)
            take_profit_price = getattr(holding, "take_profit_price", None)
            stop_loss_price = getattr(holding, "stop_loss_price", None)
            quantity = getattr(holding, "quantity", 0)
            cost_price = getattr(holding, "cost_price", 0)

        current_price = _to_float(current_price)
        take_profit_price = _to_float(take_profit_price)
        stop_loss_price = _to_float(stop_loss_price)
        quantity = _to_float(quantity)
        cost_price = _to_float(cost_price)

        # 当前价无效或均未设置止盈止损，跳过
        if current_price is None or current_price <= 0:
            continue
        if (take_profit_price is None or take_profit_price <= 0) and (
            stop_loss_price is None or stop_loss_price <= 0
        ):
            continue

        triggered_types: list[str] = []
        trigger_price: Optional[float] = None

        # 止盈触发：当前价 >= 止盈价
        if take_profit_price is not None and take_profit_price > 0 and current_price >= take_profit_price:
            triggered_types.append("take_profit")
            trigger_price = take_profit_price

        # 止损触发：当前价 <= 止损价
        if stop_loss_price is not None and stop_loss_price > 0 and current_price <= stop_loss_price:
            triggered_types.append("stop_loss")
            trigger_price = stop_loss_price

        if triggered_types:
            profit = (current_price - cost_price) * quantity if cost_price and quantity else 0.0
            alerts.append(
                {
                    "holding_id": getattr(holding, "id", holding.get("id") if isinstance(holding, dict) else None),
                    "code": code,
                    "name": name,
                    "current_price": current_price,
                    "take_profit_price": take_profit_price,
                    "stop_loss_price": stop_loss_price,
                    "triggered_types": triggered_types,
                    "trigger_price": trigger_price,
                    "quantity": quantity,
                    "cost_price": cost_price,
                    "profit": round(profit, 4),
                    "message": _build_alert_message(name or code, triggered_types, current_price, trigger_price),
                }
            )

    return alerts


def _to_float(value: Any) -> Optional[float]:
    """将 Decimal/字符串等安全转换为 float，失败返回 None"""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _build_alert_message(
    name: str,
    triggered_types: list[str],
    current_price: float,
    trigger_price: Optional[float],
) -> str:
    """构建预警提示文案"""
    type_labels: dict[str, str] = {
        "take_profit": "止盈",
        "stop_loss": "止损",
    }
    labels = "/".join(type_labels.get(t, t) for t in triggered_types)
    if trigger_price is not None:
        return f"{name} 触发{labels}预警：当前价 {current_price:.4f}，触发价 {trigger_price:.4f}"
    return f"{name} 触发{labels}预警：当前价 {current_price:.4f}"
