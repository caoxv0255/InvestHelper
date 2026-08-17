"""仪表盘 API 集成测试

替代 backend/test_dashboard.py（散落根目录）+ 用 conftest fixtures。
"""
from typing import Any


def _cleanup_holdings(client: Any) -> None:
    """清理所有持仓（每个 test 自己清理）"""
    holdings = client.get("/api/holdings").json()
    for h in holdings:
        client.delete(f"/api/holdings/{h['id']}")


def _cleanup_deposits(client: Any) -> None:
    deposits = client.get("/api/deposits").json()
    for d in deposits:
        client.delete(f"/api/deposits/{d['id']}")


def test_dashboard_summary_with_mixed_portfolio(client):
    """混合平台 + 混合资产类型的仪表盘聚合测试"""
    holdings_payload = [
        {
            "platform": "alipay", "asset_type": "fund",
            "code": "000001", "name": "华夏成长混合",
            "quantity": 10000.00, "cost_price": 1.2500, "current_price": 1.3500,
            "industry": "混合型", "buy_date": "2024-01-15", "notes": "基金测试",
        },
        {
            "platform": "alipay", "asset_type": "stock",
            "code": "600519", "name": "贵州茅台",
            "quantity": 100.00, "cost_price": 1680.00, "current_price": 1750.00,
            "industry": "白酒", "buy_date": "2024-03-01", "notes": "股票测试",
        },
        {
            "platform": "cmb", "asset_type": "fund",
            "code": "110022", "name": "易方达消费行业",
            "quantity": 5000.00, "cost_price": 3.2000, "current_price": 3.1000,
            "industry": "消费行业", "buy_date": "2024-02-01", "notes": "招行基金",
        },
        {
            "platform": "ths", "asset_type": "stock",
            "code": "000001", "name": "平安银行",
            "quantity": 2000.00, "cost_price": 12.50, "current_price": 13.20,
            "industry": "银行", "buy_date": "2024-04-01", "notes": "同花顺股票",
        },
    ]
    deposits_payload = [
        {
            "bank": "cmb", "product_name": "朝朝宝",
            "principal": 50000.00, "annual_rate": 2.85,
            "start_date": "2024-01-01", "maturity_date": "2024-12-31",
            "expected_return": 1425.00, "status": "active",
            "notes": "定期测试1",
        },
        {
            "bank": "cmb", "product_name": "大额存单",
            "principal": 100000.00, "annual_rate": 3.20,
            "start_date": "2023-06-01", "maturity_date": "2024-06-01",
            "expected_return": 3200.00, "status": "active",
            "notes": "改 active 用于仪表盘主流程测试",
        },
    ]

    created_holding_ids: list[int] = []
    created_deposit_ids: list[int] = []
    try:
        for data in holdings_payload:
            r = client.post("/api/holdings", json=data)
            assert r.status_code == 200, r.text
            created_holding_ids.append(r.json()["id"])

        for data in deposits_payload:
            r = client.post("/api/deposits", json=data)
            assert r.status_code == 200, r.text
            created_deposit_ids.append(r.json()["id"])

        # 调用仪表盘接口
        response = client.get("/api/dashboard/summary")
        assert response.status_code == 200, response.text
        data = response.json()

        # 验证必需字段
        required_keys = [
            "total_assets", "total_profit", "total_profit_rate",
            "daily_profit", "weekly_profit", "monthly_profit", "yearly_profit",
            "holding_count", "deposit_count",
            "by_platform", "by_asset_type", "platform_comparison",
        ]
        for key in required_keys:
            assert key in data, f"缺失字段: {key}"

        # 数据一致性
        assert data["holding_count"] == len(holdings_payload)
        assert data["deposit_count"] == len(deposits_payload)
        assert len(data["by_platform"]) >= 1
        assert len(data["by_asset_type"]) >= 1
    finally:
        for hid in created_holding_ids:
            client.delete(f"/api/holdings/{hid}")
        for did in created_deposit_ids:
            client.delete(f"/api/deposits/{did}")


