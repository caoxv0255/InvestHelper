"""风险分析服务

提供投资组合风险分散度相关计算：
- 行业集中度
- 标的收益率相关性矩阵
- 历史模拟法 VaR
- 综合风险评分
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import numpy as np
import pandas as pd

from app.models.holdings import Holding
from app.services.market_data import get_index_daily, get_stock_daily, get_fund_nav

logger = logging.getLogger(__name__)

# 计算相关性 / VaR 所需的最少交易日
MIN_TRADING_DAYS = 30
# 获取历史行情的回望天数
_LOOKBACK_DAYS = 180

# 多因子模型使用的指数代理
# market: 沪深300，size: 中证500相对沪深300，value: 创业板指相对沪深300
FACTOR_INDEX_CODES = {
    "market": "000300",
    "size": "000905",
    "value": "399006",
}
# 动量因子回望窗口（交易日）
MOMENTUM_WINDOW = 20


def _get_market_value(holding: Holding) -> Decimal:
    """计算持仓市值，缺失 current_price 时 fallback 到 cost_price"""
    price = holding.current_price if holding.current_price is not None else holding.cost_price
    return holding.quantity * price


def calculate_industry_concentration(holdings: list[Holding]) -> list[dict[str, Any]]:
    """计算行业集中度

    Args:
        holdings: 持仓列表

    Returns:
        按权重降序排列的行业分布列表，每项包含：
        - industry: 行业名称（缺失为"未分类"）
        - weight: 权重（0-1）
        - amount: 行业市值
    """
    industry_amount: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    total_value = Decimal("0")

    for h in holdings:
        mv = _get_market_value(h)
        industry = h.industry if h.industry else "未分类"
        industry_amount[industry] += mv
        total_value += mv

    if total_value <= 0:
        return []

    result = []
    for industry, amount in industry_amount.items():
        result.append({
            "industry": industry,
            "amount": float(amount),
            "weight": float(amount / total_value),
        })

    result.sort(key=lambda x: x["weight"], reverse=True)
    return result


def _fetch_price_history(code: str, asset_type: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
    """根据资产类型获取历史价格数据

    股票走日线，基金走净值，其他返回空。
    """
    try:
        if asset_type == "stock":
            data = get_stock_daily(code, start_date, end_date)
        elif asset_type == "fund":
            data = get_fund_nav(code, start_date, end_date)
        else:
            return []
        return data.get("klines", []) or []
    except Exception as e:  # noqa: BLE001
        logger.warning("获取 %s 价格历史失败: %s", code, e)
        return []


def _series_from_klines(klines: list[dict[str, Any]], name: str) -> pd.Series:
    """将原始 K 线列表转换为收盘价时间序列

    过滤缺失/非正收盘价，按日期去重并排序，便于后续计算收益率。
    """
    dates = []
    closes = []
    for k in klines:
        close = k.get("close")
        if close is None or close <= 0:
            continue
        dates.append(k.get("date"))
        closes.append(float(close))

    if not closes:
        return pd.Series(dtype=float, name=name)

    s = pd.Series(closes, index=pd.to_datetime(dates), name=name)
    s = s.groupby(level=0).last().sort_index()
    return s


def _get_factor_returns(
    start_str: str,
    end_str: str,
    warnings: list[str],
) -> dict[str, pd.Series]:
    """获取多因子指数日收益率

    使用指数代理：沪深300（市场）、中证500（规模）、创业板指（价值/成长）。
    获取失败时向 warnings 写入提示并返回空序列。
    """
    factor_returns: dict[str, pd.Series] = {}
    for factor, code in FACTOR_INDEX_CODES.items():
        try:
            klines = get_index_daily(code, start_str, end_str).get("klines", [])
            if not klines:
                raise RuntimeError("无数据")
            series = _series_from_klines(klines, factor)
            factor_returns[factor] = series.pct_change().dropna()
        except Exception as e:  # noqa: BLE001
            logger.warning("获取 %s 因子指数(%s)失败: %s", factor, code, e)
            warnings.append(f"获取{factor}因子指数({code})行情失败，该因子暴露使用默认值 0")
            factor_returns[factor] = pd.Series(dtype=float)
    return factor_returns


def _build_price_data(holdings: list[Holding]) -> dict[str, list[dict[str, Any]]]:
    """为所有持仓构建原始价格数据字典

    Returns:
        {code: [kline, ...]}
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=_LOOKBACK_DAYS)
    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = end_date.strftime("%Y-%m-%d")

    price_data: dict[str, list[dict[str, Any]]] = {}
    for h in holdings:
        klines = _fetch_price_history(h.code, h.asset_type, start_date_str, end_date_str)
        if klines:
            price_data[h.code] = klines
    return price_data


