"""市场数据 API 路由

提供：
- GET /api/market/search?keyword=xxx - 搜索股票/基金
- GET /api/market/kline?code=xxx&period=daily&start=xxx&end=xxx - 获取K线数据
- GET /api/market/realtime?code=xxx - 获取实时行情
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services import market_data

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/market/search")
async def search(
    keyword: str = Query(..., description="搜索关键词（股票/基金代码或名称）"),
):
    """搜索股票/基金代码和名称"""
    try:
        results = market_data.search_stock(keyword)
        return {
            "keyword": keyword,
            "total": len(results),
            "items": results,
        }
    except Exception as e:
        logger.exception("搜索接口异常 keyword=%s", keyword)
        raise HTTPException(status_code=500, detail=f"搜索失败: {e}")


@router.get("/market/kline")
async def kline(
    code: str = Query(..., description="股票/基金/指数代码，如 000001"),
    asset_type: str = Query("stock", description="数据类型: stock / fund / index"),
    period: str = Query("daily", description="K线周期: daily / weekly / 5min / 15min / 30min / 60min"),
    start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD（分钟线忽略）"),
    end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD（分钟线忽略）"),
):
    """获取K线数据

    支持周期：
    - daily：日线（默认）
    - weekly：周线
    - 5min / 15min / 30min / 60min：分钟线
    """
    try:
        # 分钟线
        if period in ("5min", "15min", "30min", "60min", "5", "15", "30", "60"):
            data = market_data.get_stock_minute(code, period)
            return data

        # 日线/周线
        # 默认起止日期：未指定时取最近 1 年
        if not end:
            end = datetime.now().strftime("%Y-%m-%d")
        if not start:
            start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

        if period == "daily":
            if asset_type == "fund":
                data = market_data.get_fund_nav(code, start, end)
            elif asset_type == "index":
                data = market_data.get_index_daily(code, start, end)
            else:
                data = market_data.get_stock_daily(code, start, end)
        elif period == "weekly":
            if asset_type != "stock":
                raise HTTPException(status_code=400, detail="基金和指数暂只支持日线")
            data = market_data.get_stock_weekly(code, start, end)
        else:
            raise HTTPException(status_code=400, detail=f"不支持的周期: {period}")

        return data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("K线接口异常 code=%s period=%s", code, period)
        raise HTTPException(status_code=500, detail=f"获取K线数据失败: {e}")


@router.get("/market/realtime")
async def realtime(
    code: str = Query(..., description="股票/基金代码，如 000001 或 110011"),
):
    """获取实时行情

    自动判断股票/基金：
    - 6 位且以 5/1 开头：基金实时估值
    - 其他：股票实时行情
    """
    try:
        data = market_data.get_realtime(code)
        return data
    except Exception as e:
        logger.exception("实时行情接口异常 code=%s", code)
        raise HTTPException(status_code=500, detail=f"获取实时行情失败: {e}")
