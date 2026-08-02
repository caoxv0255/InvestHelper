"""数据库模型 CRUD 测试

所有测试通过 conftest 的 db_session fixture（in-memory SQLite）实现隔离，
不再操作 ./invest_helper.db 真 DB。
"""
from datetime import datetime, timezone, date
from decimal import Decimal

from app.models import Holding, Deposit, UserSetting, News, Opportunity


def test_holdings_crud(db_session):
    """持仓表 CRUD"""
    # Create
    holding = Holding(
        platform="alipay",
        asset_type="fund",
        code="110011",
        name="易方达中小盘混合",
        quantity=Decimal("1000.50"),
        cost_price=Decimal("2.5000"),
        current_price=Decimal("2.8000"),
        industry="消费",
        buy_date=date(2024, 1, 15),
        notes="长期持有",
    )
    db_session.add(holding)
    db_session.commit()
    db_session.refresh(holding)
    assert holding.id is not None
    assert holding.name == "易方达中小盘混合"

    # Read
    result = db_session.query(Holding).filter(Holding.id == holding.id).first()
    assert result is not None
    assert result.name == "易方达中小盘混合"

    # Update
    result.current_price = Decimal("2.9000")
    result.notes = "长期持有，看好消费板块"
    db_session.commit()
    db_session.refresh(result)
    assert result.current_price == Decimal("2.9000")

    # Delete
    db_session.delete(result)
    db_session.commit()
    result = db_session.query(Holding).filter(Holding.id == holding.id).first()
    assert result is None


def test_deposits_crud(db_session):
    """定期理财表 CRUD"""
    deposit = Deposit(
        bank="cmb",
        product_name="招商银行朝朝宝",
        principal=Decimal("50000.00"),
        annual_rate=Decimal("2.5000"),
        start_date=date(2024, 1, 1),
        maturity_date=date(2025, 1, 1),
        expected_return=Decimal("1250.00"),
        status="active",
        notes="灵活存取",
    )
    db_session.add(deposit)
    db_session.commit()
    db_session.refresh(deposit)
    assert deposit.id is not None

    result = db_session.query(Deposit).filter(Deposit.id == deposit.id).first()
    assert result is not None
    assert result.product_name == "招商银行朝朝宝"

    result.status = "matured"
    db_session.commit()
    db_session.refresh(result)
    assert result.status == "matured"

    db_session.delete(result)
    db_session.commit()
    result = db_session.query(Deposit).filter(Deposit.id == deposit.id).first()
    assert result is None


def test_user_settings_crud(db_session):
    """用户设置表 CRUD"""
    setting = UserSetting(
        setting_key="risk_preference",
        setting_value={"level": "medium", "max_drawdown": "15%"},
    )
    db_session.add(setting)
    db_session.commit()
    db_session.refresh(setting)
    assert setting.id is not None

    result = db_session.query(UserSetting).filter(
        UserSetting.setting_key == "risk_preference"
    ).first()
    assert result is not None
    assert result.setting_value["level"] == "medium"

    result.setting_value = {"level": "high", "max_drawdown": "25%"}
    db_session.commit()
    db_session.refresh(result)
    assert result.setting_value["level"] == "high"

    db_session.delete(result)
    db_session.commit()
    result = db_session.query(UserSetting).filter(
        UserSetting.setting_key == "risk_preference"
    ).first()
    assert result is None


def test_news_crud(db_session):
    """快讯表 CRUD

    使用唯一 URL 避免与历史数据冲突；News 表有 UniqueConstraint('source','url')。
    """
    unique_url = "https://example.com/news/crud-test-001"
    news = News(
        source="eastmoney",
        title="央行宣布降准0.5个百分点",
        content="中国人民银行决定于2024年下调金融机构存款准备金率0.5个百分点...",
        url=unique_url,
        publish_time=datetime.now(timezone.utc),
        is_important=True,
        keywords=["降准", "央行", "货币政策"],
        content_hash="abc123",
    )
    db_session.add(news)
    db_session.commit()
    db_session.refresh(news)
    assert news.id is not None

    result = db_session.query(News).filter(News.id == news.id).first()
    assert result is not None
    assert result.title == "央行宣布降准0.5个百分点"

    result.is_important = False
    result.keywords = ["降准", "央行"]
    db_session.commit()
    db_session.refresh(result)
    assert result.is_important is False

    db_session.delete(result)
    db_session.commit()
    result = db_session.query(News).filter(News.id == news.id).first()
    assert result is None


def test_opportunities_crud(db_session):
    """投资机会表 CRUD"""
    opportunity = Opportunity(
        code="600519",
        name="贵州茅台",
        opportunity_type="tech_signal",
        score=Decimal("85.50"),
        price=Decimal("1680.0000"),
        reason={"signal": "MACD金叉", "rsi": "超卖", "support": "1650"},
        discovered_date=date(2024, 7, 28),
        status="active",
    )
    db_session.add(opportunity)
    db_session.commit()
    db_session.refresh(opportunity)
    assert opportunity.id is not None

    result = db_session.query(Opportunity).filter(Opportunity.id == opportunity.id).first()
    assert result is not None
    assert result.name == "贵州茅台"
    assert result.score == Decimal("85.50")

    result.status = "expired"
    result.score = Decimal("70.00")
    db_session.commit()
    db_session.refresh(result)
    assert result.status == "expired"

    db_session.delete(result)
    db_session.commit()
    result = db_session.query(Opportunity).filter(Opportunity.id == opportunity.id).first()
    assert result is None