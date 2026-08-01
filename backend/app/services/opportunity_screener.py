"""投资机会筛选引擎

基于多维度的投资机会识别：
- 板块动量：从板块轮动获取资金流排名，筛选强势板块对应个股
- 技术信号：扫描持仓中的股票/基金，筛选 buy 且 score >= 65
- 资金流向：从板块轮动获取主力资金持续流入的板块对应标的

综合评分 = 技术面 40% + 板块动量 30% + 资金流 30%
各维度标准化到 0-100，缺失维度按其他维度加权归一化。

设计原则：
1. 外部数据获取失败时跳过该维度，不中断整体流程
2. 结果缓存 TTL 600 秒
3. 评分可追溯（reason 字段 JSON 记录各因子得分）
"""
from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.holdings import Holding
from app.models.opportunities import Opportunity
from app.services import signals as signal_service
from app.services import sector_rotation as sector_service
from app.services import market_data as market_service
from app.services.cache import build_key, get_cache

logger = logging.getLogger(__name__)

# 机会筛选缓存 TTL（秒）
SCREENER_CACHE_TTL: int = 600

# 综合评分权重
WEIGHT_TECH: float = 0.4       # 技术面权重
WEIGHT_SECTOR: float = 0.3     # 板块动量权重
WEIGHT_FUND: float = 0.3       # 资金流权重

# 筛选阈值
TOP_SECTOR_COUNT: int = 5           # 强势板块数量
TECH_BUY_SCORE_THRESHOLD: int = 65  # 技术买入评分阈值
FUND_FLOW_THRESHOLD: float = 5.0    # 资金流入阈值（亿元）
SECTOR_TOP_STOCK_LIMIT: int = 1     # 每个板块取涨幅领先个股数量
FUND_FLOW_MAX_SCORE_REF: float = 50.0  # 资金流满分参考值（亿元）


# ====================================================================
# 辅助函数
# ====================================================================

def _safe_float(value: Any, default: float = 0.0) -> float:
    """安全转换为 float，失败返回 default"""
    try:
        if value is None:
            return default
        v = float(value)
        if math.isnan(v) or math.isinf(v):
            return default
        return v
    except (TypeError, ValueError):
        return default


def _get_cached(cache_key: str) -> Optional[Any]:
    """读取缓存"""
    try:
        return get_cache().get(cache_key)
    except Exception as e:  # noqa: BLE001
        logger.warning("缓存读取失败 key=%s: %s", cache_key, e)
        return None


def _set_cached(cache_key: str, value: Any, ttl: int = SCREENER_CACHE_TTL) -> None:
    """写入缓存"""
    try:
        get_cache().set(cache_key, value, ttl)
    except Exception as e:  # noqa: BLE001
        logger.warning("缓存写入失败 key=%s: %s", cache_key, e)


def _opportunity_to_dict(opp: Opportunity) -> dict:
    """将 Opportunity 模型转为字典（用于 API 响应）"""
    return {
        "id": opp.id,
        "code": opp.code,
        "name": opp.name,
        "opportunity_type": opp.opportunity_type,
        "score": _safe_float(opp.score),
        "price": _safe_float(opp.price),
        "reason": opp.reason if isinstance(opp.reason, dict) else {},
        "discovered_date": opp.discovered_date.isoformat() if opp.discovered_date else None,
        "status": opp.status,
        "created_at": opp.created_at.isoformat() if opp.created_at else None,
    }


def _get_sector_top_stocks(sector_name: str, limit: int = SECTOR_TOP_STOCK_LIMIT) -> list[dict]:
    """获取板块内涨幅领先的个股

    使用 AKShare 的 stock_board_industry_cons_em 接口获取板块成分股，
    按涨跌幅降序排序后返回前 limit 只。失败时返回空列表。

    Returns:
        [{"code": "000001", "name": "平安银行", "price": 10.5, "change_pct": 3.21}, ...]
    """
    try:
        import akshare as ak
        from app.services.market_data import _throttle
        _throttle()
        df = ak.stock_board_industry_cons_em(symbol=sector_name)
        if df is None or df.empty:
            return []

        # 兼容不同列名
        code_col = None
        name_col = None
        pct_col = None
        price_col = None
        for col in df.columns:
            col_str = str(col)
            if code_col is None and "代码" in col_str:
                code_col = col
            if name_col is None and "名称" in col_str:
                name_col = col
            if pct_col is None and "涨跌幅" in col_str:
                pct_col = col
            if price_col is None and ("最新价" in col_str or "现价" in col_str):
                price_col = col

        if code_col is None or name_col is None:
            return []

        # 按涨跌幅降序排序
        if pct_col is not None:
            df = df.sort_values(by=pct_col, ascending=False)

        results: list[dict] = []
        for _, row in df.head(limit).iterrows():
            code = str(row.get(code_col, "")).strip()
            name = str(row.get(name_col, "")).strip()
            if not code:
                continue
            results.append({
                "code": code,
                "name": name,
                "price": _safe_float(row.get(price_col, 0)) if price_col else 0.0,
                "change_pct": _safe_float(row.get(pct_col, 0)) if pct_col else 0.0,
            })
        return results
    except Exception as e:  # noqa: BLE001
        logger.warning("获取板块成分股失败 sector=%s: %s", sector_name, e)
        return []


