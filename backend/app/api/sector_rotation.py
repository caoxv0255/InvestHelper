"""板块轮动监测 API 路由

提供：
- GET /api/sector/fund-flow?period=daily - 板块资金流排名
- GET /api/sector/heatmap - 板块热力图数据
- GET /api/sector/strength-switch - 板块强弱切换信号
- GET /api/sector/style-rotation - 风格轮动指标
- GET /api/sector/bond-stock - 债股跷跷板效应
- GET /api/sector/overview - 汇总数据
"""
import logging

from fastapi import APIRouter, HTTPException, Query

from app.services import sector_rotation

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/sector/fund-flow")
async def fund_flow(
    period: str = Query("daily", description="统计周期: daily / weekly"),
):
    """获取行业板块资金流入流出排名

    按 net_inflow 降序排序。
    """
    try:
        return sector_rotation.get_sector_fund_flow(period=period)
    except Exception as e:
        logger.exception("板块资金流接口异常 period=%s", period)
        raise HTTPException(status_code=500, detail=f"获取板块资金流失败: {e}")


@router.get("/sector/heatmap")
async def heatmap():
    """获取板块热力图数据（涨跌幅 + 成交额 + 资金流）"""
    try:
        return sector_rotation.get_sector_heatmap_data()
    except Exception as e:
        logger.exception("板块热力图接口异常")
        raise HTTPException(status_code=500, detail=f"获取板块热力图数据失败: {e}")


@router.get("/sector/strength-switch")
async def strength_switch():
    """获取板块强弱切换信号

    返回 strengthening（弱势转强）和 weakening（强势转弱）两类板块。
    """
    try:
        return sector_rotation.get_sector_strength_switch()
    except Exception as e:
        logger.exception("板块强弱切换接口异常")
        raise HTTPException(status_code=500, detail=f"获取板块强弱切换信号失败: {e}")


@router.get("/sector/style-rotation")
async def style_rotation():
    """获取风格轮动指标（大盘vs小盘、成长vs价值）"""
    try:
        return sector_rotation.get_style_rotation()
    except Exception as e:
        logger.exception("风格轮动接口异常")
        raise HTTPException(status_code=500, detail=f"获取风格轮动指标失败: {e}")


@router.get("/sector/bond-stock")
async def bond_stock():
    """获取债股跷跷板效应数据"""
    try:
        return sector_rotation.get_bond_stock_seesaw()
    except Exception as e:
        logger.exception("债股跷跷板接口异常")
        raise HTTPException(status_code=500, detail=f"获取债股跷跷板数据失败: {e}")


@router.get("/sector/overview")
async def overview():
    """获取板块轮动汇总数据"""
    try:
        return sector_rotation.get_sector_rotation_overview()
    except Exception as e:
        logger.exception("板块轮动汇总接口异常")
        raise HTTPException(status_code=500, detail=f"获取板块轮动汇总数据失败: {e}")
