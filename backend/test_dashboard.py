import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import Base, engine

client = TestClient(app)


def setup_module():
    Base.metadata.create_all(bind=engine)


def test_dashboard_summary():
    """测试仪表盘汇总接口"""
    setup_module()

    holding_data = [
        {
            "platform": "alipay",
            "asset_type": "fund",
            "code": "000001",
            "name": "华夏成长混合",
            "quantity": 10000.00,
            "cost_price": 1.2500,
            "current_price": 1.3500,
            "industry": "混合型",
            "buy_date": "2024-01-15",
            "notes": "基金测试"
        },
        {
            "platform": "alipay",
            "asset_type": "stock",
            "code": "600519",
            "name": "贵州茅台",
            "quantity": 100.00,
            "cost_price": 1680.00,
            "current_price": 1750.00,
            "industry": "白酒",
            "buy_date": "2024-03-01",
            "notes": "股票测试"
        },
        {
            "platform": "cmb",
            "asset_type": "fund",
            "code": "110022",
            "name": "易方达消费行业",
            "quantity": 5000.00,
            "cost_price": 3.2000,
            "current_price": 3.1000,
            "industry": "消费行业",
            "buy_date": "2024-02-01",
            "notes": "招行基金"
        },
        {
            "platform": "ths",
            "asset_type": "stock",
            "code": "000001",
            "name": "平安银行",
            "quantity": 2000.00,
            "cost_price": 12.50,
            "current_price": 13.20,
            "industry": "银行",
            "buy_date": "2024-04-01",
            "notes": "同花顺股票"
        }
    ]

    deposit_data = [
        {
            "bank": "cmb",
            "product_name": "朝朝宝",
            "principal": 50000.00,
            "annual_rate": 2.85,
            "start_date": "2024-01-01",
            "maturity_date": "2024-12-31",
            "expected_return": 1425.00,
            "status": "active",
            "notes": "定期测试1"
        },
        {
            "bank": "cmb",
            "product_name": "大额存单",
            "principal": 100000.00,
            "annual_rate": 3.20,
            "start_date": "2023-06-01",
            "maturity_date": "2024-06-01",
            "expected_return": 3200.00,
            "status": "matured",
            "notes": "已到期定期"
        }
    ]

    created_holdings = []
    created_deposits = []

    try:
        for data in holding_data:
            response = client.post("/api/holdings", json=data)
            assert response.status_code == 200
            created_holdings.append(response.json())
        print(f"✓ 创建测试持仓成功 (共 {len(created_holdings)} 条)")

        for data in deposit_data:
            response = client.post("/api/deposits", json=data)
            assert response.status_code == 200
            created_deposits.append(response.json())
        print(f"✓ 创建测试定期成功 (共 {len(created_deposits)} 条)")

        print()
        print("调用仪表盘接口...")
        response = client.get("/api/dashboard/summary")
        assert response.status_code == 200
        data = response.json()

        print()
        print("=" * 60)
        print("仪表盘数据")
        print("=" * 60)
        print(f"总资产: {data['total_assets']}")
        print(f"总收益: {data['total_profit']}")
        print(f"总收益率: {data['total_profit_rate']}%")
        print(f"日收益: {data['daily_profit']}")
        print(f"周收益: {data['weekly_profit']}")
        print(f"月收益: {data['monthly_profit']}")
        print(f"年收益: {data['yearly_profit']}")
        print(f"持仓数量: {data['holding_count']}")
        print(f"定期数量: {data['deposit_count']}")
        print()
        print("按平台分布:")
        for item in data['by_platform']:
            print(f"  {item['name']}: {item['value']}")
        print()
        print("按资产类型分布:")
        for item in data['by_asset_type']:
            print(f"  {item['name']}: {item['value']}")
        print()
        print("各平台收益对比:")
        for item in data['platform_comparison']:
            print(f"  {item['platform']}: 总资产={item['total_value']}, 收益={item['profit']}, 收益率={item['profit_rate']}%, 年化={item['annualized_rate']}%")
        print()
        print("=" * 60)
        print("✓ 仪表盘接口测试通过！")
        print("=" * 60)

    finally:
        for h in created_holdings:
            client.delete(f"/api/holdings/{h['id']}")
        for d in created_deposits:
            client.delete(f"/api/deposits/{d['id']}")
        print()
        print("✓ 测试数据已清理")


if __name__ == "__main__":
    print("=" * 60)
    print("测试仪表盘 API")
    print("=" * 60)
    print()

    try:
        test_dashboard_summary()
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
