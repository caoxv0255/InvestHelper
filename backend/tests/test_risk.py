import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import Base, engine, SessionLocal
from app.models.holdings import Holding

Base.metadata.create_all(bind=engine)


def _clean_holdings():
    """清理已有持仓，避免测试数据互相影响"""
    db = SessionLocal()
    try:
        db.query(Holding).delete()
        db.commit()
    finally:
        db.close()


async def main():
    _clean_holdings()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 创建一只测试股票持仓
        create_data = {
            "platform": "ths",
            "asset_type": "stock",
            "code": "000001",
            "name": "平安银行",
            "quantity": 1000,
            "cost_price": 10.0,
            "current_price": 11.0,
            "industry": "银行",
            "buy_date": "2024-01-15",
            "notes": "风险分析测试持仓",
        }
        resp = await ac.post("/api/holdings", json=create_data)
        print("创建持仓状态:", resp.status_code)
        print("创建持仓返回:", resp.json())

        # 调用风险分析接口
        resp = await ac.get("/api/risk/analysis")
        print("风险分析状态:", resp.status_code)
        assert resp.status_code == 200, f"接口返回非 200: {resp.text}"

        data = resp.json()
        required_keys = [
            "industry_concentration",
            "correlation_matrix",
            "var",
            "risk_score",
            "largest_position",
            "summary",
            "factor_exposures",
            "factor_attribution",
            "factor_radar",
            "stock_betas",
            "warnings",
        ]
        missing = [k for k in required_keys if k not in data]
        print("缺失字段:", missing)
        print("因子暴露:", data.get("factor_exposures"))
        print("雷达图:", data.get("factor_radar"))
        print("归因:", data.get("factor_attribution"))
        print("个股 Beta:", data.get("stock_betas"))
        print("警告:", data.get("warnings"))
        assert not missing, f"返回缺少字段: {missing}"
        print("✓ 风险分析接口返回合法 JSON 且包含所有多因子字段")


if __name__ == "__main__":
    asyncio.run(main())
