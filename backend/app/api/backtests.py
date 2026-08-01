from fastapi import APIRouter, HTTPException

from app.schemas.backtests import BacktestRequest, BacktestResponse
from app.services.backtest import run_backtest

router = APIRouter()


@router.post("/strategy/backtests", response_model=BacktestResponse)
async def create_backtest(request: BacktestRequest):
    try:
        result = run_backtest(request.model_dump())
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
