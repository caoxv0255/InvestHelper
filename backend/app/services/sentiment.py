"""市场情绪服务

基于 AKShare 提供市场情绪相关指标：
- 北向资金净流入
- 市场宽度（上涨/下跌/平盘家数、涨跌停家数）
- 成交量趋势（沪深两市合计成交额，近 5 日）
- 涨跌停比
- 恐惧贪婪指数（0-100）
- 复合情绪指数（0-100 标准化）

设计原则：
1. 所有 AKShare 调用失败时返回默认值（0 或 None）并打 warning
2. 指数计算结果有缓存（TTL 300 秒）
3. 历史分位数用近 60 日数据计算
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from typing import Any, Optional

from app.services.cache import build_key, get_cache
from app.services.market_data import _throttle, get_index_daily

logger = logging.getLogger(__name__)

# 情绪指标缓存 TTL（秒）
SENTIMENT_CACHE_TTL: int = 300

# 历史样本长度（用于计算分位数）
HISTORY_DAYS: int = 60

# 沪深300指数代码（AKShare 接受格式）
HS300_CODE: str = "000300"

# 恐惧贪婪指数各因子权重（合计为 1.0）
FG_WEIGHTS: dict[str, float] = {
    "breadth": 0.25,       # 市场宽度
    "volatility": 0.20,    # 波动率
    "volume": 0.15,        # 成交量趋势
    "north_flow": 0.25,    # 北向资金
    "limit_ratio": 0.15,   # 涨跌停比
}

# 复合情绪指数各因子权重（合计为 1.0）
COMPOSITE_WEIGHTS: dict[str, float] = {
    "fear_greed": 0.40,
    "breadth": 0.20,
    "north_flow": 0.20,
    "volume": 0.10,
    "limit_ratio": 0.10,
}


# ====================================================================
# 辅助函数
# ====================================================================

def _safe_float(value: Any, default: float = 0.0) -> float:
    """安全转换为 float，失败返回 default"""
    try:
        if value is None:
            return default
        v = float(value)
        if math.isnan(v) or math.isinf(v):
            return default
        return v
    except (TypeError, ValueError):
        return default


def _percentile(value: float, history: list[float]) -> float:
    """计算 value 在 history 序列中的百分位（0-100）

    使用线性插值法。
    """
    if not history:
        return 50.0
    sorted_vals = sorted(history)
    n = len(sorted_vals)
    if n == 1:
        return 50.0
    # 计算小于等于 value 的比例
    rank = 0
    for v in sorted_vals:
        if v <= value:
            rank += 1
    # 边界处理
    if value <= sorted_vals[0]:
        return 0.0
    if value >= sorted_vals[-1]:
        return 100.0
    # 线性插值
    # 找到 value 所在区间
    for i in range(n - 1):
        if sorted_vals[i] <= value <= sorted_vals[i + 1]:
            lo, hi = sorted_vals[i], sorted_vals[i + 1]
            if hi == lo:
                return float(i) / (n - 1) * 100
            ratio = (value - lo) / (hi - lo)
            return float(i + ratio) / (n - 1) * 100
    return 50.0


def _label_for_score(score: float) -> str:
    """根据 0-100 分值返回情绪标签"""
    if score >= 80:
        return "极度贪婪"
    if score >= 60:
        return "贪婪"
    if score >= 40:
        return "中性"
    if score >= 20:
        return "恐惧"
    return "极度恐惧"


def _clamp_0_100(value: float) -> float:
    """将值夹取到 [0, 100]"""
    return max(0.0, min(100.0, value))


# ====================================================================
# 北向资金
# ====================================================================

def get_north_flow() -> dict:
    """获取北向资金净流入数据

    返回:
        {
            "net_flow": float,           # 今日净流入（亿元）
            "trend": [                   # 近 5 日趋势
                {"date": "YYYY-MM-DD", "value": float},
                ...
            ],
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sentiment", "north_flow", "summary")
    cache = get_cache()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    warnings: list[str] = []
    net_flow = 0.0
    trend: list[dict] = []

    try:
        import akshare as ak
        _throttle()
        # stock_hsgt_north_net_flow_in_em 返回沪股通/深股通净流入
        df = ak.stock_hsgt_north_net_flow_in_em(symbol="北上")
        if df is None or df.empty:
            warnings.append("北向资金接口返回空数据")
        else:
            # 列名通常为 日期 / 当日净流入（万元）
            # 兼容多种列名
            date_col = "日期" if "日期" in df.columns else df.columns[0]
            value_col = None
            for c in df.columns:
                if "净流入" in str(c) or "价值" in str(c):
                    value_col = c
                    break
            if value_col is None:
                value_col = df.columns[-1]

            # 转换为元单位（AKShare 北向资金单位通常为万元，转为亿元）
            df_sorted = df.sort_values(by=date_col)
            recent = df_sorted.tail(5)
            for _, row in recent.iterrows():
                date_str = str(row.get(date_col, ""))
                val = _safe_float(row.get(value_col, 0))
                # 万元 → 亿元
                trend.append({"date": date_str, "value": round(val / 10000.0, 4)})

            if trend:
                net_flow = trend[-1]["value"]
            else:
                warnings.append("北向资金数据为空")
    except Exception as e:  # noqa: BLE001
        logger.warning("获取北向资金失败: %s", e)
        warnings.append(f"北向资金数据获取失败: {e}")

    result = {
        "net_flow": net_flow,
        "trend": trend,
        "warnings": warnings,
    }
    try:
        cache.set(cache_key, result, SENTIMENT_CACHE_TTL)
    except Exception as e:  # noqa: BLE001
        logger.warning("缓存写入失败 north_flow: %s", e)
    return result


# ====================================================================
# 市场宽度
# ====================================================================

def get_market_breadth() -> dict:
    """获取市场宽度数据

    返回:
        {
            "up_count": int,        # 上涨家数
            "down_count": int,      # 下跌家数
            "flat_count": int,      # 平盘家数
            "limit_up": int,        # 涨停家数
            "limit_down": int,      # 跌停家数
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sentiment", "market_breadth", "summary")
    cache = get_cache()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    warnings: list[str] = []
    up_count = 0
    down_count = 0
    flat_count = 0
    limit_up = 0
    limit_down = 0

    try:
        import akshare as ak
        _throttle()
        # stock_zh_a_spot_em 返回全市场实时行情
        df = ak.stock_zh_a_spot_em()
        if df is None or df.empty:
            warnings.append("实时行情接口返回空数据")
        else:
            # 涨跌幅列
            pct_col = "涨跌幅" if "涨跌幅" in df.columns else None
            if pct_col is None:
                warnings.append("实时行情缺少涨跌幅列")
            else:
                pcts = df[pct_col].apply(lambda x: _safe_float(x))
                up_count = int((pcts > 0).sum())
                down_count = int((pcts < 0).sum())
                flat_count = int((pcts == 0).sum())

            # 涨停/跌停判断（涨跌幅 >= 9.9% 视为涨停，<= -9.9% 视为跌停）
            # 简化估算：20cm 标的（688/300 开头）阈值放宽
            try:
                code_col = "代码" if "代码" in df.columns else df.columns[0]
                for _, row in df.iterrows():
                    pct = _safe_float(row.get(pct_col, 0))
                    if pct == 0:
                        continue
                    code = str(row.get(code_col, ""))
                    # 20cm 板块（科创板 688、创业板 300）阈值 19.9%
                    threshold = 9.9
                    if code.startswith("688") or code.startswith("300") or code.startswith("301"):
                        threshold = 19.9
                    if pct >= threshold:
                        limit_up += 1
                    elif pct <= -threshold:
                        limit_down += 1
            except Exception as e:  # noqa: BLE001
                logger.warning("涨跌停统计失败: %s", e)
                warnings.append(f"涨跌停统计失败: {e}")
    except Exception as e:  # noqa: BLE001
        logger.warning("获取市场宽度失败: %s", e)
        warnings.append(f"市场宽度数据获取失败: {e}")

    result = {
        "up_count": up_count,
        "down_count": down_count,
        "flat_count": flat_count,
        "limit_up": limit_up,
        "limit_down": limit_down,
        "warnings": warnings,
    }
    try:
        cache.set(cache_key, result, SENTIMENT_CACHE_TTL)
    except Exception as e:  # noqa: BLE001
        logger.warning("缓存写入失败 market_breadth: %s", e)
    return result


# ====================================================================
# 成交量趋势
# ====================================================================

def get_volume_trend() -> dict:
    """获取沪深两市合计成交额趋势（近 5 日）

    返回:
        {
            "today": float,         # 今日成交额（亿元）
            "avg_5d": float,        # 近5日均值（亿元）
            "trend": [              # 近5日趋势
                {"date": "YYYY-MM-DD", "value": float},
                ...
            ],
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sentiment", "volume_trend", "summary")
    cache = get_cache()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    warnings: list[str] = []
    today = 0.0
    avg_5d = 0.0
    trend: list[dict] = []

    try:
        import akshare as ak
        _throttle()
        # stock_zh_a_spot_em 含"成交额"列，单位为元，汇总即全市场今日成交额
        df = ak.stock_zh_a_spot_em()
        if df is None or df.empty:
            warnings.append("实时行情接口返回空数据")
        else:
            amt_col = "成交额" if "成交额" in df.columns else None
            if amt_col is None:
                warnings.append("实时行情缺少成交额列")
            else:
                total_amount = df[amt_col].apply(lambda x: _safe_float(x)).sum()
                # 元 → 亿元
                today = round(total_amount / 1e8, 2)
    except Exception as e:  # noqa: BLE001
        logger.warning("获取今日成交额失败: %s", e)
        warnings.append(f"今日成交额获取失败: {e}")

    # 历史成交额：通过沪深300指数日线（含成交额字段）近似
    try:
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=15)).strftime("%Y-%m-%d")
        idx_data = get_index_daily(HS300_CODE, start_date, end_date)
        klines = idx_data.get("klines", [])
        if klines:
            recent_klines = klines[-5:]
            for k in recent_klines:
                # 沪深300成交额单位为元，转为亿元
                vol = _safe_float(k.get("volume", 0))
                # 注意：index_zh_a_hist 的"成交量"字段实际为手数，没有成交额字段
                # 这里用成交量做趋势替代（相对趋势，非绝对值）
                trend.append({"date": k.get("date", ""), "value": round(vol / 1e4, 2)})
            if trend:
                # 今日值用全市场成交额，历史用沪深300成交量做替代
                # avg_5d 用历史成交量均值
                values = [t["value"] for t in trend]
                avg_5d = round(sum(values) / len(values), 2) if values else 0.0
                # 替换最后一日为今日的真实成交额（亿元）
                if today > 0:
                    trend[-1]["value"] = today
                    avg_5d = round(sum(t["value"] for t in trend) / len(trend), 2)
        else:
            warnings.append("沪深300指数历史数据为空")
    except Exception as e:  # noqa: BLE001
        logger.warning("获取成交量历史趋势失败: %s", e)
        warnings.append(f"成交量历史趋势获取失败: {e}")

    result = {
        "today": today,
        "avg_5d": avg_5d,
        "trend": trend,
        "warnings": warnings,
    }
    try:
        cache.set(cache_key, result, SENTIMENT_CACHE_TTL)
    except Exception as e:  # noqa: BLE001
        logger.warning("缓存写入失败 volume_trend: %s", e)
    return result


