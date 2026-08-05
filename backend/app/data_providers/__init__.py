"""市场数据 provider 包

提供 MarketProvider 抽象基类 + 各数据源实现（AKShare / Tushare / Mock）。
service 层通过 app.services.market_data 调用门面函数，底层走 provider。
"""
from app.data_providers.base import MarketProvider, throttle_request
from app.data_providers.akshare_provider import AKShareProvider

__all__ = ["MarketProvider", "throttle_request", "AKShareProvider"]
