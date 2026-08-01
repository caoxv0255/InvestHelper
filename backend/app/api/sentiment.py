"""市场情绪 API 路由

提供：
- GET /api/sentiment/overview - 返回完整情绪仪表盘数据
"""
import logging

from fastapi import APIRouter, HTTPException

from app.services import sentiment as sentiment_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/sentiment/overview")
async def get_sentiment_overview():
    """获取市场情绪仪表盘完整数据

    返回结构：
    - north_flow: 北向资金净流入及近5日趋势
    - market_breadth: 市场宽度（涨跌家数、涨跌停家数）
    - volume_trend: 成交量趋势（今日 + 近5日均值 + 趋势）
    - fear_greed: 恐惧贪婪指数（0-100，含历史分位数）
    - composite: 复合情绪指数（0-100，含历史分位数与历史序列）
    - warnings: 数据缺失警告列表
    - timestamp: 数据生成时间
    """
    try:
        return sentiment_service.get_market_sentiment()
    except Exception as e:
        logger.exception("市场情绪接口异常")
        raise HTTPException(status_code=500, detail=f"获取市场情绪数据失败: {e}")
