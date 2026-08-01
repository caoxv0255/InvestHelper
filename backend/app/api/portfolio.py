from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.portfolio import build_portfolio_snapshot

router = APIRouter()


@router.get("/portfolio/snapshot")
async def portfolio_snapshot(
    as_of: date | None = Query(None, description="截至日期，默认今天"),
    db: Session = Depends(get_db),
):
    return build_portfolio_snapshot(db, as_of)
