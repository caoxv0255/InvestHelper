"""风险分析 API"""
import asyncio
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.holdings import Holding
from app.schemas.risk import RiskAnalysisResult
from app.services.risk import (
    calculate_industry_concentration,
    calculate_correlation_matrix,
    calculate_var,
    calculate_risk_score,
    calculate_factor_exposures,
    calculate_factor_attribution,
    _build_price_data,
    _get_returns,
    _get_factor_returns,
)

router = APIRouter()


def _build_factor_radar(exposures: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """将多因子暴露标准化为雷达图可用的 0-1 数值

    采用经验阈值做归一化：
    - 市场风险：Beta 绝对值 / 1.5
    - 规模/价值风险：暴露绝对值 / 1.0
    - 动量风险：20 日收益绝对值 / 0.2
    - 行业风险：最大行业权重 / 0.5
    结果裁剪到 [0, 1] 区间。
    """
    factor_scale = {
        "market": 1.5,
        "size": 1.0,
        "value": 1.0,
        "momentum": 0.2,
        "industry": 0.5,
    }
    factor_name = {
        "market": "市场风险",
        "size": "规模风险",
        "value": "价值风险",
        "momentum": "动量风险",
        "industry": "行业风险",
    }
    radar = []
    for item in exposures:
        factor = item.get("factor", "")
        raw = item.get("value", 0.0)
        scale = factor_scale.get(factor, 1.0)
        normalized = min(1.0, max(0.0, abs(raw) / scale))
        radar.append({
            "indicator": factor_name.get(factor, factor),
            "value": round(normalized, 4),
        })
    return radar


def _calc_market_value(holding: Holding) -> Decimal:
    """计算持仓市值"""
    price = holding.current_price if holding.current_price is not None else holding.cost_price
    return holding.quantity * price


@router.get("/risk/analysis", response_model=RiskAnalysisResult)
async def get_risk_analysis(db: Session = Depends(get_db)):
    """获取完整风险分析结果

    包括行业集中度、相关性矩阵、VaR、综合风险评分、最大单一持仓、
    多因子暴露、因子贡献归因、个股 Beta 及汇总信息。
    """
    holdings = db.query(Holding).all()
    position_count = len(holdings)

    # 计算总市值
    total_value = Decimal("0")
    position_values: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for h in holdings:
        mv = _calc_market_value(h)
        total_value += mv
        position_values[h.code] += mv

    # 行业集中度
    industry_concentration = calculate_industry_concentration(holdings)

    # 最大单一持仓
    if total_value > 0 and position_values:
        largest_code = max(position_values.items(), key=lambda x: x[1])[0]
        largest_weight = float(position_values[largest_code] / total_value)
    else:
        largest_code = ""
        largest_weight = 0.0

    # 异步获取行情数据并计算风险指标，避免阻塞事件循环
    def _fetch_and_compute():
        price_data = _build_price_data(holdings)
        returns = _get_returns(holdings, price_data)
        corr_matrix = calculate_correlation_matrix(holdings, price_data)
        var_result = calculate_var(holdings, price_data, confidence=0.95)
        factor_result = calculate_factor_exposures(holdings, price_data)
        return price_data, returns, corr_matrix, var_result, factor_result

    try:
        price_data, returns, corr_matrix, var_result, factor_result = await asyncio.wait_for(
            asyncio.to_thread(_fetch_and_compute),
            timeout=60.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="风险分析计算超时（>60s），可能因行情数据源限流，请稍后重试",
        )

    # 计算平均相关性（排除对角线）
    correlations = corr_matrix.get("correlations", [])
    codes = corr_matrix.get("codes", [])
    correlation_avg = 0.0
    if len(codes) >= 2 and correlations:
        off_diag_values = []
        n = len(codes)
        for i in range(n):
            for j in range(n):
                if i != j:
                    off_diag_values.append(correlations[i][j])
        correlation_avg = sum(off_diag_values) / len(off_diag_values) if off_diag_values else 0.0

    # 综合风险评分
    risk_score = calculate_risk_score(
        industry_concentration,
        correlation_avg,
        var_result["percentage"],
    )

    # 计算市值加权组合收益，用于因子归因
    market_values: dict[str, Decimal] = {}
    for h in holdings:
        if h.code not in returns.columns:
            continue
        mv = _calc_market_value(h)
        market_values[h.code] = market_values.get(h.code, Decimal("0")) + mv

    factor_attribution: list[dict[str, Any]] = []
    if market_values and total_value > 0:
        weights = {code: float(mv / total_value) for code, mv in market_values.items()}
        valid_codes = list(weights.keys())
        portfolio_returns = (returns[valid_codes] * pd.Series(weights)).sum(axis=1).to_frame(
            name="portfolio"
        )

        end_date = date.today()
        start_date = end_date - timedelta(days=180)
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")
        factor_ret_dict = _get_factor_returns(start_str, end_str, factor_result["warnings"])

        common_dates = portfolio_returns.index
        for series in factor_ret_dict.values():
            if not series.empty:
                common_dates = common_dates.intersection(series.index)

        if len(common_dates) >= 15:
            factor_returns_df = pd.DataFrame(
                {name: series.reindex(common_dates) for name, series in factor_ret_dict.items()}
            ).dropna(how="all", axis=1)
            if not factor_returns_df.empty:
                factor_attribution = calculate_factor_attribution(
                    portfolio_returns.loc[common_dates],
                    factor_returns_df,
                )

    # 雷达图数据：对 factor_exposures 做标准化
    factor_radar = _build_factor_radar(factor_result["exposures"])

    # 个股 Beta 列表
    stock_betas = [
        {
            "code": item["code"],
            "beta": item["beta"],
            "weight": item["weight"],
            "industry": item.get("industry"),
        }
        for item in factor_result["per_stock"]
    ]

    warnings_list = list(factor_result["warnings"]) + list(var_result.get("warnings", [])) + list(corr_matrix.get("warnings", []))

    return RiskAnalysisResult(
        industry_concentration=industry_concentration,
        correlation_matrix=corr_matrix,
        var=var_result,
        risk_score=risk_score,
        largest_position={"code": largest_code, "weight": largest_weight},
        summary={"total_value": float(total_value), "position_count": position_count},
        factor_exposures=factor_result["exposures"],
        factor_attribution=factor_attribution,
        factor_radar=factor_radar,
        stock_betas=stock_betas,
        warnings=warnings_list,
    )
