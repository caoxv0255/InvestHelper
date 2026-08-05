"""AKShare 数据源实现

继承 MarketProvider，把原 services/market_data.py 里的 _ak_* 函数搬到这里。
所有方法通过 self._throttle() 走全局节流，触发限流的概率最小化。
"""
from __future__ import annotations

import logging
import math
from datetime import datetime
from typing import Any

from app.data_providers.base import MarketProvider

logger = logging.getLogger(__name__)


def _safe_float(value: Any, default: float = 0.0) -> float:
    """安全转换为 float：None / NaN / 异常都返回 default

    pandas DataFrame 的 row.get 在 strict 类型检查下推断为 Unknown|None，
    加 or default 兜底避免运行时 TypeError。
    """
    if value is None:
        return default
    try:
        result = float(value)
        # NaN 检查
        if math.isnan(result) or math.isinf(result):
            return default
        return result
    except (TypeError, ValueError):
        return default


class AKShareProvider(MarketProvider):
    """AKShare 数据源（主源，免费无需 token）

    字段映射（AKShare 中文列名 → 内部标准字段）：
        日期/净值日期 → date
        开盘 → open
        最高 → high
        最低 → low
        收盘/单位净值 → close
        成交量 → volume
    """

    name = "akshare"

    def __init__(self) -> None:
        # 延迟导入：避免启动时强制依赖 akshare（测试时不必装）
        self._ak = None

    def _get_ak(self):
        """懒加载 akshare（首次调用时 import）"""
        if self._ak is None:
            import akshare as ak

            self._ak = ak
        return self._ak

    # ============== K 线类方法 ==============

    def get_stock_daily(self, code: str, start_date: str, end_date: str) -> dict:
        self._throttle()
        ak = self._get_ak()
        logger.info("AKShare 获取股票日线 code=%s %s~%s", code, start_date, end_date)
        df = ak.stock_zh_a_hist(
            symbol=code,
            period="daily",
            start_date=start_date.replace("-", ""),
            end_date=end_date.replace("-", ""),
            adjust="qfq",
        )
        if df is None or df.empty:
            return {"code": code, "name": "", "klines": []}

        name = ""
        klines = []
        for _, row in df.iterrows():
            klines.append({
                "date": str(row.get("日期", "") or ""),
                "open": _safe_float(row.get("开盘")),
                "high": _safe_float(row.get("最高")),
                "low": _safe_float(row.get("最低")),
                "close": _safe_float(row.get("收盘")),
                "volume": _safe_float(row.get("成交量")),
            })

        return {"code": code, "name": name, "klines": klines}

    def get_stock_weekly(self, code: str, start_date: str, end_date: str) -> dict:
        self._throttle()
        ak = self._get_ak()
        logger.info("AKShare 获取股票周线 code=%s %s~%s", code, start_date, end_date)
        df = ak.stock_zh_a_hist(
            symbol=code,
            period="weekly",
            start_date=start_date.replace("-", ""),
            end_date=end_date.replace("-", ""),
            adjust="qfq",
        )
        if df is None or df.empty:
            return {"code": code, "name": "", "klines": []}

        klines = []
        for _, row in df.iterrows():
            klines.append({
                "date": str(row.get("日期", "") or ""),
                "open": _safe_float(row.get("开盘")),
                "high": _safe_float(row.get("最高")),
                "low": _safe_float(row.get("最低")),
                "close": _safe_float(row.get("收盘")),
                "volume": _safe_float(row.get("成交量")),
            })

        return {"code": code, "name": "", "klines": klines}

    def get_stock_minute(self, code: str, period: str) -> dict:
        """获取股票分钟线数据

        Args:
            period: 5 / 15 / 30 / 60（不带 "min" 后缀；调用方应先归一化）
        """
        self._throttle()
        ak = self._get_ak()
        logger.info("AKShare 获取股票分钟线 code=%s period=%s", code, period)
        df = ak.stock_zh_a_hist_min_em(symbol=code, period=period, adjust="qfq")
        if df is None or df.empty:
            return {"code": code, "name": "", "klines": []}

        klines = []
        for _, row in df.iterrows():
            klines.append({
                "date": str(row.get("时间", "") or ""),
                "open": _safe_float(row.get("开盘")),
                "high": _safe_float(row.get("最高")),
                "low": _safe_float(row.get("最低")),
                "close": _safe_float(row.get("收盘")),
                "volume": _safe_float(row.get("成交量")),
            })

        return {"code": code, "name": "", "klines": klines}

    def get_fund_nav(self, code: str, start_date: str, end_date: str) -> dict:
        self._throttle()
        ak = self._get_ak()
        logger.info("AKShare 获取基金净值 code=%s %s~%s", code, start_date, end_date)
        df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
        if df is None or df.empty:
            return {"code": code, "name": "", "klines": []}

        # 过滤日期范围
        try:
            df = df[(df["净值日期"] >= start_date) & (df["净值日期"] <= end_date)]
        except Exception as e:  # noqa: BLE001
            logger.warning("基金净值日期过滤失败: %s", e)

        klines = []
        for _, row in df.iterrows():
            # 基金净值没有 OHLC，统一用 close 表示净值，volume 用 0
            klines.append({
                "date": str(row.get("净值日期", "") or ""),
                "open": 0.0,
                "high": 0.0,
                "low": 0.0,
                "close": _safe_float(row.get("单位净值")),
                "volume": 0.0,
            })

        return {"code": code, "name": "", "klines": klines}

    def get_fund_realtime(self, code: str) -> dict:
        self._throttle()
        ak = self._get_ak()
        logger.info("AKShare 获取基金实时估值 code=%s", code)
        df = ak.fund_value_estimate_em()
        if df is None or df.empty:
            return {"code": code, "name": "", "realtime": {}}

        row = df[df["基金代码"] == code]
        if row.empty:
            return {"code": code, "name": "", "realtime": {}}

        r = row.iloc[0]
        return {
            "code": code,
            "name": str(r.get("基金简称", "") or ""),
            "realtime": {
                "date": str(r.get("估值日期", "") or ""),
                "time": str(r.get("估值时间", "") or ""),
                "estimated_nav": _safe_float(r.get("估算值")),
                "estimated_change_pct": _safe_float(r.get("估算增长率")),
            },
        }

    def get_index_daily(self, code: str, start_date: str, end_date: str) -> dict:
        self._throttle()
        ak = self._get_ak()
        logger.info("AKShare 获取指数日线 code=%s %s~%s", code, start_date, end_date)
        df = ak.index_zh_a_hist(
            symbol=code,
            period="daily",
            start_date=start_date.replace("-", ""),
            end_date=end_date.replace("-", ""),
        )
        if df is None or df.empty:
            return {"code": code, "name": "", "klines": []}

        klines = []
        for _, row in df.iterrows():
            klines.append({
                "date": str(row.get("日期", "") or ""),
                "open": _safe_float(row.get("开盘")),
                "high": _safe_float(row.get("最高")),
                "low": _safe_float(row.get("最低")),
                "close": _safe_float(row.get("收盘")),
                "volume": _safe_float(row.get("成交量")),
            })

        return {"code": code, "name": "", "klines": klines}

    def search_stock(self, keyword: str) -> list[dict]:
        self._throttle()
        ak = self._get_ak()
        logger.info("AKShare 搜索 keyword=%s", keyword)
        results: list[dict] = []

        # 1. 搜索 A 股
        try:
            df = ak.stock_info_a_code_name()
            if df is not None and not df.empty:
                matched = df[
                    df["code"].str.contains(keyword, case=False, na=False)
                    | df["name"].str.contains(keyword, case=False, na=False)
                ]
                for _, row in matched.iterrows():
                    results.append({
                        "code": str(row["code"]),
                        "name": str(row["name"]),
                        "type": "stock",
                        "market": self.guess_market(str(row["code"])),
                    })
        except Exception as e:  # noqa: BLE001
            logger.warning("AKShare 搜索 A 股失败: %s", e)

        # 2. 搜索基金
        try:
            df = ak.fund_name_em()
            if df is not None and not df.empty:
                # 基金表列名可能有多种：基金代码/基金简称
                code_col = "基金代码" if "基金代码" in df.columns else df.columns[0]
                name_col = "基金简称" if "基金简称" in df.columns else df.columns[1]
                matched = df[
                    df[code_col].astype(str).str.contains(keyword, case=False, na=False)
                    | df[name_col].astype(str).str.contains(keyword, case=False, na=False)
                ]
                for _, row in matched.iterrows():
                    results.append({
                        "code": str(row[code_col]),
                        "name": str(row[name_col]),
                        "type": "fund",
                        "market": "",
                    })
        except Exception as e:  # noqa: BLE001
            logger.warning("AKShare 搜索基金失败: %s", e)

        return results[:50]  # 限制返回 50 条

    def get_realtime(self, code: str) -> dict:
        """根据 code 头判断是股票还是基金，分别走不同子方法"""
        # 简单判断：基金代码通常以 1/5 开头且 6 位
        is_fund = len(code) == 6 and code[0] in ("1", "5")
        if is_fund:
            return self.get_fund_realtime(code)
        return self._fetch_stock_realtime(code)

    def _fetch_stock_realtime(self, code: str) -> dict:
        """AKShare 股票实时行情（一次拉全市场，本地筛选）"""
        self._throttle()
        ak = self._get_ak()
        logger.info("AKShare 获取股票实时行情 code=%s", code)
        df = ak.stock_zh_a_spot_em()
        if df is None or df.empty:
            return {"code": code, "name": "", "realtime": {}}
        row = df[df["代码"] == code]
        if row.empty:
            return {"code": code, "name": "", "realtime": {}}
        r = row.iloc[0]
        return {
            "code": code,
            "name": str(r.get("名称", "") or ""),
            "realtime": {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "time": datetime.now().strftime("%H:%M:%S"),
                "price": _safe_float(r.get("最新价")),
                "change_pct": _safe_float(r.get("涨跌幅")),
                "change": _safe_float(r.get("涨跌额")),
                "volume": _safe_float(r.get("成交量")),
                "amount": _safe_float(r.get("成交额")),
                "open": _safe_float(r.get("今开")),
                "high": _safe_float(r.get("最高")),
                "low": _safe_float(r.get("最低")),
                "pre_close": _safe_float(r.get("昨收")),
            },
        }