# ====================================================================
# 单维度筛选
# ====================================================================

def screen_sector_momentum() -> list[dict]:
    """板块动量机会筛选

    从板块轮动获取资金流排名，筛选净流入排名前5的板块，
    从强势板块中筛选对应个股/ETF（简化：用板块内涨幅领先个股）。

    Returns:
        [{"code", "name", "sector", "price", "sector_score",
          "fund_flow", "opportunity_type", "reason"}, ...]
    """
    try:
        flow_data = sector_service.get_sector_fund_flow(period="daily")
        items = flow_data.get("items", [])
    except Exception as e:  # noqa: BLE001
        logger.warning("板块动量筛选-获取板块资金流失败: %s", e)
        return []

    # 筛选净流入为正的板块，取前 TOP_SECTOR_COUNT 个
    positive_sectors = [item for item in items if item.get("net_inflow", 0) > 0]
    top_sectors = positive_sectors[:TOP_SECTOR_COUNT]

    if not top_sectors:
        return []

    opportunities: list[dict] = []
    for sector in top_sectors:
        sector_name = sector.get("name", "")
        net_inflow = _safe_float(sector.get("net_inflow", 0))
        change_pct = _safe_float(sector.get("change_pct", 0))
        rank = int(sector.get("rank", 99))

        # 板块评分：基于净流入额排名，排名越靠前分数越高
        # rank=1 → 100分，rank=20 → 5分
        sector_score = max(0.0, min(100.0, 100.0 - (rank - 1) * 5.0))

        # 从板块中筛选涨幅领先的个股
        stocks = _get_sector_top_stocks(sector_name, limit=SECTOR_TOP_STOCK_LIMIT)
        if not stocks:
            # 板块成分股获取失败时跳过该板块
            continue

        for stock in stocks:
            code = stock.get("code", "")
            name = stock.get("name", "")
            if not code:
                continue

            price = stock.get("price", 0.0)
            stock_change = stock.get("change_pct", 0.0)

            reason_details = [
                f"板块【{sector_name}】主力净流入 {net_inflow:.2f} 亿元",
                f"板块涨跌幅 {change_pct:+.2f}%",
                f"板块资金流排名 #{rank}",
                f"个股【{name}】涨跌幅 {stock_change:+.2f}%",
            ]

            opportunities.append({
                "code": code,
                "name": name,
                "sector": sector_name,
                "price": float(price),
                "sector_score": round(sector_score, 2),
                "fund_flow": float(net_inflow),
                "opportunity_type": "sector_momentum",
                "reason": {
                    "sector_score": round(sector_score, 2),
                    "sector": sector_name,
                    "fund_flow": float(net_inflow),
                    "details": reason_details,
                },
            })

    return opportunities


