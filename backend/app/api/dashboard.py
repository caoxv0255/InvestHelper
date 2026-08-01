from datetime import date, timedelta
from decimal import Decimal
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.holdings import Holding
from app.models.deposits import Deposit
from app.models.portfolio_snapshots import PortfolioSnapshot
from app.schemas.dashboard import (
    DashboardSummary,
    PlatformDistribution,
    AssetTypeDistribution,
    PlatformComparison,
)

router = APIRouter()


def _calc_holding_market_value(holding: Holding) -> Decimal:
    """计算持仓市值 = quantity * (current_price or cost_price)"""
    price = holding.current_price or holding.cost_price
    return holding.quantity * price


def _calc_holding_profit(holding: Holding) -> Decimal:
    """计算持仓收益 = quantity * ((current_price or cost_price) - cost_price)"""
    current = holding.current_price or holding.cost_price
    return holding.quantity * (current - holding.cost_price)


def _calc_holding_cost(holding: Holding) -> Decimal:
    """计算持仓成本 = quantity * cost_price"""
    return holding.quantity * holding.cost_price


def _calc_deposit_earned(deposit: Deposit, today: date) -> Decimal:
    """计算定期已赚收益（按持有天数比例估算）"""
    if deposit.status != "active":
        return deposit.expected_return
    total_days = (deposit.maturity_date - deposit.start_date).days
    if total_days <= 0:
        return Decimal("0")
    held_days = (today - deposit.start_date).days
    held_days = max(0, min(held_days, total_days))
    return deposit.expected_return * Decimal(held_days) / Decimal(total_days)


def _calc_holding_days(holding: Holding, today: date) -> int:
    """计算持仓持有天数"""
    if not holding.buy_date:
        return 1
    days = (today - holding.buy_date).days
    return max(days, 1)


def _get_platform_name(platform: str) -> str:
    """平台代码转中文名称"""
    mapping = {
        "alipay": "支付宝",
        "cmb": "招商银行",
        "ths": "同花顺",
    }
    return mapping.get(platform, platform)


