"""市场数据服务

统一的行情数据接入层，封装 AKShare（主）和 Tushare（备）数据源。

降级策略：
1. AKShare 为主数据源（免费无需 token）
2. AKShare 失败 → 尝试 Tushare（需配置 token）
3. 都失败 → 返回缓存数据（如有）
4. 缓存也没有 → 抛出异常

统一返回格式:
{
    "code": "000001",
    "name": "平安银行",
    "klines": [
        {"date": "2024-01-01", "open": 10.0, "high": 10.5, "low": 9.8, "close": 10.2, "volume": 1000000},
        ...
    ]
}
"""
from __future__ import annotations

import logging
import time
import threading
from datetime import datetime
from typing import Any, Optional

from app.core.config import settings
from app.services.cache import build_key, get_cache

logger = logging.getLogger(__name__)

# 全局请求间隔控制（线程安全）
_last_request_lock = threading.Lock()
_last_request_time: float = 0.0


def _throttle() -> None:
    """请求间隔控制，避免触发数据源限流"""
    global _last_request_time
    interval = settings.MARKET_DATA_REQUEST_INTERVAL
    if interval <= 0:
        return
    with _last_request_lock:
        elapsed = time.time() - _last_request_time
        if elapsed < interval:
            time.sleep(interval - elapsed)
        _last_request_time = time.time()


def _normalize_code(code: str) -> str:
    """去除代码前缀空白和后缀（如 .SH / .SZ）"""
    if not code:
        return ""
    code = code.strip().upper()
    for suffix in (".SH", ".SZ", ".BJ", ".SS"):
        if code.endswith(suffix):
            code = code[: -len(suffix)]
    return code


def _guess_market(code: str) -> str:
    """根据代码判断市场：sh / sz / bj

    - 6 开头 → sh（沪市）
    - 0/3 开头 → sz（深市）
    - 8/4 开头 → bj（北交所）
    - 5/1 开头 → sz（基金/ETF 多在沪市，这里以 akshare 接受的格式优先返回 sh）
    """
    code = _normalize_code(code)
    if not code:
        return "sh"
    first = code[0]
    if first == "6":
        return "sh"
    if first in ("0", "3"):
        return "sz"
    if first in ("8", "4"):
        return "bj"
    return "sh"


def _row_to_kline(row: dict, date_field: str = "date") -> dict:
    """将一行行情数据归一化为标准 kline dict"""
    return {
        "date": str(row.get(date_field, "")),
        "open": float(row.get("open", 0) or 0),
        "high": float(row.get("high", 0) or 0),
        "low": float(row.get("low", 0) or 0),
        "close": float(row.get("close", 0) or 0),
        "volume": float(row.get("volume", 0) or 0),
    }


# ====================================================================
# AKShare 数据源
# ====================================================================

def _ak_get_stock_daily(code: str, start_date: str, end_date: str) -> dict:
    """AKShare 获取股票日线数据"""
    import akshare as ak

    _throttle()
    logger.info("AKShare 获取股票日线 code=%s %s~%s", code, start_date, end_date)
    df = ak.stock_zh_a_hist(
        symbol=code,
        period="daily",
        start_date=start_date.replace("-", ""),
        end_date=end_date.replace("-", ""),
        adjust="qfq",
    )
    if df is None or df.empty:
        return {"code": code, "name": "", "klines": []}

    name = ""
    klines = []
    for _, row in df.iterrows():
        klines.append({
            "date": str(row.get("日期", "")),
            "open": float(row.get("开盘", 0)),
            "high": float(row.get("最高", 0)),
            "low": float(row.get("最低", 0)),
            "close": float(row.get("收盘", 0)),
            "volume": float(row.get("成交量", 0)),
        })

    return {"code": code, "name": name, "klines": klines}