# ====================================================================
# 涨跌停比
# ====================================================================

def get_limit_up_down_ratio() -> dict:
    """获取涨跌停比

    返回:
        {
            "ratio": float,         # 涨停 / 跌停（跌停为0时返回涨停数）
            "limit_up": int,
            "limit_down": int,
            "score": float,         # 0-100 标准化分值（越高越贪婪）
            "warnings": [str, ...]
        }
    """
    breadth = get_market_breadth()
    limit_up = breadth.get("limit_up", 0)
    limit_down = breadth.get("limit_down", 0)

    warnings: list[str] = list(breadth.get("warnings", []))

    if limit_down == 0:
        ratio = float(limit_up) if limit_up > 0 else 0.0
        if limit_up == 0:
            warnings.append("涨跌停均为0，无法计算比率")
    else:
        ratio = limit_up / limit_down

    # 标准化到 0-100
    # ratio > 3 视为极度贪婪（100），ratio = 1 视为中性（50），ratio < 0.3 视为极度恐惧（0）
    if ratio <= 0:
        score = 0.0
    elif ratio >= 3.0:
        score = 100.0
    else:
        # 线性映射 [0, 3] -> [0, 100]
        score = _clamp_0_100(ratio / 3.0 * 100.0)

    return {
        "ratio": round(ratio, 4),
        "limit_up": limit_up,
        "limit_down": limit_down,
        "score": round(score, 2),
        "warnings": warnings,
    }


