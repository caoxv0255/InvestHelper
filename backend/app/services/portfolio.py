"""从交易流水重建组合快照。

第一版采用加权平均成本法；不同币种分开统计，不做隐含汇率换算。
"""
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.holdings import Holding
from app.models.transactions import Transaction
from app.models.portfolio_snapshots import PortfolioSnapshot


ZERO = Decimal("0")


def build_portfolio_snapshot(db: Session, as_of: date | None = None) -> dict:
    query = db.query(Transaction).order_by(Transaction.trade_date.asc(), Transaction.id.asc())
    if as_of:
        query = query.filter(Transaction.trade_date <= as_of)
    transactions = query.all()
    holdings = db.query(Holding).all()
    market_prices = {h.code: h.current_price for h in holdings if h.current_price is not None}

    states: dict[tuple[str, str, str], dict] = {}
    warnings: list[str] = []
    summary: dict[str, dict] = defaultdict(lambda: {
        "market_value": ZERO, "cost_basis": ZERO, "realized_profit": ZERO,
        "unrealized_profit": ZERO, "dividends": ZERO, "total_profit": ZERO,
        "net_deposit": ZERO,
    })
    for tx in transactions:
        quantity = Decimal(tx.quantity)
        price = Decimal(tx.price)
        fee = Decimal(tx.fee or ZERO)
        amount = quantity * price
        if tx.side in ("deposit", "withdraw"):
            if tx.side == "deposit":
                summary[tx.currency]["net_deposit"] += amount
            else:
                summary[tx.currency]["net_deposit"] -= amount
            continue
        key = (tx.account, tx.code, tx.currency)
        state = states.setdefault(key, {
            "account": tx.account, "asset_type": tx.asset_type, "code": tx.code,
            "name": tx.name, "currency": tx.currency, "quantity": ZERO,
            "cost_basis": ZERO, "realized_profit": ZERO, "dividends": ZERO,
        })
        if tx.side == "buy":
            state["cost_basis"] += amount + fee
            state["quantity"] += quantity
        elif tx.side == "sell":
            if state["quantity"] <= ZERO:
                warnings.append(f"{tx.trade_date} {tx.code} 卖出时没有可用持仓")
                continue
            sold = min(quantity, state["quantity"])
            average_cost = state["cost_basis"] / state["quantity"]
            state["realized_profit"] += sold * (price - average_cost) - fee
            state["cost_basis"] -= sold * average_cost
            state["quantity"] -= sold
            if sold < quantity:
                warnings.append(f"{tx.trade_date} {tx.code} 卖出数量超过流水重建持仓")
        elif tx.side == "dividend":
            state["dividends"] += amount - fee

    positions = []
    for state in states.values():
        quantity = state["quantity"]
        average_cost = state["cost_basis"] / quantity if quantity > ZERO else ZERO
        current_price = Decimal(market_prices.get(state["code"]) or average_cost)
        market_value = quantity * current_price
        unrealized = market_value - state["cost_basis"]
        total_profit = state["realized_profit"] + unrealized + state["dividends"]
        position = {**state, "average_cost": average_cost, "current_price": current_price,
                    "market_value": market_value, "unrealized_profit": unrealized,
                    "total_profit": total_profit}
        if quantity > ZERO or state["realized_profit"] != ZERO or state["dividends"] != ZERO:
            positions.append(_serialize(position))
            bucket = summary[state["currency"]]
            for field in ("market_value", "cost_basis", "realized_profit", "unrealized_profit", "dividends", "total_profit"):
                bucket[field] += position[field]

    risk_by_currency = {}
    for currency, values in summary.items():
        market_value = values["market_value"]
        currency_positions = [item for item in positions if item["currency"] == currency and item["market_value"] > 0]
        largest = max((item["market_value"] for item in currency_positions), default=ZERO)
        risk_by_currency[currency] = {
            "largest_position_weight": float(Decimal(str(largest)) / market_value) if market_value > ZERO else 0.0,
            "position_count": len(currency_positions),
            "market_value": float(market_value),
        }

    return {
        "as_of": (as_of or date.today()).isoformat(),
        "method": "weighted_average_cost",
        "positions": sorted(positions, key=lambda item: (-item["market_value"], item["code"])),
        "summary_by_currency": {currency: _serialize(values) for currency, values in summary.items()},
        "risk_by_currency": risk_by_currency,
        "transaction_count": len(transactions),
        "warnings": warnings,
    }


def capture_portfolio_snapshot(db: Session, snapshot_date: date | None = None) -> dict:
    snapshot_date = snapshot_date or date.today()
    data = build_portfolio_snapshot(db, snapshot_date)
    db.query(PortfolioSnapshot).filter(PortfolioSnapshot.snapshot_date == snapshot_date).delete()
    for currency, values in data["summary_by_currency"].items():
        positions = [item for item in data["positions"] if item["currency"] == currency]
        db.add(PortfolioSnapshot(
            snapshot_date=snapshot_date,
            currency=currency,
            market_value=values["market_value"],
            cost_basis=values["cost_basis"],
            total_profit=values["total_profit"],
            net_deposit=values.get("net_deposit", ZERO),
            positions=positions,
        ))
    db.commit()
    return {"snapshot_date": snapshot_date.isoformat(), "currency_count": len(data["summary_by_currency"]), "transaction_count": data["transaction_count"]}


def portfolio_history(db: Session, currency: str | None = None) -> dict:
    query = db.query(PortfolioSnapshot).order_by(PortfolioSnapshot.snapshot_date.asc())
    if currency:
        query = query.filter(PortfolioSnapshot.currency == currency)
    rows = query.all()
    grouped: dict[str, list] = defaultdict(list)
    for row in rows:
        grouped[row.currency].append({"date": row.snapshot_date.isoformat(), "market_value": float(row.market_value), "total_profit": float(row.total_profit)})
    result = {}
    for code, points in grouped.items():
        peak = 0.0
        max_drawdown = 0.0
        for point in points:
            peak = max(peak, point["market_value"])
            drawdown = point["market_value"] / peak - 1 if peak else 0.0
            point["drawdown"] = round(drawdown, 6)
            max_drawdown = min(max_drawdown, drawdown)
        first = points[0]["market_value"] if points else 0
        last = points[-1]["market_value"] if points else 0
        result[code] = {"points": points, "max_drawdown": round(max_drawdown, 6), "return": round(last / first - 1, 6) if first else 0.0}
    return {"currencies": result, "snapshot_count": len(rows)}


def _serialize(value):
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    if isinstance(value, Decimal):
        return round(float(value), 6)
    return value
