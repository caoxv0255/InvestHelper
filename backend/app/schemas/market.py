from pydantic import BaseModel, Field
from typing import List, Optional


class KlineDataItem(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    ma5: Optional[float] = None
    ma10: Optional[float] = None
    ma20: Optional[float] = None
    ma60: Optional[float] = None
    macd_dif: Optional[float] = None
    macd_dea: Optional[float] = None
    macd_hist: Optional[float] = None
    kdj_k: Optional[float] = None
    kdj_d: Optional[float] = None
    kdj_j: Optional[float] = None


class KlineResponse(BaseModel):
    code: str
    name: str
    period: str
    data: List[KlineDataItem]


class QuoteResponse(BaseModel):
    code: str
    name: str
    price: float
    change: float
    change_percent: float
    open: float
    high: float
    low: float
    volume: float
    amount: Optional[float] = None


class SearchItem(BaseModel):
    code: str
    name: str
    type: str


class SearchResponse(BaseModel):
    keyword: str
    items: List[SearchItem]


class IndexQuote(BaseModel):
    code: str
    name: str
    price: float
    change: float
    change_percent: float
    volume: Optional[float] = None
    amount: Optional[float] = None


class IndicesResponse(BaseModel):
    items: List[IndexQuote]