def test_dashboard_cash_flow_summary_basic(client):
    """资金流水汇总：入金后买入持仓，验证 real_return 按净入金占比正确分摊"""
    from datetime import date
    today_str = date.today().isoformat()

    # 1. 创建一笔入金流水 (deposit)
    r = client.post("/api/transactions", json={
        "account": "test", "asset_type": "cash", "code": "CNY", "name": "入金",
        "side": "deposit", "trade_date": "2025-01-01",
        "quantity": 100000, "price": 1, "fee": 0, "currency": "CNY",
    })
    assert r.status_code == 200, r.text

    # 2. 创建一笔持仓
    r = client.post("/api/holdings", json={
        "platform": "alipay", "asset_type": "stock",
        "code": "000001", "name": "平安银行",
        "quantity": 1000, "cost_price": 10, "current_price": 11,
        "industry": "银行", "buy_date": "2025-01-01", "notes": "测试",
    })
    assert r.status_code == 200, r.text
    holding_id = r.json()["id"]

    # 3. 创建一笔买入交易 (用于 portfolio snapshot 的利润计算)
    r = client.post("/api/transactions", json={
        "account": "test", "asset_type": "stock", "code": "000001", "name": "平安银行",
        "side": "buy", "trade_date": "2025-01-01",
        "quantity": 1000, "price": 10, "fee": 10, "currency": "CNY",
    })
    assert r.status_code == 200, r.text

    try:
        # 4. 调用仪表盘
        r = client.get("/api/dashboard/summary")
        assert r.status_code == 200, r.text
        data = r.json()

        # 5. 验证 cash_flow_summary
        cfs = data["cash_flow_summary"]
        assert len(cfs) == 1, f"应有 1 个币种的汇总, 实际: {len(cfs)}"
        cny = cfs[0]
        assert cny["currency"] == "CNY"
        assert float(cny["total_deposit"]) == 100000
        assert float(cny["total_withdraw"]) == 0
        assert float(cny["net_deposit"]) == 100000
        # 有持仓利润 (current_price > cost_price), real_return 应大于 0
        assert float(cny["real_return"]) > 0, "持有盈利币种的 real_return 应大于 0"
    finally:
        client.delete(f"/api/holdings/{holding_id}")


def test_dashboard_cash_flow_summary_net_withdraw(client):
    """资金流水汇总：出金大于入金时 real_return 仍正确（回归：之前被 total_net_deposit>0 误判为0）"""
    from datetime import date

    # 1. 创建两笔入金流水（共 100000）
    for side, qty in [("deposit", 60000), ("deposit", 40000)]:
        r = client.post("/api/transactions", json={
            "account": "test", "asset_type": "cash", "code": "CNY", "name": "入金",
            "side": side, "trade_date": "2025-01-01",
            "quantity": qty, "price": 1, "fee": 0, "currency": "CNY",
        })
        assert r.status_code == 200, r.text

    # 2. 创建一笔出金（出金 120000，净入金 = -20000）
    r = client.post("/api/transactions", json={
        "account": "test", "asset_type": "cash", "code": "CNY", "name": "出金",
        "side": "withdraw", "trade_date": "2025-03-01",
        "quantity": 120000, "price": 1, "fee": 0, "currency": "CNY",
    })
    assert r.status_code == 200, r.text

    # 3. 创建持仓和买入交易
    r = client.post("/api/holdings", json={
        "platform": "alipay", "asset_type": "stock",
        "code": "000001", "name": "平安银行",
        "quantity": 1000, "cost_price": 10, "current_price": 11,
        "industry": "银行", "buy_date": "2025-01-01", "notes": "测试",
    })
    assert r.status_code == 200, r.text
    holding_id = r.json()["id"]

    r = client.post("/api/transactions", json={
        "account": "test", "asset_type": "stock", "code": "000001", "name": "平安银行",
        "side": "buy", "trade_date": "2025-01-01",
        "quantity": 1000, "price": 10, "fee": 10, "currency": "CNY",
    })
    assert r.status_code == 200, r.text

    try:
        r = client.get("/api/dashboard/summary")
        assert r.status_code == 200, r.text
        data = r.json()

        cfs = data["cash_flow_summary"]
        assert len(cfs) == 1
        cny = cfs[0]
        assert cny["currency"] == "CNY"
        assert float(cny["total_deposit"]) == 100000
        assert float(cny["total_withdraw"]) == 120000
        assert float(cny["net_deposit"]) == -20000

        # 核心回归断言：出金大于入金时 real_return 不应被错误归零
        assert float(cny["real_return"]) != 0, \
            "BUG 回归：净出金 > 0 时 real_return 不应为 0"
    finally:
        client.delete(f"/api/holdings/{holding_id}")