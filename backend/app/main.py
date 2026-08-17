import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import health, holdings, deposits, dashboard, market, signals, transactions, backtests, portfolio, portfolio_history, risk, position, sector_rotation, news, sentiment, opportunities
from app.core.config import effective_settings_summary, settings
from app.db.session import engine, Base
from app.models import *  # noqa: F401, F403 - 导入所有模型以确保注册到 Base.metadata
from app.db.session import SessionLocal
from app.services.portfolio import capture_portfolio_snapshot
from app.services.price_refresh import refresh_holding_prices
from app.services import news_crawler

logger = logging.getLogger(__name__)

# 应用启动时打印生效配置（不暴露 TUSHARE_TOKEN 等敏感字段）
logger.info("InvestHelper starting with config: %s", effective_settings_summary())


async def _daily_snapshot_loop():
    """本地服务运行期间，每天按 Asia/Shanghai 时间采集一次快照。"""
    timezone = ZoneInfo("Asia/Shanghai")
    while True:
        now = datetime.now(timezone)
        target = now.replace(hour=settings.DAILY_SNAPSHOT_HOUR, minute=0, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        await asyncio.sleep(max(1, (target - now).total_seconds()))
        def capture_in_worker():
            db = SessionLocal()
            try:
                # 快照采集前先刷新持仓价格，保证快照中 market_value 反映当日最新行情
                try:
                    refresh_holding_prices(db)
                except Exception as e:  # noqa: BLE001
                    logger.warning("快照前刷新持仓价格失败: %s", e)
                return capture_portfolio_snapshot(db)
            finally:
                db.close()
        await asyncio.to_thread(capture_in_worker)


async def _news_crawl_loop():
    """本地服务运行期间，按 NEWS_CRAWL_INTERVAL 间隔定时抓取财经快讯。

    后台循环不使用 mock 降级，避免反复写入示例数据；
    三源全部失败时仅记录 warning，等待下一轮。
    """
    # 间隔最小 10 秒，避免配置过低导致请求过频
    interval = max(10, settings.NEWS_CRAWL_INTERVAL)
    while True:
        await asyncio.sleep(interval)
        try:
            # 后台抓取不启用 mock 降级
            added = await asyncio.to_thread(news_crawler.crawl_all, False)
            logger.info("定时快讯抓取完成，新增 %d 条", added)
        except Exception as e:  # noqa: BLE001
            logger.warning("定时快讯抓取异常: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理，启动时初始化数据库"""
    Base.metadata.create_all(bind=engine)
    task = asyncio.create_task(_daily_snapshot_loop()) if settings.DAILY_SNAPSHOT_ENABLED else None
    # 启动定时快讯抓取任务
    news_task = (
        asyncio.create_task(_news_crawl_loop())
        if settings.NEWS_CRAWL_ENABLED and settings.NEWS_CRAWL_INTERVAL > 0
        else None
    )
    try:
        yield
    finally:
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        if news_task:
            news_task.cancel()
            await asyncio.gather(news_task, return_exceptions=True)


app = FastAPI(
    title="InvestHelper API",
    description="投资助手后端 API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(holdings.router, prefix="/api", tags=["holdings"])
app.include_router(deposits.router, prefix="/api", tags=["deposits"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(market.router, prefix="/api", tags=["market"])
app.include_router(signals.router, prefix="/api", tags=["signals"])
app.include_router(transactions.router, prefix="/api", tags=["transactions"])
app.include_router(backtests.router, prefix="/api", tags=["strategy"])
app.include_router(portfolio.router, prefix="/api", tags=["portfolio"])
app.include_router(portfolio_history.router, prefix="/api", tags=["portfolio"])
app.include_router(risk.router, prefix="/api", tags=["risk"])
app.include_router(position.router, prefix="/api", tags=["position"])
app.include_router(news.router, prefix="/api", tags=["news"])
app.include_router(sector_rotation.router, prefix="/api", tags=["sector"])
app.include_router(sentiment.router, prefix="/api", tags=["sentiment"])
app.include_router(opportunities.router, prefix="/api", tags=["opportunities"])


@app.get("/")
async def root():
    return {"message": "Welcome to InvestHelper API", "version": "0.1.0"}
