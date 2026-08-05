import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME: str = "InvestHelper"
    API_V1_PREFIX: str = "/api"

    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./invest_helper.db")

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # ===== 市场数据相关配置 =====
    # Tushare token（备选数据源，免费申请：https://tushare.pro/register）
    TUSHARE_TOKEN: str = os.getenv("TUSHARE_TOKEN", "")

    # Redis 配置（可选，未配置时使用内存缓存）
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    REDIS_ENABLED: bool = bool(REDIS_URL) or os.getenv("REDIS_ENABLED", "").lower() == "true"

    # 内存缓存最大条目数（超限触发 LRU 淘汰）
    CACHE_MAX_SIZE: int = int(os.getenv("CACHE_MAX_SIZE", "10000"))

    # 缓存 TTL（秒）
    CACHE_TTL_DAILY: int = int(os.getenv("CACHE_TTL_DAILY", "3600"))        # 日线 1 小时
    CACHE_TTL_MINUTE: int = int(os.getenv("CACHE_TTL_MINUTE", "60"))       # 分钟线 1 分钟
    CACHE_TTL_SEARCH: int = int(os.getenv("CACHE_TTL_SEARCH", "600"))      # 搜索 10 分钟
    CACHE_TTL_REALTIME: int = int(os.getenv("CACHE_TTL_REALTIME", "30"))   # 实时行情 30 秒

    # 请求间隔（秒），用于接口限流控制
    MARKET_DATA_REQUEST_INTERVAL: float = float(os.getenv("MARKET_DATA_REQUEST_INTERVAL", "0.3"))

    # 请求超时（秒）
    MARKET_DATA_TIMEOUT: int = int(os.getenv("MARKET_DATA_TIMEOUT", "30"))

    # 每日组合快照调度（本地服务运行时生效）
    DAILY_SNAPSHOT_ENABLED: bool = os.getenv("DAILY_SNAPSHOT_ENABLED", "true").lower() == "true"
    DAILY_SNAPSHOT_HOUR: int = int(os.getenv("DAILY_SNAPSHOT_HOUR", "20"))

    # ===== 财经快讯相关配置 =====
    # 快讯抓取间隔（秒），本地服务运行时生效
    NEWS_CRAWL_INTERVAL: int = int(os.getenv("NEWS_CRAWL_INTERVAL", "60"))
    # 快讯抓取是否启用
    NEWS_CRAWL_ENABLED: bool = os.getenv("NEWS_CRAWL_ENABLED", "true").lower() == "true"


settings = Settings()


def effective_settings_summary() -> dict[str, str]:
    """返回生效配置摘要（用于启动时日志打印）

    不包含敏感信息（TUSHARE_TOKEN 永远不打印）。
    """
    cache_mode = (
        f"redis({settings.REDIS_URL})"
        if settings.REDIS_ENABLED and settings.REDIS_URL
        else f"memory(max={settings.CACHE_MAX_SIZE})"
    )
    return {
        "database": settings.DATABASE_URL,
        "tushare": "enabled" if settings.TUSHARE_TOKEN else "disabled",
        "cache": cache_mode,
        "cors_origins": ",".join(settings.CORS_ORIGINS),
        "daily_snapshot": (
            f"enabled(hour={settings.DAILY_SNAPSHOT_HOUR})"
            if settings.DAILY_SNAPSHOT_ENABLED
            else "disabled"
        ),
        "news_crawl": (
            f"enabled(interval={settings.NEWS_CRAWL_INTERVAL}s)"
            if settings.NEWS_CRAWL_ENABLED
            else "disabled"
        ),
        "akshare_throttle": f"{settings.MARKET_DATA_REQUEST_INTERVAL}s",
    }
