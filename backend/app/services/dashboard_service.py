from sqlalchemy.orm import Session
from typing import Dict, List
from datetime import date, timedelta

from ..models.holding import Holding
from ..models.fixed_deposit import FixedDeposit
from ..schemas.dashboard import (
    DashboardSummary,
    AssetDistribution,
    DistributionItem,
    PlatformCompareResponse,
    PlatformCompareItem,
)

PLATFORM_NAMES = {
    "alipay": "支付宝",
    "merchants_bank": "招商银行",
    "ths": "同花顺",
}

ASSET_TYPE_NAMES = {
    "fund": "基金",
    "stock": "股票",
    "deposit": "定期理财",
}


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def _calculate_fixed_deposit_value(self, fd: FixedDeposit) -> float:
        if fd.interest_method == "compound":
            days = (fd.end_date - fd.start_date).days
            years = days / 365.0
            return fd.principal * ((1 + fd.annual_rate / 100) ** years)
        else:
            days = (fd.end_date - fd.start_date).days
            interest = fd.principal * (fd.annual_rate / 100) * (days / 365)
            return fd.principal + interest

    def _get_current_value(self, holding: Holding) -> float:
        price = holding.current_price or holding.cost_price
        return holding.quantity * price

    def _get_cost_value(self, holding: Holding) -> float:
        return holding.quantity * holding.cost_price

    def get_summary(self) -> DashboardSummary:
        holdings = self.db.query(Holding).all()
        fixed_deposits = self.db.query(FixedDeposit).all()

        total_cost = 0.0
        total_current = 0.0

        for h in holdings:
            total_cost += self._get_cost_value(h)
            total_current += self._get_current_value(h)

        for fd in fixed_deposits:
            total_cost += fd.principal
            total_current += self._calculate_fixed_deposit_value(fd)

        total_profit = total_current - total_cost
        total_profit_rate = (total_profit / total_cost * 100) if total_cost > 0 else 0

        return DashboardSummary(
            total_asset=round(total_current, 2),
            total_profit=round(total_profit, 2),
            total_profit_rate=round(total_profit_rate, 2),
            today_profit=0.0,
            today_profit_rate=0.0,
            week_profit=0.0,
            week_profit_rate=0.0,
            month_profit=0.0,
            month_profit_rate=0.0,
            year_profit=round(total_profit, 2),
            year_profit_rate=round(total_profit_rate, 2),
        )

    def get_distribution(self) -> AssetDistribution:
        holdings = self.db.query(Holding).all()
        fixed_deposits = self.db.query(FixedDeposit).all()

        platform_values: Dict[str, float] = {}
        type_values: Dict[str, float] = {}

        total_asset = 0.0

        for h in holdings:
            value = self._get_current_value(h)
            total_asset += value

            platform_values[h.platform] = platform_values.get(h.platform, 0) + value
            type_values[h.asset_type] = type_values.get(h.asset_type, 0) + value

        for fd in fixed_deposits:
            value = self._calculate_fixed_deposit_value(fd)
            total_asset += value

            platform_values["merchants_bank"] = platform_values.get("merchants_bank", 0) + value
            type_values["deposit"] = type_values.get("deposit", 0) + value

        by_platform = []
        for platform, value in platform_values.items():
            pct = (value / total_asset * 100) if total_asset > 0 else 0
            by_platform.append(
                DistributionItem(
                    name=PLATFORM_NAMES.get(platform, platform),
                    value=round(value, 2),
                    percentage=round(pct, 2),
                )
            )
        by_platform.sort(key=lambda x: x.value, reverse=True)

        by_type = []
        for atype, value in type_values.items():
            pct = (value / total_asset * 100) if total_asset > 0 else 0
            by_type.append(
                DistributionItem(
                    name=ASSET_TYPE_NAMES.get(atype, atype),
                    value=round(value, 2),
                    percentage=round(pct, 2),
                )
            )
        by_type.sort(key=lambda x: x.value, reverse=True)

        return AssetDistribution(by_platform=by_platform, by_type=by_type)

    def get_platform_compare(self) -> PlatformCompareResponse:
        holdings = self.db.query(Holding).all()
        fixed_deposits = self.db.query(FixedDeposit).all()

        platform_data: Dict[str, Dict] = {}

        for h in holdings:
            if h.platform not in platform_data:
                platform_data[h.platform] = {
                    "platform": h.platform,
                    "platform_name": PLATFORM_NAMES.get(h.platform, h.platform),
                    "total_asset": 0,
                    "total_cost": 0,
                }
            platform_data[h.platform]["total_asset"] += self._get_current_value(h)
            platform_data[h.platform]["total_cost"] += self._get_cost_value(h)

        for fd in fixed_deposits:
            key = "merchants_bank"
            if key not in platform_data:
                platform_data[key] = {
                    "platform": key,
                    "platform_name": PLATFORM_NAMES.get(key, key),
                    "total_asset": 0,
                    "total_cost": 0,
                }
            platform_data[key]["total_asset"] += self._calculate_fixed_deposit_value(fd)
            platform_data[key]["total_cost"] += fd.principal

        items = []
        for data in platform_data.values():
            profit = data["total_asset"] - data["total_cost"]
            rate = (profit / data["total_cost"] * 100) if data["total_cost"] > 0 else 0
            items.append(
                PlatformCompareItem(
                    platform=data["platform"],
                    platform_name=data["platform_name"],
                    total_asset=round(data["total_asset"], 2),
                    total_cost=round(data["total_cost"], 2),
                    total_profit=round(profit, 2),
                    profit_rate=round(rate, 2),
                )
            )

        items.sort(key=lambda x: x.total_asset, reverse=True)
        return PlatformCompareResponse(items=items)
