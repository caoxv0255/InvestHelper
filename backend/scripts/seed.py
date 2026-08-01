"""种子数据脚本

向数据库写入一批样例持仓/定期/交易流水/新闻/机会，让新用户启动后立即能看到
所有 12 个页面的非空效果。可重复运行：第二次运行会清空所有表后重新写入。

用法（在 backend 目录下）：
    python -m scripts.seed
    python -m scripts.seed --keep   # 不清空，追加
"""
import argparse
import sys
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import delete

from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.models.deposits import Deposit
from app.models.holdings import Holding
from app.models.news import News
from app.models.opportunities import Opportunity
from app.models.portfolio_snapshots import PortfolioSnapshot
from app.models.transactions import Transaction
from app.models.user_settings import UserSetting


SAMPLE_HOLDINGS = [
    {
        "platform": "alipay",
        "asset_type": "fund",
        "code": "161725",
        "name": "招商中证白酒指数(LOF)A",
        "quantity": Decimal("1500.00"),
        "cost_price": Decimal("1.1230"),
        "current_price": Decimal("0.9800"),
        "industry": "食品饮料",
        "buy_date": date.today() - timedelta(days=180),
        "take_profit_price": Decimal("1.3500"),
        "stop_loss_price": Decimal("0.8800"),
        "notes": "白酒主题长线",
    },
    {
        "platform": "ths",
        "asset_type": "stock",
        "code": "600519",
        "name": "贵州茅台",
        "quantity": Decimal("20.00"),
        "cost_price": Decimal("1680.00"),
        "current_price": Decimal("1520.00"),
        "industry": "食品饮料",
        "buy_date": date.today() - timedelta(days=120),
        "take_profit_price": Decimal("2100.00"),
        "stop_loss_price": Decimal("1400.00"),
    },
    {
        "platform": "alipay",
        "asset_type": "fund",
        "code": "005827",
        "name": "易方达蓝筹精选混合",
        "quantity": Decimal("800.00"),
        "cost_price": Decimal("2.4510"),
        "current_price": Decimal("2.1500"),
        "industry": "混合",
        "buy_date": date.today() - timedelta(days=90),
    },
    {
        "platform": "cmb",
        "asset_type": "stock",
        "code": "000858",
        "name": "五粮液",
        "quantity": Decimal("100.00"),
        "cost_price": Decimal("165.00"),
        "current_price": Decimal("148.50"),
        "industry": "食品饮料",
        "buy_date": date.today() - timedelta(days=60),
    },
    {
        "platform": "ths",
        "asset_type": "stock",
        "code": "300750",
        "name": "宁德时代",
        "quantity": Decimal("50.00"),
        "cost_price": Decimal("195.00"),
        "current_price": Decimal("210.00"),
        "industry": "新能源",
        "buy_date": date.today() - timedelta(days=30),
    },
]

SAMPLE_DEPOSITS = [
    {
        "bank": "cmb",
        "product_name": "招商银行 3 个月定期",
        "principal": Decimal("50000.00"),
        "annual_rate": Decimal("0.0185"),
        "start_date": date.today() - timedelta(days=30),
        "maturity_date": date.today() + timedelta(days=60),
        "expected_return": Decimal("230.00"),
        "status": "active",
    },
    {
        "bank": "alipay",
        "product_name": "支付宝 30 天定期",
        "principal": Decimal("20000.00"),
        "annual_rate": Decimal("0.0210"),
        "start_date": date.today() - timedelta(days=10),
        "maturity_date": date.today() + timedelta(days=20),
        "expected_return": Decimal("35.00"),
        "status": "active",
    },
]

SAMPLE_TRANSACTIONS = [
    {"account": "alipay", "asset_type": "fund", "code": "161725", "name": "招商白酒LOF",
     "side": "buy", "trade_date": date.today() - timedelta(days=180),
     "quantity": Decimal("1500"), "price": Decimal("1.123"), "fee": Decimal("1.5"), "currency": "CNY"},
    {"account": "ths", "asset_type": "stock", "code": "600519", "name": "贵州茅台",
     "side": "buy", "trade_date": date.today() - timedelta(days=120),
     "quantity": Decimal("20"), "price": Decimal("1680"), "fee": Decimal("20"), "currency": "CNY"},
    {"account": "alipay", "asset_type": "fund", "code": "005827", "name": "易方达蓝筹",
     "side": "buy", "trade_date": date.today() - timedelta(days=90),
     "quantity": Decimal("800"), "price": Decimal("2.451"), "fee": Decimal("1.5"), "currency": "CNY"},
    {"account": "cmb", "asset_type": "stock", "code": "000858", "name": "五粮液",
     "side": "buy", "trade_date": date.today() - timedelta(days=60),
     "quantity": Decimal("100"), "price": Decimal("165"), "fee": Decimal("15"), "currency": "CNY"},
    {"account": "ths", "asset_type": "stock", "code": "300750", "name": "宁德时代",
     "side": "buy", "trade_date": date.today() - timedelta(days=30),
     "quantity": Decimal("50"), "price": Decimal("195"), "fee": Decimal("10"), "currency": "CNY"},
]

