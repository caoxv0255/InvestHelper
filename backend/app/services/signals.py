"""技术信号研判引擎

基于 K 线数据计算均线、MACD、KDJ、量价等多维度技术信号，
并给出综合评级与评分。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional

from app.core.config import settings
from app.services import market_data
from app.services.cache import build_key, get_cache

logger = logging.getLogger(__name__)


# ====================================================================
# 指标计算工具
# ====================================================================

def _closes(klines: list[dict]) -> list[float]:
    """提取收盘价序列"""
    return [float(k.get("close", 0) or 0) for k in klines]


def _volumes(klines: list[dict]) -> list[float]:
    """提取成交量序列"""
    return [float(k.get("volume", 0) or 0) for k in klines]


def _ma(values: list[float], period: int) -> list[float]:
    """计算简单移动平均，长度与 values 一致，前 period-1 条补 None"""
    if period <= 0 or len(values) < period:
        return [None] * len(values)
    result: list[Optional[float]] = [None] * (period - 1)
    for i in range(period - 1, len(values)):
        result.append(sum(values[i - period + 1 : i + 1]) / period)
    return result


def _ema(values: list[float], period: int) -> list[float]:
    """计算指数移动平均，长度与 values 一致"""
    if not values or period <= 0:
        return [None] * len(values)
    k = 2 / (period + 1)
    result: list[Optional[float]] = [None] * len(values)
    result[0] = values[0]
    ema = values[0]
    for i in range(1, len(values)):
        ema = values[i] * k + ema * (1 - k)
        result[i] = ema
    return result


def _macd(values: list[float], fast: int = 12, slow: int = 26, signal: int = 9) -> tuple:
    """计算 MACD，返回 (dif, dea, histogram) 序列，长度与 values 一致"""
    if len(values) < slow:
        return [None] * len(values), [None] * len(values), [None] * len(values)

    ema_fast = _ema(values, fast)
    ema_slow = _ema(values, slow)

    dif: list[Optional[float]] = [None] * len(values)
    for i in range(len(values)):
        if ema_fast[i] is not None and ema_slow[i] is not None:
            dif[i] = ema_fast[i] - ema_slow[i]

    dea: list[Optional[float]] = [None] * len(values)
    valid_start = 0
    while valid_start < len(values) and dif[valid_start] is None:
        valid_start += 1

    if valid_start < len(values):
        ema_dea = dif[valid_start]
        dea[valid_start] = ema_dea
        k = 2 / (signal + 1)
        for i in range(valid_start + 1, len(values)):
            ema_dea = dif[i] * k + ema_dea * (1 - k)
            dea[i] = ema_dea

    histogram: list[Optional[float]] = [None] * len(values)
    for i in range(len(values)):
        if dif[i] is not None and dea[i] is not None:
            histogram[i] = dif[i] - dea[i]

    return dif, dea, histogram


def _kdj(
    klines: list[dict],
    n: int = 9,
    m1: int = 3,
    m2: int = 3,
) -> tuple:
    """计算 KDJ，返回 (k_values, d_values, j_values)，长度与 klines 一致"""
    length = len(klines)
    if length < n:
        return [None] * length, [None] * length, [None] * length

    k_values: list[Optional[float]] = [None] * length
    d_values: list[Optional[float]] = [None] * length
    j_values: list[Optional[float]] = [None] * length

    k_values[n - 1] = 50.0
    d_values[n - 1] = 50.0
    j_values[n - 1] = 50.0

    for i in range(n, length):
        low_min = min(klines[j]["low"] for j in range(i - n + 1, i + 1))
        high_max = max(klines[j]["high"] for j in range(i - n + 1, i + 1))
        close = klines[i]["close"]

        if high_max != low_min:
            rsv = ((close - low_min) / (high_max - low_min)) * 100
        else:
            rsv = 50.0

        prev_k = k_values[i - 1] or 50.0
        prev_d = d_values[i - 1] or 50.0
        k_values[i] = ((m1 - 1) / m1) * prev_k + (1 / m1) * rsv
        d_values[i] = ((m2 - 1) / m2) * prev_d + (1 / m2) * k_values[i]
        j_values[i] = 3 * k_values[i] - 2 * d_values[i]

    return k_values, d_values, j_values


# ====================================================================
# 信号分析
# ====================================================================

def _cross_up(values_a: list[float], values_b: list[float], idx: int) -> bool:
    """判断 idx 处 values_a 是否上穿 values_b（idx-1 时 a<=b，idx 时 a>b）"""
    if idx < 1:
        return False
    a_now = values_a[idx]
    b_now = values_b[idx]
    a_prev = values_a[idx - 1]
    b_prev = values_b[idx - 1]
    if None in (a_now, b_now, a_prev, b_prev):
        return False
    return a_prev <= b_prev and a_now > b_now


def _cross_down(values_a: list[float], values_b: list[float], idx: int) -> bool:
    """判断 idx 处 values_a 是否下穿 values_b"""
    if idx < 1:
        return False
    a_now = values_a[idx]
    b_now = values_b[idx]
    a_prev = values_a[idx - 1]
    b_prev = values_b[idx - 1]
    if None in (a_now, b_now, a_prev, b_prev):
        return False
    return a_prev >= b_prev and a_now < b_now


def analyze_ma_signals(klines: list[dict]) -> dict:
    """均线信号分析

    - 金叉：MA5 上穿 MA10 或 MA10 上穿 MA20
    - 死叉：MA5 下穿 MA10 或 MA10 下穿 MA20
    - 多头排列：MA5 > MA10 > MA20
    - 空头排列：MA5 < MA10 < MA20
    """
    closes_values = _closes(klines)
    if len(closes_values) < 20:
        return {"valid": False, "reason": "K线数据不足，均线分析需要至少 20 条"}

    ma5 = _ma(closes_values, 5)
    ma10 = _ma(closes_values, 10)
    ma20 = _ma(closes_values, 20)

    idx = len(closes_values) - 1
    signals = []

    if _cross_up(ma5, ma10, idx):
        signals.append("MA5 上穿 MA10 金叉")
    if _cross_down(ma5, ma10, idx):
        signals.append("MA5 下穿 MA10 死叉")
    if _cross_up(ma10, ma20, idx):
        signals.append("MA10 上穿 MA20 金叉")
    if _cross_down(ma10, ma20, idx):
        signals.append("MA10 下穿 MA20 死叉")

    if ma5[idx] > ma10[idx] > ma20[idx]:
        signals.append("均线多头排列")
    elif ma5[idx] < ma10[idx] < ma20[idx]:
        signals.append("均线空头排列")

    return {
        "valid": True,
        "signals": signals,
        "ma5": ma5[idx],
        "ma10": ma10[idx],
        "ma20": ma20[idx],
    }


def analyze_macd_signals(klines: list[dict]) -> dict:
    """MACD 信号分析

    - DIF 上穿 DEA：金叉
    - DIF 下穿 DEA：死叉
    - 顶背离/底背离检测（简化版）
    """
    closes_values = _closes(klines)
    if len(closes_values) < 26:
        return {"valid": False, "reason": "K线数据不足，MACD 分析需要至少 26 条"}

    dif, dea, histogram = _macd(closes_values)
    idx = len(closes_values) - 1
    signals = []

    if _cross_up(dif, dea, idx):
        signals.append("MACD 金叉")
    if _cross_down(dif, dea, idx):
        signals.append("MACD 死叉")

    # 简化背离检测：比较最近两个波峰/波谷与价格的关系
    # 顶背离：价格创新高，DIF 未创新高
    # 底背离：价格创新低，DIF 未创新低
    divergence = _detect_macd_divergence(closes_values, dif)
    if divergence == "top":
        signals.append("MACD 顶背离")
    elif divergence == "bottom":
        signals.append("MACD 底背离")

    return {
        "valid": True,
        "signals": signals,
        "dif": dif[idx],
        "dea": dea[idx],
        "histogram": histogram[idx],
    }


def _detect_macd_divergence(prices: list[float], dif: list[float]) -> Optional[str]:
    """简化版 MACD 背离检测

    取最近 5 个有效点，比较价格与 DIF 的极值关系。
    """
    valid_idx = [i for i in range(len(dif)) if dif[i] is not None]
    if len(valid_idx) < 5:
        return None

    recent = valid_idx[-5:]
    price_recent = [prices[i] for i in recent]
    dif_recent = [dif[i] for i in recent]

    max_price = max(price_recent)
    min_price = min(price_recent)
    max_dif = max(dif_recent)
    min_dif = min(dif_recent)

    # 若最近价格最高且 DIF 未同步最高，视为顶背离
    if price_recent[-1] == max_price and dif_recent[-1] < max_dif * 0.98:
        return "top"
    # 若最近价格最低且 DIF 未同步最低，视为底背离
    if price_recent[-1] == min_price and dif_recent[-1] > min_dif * 1.02:
        return "bottom"
    return None


def analyze_kdj_signals(klines: list[dict]) -> dict:
    """KDJ 信号分析

    - K 上穿 D：金叉
    - K 下穿 D：死叉
    - K > 80 超买，K < 20 超卖
    """
    if len(klines) < 9:
        return {"valid": False, "reason": "K线数据不足，KDJ 分析需要至少 9 条"}

    k_values, d_values, j_values = _kdj(klines)
    idx = len(klines) - 1
    signals = []

    if _cross_up(k_values, d_values, idx):
        signals.append("KDJ 金叉")
    if _cross_down(k_values, d_values, idx):
        signals.append("KDJ 死叉")

    k_now = k_values[idx]
    if k_now is not None:
        if k_now > 80:
            signals.append("KDJ 超买")
        elif k_now < 20:
            signals.append("KDJ 超卖")

    return {
        "valid": True,
        "signals": signals,
        "k": k_now,
        "d": d_values[idx],
        "j": j_values[idx],
    }


def analyze_volume_signals(klines: list[dict]) -> dict:
    """量价信号分析

    - 放量上涨：当日成交量 > 5 日均量 且 收盘价 > 开盘价
    - 缩量下跌：当日成交量 < 5 日均量 且 收盘价 < 开盘价
    """
    if len(klines) < 5:
        return {"valid": False, "reason": "K线数据不足，量价分析需要至少 5 条"}

    volumes = _volumes(klines)
    idx = len(klines) - 1
    today = klines[idx]
    vol_ma5 = sum(volumes[-5:]) / 5

    signals = []
    if today["volume"] > vol_ma5 and today["close"] > today["open"]:
        signals.append("放量上涨")
    if today["volume"] < vol_ma5 and today["close"] < today["open"]:
        signals.append("缩量下跌")

    return {
        "valid": True,
        "signals": signals,
        "volume": today["volume"],
        "vol_ma5": vol_ma5,
    }


# ====================================================================
# 综合评级
# ====================================================================

@dataclass
class TechnicalResult:
    """技术分析结果"""

    code: str
    name: str
    period: str
    signals: list[dict] = field(default_factory=list)
    rating: str = "neutral"
    score: int = 50
    reasons: list[str] = field(default_factory=list)
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "name": self.name,
            "period": self.period,
            "signals": self.signals,
            "rating": self.rating,
            "score": self.score,
            "reasons": self.reasons,
            "error": self.error,
        }


def analyze_technical(code: str, klines: list[dict], *, period: str = "daily") -> TechnicalResult:
    """综合技术信号分析

    汇总均线、MACD、KDJ、量价信号，给出四级评级：
    - buy / hold / sell / neutral
    并返回 0-100 的评分。
    """
    code = (code or "").strip().upper()
    result = TechnicalResult(code=code, name="", period=period)

    # 数据校验
    if not klines or len(klines) < 5:
        result.rating = "neutral"
        result.score = 50
        result.reasons.append("K线数据不足，无法给出有效信号")
        return result

    # 各维度分析
    ma_result = analyze_ma_signals(klines)
    macd_result = analyze_macd_signals(klines)
    kdj_result = analyze_kdj_signals(klines)
    volume_result = analyze_volume_signals(klines)

    result.signals = [
        {"category": "MA", **ma_result},
        {"category": "MACD", **macd_result},
        {"category": "KDJ", **kdj_result},
        {"category": "VOLUME", **volume_result},
    ]

    # 评分逻辑：基于关键词统计加分/减分
    score = 50
    buy_factors = 0
    sell_factors = 0

    all_signals: list[str] = []
    for s in result.signals:
        if s.get("valid"):
            all_signals.extend(s.get("signals", []))

    for signal in all_signals:
        signal_text = signal.lower()
        # 多头 / 买入因子
        if any(k in signal_text for k in ("金叉", "多头排列", "放量上涨", "底背离", "超卖")):
            score += 8
            buy_factors += 1
        # 空头 / 卖出因子
        if any(k in signal_text for k in ("死叉", "空头排列", "缩量下跌", "顶背离", "超买")):
            score -= 8
            sell_factors += 1

    # 约束到 0-100
    result.score = max(0, min(100, score))

    # 评级逻辑
    if buy_factors >= 2 and sell_factors == 0 and result.score >= 65:
        result.rating = "buy"
        result.reasons.append("多项技术指标共振，买入信号较强")
    elif sell_factors >= 2 and buy_factors == 0 and result.score <= 35:
        result.rating = "sell"
        result.reasons.append("多项技术指标共振，卖出信号较强")
    elif buy_factors > 0 and sell_factors > 0:
        result.rating = "hold"
        result.reasons.append("技术信号存在矛盾，建议观望")
    elif result.score >= 65:
        result.rating = "buy"
        result.reasons.append("整体技术面向好")
    elif result.score <= 35:
        result.rating = "sell"
        result.reasons.append("整体技术面走弱")
    else:
        result.rating = "neutral"
        result.reasons.append("技术信号不显著，建议中性持有")

    # 将具体触发的信号也加入原因
    if all_signals:
        result.reasons.append("；".join(all_signals))

    return result


# ====================================================================
# 带行情获取的对外接口
# ====================================================================

def _get_klines(code: str, period: str = "daily", asset_type: str = "stock") -> dict:
    """根据周期获取 K 线数据"""
    end = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    # 分钟线
    if period in ("5min", "15min", "30min", "60min", "5", "15", "30", "60"):
        period_clean = period.replace("min", "")
        return market_data.get_stock_minute(code, period_clean)

    # 周线
    if period == "weekly":
        return market_data.get_stock_weekly(code, start, end)

    # 日线
    if period == "daily":
        if asset_type == "fund":
            return market_data.get_fund_nav(code, start, end)
        if asset_type == "index":
            return market_data.get_index_daily(code, start, end)
        return market_data.get_stock_daily(code, start, end)

    raise ValueError(f"不支持的周期: {period}")


def get_signal(
    code: str,
    *,
    period: str = "daily",
    asset_type: str = "stock",
    use_cache: bool = True,
) -> dict:
    """获取单只标的的综合技术信号

    自动拉取行情数据并缓存结果，失败时优先返回缓存。
    """
    code = (code or "").strip().upper()
    cache_key = build_key("signal", code, f"{period}_{asset_type}")
    cache = get_cache()

    if use_cache:
        cached = cache.get(cache_key)
        if cached is not None:
            logger.info("技术信号命中缓存 code=%s period=%s", code, period)
            return cached

    try:
        data = _get_klines(code, period, asset_type)
    except Exception as e:  # noqa: BLE001
        logger.warning("获取行情数据失败 code=%s: %s", code, e)
        # 降级：尝试缓存
        cached = cache.get(cache_key)
        if cached is not None:
            cached["reasons"] = ["数据源异常，返回缓存信号"] + cached.get("reasons", [])
            return cached
        return TechnicalResult(
            code=code,
            name="",
            period=period,
            rating="neutral",
            score=50,
            reasons=["获取行情数据失败，无法生成信号"],
            error=str(e),
        ).to_dict()

    klines = data.get("klines", [])
    result = analyze_technical(code, klines, period=period)
    result.name = data.get("name", "")

    result_dict = result.to_dict()
    try:
        cache.set(cache_key, result_dict, settings.CACHE_TTL_DAILY)
    except Exception as e:  # noqa: BLE001
        logger.warning("信号缓存写入失败 key=%s: %s", cache_key, e)

    return result_dict


def batch_get_signals(items: list[dict]) -> dict:
    """批量获取技术信号

    请求体示例：
    [
        {"code": "000001", "period": "daily", "asset_type": "stock"},
        ...
    ]
    """
    results = []
    errors = []

    for item in items:
        code = item.get("code", "").strip().upper()
        period = item.get("period", "daily") or "daily"
        asset_type = item.get("asset_type", "stock") or "stock"

        if not code:
            errors.append({"item": item, "error": "缺少 code"})
            continue

        try:
            result = get_signal(code, period=period, asset_type=asset_type)
            results.append(result)
        except Exception as e:  # noqa: BLE001
            logger.warning("批量信号分析失败 code=%s: %s", code, e)
            results.append(
                TechnicalResult(
                    code=code,
                    name="",
                    period=period,
                    rating="neutral",
                    score=50,
                    reasons=["分析失败，降级为中性"],
                    error=str(e),
                ).to_dict()
            )

    return {"total": len(items), "success": len(results), "failed": len(errors), "results": results, "errors": errors}
