"""持仓价格批量刷新服务。

职责：
- 遍历持仓表，对每条持仓按代码从 AKShare 拉取最新行情
- 把行情价格回写到 Holding.current_price
- 返回成功/失败统计，便于前端展示

设计要点：
- 单条失败不中断整体流程
- 行情拉取走 market_data 服务（已带缓存 + 节流）
- 股票/基金通过 asset_type 区分
- 支持异步后台任务执行（避免阻塞 HTTP 请求）
"""
from __future__ import annotations

import asyncio
import logging
import time
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.holdings import Holding
from app.services import market_data

logger = logging.getLogger(__name__)


# 全局任务状态（单 worker 部署足够）
_task_state: dict[str, Any] = {
    "status": "idle",   # idle | running | done | failed
    "started_at": None,
    "finished_at": None,
    "result": None,
}


def get_task_state() -> dict[str, Any]:
    """获取最近一次刷新任务的状态，供前端轮询。"""
    return _task_state


def _extract_price(realtime: dict) -> Decimal | None:
    """从行情响应里提取价格。基金用 estimated_nav，股票用 price。"""
    rt = realtime.get("realtime") or {}
    val = rt.get("price") or rt.get("estimated_nav")
    if val is None:
        return None
    try:
        return Decimal(str(val))
    except (TypeError, ValueError):
        return None


def refresh_holding_prices(db: Session) -> dict:
    """同步批量刷新所有持仓的当前价格。

    Returns:
        {
            "total": int,         # 总数
            "updated": int,       # 成功更新数
            "skipped": int,       # 跳过（如定期/无行情）
            "failed": int,        # 拉取失败
            "errors": list[str],  # 错误明细
        }
    """
    holdings = db.query(Holding).all()
    result = {"total": len(holdings), "updated": 0, "skipped": 0, "failed": 0, "errors": []}

    for h in holdings:
        # 定期资产没有实时行情
        if h.asset_type == "deposit":
            result["skipped"] += 1
            continue

        try:
            realtime = market_data.get_realtime(h.code)
            price = _extract_price(realtime)
            if price is None:
                result["failed"] += 1
                result["errors"].append(f"{h.code} 行情响应无价格字段")
                continue
            h.current_price = price
            result["updated"] += 1
        except Exception as e:  # noqa: BLE001
            logger.warning("刷新价格失败 code=%s: %s", h.code, e)
            result["failed"] += 1
            result["errors"].append(f"{h.code}: {e}")

    if result["updated"] > 0:
        db.commit()

    logger.info(
        "持仓价格刷新完成 total=%d updated=%d skipped=%d failed=%d",
        result["total"], result["updated"], result["skipped"], result["failed"],
    )
    return result


async def refresh_holding_prices_async() -> None:
    """异步包装：在线程池中执行同步刷新，更新全局状态。"""
    _task_state.update({
        "status": "running",
        "started_at": time.time(),
        "finished_at": None,
        "result": None,
    })
    try:
        def _do():
            db = SessionLocal()
            try:
                return refresh_holding_prices(db)
            finally:
                db.close()

        result = await asyncio.to_thread(_do)
        _task_state.update({
            "status": "done",
            "finished_at": time.time(),
            "result": result,
        })
    except Exception as e:  # noqa: BLE001
        logger.exception("异步刷新持仓价格失败: %s", e)
        _task_state.update({
            "status": "failed",
            "finished_at": time.time(),
            "result": {"error": str(e)},
        })
