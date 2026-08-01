from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.portfolio import capture_portfolio_snapshot, portfolio_history
from app.services.daily_report import build_daily_report

router = APIRouter()


@router.post("/portfolio/snapshot/capture")
async def capture(as_of: date | None = Query(None), db: Session = Depends(get_db)):
    return capture_portfolio_snapshot(db, as_of)


@router.get("/portfolio/history")
async def history(currency: str | None = Query(None), db: Session = Depends(get_db)):
    return portfolio_history(db, currency)


@router.get("/portfolio/daily-report")
async def daily_report(db: Session = Depends(get_db)):
    return build_daily_report(db)
