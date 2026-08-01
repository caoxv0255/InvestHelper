"""财经快讯 API 路由

提供：
- GET  /api/news           - 获取最新快讯列表（支持 source / keyword 过滤）
- POST /api/news/refresh   - 手动触发一次抓取
- GET  /api/news/sources   - 返回可用来源列表
- GET  /api/news/keywords  - 获取当前关键词配置
- PUT  /api/news/keywords  - 更新关键词配置
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services import news_crawler

router = APIRouter()
logger = logging.getLogger(__name__)


class KeywordsUpdate(BaseModel):
    """关键词更新请求体"""
    keywords: list[str] = Field(
        default_factory=list,
        description="关键词列表（匹配命中后会标记 is_important 并写入 keywords 字段）",
    )


@router.get("/news")
async def list_news(
    limit: int = Query(50, ge=1, le=200, description="返回条数"),
    source: Optional[str] = Query(
        None, description="来源过滤: eastmoney / ths / sina"
    ),
    keyword: Optional[str] = Query(None, description="关键词过滤（匹配标题或内容）"),
):
    """获取最新快讯列表，按发布时间倒序"""
    try:
        items = news_crawler.get_latest_news(
            limit=limit, source=source, keyword=keyword
        )
        return {"total": len(items), "items": items}
    except Exception as e:  # noqa: BLE001
        logger.exception("获取快讯列表异常")
        raise HTTPException(status_code=500, detail=f"获取快讯失败: {e}")


@router.post("/news/refresh")
async def refresh_news():
    """手动触发一次抓取。

    三源全部失败时会降级使用 mock 数据，便于演示。
    """
    try:
        added = news_crawler.crawl_all(use_mock_on_fail=True)
        return {"added": added, "message": "抓取完成"}
    except Exception as e:  # noqa: BLE001
        logger.exception("触发抓取异常")
        raise HTTPException(status_code=500, detail=f"抓取失败: {e}")


@router.get("/news/sources")
async def list_sources():
    """返回可用来源列表"""
    return {"sources": news_crawler.get_sources()}


@router.get("/news/keywords")
async def get_keywords():
    """获取当前关键词配置"""
    try:
        return {"keywords": news_crawler.get_keywords()}
    except Exception as e:  # noqa: BLE001
        logger.exception("获取关键词异常")
        raise HTTPException(status_code=500, detail=f"获取关键词失败: {e}")


@router.put("/news/keywords")
async def update_keywords(body: KeywordsUpdate):
    """更新关键词配置（存入 user_settings 表）"""
    try:
        result = news_crawler.update_keywords(body.keywords)
        return result
    except Exception as e:  # noqa: BLE001
        logger.exception("更新关键词异常")
        raise HTTPException(status_code=500, detail=f"更新关键词失败: {e}")
