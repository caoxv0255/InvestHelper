"""技术信号 API 路由

提供：
- GET /api/signals/{code}?period=daily - 获取单只标的的技术信号
- POST /api/signals/batch - 批量获取信号
"""
import logging
from typing import List

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel, Field

from app.services import signals as signal_service

router = APIRouter()
logger = logging.getLogger(__name__)


class SignalBatchItem(BaseModel):
    """批量信号请求单项"""

    code: str = Field(..., description="标的代码，如 000001")
    period: str = Field("daily", description="周期: daily / weekly / 5min / 15min / 30min / 60min")
    asset_type: str = Field("stock", description="资产类型: stock / fund / index")


class SignalBatchRequest(BaseModel):
    """批量信号请求体"""

    items: List[SignalBatchItem] = Field(..., description="需要分析的标的列表")


@router.get("/signals/{code}")
async def get_signal(
    code: str = Path(..., description="标的代码，如 000001"),
    period: str = Query("daily", description="周期: daily / weekly / 5min / 15min / 30min / 60min"),
    asset_type: str = Query("stock", description="资产类型: stock / fund / index"),
):
    """获取单只标的的技术信号

    自动获取行情数据并返回综合评级、评分与详细信号。
    """
    try:
        result = signal_service.get_signal(code, period=period, asset_type=asset_type)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("技术信号接口异常 code=%s period=%s", code, period)
        raise HTTPException(status_code=500, detail=f"获取技术信号失败: {e}")


@router.post("/signals/batch")
async def batch_signals(request: SignalBatchRequest):
    """批量获取技术信号

    请求体示例：
    {
        "items": [
            {"code": "000001", "period": "daily", "asset_type": "stock"},
            {"code": "110011", "period": "daily", "asset_type": "fund"}
        ]
    }
    """
    try:
        items = [item.model_dump() for item in request.items]
        result = signal_service.batch_get_signals(items)
        return result
    except Exception as e:
        logger.exception("批量技术信号接口异常")
        raise HTTPException(status_code=500, detail=f"批量获取技术信号失败: {e}")
