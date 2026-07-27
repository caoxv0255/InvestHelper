from pydantic import BaseModel
from typing import List, Dict, Optional


class DashboardSummary(BaseModel):
    total_asset: float
    total_profit: float
    total_profit_rate: float
    today_profit: float
    today_profit_rate: float
    week_profit: float
    week_profit_rate: float
    month_profit: float
    month_profit_rate: float
    year_profit: float
    year_profit_rate: float


class DistributionItem(BaseModel):
    name: str
    value: float
    percentage: float


class AssetDistribution(BaseModel):
    by_platform: List[DistributionItem]
    by_type: List[DistributionItem]


class PlatformCompareItem(BaseModel):
    platform: str
    platform_name: str
    total_asset: float
    total_cost: float
    total_profit: float
    profit_rate: float


class PlatformCompareResponse(BaseModel):
    items: List[PlatformCompareItem]