def screen_tech_signals(db: Session) -> list[dict]:
    """技术信号机会筛选

    扫描持仓中的股票/基金，筛选评级为 buy 且 score >= 65 的标的。

    Returns:
        [{"code", "name", "price", "tech_score", "rating",
          "opportunity_type", "reason"}, ...]
    """
    try:
        holdings = db.query(Holding).filter(
            Holding.asset_type.in_(["stock", "fund"])
        ).all()
    except Exception as e:  # noqa: BLE001
        logger.warning("技术信号筛选-获取持仓列表失败: %s", e)
        return []

    if not holdings:
        logger.info("技术信号筛选-无持仓数据，跳过")
        return []

    opportunities: list[dict] = []
    for holding in holdings:
        code = holding.code or ""
        if not code:
            continue
        try:
            asset_type = holding.asset_type or "stock"
            name = holding.name or code

            # 获取技术信号
            signal = signal_service.get_signal(
                code,
                period="daily",
                asset_type=asset_type,
            )

            rating = signal.get("rating", "neutral")
            score = _safe_float(signal.get("score", 50))
            reasons = signal.get("reasons", []) or []

            # 筛选条件：评级为 buy 且 score >= 阈值
            if rating != "buy" or score < TECH_BUY_SCORE_THRESHOLD:
                continue

            tech_score = float(score)

            # 获取当前价格
            price = 0.0
            if holding.current_price:
                price = _safe_float(holding.current_price)
            if price <= 0:
                # 尝试实时行情
                try:
                    rt = market_service.get_realtime(code)
                    price = _safe_float(rt.get("realtime", {}).get("price", 0))
                except Exception as e:  # noqa: BLE001
                    logger.warning("获取实时价格失败 code=%s: %s", code, e)
            if price <= 0:
                # 兜底用成本价
                price = _safe_float(holding.cost_price)

            reason_details = list(reasons) if reasons else [f"技术评级: {rating}，评分: {tech_score:.1f}"]

            opportunities.append({
                "code": code,
                "name": name,
                "price": float(price),
                "tech_score": round(tech_score, 2),
                "rating": rating,
                "opportunity_type": "tech_signal",
                "reason": {
                    "tech_score": round(tech_score, 2),
                    "rating": rating,
                    "details": reason_details,
                },
            })
        except Exception as e:  # noqa: BLE001
            logger.warning("技术信号分析失败 code=%s: %s", code, e)
            continue

    return opportunities


def screen_fund_flow() -> list[dict]:
    """资金流向机会筛选

    从板块轮动获取主力资金持续流入的板块，
    筛选流入额 > 阈值的板块对应标的。

    Returns:
        [{"code", "name", "sector", "price", "fund_score",
          "fund_flow", "opportunity_type", "reason"}, ...]
    """
    try:
        flow_data = sector_service.get_sector_fund_flow(period="daily")
        items = flow_data.get("items", [])
    except Exception as e:  # noqa: BLE001
        logger.warning("资金流向筛选-获取板块资金流失败: %s", e)
        return []

    # 筛选流入额 > 阈值的板块
    strong_sectors = [
        item for item in items
        if _safe_float(item.get("net_inflow", 0)) > FUND_FLOW_THRESHOLD
    ]

    if not strong_sectors:
        return []

    opportunities: list[dict] = []
    for sector in strong_sectors:
        sector_name = sector.get("name", "")
        net_inflow = _safe_float(sector.get("net_inflow", 0))

        # 资金流评分：基于净流入额线性映射到 0-100
        # 假设 FUND_FLOW_MAX_SCORE_REF 亿元为满分
        fund_score = min(100.0, (net_inflow / FUND_FLOW_MAX_SCORE_REF) * 100.0)

        stocks = _get_sector_top_stocks(sector_name, limit=SECTOR_TOP_STOCK_LIMIT)
        if not stocks:
            continue

        for stock in stocks:
            code = stock.get("code", "")
            name = stock.get("name", "")
            if not code:
                continue

            price = stock.get("price", 0.0)

            reason_details = [
                f"板块【{sector_name}】主力净流入 {net_inflow:.2f} 亿元",
                f"资金流评分 {fund_score:.1f}",
                f"个股【{name}】当前价 {price:.2f}",
            ]

            opportunities.append({
                "code": code,
                "name": name,
                "sector": sector_name,
                "price": float(price),
                "fund_score": round(fund_score, 2),
                "fund_flow": float(net_inflow),
                "opportunity_type": "fund_flow",
                "reason": {
                    "fund_score": round(fund_score, 2),
                    "sector": sector_name,
                    "fund_flow": float(net_inflow),
                    "details": reason_details,
                },
            })

    return opportunities


# ====================================================================
# 综合评分与汇总
# ====================================================================