def _returns_from_price_data(price_data: dict[str, list[dict[str, Any]]]) -> pd.DataFrame:
    """将原始 K 线数据转换为日收益率 DataFrame"""
    price_frames = []
    for code, klines in price_data.items():
        if len(klines) < MIN_TRADING_DAYS:
            continue

        dates = []
        closes = []
        for k in klines:
            close = k.get("close")
            if close is None or close <= 0:
                continue
            dates.append(k.get("date"))
            closes.append(float(close))

        if len(closes) < MIN_TRADING_DAYS:
            continue

        s = pd.Series(closes, index=pd.to_datetime(dates), name=code)
        s = s.groupby(level=0).last().sort_index()
        price_frames.append(s)

    if not price_frames:
        return pd.DataFrame()

    prices = pd.concat(price_frames, axis=1)
    prices = prices.dropna(how="all", axis=0)
    returns = prices.pct_change().dropna(how="all")
    return returns


def _get_returns(holdings: list[Holding], price_data: Any = None) -> pd.DataFrame:
    """统一获取收益率序列

    - 若 price_data 为 DataFrame，直接使用
    - 若 price_data 为 dict，转换为 DataFrame
    - 否则重新获取行情数据
    """
    if isinstance(price_data, pd.DataFrame):
        return price_data
    if isinstance(price_data, dict):
        return _returns_from_price_data(price_data)
    return _returns_from_price_data(_build_price_data(holdings))


def calculate_correlation_matrix(holdings: list[Holding], price_data: Any = None) -> dict[str, Any]:
    """计算标的收益相关性矩阵

    Args:
        holdings: 持仓列表
        price_data: 原始行情数据 {code: [kline, ...]} 或已计算的收益率 DataFrame；
                    为空时自动获取

    Returns:
        {
            "codes": ["000001", "000002", ...],
            "correlations": [[1.0, 0.2, ...], ...]
        }
        若有效标的不足 2 只，返回空矩阵。
    """
    returns = _get_returns(holdings, price_data)
    if returns.empty or returns.shape[1] < 2:
        return {"codes": [], "correlations": []}

    # 仅保留同时有收益率的日期，避免不同标的数据长度差异导致偏差
    valid_returns = returns.dropna()
    if valid_returns.shape[0] < MIN_TRADING_DAYS // 2:
        return {"codes": [], "correlations": []}

    codes = list(valid_returns.columns)
    corr = valid_returns.corr(method="pearson")
    # 处理 NaN（理论上不应出现，但防御性填充）
    corr = corr.fillna(0)

    # 相关系数限制在 [-1, 1]，并转换为 Python 原生 float 保证 JSON 可序列化
    corr_values = np.clip(corr.values, -1.0, 1.0)

    return {
        "codes": codes,
        "correlations": [[float(v) for v in row] for row in corr_values],
    }


