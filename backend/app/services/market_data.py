"""市场数据服务（service 门面）

设计：
- 公开的 8 个函数（get_stock_daily / weekly / minute / fund_nav / fund_realtime /
  index_daily / search_stock / get_realtime）保持原有签名 → service 调用方零改动
- 底层走 MarketProvider 抽象：当前实现是 AKShareProvider，未来加 TushareProvider /
  MockProvider 只需在 get_default_providers() 注册

降级策略：
- 单一 provider 失败 → fallback 到缓存（由 _fallback_with_cache 处理）
- 未来多 provider 链：把 fallback 参数扩展为 list[Provider]
"""
from __future__ import annotations

import logging
import threading
from typing import Any, Callable, Optional

from app.core.config import settings
from app.data_providers import AKShareProvider, MarketProvider, throttle_request
from app.services.cache import build_key, get_cache

logger = logging.getLogger(__name__)

# 暴露内部 throttle 给老代码用（向后兼容）
_throttle = throttle_request


# ============== Provider 调度 ==============

_providers_lock = threading.Lock()
_providers_cache: list[MarketProvider] | None = None


def get_default_providers() -> list[MarketProvider]:
    """返回默认 provider 列表（按优先级顺序）

    当前实现：[AKShareProvider]
    未来加 TushareProvider / MockProvider 时在这里注册。
    """
    global _providers_cache
    if _providers_cache is not None:
        return _providers_cache
    with _providers_lock:
        if _providers_cache is not None:
            return _providers_cache
        _providers_cache = [AKShareProvider()]
    return _providers_cache


def get_provider(name: str) -> MarketProvider:
    """按名称获取 provider（用于明确指定数据源）"""
    for p in get_default_providers():
        if p.name == name:
            return p
    raise KeyError(f"Provider not found: {name}")


def _normalize_code(code: str) -> str:
    """去除代码前缀空白和后缀（如 .SH / .SZ）"""
    return MarketProvider.normalize_code(code)


# ============== 降级策略 ==============


def _fallback_with_cache(
    fetch: Callable[[], Any],
    *,
    cache_key: str,
    cache_ttl: int,
) -> Any:
    """统一降级策略

    1. 调用 fetch
    2. fetch 失败 → 尝试缓存
    3. 缓存也没有 → 抛出最后一个异常

    未来扩展为多 provider 链时，把 fetch 改成依次尝试每个 provider。
    """
    cache = get_cache()
    last_exc: Optional[Exception] = None

    try:
        result = fetch()
        if result is not None:
            try:
                cache.set(cache_key, result, cache_ttl)
            except Exception as e:  # noqa: BLE001
                logger.warning("缓存写入失败 key=%s: %s", cache_key, e)
            return result
    except Exception as e:  # noqa: BLE001
        last_exc = e
        logger.warning("数据源调用失败: %s", e)

    # 数据源失败，尝试缓存
    cached = cache.get(cache_key)
    if cached is not None:
        logger.info("数据源失败，使用缓存数据 key=%s", cache_key)
        return cached

    if last_exc:
        raise RuntimeError(f"所有数据源失败且无缓存: {last_exc}") from last_exc
    raise RuntimeError("所有数据源失败且无缓存")


def _fallback(
    primary: Callable[[], Any],
    fallback: Optional[Callable[[], Any]] = None,
    *,
    cache_key: str,
    cache_ttl: int,
) -> Any:
    """双 provider 降级（AKShare 主 + Tushare 备）

    向后兼容：保留旧的双 callable 接口，未来用 _fallback_with_chain 替代。
    """
    cache = get_cache()
    last_exc: Optional[Exception] = None

    for fn in (primary, fallback):
        if fn is None:
            continue
        try:
            result = fn()
            if result is not None:
                try:
                    cache.set(cache_key, result, cache_ttl)
                except Exception as e:  # noqa: BLE001
                    logger.warning("缓存写入失败 key=%s: %s", cache_key, e)
                return result
        except Exception as e:  # noqa: BLE001
            last_exc = e
            logger.warning("数据源调用失败: %s", e)

    cached = cache.get(cache_key)
    if cached is not None:
        logger.info("数据源失败，使用缓存数据 key=%s", cache_key)
        return cached

    if last_exc:
        raise RuntimeError(f"所有数据源失败且无缓存: {last_exc}") from last_exc
    raise RuntimeError("所有数据源失败且无缓存")


# ============== 对外暴露的统一接口（service 层入口）==============


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
    provider = get_default_providers()[0]
    return _fallback(
        primary=lambda: provider.get_stock_daily(code, start_date, end_date),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_DAILY,
    )


def get_stock_weekly(code: str, start_date: str, end_date: str) -> dict:
    """获取股票周线数据"""
    code = _normalize_code(code)
    cache_key = build_key("stock_weekly", code, f"{start_date}_{end_date}")
    provider = get_default_providers()[0]
    return _fallback(
        primary=lambda: provider.get_stock_weekly(code, start_date, end_date),
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
    # 归一化 period 为 provider 接受的格式
    if period.endswith("min"):
        period = period.replace("min", "")
    code = _normalize_code(code)
    cache_key = build_key("stock_minute", code, f"{period}min")
    provider = get_default_providers()[0]
    return _fallback(
        primary=lambda: provider.get_stock_minute(code, period),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_MINUTE,
    )


def get_fund_nav(code: str, start_date: str, end_date: str) -> dict:
    """获取基金历史净值"""
    code = _normalize_code(code)
    cache_key = build_key("fund_nav", code, f"{start_date}_{end_date}")
    provider = get_default_providers()[0]
    return _fallback(
        primary=lambda: provider.get_fund_nav(code, start_date, end_date),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_DAILY,
    )


def get_fund_realtime(code: str) -> dict:
    """获取基金实时估值"""
    code = _normalize_code(code)
    cache_key = build_key("fund_realtime", code)
    provider = get_default_providers()[0]
    return _fallback(
        primary=lambda: provider.get_fund_realtime(code),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_REALTIME,
    )


def get_index_daily(code: str, start_date: str, end_date: str) -> dict:
    """获取指数日线数据"""
    code = _normalize_code(code)
    cache_key = build_key("index_daily", code, f"{start_date}_{end_date}")
    provider = get_default_providers()[0]
    return _fallback(
        primary=lambda: provider.get_index_daily(code, start_date, end_date),
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
    provider = get_default_providers()[0]
    try:
        results = provider.search_stock(keyword)
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
    - 其他按股票实时处理
    """
    code = _normalize_code(code)
    cache_key = build_key("realtime", code)
    provider = get_default_providers()[0]
    return _fallback(
        primary=lambda: provider.get_realtime(code),
        cache_key=cache_key,
        cache_ttl=settings.CACHE_TTL_REALTIME,
    )