def calculate_composite_score(
    tech_score: Optional[float] = None,
    sector_score: Optional[float] = None,
    fund_score: Optional[float] = None,
) -> float:
    """计算综合评分 0-100

    技术面 40% + 板块动量 30% + 资金流 30%
    各维度标准化到 0-100。缺失维度时将其权重按比例分配给其他维度，
    保证结果仍为 0-100。

    Returns:
        综合评分 0-100
    """
    # 收集有值的维度
    dimensions: list[tuple[str, float, float]] = []
    if tech_score is not None:
        dimensions.append(("tech", float(tech_score), WEIGHT_TECH))
    if sector_score is not None:
        dimensions.append(("sector", float(sector_score), WEIGHT_SECTOR))
    if fund_score is not None:
        dimensions.append(("fund", float(fund_score), WEIGHT_FUND))

    if not dimensions:
        return 50.0  # 无数据时返回中性评分

    # 缺失维度的权重按比例分配给其他维度
    total_weight = sum(w for _, _, w in dimensions)
    if total_weight <= 0:
        return 50.0

    composite = sum(score * weight for _, score, weight in dimensions) / total_weight
    return max(0.0, min(100.0, composite))


def _merge_opportunities(*opp_lists: list[dict]) -> dict[str, dict]:
    """合并多维度机会，同一标的取最高分并合并各维度得分

    Returns:
        {code: {合并后的机会数据}}
    """
    merged: dict[str, dict] = {}

    for opp_list in opp_lists:
        for opp in opp_list:
            code = opp.get("code", "")
            if not code:
                continue

            if code not in merged:
                merged[code] = {
                    "code": code,
                    "name": opp.get("name", ""),
                    "price": opp.get("price", 0.0),
                    "tech_score": opp.get("tech_score"),
                    "sector_score": opp.get("sector_score"),
                    "fund_score": opp.get("fund_score"),
                    "rating": opp.get("rating"),
                    "sector": opp.get("sector"),
                    "fund_flow": opp.get("fund_flow"),
                    "types": [],
                    "details": [],
                }
                opp_type = opp.get("opportunity_type", "")
                if opp_type:
                    merged[code]["types"].append(opp_type)

            existing = merged[code]

            # 合并各维度得分（已有值时不覆盖）
            for key in ("tech_score", "sector_score", "fund_score", "rating", "sector", "fund_flow"):
                if existing.get(key) is None and opp.get(key) is not None:
                    existing[key] = opp[key]

            # 更新名称和价格（取非空值）
            if opp.get("name") and not existing.get("name"):
                existing["name"] = opp["name"]
            if opp.get("price"):
                existing["price"] = opp["price"]

            # 收集类型
            opp_type = opp.get("opportunity_type", "")
            if opp_type and opp_type not in existing["types"]:
                existing["types"].append(opp_type)

            # 合并详情
            reason = opp.get("reason", {})
            if isinstance(reason, dict):
                existing["details"].extend(reason.get("details", []))

    return merged


def screen_all_opportunities(db: Session) -> list[dict]:
    """综合筛选投资机会

    汇总三类机会，去重（同一标的合并各维度得分），计算综合评分，
    按评分降序排列，存入 opportunities 表（覆盖当天 active 记录）。

    Returns:
        [{"code", "name", "opportunity_type", "score", "price",
          "reason", "discovered_date"}, ...]
    """
    cache_key = build_key("opportunity", "screen_all", date.today().isoformat())
    cached = _get_cached(cache_key)
    if cached is not None:
        logger.info("机会综合筛选命中缓存")
        return cached

    # 各维度独立筛选，失败时跳过该维度，不中断整体流程
    sector_opps: list[dict] = []
    try:
        sector_opps = screen_sector_momentum()
        logger.info("板块动量筛选完成，发现 %d 个机会", len(sector_opps))
    except Exception as e:  # noqa: BLE001
        logger.warning("板块动量筛选失败，跳过该维度: %s", e)

    tech_opps: list[dict] = []
    try:
        tech_opps = screen_tech_signals(db)
        logger.info("技术信号筛选完成，发现 %d 个机会", len(tech_opps))
    except Exception as e:  # noqa: BLE001
        logger.warning("技术信号筛选失败，跳过该维度: %s", e)

    fund_opps: list[dict] = []
    try:
        fund_opps = screen_fund_flow()
        logger.info("资金流向筛选完成，发现 %d 个机会", len(fund_opps))
    except Exception as e:  # noqa: BLE001
        logger.warning("资金流向筛选失败，跳过该维度: %s", e)

    # 汇总并去重（同一标的合并各维度得分）
    merged = _merge_opportunities(sector_opps, tech_opps, fund_opps)

    # 计算综合评分并构造最终结果
    results: list[dict] = []
    for code, data in merged.items():
        composite = calculate_composite_score(
            tech_score=data.get("tech_score"),
            sector_score=data.get("sector_score"),
            fund_score=data.get("fund_score"),
        )

        # 选择机会类型：多维度命中记为 composite，否则取单一类型
        types = data.get("types", [])
        if len(types) > 1:
            opp_type = "composite"
        elif types:
            opp_type = types[0]
        else:
            opp_type = "composite"

        # 构造 reason JSON（评分可追溯）
        reason: dict = {
            "tech_score": data.get("tech_score"),
            "sector_score": data.get("sector_score"),
            "fund_score": data.get("fund_score"),
            "rating": data.get("rating"),
            "sector": data.get("sector"),
            "fund_flow": data.get("fund_flow"),
            "details": list(dict.fromkeys(data.get("details", []))),  # 去重保序
        }

        results.append({
            "code": code,
            "name": data.get("name", ""),
            "opportunity_type": opp_type,
            "score": round(composite, 2),
            "price": float(data.get("price", 0.0)),
            "reason": reason,
            "discovered_date": date.today().isoformat(),
        })

    # 按评分降序排列
    results.sort(key=lambda x: x["score"], reverse=True)

    # 存入数据库（覆盖当天 active 记录）
    try:
        _save_opportunities(db, results)
    except Exception as e:  # noqa: BLE001
        logger.warning("保存机会到数据库失败: %s", e)

    # 缓存结果
    _set_cached(cache_key, results)

    return results


