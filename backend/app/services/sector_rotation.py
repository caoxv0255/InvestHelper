"""板块轮动监测服务

基于 AKShare 提供板块轮动相关指标：
- 行业板块资金流入流出排名（日 / 周）
- 板块热力图数据（涨跌幅 + 成交额）
- 板块强弱切换信号（近 5 日 vs 近 20 日排名变化）
- 风格轮动指标（大盘 vs 小盘、成长 vs 价值）
- 债股跷跷板效应

设计原则：
1. AKShare 调用失败时返回空列表或默认值并打 warning
2. 结果缓存 TTL 300 秒
3. 所有数值保留合理小数位
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from typing import Any, Optional

from app.core.config import settings
from app.services.cache import build_key, get_cache
from app.services.market_data import _throttle, get_index_daily

logger = logging.getLogger(__name__)

# 板块轮动缓存 TTL（秒）
SECTOR_CACHE_TTL: int = 300

# 沪深300 / 中证500 / 创业板指 / 国债指数代码
HS300_CODE: str = "000300"        # 沪深300（大盘代表）
ZZ500_CODE: str = "000905"        # 中证500（小盘代表）
CYB_CODE: str = "399006"          # 创业板指（成长代表）
BOND_INDEX_CODE: str = "sh000012"  # 国债指数


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


def _round(value: float, ndigits: int = 2) -> float:
    """安全的浮点四舍五入"""
    try:
        return round(value, ndigits)
    except (TypeError, OverflowError, ValueError):
        return 0.0


def _get_cached(cache_key: str) -> Optional[Any]:
    """读取缓存"""
    try:
        return get_cache().get(cache_key)
    except Exception as e:  # noqa: BLE001
        logger.warning("缓存读取失败 key=%s: %s", cache_key, e)
        return None


def _set_cached(cache_key: str, value: Any, ttl: int = SECTOR_CACHE_TTL) -> None:
    """写入缓存"""
    try:
        get_cache().set(cache_key, value, ttl)
    except Exception as e:  # noqa: BLE001
        logger.warning("缓存写入失败 key=%s: %s", cache_key, e)


# ====================================================================
# 板块资金流（行业板块资金流排名）
# ====================================================================

def get_sector_fund_flow(period: str = "daily") -> dict:
    """行业板块资金流入流出排名

    Args:
        period: daily / weekly

    Returns:
        {
            "period": "daily",
            "items": [
                {
                    "name": "银行",
                    "change_pct": 1.23,           # 板块涨跌幅 %
                    "net_inflow": 12.34,           # 主力净流入额（亿元）
                    "rank": 1,
                },
                ...
            ],
            "warnings": [str, ...]
        }
    """
    period = period if period in ("daily", "weekly") else "daily"
    cache_key = build_key("sector", "fund_flow", period)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    warnings: list[str] = []
    items: list[dict] = []

    try:
        import akshare as ak
        _throttle()
        # stock_sector_fund_flow_rank 接口
        # indicator: "今日" / "5日" / "10日"
        indicator = "今日" if period == "daily" else "5日"
        df = ak.stock_sector_fund_flow_rank(indicator=indicator, sector_type="行业资金流")
        if df is None or df.empty:
            warnings.append(f"板块资金流接口返回空数据 indicator={indicator}")
        else:
            # 列名兼容：名称 / 涨跌幅 / 主力净流入-净额/今日/5日 等
            name_col = None
            pct_col = None
            flow_col = None

            for col in df.columns:
                col_str = str(col)
                if name_col is None and ("名称" in col_str or "行业" in col_str):
                    name_col = col
                if pct_col is None and "涨跌幅" in col_str:
                    pct_col = col
                if flow_col is None and ("主力净流入-净额" in col_str or "净流入" in col_str):
                    flow_col = col

            if name_col is None:
                name_col = df.columns[0]
            if flow_col is None:
                # 兜底取最后一列
                flow_col = df.columns[-1]

            for _, row in df.iterrows():
                name = str(row.get(name_col, "")).strip()
                if not name:
                    continue
                pct = _safe_float(row.get(pct_col, 0)) if pct_col else 0.0
                flow = _safe_float(row.get(flow_col, 0))
                # 元 → 亿元
                items.append({
                    "name": name,
                    "change_pct": _round(pct, 2),
                    "net_inflow": _round(flow / 1e8, 2),
                })

            # 按净流入额降序排序
            items.sort(key=lambda x: x["net_inflow"], reverse=True)
            for idx, item in enumerate(items, start=1):
                item["rank"] = idx
    except Exception as e:  # noqa: BLE001
        logger.warning("获取板块资金流失败 period=%s: %s", period, e)
        warnings.append(f"板块资金流数据获取失败: {e}")

    result = {
        "period": period,
        "items": items,
        "warnings": warnings,
    }
    _set_cached(cache_key, result)
    return result


# ====================================================================
# 板块热力图数据
# ====================================================================

def get_sector_heatmap_data() -> dict:
    """板块热力图数据：行业板块涨跌幅 + 成交额 + 资金流

    Returns:
        {
            "items": [
                {
                    "name": "银行",
                    "change_percent": 1.23,
                    "amount": 123.45,    # 成交额（亿元）
                    "fund_flow": 12.34,  # 净流入额（亿元）
                },
                ...
            ],
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sector", "heatmap", "summary")
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    warnings: list[str] = []
    items: list[dict] = []

    try:
        import akshare as ak
        _throttle()
        # stock_board_industry_name_em：东方财富行业板块实时行情
        df = ak.stock_board_industry_name_em()
        if df is None or df.empty:
            warnings.append("行业板块实时行情接口返回空数据")
        else:
            name_col = None
            pct_col = None
            amount_col = None
            for col in df.columns:
                col_str = str(col)
                if name_col is None and ("板块名称" in col_str or "名称" in col_str):
                    name_col = col
                if pct_col is None and "涨跌幅" in col_str:
                    pct_col = col
                if amount_col is None and ("总成交额" in col_str or "成交额" in col_str):
                    amount_col = col

            if name_col is None:
                name_col = df.columns[0]

            for _, row in df.iterrows():
                name = str(row.get(name_col, "")).strip()
                if not name:
                    continue
                pct = _safe_float(row.get(pct_col, 0)) if pct_col else 0.0
                amount = _safe_float(row.get(amount_col, 0)) if amount_col else 0.0
                items.append({
                    "name": name,
                    "change_percent": _round(pct, 2),
                    "amount": _round(amount / 1e8, 2),  # 元 → 亿元
                    "fund_flow": 0.0,  # 占位，后续从资金流接口合并
                })

            # 合并资金流数据
            try:
                flow_data = get_sector_fund_flow(period="daily")
                flow_map = {item["name"]: item.get("net_inflow", 0.0) for item in flow_data.get("items", [])}
                for item in items:
                    item["fund_flow"] = _round(flow_map.get(item["name"], 0.0), 2)
            except Exception as e:  # noqa: BLE001
                logger.warning("合并资金流数据失败: %s", e)
                warnings.append(f"合并资金流数据失败: {e}")
    except Exception as e:  # noqa: BLE001
        logger.warning("获取板块热力图数据失败: %s", e)
        warnings.append(f"板块热力图数据获取失败: {e}")

    result = {
        "items": items,
        "warnings": warnings,
    }
    _set_cached(cache_key, result)
    return result


# ====================================================================
# 板块强弱切换信号
# ====================================================================

def get_sector_strength_switch() -> dict:
    """板块强弱切换信号

    通过比较近 5 日 vs 近 20 日板块涨跌幅排名变化，
    识别"强势转弱"和"弱势转强"板块。

    Returns:
        {
            "strengthening": [   # 弱势转强
                {"name": "...", "rank_5d": 5, "rank_20d": 18, "change": 13},
                ...
            ],
            "weakening": [       # 强势转弱
                {"name": "...", "rank_5d": 25, "rank_20d": 3, "change": -22},
                ...
            ],
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sector", "strength_switch", "summary")
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    warnings: list[str] = []
    strengthening: list[dict] = []
    weakening: list[dict] = []

    try:
        import akshare as ak
        from datetime import datetime, timedelta as _td

        # 正确做法：对每个板块单独获取历史 K 线，然后计算 5 日 / 20 日涨跌幅排名
        _throttle()
        board_df = ak.stock_board_industry_name_em()
        if board_df is None or board_df.empty:
            warnings.append("板块强弱切换数据接口返回空（板块列表）")
        else:
            name_col = None
            for col in board_df.columns:
                if "板块名称" in str(col) or "名称" in str(col):
                    name_col = col
                    break
            if name_col is None:
                name_col = board_df.columns[0]

            board_names = [str(n).strip() for n in board_df[name_col].tolist() if str(n).strip()]
            end_dt = datetime.now().strftime("%Y%m%d")
            start_dt = (datetime.now() - _td(days=45)).strftime("%Y%m%d")

            pct_5d_map: dict[str, float] = {}
            pct_20d_map: dict[str, float] = {}
            fetch_errors: list[str] = []

            for board_name in board_names:
                try:
                    _throttle()
                    hist_df = ak.stock_board_industry_hist_em(
                        symbol=board_name,
                        start_date=start_dt,
                        end_date=end_dt,
                        period="日k",
                        adjust="qfq",
                    )
                except Exception as e:  # noqa: BLE001
                    fetch_errors.append(f"{board_name}: {e}")
                    continue
                if hist_df is None or hist_df.empty or len(hist_df) < 2:
                    continue
                # 找收盘价列
                close_col = None
                for col in hist_df.columns:
                    col_str = str(col)
                    if "收盘" in col_str or col_str.lower() == "close":
                        close_col = col
                        break
                if close_col is None:
                    continue
                closes = hist_df[close_col].astype(float).tolist()
                if len(closes) < 2:
                    continue
                last = closes[-1]
                # 5 日：取 5 个交易日前的收盘
                if len(closes) >= 6:
                    base_5d = closes[-6]
                    pct_5d_map[board_name] = (last / base_5d - 1) * 100
                # 20 日：取 20 个交易日前的收盘
                if len(closes) >= 21:
                    base_20d = closes[-21]
                    pct_20d_map[board_name] = (last / base_20d - 1) * 100
                else:
                    # 数据不足 21 个交易日则用现有最早一日做近似
                    base_20d = closes[0]
                    pct_20d_map[board_name] = (last / base_20d - 1) * 100

            if fetch_errors:
                warnings.append(f"部分板块历史拉取失败({len(fetch_errors)}/{len(board_names)})")

            # 计算近5日和近20日的板块排名（按涨跌幅降序）
            rank_5d = {name: idx + 1 for idx, (name, _) in enumerate(
                sorted(pct_5d_map.items(), key=lambda x: x[1], reverse=True)
            )}
            rank_20d = {name: idx + 1 for idx, (name, _) in enumerate(
                sorted(pct_20d_map.items(), key=lambda x: x[1], reverse=True)
            )}

            # 名次变化 = 20日排名 - 5日排名（正值表示 5 日排名靠前 = 走强）
            # 走强定义：5日排名明显高于20日排名（5日排名靠前，rank_5d < rank_20d）
            for name in pct_5d_map.keys():
                r5 = rank_5d.get(name, 0)
                r20 = rank_20d.get(name, 0)
                if r5 == 0 or r20 == 0:
                    continue
                change = r20 - r5  # 排名上升为正 = 强势转强
                if change >= 5 and r5 <= 15:
                    # 弱势转强：之前排名靠后(rank_20d 大)，现在靠前(rank_5d 小)
                    strengthening.append({
                        "name": name,
                        "rank_5d": r5,
                        "rank_20d": r20,
                        "change": change,
                        "pct_5d": _round(pct_5d_map.get(name, 0.0), 2),
                        "pct_20d": _round(pct_20d_map.get(name, 0.0), 2),
                    })
                elif change <= -5 and r20 <= 15:
                    # 强势转弱：之前排名靠前，现在靠后
                    weakening.append({
                        "name": name,
                        "rank_5d": r5,
                        "rank_20d": r20,
                        "change": change,
                        "pct_5d": _round(pct_5d_map.get(name, 0.0), 2),
                        "pct_20d": _round(pct_20d_map.get(name, 0.0), 2),
                    })

            # 按变化幅度排序
            strengthening.sort(key=lambda x: x["change"], reverse=True)
            weakening.sort(key=lambda x: x["change"])
    except Exception as e:  # noqa: BLE001
        logger.warning("获取板块强弱切换信号失败: %s", e)
        warnings.append(f"板块强弱切换数据获取失败: {e}")

    result = {
        "strengthening": strengthening,
        "weakening": weakening,
        "warnings": warnings,
    }
    _set_cached(cache_key, result)
    return result


# ====================================================================
# 风格轮动指标
# ====================================================================

def _calc_index_return(code: str, days: int) -> float:
    """计算指数近 N 日累计收益率（百分比）

    Returns: 收益率（如 5.23 表示 5.23%），失败返回 0.0
    """
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days * 2 + 10)).strftime("%Y-%m-%d")
    try:
        data = get_index_daily(code, start_date, end_date)
        klines = data.get("klines", [])
        if len(klines) < 2:
            return 0.0
        # 取最近 N 个交易日
        recent = klines[-days:] if len(klines) >= days else klines
        if len(recent) < 2:
            return 0.0
        start_close = _safe_float(recent[0].get("close"))
        end_close = _safe_float(recent[-1].get("close"))
        if start_close <= 0:
            return 0.0
        return (end_close - start_close) / start_close * 100
    except Exception as e:  # noqa: BLE001
        logger.warning("计算指数收益率失败 code=%s: %s", code, e)
        return 0.0


def get_style_rotation() -> dict:
    """风格轮动指标

    - 大盘 vs 小盘：沪深300 vs 中证500 近 20 日收益对比
    - 成长 vs 价值：创业板指 vs 沪深300 近 20 日收益对比

    Returns:
        {
            "large_vs_small": {
                "large_return": 2.34,    # 沪深300 近 20 日收益 %
                "small_return": 4.56,    # 中证500 近 20 日收益 %
                "ratio": -2.22,          # 大盘 - 小盘
                "trend": "small_cap",    # large_cap / small_cap / balanced
            },
            "growth_vs_value": {
                "growth_return": 3.45,   # 创业板指 近 20 日收益 %
                "value_return": 1.23,    # 沪深300 近 20 日收益 %
                "ratio": 2.22,           # 成长 - 价值
                "trend": "growth",       # growth / value / balanced
            },
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sector", "style_rotation", "summary")
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    warnings: list[str] = []
    window = 20

    # 大盘 vs 小盘
    large_return = _calc_index_return(HS300_CODE, window)
    small_return = _calc_index_return(ZZ500_CODE, window)
    ls_ratio = _round(large_return - small_return, 2)
    if ls_ratio > 1.0:
        ls_trend = "large_cap"
    elif ls_ratio < -1.0:
        ls_trend = "small_cap"
    else:
        ls_trend = "balanced"

    # 成长 vs 价值
    growth_return = _calc_index_return(CYB_CODE, window)
    value_return = large_return  # 用沪深300作为价值代表
    gv_ratio = _round(growth_return - value_return, 2)
    if gv_ratio > 1.0:
        gv_trend = "growth"
    elif gv_ratio < -1.0:
        gv_trend = "value"
    else:
        gv_trend = "balanced"

    if abs(large_return) < 1e-6 and abs(small_return) < 1e-6:
        warnings.append("大盘/小盘收益数据缺失")

    result = {
        "large_vs_small": {
            "large_return": _round(large_return, 2),
            "small_return": _round(small_return, 2),
            "ratio": ls_ratio,
            "trend": ls_trend,
        },
        "growth_vs_value": {
            "growth_return": _round(growth_return, 2),
            "value_return": _round(value_return, 2),
            "ratio": gv_ratio,
            "trend": gv_trend,
        },
        "warnings": warnings,
    }
    _set_cached(cache_key, result)
    return result


# ====================================================================
# 债股跷跷板效应
# ====================================================================

def get_bond_stock_seesaw() -> dict:
    """债股跷跷板效应

    比较国债指数与沪深300近 20 日收益。

    Returns:
        {
            "bond_return": 0.56,      # 国债指数近 20 日收益 %
            "stock_return": 2.34,      # 沪深300 近 20 日收益 %
            "correlation": -0.23,      # 简化的反向信号（差异越大跷跷板越明显）
            "signal": "stock_strong",  # stock_strong / bond_strong / balanced
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sector", "bond_stock", "summary")
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    warnings: list[str] = []
    window = 20

    bond_return = 0.0
    try:
        # 使用国债指数：尝试用 stock_zh_index_daily_em 接口
        import akshare as ak
        _throttle()
        try:
            df = ak.stock_zh_index_daily_em(symbol=BOND_INDEX_CODE)
            if df is not None and not df.empty:
                # 列名兼容：date / close
                date_col = "date" if "date" in df.columns else df.columns[0]
                close_col = "close" if "close" in df.columns else None
                if close_col is None:
                    for col in df.columns:
                        if "收盘" in str(col):
                            close_col = col
                            break
                if close_col is None and len(df.columns) >= 5:
                    close_col = df.columns[-1]
                if close_col is not None:
                    df_sorted = df.sort_values(by=date_col)
                    recent = df_sorted.tail(window)
                    if len(recent) >= 2:
                        start_close = _safe_float(recent.iloc[0].get(close_col))
                        end_close = _safe_float(recent.iloc[-1].get(close_col))
                        if start_close > 0:
                            bond_return = (end_close - start_close) / start_close * 100
        except Exception as e:  # noqa: BLE001
            logger.warning("获取国债指数失败: %s", e)
            warnings.append(f"国债指数数据获取失败: {e}")
    except Exception as e:  # noqa: BLE001
        logger.warning("获取国债指数失败: %s", e)
        warnings.append(f"国债指数数据获取失败: {e}")

    stock_return = _calc_index_return(HS300_CODE, window)

    # 简化的相关性：使用收益差作为反向信号
    diff = stock_return - bond_return
    if abs(diff) < 1.0:
        signal = "balanced"
        correlation = 0.0
    elif stock_return > bond_return:
        signal = "stock_strong"
        correlation = -min(1.0, abs(diff) / 5.0)  # 差异越大越负相关
    else:
        signal = "bond_strong"
        correlation = -min(1.0, abs(diff) / 5.0)

    if abs(bond_return) < 1e-6:
        warnings.append("国债指数收益数据缺失")

    result = {
        "bond_return": _round(bond_return, 2),
        "stock_return": _round(stock_return, 2),
        "correlation": _round(correlation, 2),
        "signal": signal,
        "warnings": warnings,
    }
    _set_cached(cache_key, result)
    return result


# ====================================================================
# 汇总
# ====================================================================

def get_sector_rotation_overview() -> dict:
    """汇总返回所有板块轮动数据

    Returns:
        {
            "fund_flow_daily": {...},
            "fund_flow_weekly": {...},
            "heatmap": {...},
            "strength_switch": {...},
            "style_rotation": {...},
            "bond_stock": {...},
            "warnings": [str, ...]
        }
    """
    cache_key = build_key("sector", "overview", "summary")
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    all_warnings: list[str] = []

    fund_flow_daily = get_sector_fund_flow(period="daily")
    all_warnings.extend(fund_flow_daily.get("warnings", []))

    fund_flow_weekly = get_sector_fund_flow(period="weekly")
    all_warnings.extend(fund_flow_weekly.get("warnings", []))

    heatmap = get_sector_heatmap_data()
    all_warnings.extend(heatmap.get("warnings", []))

    strength_switch = get_sector_strength_switch()
    all_warnings.extend(strength_switch.get("warnings", []))

    style_rotation = get_style_rotation()
    all_warnings.extend(style_rotation.get("warnings", []))

    bond_stock = get_bond_stock_seesaw()
    all_warnings.extend(bond_stock.get("warnings", []))

    result = {
        "fund_flow_daily": fund_flow_daily,
        "fund_flow_weekly": fund_flow_weekly,
        "heatmap": heatmap,
        "strength_switch": strength_switch,
        "style_rotation": style_rotation,
        "bond_stock": bond_stock,
        "warnings": all_warnings,
    }
    _set_cached(cache_key, result)
    return result