def calculate_var(
    holdings: list[Holding],
    price_data: Any = None,
    confidence: float = 0.95,
) -> dict[str, Any]:
    """历史模拟法计算组合单日 VaR

    Args:
        holdings: 持仓列表
        price_data: 原始行情数据或收益率 DataFrame；为空时自动获取
        confidence: 置信水平，默认 0.95

    Returns:
        {
            "amount": 单日最大可能损失金额（绝对值）,
            "percentage": 相对组合市值的百分比,
            "confidence": 置信水平
        }
        若数据不足，返回 amount=0, percentage=0。
    """
    returns = _get_returns(holdings, price_data)
    if returns.empty:
        return {"amount": 0.0, "percentage": 0.0, "confidence": confidence}

    # 计算持仓权重
    market_values = {}
    total_value = Decimal("0")
    for h in holdings:
        if h.code not in returns.columns:
            continue
        mv = _get_market_value(h)
        market_values[h.code] = market_values.get(h.code, Decimal("0")) + mv
        total_value += mv

    if total_value <= 0 or not market_values:
        return {"amount": 0.0, "percentage": 0.0, "confidence": confidence}

    weights = {code: float(mv / total_value) for code, mv in market_values.items()}

    # 仅保留有持仓的代码
    valid_codes = list(weights.keys())
    portfolio_returns = returns[valid_codes].dropna()
    if portfolio_returns.empty:
        return {"amount": 0.0, "percentage": 0.0, "confidence": confidence}

    weighted_returns = portfolio_returns * pd.Series(weights)
    daily_portfolio_return = weighted_returns.sum(axis=1)

    if daily_portfolio_return.empty:
        return {"amount": 0.0, "percentage": 0.0, "confidence": confidence}

    # 历史模拟法：取组合收益率的 (1 - confidence) 分位数作为损失
    var_percentile = np.percentile(daily_portfolio_return, (1 - confidence) * 100)
    # 损失为负值，取绝对值表示最大可能损失
    var_pct = abs(float(var_percentile))
    var_amount = var_pct * float(total_value)

    return {
        "amount": var_amount,
        "percentage": var_pct,
        "confidence": confidence,
    }


def calculate_risk_score(
    concentration: list[dict[str, Any]],
    correlation_avg: float,
    var_pct: float,
) -> dict[str, Any]:
    """综合风险评分

    评分维度：
    - 行业集中度（HHI 或最大行业权重）
    - 平均相关性
    - VaR 百分比

    输出 low / medium / high / very_high 四级。
    """
    # 计算赫芬达尔指数（HHI）和最大行业权重
    hhi = sum(item["weight"] ** 2 for item in concentration) if concentration else 0.0
    max_industry_weight = max((item["weight"] for item in concentration), default=0.0)

    # 集中度得分：0-100，HHI 越高越集中
    concentration_score = min(100.0, hhi * 100)

    # 相关性得分：平均相关性越高风险越大，映射到 0-100
    correlation_score = min(100.0, max(0.0, correlation_avg) * 100)

    # VaR 得分：VaR 越大风险越高
    # 单日 VaR 超过 3% 视为较高，超过 5% 视为很高
    var_score = min(100.0, var_pct * 100 / 3.0 * 100)

    # 综合得分（加权）
    total_score = (
        concentration_score * 0.4
        + correlation_score * 0.25
        + var_score * 0.35
    )

    if total_score >= 70:
        level = "very_high"
        label = "极高风险"
    elif total_score >= 50:
        level = "high"
        label = "高风险"
    elif total_score >= 30:
        level = "medium"
        label = "中等风险"
    else:
        level = "low"
        label = "低风险"

    return {
        "level": level,
        "label": label,
        "factors": {
            "concentration_score": round(concentration_score, 2),
            "correlation_score": round(correlation_score, 2),
            "var_score": round(var_score, 2),
            "total_score": round(total_score, 2),
            "hhi": round(hhi, 4),
            "max_industry_weight": round(max_industry_weight, 4),
        },
    }