def _ak_get_stock_weekly(code: str, start_date: str, end_date: str) -> dict:
    """AKShare 获取股票周线数据"""
    import akshare as ak

    _throttle()
    logger.info("AKShare 获取股票周线 code=%s %s~%s", code, start_date, end_date)
    df = ak.stock_zh_a_hist(
        symbol=code,
        period="weekly",
        start_date=start_date.replace("-", ""),
        end_date=end_date.replace("-", ""),
        adjust="qfq",
    )
    if df is None or df.empty:
        return {"code": code, "name": "", "klines": []}

    klines = []
    for _, row in df.iterrows():
        klines.append({
            "date": str(row.get("日期", "")),
            "open": float(row.get("开盘", 0)),
            "high": float(row.get("最高", 0)),
            "low": float(row.get("最低", 0)),
            "close": float(row.get("收盘", 0)),
            "volume": float(row.get("成交量", 0)),
        })

    return {"code": code, "name": "", "klines": klines}


def _ak_get_stock_minute(code: str, period: str) -> dict:
    """AKShare 获取股票分钟线数据

    period: 5min / 15min / 30min / 60min
    """
    import akshare as ak

    _throttle()
    logger.info("AKShare 获取股票分钟线 code=%s period=%s", code, period)
    df = ak.stock_zh_a_hist_min_em(symbol=code, period=period, adjust="qfq")
    if df is None or df.empty:
        return {"code": code, "name": "", "klines": []}

    klines = []
    for _, row in df.iterrows():
        klines.append({
            "date": str(row.get("时间", "")),
            "open": float(row.get("开盘", 0)),
            "high": float(row.get("最高", 0)),
            "low": float(row.get("最低", 0)),
            "close": float(row.get("收盘", 0)),
            "volume": float(row.get("成交量", 0)),
        })

    return {"code": code, "name": "", "klines": klines}


def _ak_get_fund_nav(code: str, start_date: str, end_date: str) -> dict:
    """AKShare 获取基金历史净值"""
    import akshare as ak

    _throttle()
    logger.info("AKShare 获取基金净值 code=%s %s~%s", code, start_date, end_date)
    df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
    if df is None or df.empty:
        return {"code": code, "name": "", "klines": []}

    # 过滤日期范围
    try:
        df = df[(df["净值日期"] >= start_date) & (df["净值日期"] <= end_date)]
    except Exception as e:  # noqa: BLE001
        logger.warning("基金净值日期过滤失败: %s", e)

    klines = []
    for _, row in df.iterrows():
        # 基金净值没有 OHLC，统一用 close 表示净值，volume 用 0
        klines.append({
            "date": str(row.get("净值日期", "")),
            "open": 0.0,
            "high": 0.0,
            "low": 0.0,
            "close": float(row.get("单位净值", 0)),
            "volume": 0.0,
        })

    return {"code": code, "name": "", "klines": klines}


def _ak_get_fund_realtime(code: str) -> dict:
    """AKShare 获取基金实时估值"""
    import akshare as ak

    _throttle()
    logger.info("AKShare 获取基金实时估值 code=%s", code)
    df = ak.fund_value_estimate_em()
    if df is None or df.empty:
        return {"code": code, "name": "", "realtime": {}}

    row = df[df["基金代码"] == code]
    if row.empty:
        return {"code": code, "name": "", "realtime": {}}

    r = row.iloc[0]
    return {
        "code": code,
        "name": str(r.get("基金简称", "")),
        "realtime": {
            "date": str(r.get("估值日期", "")),
            "time": str(r.get("估值时间", "")),
            "estimated_nav": float(r.get("估算值", 0) or 0),
            "estimated_change_pct": float(r.get("估算增长率", 0) or 0),
        },
    }


def _ak_get_index_daily(code: str, start_date: str, end_date: str) -> dict:
    """AKShare 获取指数日线数据"""
    import akshare as ak

    _throttle()
    logger.info("AKShare 获取指数日线 code=%s %s~%s", code, start_date, end_date)
    df = ak.index_zh_a_hist(
        symbol=code,
        period="daily",
        start_date=start_date.replace("-", ""),
        end_date=end_date.replace("-", ""),
    )
    if df is None or df.empty:
        return {"code": code, "name": "", "klines": []}

    klines = []
    for _, row in df.iterrows():
        klines.append({
            "date": str(row.get("日期", "")),
            "open": float(row.get("开盘", 0)),
            "high": float(row.get("最高", 0)),
            "low": float(row.get("最低", 0)),
            "close": float(row.get("收盘", 0)),
            "volume": float(row.get("成交量", 0)),
        })

    return {"code": code, "name": "", "klines": klines}


