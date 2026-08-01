"""缓存服务

提供简单的内存缓存（OrderedDict + TTL + LRU）以及可选的 Redis 缓存。
缓存 key 格式：market_data:{type}:{code}:{params}
"""
import json
import time
import logging
import threading
from collections import OrderedDict
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class MemoryCache:
    """基于 OrderedDict + TTL 的简单内存缓存，线程安全，最近写入超限会淘汰最旧条目"""

    # 默认上限：10000 条。10000 条 JSON 数据约占用几十 MB 到几百 MB，
    # 在单用户本地工具场景下足够一日运行；超过上限后写入会触发 LRU 淘汰。
    DEFAULT_MAX_SIZE = 10000

    def __init__(self, max_size: int | None = None) -> None:
        # 结构: {key: {"value": Any, "expire_at": float}}
        # OrderedDict 实现 LRU：get/set 时移到末尾，超限时 popitem(last=False) 弹出最早的
        self._store: "OrderedDict[str, dict[str, Any]]" = OrderedDict()
        self._lock = threading.Lock()
        self._max_size = max_size if max_size and max_size > 0 else self.DEFAULT_MAX_SIZE

    def get(self, key: str) -> Optional[Any]:
        """获取缓存值，过期返回 None 并清理；命中则将 key 标记为最近使用"""
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            if item["expire_at"] < time.time():
                self._store.pop(key, None)
                return None
            # LRU：命中后移到末尾
            self._store.move_to_end(key)
            return item["value"]

    def set(self, key: str, value: Any, ttl: int) -> None:
        """设置缓存值，ttl 单位为秒；超限时淘汰最旧条目"""
        with self._lock:
            if key in self._store:
                # 更新时同样移到末尾
                self._store.move_to_end(key)
            self._store[key] = {
                "value": value,
                "expire_at": time.time() + ttl,
            }
            while len(self._store) > self._max_size:
                self._store.popitem(last=False)

    def delete(self, key: str) -> None:
        """删除指定缓存"""
        with self._lock:
            self._store.pop(key, None)

    def clear(self) -> None:
        """清空所有缓存"""
        with self._lock:
            self._store.clear()

    def cleanup_expired(self) -> int:
        """清理所有过期缓存，返回清理数量"""
        now = time.time()
        with self._lock:
            expired_keys = [k for k, v in self._store.items() if v["expire_at"] < now]
            for k in expired_keys:
                self._store.pop(k, None)
        return len(expired_keys)

    def stats(self) -> dict:
        """返回缓存统计信息（用于调试和监控）"""
        with self._lock:
            return {
                "size": len(self._store),
                "max_size": self._max_size,
            }


class RedisCache:
    """Redis 缓存封装（可选，当配置 REDIS_URL 时启用）"""

    def __init__(self, url: str) -> None:
        import redis  # 延迟导入，未启用时不强制依赖
        self._client = redis.from_url(url, decode_responses=True)
        logger.info("Redis 缓存已启用: %s", url)

    def get(self, key: str) -> Optional[Any]:
        raw = self._client.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return raw

    def set(self, key: str, value: Any, ttl: int) -> None:
        try:
            self._client.setex(key, ttl, json.dumps(value, ensure_ascii=False, default=str))
        except (TypeError, ValueError) as e:
            logger.warning("Redis 缓存写入失败 key=%s: %s", key, e)

    def delete(self, key: str) -> None:
        self._client.delete(key)

    def clear(self) -> None:
        self._client.flushdb()

    def cleanup_expired(self) -> int:
        # Redis 自动过期，无需手动清理
        return 0


# 全局缓存实例：优先 Redis，否则使用内存缓存
_cache: "MemoryCache | RedisCache | None" = None


def get_cache():
    """获取缓存实例（单例）"""
    global _cache
    if _cache is not None:
        return _cache
    if settings.REDIS_ENABLED:
        try:
            _cache = RedisCache(settings.REDIS_URL)
        except Exception as e:  # noqa: BLE001
            logger.error("Redis 初始化失败，回退到内存缓存: %s", e)
            _cache = MemoryCache(max_size=settings.CACHE_MAX_SIZE)
    else:
        _cache = MemoryCache(max_size=settings.CACHE_MAX_SIZE)
    return _cache


def build_key(category: str, code: str, params: str = "") -> str:
    """构建标准缓存 key

    格式: market_data:{type}:{code}:{params}
    """
    parts = ["market_data", category, code]
    if params:
        parts.append(params)
    return ":".join(parts)