# ====================================================================
# 恐惧贪婪指数
# ====================================================================

def _compute_hs300_volatility(days: int = 20) -> tuple[float, list[float]]:
    """计算沪深300近20日波动率（日收益率标准差，年化）

    返回:
        (volatility, history) - 当前波动率与近60日波动率序列
    """
    end_date = datetime.now().strftime("%Y-%m-%d")
    # 多取一些天数以确保有足够样本
    start_date = (datetime.now() - timedelta(days=days + HISTORY_DAYS + 30)).strftime("%Y-%m-%d")
    idx_data = get_index_daily(HS300_CODE, start_date, end_date)
    klines = idx_data.get("klines", [])
    if len(klines) < days + 1:
        return 0.0, []

    # 计算日收益率
    closes = [k.get("close", 0) for k in klines]
    returns: list[float] = []
    for i in range(1, len(closes)):
        prev = _safe_float(closes[i - 1])
        curr = _safe_float(closes[i])
        if prev > 0:
            returns.append((curr - prev) / prev)

    if len(returns) < days:
        return 0.0, []

    # 当前波动率（近20日）
    recent_returns = returns[-days:]
    mean_ret = sum(recent_returns) / len(recent_returns)
    variance = sum((r - mean_ret) ** 2 for r in recent_returns) / len(recent_returns)
    vol = math.sqrt(variance) * math.sqrt(252)  # 年化

    # 历史波动率序列（每个点用过去20日计算）
    history: list[float] = []
    for i in range(days, len(returns) + 1):
        window = returns[i - days:i]
        if len(window) < days:
            continue
        m = sum(window) / len(window)
        v = sum((r - m) ** 2 for r in window) / len(window)
        history.append(math.sqrt(v) * math.sqrt(252))

    return vol, history[-HISTORY_DAYS:]


