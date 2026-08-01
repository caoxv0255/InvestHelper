from decimal import Decimal
from pydantic import BaseModel, Field


class PlatformDistribution(BaseModel):
    """按平台分布"""
    name: str = Field(..., description="平台名称")
    value: Decimal = Field(..., description="资产价值")


class AssetTypeDistribution(BaseModel):
    """按资产类型分布"""
    name: str = Field(..., description="资产类型")
    value: Decimal = Field(..., description="资产价值")


class PlatformComparison(BaseModel):
    """各平台收益对比"""
    platform: str = Field(..., description="平台名称")
    total_value: Decimal = Field(..., description="总资产")
    profit: Decimal = Field(..., description="总收益")
    profit_rate: Decimal = Field(..., description="收益率")
    annualized_rate: Decimal = Field(..., description="年化收益率")


class DashboardSummary(BaseModel):
    """仪表盘汇总数据"""
    total_assets: Decimal = Field(..., description="总资产")
    total_profit: Decimal = Field(..., description="总收益")
    total_profit_rate: Decimal = Field(..., description="总收益率")
    daily_profit: Decimal = Field(..., description="日收益")
    weekly_profit: Decimal = Field(..., description="周收益")
    monthly_profit: Decimal = Field(..., description="月收益")
    yearly_profit: Decimal = Field(..., description="年收益")
    by_platform: list[PlatformDistribution] = Field(..., description="按平台分布")
    by_asset_type: list[AssetTypeDistribution] = Field(..., description="按资产类型分布")
    platform_comparison: list[PlatformComparison] = Field(..., description="各平台收益对比")
    holding_count: int = Field(..., description="持仓数量")
    deposit_count: int = Field(..., description="定期数量")
    data_status: dict = Field(default_factory=dict, description="收益数据状态（每个周期是否有快照）")
