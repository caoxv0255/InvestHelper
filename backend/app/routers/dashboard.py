from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.dashboard_service import DashboardService
from ..schemas.dashboard import (
    DashboardSummary,
    AssetDistribution,
    PlatformCompareResponse,
)

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    service = DashboardService(db)
    return service.get_summary()


@router.get("/distribution", response_model=AssetDistribution)
def get_dashboard_distribution(db: Session = Depends(get_db)):
    service = DashboardService(db)
    return service.get_distribution()


@router.get("/platform-compare", response_model=PlatformCompareResponse)
def get_platform_compare(db: Session = Depends(get_db)):
    service = DashboardService(db)
    return service.get_platform_compare()
