"""可解释、无未来函数的最小回测引擎。

输入是已经准备好的收盘价序列；行情获取与策略计算分离，便于后续接入缓存和更多数据源。
"""
from collections import defaultdict
from datetime import date
from typing import Any


def _aligned_prices(assets: list[dict[str, Any]]) -> tuple[list[date], dict[str, dict[date, float]]]:
    series: dict[str, dict[date, float]] = {}
    for asset in assets:
        series[asset["code"]] = {bar["date"]: float(bar["close"]) for bar in asset["bars"]}
    dates = sorted(set.intersection(*(set(values) for values in series.values())))
    if len(dates) < 2:
        raise ValueError("所有标的至少需要两天且日期必须有交集")
    return dates, series


def _target_weights(request: dict[str, Any], assets: list[dict[str, Any]], prices: dict[str, float], history: dict[str, list[float]]) -> dict[str, float]:
    strategy = request["strategy"]
    constraints = request["constraints"]
    max_single = float(constraints["max_single_weight"])
    cash_floor = float(constraints["min_cash_weight"])
    codes = [asset["code"] for asset in assets]

    if strategy in ("buy_hold", "rebalance"):
        raw = {asset["code"]: float(asset.get("target_weight", 0)) for asset in assets}
        total = sum(raw.values()) or 1.0
        scale = min(1.0, (1.0 - cash_floor) / total)
        weights = {code: min(max_single, raw[code] * scale) for code in codes}
    else:
        scores: dict[str, float] = {}
        for code in codes:
            values = history[code]
            if strategy == "sma_trend":
                window = min(int(request["short_window"]), len(values))
                scores[code] = 1.0 if values[-1] > sum(values[-window:]) / window else 0.0
            else:
                lookback = min(int(request["lookback"]), len(values) - 1)
                scores[code] = (values[-1] / values[-lookback - 1] - 1) if lookback > 0 else 0.0
        active = [code for code, score in scores.items() if score > 0]
        if strategy == "momentum" and active:
            active = sorted(active, key=lambda code: scores[code], reverse=True)[: max(1, len(active))]
        weights = {code: min(max_single, (1.0 - cash_floor) / len(active)) if code in active else 0.0 for code in codes}
    return weights


def run_backtest(request: dict[str, Any]) -> dict[str, Any]:
    dates, series = _aligned_prices(request["assets"])
    assets = request["assets"]
    initial = float(request["initial_capital"])
    fee_rate = float(request["fee_rate"])
    slippage = float(request["slippage_rate"])
    min_trade = float(request["constraints"]["min_trade_amount"])
    max_monthly = int(request["constraints"]["max_monthly_trades"])
    history = defaultdict(list)
    previous_weights = {asset["code"]: 0.0 for asset in assets}
    equity = initial
    peak = initial
    curve = [{"date": dates[0].isoformat(), "equity": round(equity, 2), "drawdown": 0.0}]
    trades: list[dict[str, Any]] = []
    monthly_count: dict[str, int] = defaultdict(int)

    for index in range(len(dates) - 1):
        current_date, next_date = dates[index], dates[index + 1]
        prices_today = {code: series[code][current_date] for code in series}
        for code in series:
            history[code].append(prices_today[code])

        should_rebalance = request["strategy"] != "rebalance" or index == 0 or current_date.month != dates[index - 1].month
        weights = previous_weights
        if should_rebalance:
            candidate = _target_weights(request, assets, prices_today, history)
            changed = sum(abs(candidate[code] - previous_weights[code]) for code in candidate)
            estimated_trade = equity * changed / 2
            month_key = current_date.strftime("%Y-%m")
            if estimated_trade >= min_trade and monthly_count[month_key] < max_monthly:
                weights = candidate
                monthly_count[month_key] += 1
                trades.append({"date": current_date.isoformat(), "amount": round(estimated_trade, 2), "weights": {k: round(v, 4) for k, v in weights.items()}})

        portfolio_return = 0.0
        for code, weight in weights.items():
            portfolio_return += weight * (series[code][next_date] / series[code][current_date] - 1)
        turnover = sum(abs(weights[code] - previous_weights[code]) for code in weights) / 2
        equity *= 1 + portfolio_return - turnover * (fee_rate + slippage)
        previous_weights = weights
        peak = max(peak, equity)
        drawdown = equity / peak - 1
        curve.append({"date": next_date.isoformat(), "equity": round(equity, 2), "drawdown": round(drawdown, 6)})

    returns = [curve[i]["equity"] / curve[i - 1]["equity"] - 1 for i in range(1, len(curve))]
    avg = sum(returns) / len(returns)
    variance = sum((value - avg) ** 2 for value in returns) / max(1, len(returns) - 1)
    max_drawdown = min(point["drawdown"] for point in curve)
    metrics = {
        "initial_capital": round(initial, 2),
        "final_equity": round(equity, 2),
        "total_return": round(equity / initial - 1, 6),
        "annualized_return": round((equity / initial) ** (252 / max(1, len(returns))) - 1, 6),
        "max_drawdown": round(max_drawdown, 6),
        "volatility": round((variance ** 0.5) * (252 ** 0.5), 6),
        "sharpe": round(avg / (variance ** 0.5) * (252 ** 0.5), 6) if variance > 0 else 0.0,
        "trade_count": len(trades),
        "constraint_max_drawdown": float(request["constraints"]["max_drawdown"]),
        "constraint_passed": abs(max_drawdown) <= float(request["constraints"]["max_drawdown"]),
    }
    warnings = []
    if not metrics["constraint_passed"]:
        warnings.append("历史回测最大回撤超过设定上限，不能视为合格策略。")
    if not trades:
        warnings.append("没有达到最低调仓金额或交易次数限制，结果可能接近现金持有。")
    return {"strategy": request["strategy"], "metrics": metrics, "equity_curve": curve, "trades": trades, "warnings": warnings}