def _north_flow_score(net_flow: float, history: Optional[list[float]] = None) -> float:
    """北向资金标准化得分

    net_flow: 净流入（亿元）
    """
    # 简化映射：净流入 > 100亿 → 100，< -100亿 → 0，0 → 50
    if net_flow >= 100:
        return 100.0
    if net_flow <= -100:
        return 0.0
    return 50.0 + net_flow / 2.0


def _volatility_score(vol: float, history: list[float]) -> float:
    """波动率标准化得分（波动率越低越贪婪）"""
    if not history or vol <= 0:
        return 50.0
    # 当前波动率在历史分位数
    pct = _percentile(vol, history)
    # 反转：分位数越低（当前波动率相对低）→ 越贪婪
    return 100.0 - pct


def _breadth_score(up: int, down: int) -> float:
    """市场宽度得分"""
    total = up + down
    if total == 0:
        return 50.0
    # 上涨家数占比映射到 0-100
    return _clamp_0_100(up / total * 100.0)


def _volume_score(today: float, avg_5d: float) -> float:
    """成交量得分

    放量上涨视为贪婪，缩量视为中性
    简化：今日相对5日均值放量 → 偏贪婪
    """
    if avg_5d <= 0:
        return 50.0
    ratio = today / avg_5d
    # ratio >= 1.5 → 100，ratio = 1 → 50，ratio <= 0.5 → 0
    if ratio >= 1.5:
        return 100.0
    if ratio <= 0.5:
        return 0.0
    return _clamp_0_100((ratio - 0.5) / 1.0 * 100.0)