def _ak_search_stock(keyword: str) -> list[dict]:
    """AKShare 搜索股票/基金代码和名称"""
    import akshare as ak

    _throttle()
    logger.info("AKShare 搜索 keyword=%s", keyword)
    results: list[dict] = []

    # 1. 搜索 A 股
    try:
        df = ak.stock_info_a_code_name()
        if df is not None and not df.empty:
            matched = df[
                df["code"].str.contains(keyword, case=False, na=False)
                | df["name"].str.contains(keyword, case=False, na=False)
            ]
            for _, row in matched.iterrows():
                results.append({
                    "code": str(row["code"]),
                    "name": str(row["name"]),
                    "type": "stock",
                    "market": _guess_market(str(row["code"])),
                })
    except Exception as e:  # noqa: BLE001
        logger.warning("AKShare 搜索 A 股失败: %s", e)

    # 2. 搜索基金
    try:
        df = ak.fund_name_em()
        if df is not None and not df.empty:
            # 基金表列名可能有多种：基金代码/基金简称
            code_col = "基金代码" if "基金代码" in df.columns else df.columns[0]
            name_col = "基金简称" if "基金简称" in df.columns else df.columns[1]
            matched = df[
                df[code_col].astype(str).str.contains(keyword, case=False, na=False)
                | df[name_col].astype(str).str.contains(keyword, case=False, na=False)
            ]
            for _, row in matched.iterrows():
                results.append({
                    "code": str(row[code_col]),
                    "name": str(row[name_col]),
                    "type": "fund",
                    "market": "",
                })
    except Exception as e:  # noqa: BLE001
        logger.warning("AKShare 搜索基金失败: %s", e)

    return results[:50]  # 限制返回 50 条


# ====================================================================
# Tushare 数据源（备选）
# ====================================================================

_tushare_pro = None


def _get_tushare_pro():
    """获取 Tushare pro 接口（单例）"""
    global _tushare_pro
    if _tushare_pro is not None:
        return _tushare_pro
    if not settings.TUSHARE_TOKEN:
        return None
    try:
        import tushare as ts
        ts.set_token(settings.TUSHARE_TOKEN)
        _tushare_pro = ts.pro_api()
        logger.info("Tushare 已初始化")
        return _tushare_pro
    except Exception as e:  # noqa: BLE001
        logger.warning("Tushare 初始化失败: %s", e)
        return None


def _ts_get_stock_daily(code: str, start_date: str, end_date: str) -> dict:
    """Tushare 获取股票日线数据"""
    pro = _get_tushare_pro()
    if not pro:
        raise RuntimeError("Tushare 未配置 token")

    _throttle()
    logger.info("Tushare 获取股票日线 code=%s %s~%s", code, start_date, end_date)
    ts_code = f"{code}.{_guess_market(code).upper()}"
    df = pro.daily(ts_code=ts_code, start_date=start_date.replace("-", ""), end_date=end_date.replace("-", ""))
    if df is None or df.empty:
        return {"code": code, "name": "", "klines": []}

    klines = []
    for _, row in df.iterrows():
        klines.append({
            "date": str(row.get("trade_date", "")),
            "open": float(row.get("open", 0)),
            "high": float(row.get("high", 0)),
            "low": float(row.get("low", 0)),
            "close": float(row.get("close", 0)),
            "volume": float(row.get("vol", 0)),
        })
    # Tushare 默认按日期倒序，改为正序
    klines.reverse()
    return {"code": code, "name": "", "klines": klines}


