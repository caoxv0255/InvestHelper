from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..data_providers.akshare_provider import akshare_provider
from ..services.indicator_service import IndicatorService
from ..schemas.market import (
    KlineResponse,
    KlineDataItem,
    QuoteResponse,
    SearchResponse,
    SearchItem,
    IndicesResponse,
    IndexQuote,
)

router = APIRouter()


@router.get("/search", response_model=SearchResponse)
def search_market(keyword: str = Query(..., min_length=1, description="搜索关键词")):
    items = akshare_provider.search_stock(keyword)
    search_items = [SearchItem(code=item["code"], name=item["name"], type=item["type"]) for item in items]
    return SearchResponse(keyword=keyword, items=search_items)


@router.get("/quote/{code}", response_model=QuoteResponse)
def get_quote(code: str):
    quote = akshare_provider.get_stock_quote(code)
    if not quote:
        raise HTTPException(status_code=404, detail=f"未找到行情数据: {code}")
    return QuoteResponse(**quote)


@router.get("/kline/{code}", response_model=KlineResponse)
def get_kline(
    code: str,
    period: str = Query("daily", description="周期：daily/weekly"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
):
    if period == "weekly":
        df = akshare_provider.get_stock_weekly(code, start_date, end_date)
    else:
        df = akshare_provider.get_stock_daily(code, start_date, end_date)

    if df is None or df.empty:
        df = akshare_provider.get_fund_daily(code, start_date, end_date)

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"未找到K线数据: {code}")

    close_prices = df["close"].astype(float).tolist()
    high_prices = df["high"].astype(float).tolist()
    low_prices = df["low"].astype(float).tolist()

    ma5 = IndicatorService.calculate_ma(close_prices, 5)
    ma10 = IndicatorService.calculate_ma(close_prices, 10)
    ma20 = IndicatorService.calculate_ma(close_prices, 20)
    ma60 = IndicatorService.calculate_ma(close_prices, 60)
    dif, dea, macd_hist = IndicatorService.calculate_macd(close_prices)
    k, d, j = IndicatorService.calculate_kdj(high_prices, low_prices, close_prices)

    data = []
    for i, row in df.iterrows():
        idx = int(i)
        item = KlineDataItem(
            time=str(row["date"]),
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=float(row.get("volume", 0)),
            ma5=ma5[idx],
            ma10=ma10[idx],
            ma20=ma20[idx],
            ma60=ma60[idx],
            macd_dif=dif[idx],
            macd_dea=dea[idx],
            macd_hist=macd_hist[idx],
            kdj_k=k[idx],
            kdj_d=d[idx],
            kdj_j=j[idx],
        )
        data.append(item)

    return KlineResponse(
        code=code,
        name=code,
        period=period,
        data=data,
    )


@router.get("/indices", response_model=IndicesResponse)
def get_indices():
    indices = akshare_provider.get_main_indices()
    items = [IndexQuote(**idx) for idx in indices]
    return IndicesResponse(items=items)
