"""财经快讯爬虫服务

支持来源：东方财富、同花顺、新浪财经

设计要点：
- 每个源单独失败不影响其他源，记录 warning 日志
- 外部接口失败时返回空列表而不是抛异常
- 内容清洗：去除 HTML 标签、截断超长内容（5000 字符）
- publish_time 统一转 UTC 存储
- 简单关键词匹配：从 user_settings 表读取关键词列表（表不存在则跳过）
- 提供 get_mock_news() 生成示例数据用于演示
- 不引入额外依赖，仅使用标准库 urllib
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.db.session import SessionLocal
from app.models.news import News
from app.models.user_settings import UserSetting

logger = logging.getLogger(__name__)

# ============== 常量 ==============
# 来源标识
SOURCE_EASTMONEY = "eastmoney"
SOURCE_THS = "ths"
SOURCE_SINA = "sina"

# 内容最大长度（字符）
MAX_CONTENT_LENGTH = 5000
# 标题最大长度（字符，对应 News.title 的 String(500)）
MAX_TITLE_LENGTH = 500

# HTTP 请求超时（秒）
HTTP_TIMEOUT = 10

# 关键词配置在 user_settings 表中的 key
KEYWORDS_SETTING_KEY = "news_keywords"

# 通用请求头
_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# HTML 标签 / 实体清理正则
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HTML_ENTITY_RE = re.compile(r"&[a-zA-Z]+;|&#\d+;")
# 连续空白压缩
_WS_RE = re.compile(r"\s+")


# ============== 工具函数 ==============
def _clean_html(text: str) -> str:
    """清洗 HTML：去标签、去实体、压缩空白"""
    if not text:
        return ""
    text = _HTML_TAG_RE.sub("", text)
    text = _HTML_ENTITY_RE.sub("", text)
    text = _WS_RE.sub(" ", text).strip()
    return text


def _truncate(text: str, max_len: int = MAX_CONTENT_LENGTH) -> str:
    """截断超长内容"""
    if not text:
        return ""
    return text[:max_len]


def _content_hash(content: str) -> str:
    """根据内容前 200 字符生成 sha256 哈希，用于去重"""
    return hashlib.sha256((content or "")[:200].encode("utf-8")).hexdigest()


def _to_utc(dt: Optional[datetime]) -> datetime:
    """把 datetime 统一转为 UTC。

    - naive datetime 视为东八区（中国财经数据源默认时区）
    - 已带时区的直接转换
    - None 返回当前 UTC 时间
    """
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        # naive 视为东八区
        dt = dt.replace(tzinfo=timezone(timedelta(hours=8)))
    return dt.astimezone(timezone.utc)


def _http_get_json(url: str, headers: Optional[dict] = None,
                   timeout: int = HTTP_TIMEOUT):
    """使用 urllib 请求 JSON 接口，失败返回 None"""
    try:
        req = urllib.request.Request(url, headers=headers or _DEFAULT_HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            return json.loads(raw)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError,
            json.JSONDecodeError, OSError) as e:
        logger.warning("HTTP 请求失败 url=%s err=%s", url, e)
        return None
    except Exception as e:  # noqa: BLE001
        logger.warning("HTTP 请求异常 url=%s err=%s", url, e)
        return None


def _http_get_text(url: str, headers: Optional[dict] = None,
                   timeout: int = HTTP_TIMEOUT) -> str:
    """使用 urllib 请求文本内容，失败返回空字符串"""
    try:
        req = urllib.request.Request(url, headers=headers or _DEFAULT_HEADERS)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError,
            OSError) as e:
        logger.warning("HTTP 请求失败 url=%s err=%s", url, e)
        return ""
    except Exception as e:  # noqa: BLE001
        logger.warning("HTTP 请求异常 url=%s err=%s", url, e)
        return ""


def _load_keywords(db) -> list[str]:
    """从 user_settings 表读取关键词列表。

    表不存在或无配置则返回空列表（不抛异常）。
    """
    try:
        stmt = select(UserSetting).where(
            UserSetting.setting_key == KEYWORDS_SETTING_KEY
        )
        row = db.execute(stmt).scalar_one_or_none()
        if not row:
            return []
        val = row.setting_value
        # 兼容两种存储格式：直接数组 或 {"keywords": [...]}
        if isinstance(val, list):
            return [str(k) for k in val if k]
        if isinstance(val, dict):
            kw = val.get("keywords", [])
            return [str(k) for k in kw if k]
        return []
    except SQLAlchemyError as e:
        # 表不存在等数据库异常
        logger.warning("读取关键词配置失败（可能表不存在）: %s", e)
        return []
    except Exception as e:  # noqa: BLE001
        logger.warning("读取关键词配置异常: %s", e)
        return []


def _match_keywords(text: str, keywords: list[str]) -> list[str]:
    """从文本中匹配命中的关键词（大小写不敏感）"""
    if not text or not keywords:
        return []
    text_lower = text.lower()
    return [k for k in keywords if k and k.lower() in text_lower]


def _build_news_item(source: str, title: str, content: str,
                     url: Optional[str], publish_time: datetime,
                     keywords: list[str]) -> dict:
    """构造一条标准化的新闻 dict（完成清洗、截断、关键词匹配）"""
    title = _clean_html(title)
    content = _clean_html(content)
    # 标题为空时用内容前 80 字符兜底
    if not title:
        title = content[:80] if content else "无标题"
    # 截断
    title = title[:MAX_TITLE_LENGTH]
    content = _truncate(content)
    # 关键词匹配
    matched = _match_keywords(f"{title}\n{content}", keywords)
    ch = _content_hash(content)
    return {
        "source": source,
        "title": title,
        "content": content,
        "url": url or f"{source}_{ch}",
        "publish_time": _to_utc(publish_time),
        "is_important": len(matched) > 0,
        "keywords": matched,
        "content_hash": ch,
    }


# ============== 东方财富 ==============
def crawl_eastmoney() -> list[dict]:
    """爬取东方财富 7x24 快讯。

    接口返回结构可能变化，失败时返回空列表（由 crawl_all 决定是否降级 mock）。
    """
    # 7x24 快讯栏目接口
    url = (
        "https://np-listapi.eastmoney.com/comm/web/getNewsByColumns"
        "?client=web&biz=web_news_col&column=350&order=1"
        "&needInteractData=0&page_index=1&page_size=30"
    )
    data = _http_get_json(url)
    if not isinstance(data, dict):
        logger.warning("东方财富接口返回非 dict，跳过")
        return []
    try:
        items = (data.get("data") or {}).get("list") or []
    except AttributeError:
        logger.warning("东方财富接口结构异常，跳过")
        return []

    results: list[dict] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        title = it.get("title") or ""
        content = it.get("content") or it.get("digest") or it.get("summary") or ""
        url_ = it.get("url") or it.get("url_wx") or ""
        pt = it.get("showTime") or it.get("ctime") or it.get("publishDate")
        # 解析发布时间
        pub = _parse_datetime(pt)
        results.append({
            "source": SOURCE_EASTMONEY,
            "title": title,
            "content": content,
            "url": url_,
            "publish_time": pub,
        })
    logger.info("东方财富爬取 %d 条", len(results))
    return results


# ============== 同花顺 ==============
def crawl_ths() -> list[dict]:
    """爬取同花顺财经快讯。

    同花顺快讯页面为 HTML，这里做简单的正则解析；
    页面结构变化或被反爬时返回空列表。
    """
    url = "http://news.10jqka.com.cn/field/kx/"
    html = _http_get_text(url)
    if not html:
        logger.warning("同花顺页面获取失败，跳过")
        return []

    results: list[dict] = []
    # 匹配列表项中的时间和标题链接
    # 结构：<span class="time">HH:MM</span> ... <a href="..." title="标题">
    pattern = re.compile(
        r'<span[^>]*class="time"[^>]*>(\d{2}:\d{2})</span>'
        r'[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>',
        re.IGNORECASE,
    )
    today = datetime.now(timezone(timedelta(hours=8))).date()
    for m in pattern.finditer(html):
        time_str, url_, title = m.groups()
        try:
            pub = datetime.strptime(
                f"{today} {time_str}", "%Y-%m-%d %H:%M"
            )
        except ValueError:
            pub = datetime.now(timezone.utc)
        results.append({
            "source": SOURCE_THS,
            "title": title.strip(),
            "content": title.strip(),  # 列表页只有标题，无摘要
            "url": url_,
            "publish_time": pub,
        })
    logger.info("同花顺爬取 %d 条", len(results))
    return results


# ============== 新浪 ==============
def crawl_sina() -> list[dict]:
    """爬取新浪财经快讯。

    使用新浪滚动新闻 JSON 接口，失败时返回空列表。
    """
    url = (
        "https://feed.mix.sina.com.cn/api/roll/get"
        "?pageid=153&lid=2516&k=&num=30&page=1"
    )
    data = _http_get_json(url)
    if not isinstance(data, dict):
        logger.warning("新浪接口返回非 dict，跳过")
        return []
    try:
        items = (data.get("data") or {}).get("list") or []
    except AttributeError:
        logger.warning("新浪接口结构异常，跳过")
        return []

    results: list[dict] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        title = it.get("title") or ""
        content = it.get("intro") or it.get("summary") or title
        url_ = it.get("url") or ""
        ctime = it.get("ctime") or it.get("createtime") or it.get("intime")
        # 新浪时间戳为秒级
        pub = _parse_timestamp(ctime)
        results.append({
            "source": SOURCE_SINA,
            "title": title,
            "content": content,
            "url": url_,
            "publish_time": pub,
        })
    logger.info("新浪爬取 %d 条", len(results))
    return results


# ============== 时间解析辅助 ==============
def _parse_datetime(value) -> datetime:
    """尝试解析多种日期时间格式，失败返回当前 UTC 时间"""
    if not value:
        return datetime.now(timezone.utc)
    if isinstance(value, (int, float)):
        return _parse_timestamp(value)
    s = str(value).strip()
    # 常见格式
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
    ):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    # 尝试只解析日期
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d")
    except ValueError:
        pass
    logger.debug("无法解析时间: %s", value)
    return datetime.now(timezone.utc)


def _parse_timestamp(value) -> datetime:
    """解析时间戳（秒/毫秒），失败返回当前 UTC 时间"""
    if not value:
        return datetime.now(timezone.utc)
    try:
        ts = int(value)
        # 毫秒级时间戳（13 位）转秒
        if ts > 1e12:
            ts = ts // 1000
        # 视为东八区时间
        return datetime.fromtimestamp(ts, tz=timezone(timedelta(hours=8)))
    except (ValueError, TypeError, OSError):
        return datetime.now(timezone.utc)


# ============== Mock 数据 ==============
def get_mock_news() -> list[dict]:
    """生成示例快讯数据用于演示。

    URL 基于 content_hash 生成，保证多次调用不会因唯一约束重复入库。
    """
    now = datetime.now(timezone(timedelta(hours=8)))
    samples = [
        ("央行公开市场净投放",
         "央行今日开展 2000 亿元逆回购操作，实现净投放 1500 亿元，"
         "意在缓解跨月资金面紧张，市场流动性整体宽裕。"),
        ("沪深两市开盘",
         "沪指开盘上涨 0.3%，深成指上涨 0.5%，创业板指上涨 0.7%。"
         "两市半日成交额超 6000 亿元。"),
        ("新能源汽车板块走强",
         "新能源汽车板块盘中走强，多只个股涨停，受最新政策利好消息影响，"
         "机构资金明显流入。"),
        ("半导体板块异动",
         "半导体板块午后异动拉升，芯片设计公司领涨，"
         "受国产替代预期升温带动。"),
        ("外资净买入",
         "北向资金今日净买入 50 亿元，连续 3 日净流入，"
         "重点加仓消费与新能源板块。"),
        ("美元指数走低",
         "美元指数盘中走低至 102 下方，人民币汇率走强，"
         "在岸人民币升破 7.15 关口。"),
        ("国债期货收涨",
         "国债期货收盘上涨，10 年期主力合约涨 0.15%，"
         "市场对货币政策宽松预期升温。"),
    ]
    results: list[dict] = []
    for i, (title, content) in enumerate(samples):
        pub = now - timedelta(minutes=i * 15)
        ch = _content_hash(content)
        results.append({
            "source": SOURCE_EASTMONEY,
            "title": title,
            "content": content,
            "url": f"mock_{ch}",
            "publish_time": pub,
        })
    return results


# ============== 入库 ==============
def save_news(db, items: list[dict]) -> int:
    """批量入库，返回新增数量。

    利用唯一约束 (source, url) 避免重复；重复行触发 IntegrityError 后跳过。
    每条独立提交，单条失败不影响其他条目。
    """
    added = 0
    for it in items:
        try:
            row = News(
                source=it["source"],
                title=it["title"],
                content=it["content"],
                url=it.get("url") or f"{it['source']}_{it.get('content_hash')}",
                publish_time=it["publish_time"],
                is_important=it.get("is_important", False),
                keywords=it.get("keywords") or [],
                content_hash=it.get("content_hash"),
            )
            db.add(row)
            db.commit()
            added += 1
        except IntegrityError:
            # 唯一约束冲突（source+url 重复），跳过
            db.rollback()
        except SQLAlchemyError as e:
            db.rollback()
            logger.warning("入库失败 title=%s err=%s", it.get("title"), e)
        except KeyError as e:
            db.rollback()
            logger.warning("入库失败，缺少字段 %s", e)
    return added


# ============== 聚合抓取 ==============
def crawl_all(use_mock_on_fail: bool = True) -> int:
    """聚合三个来源，去重并入库，返回新增数量。

    - 每个源独立抓取，单个失败不影响其他源
    - 三源全部失败时，若 use_mock_on_fail=True 则降级到 mock 数据
    - 按 content_hash 去重
    """
    db = SessionLocal()
    try:
        keywords = _load_keywords(db)

        # 逐源抓取
        raw_items: list[dict] = []
        for fn in (crawl_eastmoney, crawl_ths, crawl_sina):
            try:
                raw_items.extend(fn())
            except Exception as e:  # noqa: BLE001
                logger.warning("源 %s 抓取异常: %s",
                               getattr(fn, "__name__", "unknown"), e)

        # 全部失败时降级 mock
        if not raw_items:
            if use_mock_on_fail:
                logger.warning("三个来源全部失败，使用 mock 数据演示")
                raw_items = get_mock_news()
            else:
                logger.warning("三个来源全部失败，本次不抓取（未启用 mock 降级）")
                return 0

        # 清洗 + 去重（按 content_hash）
        seen: set[str] = set()
        cleaned: list[dict] = []
        for it in raw_items:
            built = _build_news_item(
                source=it.get("source", "unknown"),
                title=it.get("title", ""),
                content=it.get("content", ""),
                url=it.get("url"),
                publish_time=it.get("publish_time"),
                keywords=keywords,
            )
            if built["content_hash"] in seen:
                continue
            seen.add(built["content_hash"])
            cleaned.append(built)

        added = save_news(db, cleaned)
        logger.info("crawl_all 完成: 原始 %d 条，去重后 %d 条，新增 %d 条",
                    len(raw_items), len(cleaned), added)
        return added
    finally:
        db.close()


# ============== 查询 ==============
def get_latest_news(limit: int = 50, source: Optional[str] = None,
                    keyword: Optional[str] = None) -> list[dict]:
    """查询最新快讯列表，按发布时间倒序"""
    db = SessionLocal()
    try:
        stmt = select(News)
        if source:
            stmt = stmt.where(News.source == source)
        if keyword:
            like = f"%{keyword}%"
            stmt = stmt.where(
                (News.title.like(like)) | (News.content.like(like))
            )
        stmt = stmt.order_by(desc(News.publish_time)).limit(limit)
        rows = db.execute(stmt).scalars().all()
        return [_to_dict(r) for r in rows]
    except SQLAlchemyError as e:
        logger.exception("查询快讯列表失败: %s", e)
        return []
    finally:
        db.close()


def _to_dict(row: News) -> dict:
    """将 News ORM 对象转为 dict"""
    return {
        "id": row.id,
        "source": row.source,
        "title": row.title,
        "content": row.content,
        "url": row.url,
        "publish_time": row.publish_time.isoformat() if row.publish_time else None,
        "is_important": row.is_important,
        "keywords": row.keywords or [],
        "content_hash": row.content_hash,
    }


# ============== 关键词配置 ==============
def update_keywords(keywords: list[str]) -> dict:
    """更新关键词配置到 user_settings 表"""
    db = SessionLocal()
    try:
        # 去重 + 去空
        kw_list = [str(k).strip() for k in keywords if k and str(k).strip()]
        stmt = select(UserSetting).where(
            UserSetting.setting_key == KEYWORDS_SETTING_KEY
        )
        row = db.execute(stmt).scalar_one_or_none()
        if row:
            row.setting_value = {"keywords": kw_list}
        else:
            row = UserSetting(
                setting_key=KEYWORDS_SETTING_KEY,
                setting_value={"keywords": kw_list},
            )
            db.add(row)
        db.commit()
        logger.info("关键词配置已更新: %s", kw_list)
        return {"keywords": kw_list}
    except Exception as e:
        db.rollback()
        logger.error("更新关键词配置失败: %s", e)
        raise
    finally:
        db.close()


def get_keywords() -> list[str]:
    """获取当前关键词配置"""
    db = SessionLocal()
    try:
        return _load_keywords(db)
    finally:
        db.close()


# ============== 来源列表 ==============
def get_sources() -> list[dict]:
    """返回可用来源列表"""
    return [
        {"code": SOURCE_EASTMONEY, "name": "东方财富", "enabled": True},
        {"code": SOURCE_THS, "name": "同花顺", "enabled": True},
        {"code": SOURCE_SINA, "name": "新浪财经", "enabled": True},
    ]
