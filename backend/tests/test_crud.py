"""数据库模型 CRUD 测试脚本"""
import sys
import os
from datetime import datetime, timezone, date
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal, engine, Base
from app.models import Holding, Deposit, UserSetting, News, Opportunity


def test_holdings_crud():
    """测试持仓表 CRUD 操作"""
    print("\n" + "=" * 60)
    print("测试持仓表 (holdings) CRUD 操作")
    print("=" * 60)

    db = SessionLocal()

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
        notes="长期持有"
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    print(f"✓ 创建持仓成功: id={holding.id}, name={holding.name}")

    # Read
    result = db.query(Holding).filter(Holding.id == holding.id).first()
    assert result is not None
    assert result.name == "易方达中小盘混合"
    print(f"✓ 读取持仓成功: {result.code} - {result.name}")

    # Update
    result.current_price = Decimal("2.9000")
    result.notes = "长期持有，看好消费板块"
    db.commit()
    db.refresh(result)
    assert result.current_price == Decimal("2.9000")
    print(f"✓ 更新持仓成功: current_price={result.current_price}")

    # Delete
    db.delete(result)
    db.commit()
    result = db.query(Holding).filter(Holding.id == holding.id).first()
    assert result is None
    print("✓ 删除持仓成功")

    db.close()


def test_deposits_crud():
    """测试定期理财表 CRUD 操作"""
    print("\n" + "=" * 60)
    print("测试定期理财表 (deposits) CRUD 操作")
    print("=" * 60)

    db = SessionLocal()

    # Create
    deposit = Deposit(
        bank="cmb",
        product_name="招商银行朝朝宝",
        principal=Decimal("50000.00"),
        annual_rate=Decimal("2.5000"),
        start_date=date(2024, 1, 1),
        maturity_date=date(2025, 1, 1),
        expected_return=Decimal("1250.00"),
        status="active",
        notes="灵活存取"
    )
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    print(f"✓ 创建定期理财成功: id={deposit.id}, name={deposit.product_name}")

    # Read
    result = db.query(Deposit).filter(Deposit.id == deposit.id).first()
    assert result is not None
    assert result.product_name == "招商银行朝朝宝"
    print(f"✓ 读取定期理财成功: {result.bank} - {result.product_name}")

    # Update
    result.status = "matured"
    db.commit()
    db.refresh(result)
    assert result.status == "matured"
    print(f"✓ 更新定期理财成功: status={result.status}")

    # Delete
    db.delete(result)
    db.commit()
    result = db.query(Deposit).filter(Deposit.id == deposit.id).first()
    assert result is None
    print("✓ 删除定期理财成功")

    db.close()


def test_user_settings_crud():
    """测试用户设置表 CRUD 操作"""
    print("\n" + "=" * 60)
    print("测试用户设置表 (user_settings) CRUD 操作")
    print("=" * 60)

    db = SessionLocal()

    # Create
    setting = UserSetting(
        setting_key="risk_preference",
        setting_value={"level": "medium", "max_drawdown": "15%"}
    )
    db.add(setting)
    db.commit()
    db.refresh(setting)
    print(f"✓ 创建用户设置成功: id={setting.id}, key={setting.setting_key}")

    # Read
    result = db.query(UserSetting).filter(UserSetting.setting_key == "risk_preference").first()
    assert result is not None
    assert result.setting_value["level"] == "medium"
    print(f"✓ 读取用户设置成功: {result.setting_key} = {result.setting_value}")

    # Update
    result.setting_value = {"level": "high", "max_drawdown": "25%"}
    db.commit()
    db.refresh(result)
    assert result.setting_value["level"] == "high"
    print(f"✓ 更新用户设置成功: {result.setting_value}")

    # Delete
    db.delete(result)
    db.commit()
    result = db.query(UserSetting).filter(UserSetting.setting_key == "risk_preference").first()
    assert result is None
    print("✓ 删除用户设置成功")

    db.close()


def test_news_crud():
    """测试快讯表 CRUD 操作"""
    print("\n" + "=" * 60)
    print("测试快讯表 (news) CRUD 操作")
    print("=" * 60)

    db = SessionLocal()

    # Create
    news = News(
        source="eastmoney",
        title="央行宣布降准0.5个百分点",
        content="中国人民银行决定于2024年下调金融机构存款准备金率0.5个百分点...",
        url="https://example.com/news/1",
        publish_time=datetime.now(timezone.utc),
        is_important=True,
        keywords=["降准", "央行", "货币政策"],
        content_hash="abc123"
    )
    db.add(news)
    db.commit()
    db.refresh(news)
    print(f"✓ 创建快讯成功: id={news.id}, title={news.title}")

    # Read
    result = db.query(News).filter(News.id == news.id).first()
    assert result is not None
    assert result.title == "央行宣布降准0.5个百分点"
    print(f"✓ 读取快讯成功: {result.source} - {result.title}")

    # Update
    result.is_important = False
    result.keywords = ["降准", "央行"]
    db.commit()
    db.refresh(result)
    assert result.is_important is False
    print(f"✓ 更新快讯成功: is_important={result.is_important}")

    # Delete
    db.delete(result)
    db.commit()
    result = db.query(News).filter(News.id == news.id).first()
    assert result is None
    print("✓ 删除快讯成功")

    db.close()


def test_opportunities_crud():
    """测试投资机会表 CRUD 操作"""
    print("\n" + "=" * 60)
    print("测试投资机会表 (opportunities) CRUD 操作")
    print("=" * 60)

    db = SessionLocal()

    # Create
    opportunity = Opportunity(
        code="600519",
        name="贵州茅台",
        opportunity_type="tech_signal",
        score=Decimal("85.50"),
        price=Decimal("1680.0000"),
        reason={"signal": "MACD金叉", "rsi": "超卖", "support": "1650"},
        discovered_date=date(2024, 7, 28),
        status="active"
    )
    db.add(opportunity)
    db.commit()
    db.refresh(opportunity)
    print(f"✓ 创建投资机会成功: id={opportunity.id}, name={opportunity.name}")

    # Read
    result = db.query(Opportunity).filter(Opportunity.id == opportunity.id).first()
    assert result is not None
    assert result.name == "贵州茅台"
    print(f"✓ 读取投资机会成功: {result.code} - {result.name}, score={result.score}")

    # Update
    result.status = "expired"
    result.score = Decimal("70.00")
    db.commit()
    db.refresh(result)
    assert result.status == "expired"
    print(f"✓ 更新投资机会成功: status={result.status}, score={result.score}")

    # Delete
    db.delete(result)
    db.commit()
    result = db.query(Opportunity).filter(Opportunity.id == opportunity.id).first()
    assert result is None
    print("✓ 删除投资机会成功")

    db.close()


def main():
    """主测试函数"""
    print("=" * 60)
    print("开始数据库模型 CRUD 测试")
    print(f"数据库: {engine.url}")
    print("=" * 60)

    # 确保所有表都已创建
    Base.metadata.create_all(bind=engine)
    print("✓ 数据库表创建/验证成功")

    # 运行各个模型的 CRUD 测试
    test_holdings_crud()
    test_deposits_crud()
    test_user_settings_crud()
    test_news_crud()
    test_opportunities_crud()

    print("\n" + "=" * 60)
    print("所有测试通过！✓")
    print("=" * 60)


if __name__ == "__main__":
    main()
