import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.db.session import Base, engine
import pytest

client = TestClient(app)


def setup_module(module):
    Base.metadata.create_all(bind=engine)


def test_health_check():
    """测试健康检查接口"""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print("✓ 健康检查接口测试通过")


def test_holdings_crud():
    """测试持仓 CRUD 接口"""
    # 1. 创建持仓
    create_data = {
        "platform": "alipay",
        "asset_type": "fund",
        "code": "000001",
        "name": "华夏成长混合",
        "quantity": 1000.50,
        "cost_price": 1.2500,
        "current_price": 1.3500,
        "industry": "混合型",
        "buy_date": "2024-01-15",
        "notes": "测试持仓"
    }
    response = client.post("/api/holdings", json=create_data)
    assert response.status_code == 200
    created = response.json()
    assert created["platform"] == "alipay"
    assert created["code"] == "000001"
    holding_id = created["id"]
    print(f"✓ 创建持仓成功 (ID: {holding_id})")

    # 2. 获取持仓列表
    response = client.get("/api/holdings")
    assert response.status_code == 200
    holdings = response.json()
    assert isinstance(holdings, list)
    assert len(holdings) >= 1
    print(f"✓ 获取持仓列表成功 (共 {len(holdings)} 条)")

    # 3. 按平台筛选
    response = client.get("/api/holdings?platform=alipay")
    assert response.status_code == 200
    filtered = response.json()
    assert all(h["platform"] == "alipay" for h in filtered)
    print("✓ 按平台筛选测试通过")

    # 4. 按资产类型筛选
    response = client.get("/api/holdings?asset_type=fund")
    assert response.status_code == 200
    filtered = response.json()
    assert all(h["asset_type"] == "fund" for h in filtered)
    print("✓ 按资产类型筛选测试通过")

    # 5. 获取单条持仓
    response = client.get(f"/api/holdings/{holding_id}")
    assert response.status_code == 200
    holding = response.json()
    assert holding["id"] == holding_id
    assert holding["name"] == "华夏成长混合"
    print("✓ 获取单条持仓测试通过")

    # 6. 更新持仓
    update_data = {
        "current_price": 1.5000,
        "quantity": 1500.00
    }
    response = client.put(f"/api/holdings/{holding_id}", json=update_data)
    assert response.status_code == 200
    updated = response.json()
    assert updated["current_price"] == 1.5
    assert updated["quantity"] == 1500
    print("✓ 更新持仓测试通过")

    # 7. 删除持仓
    response = client.delete(f"/api/holdings/{holding_id}")
    assert response.status_code == 200
    print("✓ 删除持仓测试通过")

    # 验证已删除
    response = client.get(f"/api/holdings/{holding_id}")
    assert response.status_code == 404
    print("✓ 验证删除成功")


def test_deposits_crud():
    """测试定期理财 CRUD 接口"""
    # 1. 创建定期
    create_data = {
        "bank": "cmb",
        "product_name": "朝朝宝",
        "principal": 50000.00,
        "annual_rate": 2.85,
        "start_date": "2024-01-01",
        "maturity_date": "2024-12-31",
        "expected_return": 1425.00,
        "status": "active",
        "notes": "测试定期"
    }
    response = client.post("/api/deposits", json=create_data)
    assert response.status_code == 200
    created = response.json()
    assert created["bank"] == "cmb"
    assert created["product_name"] == "朝朝宝"
    deposit_id = created["id"]
    print(f"✓ 创建定期理财成功 (ID: {deposit_id})")

    # 2. 获取定期列表
    response = client.get("/api/deposits")
    assert response.status_code == 200
    deposits = response.json()
    assert isinstance(deposits, list)
    assert len(deposits) >= 1
    print(f"✓ 获取定期理财列表成功 (共 {len(deposits)} 条)")

    # 3. 按状态筛选
    response = client.get("/api/deposits?status=active")
    assert response.status_code == 200
    filtered = response.json()
    assert all(d["status"] == "active" for d in filtered)
    print("✓ 按状态筛选测试通过")

    # 4. 获取单条定期
    response = client.get(f"/api/deposits/{deposit_id}")
    assert response.status_code == 200
    deposit = response.json()
    assert deposit["id"] == deposit_id
    assert deposit["product_name"] == "朝朝宝"
    print("✓ 获取单条定期理财测试通过")

    # 5. 更新定期
    update_data = {
        "status": "matured",
        "expected_return": 1500.00
    }
    response = client.put(f"/api/deposits/{deposit_id}", json=update_data)
    assert response.status_code == 200
    updated = response.json()
    assert updated["status"] == "matured"
    assert updated["expected_return"] == 1500
    print("✓ 更新定期理财测试通过")

    # 6. 删除定期
    response = client.delete(f"/api/deposits/{deposit_id}")
    assert response.status_code == 200
    print("✓ 删除定期理财测试通过")

    # 验证已删除
    response = client.get(f"/api/deposits/{deposit_id}")
    assert response.status_code == 404
    print("✓ 验证删除成功")


if __name__ == "__main__":
    print("=" * 50)
    print("开始测试 InvestHelper API")
    print("=" * 50)
    print()

    try:
        setup_module(None)
        test_health_check()
        print()
        test_holdings_crud()
        print()
        test_deposits_crud()
        print()
        print("=" * 50)
        print("所有测试通过！")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