def _save_opportunities(db: Session, opportunities: list[dict]) -> None:
    """保存机会到数据库（覆盖当天 active 记录）

    将当天已有的 active 记录标记为 expired，再插入新的 active 记录。
    """
    today = date.today()

    # 将当天已有的 active 记录标记为 expired（保留历史）
    db.query(Opportunity).filter(
        Opportunity.discovered_date == today,
        Opportunity.status == "active",
    ).update({Opportunity.status: "expired"}, synchronize_session=False)

    # 插入新的 active 记录
    for opp in opportunities:
        db_opp = Opportunity(
            code=opp["code"],
            name=opp["name"],
            opportunity_type=opp["opportunity_type"],
            score=opp["score"],
            price=opp["price"],
            reason=opp["reason"],
            discovered_date=today,
            status="active",
        )
        db.add(db_opp)

    db.commit()
    logger.info("保存 %d 条机会到数据库（日期=%s）", len(opportunities), today)


# ====================================================================
# 查询接口
# ====================================================================

def get_active_opportunities(db: Session, limit: int = 20) -> dict:
    """获取当前活跃机会列表

    Returns:
        {
            "items": [Opportunity dict, ...],
            "total": int,
            "scanned_at": str | null  (最近一次扫描时间)
        }
    """
    cache_key = build_key("opportunity", "active", str(limit))
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    query = db.query(Opportunity).filter(
        Opportunity.status == "active"
    ).order_by(Opportunity.score.desc())

    items = query.limit(limit).all()
    total = db.query(Opportunity).filter(Opportunity.status == "active").count()

    # 扫描时间取最近一条记录的创建时间
    scanned_at = items[0].created_at.isoformat() if items else None

    result = {
        "items": [_opportunity_to_dict(o) for o in items],
        "total": total,
        "scanned_at": scanned_at,
    }

    _set_cached(cache_key, result)
    return result


def get_opportunity_history(db: Session, days: int = 30) -> dict:
    """获取历史机会记录

    Args:
        days: 查询最近 N 天的记录

    Returns:
        {
            "items": [Opportunity dict, ...],
            "total": int
        }
    """
    cache_key = build_key("opportunity", "history", str(days))
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    start_date = date.today() - timedelta(days=days)

    items = db.query(Opportunity).filter(
        Opportunity.discovered_date >= start_date
    ).order_by(
        Opportunity.discovered_date.desc(),
        Opportunity.score.desc(),
    ).all()

    result = {
        "items": [_opportunity_to_dict(o) for o in items],
        "total": len(items),
    }

    _set_cached(cache_key, result)
    return result


def get_opportunity_by_id(db: Session, opportunity_id: int) -> Optional[dict]:
    """根据 ID 获取单个机会详情"""
    opp = db.query(Opportunity).filter(Opportunity.id == opportunity_id).first()
    if not opp:
        return None
    return _opportunity_to_dict(opp)