def calculate_beta(holding_returns: pd.Series, market_returns: pd.Series) -> float:
    """计算单个持仓相对市场因子的 Beta

    Beta = Cov(持仓收益, 市场收益) / Var(市场收益)

    Args:
        holding_returns: 持仓日收益率序列
        market_returns: 市场日收益率序列

    Returns:
        Beta 值；数据不足或方差为 0 时返回 0
    """
    if holding_returns is None or market_returns is None:
        return 0.0

    aligned = pd.concat([holding_returns, market_returns], axis=1).dropna()
    if len(aligned) < 2:
        return 0.0

    stock_ret = aligned.iloc[:, 0]
    market_ret = aligned.iloc[:, 1]
    cov = stock_ret.cov(market_ret)
    var = market_ret.var()
    if var == 0 or pd.isna(var) or pd.isna(cov):
        return 0.0

    beta = cov / var
    # 对极端 Beta 做截断，避免异常数据影响展示
    return float(np.clip(beta, -5.0, 5.0))


def calculate_factor_exposures(
    holdings: list[Holding],
    price_data: Any = None,
) -> dict[str, Any]:
    """计算投资组合的多因子暴露

    因子定义：
    - 市场因子（market）：持仓相对沪深300 000300 的 Beta
    - 规模因子（size）：持仓相对“中证500 - 沪深300”的 Beta，代理大小盘风格
    - 价值因子（value）：持仓相对“创业板指 - 沪深300”的 Beta，代理成长/价值风格
    - 动量因子（momentum）：持仓过去 MOMENTUM_WINDOW 个交易日收益率，代理短期趋势
    - 行业因子（industry）：用最大行业权重作为行业集中度代理

    Args:
        holdings: 持仓列表
        price_data: 原始行情数据 {code: [kline, ...]} 或已计算的收益率 DataFrame

    Returns:
        {
            "exposures": [{"factor": str, "value": float}, ...],
            "per_stock": [{"code": str, "beta": float, "size": float,
                           "value": float, "momentum": float,
                           "weight": float, "industry": str | None}, ...],
            "warnings": [str, ...]
        }
    """
    warnings: list[str] = []
    zero_exposures = [
        {"factor": "market", "value": 0.0},
        {"factor": "size", "value": 0.0},
        {"factor": "value", "value": 0.0},
        {"factor": "momentum", "value": 0.0},
        {"factor": "industry", "value": 0.0},
    ]
    default_result = {"exposures": zero_exposures, "per_stock": [], "warnings": warnings}

    returns = _get_returns(holdings, price_data)
    if returns.empty:
        warnings.append("持仓收益数据不足，无法计算多因子暴露，所有因子暴露使用默认值 0")
        return default_result

    # 基于市值计算权重（仅保留有收益数据的代码）
    market_values: dict[str, Decimal] = {}
    total_value = Decimal("0")
    for h in holdings:
        if h.code not in returns.columns:
            continue
        mv = _get_market_value(h)
        market_values[h.code] = market_values.get(h.code, Decimal("0")) + mv
        total_value += mv

    if total_value <= 0 or not market_values:
        warnings.append("持仓总市值为 0，无法计算多因子暴露，所有因子暴露使用默认值 0")
        return default_result

    weights = {code: float(mv / total_value) for code, mv in market_values.items()}

    # 获取因子指数收益
    end_date = date.today()
    start_date = end_date - timedelta(days=_LOOKBACK_DAYS)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    factor_returns = _get_factor_returns(start_str, end_str, warnings)

    # 对齐所有可用因子与持仓收益的日期
    common_dates = returns.index
    for series in factor_returns.values():
        if not series.empty:
            common_dates = common_dates.intersection(series.index)

    if len(common_dates) < MIN_TRADING_DAYS // 2:
        warnings.append("行情数据对齐后交易日不足，多因子暴露使用默认值 0")
        return default_result

    aligned_returns = returns.loc[common_dates]
    market_ret = factor_returns["market"].reindex(common_dates).fillna(0.0)
    size_ret = (factor_returns["size"].reindex(common_dates) - market_ret).fillna(0.0)
    value_ret = (factor_returns["value"].reindex(common_dates) - market_ret).fillna(0.0)

    # 逐只持仓计算因子暴露
    per_stock: list[dict[str, Any]] = []
    portfolio = {"market": 0.0, "size": 0.0, "value": 0.0, "momentum": 0.0}
    for code in aligned_returns.columns:
        stock_ret = aligned_returns[code]
        beta = calculate_beta(stock_ret, market_ret)
        size_exposure = calculate_beta(stock_ret, size_ret)
        value_exposure = calculate_beta(stock_ret, value_ret)

        # 动量：优先用原始价格计算，缺失时用收益率反推
        momentum = 0.0
        if isinstance(price_data, dict) and code in price_data:
            prices = _series_from_klines(price_data[code], code)
            if len(prices) >= MOMENTUM_WINDOW + 1:
                momentum = float(prices.iloc[-1] / prices.iloc[-MOMENTUM_WINDOW - 1] - 1)
        if momentum == 0.0 and len(stock_ret) >= MOMENTUM_WINDOW:
            momentum = float((1 + stock_ret.iloc[-MOMENTUM_WINDOW:]).prod() - 1)

        weight = weights.get(code, 0.0)
        portfolio["market"] += beta * weight
        portfolio["size"] += size_exposure * weight
        portfolio["value"] += value_exposure * weight
        portfolio["momentum"] += momentum * weight

        # 取该代码对应的行业（按第一条记录）
        industry = next((h.industry for h in holdings if h.code == code), None)
        per_stock.append({
            "code": code,
            "beta": round(float(beta), 4),
            "size": round(float(size_exposure), 4),
            "value": round(float(value_exposure), 4),
            "momentum": round(float(momentum), 4),
            "weight": round(float(weight), 4),
            "industry": industry,
        })

    # 行业因子：用最大行业权重代理单一行业敞口
    concentration = calculate_industry_concentration(holdings)
    max_industry_weight = max((item["weight"] for item in concentration), default=0.0)
    portfolio["industry"] = float(max_industry_weight)

    exposures = [
        {"factor": "market", "value": round(portfolio["market"], 4)},
        {"factor": "size", "value": round(portfolio["size"], 4)},
        {"factor": "value", "value": round(portfolio["value"], 4)},
        {"factor": "momentum", "value": round(portfolio["momentum"], 4)},
        {"factor": "industry", "value": round(portfolio["industry"], 4)},
    ]

    return {"exposures": exposures, "per_stock": per_stock, "warnings": warnings}


