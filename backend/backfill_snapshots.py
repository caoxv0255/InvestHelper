"""回填所有历史快照的 net_deposit 字段。

遍历每条快照日期，用 build_portfolio_snapshot 重建当时的资金流水状态，
然后更新 portfolio_snapshots.net_deposit。
"""
import sys
from datetime import date
from decimal import Decimal

from sqlalchemy import text

from app.db.session import SessionLocal
from app.models.portfolio_snapshots import PortfolioSnapshot
from app.services.portfolio import build_portfolio_snapshot


def main():
    db = SessionLocal()
    try:
        snapshots = (
            db.query(PortfolioSnapshot)
            .order_by(PortfolioSnapshot.snapshot_date.asc())
            .all()
        )
        if not snapshots:
            print("没有快照需要回填")
            return

        print(f"共 {len(snapshots)} 条快照，开始回填 net_deposit ...")

        updated = 0
        for snap in snapshots:
            snap_date = snap.snapshot_date
            # 用流水重建截至该日期的状态
            data = build_portfolio_snapshot(db, as_of=snap_date)
            # 从重建结果中取该币种的 net_deposit
            currency_summary = data["summary_by_currency"].get(snap.currency, {})
            net_deposit = currency_summary.get("net_deposit", 0)
            net_deposit = Decimal(str(net_deposit))

            if snap.net_deposit != net_deposit:
                snap.net_deposit = net_deposit
                updated += 1
                print(f"  {snap_date} {snap.currency}: net_deposit → {net_deposit}")

        if updated > 0:
            db.commit()
            print(f"\n回填完成，更新了 {updated} 条快照")
        else:
            print("\n所有快照 net_deposit 已是最新，无需更新")

    finally:
        db.close()


if __name__ == "__main__":
    main()
