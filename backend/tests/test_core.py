"""核心业务逻辑单元测试（无需启动 FastAPI server）

涵盖：
- MemoryCache LRU 淘汰行为
- dashboard._calc_period_profits 基于快照差分计算真实周期收益
- sentiment composite history_note 字段存在

运行：
    cd backend
    python -m tests.test_core
"""
import sys
import os
from datetime import date, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.models.portfolio_snapshots import PortfolioSnapshot
from app.api.dashboard import _calc_period_profits
from app.services.cache import MemoryCache


def test_memory_cache_lru_eviction():
    """LRU 上限：超出 max_size 时淘汰最旧条目"""
    cache = MemoryCache(max_size=3)
    cache.set("a", 1, ttl=60)
    cache.set("b", 2, ttl=60)
    cache.set("c", 3, ttl=60)
    cache.set("d", 4, ttl=60)  # 应淘汰 a
    assert cache.get("a") is None
    assert cache.get("b") == 2
    assert cache.get("d") == 4
    stats = cache.stats()
    assert stats["size"] == 3
    assert stats["max_size"] == 3
    print("✓ MemoryCache LRU 淘汰行为正确")


def test_memory_cache_get_marks_recent():
    """LRU 语义：get 后该 key 应移至末尾，避免被淘汰"""
    cache = MemoryCache(max_size=3)
    cache.set("a", 1, ttl=60)
    cache.set("b", 2, ttl=60)
    cache.set("c", 3, ttl=60)
    # 触发 a 的"最近使用"
    assert cache.get("a") == 1
    cache.set("d", 4, ttl=60)  # 应淘汰 b（最旧）
    assert cache.get("a") == 1
    assert cache.get("b") is None
    print("✓ MemoryCache LRU 访问语义正确")


def test_memory_cache_ttl_expiry():
    """过期条目被清理"""
    cache = MemoryCache(max_size=10)
    cache.set("k", "v", ttl=1)
    import time
    time.sleep(1.2)
    assert cache.get("k") is None
    print("✓ MemoryCache TTL 过期清理正确")


def test_dashboard_period_profits_with_snapshots():
    """基于快照差分计算真实周期收益"""
    init_db()
    db = SessionLocal()
    try:
        today = date.today()
        # 先清理已有快照，避免唯一约束冲突
        db.query(PortfolioSnapshot).delete()
        db.commit()

        # 写入 3 份历史快照：1 周前、1 月前、1 年前
        for days_ago, market_value in [(7, 90000), (30, 80000), (365, 50000)]:
            snap = PortfolioSnapshot(
                snapshot_date=today - timedelta(days=days_ago),
                currency="CNY",
                market_value=Decimal(market_value),
                cost_basis=Decimal(market_value),
                total_profit=Decimal("0"),
                positions=[],
            )
            db.add(snap)
        db.commit()

        # 当前总资产 100000，应得到 weekly=10000/monthly=20000/yearly=50000
        # daily 没有 1 天前的快照，可能取到 7 天前那份（即 weekly 的同一份），因此 daily==weekly 也算合理
        daily, weekly, monthly, yearly, status = _calc_period_profits(
            db, today,
            holding_market_value=Decimal("80000"),
            deposit_principal=Decimal("20000"),
            deposit_earned=Decimal("0"),
        )
        # weekly: 100000 - 90000 = 10000
        assert weekly == Decimal("10000"), f"weekly={weekly}"
        # monthly: 100000 - 80000 = 20000
        assert monthly == Decimal("20000"), f"monthly={monthly}"
        # yearly: 100000 - 50000 = 50000
        assert yearly == Decimal("50000"), f"yearly={yearly}"
        assert status["weekly"]["available"] is True
        assert status["monthly"]["available"] is True
        assert status["yearly"]["available"] is True
        # data_status 中应能追溯到对应 baseline_value
        assert status["weekly"]["baseline_value"] == "90000.000000"
        print("✓ _calc_period_profits 基于快照差分计算正确")

        # 清理：避免污染后续测试
        db.query(PortfolioSnapshot).delete()
        db.commit()
    finally:
        db.close()


def test_dashboard_period_profits_without_snapshots():
    """无快照时应全部为 0 且 data_status 标记 available=False"""
    init_db()
    db = SessionLocal()
    try:
        today = date.today()
        daily, weekly, monthly, yearly, status = _calc_period_profits(
            db, today,
            holding_market_value=Decimal("50000"),
            deposit_principal=Decimal("0"),
            deposit_earned=Decimal("0"),
        )
        assert daily == Decimal("0")
        assert weekly == Decimal("0")
        assert monthly == Decimal("0")
        assert yearly == Decimal("0")
        assert status["daily"]["available"] is False
        assert status["weekly"]["available"] is False
        assert status["monthly"]["available"] is False
        assert status["yearly"]["available"] is False
        print("✓ _calc_period_profits 无快照时正确返回零值与不可用状态")
    finally:
        db.close()


def test_sentiment_history_note():
    """情绪 history_note 字段为非空说明文字"""
    from app.services.sentiment import calculate_composite_sentiment
    result = calculate_composite_sentiment()
    assert "history" in result
    assert result.get("history_method") == "hs300_price_percentile"
    assert result.get("history_note"), "history_note 必须非空"
    assert "代理" in result["history_note"]
    print("✓ sentiment composite 返回 history_method/history_note 字段")


def main():
    print("=" * 60)
    print("核心业务逻辑单元测试")
    print("=" * 60)
    test_memory_cache_lru_eviction()
    test_memory_cache_get_marks_recent()
    test_memory_cache_ttl_expiry()
    test_dashboard_period_profits_with_snapshots()
    test_dashboard_period_profits_without_snapshots()
    test_sentiment_history_note()
    print("\n所有核心测试通过！✓")


if __name__ == "__main__":
    main()