def calculate_fear_greed_index() -> dict:
    """计算恐惧贪婪指数（0-100）

    综合因子：
    - 市场宽度（涨跌家数比）
    - 波动率（近20日沪深300波动率）
    - 成交量趋势
    - 北向资金流向
    - 涨跌停比

    返回:
        {
            "value": float,         # 0-100
            "label": str,           # 情绪标签
            "percentile": float,    # 历史分位数（0-100）
            "factors": dict,        # 各因子得分
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sentiment", "fear_greed", "index")
    cache = get_cache()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    warnings: list[str] = []

    # 获取各因子
    breadth = get_market_breadth()
    north = get_north_flow()
    volume = get_volume_trend()
    limit_ratio = get_limit_up_down_ratio()

    warnings.extend(breadth.get("warnings", []))
    warnings.extend(north.get("warnings", []))
    warnings.extend(volume.get("warnings", []))
    warnings.extend(limit_ratio.get("warnings", []))

    # 计算各因子得分
    b_score = _breadth_score(breadth.get("up_count", 0), breadth.get("down_count", 0))
    nf_score = _north_flow_score(north.get("net_flow", 0))
    vol_score = _volume_score(volume.get("today", 0), volume.get("avg_5d", 0))
    lr_score = limit_ratio.get("score", 50.0)

    # 波动率得分（需要历史数据计算分位数）
    try:
        vol, vol_history = _compute_hs300_volatility(20)
        if vol <= 0 or not vol_history:
            warnings.append("沪深300波动率计算失败，使用中性值")
            v_score = 50.0
            vol_percentile = 50.0
        else:
            v_score = _volatility_score(vol, vol_history)
            vol_percentile = _percentile(vol, vol_history)
    except Exception as e:  # noqa: BLE001
        logger.warning("波动率计算失败: %s", e)
        warnings.append(f"波动率计算失败: {e}")
        v_score = 50.0
        vol_percentile = 50.0

    # 加权综合
    value = (
        b_score * FG_WEIGHTS["breadth"]
        + v_score * FG_WEIGHTS["volatility"]
        + vol_score * FG_WEIGHTS["volume"]
        + nf_score * FG_WEIGHTS["north_flow"]
        + lr_score * FG_WEIGHTS["limit_ratio"]
    )
    value = _clamp_0_100(value)

    # 历史分位数（简化：用各因子历史分位的加权近似）
    # 由于完整历史恐惧贪婪指数需要每日计算并存储，这里用波动率分位 + 资金分位近似
    percentile = _clamp_0_100(
        0.5 * (100 - vol_percentile) + 0.5 * nf_score
    )

    factors = {
        "breadth": round(b_score, 2),
        "volatility": round(v_score, 2),
        "volume": round(vol_score, 2),
        "north_flow": round(nf_score, 2),
        "limit_ratio": round(lr_score, 2),
    }

    result = {
        "value": round(value, 2),
        "label": _label_for_score(value),
        "percentile": round(percentile, 2),
        "factors": factors,
        "warnings": warnings,
    }
    try:
        cache.set(cache_key, result, SENTIMENT_CACHE_TTL)
    except Exception as e:  # noqa: BLE001
        logger.warning("缓存写入失败 fear_greed: %s", e)
    return result


# ====================================================================
# 复合情绪指数
# ====================================================================

def calculate_composite_sentiment() -> dict:
    """计算复合情绪指数（0-100 标准化）

    加权综合：恐惧贪婪指数 + 市场宽度 + 北向资金 + 成交量 + 涨跌停比

    返回:
        {
            "value": float,
            "label": str,
            "percentile": float,
            "history": [           # 历史60日趋势（简化为近60日沪深300涨跌幅）
                {"date": "YYYY-MM-DD", "value": float},
                ...
            ],
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sentiment", "composite", "index")
    cache = get_cache()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    warnings: list[str] = []

    # 获取各因子
    fg = calculate_fear_greed_index()
    breadth = get_market_breadth()
    north = get_north_flow()
    volume = get_volume_trend()
    limit_ratio = get_limit_up_down_ratio()

    warnings.extend(fg.get("warnings", []))
    warnings.extend(breadth.get("warnings", []))
    warnings.extend(north.get("warnings", []))
    warnings.extend(volume.get("warnings", []))
    warnings.extend(limit_ratio.get("warnings", []))

    fg_score = fg.get("value", 50.0)
    b_score = _breadth_score(breadth.get("up_count", 0), breadth.get("down_count", 0))
    nf_score = _north_flow_score(north.get("net_flow", 0))
    vol_score = _volume_score(volume.get("today", 0), volume.get("avg_5d", 0))
    lr_score = limit_ratio.get("score", 50.0)

    value = (
        fg_score * COMPOSITE_WEIGHTS["fear_greed"]
        + b_score * COMPOSITE_WEIGHTS["breadth"]
        + nf_score * COMPOSITE_WEIGHTS["north_flow"]
        + vol_score * COMPOSITE_WEIGHTS["volume"]
        + lr_score * COMPOSITE_WEIGHTS["limit_ratio"]
    )
    value = _clamp_0_100(value)

    # 历史趋势：用沪深 300 近 60 个交易日的"复合情绪代理分位"——
    # 即"沪深 300 在该日近 60 日窗口内的收盘价分位（0-100）"，作为情绪的代理变量。
    # 注意：严格意义上这是价格分位，不是真实情绪；用户解读时请勿当成真实情绪历史。
    history: list[dict] = []
    history_method = "hs300_price_percentile"
    try:
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=HISTORY_DAYS + 30)).strftime("%Y-%m-%d")
        idx_data = get_index_daily(HS300_CODE, start_date, end_date)
        klines = idx_data.get("klines", [])
        if len(klines) >= 2:
            closes = [_safe_float(k.get("close", 0)) for k in klines]
            # 对每个历史日，计算其在整段时间窗口内的滚动分位
            recent = list(zip(klines[-HISTORY_DAYS:], closes[-HISTORY_DAYS:]))
            # 取滚动 60 交易日窗口
            window = HISTORY_DAYS
            full_closes = closes[-len(recent) - window + 1:]
            for idx, (k, _c) in enumerate(recent):
                seg = full_closes[idx:idx + window]
                if not seg:
                    continue
                lo, hi = min(seg), max(seg)
                rng = hi - lo if hi > lo else 1.0
                norm = (seg[-1] - lo) / rng * 100.0
                history.append({
                    "date": k.get("date", ""),
                    "value": round(_clamp_0_100(norm), 2),
                })
    except Exception as e:  # noqa: BLE001
        logger.warning("复合情绪历史趋势获取失败: %s", e)
        warnings.append(f"复合情绪历史趋势获取失败: {e}")

    # 历史分位数：用 history 序列计算
    if history:
        hist_values = [h["value"] for h in history]
        percentile = _percentile(value, hist_values)
    else:
        percentile = 50.0

    result = {
        "value": round(value, 2),
        "label": _label_for_score(value),
        "percentile": round(percentile, 2),
        "history": history,
        "history_method": history_method,
        "history_note": "历史序列为沪深300在近60日滚动窗口内的收盘价分位（0-100），是情绪的代理变量，并非真实情绪回放，仅供趋势参考。",
        "warnings": warnings,
    }
    try:
        cache.set(cache_key, result, SENTIMENT_CACHE_TTL)
    except Exception as e:  # noqa: BLE001
        logger.warning("缓存写入失败 composite: %s", e)
    return result


