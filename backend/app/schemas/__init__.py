from app.schemas.holdings import HoldingCreate, HoldingUpdate, HoldingResponse
from app.schemas.deposits import DepositCreate, DepositUpdate, DepositResponse
from app.schemas.user_settings import UserSettingCreate, UserSettingUpdate, UserSettingResponse
from app.schemas.news import NewsCreate, NewsUpdate, NewsResponse
from app.schemas.opportunities import OpportunityCreate, OpportunityUpdate, OpportunityResponse
from app.schemas.dashboard import (
    DashboardSummary,
    PlatformDistribution,
    AssetTypeDistribution,
    PlatformComparison,
)

__all__ = [
    "HoldingCreate",
    "HoldingUpdate",
    "HoldingResponse",
    "DepositCreate",
    "DepositUpdate",
    "DepositResponse",
    "UserSettingCreate",
    "UserSettingUpdate",
    "UserSettingResponse",
    "NewsCreate",
    "NewsUpdate",
    "NewsResponse",
    "OpportunityCreate",
    "OpportunityUpdate",
    "OpportunityResponse",
    "DashboardSummary",
    "PlatformDistribution",
    "AssetTypeDistribution",
    "PlatformComparison",
]