SAMPLE_NEWS = [
    {"source": "eastmoney", "title": "央行宣布降准 0.25 个百分点", "content": "中国人民银行决定下调存款准备金率 0.25 个百分点。",
     "url": "https://example.com/news/1", "publish_time": date.today() - timedelta(days=1),
     "is_important": True, "keywords": ["央行", "降准"]},
    {"source": "ths", "title": "新能源汽车销量再创新高", "content": "5 月份新能源汽车销量同比增长 38%。",
     "url": "https://example.com/news/2", "publish_time": date.today() - timedelta(days=2),
     "is_important": False, "keywords": ["新能源", "销量"]},
    {"source": "sina", "title": "白酒板块震荡整理", "content": "白酒板块近一周累计下跌 2.1%。",
     "url": "https://example.com/news/3", "publish_time": date.today() - timedelta(days=3),
     "is_important": False, "keywords": ["白酒"]},
]

SAMPLE_OPPORTUNITIES = [
    {"code": "300750", "name": "宁德时代", "opportunity_type": "tech_signal", "score": 82.5,
     "price": Decimal("210.00"), "reason": {"indicator": "MACD 金叉 + 量能放大"},
     "discovered_date": date.today(), "status": "active"},
    {"code": "600519", "name": "贵州茅台", "opportunity_type": "fund_flow", "score": 76.0,
     "price": Decimal("1520.00"), "reason": {"flow": "北向资金近 5 日净买入"},
     "discovered_date": date.today() - timedelta(days=2), "status": "active"},
    {"code": "000858", "name": "五粮液", "opportunity_type": "sector_momentum", "score": 70.0,
     "price": Decimal("148.50"), "reason": {"sector": "食品饮料近 5 日涨跌幅排名前 10"},
     "discovered_date": date.today() - timedelta(days=3), "status": "watched"},
]

SAMPLE_SETTINGS = [
    {"setting_key": "risk_tolerance", "setting_value": {"value": 0.02}},
    {"setting_key": "default_currency", "setting_value": {"value": "CNY"}},
]


def _wipe(db) -> None:
    """清空所有表数据（保留 schema）"""
    for model in (PortfolioSnapshot, Opportunity, News, Transaction, Deposit, Holding, UserSetting):
        db.execute(delete(model))
    db.commit()


def seed(keep: bool = False) -> None:
    init_db()
    db = SessionLocal()
    try:
        if not keep:
            _wipe(db)

        for item in SAMPLE_HOLDINGS:
            db.add(Holding(**item))
        for item in SAMPLE_DEPOSITS:
            db.add(Deposit(**item))
        for item in SAMPLE_TRANSACTIONS:
            db.add(Transaction(**item))
        for item in SAMPLE_NEWS:
            db.add(News(**item))
        for item in SAMPLE_OPPORTUNITIES:
            db.add(Opportunity(**item))
        for item in SAMPLE_SETTINGS:
            existing = db.query(UserSetting).filter_by(setting_key=item["setting_key"]).first()
            if existing:
                existing.setting_value = item["setting_value"]
            else:
                db.add(UserSetting(**item))
        db.commit()
        print(
            f"[seed] 已写入 {len(SAMPLE_HOLDINGS)} 条持仓, "
            f"{len(SAMPLE_DEPOSITS)} 条定期, {len(SAMPLE_TRANSACTIONS)} 条交易, "
            f"{len(SAMPLE_NEWS)} 条新闻, {len(SAMPLE_OPPORTUNITIES)} 条机会, "
            f"{len(SAMPLE_SETTINGS)} 条设置。"
        )
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="写入样例数据")
    parser.add_argument("--keep", action="store_true", help="不清空已有数据，直接追加")
    args = parser.parse_args()
    seed(keep=args.keep)
    return 0


if __name__ == "__main__":
    sys.exit(main())