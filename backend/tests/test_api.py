"""API 集成测试

替代 backend/test_api.py（散落根目录）+ 用 conftest fixtures 实现测试隔离。
涵盖：health + holdings CRUD + deposits CRUD。
"""
from decimal import Decimal


def test_health_check(client):
    """健康检查接口"""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_holdings_full_crud(client, db_session):
    """持仓 CRUD 全流程：create → list → get → update → delete → 验证 404"""
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
        "notes": "测试持仓",
    }
    # 1. Create
    response = client.post("/api/holdings", json=create_data)
    assert response.status_code == 200, response.text
    created = response.json()
    assert created["platform"] == "alipay"
    assert created["code"] == "000001"
    holding_id = created["id"]

    # 2. List
    response = client.get("/api/holdings")
    assert response.status_code == 200
    holdings = response.json()
    assert isinstance(holdings, list)
    assert any(h["id"] == holding_id for h in holdings)

    # 3. Filter by platform
    response = client.get("/api/holdings?platform=alipay")
    assert response.status_code == 200
    assert all(h["platform"] == "alipay" for h in response.json())

    # 4. Filter by asset_type
    response = client.get("/api/holdings?asset_type=fund")
    assert response.status_code == 200
    assert all(h["asset_type"] == "fund" for h in response.json())

    # 5. Get one
    response = client.get(f"/api/holdings/{holding_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "华夏成长混合"

    # 6. Update
    update_data = {"current_price": 1.5000, "quantity": 1500.00}
    response = client.put(f"/api/holdings/{holding_id}", json=update_data)
    assert response.status_code == 200
    updated = response.json()
    assert Decimal(str(updated["current_price"])) == Decimal("1.5")
    assert Decimal(str(updated["quantity"])) == Decimal("1500")

    # 7. Delete
    response = client.delete(f"/api/holdings/{holding_id}")
    assert response.status_code == 200

    # 8. Verify 404
    response = client.get(f"/api/holdings/{holding_id}")
    assert response.status_code == 404


def test_deposits_full_crud(client):
    """定期理财 CRUD 全流程"""
    create_data = {
        "bank": "cmb",
        "product_name": "朝朝宝",
        "principal": 50000.00,
        "annual_rate": 2.85,
        "start_date": "2024-01-01",
        "maturity_date": "2024-12-31",
        "expected_return": 1425.00,
        "status": "active",
        "notes": "测试定期",
    }
    # Create
    response = client.post("/api/deposits", json=create_data)
    assert response.status_code == 200
    created = response.json()
    assert created["bank"] == "cmb"
    deposit_id = created["id"]

    # List
    response = client.get("/api/deposits")
    assert response.status_code == 200
    assert any(d["id"] == deposit_id for d in response.json())

    # Filter by status
    response = client.get("/api/deposits?status=active")
    assert response.status_code == 200
    assert all(d["status"] == "active" for d in response.json())

    # Get one
    response = client.get(f"/api/deposits/{deposit_id}")
    assert response.status_code == 200
    assert response.json()["product_name"] == "朝朝宝"

    # Update
    update_data = {"status": "matured", "expected_return": 1500.00}
    response = client.put(f"/api/deposits/{deposit_id}", json=update_data)
    assert response.status_code == 200
    assert response.json()["status"] == "matured"

    # Delete + verify
    response = client.delete(f"/api/deposits/{deposit_id}")
    assert response.status_code == 200
    response = client.get(f"/api/deposits/{deposit_id}")
    assert response.status_code == 404