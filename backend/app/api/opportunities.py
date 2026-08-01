"""投资机会 API 路由

提供：
- GET /api/opportunities?limit=20 - 获取当前活跃机会列表
- POST /api/opportunities/scan - 手动触发筛选扫描
- GET /api/opportunities/history?days=30 - 获取历史机会
- GET /api/opportunities/{opportunity_id} - 获取单个机会详情
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import opportunity_screener as screener

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/opportunities")
async def get_opportunities(
    limit: int = Query(20, ge=1, le=100, description="返回数量上限"),
    db: Session = Depends(get_db),
):
    """获取当前活跃机会列表

    返回结构：
    - items: 机会列表（按评分降序）
    - total: 活跃机会总数
    - scanned_at: 最近一次扫描时间
    """
    try:
        return screener.get_active_opportunities(db, limit=limit)
    except Exception as e:  # noqa: BLE001
        logger.exception("获取活跃机会列表异常")
        raise HTTPException(status_code=500, detail=f"获取活跃机会失败: {e}")


@router.post("/opportunities/scan")
async def scan_opportunities(db: Session = Depends(get_db)):
    """手动触发筛选扫描

    执行多维度机会筛选（板块动量 + 技术信号 + 资金流向），
    计算综合评分并覆盖当天 active 记录。
    """
    try:
        results = screener.screen_all_opportunities(db)
        return {
            "items": results,
            "total": len(results),
            "scanned_at": datetime.now().isoformat(),
        }
    except Exception as e:  # noqa: BLE001
        logger.exception("机会筛选扫描异常")
        raise HTTPException(status_code=500, detail=f"机会筛选扫描失败: {e}")


@router.get("/opportunities/history")
async def get_history(
    days: int = Query(30, ge=1, le=365, description="查询最近 N 天的历史记录"),
    db: Session = Depends(get_db),
):
    """获取历史机会记录

    按发现日期降序、评分降序排列。
    """
    try:
        return screener.get_opportunity_history(db, days=days)
    except Exception as e:  # noqa: BLE001
        logger.exception("获取历史机会异常")
        raise HTTPException(status_code=500, detail=f"获取历史机会失败: {e}")


@router.get("/opportunities/{opportunity_id}")
async def get_opportunity_detail(
    opportunity_id: int,
    db: Session = Depends(get_db),
):
    """获取单个机会详情"""
    try:
        result = screener.get_opportunity_by_id(db, opportunity_id)
        if result is None:
            raise HTTPException(status_code=404, detail="机会记录不存在")
        return result
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("获取机会详情异常 id=%s", opportunity_id)
        raise HTTPException(status_code=500, detail=f"获取机会详情失败: {e}")