# ====================================================================
# 汇总接口
# ====================================================================

def get_market_sentiment() -> dict:
    """汇总返回所有情绪指标

    返回:
        {
            "north_flow": {...},
            "market_breadth": {...},
            "volume_trend": {...},
            "limit_up_down_ratio": {...},
            "fear_greed": {...},
            "composite": {...},
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sentiment", "overview", "all")
    cache = get_cache()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # 并行调用各模块（这里简化为顺序调用，每个模块自身有缓存）
    north = get_north_flow()
    breadth = get_market_breadth()
    volume = get_volume_trend()
    limit_ratio = get_limit_up_down_ratio()
    fg = calculate_fear_greed_index()
    composite = calculate_composite_sentiment()

    # 汇总 warnings（去重）
    all_warnings: list[str] = []
    seen = set()
    for src in (north, breadth, volume, limit_ratio, fg, composite):
        for w in src.get("warnings", []):
            if w not in seen:
                seen.add(w)
                all_warnings.append(w)

    result = {
        "north_flow": {
            "net_flow": north.get("net_flow", 0.0),
            "trend": north.get("trend", []),
        },
        "market_breadth": {
            "up_count": breadth.get("up_count", 0),
            "down_count": breadth.get("down_count", 0),
            "flat_count": breadth.get("flat_count", 0),
            "limit_up": breadth.get("limit_up", 0),
            "limit_down": breadth.get("limit_down", 0),
        },
        "volume_trend": {
            "today": volume.get("today", 0.0),
            "avg_5d": volume.get("avg_5d", 0.0),
            "trend": volume.get("trend", []),
        },
        "limit_up_down_ratio": {
            "ratio": limit_ratio.get("ratio", 0.0),
            "limit_up": limit_ratio.get("limit_up", 0),
            "limit_down": limit_ratio.get("limit_down", 0),
            "score": limit_ratio.get("score", 0.0),
        },
        "fear_greed": {
            "value": fg.get("value", 0.0),
            "label": fg.get("label", "中性"),
            "percentile": fg.get("percentile", 50.0),
            "factors": fg.get("factors", {}),
        },
        "composite": {
            "value": composite.get("value", 0.0),
            "label": composite.get("label", "中性"),
            "percentile": composite.get("percentile", 50.0),
            "history": composite.get("history", []),
        },
        "warnings": all_warnings,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    try:
        cache.set(cache_key, result, SENTIMENT_CACHE_TTL)
    except Exception as e:  # noqa: BLE001
        logger.warning("缓存写入失败 overview: %s", e)
    return result