def calculate_factor_attribution(
    returns: pd.DataFrame,
    factor_returns: pd.DataFrame,
) -> list[dict[str, Any]]:
    """计算因子贡献归因

    通过普通最小二乘（OLS）将组合收益回归到因子收益上，得到各因子的暴露系数，
    再乘以对应因子的年化收益，得到各因子的年化贡献。

    Args:
        returns: 持仓（或组合）日收益率 DataFrame，每列代表一个标的/组合
        factor_returns: 因子日收益率 DataFrame，每列代表一个因子

    Returns:
        [{"factor": str, "contribution": float}, ...]
    """
    if returns.empty or factor_returns.empty:
        return []

    common = returns.index.intersection(factor_returns.index)
    if len(common) < MIN_TRADING_DAYS // 2:
        return []

    # 若只有一列则直接使用，否则用等权组合收益作为被解释变量
    if returns.shape[1] == 1:
        portfolio_returns = returns.iloc[:, 0].loc[common]
    else:
        portfolio_returns = returns.mean(axis=1).loc[common]

    x = factor_returns.loc[common].values
    y = portfolio_returns.values
    if np.isnan(x).any() or np.isnan(y).any():
        return []

    try:
        coeffs, *_ = np.linalg.lstsq(x, y, rcond=None)
    except Exception as e:  # noqa: BLE001
        logger.warning("因子归因回归失败: %s", e)
        return []

    contributions = []
    for idx, factor in enumerate(factor_returns.columns):
        factor_daily_mean = factor_returns.loc[common, factor].mean()
        # 年化因子收益（按 252 个交易日）
        annual_factor_return = float(factor_daily_mean * 252)
        contribution = float(coeffs[idx] * annual_factor_return)
        contributions.append({
            "factor": factor,
            "contribution": round(contribution, 6),
        })
    return contributions
