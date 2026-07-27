import akshare as ak
import pandas as pd
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class AKShareProvider:
    def __init__(self):
        pass

    def get_stock_daily(self, symbol: str, start_date: str = None, end_date: str = None) -> pd.DataFrame:
        try:
            df = ak.stock_zh_a_hist(
                symbol=symbol,
                period="daily",
                start_date=start_date or "20200101",
                end_date=end_date or "20991231",
                adjust="qfq",
            )
            if df is None or df.empty:
                return pd.DataFrame()
            df = df.rename(
                columns={
                    "日期": "date",
                    "开盘": "open",
                    "最高": "high",
                    "最低": "low",
                    "收盘": "close",
                    "成交量": "volume",
                    "成交额": "amount",
                    "涨跌幅": "change_pct",
                    "涨跌额": "change",
                    "换手率": "turnover",
                }
            )
            df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
            return df.sort_values("date").reset_index(drop=True)
        except Exception as e:
            logger.error(f"获取股票日线数据失败 {symbol}: {e}")
            return pd.DataFrame()

    def get_stock_weekly(self, symbol: str, start_date: str = None, end_date: str = None) -> pd.DataFrame:
        try:
            df = ak.stock_zh_a_hist(
                symbol=symbol,
                period="weekly",
                start_date=start_date or "20200101",
                end_date=end_date or "20991231",
                adjust="qfq",
            )
            if df is None or df.empty:
                return pd.DataFrame()
            df = df.rename(
                columns={
                    "日期": "date",
                    "开盘": "open",
                    "最高": "high",
                    "最低": "low",
                    "收盘": "close",
                    "成交量": "volume",
                    "成交额": "amount",
                }
            )
            df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
            return df.sort_values("date").reset_index(drop=True)
        except Exception as e:
            logger.error(f"获取股票周线数据失败 {symbol}: {e}")
            return pd.DataFrame()

    def get_fund_daily(self, symbol: str, start_date: str = None, end_date: str = None) -> pd.DataFrame:
        try:
            df = ak.fund_open_fund_info_em(symbol=symbol, indicator="单位净值走势")
            if df is None or df.empty:
                return pd.DataFrame()
            df = df.rename(
                columns={
                    "净值日期": "date",
                    "单位净值": "close",
                    "日增长率": "change_pct",
                }
            )
            df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
            df["open"] = df["close"]
            df["high"] = df["close"]
            df["low"] = df["close"]
            df["volume"] = 0
            df = df.sort_values("date").reset_index(drop=True)
            if start_date:
                df = df[df["date"] >= start_date]
            if end_date:
                df = df[df["date"] <= end_date]
            return df.reset_index(drop=True)
        except Exception as e:
            logger.error(f"获取基金净值数据失败 {symbol}: {e}")
            return pd.DataFrame()

    def get_index_daily(self, symbol: str, start_date: str = None, end_date: str = None) -> pd.DataFrame:
        try:
            df = ak.stock_zh_index_daily(symbol=symbol)
            if df is None or df.empty:
                return pd.DataFrame()
            df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
            df = df.sort_values("date").reset_index(drop=True)
            if start_date:
                df = df[df["date"] >= start_date]
            if end_date:
                df = df[df["date"] <= end_date]
            return df.reset_index(drop=True)
        except Exception as e:
            logger.error(f"获取指数日线数据失败 {symbol}: {e}")
            return pd.DataFrame()

    def get_stock_quote(self, symbol: str) -> Optional[Dict]:
        try:
            df = ak.stock_zh_a_spot_em()
            if df is None or df.empty:
                return None
            row = df[df["代码"] == symbol]
            if row.empty:
                return None
            row = row.iloc[0]
            return {
                "code": row["代码"],
                "name": row["名称"],
                "price": float(row["最新价"]),
                "change": float(row["涨跌额"]),
                "change_percent": float(row["涨跌幅"]),
                "open": float(row["今开"]),
                "high": float(row["最高"]),
                "low": float(row["最低"]),
                "volume": float(row["成交量"]),
                "amount": float(row["成交额"]),
            }
        except Exception as e:
            logger.error(f"获取股票行情失败 {symbol}: {e}")
            return None

    def get_index_quote(self, symbol: str) -> Optional[Dict]:
        try:
            name_map = {
                "sh000001": "上证指数",
                "sz399001": "深证成指",
                "sz399006": "创业板指",
                "sh000300": "沪深300",
                "sh000905": "中证500",
            }
            symbol_clean = symbol.replace("sh", "").replace("sz", "")
            df = ak.stock_zh_index_spot_em(symbol="上证系列指数")
            if df is not None and not df.empty:
                row = df[df["代码"] == symbol_clean]
                if not row.empty:
                    row = row.iloc[0]
                    return {
                        "code": symbol,
                        "name": row.get("名称", name_map.get(symbol, "")),
                        "price": float(row["最新价"]),
                        "change": float(row["涨跌额"]),
                        "change_percent": float(row["涨跌幅"]),
                        "volume": float(row["成交量"]),
                        "amount": float(row["成交额"]),
                    }
            return None
        except Exception as e:
            logger.error(f"获取指数行情失败 {symbol}: {e}")
            return None

    def search_stock(self, keyword: str) -> List[Dict]:
        try:
            df = ak.stock_zh_a_spot_em()
            if df is None or df.empty:
                return []
            mask = df["代码"].str.contains(keyword, case=False) | df["名称"].str.contains(
                keyword, case=False
            )
            result = df[mask].head(20)
            items = []
            for _, row in result.iterrows():
                items.append(
                    {
                        "code": row["代码"],
                        "name": row["名称"],
                        "type": "stock",
                    }
                )
            return items
        except Exception as e:
            logger.error(f"搜索股票失败 {keyword}: {e}")
            return []

    def get_main_indices(self) -> List[Dict]:
        indices = [
            {"code": "000001", "name": "上证指数", "market": "sh"},
            {"code": "399001", "name": "深证成指", "market": "sz"},
            {"code": "399006", "name": "创业板指", "market": "sz"},
            {"code": "000300", "name": "沪深300", "market": "sh"},
        ]
        result = []
        try:
            df = ak.stock_zh_index_spot_em(symbol="上证系列指数")
            sz_df = ak.stock_zh_index_spot_em(symbol="深证系列指数")
            if df is not None and not df.empty:
                for idx in indices:
                    if idx["market"] == "sh":
                        row = df[df["代码"] == idx["code"]]
                    else:
                        row = sz_df[sz_df["代码"] == idx["code"]] if sz_df is not None else pd.DataFrame()
                    if not row.empty:
                        row = row.iloc[0]
                        result.append(
                            {
                                "code": idx["code"],
                                "name": idx["name"],
                                "price": float(row["最新价"]),
                                "change": float(row["涨跌额"]),
                                "change_percent": float(row["涨跌幅"]),
                                "volume": float(row["成交量"]),
                                "amount": float(row["成交额"]),
                            }
                        )
        except Exception as e:
            logger.error(f"获取主要指数行情失败: {e}")
        return result


akshare_provider = AKShareProvider()
