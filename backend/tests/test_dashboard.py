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