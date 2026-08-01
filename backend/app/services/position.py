"""仓位管理建议服务

基于技术信号、ATR（真实波幅）与账户总资产，给出仓位建议与止盈止损价格。
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


def calculate_atr(klines: list[dict], period: int = 14) -> Optional[float]:
    """计算 ATR（Average True Range，真实波幅均值）

    参数:
        klines: K 线数据列表，每条需包含 open/high/low/close
        period: 计算周期，默认 14

    返回:
        最后一条 K 线对应的 ATR 值；数据不足时返回 None
    """
    if not klines or len(klines) < period + 1:
        logger.debug("K线数据不足，无法计算 ATR: %d < %d", len(klines) if klines else 0, period + 1)
        return None

    # 计算每条 K 线的真实波幅 TR
    true_ranges: list[float] = []
    for i in range(1, len(klines)):
        high = float(klines[i].get("high", 0) or 0)
        low = float(klines[i].get("low", 0) or 0)
        prev_close = float(klines[i - 1].get("close", 0) or 0)

        tr1 = high - low
        tr2 = abs(high - prev_close)
        tr3 = abs(low - prev_close)
        true_ranges.append(max(tr1, tr2, tr3))

    if len(true_ranges) < period:
        return None

    # 使用简单移动平均计算 ATR
    atr = sum(true_ranges[-period:]) / period
    return atr


def suggest_position_size(
    rating: str,
    score: int,
    atr: Optional[float],
    current_price: float,
    total_assets: float,
    risk_tolerance: float = 0.02,
    current_position_ratio: float = 0.0,
) -> dict[str, Any]:
    """根据技术信号与 ATR 建议仓位

    参数:
        rating: 技术评级 buy/hold/sell/neutral
        score: 技术评分 0-100
        atr: ATR 值，可能为 None
        current_price: 当前价格
        total_assets: 总资产
        risk_tolerance: 单笔可承受风险比例，默认 2%
        current_position_ratio: 当前仓位比例，用于 hold/neutral 建议，默认 0

    返回:
        包含建议仓位比例、金额、数量及说明的字典
    """
    rating = (rating or "neutral").lower()
    score = max(0, min(100, int(score or 50)))
    current_price = float(current_price or 0)
    total_assets = float(total_assets or 0)

    # 基础响应结构
    result: dict[str, Any] = {
        "rating": rating,
        "score": score,
        "atr": atr,
        "current_price": current_price,
        "total_assets": total_assets,
        "risk_tolerance": risk_tolerance,
        "suggested_ratio": 0.0,
        "suggested_value": 0.0,
        "suggested_quantity": 0.0,
        "risk_amount": 0.0,
        "reason": "",
    }

    if total_assets <= 0 or current_price <= 0:
        result["reason"] = "总资产或当前价无效，无法给出仓位建议"
        return result

    risk_amount = total_assets * risk_tolerance
    result["risk_amount"] = risk_amount

    # sell 评级：建议减仓/清仓
    if rating == "sell":
        result["suggested_ratio"] = 0.0
        result["suggested_value"] = 0.0
        result["suggested_quantity"] = 0.0
        result["reason"] = "卖出信号，建议减仓或清仓"
        return result

    # hold/neutral 评级：保持当前仓位
    if rating in ("hold", "neutral"):
        target_value = total_assets * current_position_ratio
        result["suggested_ratio"] = current_position_ratio
        result["suggested_value"] = target_value
        result["suggested_quantity"] = target_value / current_price if current_price > 0 else 0.0
        if rating == "hold":
            result["reason"] = "持有信号，建议保持当前仓位"
        else:
            result["reason"] = "中性信号，建议保持当前仓位或观望"
        return result

    # buy 评级：按 score 确定基础仓位比例
    # score 越高，可投入仓位越大
    if score >= 80:
        base_ratio = 0.30
    elif score >= 70:
        base_ratio = 0.20
    elif score >= 65:
        base_ratio = 0.10
    else:
        base_ratio = 0.05

    # 结合 ATR 进行风险控制：用风险金额倒推可买数量
    # 假设以 ATR*N 作为止损距离，则仓位价值 = 风险金额 / (止损距离 / 当前价)
    # 简化为：可买数量 = 风险金额 / (multiplier * atr)，仓位价值 = 数量 * 当前价
    if atr and atr > 0:
        multiplier = 2.0
        stop_distance = multiplier * atr
        risk_based_quantity = risk_amount / stop_distance
        risk_based_value = risk_based_quantity * current_price
        risk_based_ratio = risk_based_value / total_assets
        # 最终仓位取基础比例与 ATR 风险控制二者的较小值
        suggested_ratio = min(base_ratio, risk_based_ratio)
        reason = (
            f"买入信号较强(score={score})，但受 ATR({atr:.4f}) 风险控制，"
            f"按 {multiplier} 倍 ATR 止损距离倒推仓位"
        )
    else:
        suggested_ratio = base_ratio
        risk_based_value = total_assets * suggested_ratio
        reason = f"买入信号(score={score})，ATR 缺失，按基础比例建议仓位"

    suggested_value = total_assets * suggested_ratio
    suggested_quantity = suggested_value / current_price if current_price > 0 else 0.0

    result["suggested_ratio"] = round(suggested_ratio, 4)
    result["suggested_value"] = round(suggested_value, 4)
    result["suggested_quantity"] = round(suggested_quantity, 4)
    result["reason"] = reason
    return result


def calculate_take_profit_stop_loss(
    cost_price: float,
    current_price: float,
    atr: Optional[float],
    multiplier: float = 2.0,
) -> dict[str, Any]:
    """计算止盈止损价格

    参数:
        cost_price: 成本价
        current_price: 当前价格
        atr: ATR 值，可能为 None
        multiplier: ATR 倍数，默认 2.0

    返回:
        包含止盈价、止损价及说明的字典
    """
    cost_price = float(cost_price or 0)
    current_price = float(current_price or 0)

    result: dict[str, Any] = {
        "cost_price": cost_price,
        "current_price": current_price,
        "atr": atr,
        "multiplier": multiplier,
        "stop_loss_price": None,
        "take_profit_price": None,
        "reason": "",
    }

    if cost_price <= 0 or current_price <= 0:
        result["reason"] = "成本价或当前价无效，无法计算止盈止损"
        return result

    if not atr or atr <= 0:
        # ATR 缺失时，按固定百分比 5% 计算
        fallback_rate = 0.05
        result["stop_loss_price"] = round(max(cost_price, current_price) * (1 - fallback_rate), 4)
        result["take_profit_price"] = round(current_price * (1 + fallback_rate), 4)
        result["reason"] = "ATR 缺失，按 5% 固定比例计算止盈止损"
        return result

    # 止损价取成本价与当前价各自减去 multiplier*ATR 的较大值
    # 这样可保护已获利头寸，同时避免新买入即触发止损
    stop_loss_price = max(
        cost_price - multiplier * atr,
        current_price - multiplier * atr,
    )
    take_profit_price = current_price + multiplier * atr

    result["stop_loss_price"] = round(stop_loss_price, 4)
    result["take_profit_price"] = round(take_profit_price, 4)
    result["reason"] = f"基于 ATR({atr:.4f}) 的 {multiplier} 倍计算"
    return result