def _get_asset_type_name(asset_type: str) -> str:
    """资产类型代码转中文名称"""
    mapping = {
        "fund": "基金",
        "stock": "股票",
        "deposit": "定期理财",
    }
    return mapping.get(asset_type, asset_type)


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(db: Session = Depends(get_db)):
    """获取仪表盘汇总数据"""
    today = date.today()

    holdings = db.query(Holding).all()
    deposits = db.query(Deposit).filter(Deposit.status == "active").all()

    holding_count = len(holdings)
    deposit_count = len(deposits)

    holding_market_value = sum(_calc_holding_market_value(h) for h in holdings)
    holding_profit = sum(_calc_holding_profit(h) for h in holdings)
    holding_cost = sum(_calc_holding_cost(h) for h in holdings)

    deposit_principal = sum(d.principal for d in deposits)
    deposit_earned = sum(_calc_deposit_earned(d, today) for d in deposits)
    deposit_expected = sum(d.expected_return for d in deposits)

    total_assets = holding_market_value + deposit_principal + deposit_earned
    total_profit = holding_profit + deposit_earned
    total_cost = holding_cost + deposit_principal

    total_profit_rate = (total_profit / total_cost * 100) if total_cost > 0 else Decimal("0")

    # 基于历史组合快照计算真实收益：
    # - daily: 今日快照 - 昨日（或最近一次）快照的市场价值变化
    # - weekly/monthly/yearly: 1 周/1 月/1 年前的最近一次快照
    daily_profit, weekly_profit, monthly_profit, yearly_profit, data_status = _calc_period_profits(
        db, today, holding_market_value, deposit_principal, deposit_earned
    )

    by_platform_map: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    by_asset_type_map: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    platform_value_map: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    platform_profit_map: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    platform_cost_map: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    platform_weighted_days: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    for h in holdings:
        mv = _calc_holding_market_value(h)
        profit = _calc_holding_profit(h)
        cost = _calc_holding_cost(h)
        days = _calc_holding_days(h, today)

        by_platform_map[h.platform] += mv
        by_asset_type_map[h.asset_type] += mv

        platform_value_map[h.platform] += mv
        platform_profit_map[h.platform] += profit
        platform_cost_map[h.platform] += cost
        platform_weighted_days[h.platform] += Decimal(days) * cost

    for d in deposits:
        platform = d.bank
        deposit_value = d.principal + _calc_deposit_earned(d, today)
        deposit_profit = _calc_deposit_earned(d, today)
        deposit_days = (today - d.start_date).days if d.status == "active" else (d.maturity_date - d.start_date).days
        deposit_days = max(deposit_days, 1)

        by_platform_map[platform] += deposit_value
        by_asset_type_map["deposit"] += deposit_value

        platform_value_map[platform] += deposit_value
        platform_profit_map[platform] += deposit_profit
        platform_cost_map[platform] += d.principal
        platform_weighted_days[platform] += Decimal(deposit_days) * d.principal

    by_platform = [
        PlatformDistribution(name=_get_platform_name(k), value=v)
        for k, v in sorted(by_platform_map.items(), key=lambda x: -x[1])
    ]

    by_asset_type = [
        AssetTypeDistribution(name=_get_asset_type_name(k), value=v)
        for k, v in sorted(by_asset_type_map.items(), key=lambda x: -x[1])
    ]

    platform_comparison = []
    for platform in platform_value_map.keys():
        total_value = platform_value_map[platform]
        profit = platform_profit_map[platform]
        cost = platform_cost_map[platform]
        profit_rate = (profit / cost * 100) if cost > 0 else Decimal("0")

        weighted_days = platform_weighted_days[platform]
        avg_days = (weighted_days / cost) if cost > 0 else Decimal("1")
        annualized_rate = (profit_rate / avg_days * Decimal("365")) if avg_days > 0 else Decimal("0")

        platform_comparison.append(
            PlatformComparison(
                platform=_get_platform_name(platform),
                total_value=total_value,
                profit=profit,
                profit_rate=profit_rate,
                annualized_rate=annualized_rate,
            )
        )

    platform_comparison.sort(key=lambda x: -x.annualized_rate)

    return DashboardSummary(
        total_assets=total_assets,
        total_profit=total_profit,
        total_profit_rate=total_profit_rate,
        daily_profit=daily_profit,
        weekly_profit=weekly_profit,
        monthly_profit=monthly_profit,
        yearly_profit=yearly_profit,
        data_status=data_status,
        by_platform=by_platform,
        by_asset_type=by_asset_type,
        platform_comparison=platform_comparison,
        holding_count=holding_count,
        deposit_count=deposit_count,
    )


def _calc_period_profits(
    db: Session,
    today: date,
    holding_market_value: Decimal,
    deposit_principal: Decimal,
    deposit_earned: Decimal,
) -> tuple[Decimal, Decimal, Decimal, Decimal, dict]:
    """基于 portfolio_snapshots 表的差分计算真实周期收益。

    返回 (daily, weekly, monthly, yearly, data_status)：
    - 每个周期的 profit = 今日资产 - 周期起点对应的最近一次快照的资产
    - data_status 标记每个周期是否有可用快照，供前端决定是否显示"暂无历史"
    """
    current_total = holding_market_value + deposit_principal + deposit_earned
    zero = Decimal("0")
    status: dict[str, dict] = {}

    def _profit_for(days_ago: int, key: str) -> Decimal:
        target_date = today - timedelta(days=days_ago)
        snapshot = (
            db.query(PortfolioSnapshot)
            .filter(PortfolioSnapshot.snapshot_date <= target_date)
            .order_by(PortfolioSnapshot.snapshot_date.desc())
            .first()
        )
        if snapshot is None:
            status[key] = {"available": False, "snapshot_date": None, "days_missing": days_ago}
            return zero
        # 当日已有今日快照时不再差分（避免重复计算）
        if snapshot.snapshot_date == today:
            status[key] = {"available": False, "snapshot_date": snapshot.snapshot_date.isoformat(), "reason": "today"}
            return zero
        delta = current_total - snapshot.market_value
        status[key] = {
            "available": True,
            "snapshot_date": snapshot.snapshot_date.isoformat(),
            "baseline_value": str(snapshot.market_value),
        }
        return delta

    daily_profit = _profit_for(1, "daily")
    weekly_profit = _profit_for(7, "weekly")
    monthly_profit = _profit_for(30, "monthly")
    yearly_profit = _profit_for(365, "yearly")
    return daily_profit, weekly_profit, monthly_profit, yearly_profit, status
