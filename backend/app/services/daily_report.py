from datetime import date
from sqlalchemy.orm import Session

from app.services.portfolio import build_portfolio_snapshot, portfolio_history


def build_daily_report(db: Session) -> dict:
    snapshot = build_portfolio_snapshot(db)
    history = portfolio_history(db)
    attention: list[str] = list(snapshot["warnings"])
    for currency, risk in snapshot["risk_by_currency"].items():
        if risk["largest_position_weight"] > 0.30:
            attention.append(f"{currency} 最大单标的仓位为 {risk['largest_position_weight']:.1%}，超过默认 30% 上限")
        history_item = history["currencies"].get(currency)
        if history_item and abs(history_item["max_drawdown"]) > 0.20:
            attention.append(f"{currency} 历史最大回撤为 {history_item['max_drawdown']:.1%}，超过 20% 约束")
    return {
        "report_date": date.today().isoformat(),
        "title": "InvestHelper 每日投资报告",
        "transaction_count": snapshot["transaction_count"],
        "positions": snapshot["positions"],
        "risk_by_currency": snapshot["risk_by_currency"],
        "history": history,
        "attention": attention,
        "disclaimer": "本报告仅用于辅助分析，不构成投资建议。",
    }