def _ts_get_index_daily(code: str, start_date: str, end_date: str) -> dict:
    """Tushare 获取指数日线数据"""
    pro = _get_tushare_pro()
    if not pro:
        raise RuntimeError("Tushare 未配置 token")

    _throttle()
    logger.info("Tushare 获取指数日线 code=%s %s~%s", code, start_date, end_date)
    ts_code = f"{code}.{_guess_market(code).upper()}"
    df = pro.index_daily(ts_code=ts_code, start_date=start_date.replace("-", ""), end_date=end_date.replace("-", ""))
    if df is None or df.empty:
        return {"code": code, "name": "", "klines": []}

    klines = []
    for _, row in df.iterrows():
        klines.append({
            "date": str(row.get("trade_date", "")),
            "open": float(row.get("open", 0)),
            "high": float(row.get("high", 0)),
            "low": float(row.get("low", 0)),
            "close": float(row.get("close", 0)),
            "volume": float(row.get("vol", 0)),
        })
    klines.reverse()
    return {"code": code, "name": "", "klines": klines}


# ====================================================================
# 降级策略统一封装
# ====================================================================

def _fallback(primary, fallback=None, *, cache_key: str, cache_ttl: int):
    """统一降级策略

    1. 调用 primary
    2. primary 失败 → 调用 fallback（如有）
    3. 都失败 → 返回缓存
    4. 缓存也没有 → 抛出最后一个异常
    """
    cache = get_cache()
    last_exc: Optional[Exception] = None

    for fn in (primary, fallback):
        if fn is None:
            continue
        try:
            result = fn()
            if result is not None:
                # 成功则更新缓存
                try:
                    cache.set(cache_key, result, cache_ttl)
                except Exception as e:  # noqa: BLE001
                    logger.warning("缓存写入失败 key=%s: %s", cache_key, e)
                return result
        except Exception as e:  # noqa: BLE001
            last_exc = e
            logger.warning("数据源调用失败: %s", e)

    # 数据源都失败，尝试缓存
    cached = cache.get(cache_key)
    if cached is not None:
        logger.info("数据源失败，使用缓存数据 key=%s", cache_key)
        return cached

    # 缓存也没有
    if last_exc:
        raise RuntimeError(f"所有数据源失败且无缓存: {last_exc}") from last_exc
    raise RuntimeError("所有数据源失败且无缓存")


# ====================================================================
# 对外暴露的统一接口
# ====================================================================

def get_stock_daily(code: str, start_date: str, end_date: str) -> dict:
    """获取股票日线数据（OHLCV）

    Args:
        code: 股票代码，如 "000001"
        start_date: 起始日期 "YYYY-MM-DD"
        end_date: 结束日期 "YYYY-MM-DD"

    Returns: 统一格式的行情数据 dict
    """
    code = _normalize_code(code)
    cache_key = build_key("stock_daily", code, f"{start_date}_{end_date}")
    return _fallback(
        primary=lambda: _ak_get_stock_daily(code, start_date, end_date),
        fallback=lambda: _ts_get_stock_daily(code, start_date, end_date),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_DAILY,
    )


def get_stock_weekly(code: str, start_date: str, end_date: str) -> dict:
    """获取股票周线数据"""
    code = _normalize_code(code)
    cache_key = build_key("stock_weekly", code, f"{start_date}_{end_date}")
    return _fallback(
        primary=lambda: _ak_get_stock_weekly(code, start_date, end_date),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_DAILY,
    )


def get_stock_minute(code: str, period: str) -> dict:
    """获取股票分钟线数据

    Args:
        code: 股票代码
        period: 周期，支持 5min / 15min / 30min / 60min
    """
    if period not in ("5", "15", "30", "60", "5min", "15min", "30min", "60min"):
        raise ValueError(f"不支持的分钟周期: {period}")
    # 归一化 period 为 akshare 接受的格式
    if period.endswith("min"):
        period = period.replace("min", "")
    code = _normalize_code(code)
    cache_key = build_key("stock_minute", code, f"{period}min")
    return _fallback(
        primary=lambda: _ak_get_stock_minute(code, f"{period}"),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_MINUTE,
    )


