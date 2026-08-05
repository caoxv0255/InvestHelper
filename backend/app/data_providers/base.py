"""市场数据 Provider 抽象基类 + 全局节流工具

设计要点：
- MarketProvider 是 ABC，定义 8 个市场数据方法
- 所有方法返回统一格式（K线/实时/搜索）
- throttle_request() 是跨 provider 共享的全局节流器
  （避免多个 provider 同时打数据源触发限流）

扩展方式：
- 新建 TushareProvider / MockProvider / YahooProvider 等
  继承 MarketProvider 并实现 8 个方法
- 在 app.services.market_data.get_default_providers() 注册
"""
from __future__ import annotations

import threading
import time
from abc import ABC, abstractmethod

from app.core.config import settings

# ============== 全局节流器（线程安全）==============

_throttle_lock = threading.Lock()
_throttle_last_time: float = 0.0


def throttle_request() -> None:
    """全局请求节流：防止触发数据源限流

    多个 provider 共享同一个全局节流锁；间隔由 settings.MARKET_DATA_REQUEST_INTERVAL 控制。
    """
    global _throttle_last_time
    interval = settings.MARKET_DATA_REQUEST_INTERVAL
    if interval <= 0:
        return
    with _throttle_lock:
        elapsed = time.time() - _throttle_last_time
        if elapsed < interval:
            time.sleep(interval - elapsed)
        _throttle_last_time = time.time()


# ============== ABC ==============


class MarketProvider(ABC):
    """市场数据 Provider 抽象接口

    所有方法的返回格式：
    - K 线类（get_stock_daily / weekly / minute / fund_nav / index_daily）：
        {"code": str, "name": str, "klines": [
            {"date": str, "open": float, "high": float, "low": float,
             "close": float, "volume": float},
            ...
        ]}
    - 实时类（get_fund_realtime / get_realtime）：
        {"code": str, "name": str, "realtime": {...}}
    - 搜索（search_stock）：
        [{"code": str, "name": str, "type": "stock"|"fund", "market": str}, ...]

    实现说明：
    - 不需要关心缓存和 fallback 链，service 层处理
    - 失败时抛异常，让上层决定如何降级
    - 每次外部调用前应该 self._throttle()
    """

    #: provider 名称（用于日志）
    name: str = "abstract"

    @abstractmethod
    def get_stock_daily(self, code: str, start_date: str, end_date: str) -> dict:
        """获取股票日线数据（OHLCV）"""

    @abstractmethod
    def get_stock_weekly(self, code: str, start_date: str, end_date: str) -> dict:
        """获取股票周线数据"""

    @abstractmethod
    def get_stock_minute(self, code: str, period: str) -> dict:
        """获取股票分钟线数据

        Args:
            period: 5 / 15 / 30 / 60（不带 "min" 后缀）
        """

    @abstractmethod
    def get_fund_nav(self, code: str, start_date: str, end_date: str) -> dict:
        """获取基金历史净值"""

    @abstractmethod
    def get_fund_realtime(self, code: str) -> dict:
        """获取基金实时估值"""

    @abstractmethod
    def get_index_daily(self, code: str, start_date: str, end_date: str) -> dict:
        """获取指数日线数据"""

    @abstractmethod
    def search_stock(self, keyword: str) -> list[dict]:
        """搜索股票/基金代码和名称

        Returns: 最多 50 条匹配项
        """

    @abstractmethod
    def get_realtime(self, code: str) -> dict:
        """获取实时行情（自动判断股票/基金）"""

    # ----- 共享辅助 -----

    def _throttle(self) -> None:
        """provider 内部调用：全局节流

        每个外部数据源调用前应先调本方法，避免触发数据源限流。
        """
        throttle_request()

    @staticmethod
    def normalize_code(code: str) -> str:
        """去除代码前缀空白和后缀（.SH / .SZ / .BJ / .SS）"""
        if not code:
            return ""
        code = code.strip().upper()
        for suffix in (".SH", ".SZ", ".BJ", ".SS"):
            if code.endswith(suffix):
                code = code[: -len(suffix)]
        return code

    @staticmethod
    def guess_market(code: str) -> str:
        """根据代码判断市场：sh / sz / bj"""
        code = MarketProvider.normalize_code(code)
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