def get_fund_nav(code: str, start_date: str, end_date: str) -> dict:
    """获取基金历史净值"""
    code = _normalize_code(code)
    cache_key = build_key("fund_nav", code, f"{start_date}_{end_date}")
    return _fallback(
        primary=lambda: _ak_get_fund_nav(code, start_date, end_date),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_DAILY,
    )


def get_fund_realtime(code: str) -> dict:
    """获取基金实时估值"""
    code = _normalize_code(code)
    cache_key = build_key("fund_realtime", code)
    return _fallback(
        primary=lambda: _ak_get_fund_realtime(code),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_REALTIME,
    )


def get_index_daily(code: str, start_date: str, end_date: str) -> dict:
    """获取指数日线数据"""
    code = _normalize_code(code)
    cache_key = build_key("index_daily", code, f"{start_date}_{end_date}")
    return _fallback(
        primary=lambda: _ak_get_index_daily(code, start_date, end_date),
        fallback=lambda: _ts_get_index_daily(code, start_date, end_date),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_DAILY,
    )


def search_stock(keyword: str) -> list[dict]:
    """搜索股票/基金代码和名称"""
    keyword = keyword.strip()
    if not keyword:
        return []
    cache_key = build_key("search", keyword)
    cache = get_cache()
    cached = cache.get(cache_key)
    if cached is not None:
        logger.info("搜索命中缓存 keyword=%s", keyword)
        return cached
    try:
        results = _ak_search_stock(keyword)
        cache.set(cache_key, results, settings.CACHE_TTL_SEARCH)
        return results
    except Exception as e:  # noqa: BLE001
        logger.error("搜索失败 keyword=%s: %s", keyword, e)
        if cached is not None:
            return cached
        raise RuntimeError(f"搜索失败: {e}") from e


def get_realtime(code: str) -> dict:
    """获取实时行情（统一入口，自动判断股票/基金）

    简单规则：
    - 6 位数字且以 5/1 开头多为基金/ETF → 走基金实时估值
    - 其他按股票实时处理（akshare 实时接口）
    """
    code = _normalize_code(code)
    cache_key = build_key("realtime", code)
    cache = get_cache()

    def _fetch_stock_realtime() -> dict:
        import akshare as ak
        _throttle()
        logger.info("AKShare 获取股票实时行情 code=%s", code)
        df = ak.stock_zh_a_spot_em()
        if df is None or df.empty:
            return {"code": code, "name": "", "realtime": {}}
        row = df[df["代码"] == code]
        if row.empty:
            return {"code": code, "name": "", "realtime": {}}
        r = row.iloc[0]
        return {
            "code": code,
            "name": str(r.get("名称", "")),
            "realtime": {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "time": datetime.now().strftime("%H:%M:%S"),
                "price": float(r.get("最新价", 0) or 0),
                "change_pct": float(r.get("涨跌幅", 0) or 0),
                "change": float(r.get("涨跌额", 0) or 0),
                "volume": float(r.get("成交量", 0) or 0),
                "amount": float(r.get("成交额", 0) or 0),
                "open": float(r.get("今开", 0) or 0),
                "high": float(r.get("最高", 0) or 0),
                "low": float(r.get("最低", 0) or 0),
                "pre_close": float(r.get("昨收", 0) or 0),
            },
        }

    def _fetch_fund_realtime() -> dict:
        return _ak_get_fund_realtime(code)

    # 简单判断：基金代码通常以 1/5 开头且 6 位
    is_fund = len(code) == 6 and code[0] in ("1", "5")

    try:
        if is_fund:
            result = _fallback(
                primary=_fetch_fund_realtime,
                cache_key=cache_key,
                cache_ttl=settings.CACHE_TTL_REALTIME,
            )
        else:
            result = _fallback(
                primary=_fetch_stock_realtime,
                cache_key=cache_key,
                cache_ttl=settings.CACHE_TTL_REALTIME,
            )
        return result
    except Exception as e:  # noqa: BLE001
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        raise RuntimeError(f"获取实时行情失败: {e}") from e
